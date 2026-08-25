#!/usr/bin/env python3
"""
DivertScan true-up: hauler's list vs our tickets.

    python3 reconcile.py hauler_email.txt divertscan_export.csv [--from 2026-08-01] [--to 2026-08-15]

hauler_email.txt  — paste the hauler's email body into a plain text file.
                    Understands lines like:
                        8/1 #87334 10:00am 2.24 Ton (Hospital Zone A Dalmex)
                    and picks up "Zone A:" style headers.
divertscan_export.csv — Project → Export CSV (or the XLSX converted to CSV).

Writes reconciliation_<from>_<to>.csv and prints a summary.
Weights: OUR ticket governs (paper ticket is the authority).
"""
import csv, re, sys, os, collections
from datetime import date

TOL_TONS = 0.02          # 40 lbs
MONTHS = {'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
          'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}


# ---------- parse the hauler's email ----------------------------------------
def parse_hauler_email(path, default_year):
    """Pull (date, ticket, time, tons, zone) out of free-text email lines."""
    rows, cur_zone = [], ''
    line_re = re.compile(
        r'(?P<mo>\d{1,2})[/-](?P<da>\d{1,2})'          # 8/1
        r'\s+#?\s*(?P<tkt>[A-Za-z0-9-]+)'              # #87334
        r'(?:\s+(?P<time>\d{1,2}:\d{2}\s*[apAP]?\.?[mM]?))?'   # 10:00am
        r'\s+(?P<tons>\d+(?:\.\d+)?)\s*(?:ton|tons|t)\b',      # 2.24 Ton
        re.I)
    zone_hdr = re.compile(r'^\s*zone\s+([A-Z])\s*:?\s*$', re.I)
    zone_inline = re.compile(r'zone\s*([A-Z])\b', re.I)

    for raw in open(path, encoding='utf-8', errors='replace'):
        line = raw.strip()
        if not line:
            continue
        h = zone_hdr.match(line)
        if h:
            cur_zone = h.group(1).upper()
            continue
        m = line_re.search(line)
        if not m:
            continue
        zi = zone_inline.search(line)
        rows.append(dict(
            date=f"{default_year}-{int(m.group('mo')):02d}-{int(m.group('da')):02d}",
            ticket=m.group('tkt').lstrip('#').lstrip('0') or '0',
            time=(m.group('time') or '').strip(),
            tons=float(m.group('tons')),
            zone=(zi.group(1).upper() if zi else cur_zone),
            raw=line))
    return rows


# ---------- parse our export -------------------------------------------------
def parse_export(path, dfrom, dto):
    def norm_date(s):
        s = str(s).strip()
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
        if m:
            return s[:10]
        m = re.match(r'([A-Za-z]{3})\w*\s+(\d{1,2}),?\s*(\d{4})', s)   # Aug 1, 2026
        if m:
            return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
        m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
        if m:
            return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        return ''

    rows = []
    with open(path, encoding='utf-8-sig', errors='replace') as f:
        rd = csv.reader(f)
        hdr = None
        for r in rd:
            if not r or not any(x.strip() for x in r):
                continue
            low = [c.strip().lower() for c in r]
            if hdr is None:
                if any(c in ('date', 'ticket date', 'ticket_date') for c in low):
                    hdr = low
                continue
            # an unquoted "Aug 1, 2026" splits across two cells — stitch it back
            if len(r) > 1 and re.match(r'^[A-Z][a-z]{2} \d+$', r[0].strip()) \
                          and re.match(r'^\s*\d{4}$', r[1]):
                r = [r[0].strip() + ', ' + r[1].strip()] + r[2:]
            rec = dict(zip(hdr, [c.strip() for c in r]))

            def pick(*names):
                for n in names:
                    if n in rec and rec[n] != '':
                        return rec[n]
                return ''

            d = norm_date(pick('date', 'ticket date', 'ticket_date'))
            if not d or not (dfrom <= d <= dto):
                continue
            try:
                tons = float(pick('tons', 'net tons', 'net_tons') or 0)
            except ValueError:
                tons = 0.0
            rows.append(dict(
                ticket=(pick('ticket no', 'ticket #', 'ticket_number', 'ticket') or '').lstrip('#').lstrip('0') or '0',
                date=d, tons=tons,
                zone=(pick('zone') or '').upper().replace('ZONE ', ''),
                driver=pick('driver', 'driver name', 'driver_name'),
                gross=pick('gwt (lbs)', 'gross (lbs)', 'gross_lbs'),
                tare=pick('tare (lbs)', 'tare_lbs')))
    return rows


# ---------- compare ----------------------------------------------------------
def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = {}
    for i, a in enumerate(sys.argv):
        if a == '--from': opts['from'] = sys.argv[i+1]
        if a == '--to':   opts['to']   = sys.argv[i+1]
    if len(args) < 2:
        sys.exit(__doc__)
    email_path, export_path = args[0], args[1]
    dfrom = opts.get('from', f"{date.today().year}-01-01")
    dto   = opts.get('to',   f"{date.today().year}-12-31")
    year  = int(dfrom[:4])

    hauler_rows = [r for r in parse_hauler_email(email_path, year)
                   if dfrom <= r['date'] <= dto]
    ours = parse_export(export_path, dfrom, dto)

    # hauler duplicates
    seen, dupes, hauler = {}, [], {}
    for r in hauler_rows:
        k = r['ticket']
        if k in seen:
            dupes.append(r)
        else:
            seen[k] = r; hauler[k] = r
    ours_by = {}
    our_dupes = []
    for r in ours:
        if r['ticket'] in ours_by:
            our_dupes.append(r)
        else:
            ours_by[r['ticket']] = r

    matched, wt, zn, dt = [], [], [], []
    missing = []
    for k, h in hauler.items():
        o = ours_by.get(k)
        if not o:
            missing.append(h); continue
        matched.append((h, o))
        if abs(o['tons'] - h['tons']) > TOL_TONS: wt.append((h, o))
        if h['zone'] and o['zone'] and o['zone'] != h['zone']: zn.append((h, o))
        if o['date'] != h['date']: dt.append((h, o))
    extra = [o for o in ours if o['ticket'] not in hauler]
    extra_zoned = [o for o in extra if o['zone']]

    W = 78
    print('=' * W)
    print(f"TRUE-UP  {dfrom} → {dto}")
    print('=' * W)
    print(f"Hauler list : {len(hauler)} tickets, {sum(r['tons'] for r in hauler.values()):.2f} T"
          + (f"  ({len(dupes)} duplicate line(s) ignored)" if dupes else ""))
    print(f"DivertScan  : {len(ours)} tickets, {sum(r['tons'] for r in ours):.2f} T")
    print(f"Matched     : {len(matched)}")
    print(f"  weight differs (>{TOL_TONS} T): {len(wt)}   zone: {len(zn)}   date: {len(dt)}")
    print(f"On their list, not ours : {len(missing)}")
    print(f"Ours, not on their list : {len(extra)}  ({len(extra_zoned)} with a zone,"
          f" {sum(o['tons'] for o in extra_zoned):.2f} T)")

    def sec(title, items, fmt):
        print('\n' + '-' * W); print(title); print('-' * W)
        if not items: print('  (none)')
        for it in items: print('  ' + fmt(it))

    sec("ON THEIR LIST, NOT IN DIVERTSCAN — chase the paper ticket",
        sorted(missing, key=lambda r: (r['date'], r['ticket'])),
        lambda r: f"{r['date']}  #{r['ticket']:<9} Zone {r['zone'] or '-'}  {r['tons']:.2f} T  {r['time']}")

    sec("DUPLICATE LINES ON THEIR LIST — they'd bill twice", dupes,
        lambda r: f"{r['date']}  #{r['ticket']:<9} {r['tons']:.2f} T   ({r['raw'][:50]})")

    sec("OURS, NOT ON THEIR LIST, WITH A ZONE — unbilled",
        sorted(extra_zoned, key=lambda r: (r['date'], r['ticket'])),
        lambda r: f"{r['date']}  #{r['ticket']:<9} Zone {r['zone']}  {r['tons']:.2f} T  {r['driver']}")

    sec("WEIGHT DIFFERENCES — our ticket governs", wt,
        lambda p: f"{p[0]['date']}  #{p[0]['ticket']:<9} theirs {p[0]['tons']:.2f}  |  ours {p[1]['tons']:.2f}  ({p[1]['tons']-p[0]['tons']:+.2f})")

    sec("ZONE DIFFERENCES", zn,
        lambda p: f"{p[0]['date']}  #{p[0]['ticket']:<9} theirs {p[0]['zone']}  |  ours {p[1]['zone']}")

    sec("DATE DIFFERENCES — check the ticket PHOTO, never the ticket number", dt,
        lambda p: f"#{p[0]['ticket']:<9} theirs {p[0]['date']}  |  ours {p[1]['date']}")

    if our_dupes:
        sec("DUPLICATE TICKET NUMBERS IN OUR EXPORT", our_dupes,
            lambda r: f"{r['date']}  #{r['ticket']}  {r['tons']:.2f} T")

    out = f"reconciliation_{dfrom}_{dto}.csv"
    with open(out, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['status','ticket','their_date','our_date','their_zone','our_zone',
                    'their_tons','our_tons','difference','driver'])
        for h, o in matched:
            st = []
            if abs(o['tons']-h['tons']) > TOL_TONS: st.append('WEIGHT')
            if h['zone'] and o['zone'] and o['zone'] != h['zone']: st.append('ZONE')
            if o['date'] != h['date']: st.append('DATE')
            w.writerow(['OK' if not st else '+'.join(st), h['ticket'], h['date'], o['date'],
                        h['zone'], o['zone'], f"{h['tons']:.2f}", f"{o['tons']:.2f}",
                        f"{o['tons']-h['tons']:+.2f}", o['driver']])
        for h in missing:
            w.writerow(['NOT_IN_DIVERTSCAN', h['ticket'], h['date'], '', h['zone'], '',
                        f"{h['tons']:.2f}", '', '', ''])
        for o in extra_zoned:
            w.writerow(['NOT_ON_THEIR_LIST', o['ticket'], '', o['date'], '', o['zone'],
                        '', f"{o['tons']:.2f}", '', o['driver']])
    print(f"\nWrote {out}")


if __name__ == '__main__':
    main()
