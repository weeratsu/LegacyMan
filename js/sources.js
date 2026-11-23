/* LegacyMan sources.js — Phase 2 (Nov 23 2026): READ-ONLY pull from CashMan / WealthMan / LoanMan Sheets.
 * Never writes to those Sheets. Result cached in localStorage 'lm_src' (so the page works offline).
 * Needs js/config-sources.js (gitignored). Exposes window.LMSRC = { load(force), data, at, err }.
 */
(function () {
  const CK = 'lm_src', cfg = window.LM_SOURCES || {};
  const n = v => { const x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(x) ? 0 : x; };
  const S = window.LMSRC = { data: null, at: null, err: {} };
  try { const c = JSON.parse(localStorage.getItem(CK) || 'null'); if (c) { S.data = c.data; S.at = c.at; } } catch (e) {}

  async function getJSON(url, opt) { const r = await fetch(url, opt); const j = await r.json(); if (!j || j.ok === false) throw new Error((j && j.error) || 'API error'); return j; }

  // ---- CashMan: accounts (type 'loan' = debt) + credit cards ----
  async function cashman() {
    const c = cfg.cashman; if (!c || !c.endpoint) throw new Error('ไม่ได้ตั้งค่า');
    const j = await getJSON(c.endpoint + '?token=' + encodeURIComponent(c.token)); const D = j.data || {};
    const fx = {}; (D.fx_log || []).slice().sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1).forEach(r => { fx[r.cur] = n(r.rate); });
    const bk = {}; (D.banks || []).forEach(b => { bk[b.id] = b.name || b.id; }); const bn = id => bk[id] || id || '';
    const acc = (D.accounts || []).filter(a => !a.deleted && !a.closed).map(a => { const cur = a.currency || 'THB', rate = cur === 'THB' ? 1 : (fx[cur] || 0);
      return { name: a.name, inst: bn(a.bank), no: a.acct_no || '', cur, bal: n(a.balance), thb: n(a.balance) * rate, as_of: a.balance_date || '', debt: a.type === 'loan', type: a.type || '' }; });
    // Nov 23 2026: card owed = D.card_due snapshot written by CashMan Card Bills (Effective, 0 when PAID). Fallback = Setup current_balance.
    const cd = (D.card_due && D.card_due.cards) || {}, cdAt = (D.card_due && D.card_due.at) || '';
    const cards = (D.cards || []).filter(x => !x.deleted).map(x => { const s = cd[x.name];
      return { name: x.name, inst: bn(x.bank), bal: s ? n(s.due) + n(s.inst) : n(x.current_balance), stmt: s ? n(s.due) : 0, instLeft: s ? n(s.inst) : 0, limit: n(x.credit_limit), as_of: s ? cdAt : '',
        paid: s ? !!s.paid : null, deadline: s ? s.deadline || '' : '', src: s ? 'Card Bills' : 'Setup (อาจไม่อัปเดต)' }; });
    return { acc, cards };
  }
  // ---- WealthMan: holdings from Trades (units) x Securities (price) ----
  async function wealthman() {
    const c = cfg.wealthman; if (!c || !c.endpoint) throw new Error('ไม่ได้ตั้งค่า');
    const j = await getJSON(c.endpoint, { method: 'POST', body: JSON.stringify({ token: c.token, action: 'get' }) }); const D = j.data || {};
    const fxs = (D.FX || []).filter(r => n(r.rate) > 0).sort((a, b) => String(a.date) < String(b.date) ? -1 : 1), usd = fxs.length ? n(fxs[fxs.length - 1].rate) : 0;
    const px = {}; (D.Securities || []).forEach(s => { px[s.security] = s; });
    const OUT = /^(SELL|RED|SWO|SWITCH.?OUT)/i, h = {};
    (D.Trades || []).filter(t => t.deleted !== 'Y' && t.security).forEach(t => {
      const k = t.security, o = h[k] || (h[k] = { name: k, cls: t.asset_class || '', am: t.asset_manager || t.am_id || '', ccy: t.ccy || 'THB', units: 0, cost: 0 });
      const sgn = OUT.test(t.type || '') ? -1 : 1, u = n(t.units); o.units += sgn * u;
      const thb = n(t.total_thb) || (n(t.total_usd) * (n(t.fx_thb_usd) || usd)); o.cost += sgn * thb; });
    const list = Object.values(h).filter(o => o.units > 1e-6).map(o => { const p = px[o.name], price = p ? n(p.price) : 0;
      let val = price ? o.units * price * (o.ccy === 'USD' ? usd : 1) : 0, how = 'ราคาล่าสุด';
      if (!val || /gold/i.test(o.cls)) { val = Math.max(o.cost, 0); how = 'ต้นทุน'; }   // ทอง / ไม่มีราคา = ใช้ต้นทุน
      return Object.assign(o, { price, price_date: p ? p.price_date || '' : '', thb: val, how }); });
    return { list, usd };
  }
  // ---- LoanMan: money lent out (principal only, no interest) ----
  async function loanman() {
    const c = cfg.loanman; if (!c || !c.endpoint) throw new Error('ไม่ได้ตั้งค่า');
    const j = await getJSON(c.endpoint + '?token=' + encodeURIComponent(c.token)); const D = j.data || {};
    const ppl = {}; (D.people || []).forEach(p => { ppl[p.id] = p.name; });
    const list = (D.debtors || []).filter(d => d.status !== 'closed').map(d => { let bal = n(d.openP), last = d.start || '';
      (D.txns || []).filter(t => t.did === d.id).forEach(t => { bal += t.type === 'borrow' ? n(t.amt) : -n(t.amt); if ((t.date || '') > last) last = t.date; });
      return { name: ppl[d.pid] || d.name || '-', label: d.name || '', bal: Math.max(bal, 0), as_of: last, start: d.start || '' }; }).filter(x => x.bal > 0.005);
    return { list };
  }

  S.load = async function (force) {
    if (!force && S.data && S.at && (Date.now() - new Date(S.at)) < 10 * 60 * 1000) return S;
    const d = Object.assign({}, S.data || {}); S.err = {};
    await Promise.all([['cashman', cashman], ['wealthman', wealthman], ['loanman', loanman]].map(async ([k, fn]) => {
      try { d[k] = await fn(); d[k].at = new Date().toISOString(); } catch (e) { S.err[k] = String(e.message || e); } }));
    S.data = d; S.at = new Date().toISOString();
    try { localStorage.setItem(CK, JSON.stringify({ data: d, at: S.at })); } catch (e) {}
    return S;
  };
  S.totals = function () { const d = S.data || {}; let a = 0, b = 0;
    ((d.cashman || {}).acc || []).forEach(x => { if (x.debt) b += Math.abs(x.thb); else a += x.thb; });
    ((d.cashman || {}).cards || []).forEach(x => { b += Math.abs(x.bal); });
    ((d.wealthman || {}).list || []).forEach(x => { a += x.thb; });
    ((d.loanman || {}).list || []).forEach(x => { a += x.bal; });
    return { a, b }; };
})();
