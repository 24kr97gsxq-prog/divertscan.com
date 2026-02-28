/**
 * ============================================================
 * DIVERTSCAN APEX V1 — QuickBooks Export Module
 * File: divertscan_quickbooks_export.js
 * Version: 1.0.0
 * 
 * Generates QuickBooks IIF (Intuit Interchange Format) files
 * for all loads grouped by project. Also exports CSV as a 
 * fallback for QuickBooks Online (which uses CSV import).
 *
 * Usage:
 *   DivertScanQBExport.generateIIF(projectId)   → .iif download
 *   DivertScanQBExport.generateCSV(projectId)   → .csv download
 *   DivertScanQBExport.generateAll()            → ZIP of all projects
 *
 * Integrates with DivertScan IndexedDB (offline-first / Vanessa Protocol)
 * and falls back to API fetch if online.
 * ============================================================
 */

const DivertScanQBExport = (() => {

  // ── CONFIG ────────────────────────────────────────────────
  const CONFIG = {
    // QuickBooks account names — match exactly what's in your QB chart of accounts
    INCOME_ACCOUNT:   'LEED Compliance Services',
    AR_ACCOUNT:       'Accounts Receivable',
    CLASS_PREFIX:     'LEED-',           // QB class = "LEED-{projectName}"
    RATE_PER_TON:     125.00,            // $125/ton — your standard LEED compliance rate
    COMPANY_NAME:     'DalMex Recycling & Pallets',
    TAX_CODE:         'Non',             // Non-taxable by default; change to 'Tax' if needed
    TERMS:            'Net 30',
    MEMO_PREFIX:      'DivertScan Load', // Appears on each QB line item
    IIF_VERSION:      '1',
  };

  // ── INDEXEDDB ACCESS ──────────────────────────────────────
  // Reads from DivertScan's existing IndexedDB stores
  async function getLoadsFromDB(projectId = null) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DivertScanDB', 1);

      request.onerror = () => reject(new Error('IndexedDB unavailable'));

      request.onsuccess = (event) => {
        const db = event.target.result;

        // Support both 'loads' and 'scans' store names (handles legacy versions)
        const storeName = db.objectStoreNames.contains('loads') ? 'loads'
                        : db.objectStoreNames.contains('scans') ? 'scans'
                        : null;

        if (!storeName) {
          resolve([]);
          return;
        }

        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const allRequest = store.getAll();

        allRequest.onsuccess = () => {
          let loads = allRequest.result || [];
          if (projectId) {
            loads = loads.filter(l => String(l.projectId) === String(projectId));
          }
          // Only include synced/confirmed loads (not drafts)
          loads = loads.filter(l => l.status !== 'draft' && l.status !== 'pending_upload');
          resolve(loads);
        };

        allRequest.onerror = () => reject(new Error('Failed to read loads from IndexedDB'));
      };
    });
  }

  // ── API FALLBACK (Sullivan Fault — handles 408 timeouts) ──
  async function getLoadsFromAPI(projectId = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s per Sullivan Fault spec

    try {
      const url = projectId
        ? `/api/loads?project_id=${encodeURIComponent(projectId)}&status=confirmed`
        : `/api/loads?status=confirmed`;

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      return data.loads || data || [];
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.warn('[DivertScan QB] API timeout (408) — falling back to IndexedDB');
      }
      return null; // Signal fallback needed
    }
  }

  // ── LOAD RESOLVER (Vanessa Protocol — offline-first) ──────
  async function resolveLoads(projectId = null) {
    // Always try IndexedDB first (offline-first architecture)
    let loads = await getLoadsFromDB(projectId).catch(() => []);

    // If online and IndexedDB empty, try API
    if (loads.length === 0 && navigator.onLine) {
      const apiLoads = await getLoadsFromAPI(projectId);
      if (apiLoads && apiLoads.length > 0) {
        loads = apiLoads;
      }
    }

    if (loads.length === 0) {
      throw new Error('No confirmed loads found. Check that loads are synced.');
    }

    return loads;
  }

  // ── PROJECT GROUPING ──────────────────────────────────────
  function groupByProject(loads) {
    return loads.reduce((acc, load) => {
      const key = load.projectId || load.project_id || 'UNASSIGNED';
      if (!acc[key]) acc[key] = { projectId: key, projectName: load.projectName || load.project_name || key, loads: [] };
      acc[key].loads.push(load);
      return acc;
    }, {});
  }

  // ── LOAD NORMALIZATION ────────────────────────────────────
  // Handles both camelCase and snake_case field names across DivertScan versions
  function normalizeLoad(load) {
    return {
      id:           load.id || load.loadId || load.load_id || 'N/A',
      date:         load.date || load.loadDate || load.load_date || load.created_at || new Date().toISOString(),
      ticketNumber: load.ticketNumber || load.ticket_number || load.ticket || '',
      hauler:       load.hauler || load.haulerName || load.hauler_name || '',
      truckId:      load.truckId || load.truck_id || load.vehicle || '',
      weightTons:   parseFloat(load.weightTons || load.weight_tons || load.net_weight_tons || load.netWeightTons || 0),
      weightLbs:    parseFloat(load.weightLbs  || load.weight_lbs  || load.net_weight_lbs  || 0),
      materialType: load.materialType || load.material_type || load.material || 'Mixed C&D',
      carbonSaved:  parseFloat(load.carbonSaved || load.carbon_saved || load.co2e_savings || 0),
      hash:         load.hash || load.sha256Hash || load.sha256_hash || '',  // Vanessa Protocol SHA-256
      projectId:    load.projectId || load.project_id || 'UNASSIGNED',
      projectName:  load.projectName || load.project_name || 'Unassigned Project',
      notes:        load.notes || '',
    };
  }

  // ── DATE FORMATTER ────────────────────────────────────────
  function toQBDate(isoString) {
    try {
      const d = new Date(isoString);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;  // QuickBooks expects MM/DD/YYYY
    } catch {
      return new Date().toLocaleDateString('en-US');
    }
  }

  // ── WEIGHT RESOLVER ───────────────────────────────────────
  // Prefers tons; converts lbs if tons not available
  function resolveWeightTons(load) {
    if (load.weightTons > 0) return load.weightTons;
    if (load.weightLbs > 0) return Number((load.weightLbs / 2000).toFixed(4));
    return 0;
  }

  // ── IIF GENERATOR ─────────────────────────────────────────
  // QuickBooks IIF (Intuit Interchange Format) — Desktop QB import
  function buildIIF(projectGroups) {
    const lines = [];

    // ── IIF Header
    lines.push(`!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tTOPRINT\tTERMS`);
    lines.push(`!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\tCLEAR\tQNTY\tPRICE\tINVITEM`);
    lines.push(`!ENDTRNS`);

    let invoiceNumber = 1000; // Starting invoice number — adjust to match your QB sequence

    for (const [projectId, group] of Object.entries(projectGroups)) {
      const projectName = group.projectName;
      const qbClass = `${CONFIG.CLASS_PREFIX}${projectName.replace(/[^a-zA-Z0-9\s\-]/g, '').trim()}`;
      const loads = group.loads.map(normalizeLoad);

      // ── Group loads by date for invoice batching (one invoice per project per day)
      const byDate = loads.reduce((acc, l) => {
        const dateKey = toQBDate(l.date);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(l);
        return acc;
      }, {});

      for (const [invoiceDate, dayLoads] of Object.entries(byDate)) {
        const docNum = `DS-${invoiceNumber++}`;
        const invoiceTotal = dayLoads.reduce((sum, l) => {
          return sum + (resolveWeightTons(l) * CONFIG.RATE_PER_TON);
        }, 0).toFixed(2);

        // TRNS line (invoice header)
        lines.push([
          'TRNS',
          'INVOICE',
          invoiceDate,
          CONFIG.AR_ACCOUNT,
          projectName,           // Customer name in QB
          qbClass,
          invoiceTotal,
          docNum,
          `LEED Compliance Documentation - ${projectName}`,
          'N',                   // Not cleared
          'Y',                   // To print
          CONFIG.TERMS,
        ].join('\t'));

        // SPL lines (one per load)
        for (const load of dayLoads) {
          const tons = resolveWeightTons(load);
          const lineAmount = (tons * CONFIG.RATE_PER_TON).toFixed(2);
          const memo = [
            `${CONFIG.MEMO_PREFIX} #${load.ticketNumber || load.id}`,
            load.materialType,
            load.hauler ? `| ${load.hauler}` : '',
            load.hash ? `| SHA:${load.hash.substring(0, 8)}` : '', // First 8 chars of Vanessa hash
          ].filter(Boolean).join(' ');

          lines.push([
            'SPL',
            'INVOICE',
            invoiceDate,
            CONFIG.INCOME_ACCOUNT,
            projectName,
            qbClass,
            `-${lineAmount}`,    // Negative on SPL = income (QB convention)
            docNum,
            memo,
            'N',
            tons.toFixed(4),     // Quantity in tons
            CONFIG.RATE_PER_TON.toFixed(2),
            'LEED Compliance Documentation',  // QB service item name
          ].join('\t'));
        }

        lines.push('ENDTRNS');
      }
    }

    return lines.join('\r\n'); // QuickBooks IIF requires CRLF
  }

  // ── CSV GENERATOR ─────────────────────────────────────────
  // For QuickBooks Online (QBO) which uses CSV import
  function buildCSV(projectGroups) {
    const rows = [];

    // QBO invoice import headers
    rows.push([
      'InvoiceNo',
      'Customer',
      'InvoiceDate',
      'DueDate',
      'Terms',
      'ItemName',
      'ItemDescription',
      'Qty',
      'Rate',
      'Amount',
      'Class',
      'Memo',
      'SHA256_Audit_Hash',  // Extra column for GBCI audit trail
      'LoadTicket',
      'MaterialType',
      'Hauler',
      'TruckID',
      'CarbonSavedTons',
    ].join(','));

    let invoiceNumber = 1000;

    for (const [projectId, group] of Object.entries(projectGroups)) {
      const projectName = group.projectName;
      const qbClass = `${CONFIG.CLASS_PREFIX}${projectName.replace(/[,"\n]/g, ' ').trim()}`;
      const loads = group.loads.map(normalizeLoad);

      const byDate = loads.reduce((acc, l) => {
        const dateKey = toQBDate(l.date);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(l);
        return acc;
      }, {});

      for (const [invoiceDate, dayLoads] of Object.entries(byDate)) {
        const docNum = `DS-${invoiceNumber++}`;

        // Calculate due date (Net 30)
        const dueDate = (() => {
          try {
            const d = new Date(invoiceDate);
            d.setDate(d.getDate() + 30);
            return d.toLocaleDateString('en-US');
          } catch {
            return '';
          }
        })();

        for (const load of dayLoads) {
          const tons = resolveWeightTons(load);
          const amount = (tons * CONFIG.RATE_PER_TON).toFixed(2);

          const description = [
            `LEED v5 MRp2 Compliance Documentation`,
            `Load #${load.ticketNumber || load.id}`,
            `${load.materialType}`,
            load.hauler ? `Hauler: ${load.hauler}` : '',
          ].filter(Boolean).join(' | ');

          // CSV-safe field (wrap in quotes, escape internal quotes)
          const safe = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

          rows.push([
            safe(docNum),
            safe(projectName),
            safe(invoiceDate),
            safe(dueDate),
            safe(CONFIG.TERMS),
            safe('LEED Compliance Documentation'),
            safe(description),
            tons.toFixed(4),
            CONFIG.RATE_PER_TON.toFixed(2),
            amount,
            safe(qbClass),
            safe(`DivertScan Export | ${new Date().toLocaleDateString()}`),
            safe(load.hash || ''),
            safe(load.ticketNumber || load.id),
            safe(load.materialType),
            safe(load.hauler),
            safe(load.truckId),
            (load.carbonSaved || 0).toFixed(4),
          ].join(','));
        }
      }
    }

    return rows.join('\r\n');
  }

  // ── DOWNLOAD HELPER ───────────────────────────────────────
  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ── FILENAME BUILDER ──────────────────────────────────────
  function buildFilename(projectName, ext) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safe = (projectName || 'AllProjects').replace(/[^a-zA-Z0-9\-]/g, '_');
    return `DivertScan_QB_${safe}_${date}.${ext}`;
  }

  // ── SUMMARY STATS ─────────────────────────────────────────
  function buildSummary(projectGroups) {
    const summary = {};
    for (const [id, group] of Object.entries(projectGroups)) {
      const loads = group.loads.map(normalizeLoad);
      const totalTons = loads.reduce((s, l) => s + resolveWeightTons(l), 0);
      const totalRevenue = totalTons * CONFIG.RATE_PER_TON;
      const totalCarbon = loads.reduce((s, l) => s + (l.carbonSaved || 0), 0);
      summary[id] = {
        projectName: group.projectName,
        loadCount: loads.length,
        totalTons: totalTons.toFixed(2),
        totalRevenue: `$${totalRevenue.toFixed(2)}`,
        totalCarbonSaved: `${totalCarbon.toFixed(2)} tons CO₂e`,
      };
    }
    return summary;
  }

  // ── PUBLIC API ────────────────────────────────────────────

  /**
   * Generate and download a QuickBooks IIF file for a single project.
   * @param {string|null} projectId — null = all projects
   */
  async function generateIIF(projectId = null) {
    try {
      const loads = await resolveLoads(projectId);
      const groups = groupByProject(loads);
      const iifContent = buildIIF(groups);
      const summary = buildSummary(groups);
      const projectName = projectId ? (Object.values(groups)[0]?.projectName || projectId) : null;
      triggerDownload(iifContent, buildFilename(projectName, 'iif'), 'text/plain;charset=utf-8');
      console.log('[DivertScan QB] IIF export complete:', summary);
      return { success: true, summary, format: 'IIF', filename: buildFilename(projectName, 'iif') };
    } catch (err) {
      console.error('[DivertScan QB] IIF export failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate and download a QuickBooks Online CSV file.
   * @param {string|null} projectId — null = all projects
   */
  async function generateCSV(projectId = null) {
    try {
      const loads = await resolveLoads(projectId);
      const groups = groupByProject(loads);
      const csvContent = buildCSV(groups);
      const summary = buildSummary(groups);
      const projectName = projectId ? (Object.values(groups)[0]?.projectName || projectId) : null;
      triggerDownload(csvContent, buildFilename(projectName, 'csv'), 'text/csv;charset=utf-8');
      console.log('[DivertScan QB] CSV export complete:', summary);
      return { success: true, summary, format: 'CSV', filename: buildFilename(projectName, 'csv') };
    } catch (err) {
      console.error('[DivertScan QB] CSV export failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate both IIF and CSV for all projects simultaneously.
   */
  async function generateAll() {
    const [iifResult, csvResult] = await Promise.all([generateIIF(), generateCSV()]);
    return { iif: iifResult, csv: csvResult };
  }

  /**
   * Preview export data without downloading — useful for UI preview panel.
   * @param {string|null} projectId
   */
  async function previewExport(projectId = null) {
    try {
      const loads = await resolveLoads(projectId);
      const groups = groupByProject(loads);
      return buildSummary(groups);
    } catch (err) {
      return { error: err.message };
    }
  }

  return { generateIIF, generateCSV, generateAll, previewExport, CONFIG };

})();


// ============================================================
// UI INTEGRATION — Add these buttons to your DivertScan dashboard
// Copy this into your React/HTML project panel component
// ============================================================

/*
  ── React Component Example (Tailwind, iPad-optimized) ──

  function QuickBooksExportPanel({ projectId, projectName }) {
    const [status, setStatus] = React.useState('');
    const [summary, setSummary] = React.useState(null);

    const handleExport = async (format) => {
      setStatus('Generating...');
      const result = format === 'iif'
        ? await DivertScanQBExport.generateIIF(projectId)
        : await DivertScanQBExport.generateCSV(projectId);
      if (result.success) {
        setSummary(result.summary);
        setStatus(`✓ ${format.toUpperCase()} downloaded`);
      } else {
        setStatus(`✗ Error: ${result.error}`);
      }
    };

    return (
      <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-1">QuickBooks Export</h3>
        <p className="text-sm text-gray-500 mb-4">{projectName || 'All Projects'}</p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleExport('iif')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-sm"
          >
            QB Desktop (.iif)
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg text-sm"
          >
            QB Online (.csv)
          </button>
        </div>

        {status && (
          <p className={`text-sm font-medium ${status.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
            {status}
          </p>
        )}

        {summary && Object.entries(summary).map(([id, s]) => (
          <div key={id} className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-bold">{s.projectName}</p>
            <p className="text-gray-600">{s.loadCount} loads · {s.totalTons} tons · {s.totalRevenue}</p>
            <p className="text-green-600">{s.totalCarbonSaved} avoided</p>
          </div>
        ))}
      </div>
    );
  }
*/


// ============================================================
// FASTAPI BACKEND ENDPOINT — Add to your main.py
// Optional: server-side IIF/CSV generation via API
// ============================================================

/*
  # Add to requirements.txt: (no new packages needed — stdlib only)
  
  # Add to main.py:

  from fastapi import APIRouter
  from fastapi.responses import StreamingResponse
  import io, csv, hashlib
  from datetime import datetime, timedelta
  from typing import Optional

  qb_router = APIRouter(prefix="/api/quickbooks", tags=["QuickBooks Export"])

  RATE_PER_TON = 125.00
  INCOME_ACCOUNT = "LEED Compliance Services"
  AR_ACCOUNT = "Accounts Receivable"

  @qb_router.get("/export/csv")
  async def export_quickbooks_csv(project_id: Optional[str] = None, db=Depends(get_db)):
      query = "SELECT * FROM loads WHERE status = 'confirmed'"
      params = []
      if project_id:
          query += " AND project_id = $1"
          params.append(project_id)
      loads = await db.fetch(query, *params)

      output = io.StringIO()
      writer = csv.writer(output)
      writer.writerow([
          'InvoiceNo','Customer','InvoiceDate','DueDate','Terms',
          'ItemName','ItemDescription','Qty','Rate','Amount',
          'Class','Memo','SHA256_Audit_Hash','LoadTicket','MaterialType',
          'Hauler','TruckID','CarbonSavedTons'
      ])

      invoice_num = 1000
      for load in loads:
          tons = float(load['net_weight_tons'] or 0)
          amount = round(tons * RATE_PER_TON, 2)
          invoice_date = load['created_at'].strftime('%m/%d/%Y')
          due_date = (load['created_at'] + timedelta(days=30)).strftime('%m/%d/%Y')
          writer.writerow([
              f"DS-{invoice_num}", load['project_name'], invoice_date, due_date,
              'Net 30', 'LEED Compliance Documentation',
              f"Load #{load['ticket_number']} | {load['material_type']}",
              f"{tons:.4f}", f"{RATE_PER_TON:.2f}", f"{amount:.2f}",
              f"LEED-{load['project_name']}", f"DivertScan Export",
              load['sha256_hash'] or '',
              load['ticket_number'] or '', load['material_type'] or '',
              load['hauler_name'] or '', load['truck_id'] or '',
              f"{float(load['carbon_saved'] or 0):.4f}"
          ])
          invoice_num += 1

      output.seek(0)
      filename = f"DivertScan_QB_{datetime.now().strftime('%Y-%m-%d')}.csv"
      return StreamingResponse(
          iter([output.getvalue()]),
          media_type="text/csv",
          headers={"Content-Disposition": f"attachment; filename={filename}"}
      )

  # Register in main app:
  # app.include_router(qb_router)
*/
