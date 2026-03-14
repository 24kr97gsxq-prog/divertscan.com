        async approveBatch(bIdx) {
            var batch = this._pendingBatches && this._pendingBatches[bIdx];
            if (!batch || !batch.items.length) return;
            var q0 = batch.items[0];
            var projMap = {};
            this.state.projects.forEach(function(p){projMap[p.id]=p.name;});

            // Separate by type (all come in as scale_ticket now, but legacy batches may have debris)
            var scale = batch.items.filter(function(q){return q.photo_type==='scale_ticket';});
            var debris = batch.items.filter(function(q){return q.photo_type==='debris';});

            // Build review modal
            var m = document.createElement('div');
            m.className = 'modal-overlay show';
            m.id = 'batchReviewModal';
            m.onclick = function(e){if(e.target===m)m.remove();};

            var html = '<div class="modal" style="max-height:92vh"><div class="modal-handle"></div>' +
                '<div class="modal-title">Process ' + batch.items.length + ' Photo' + (batch.items.length>1?'s':'') + '</div>' +
                '<div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">' +
                (projMap[q0.project_id]||'Unknown Project') + ' • ' + (q0.submitted_by||'Unknown') + '</div>';

            // Show all photos in a grid with classification status
            html += '<div id="photoClassGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
            batch.items.forEach(function(q, idx) {
                html += '<div id="photoCell_'+idx+'" style="position:relative;border:2px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer" onclick="window.open(\''+q.photo_url+'\')">'+
                    '<img src="'+q.photo_url+'" style="width:100%;aspect-ratio:1;object-fit:cover">'+
                    '<div id="photoLabel_'+idx+'" style="position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:.55rem;font-weight:700;padding:2px;background:rgba(0,0,0,.6);color:#fff">'+
                    (q.photo_type==='scale_ticket'?'📄 SCALE':'📸 DEBRIS')+'</div></div>';
            });
            html += '</div>';

            // AI classify button
            if (this.state.apiKey) {
                html += '<button class="btn btn-info mb-12" style="width:100%" id="classifyBtn" onclick="DS._classifyAndProcess('+bIdx+')">'+
                    '🤖 AI Read & Process All ' + batch.items.length + ' Photos</button>';
            }

            // Manual ticket rows — one per scale ticket photo
            html += '<div id="ticketRows"></div>';

            html += '<button id="confirmAllBtn" class="btn btn-success mb-8 hidden" style="width:100%" onclick="DS._confirmAllTickets('+bIdx+')">✅ Create All Tickets</button>'+
                '<button class="btn btn-outline" style="width:100%" onclick="document.getElementById(\'batchReviewModal\').remove()">Cancel</button>'+
                '</div>';

            m.innerHTML = html;
            document.body.appendChild(m);

            this._activeBatch = batch;
            this._activeBatchIdx = bIdx;
            this._ticketData = [];

            // Auto-run AI if key available
            if (this.state.apiKey) {
                setTimeout(function(){ DS._classifyAndProcess(bIdx); }, 400);
            }
        },

        async _classifyAndProcess(bIdx) {
            var batch = this._activeBatch;
            if (!batch) return;

            var btn = document.getElementById('classifyBtn');
            if (btn) { btn.disabled = true; btn.textContent = '🤖 Reading photos...'; }

            this._ticketData = [];
            var scaleTickets = [];
            var debrisPhotos = [];

            // Step 1: Classify each photo
            for (var idx = 0; idx < batch.items.length; idx++) {
                var q = batch.items[idx];
                var cell = document.getElementById('photoCell_' + idx);
                var label = document.getElementById('photoLabel_' + idx);

                if (label) label.textContent = '🔍 Reading...';

                try {
                    var classPrompt = 'Look at this image. Is it:\n' +
                        'A) A scale ticket / weight ticket / receipt (printed paper with numbers, weights, dates)\n' +
                        'B) A debris/load photo (showing physical waste material, dumpster contents, debris pile)\n\n' +
                        'If A (scale ticket), also extract: ticket_number (5-digit red printed number), date (YYYY-MM-DD), gross_lbs, tare_lbs, net_lbs.\n' +
                        'Return ONLY valid JSON:\n' +
                        '{"type":"scale_ticket" or "debris","ticket_number":"XXXXX or null","date":"YYYY-MM-DD or null","gross_lbs":0,"tare_lbs":0,"net_lbs":0,"confidence":0-100}';

                    var data = await this.callOpenAI({
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: [
                            { type: 'text', text: classPrompt },
                            { type: 'image_url', image_url: { url: q.photo_url, detail: 'high' } }
                        ]}],
                        max_tokens: 200, temperature: 0.1
                    });

                    var text = (data.choices&&data.choices[0]&&data.choices[0].message.content)||'{}';
                    text = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
                    var result = JSON.parse(text);

                    if (result.type === 'scale_ticket') {
                        scaleTickets.push({ q: q, ocr: result, idx: idx });
                        if (cell) cell.style.borderColor = 'var(--success)';
                        if (label) label.textContent = '📄 SCALE #' + (result.ticket_number||'?');
                    } else {
                        debrisPhotos.push({ q: q, idx: idx });
                        if (cell) cell.style.borderColor = 'var(--info)';
                        if (label) label.textContent = '📸 DEBRIS';
                    }
                } catch(e) {
                    console.error('Classify error idx '+idx+':', e);
                    // Default to scale_ticket if unsure
                    scaleTickets.push({ q: q, ocr: {}, idx: idx });
                    if (label) label.textContent = '📄 SCALE (unread)';
                }
            }

            this._classifiedScale = scaleTickets;
            this._classifiedDebris = debrisPhotos;

            // Step 2: Build editable ticket rows for each scale ticket
            var rowsEl = document.getElementById('ticketRows');
            if (rowsEl && scaleTickets.length > 0) {
                var html = '<div style="font-size:.7rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">'+
                    '📄 ' + scaleTickets.length + ' Scale Ticket' + (scaleTickets.length>1?'s':'') +
                    (debrisPhotos.length ? ' + 📸 ' + debrisPhotos.length + ' Debris (attaches to last ticket)' : '') +
                    '</div>';

                scaleTickets.forEach(function(item, i) {
                    var ocr = item.ocr;
                    var today = new Date().toISOString().split('T')[0];
                    html += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;background:var(--bg-input)">' +
                        '<div style="display:flex;gap:8px;margin-bottom:8px">' +
                        '<img src="'+item.q.photo_url+'" onclick="window.open(\''+item.q.photo_url+'\')" style="width:60px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer">' +
                        '<div style="flex:1">' +
                        '<div style="font-size:.65rem;color:var(--success);font-weight:700;margin-bottom:4px">📄 Ticket '+(i+1)+' of '+scaleTickets.length+'</div>' +
                        '<input type="text" id="mt_num_'+i+'" class="form-input" value="'+(ocr.ticket_number||'')+'" placeholder="Ticket #" inputmode="numeric" style="margin-bottom:4px;font-size:.8rem">' +
                        '<input type="date" id="mt_date_'+i+'" class="form-input" value="'+(ocr.date||today)+'" style="margin-bottom:4px;font-size:.8rem">' +
                        '<div style="display:flex;gap:4px">' +
                        '<input type="number" id="mt_gross_'+i+'" class="form-input" value="'+(ocr.gross_lbs||'')+'" placeholder="Gross lbs" style="flex:1;font-size:.75rem">' +
                        '<input type="number" id="mt_tare_'+i+'" class="form-input" value="'+(ocr.tare_lbs||'')+'" placeholder="Tare lbs" style="flex:1;font-size:.75rem">' +
                        '</div>' +
                        '</div></div></div>';
                });

                rowsEl.innerHTML = html;
            } else if (rowsEl && scaleTickets.length === 0) {
                rowsEl.innerHTML = '<div style="color:var(--warning);font-size:.75rem;padding:8px">⚠️ No scale tickets detected — all photos will be saved as debris</div>';
            }

            // Show confirm button
            var confirmBtn = document.getElementById('confirmAllBtn');
            if (confirmBtn) confirmBtn.classList.remove('hidden');

            if (btn) { btn.disabled = false; btn.textContent = '🤖 Re-run AI Classification'; }

            this.showToast(scaleTickets.length + ' scale tickets + ' + debrisPhotos.length + ' debris detected');
        },

        async _confirmAllTickets(bIdx) {
            var batch = this._activeBatch;
            var scaleTickets = this._classifiedScale || [];
            var debrisPhotos = this._classifiedDebris || [];
            if (!batch) return;

            var q0 = batch.items[0];
            var created = 0, updated = 0, failed = 0;
            var lastTicketId = null;
            var allDebrisUrls = debrisPhotos.map(function(d){ return d.q.photo_url; });

            this.showLoading('Saving ' + scaleTickets.length + ' ticket' + (scaleTickets.length>1?'s':'') + '...');

            var projectTickets = await this.supabase('tickets?project_id=eq.' + q0.project_id + '&order=ticket_date.desc') || [];

            for (var i = 0; i < scaleTickets.length; i++) {
                var item = scaleTickets[i];
                var tktNum = ((document.getElementById('mt_num_'+i)||{}).value||'').trim();
                if (!tktNum) { failed++; continue; }

                var gross = parseInt((document.getElementById('mt_gross_'+i)||{}).value) || 0;
                var tare = parseInt((document.getElementById('mt_tare_'+i)||{}).value) || 0;
                var netLbs = gross - tare;
                var netTons = +(netLbs / 2000).toFixed(4);
                var tktDate = ((document.getElementById('mt_date_'+i)||{}).value) || new Date().toISOString().split('T')[0];

                // Attach debris only to the last ticket
                var isLast = (i === scaleTickets.length - 1);

                var ticketData = {
                    ticket_date: tktDate,
                    gross_lbs: gross,
                    tare_lbs: tare,
                    net_lbs: netLbs,
                    net_tons: netTons,
                    scale_ticket_image: item.q.photo_url,
                    hauler: q0.submitted_by || null,
                    scan_type: 'batch_queue',
                    debris_images: isLast && allDebrisUrls.length ? allDebrisUrls : []
                };

                var existing = projectTickets.find(function(t){ return t.ticket_number === tktNum; });
                var ticketId = null;

                if (existing) {
                    // Merge debris
                    var existDebris = Array.isArray(existing.debris_images) ? existing.debris_images.slice() : [];
                    if (isLast) allDebrisUrls.forEach(function(u){ if(existDebris.indexOf(u)<0) existDebris.push(u); });
                    ticketData.debris_images = existDebris;
                    await this.supabase('tickets?id=eq.' + existing.id, 'PATCH', ticketData);
                    ticketId = existing.id;
                    updated++;
                } else {
                    ticketData.project_id = q0.project_id;
                    ticketData.ticket_number = tktNum;
                    var result = await this.supabase('tickets', 'POST', ticketData);
                    if (result && result.length) {
                        ticketId = result[0].id;
                        this.state.tickets.unshift(result[0]);
                        created++;
                    } else { failed++; continue; }
                }

                lastTicketId = ticketId;

                // Mark queue item approved
                await this.supabase('photo_queue?id=eq.' + item.q.id, 'PATCH', {
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    ticket_number: tktNum,
                    assigned_ticket_id: ticketId
                });
            }

            // Mark debris items approved, attach to last ticket
            for (var di = 0; di < debrisPhotos.length; di++) {
                await this.supabase('photo_queue?id=eq.' + debrisPhotos[di].q.id, 'PATCH', {
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    assigned_ticket_id: lastTicketId
                });
            }

            // Handle case where NO scale tickets — save all as debris on newest ticket
            if (scaleTickets.length === 0 && debrisPhotos.length > 0 && projectTickets.length > 0) {
                var newest = projectTickets[0];
                var existImgs = Array.isArray(newest.debris_images) ? newest.debris_images.slice() : [];
                allDebrisUrls.forEach(function(u){ if(existImgs.indexOf(u)<0) existImgs.push(u); });
                await this.supabase('tickets?id=eq.' + newest.id, 'PATCH', { debris_images: existImgs });
                for (var di2 = 0; di2 < debrisPhotos.length; di2++) {
                    await this.supabase('photo_queue?id=eq.' + debrisPhotos[di2].q.id, 'PATCH', {
                        status: 'approved', reviewed_at: new Date().toISOString(), assigned_ticket_id: newest.id
                    });
                }
                this.showToast('📸 ' + debrisPhotos.length + ' debris photos attached to #' + newest.ticket_number);
            }

            this.hideLoading();

            var modal = document.getElementById('batchReviewModal');
            if (modal) modal.remove();

            var parts = [];
            if (created > 0) parts.push(created + ' new ticket' + (created>1?'s':'') + ' created');
            if (updated > 0) parts.push(updated + ' updated');
            if (failed > 0) parts.push(failed + ' skipped (no ticket #)');
            if (debrisPhotos.length > 0) parts.push(debrisPhotos.length + ' debris attached');

            this.showToast('✅ ' + parts.join(' • '));
            this.addAuditEntry('BATCH_PROCESS',
                (q0.submitted_by||'Unknown') + ' — ' + parts.join(', ') +
                ' — ' + batch.items.length + ' photos total');

            if (this.state.currentProject && this.state.currentProject.id === q0.project_id) {
                await this.loadTickets(q0.project_id);
            }
            this.loadPhotoQueue();
        },
