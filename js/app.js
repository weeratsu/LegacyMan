/* LegacyMan app.js — Phase 1 (Nov 23 2026): menu, home, manual categories + checklist, localStorage.
 * Data: localStorage 'lm_data' = { items:{cat:[...]}, steps:[...], updated_at }.
 * Phase 2 will add read-only data from CashMan / WealthMan / LoanMan Sheets. Phase 3 = encryption + public page.
 * Passwords are NEVER stored here (REQUIREMENTS §12: separate encrypted PDF).
 */
(function () {
  const KEY = 'lm_data';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
  const fmt = n => num(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  const dmy = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 1800); }

  // ---------- field sets ----------
  const F = {
    name: { l: 'ชื่อรายการ', full: 1 }, inst: { l: 'สถาบัน / บริษัท' }, no: { l: 'เลขบัญชี / กรมธรรม์ / เลขที่' },
    amount: { l: 'ยอดล่าสุด (บาท)', t: 'number' }, as_of: { l: 'ยอด ณ วันที่', t: 'date' },
    benef: { l: 'ผู้รับผลประโยชน์' }, contact: { l: 'ติดต่อ / เบอร์โทร' }, doc: { l: 'ลิงก์เอกสารใน Drive', t: 'url', full: 1 },
    where: { l: 'ที่เก็บเอกสารตัวจริง', full: 1 }, note: { l: 'หมายเหตุ', t: 'area', full: 1 },
    sum: { l: 'ทุนประกัน (บาท)', t: 'number' }, claim: { l: 'เบอร์เคลม' }, expire: { l: 'วันหมดอายุ', t: 'date' },
    deed: { l: 'เลขโฉนด / ทะเบียน' }, value: { l: 'มูลค่าประเมิน (บาท)', t: 'number' }, loan: { l: 'ยอดผ่อนคงเหลือ (บาท)', t: 'number' },
    role: { l: 'บทบาท / เกี่ยวข้องเรื่อง' }, phone: { l: 'เบอร์โทร' }, email: { l: 'อีเมล' },
    order: { l: 'ลำดับทายาท', t: 'number' }, docs: { l: 'เอกสารที่ต้องใช้', t: 'area', full: 1 },
    otp: { l: 'เบอร์ / อีเมลรับ OTP' }, cancel: { l: 'ต้องยกเลิก?', t: 'yn' }, text: { l: 'ข้อความ', t: 'area', full: 1 },
  };
  // kind: asset = นับเป็นทรัพย์สิน, debt = นับเป็นหนี้, '' = ไม่นับยอด
  const CATS = [
    { id: 'insurance', g: 'ทรัพย์สิน', ic: '🛡️', n: 'ประกันชีวิต', kind: 'asset', amt: 'sum', f: ['name', 'inst', 'no', 'sum', 'benef', 'claim', 'expire', 'contact', 'doc', 'where', 'note'] },
    { id: 'sso', g: 'ทรัพย์สิน', ic: '🏥', n: 'ประกันสังคม', kind: '', f: ['name', 'no', 'amount', 'as_of', 'benef', 'contact', 'doc', 'note'] },
    { id: 'pvd', g: 'ทรัพย์สิน', ic: '💼', n: 'กองทุนสำรองเลี้ยงชีพ / นายจ้าง', kind: 'asset', f: ['name', 'inst', 'no', 'amount', 'as_of', 'benef', 'contact', 'doc', 'note'] },
    { id: 'property', g: 'ทรัพย์สิน', ic: '🏠', n: 'บ้าน / ที่ดิน / คอนโด / รถ', kind: 'asset', amt: 'value', f: ['name', 'deed', 'value', 'loan', 'as_of', 'where', 'inst', 'doc', 'note'] },
    { id: 'debt', g: 'หนี้', ic: '💳', n: 'หนี้ (บัตร / สินเชื่อ / ผ่อน)', kind: 'debt', f: ['name', 'inst', 'no', 'amount', 'as_of', 'contact', 'doc', 'note'] },
    { id: 'heirs', g: 'ครอบครัว', ic: '👪', n: 'ทายาทตามกฎหมาย', kind: '', f: ['name', 'order', 'docs', 'note'] },
    { id: 'executor', g: 'ครอบครัว', ic: '⚖️', n: 'ผู้จัดการมรดก', kind: '', f: ['name', 'docs', 'contact', 'note'] },
    { id: 'contacts', g: 'ครอบครัว', ic: '📇', n: 'ผู้ติดต่อสำคัญ', kind: '', f: ['name', 'role', 'phone', 'email', 'note'] },
    { id: 'wishes', g: 'ครอบครัว', ic: '💌', n: 'ความประสงค์', kind: '', f: ['name', 'text'] },
    { id: 'docs', g: 'เอกสาร', ic: '📁', n: 'เอกสารส่วนตัว', kind: '', f: ['name', 'where', 'doc', 'note'] },
    { id: 'digital', g: 'เอกสาร', ic: '🌐', n: 'บัญชีดิจิทัล / ตัดอัตโนมัติ', kind: '', f: ['name', 'inst', 'otp', 'amount', 'cancel', 'note'] },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const DEFAULT_STEPS = [
    'ขอใบมรณบัตร (สำนักงานเขต / อำเภอ ภายใน 24 ชม.)',
    'แจ้งบริษัทประกันชีวิตทุกฉบับ เพื่อเคลมสินไหม (ดูหมวด ประกันชีวิต)',
    'แจ้งประกันสังคม ขอเงินค่าทำศพ / เงินสงเคราะห์กรณีตาย',
    'แจ้ง HR บริษัท เรื่องเงินเดือนค้าง / กองทุนสำรองเลี้ยงชีพ',
    'ยื่นคำร้องตั้งผู้จัดการมรดกที่ศาล (ถ้าไม่มีพินัยกรรม)',
    'แจ้งธนาคารทุกแห่ง อายัด / ปิดบัญชี (ดูข้อมูลเงินฝาก)',
    'ชำระ / แจ้งเจ้าหนี้ บัตรเครดิต สินเชื่อ (ดูหมวด หนี้)',
    'ยกเลิก subscription / รายการตัดอัตโนมัติ (ดูหมวด บัญชีดิจิทัล)',
    'ยื่นภาษีเงินได้ของปีที่เสียชีวิต (ใช้ 50 ทวิ)',
  ];

  // ---------- storage ----------
  function load() {
    let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    d = d || {}; d.items = d.items || {}; CATS.forEach(c => { d.items[c.id] = d.items[c.id] || []; });
    if (!d.steps) d.steps = DEFAULT_STEPS.map(t => ({ id: uid(), text: t, done: '' }));
    return d;
  }
  let D = load();
  function save() { D.updated_at = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(D)); }

  // ---------- totals ----------
  function catTotal(c) { return D.items[c.id].reduce((s, x) => s + num(x[c.amt || 'amount']), 0); }
  function totals() {
    let a = 0, b = 0;
    CATS.forEach(c => { if (c.kind === 'asset') a += catTotal(c); if (c.kind === 'debt') b += catTotal(c); });
    D.items.property.forEach(x => { b += num(x.loan); });   // ยอดผ่อนบ้าน/รถ = หนี้
    const s = window.LMSRC ? LMSRC.totals() : { a: 0, b: 0 };
    return { a: a + s.a, b: b + s.b, ma: a, mb: b, sa: s.a, sb: s.b };
  }
  const SRC = { cash: { ic: '🏦', n: 'เงินฝาก / กระเป๋าเงิน', from: 'CashMan' }, invest: { ic: '📈', n: 'การลงทุน', from: 'WealthMan' },
    lent: { ic: '🤝', n: 'เงินให้คนอื่นยืม', from: 'LoanMan' } };

  // ---------- nav ----------
  let cur = (location.hash || '#home').slice(1);
  function renderNav() {
    let h = '<div class="dl-sb-brand"><img src="assets/favicon-32.png" alt="" style="width:26px;height:26px;border-radius:6px;vertical-align:middle;margin-right:8px">LegacyMan</div><div class="sb-grp">ภาพรวม</div>' +
      `<a data-nav="home"><span class="ic">🏠</span><span>หน้าแรก</span></a>` +
      `<a data-nav="steps"><span class="ic">✅</span><span>ขั้นตอนที่ต้องทำ</span><span class="n">${D.steps.filter(s => s.done).length}/${D.steps.length}</span></a>` +
      '<div class="sb-grp">จากแอปอื่น (อ่านอย่างเดียว)</div>' +
      Object.keys(SRC).map(k => `<a data-nav="${k}"><span class="ic">${SRC[k].ic}</span><span>${SRC[k].n}</span><span class="n">${srcCount(k) || '⚪'}</span></a>`).join('');
    let g = '';
    CATS.forEach(c => { if (c.g !== g) { g = c.g; h += `<div class="sb-grp">${g}</div>`; }
      h += `<a data-nav="${c.id}"><span class="ic">${c.ic}</span><span>${c.n}</span><span class="n">${D.items[c.id].length || '⚪'}</span></a>`; });
    h += '<div class="sb-grp">ตั้งค่า</div><a data-nav="backup"><span class="ic">💾</span><span>สำรอง / นำเข้า</span></a>';
    $('nav').innerHTML = h;
    $('nav').querySelectorAll('a').forEach(a => { a.classList.toggle('active', a.dataset.nav === cur); a.onclick = () => go(a.dataset.nav); });
  }
  function go(v) { cur = v; location.hash = v; render(); window.scrollTo(0, 0); }
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== cur) { cur = v; render(); } });

  // ---------- views ----------
  function render() { renderNav(); const v = $('view');
    if (cur === 'home') v.innerHTML = vHome(); else if (cur === 'steps') v.innerHTML = vSteps();
    else if (SRC[cur]) v.innerHTML = vSrc(cur);
    else if (cur === 'backup') v.innerHTML = vBackup(); else if (CAT[cur]) v.innerHTML = vCat(CAT[cur]); else { cur = 'home'; v.innerHTML = vHome(); }
    bind(); }

  function vHome() {
    const t = totals(), done = D.steps.filter(s => s.done).length, next = D.steps.filter(s => !s.done).slice(0, 5);
    const sd = (window.LMSRC && LMSRC.data) || {}, sum = (l, f) => (l || []).reduce((s, x) => s + f(x), 0);
    const srcRows = [['cash', sum((sd.cashman || {}).acc, x => x.debt ? 0 : x.thb), 0], ['invest', sum((sd.wealthman || {}).list, x => x.thb), 0], ['lent', sum((sd.loanman || {}).list, x => x.bal), 0]]
      .map(([k, v]) => `<tr data-go="${k}" style="cursor:pointer"><td>${SRC[k].ic} ${SRC[k].n} <span class="tag">${SRC[k].from}</span></td><td></td><td class="r">${fmt(v)}</td></tr>`).join('');
    const srcDebt = sum((sd.cashman || {}).acc, x => x.debt ? Math.abs(x.thb) : 0) + sum((sd.cashman || {}).cards, x => Math.abs(x.bal));
    const rows = CATS.filter(c => c.kind).map(c => { const v = catTotal(c);
      return `<tr data-go="${c.id}" style="cursor:pointer"><td>${c.ic} ${c.n}</td><td class="r">${D.items[c.id].length}</td><td class="r" style="color:${c.kind === 'debt' ? 'var(--error)' : 'inherit'}">${fmt(v)}</td></tr>`; }).join('');
    const loan = D.items.property.reduce((s, x) => s + num(x.loan), 0);
    return `<div class="hd"><div><h1>ข้อมูลสำหรับครอบครัว</h1><p class="sub">กรอกเองล่าสุด ${D.updated_at ? dmy(D.updated_at.slice(0, 10)) : '-'} · ดึงจากแอปอื่นล่าสุด ${srcAt()}</p></div>
      <button class="btn secondary" id="srcReload">🔄 ดึงข้อมูลใหม่</button></div>${srcErr()}
    <div class="kpis"><div class="kpi pos"><div class="l">ทรัพย์สินรวม</div><div class="v">฿${fmt(t.a)}</div></div>
      <div class="kpi neg"><div class="l">หนี้รวม</div><div class="v">฿${fmt(t.b)}</div></div>
      <div class="kpi"><div class="l">สุทธิ</div><div class="v">฿${fmt(t.a - t.b)}</div></div>
      <div class="kpi"><div class="l">ขั้นตอนที่ทำแล้ว</div><div class="v">${done}/${D.steps.length}</div><div class="bar"><i style="width:${D.steps.length ? done / D.steps.length * 100 : 0}%"></i></div></div></div>
    ${vCover()}<div class="card"><div class="hd"><h3>✅ สิ่งที่ต้องทำก่อน</h3>
      <div class="steps">${next.map((s, i) => `<label><b>${i + 1}.</b> ${esc(s.text)}</label>`).join('') || '<div class="empty">ทำครบทุกขั้นตอนแล้ว</div>'}</div></div>
    <div class="card"><h3>💰 ยอดรวมแยกตามหมวด</h3><table><thead><tr><th>หมวด</th><th class="r">รายการ</th><th class="r">ยอด (บาท)</th></tr></thead>
      <tbody>${srcRows}${rows}${srcDebt ? `<tr data-go="cash" style="cursor:pointer"><td>💳 หนี้จาก CashMan (บัตร / สินเชื่อ) <span class="tag">CashMan</span></td><td></td><td class="r" style="color:var(--error)">${fmt(srcDebt)}</td></tr>` : ''}${loan ? `<tr data-go="property" style="cursor:pointer"><td>🏠 ยอดผ่อนบ้าน/รถคงเหลือ</td><td></td><td class="r" style="color:var(--error)">${fmt(loan)}</td></tr>` : ''}</tbody></table></div>`;
  }

  // ---------- read-only source views (Phase 2) ----------
  // Nov 23 2026: coverage overview — which sections have data (✅) and which are still empty (⚪)
  function srcCount(k) { const d = (window.LMSRC && LMSRC.data) || {};
    if (k === 'cash') { const c = d.cashman || {}; return (c.acc || []).length + (c.cards || []).length; }
    if (k === 'invest') return ((d.wealthman || {}).list || []).length; return ((d.loanman || {}).list || []).length; }
  function coverage() {
    const out = [{ id: 'steps', ic: '✅', n: 'ขั้นตอนที่ต้องทำ', g: 'ภาพรวม', cnt: D.steps.filter(s => s.done).length, txt: D.steps.filter(s => s.done).length + '/' + D.steps.length + ' ทำแล้ว' }];
    Object.keys(SRC).forEach(k => { const n = srcCount(k); out.push({ id: k, ic: SRC[k].ic, n: SRC[k].n, g: 'จากแอปอื่น', cnt: n, txt: n ? n + ' รายการ · ' + SRC[k].from : 'ยังไม่มีข้อมูล' }); });
    CATS.forEach(c => { const n = D.items[c.id].length; out.push({ id: c.id, ic: c.ic, n: c.n, g: c.g, cnt: n, txt: n ? n + ' รายการ' : 'ยังไม่ได้ใส่' }); });
    return out; }
  function vCover() { const L = coverage(), ok = L.filter(x => x.cnt > 0).length;
    return `<div class="card"><div class="hd"><h3>📋 ความครบถ้วนของข้อมูล</h3><span class="sub" style="margin:0">${ok}/${L.length} หมวดมีข้อมูลแล้ว</span></div>
      <div class="bar" style="margin-bottom:12px"><i style="width:${ok / L.length * 100}%"></i></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px">${L.map(x => `<div data-go="${x.id}" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--border-light);border-radius:8px;background:${x.cnt ? 'var(--surface)' : 'var(--surface2)'}">
        <span style="font-size:15px">${x.cnt ? '✅' : '⚪'}</span><span>${x.ic}</span><div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.n}</div>
        <div style="font-size:11px;color:${x.cnt ? 'var(--success)' : 'var(--muted)'}">${x.txt}</div></div></div>`).join('')}</div></div>`; }

  function srcAt() { if (!window.LMSRC || !LMSRC.at) return 'ยังไม่เคยดึง'; const d = new Date(LMSRC.at); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
  function srcErr(k) { const e = (window.LMSRC && LMSRC.err) || {}, ks = k ? [k] : Object.keys(e);
    const m = ks.filter(x => e[x]).map(x => `${x}: ${esc(e[x])}`); return m.length ? `<div class="card" style="border-color:var(--warning)">⚠️ ดึงข้อมูลไม่สำเร็จ — ${m.join(' · ')} (แสดงข้อมูลที่ดึงไว้ครั้งก่อน)</div>` : ''; }
  function vSrc(k) {
    const d = ((window.LMSRC && LMSRC.data) || {}), s = SRC[k], key = { cash: 'cashman', invest: 'wealthman', lent: 'loanman' }[k], src = d[key];
    const head = `<div class="hd"><div><h1>${s.ic} ${s.n}</h1><p class="sub">จาก ${s.from} · อ่านอย่างเดียว (แก้ในแอป ${s.from}) · ดึงล่าสุด ${src && src.at ? dmy(src.at.slice(0, 10)) : '-'}</p></div>
      <button class="btn secondary" id="srcReload">🔄 ดึงข้อมูลใหม่</button></div>${srcErr(key)}`;
    if (!src) return head + '<div class="card empty">ยังไม่มีข้อมูล — กด 🔄 ดึงข้อมูลใหม่</div>';
    const tbl = (cols, rows) => `<div class="card" style="padding:0;overflow-x:auto"><table><thead><tr>${cols.map(c => `<th${c[1] ? ' class="r"' : ''}>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${cols.length}" class="empty">ไม่มีรายการ</td></tr>`}</tbody></table></div>`;
    if (k === 'cash') {
      const a = src.acc.filter(x => !x.debt), dbt = src.acc.filter(x => x.debt);
      return head + '<h3>บัญชีเงินฝาก / e-Wallet</h3>' + tbl([['ชื่อบัญชี'], ['ธนาคาร'], ['เลขบัญชี'], ['ยอด', 1], ['สกุล'], ['ยอด (บาท)', 1], ['ณ วันที่']],
        a.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.inst)}</td><td>${esc(x.no)}</td><td class="r">${fmt(x.bal)}</td><td>${esc(x.cur)}</td><td class="r">${fmt(x.thb)}</td><td>${dmy(x.as_of)}</td></tr>`)) +
        '<h3>หนี้ (บัตรเครดิต / สินเชื่อ)</h3>' + tbl([['ชื่อ'], ['สถาบัน'], ['บิลค้าง', 1], ['ผ่อนคงเหลือ', 1], ['รวม (บาท)', 1], ['สถานะบิล'], ['ครบกำหนด'], ['ยอดจาก']],
        dbt.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.inst)}</td><td></td><td></td><td class="r">${fmt(Math.abs(x.thb))}</td><td></td><td></td><td>บัญชี loan</td></tr>`)
          .concat(src.cards.map(x => `<tr><td>💳 ${esc(x.name)}</td><td>${esc(x.inst)}</td><td class="r">${x.paid == null ? '' : fmt(x.stmt)}</td><td class="r">${x.instLeft ? fmt(x.instLeft) : ''}</td><td class="r"><b>${fmt(Math.abs(x.bal))}</b></td><td>${x.paid == null ? '' : x.paid ? '✅ จ่ายแล้ว' : (x.stmt > 0 ? '⏳ ยังไม่จ่าย' : '—')}</td><td>${dmy(x.deadline)}</td><td>${esc(x.src || '')}</td></tr>`)));
    }
    if (k === 'invest') return head + `<p class="sub">USD = ${fmt(src.usd)} บาท · ทองคำ / รายการที่ไม่มีราคาล่าสุด ใช้ต้นทุนแทน</p>` +
      tbl([['หลักทรัพย์'], ['ชนิด'], ['Asset Manager'], ['จำนวน', 1], ['ราคา', 1], ['ราคา ณ'], ['มูลค่า (บาท)', 1], ['คิดจาก']],
        src.list.slice().sort((a, b) => b.thb - a.thb).map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.cls)}</td><td>${esc(x.am)}</td><td class="r">${fmt(x.units)}</td><td class="r">${x.price ? fmt(x.price) + ' ' + esc(x.ccy) : ''}</td><td>${esc(x.price_date)}</td><td class="r">${fmt(x.thb)}</td><td>${x.how}</td></tr>`));
    return head + '<p class="sub">ยอดคงค้างเฉพาะเงินต้น (ไม่รวมดอกเบี้ย) — ดูรายละเอียดดอกเบี้ยใน LoanMan</p>' +
      tbl([['ผู้ยืม'], ['สัญญา'], ['เริ่ม'], ['เคลื่อนไหวล่าสุด'], ['ยอดต้นคงค้าง (บาท)', 1]],
        src.list.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.label)}</td><td>${dmy(x.start)}</td><td>${dmy(x.as_of)}</td><td class="r">${fmt(x.bal)}</td></tr>`));
  }

  function vSteps() {
    return `<div class="hd"><div><h1>ขั้นตอนที่ต้องทำ</h1><p class="sub">ติ๊กเมื่อทำเสร็จ · แก้ / เพิ่ม / ลบ ได้เอง</p></div>
      <div><button class="btn secondary" id="stReset">คืนค่าเริ่มต้น</button> <button class="btn" id="stAdd">+ เพิ่มขั้นตอน</button></div></div>
    <div class="card steps">${D.steps.map((s, i) => `<label><input type="checkbox" data-st="${s.id}" ${s.done ? 'checked' : ''}>
      <span class="${s.done ? 'done' : ''}"><b>${i + 1}.</b> ${esc(s.text)}</span>
      <span class="ts">${s.done ? 'ทำแล้ว ' + dmy(s.done) : ''}</span>
      <button class="btn secondary sm" data-ste="${s.id}">✏️</button><button class="btn secondary sm" data-std="${s.id}">🗑️</button></label>`).join('') || '<div class="empty">ยังไม่มีขั้นตอน</div>'}</div>`;
  }

  function cell(c, x, k) { const f = F[k], v = x[k];
    if (v == null || v === '') return '';
    if (f.t === 'number') return fmt(v); if (f.t === 'date') return dmy(v);
    if (f.t === 'url') return `<a class="lk" href="${esc(v)}" target="_blank" rel="noopener">เปิด ↗</a>`;
    if (f.t === 'yn') return v === 'Y' ? '<span class="tag">ต้องยกเลิก</span>' : '';
    return esc(v).replace(/\n/g, '<br>'); }
  function vCat(c) {
    const list = D.items[c.id], cols = c.f.filter(k => !['note', 'doc', 'where', 'text', 'docs'].includes(k)).slice(0, 6);
    const extra = c.f.filter(k => ['doc', 'where', 'note', 'text', 'docs'].includes(k));
    const tot = c.kind ? `<p class="sub">รวม ${list.length} รายการ · ยอด ฿${fmt(catTotal(c))}</p>` : `<p class="sub">${list.length} รายการ</p>`;
    return `<div class="hd"><div><h1>${c.ic} ${c.n}</h1>${tot}</div><button class="btn" id="itAdd">+ เพิ่มรายการ</button></div>
    <div class="card" style="padding:0;overflow-x:auto">${list.length ? `<table><thead><tr>${cols.map(k => `<th${F[k].t === 'number' ? ' class="r"' : ''}>${F[k].l}</th>`).join('')}${extra.length ? '<th>รายละเอียด</th>' : ''}<th></th></tr></thead><tbody>` +
      list.map(x => `<tr>${cols.map(k => `<td${F[k].t === 'number' ? ' class="r"' : ''}>${cell(c, x, k)}</td>`).join('')}` +
        (extra.length ? `<td>${extra.map(k => { const v = cell(c, x, k); return v ? `<div><span style="color:var(--muted)">${F[k].l}:</span> ${v}</div>` : ''; }).join('')}</td>` : '') +
        `<td style="white-space:nowrap"><button class="btn secondary sm" data-ie="${x.id}">✏️</button> <button class="btn secondary sm" data-id="${x.id}">🗑️</button></td></tr>`).join('') +
      '</tbody></table>' : '<div class="empty">ยังไม่มีรายการ — กด + เพิ่มรายการ</div>'}</div>`;
  }

  function vBackup() {
    return `<h1>💾 สำรอง / นำเข้า</h1><p class="sub">ตอนนี้ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น (เฟส 3 จะเข้ารหัสแล้วเก็บใน Sheet) — สำรองไฟล์ไว้เป็นระยะ</p>
    <div class="card"><button class="btn" id="bkExp">⬇️ ดาวน์โหลดไฟล์สำรอง (.json)</button> <button class="btn secondary" id="bkImp">⬆️ นำเข้าไฟล์สำรอง</button>
      <input type="file" id="bkFile" accept=".json" style="display:none"></div>`;
  }

  // ---------- popup form (same card format as ui-confirm) ----------
  function form(title, fields, val, onSave) {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="box"><h3>${esc(title)}</h3><div class="fg">${fields.map(k => { const f = F[k] || { l: k }, v = val[k] == null ? '' : val[k];
      const inp = f.t === 'area' ? `<textarea data-k="${k}">${esc(v)}</textarea>` :
        f.t === 'yn' ? `<select data-k="${k}"><option value=""></option><option value="Y" ${v === 'Y' ? 'selected' : ''}>ต้องยกเลิก</option><option value="N" ${v === 'N' ? 'selected' : ''}>ไม่ต้อง</option></select>` :
        `<input data-k="${k}" type="${f.t === 'number' ? 'text' : f.t === 'date' ? 'date' : f.t === 'url' ? 'url' : 'text'}" ${f.t === 'number' ? 'inputmode="decimal"' : ''} value="${esc(v)}">`;
      return `<div class="${f.full || f.t === 'area' ? 'full' : ''}"><label>${f.l}</label>${inp}</div>`; }).join('')}</div>
      <div class="foot"><button class="btn secondary" data-x="no">Cancel</button><button class="btn" data-x="ok">✓ Save</button></div></div>`;
    document.body.appendChild(ov);
    let down = null; ov.onmousedown = e => { down = e.target; }; ov.onmouseup = e => { if (down === ov && e.target === ov) close(); down = null; };
    function close() { ov.remove(); document.removeEventListener('keydown', key, true); }
    function ok() { const o = {}; ov.querySelectorAll('[data-k]').forEach(i => { o[i.dataset.k] = i.value.trim(); });
      if (fields.includes('name') && !o.name) { toast('ใส่ชื่อรายการก่อน'); return; } close(); onSave(o); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); ok(); } }
    document.addEventListener('keydown', key, true);
    ov.querySelector('[data-x=no]').onclick = close; ov.querySelector('[data-x=ok]').onclick = ok;
    setTimeout(() => { const f = ov.querySelector('[data-k]'); f && f.focus(); }, 20);
  }

  // ---------- events ----------
  function bind() {
    const v = $('view');
    if ($('srcReload')) $('srcReload').onclick = async () => { const b = $('srcReload'); b.disabled = true; b.textContent = '⏳ กำลังดึง…';
      await LMSRC.load(true); render(); toast(Object.keys(LMSRC.err).length ? 'ดึงได้บางส่วน' : 'ดึงข้อมูลแล้ว'); };
    v.querySelectorAll('[data-go]').forEach(e => e.onclick = () => go(e.dataset.go));
    const c = CAT[cur];
    if (c) {
      $('itAdd').onclick = () => form('เพิ่ม — ' + c.n, c.f, { as_of: today() }, o => { o.id = uid(); D.items[c.id].push(o); save(); render(); toast('เพิ่มแล้ว'); });
      v.querySelectorAll('[data-ie]').forEach(b => b.onclick = () => { const x = D.items[c.id].find(i => i.id === b.dataset.ie);
        form('แก้ไข — ' + c.n, c.f, x, o => { Object.assign(x, o); save(); render(); toast('บันทึกแล้ว'); }); });
      v.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => { const x = D.items[c.id].find(i => i.id === b.dataset.id);
        if (!(await wmConfirm('ลบ "' + (x.name || '') + '" ?'))) return; D.items[c.id] = D.items[c.id].filter(i => i !== x); save(); render(); toast('ลบแล้ว'); });
    }
    if (cur === 'steps') {
      v.querySelectorAll('[data-st]').forEach(cb => cb.onchange = () => { const s = D.steps.find(i => i.id === cb.dataset.st); s.done = cb.checked ? today() : ''; save(); render(); });
      v.querySelectorAll('[data-ste]').forEach(b => b.onclick = e => { e.preventDefault(); const s = D.steps.find(i => i.id === b.dataset.ste);
        form('แก้ไขขั้นตอน', ['text'], s, o => { s.text = o.text || s.text; save(); render(); }); });
      v.querySelectorAll('[data-std]').forEach(b => b.onclick = async e => { e.preventDefault();
        if (!(await wmConfirm('ลบขั้นตอนนี้?'))) return; D.steps = D.steps.filter(i => i.id !== b.dataset.std); save(); render(); });
      $('stAdd').onclick = () => form('เพิ่มขั้นตอน', ['text'], {}, o => { if (o.text) { D.steps.push({ id: uid(), text: o.text, done: '' }); save(); render(); } });
      $('stReset').onclick = async () => { if (!(await wmConfirm('คืนค่าเริ่มต้น (ขั้นตอนที่แก้เองจะหายหมด)?'))) return;
        D.steps = DEFAULT_STEPS.map(t => ({ id: uid(), text: t, done: '' })); save(); render(); };
    }
    if (cur === 'backup') {
      $('bkExp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' }));
        a.download = 'LegacyMan_backup_' + today() + '.json'; a.click(); };
      $('bkImp').onclick = () => $('bkFile').click();
      $('bkFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; let j; try { j = JSON.parse(await f.text()); } catch (x) { alert('ไฟล์ไม่ถูกต้อง'); return; }
        if (!j || !j.items) { alert('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ LegacyMan'); return; }
        if (!(await wmConfirm('นำเข้าแล้วข้อมูลในเครื่องนี้จะถูกแทนที่ทั้งหมด ดำเนินต่อ?', { danger: true, ok: '⬆️ นำเข้า' }))) return;
        localStorage.setItem(KEY, JSON.stringify(j)); D = load(); render(); toast('นำเข้าแล้ว'); };
    }
  }

  render();
  // Nov 23 2026: always pull fresh on open/refresh + status chip (bottom-right, same as WealthMan)
  function chip(t, bad) { let c = $('lm-chip'); if (!c) { c = document.createElement('div'); c.id = 'lm-chip';
      c.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9999;font-size:11px;padding:3px 10px;border-radius:999px;background:var(--surface);border:1px solid #ccc;box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer';
      c.title = 'คลิก = ดึงข้อมูลใหม่'; c.onclick = pull; document.body.appendChild(c); }
    c.textContent = t; c.style.color = bad ? '#dc2626' : (t.indexOf('⏳') === 0 ? '#92400e' : '#16a34a'); }
  function pull() { if (!window.LMSRC || !window.LM_SOURCES) { chip('⚠ ไม่พบ config-sources.js', 1); return; }
    chip('⏳ กำลังดึงข้อมูล…');
    LMSRC.load(true).then(() => { render(); const e = Object.keys(LMSRC.err); const t = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      chip(e.length ? '⚠ ดึงไม่ได้: ' + e.join(', ') : '✓ อัปเดตแล้ว ' + t, e.length); }).catch(x => chip('⚠ ' + x.message, 1)); }
  pull();
})();
