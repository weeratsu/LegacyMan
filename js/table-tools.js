/* table-tools.js (Nov 23 2026) — every table in LegacyMan gets: search box + click-to-sort headers.
 * Sort: 1st click ▲, 2nd ▼, 3rd = original order. Numbers (1,234.56), dates (dd/mm/yyyy) sort by value.
 * Search: multi-word AND, matches row text. Re-applied automatically after each render (MutationObserver).
 */
(function () {
  const num = s => { const t = s.replace(/[,฿\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
  const dt = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s.trim()); return m ? +(m[3] + m[2] + m[1]) : null; };
  function key(td) { const s = (td ? td.textContent : '').trim(); const d = dt(s); if (d != null) return [0, d]; const n = num(s); if (n != null) return [0, n]; return [1, s.toLowerCase()]; }
  function cmp(a, b) { if (a[0] !== b[0]) return a[0] - b[0]; return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; }

  function setup(tbl) {
    if (tbl.dataset.tt) return; const tb = tbl.tBodies[0], th = tbl.tHead && tbl.tHead.rows[0]; if (!tb || !th) return;
    const rows = [...tb.rows].filter(r => !r.querySelector('td.empty,td[colspan]')); if (!rows.length) return;
    tbl.dataset.tt = '1'; rows.forEach((r, i) => { r.dataset.ord = i; });
    // search box
    const box = document.createElement('input'); box.type = 'search'; box.placeholder = '🔍 ค้นหาในตารางนี้';
    box.style.cssText = 'width:min(320px,100%);padding:6px 10px;margin:0 0 8px;border:1px solid var(--border);border-radius:6px;font:inherit';
    const cnt = document.createElement('span'); cnt.style.cssText = 'margin-left:8px;font-size:12px;color:var(--muted)';
    const wrap = document.createElement('div'); wrap.append(box, cnt);
    const host = tbl.closest('.card') || tbl; host.parentNode.insertBefore(wrap, host);
    box.oninput = () => { const w = box.value.toLowerCase().split(/\s+/).filter(Boolean); let n = 0;
      rows.forEach(r => { const t = r.textContent.toLowerCase(), ok = w.every(x => t.includes(x)); r.style.display = ok ? '' : 'none'; if (ok) n++; });
      cnt.textContent = w.length ? n + ' / ' + rows.length : ''; };
    box.onkeydown = e => { if (e.key === 'Escape') { box.value = ''; box.oninput(); } };
    // sort headers
    let col = -1, dir = 0;
    [...th.cells].forEach((h, i) => { if (!h.textContent.trim()) return; h.style.cursor = 'pointer'; h.style.userSelect = 'none'; h.title = 'คลิกเพื่อเรียง';
      h.onclick = () => { dir = col === i ? (dir === 1 ? -1 : dir === -1 ? 0 : 1) : 1; col = i;
        [...th.cells].forEach(x => { x.textContent = x.textContent.replace(/ [▲▼]$/, ''); });
        if (dir) h.textContent += dir === 1 ? ' ▲' : ' ▼';
        const s = rows.slice().sort((a, b) => dir ? cmp(key(a.cells[i]), key(b.cells[i])) * dir : a.dataset.ord - b.dataset.ord);
        s.forEach(r => tb.appendChild(r)); }; });
  }
  function scan() { document.querySelectorAll('#view table').forEach(setup); }
  const go = () => { const v = document.getElementById('view'); if (!v) return setTimeout(go, 50);
    new MutationObserver(scan).observe(v, { childList: true, subtree: true }); scan(); };
  go();
})();
