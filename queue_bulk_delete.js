// FIND this section in loadPhotoQueue() — the "recently processed" rendering block
// Around the line that says:
// var processed = data.filter(function(q){return q.status!=='pending';}).slice(0,20);

// REPLACE the entire processed rendering block (from "if (processed.length)" to the closing html += line)
// with this new version that includes bulk select/delete:

            if (processed.length) {
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px">' +
                    '<div style="font-size:.6rem;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em">Recently Processed (' + processed.length + ')</div>' +
                    '<div style="display:flex;gap:6px">' +
                    '<button class="btn btn-sm btn-outline" style="font-size:.6rem;padding:4px 8px" onclick="DS._toggleQueueSelectAll()">☑️ Select All</button>' +
                    '<button class="btn btn-sm" style="font-size:.6rem;padding:4px 8px;color:var(--danger);border:1px solid var(--danger);background:transparent" onclick="DS._deleteSelectedQueue()">🗑️ Delete Selected</button>' +
                    '</div></div>';

                processed.forEach(function(q) {
                    var sc = q.status==='approved'?'var(--success)':'var(--text-dim)';
                    var sl = q.status==='approved'?'✅ Processed':'❌ Rejected';
                    var typeIcon = q.photo_type==='scale_ticket'?'📄':'📸';
                    html += '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);align-items:center;font-size:.7rem">' +
                        '<input type="checkbox" class="queue-del-cb" data-id="' + q.id + '" style="width:18px;height:18px;flex-shrink:0">' +
                        '<img src="'+q.photo_url+'" onclick="window.open(\''+q.photo_url+'\')" style="width:40px;height:40px;object-fit:cover;border-radius:4px;cursor:pointer;flex-shrink:0">' +
                        '<div style="flex:1"><span style="font-weight:600">'+typeIcon+' '+(q.ticket_number?'#'+q.ticket_number:(q.photo_type==='scale_ticket'?'Scale':'Debris'))+'</span> • '+
                        (projMap[q.project_id]||'')+' • '+(q.submitted_by||'')+'</div>' +
                        '<div style="color:'+sc+';font-weight:600;font-size:.65rem">'+sl+'</div>' +
                        '</div>';
                });
            }

// Then ADD these two new functions anywhere in the DS object (before the closing }; of DS):

        _toggleQueueSelectAll() {
            var cbs = document.querySelectorAll('.queue-del-cb');
            var allChecked = Array.from(cbs).every(function(cb){ return cb.checked; });
            cbs.forEach(function(cb){ cb.checked = !allChecked; });
        },

        async _deleteSelectedQueue() {
            var cbs = document.querySelectorAll('.queue-del-cb:checked');
            if (cbs.length === 0) { this.showToast('Select items to delete first'); return; }
            if (!confirm('Delete ' + cbs.length + ' selected item' + (cbs.length>1?'s':'') + '? This cannot be undone.')) return;

            this.showLoading('Deleting ' + cbs.length + ' items...');
            var ids = Array.from(cbs).map(function(cb){ return cb.dataset.id; });

            for (var i = 0; i < ids.length; i++) {
                await this.supabase('photo_queue?id=eq.' + ids[i], 'DELETE');
            }

            this.hideLoading();
            this.showToast(ids.length + ' item' + (ids.length>1?'s':'') + ' deleted');
            this.addAuditEntry('QUEUE_BULK_DELETE', ids.length + ' queue items deleted');
            this.loadPhotoQueue();
        },
