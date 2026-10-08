
const $ = s => document.querySelector(s), dlg = $('#dlg');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const uid = () => Math.random().toString(36).slice(2, 9), CUR = ['USD', 'NGN', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD', 'INR'];
const toC = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0 };
const dt = v => new Date(v + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function seed() {
  const D = n => iso(Date.now() - n * 864e5), all = ['a', 'b', 'c'];
  return {
    active: 'g1', groups: [{
      id: 'g1', name: 'Weekend getaway', cur: 'USD', budget: 90000, people: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Chloe' }], exp: [
        { id: 'e1', desc: 'Cabin rental', amt: 42000, by: 'a', date: D(3), mode: 'equal', who: all },
        { id: 'e2', desc: 'Groceries', amt: 8650, by: 'b', date: D(2), mode: 'equal', who: all },
        { id: 'e3', desc: 'Dinner out', amt: 13475, by: 'c', date: D(2), mode: 'pct', vals: { a: 40, b: 30, c: 30 } },
        { id: 'e4', desc: 'Fuel', amt: 6000, by: 'a', date: D(1), mode: 'exact', vals: { a: 2000, b: 2000, c: 2000 } }]
    }]
  }
}
let S; try { S = JSON.parse(localStorage.getItem('splitly.v1')) } catch (e) { }
if (!S || !Array.isArray(S.groups)) S = seed();
S.groups.forEach(g => g.exp.forEach(e => { if (!e.cat && !e.pay) e.cat = guess(e.desc) }));
if (S.theme) document.documentElement.dataset.theme = S.theme;
recur();
let tab = 'exp', X = null, qs = '', fc = 'all', sort = 'new', open = new Set();
const save = () => { try { localStorage.setItem('splitly.v1', JSON.stringify(S)) } catch (e) { } };
const G = () => S.groups.find(g => g.id === S.active) || S.groups[0];
const money = c => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: G().cur }).format(c / 100) } catch (e) { return (c / 100).toFixed(2) } };
const nm = id => (G().people.find(p => p.id == id) || { name: 'Former member' }).name;
function toast(m, fn) { const t = $('#toast'); t.innerHTML = esc(m) + (fn ? '<button class="tu" id="tu">Undo</button>' : ''); if (fn) $('#tu').onclick = () => { fn(); try { t.hidePopover() } catch (e) { } }; try { if (!t.matches(':popover-open')) t.showPopover() } catch (e) { } clearTimeout(toast.h); toast.h = setTimeout(() => { try { t.hidePopover() } catch (e) { } }, fn ? 5000 : 2200) }

/* money logic, all in integer cents */
function shares(e) {
  const out = {}, a = e.amt;
  if (e.mode == 'equal') { const w = e.who, b = Math.floor(a / w.length), r = a - b * w.length; w.forEach((id, i) => out[id] = b + (i < r ? 1 : 0)) }
  else if (e.mode == 'exact') { for (const id in e.vals) out[id] = e.vals[id] }
  else { const ids = Object.keys(e.vals).filter(id => e.vals[id] > 0), sm = ids.reduce((s, id) => s + e.vals[id], 0); let t = 0; ids.forEach(id => { out[id] = Math.floor(a * e.vals[id] / sm); t += out[id] }); for (let i = 0; t < a; i++, t++)out[ids[i % ids.length]]++ }
  return out
}
function net(g) {
  const n = {}; g.people.forEach(p => n[p.id] = 0);
  g.exp.forEach(e => { if (e.pay) { n[e.from] += e.amt; n[e.to] -= e.amt } else { n[e.by] += e.amt; const s = shares(e); for (const id in s) n[id] -= s[id] } }); return n
}
function settle(n) {
  const d = [], c = []; for (const id in n) { if (n[id] < 0) d.push([id, -n[id]]); else if (n[id] > 0) c.push([id, n[id]]) }
  d.sort((a, b) => b[1] - a[1]); c.sort((a, b) => b[1] - a[1]); const o = []; let i = 0, j = 0;
  while (i < d.length && j < c.length) { const m = Math.min(d[i][1], c[j][1]); o.push({ from: d[i][0], to: c[j][0], amt: m }); d[i][1] -= m; c[j][1] -= m; if (!d[i][1]) i++; if (!c[j][1]) j++ } return o
}
const involved = (g, id) => g.exp.some(e => e.pay ? e.from == id || e.to == id : e.by == id || (e.who || []).includes(id) || (e.vals && id in e.vals));

/* rendering */
const av = (p, i) => `<i class="av" style="--h:${HUE(i)}">${esc(p.name.trim().charAt(0).toUpperCase())}</i>`;
function render() {
  const g = G();
  $('#gctl').innerHTML = (S.groups.length ? `<select id="gs" aria-label="Group">${S.groups.map(x => `<option value="${x.id}" ${x === g ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="btn" data-a="editG">Edit</button>` : '') + `<button class="btn pri" data-a="newG">New group</button><button class="btn" data-a="pal" aria-label="Command palette" title="Command palette (Ctrl+K)">&#8984;</button><button class="btn" data-a="theme" aria-label="Toggle theme" title="Toggle theme">&#9680;</button>`;
  if (!g) { $('#app').innerHTML = `<div class="empty"><h1>No groups yet</h1><p>Create a group for a trip, a house or a night out, then add what everyone spends.</p><button class="btn pri" data-a="newG">Create a group</button></div>`; return }
  const n = net(g), tot = g.exp.reduce((s, e) => s + (e.pay ? 0 : e.amt), 0), owed = Object.values(n).filter(v => v > 0).reduce((a, b) => a + b, 0);
  $('#app').innerHTML = `<div class="grid"><aside class="panel"><h2>People</h2><ul class="ppl">${g.people.map((p, i) => `<li>${av(p, i)}<button class="pn" data-a="person" data-id="${p.id}">${esc(p.name)}</button><button class="x" data-a="rmP" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">&times;</button></li>`).join('') || '<li class="ok">Nobody yet</li>'}</ul><div class="addp"><input id="pn" maxlength="30" placeholder="Add a person" aria-label="Person name"><button class="btn" data-a="addP">Add</button></div><div class="sl"><button class="link" data-a="backup">Backup</button><button class="link" data-a="csv">Copy CSV</button></div></aside>
 <section><div class="tiles"><div class="tile"><span>Total spent</span><b data-k="t" data-n="${tot}">${money(tot)}</b></div><div class="tile"><span>Per person</span><b data-k="p" data-n="${g.people.length ? Math.round(tot / g.people.length) : 0}">${money(g.people.length ? Math.round(tot / g.people.length) : 0)}</b></div><div class="tile"><span>Still to settle</span><b data-k="o" data-n="${owed}">${money(owed)}</b></div></div>
 ${budget(g, tot)}<div class="quick"><input id="qa" placeholder="Quick add: Dinner 45.50 by Ben" aria-label="Quick add an expense" autocomplete="off"><button class="btn pri" data-a="qadd">Add</button></div><div class="tabs"><button class="tab ${tab == 'exp' ? 'on' : ''}" data-a="tab" data-t="exp">Expenses</button><button class="tab ${tab == 'bal' ? 'on' : ''}" data-a="tab" data-t="bal">Balances</button><button class="tab ${tab == 'ins' ? 'on' : ''}" data-a="tab" data-t="ins">Insights</button><button class="btn pri" data-a="addE">Add expense</button></div>
 <div class="panel">${tab == 'exp' ? expList(g) : tab == 'bal' ? balView(g, n) : insView(g)}</div></section></div>`; count()
}
const chip = (k, l) => `<button class="chip ${fc == k ? 'on' : ''}" data-a="fc" data-k="${k}">${l}</button>`;
function expList(g) { return `<div class="tb"><input id="qs" type="search" placeholder="Search expenses" value="${esc(qs)}" aria-label="Search expenses"><select id="so" aria-label="Sort expenses">${[['new', 'Newest'], ['old', 'Oldest'], ['big', 'Largest']].map(o => `<option value="${o[0]}" ${sort == o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><div class="chips">${chip('all', 'All')}${CATS.map(c => chip(c[0], c[1] + ' ' + c[2])).join('')}</div></div><div id="xl">${xl(g)}</div>` }
function xl(g) {
  if (!g.exp.length) return '<div class="ok">No expenses yet. Add the first one.</div>';
  const m = e => e.pay ? fc == 'all' && (!qs || (nm(e.from) + ' ' + nm(e.to) + ' payment').toLowerCase().includes(qs)) : (fc == 'all' || (e.cat || 'other') == fc) && (!qs || (e.desc + ' ' + nm(e.by)).toLowerCase().includes(qs));
  const L = [...g.exp].reverse().sort(sort == 'big' ? (a, b) => b.amt - a.amt : sort == 'old' ? (a, b) => a.date.localeCompare(b.date) : (a, b) => b.date.localeCompare(a.date)).filter(m); if (!L.length) return '<div class="ok">Nothing matches your filters.</div>';
  return L.map((e, i) => e.pay ?
    `<div class="row pay" style="--i:${Math.min(i, 8)}"><div><div class="t">${esc(nm(e.from))} paid ${esc(nm(e.to))}</div><div class="m">Payment, ${dt(e.date)}</div></div><div class="a">${money(e.amt)}</div><div class="ac"><button class="link" data-a="delE" data-id="${e.id}">Delete</button></div></div>` :
    `<div class="row" style="--i:${Math.min(i, 8)}"><div><div class="t" data-a="tog" data-id="${e.id}" role="button" tabindex="0" aria-expanded="${open.has(e.id)}"><i class="cb" style="background:color-mix(in srgb,var(--c-${e.cat || 'other'}) 22%,transparent)">${catEm(e.cat)}</i>${esc(e.desc)}</div><div class="m">${esc(nm(e.by))} paid, ${dt(e.date)}. ${e.mode == 'equal' ? 'Split equally between ' + e.who.length : e.mode == 'exact' ? 'Custom amounts' : e.mode == 'shr' ? 'Split by shares' : 'Split by percentage'}</div></div><div class="a">${money(e.amt)}</div>${open.has(e.id) ? bd(e) : ''}<div class="ac"><button class="link" data-a="editE" data-id="${e.id}">Edit</button><button class="link" data-a="delE" data-id="${e.id}">Delete</button></div></div>`).join('')
}
function balView(g, n) {
  const mx = Math.max(1, ...Object.values(n).map(Math.abs)), st = settle(n);
  return `<h2>Who owes what</h2>${g.people.map((p, i) => { const v = n[p.id]; return `<div class="bal">${av(p, i)}<div><button class="pn" data-a="person" data-id="${p.id}">${esc(p.name)}</button><div class="bar"><i style="width:${Math.round(Math.abs(v) / mx * 100)}%;background:var(--${v < 0 ? 'neg' : 'pos'})"></i></div></div><b class="${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v == 0 ? 'Settled' : (v > 0 ? 'gets back ' : 'owes ') + money(Math.abs(v))}</b></div>` }).join('') || '<div class="ok">Add people to see balances.</div>'}
 <h2 style="margin-top:22px">Settle up</h2>${st.length ? graph(g, st) : ''}${st.length ? st.map(s => `<div class="set"><span><b>${esc(nm(s.from))}</b> pays <b>${esc(nm(s.to))}</b> <b>${money(s.amt)}</b></span><span class="rb"><button class="btn sm" data-a="remind" data-f="${s.from}" data-t="${s.to}" data-m="${s.amt}">Remind</button><button class="btn sm" data-a="pay" data-f="${s.from}" data-t="${s.to}" data-m="${s.amt}">Record payment</button></span></div>`).join('') : '<div class="ok">Everyone is settled up.</div>'}
 <div class="acts">${st.length ? '<button class="btn" data-a="settleAll">Record all payments</button>' : ''}<button class="btn" data-a="copy">Copy summary</button></div>`
}

/* charts, motion and helpers */
const CATS = [['food', '\u{1F37D}\uFE0F', 'Food'], ['stay', '\u{1F3E0}', 'Stay'], ['travel', '\u{1F697}', 'Travel'], ['fun', '\u{1F39F}\uFE0F', 'Fun'], ['other', '\u{1F9FE}', 'Other']];
const catEm = k => (CATS.find(c => c[0] == k) || CATS[4])[1];
function guess(s) { s = (s || '').toLowerCase(); return /dinner|lunch|food|grocer|cafe|coffee|drink|pizza|meal|snack|breakfast|restaurant/.test(s) ? 'food' : /cabin|hotel|rent|stay|airbnb|hostel|room/.test(s) ? 'stay' : /fuel|gas|taxi|uber|flight|train|bus|toll|parking|car /.test(s) ? 'travel' : /ticket|movie|party|show|concert|game|club|tour/.test(s) ? 'fun' : 'other' }
const HUE = i => [42, 22, 165, 205, 340, 68, 285, 6][i % 8];
const esr = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function clip(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(msg), () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy') } catch (e) { } a.remove(); toast(ok ? msg : 'Copy is blocked in this view') }) }
function budget(g, tot) {
  if (!g.budget) return ''; const p = tot / g.budget, c = p >= 1 ? 'var(--neg)' : p >= .75 ? '#e8a33d' : 'var(--ac)';
  return `<div class="panel budget"><p><span><b>${Math.round(p * 100)}%</b> of the ${money(g.budget)} budget used</span><span>${p >= 1 ? money(tot - g.budget) + ' over' : money(g.budget - tot) + ' left'}</span></p><div class="bar"><i style="width:${Math.min(100, p * 100)}%;background:${c}"></i></div></div>`
}
function trend(ex) {
  const m = {}; ex.forEach(e => m[e.date] = (m[e.date] || 0) + e.amt); let c = 0; const pts = Object.keys(m).sort().map(d => { c += m[d]; return { d, v: c, day: m[d] } }), n = pts.length, W = 300, H = 100;
  const X = i => n == 1 ? W / 2 : 10 + i * (W - 20) / (n - 1), Y = v => H - 8 - v / (c || 1) * (H - 24), line = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join('');
  return `<svg viewBox="0 0 300 ${H + 8}" class="chart" role="img" aria-label="Running total over time">${n > 1 ? `<path class="ar" d="${line}L${X(n - 1)} ${H - 8}L${X(0)} ${H - 8}Z"/>` : ''}<path class="ln" pathLength="1" d="${line}"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4.5" fill="var(--ac)" stroke="var(--sf)" stroke-width="2" data-tp="${dt(p.d)}: ${money(p.day)} spent, ${money(p.v)} total so far"/>`).join('')}</svg><p class="fact" id="cap">Hover or tap a point for details.</p>`
}
function quick(s) {
  const g = G(); if (g.people.length < 2) { toast('Add at least two people first'); return false }
  const m = s.match(/\d+(?:[.,]\d{1,2})?/); if (!m) { toast('Include an amount, like Dinner 45.50 by Ben'); return false }
  const amt = toC(m[0].replace(',', '.')); if (!amt) { toast('The amount must be above zero'); return false }
  let rest = s.replace(m[0], ' ').replace(/[$â‚¬Â£â‚¦]/g, ' '), by = g.people[0]; const hit = g.people.find(p => new RegExp('\\b' + esr(p.name) + '\\b', 'i').test(rest));
  if (hit) { by = hit; rest = rest.replace(new RegExp('\\b(paid\\s+by|by|from)?\\s*' + esr(hit.name) + '\\b', 'i'), ' ') }
  const d = rest.replace(/\s+/g, ' ').trim() || 'Expense', e = { id: uid(), desc: d.charAt(0).toUpperCase() + d.slice(1), amt, by: by.id, date: iso(Date.now()), mode: 'equal', cat: guess(d), who: g.people.map(p => p.id) };
  g.exp.push(e); save(); render(); toast(`Added ${e.desc}, split equally`, () => { g.exp = g.exp.filter(x => x.id != e.id); save(); render() })
}
document.addEventListener('keydown', e => { if (e.key == 'Enter' && e.target.id == 'qa' && quick(e.target.value) !== false) e.target.value = '' });
const tipH = e => { const t = e.target.closest && e.target.closest('[data-tp]'), c = $('#cap'); if (t && c) c.textContent = t.dataset.tp };
document.addEventListener('mouseover', tipH); document.addEventListener('click', tipH);
dlg.addEventListener('click', e => {
  const t = e.target.closest('[data-tip]'); if (!t || !X) return; const a = toC(X.amt); if (!a) { toast('Enter the amount first'); return }
  const b = X.base || (X.base = a); X.amt = (b * (1 + +t.dataset.tip / 100) / 100).toFixed(2); $('#xa').value = X.amt; hint()
});
function nextM(d) { const x = new Date(d + 'T00:00'); x.setMonth(x.getMonth() + 1); return iso(x) }
function recur() { const td = iso(Date.now()); S.groups.forEach(g => g.exp.slice().forEach(e => { if (!e.rec) return; let c = 0; while (e.nx <= td && c++ < 24) { g.exp.push({ ...e, id: uid(), date: e.nx, rec: 0, nx: undefined }); e.nx = nextM(e.nx) } })) }
const bd = e => { const s = shares(e); return `<div class="bd">${Object.keys(s).map(id => `<span class="pill"><b>${esc(nm(id))}</b> ${money(s[id])}</span>`).join('')}${e.rec ? '<span class="pill">Repeats monthly</span>' : ''}</div>` };
let P = [];
const pl = q => { const L = P.filter(i => i.l.toLowerCase().includes(q.toLowerCase())).slice(0, 8); $('#pl').innerHTML = L.map(i => `<button class="pi" data-pi="${P.indexOf(i)}">${esc(i.l)}</button>`).join('') || '<p class="ln">No matches.</p>' };
const runP = i => { const it = P[i]; if (!it) return; dlg.close(); A[it.a]({ t: it.t, id: it.id }) };
function palette() {
  const g = G(); P = [['Add expense', 'addE'], ['New group', 'newG'], ['Show expenses', 'tab', 'exp'], ['Show balances', 'tab', 'bal'], ['Show insights', 'tab', 'ins'], ['Toggle theme', 'theme'], ['Backup and restore', 'backup'], ['Copy CSV', 'csv'], ['Copy summary', 'copy']].map(([l, a, t]) => ({ l, a, t }))
    .concat(S.groups.map(x => ({ l: 'Switch to ' + x.name, a: 'grp', id: x.id }))).concat(g ? g.people.map(p => ({ l: 'Open ' + p.name, a: 'person', id: p.id })) : []).filter(i => g || ['newG', 'theme', 'backup', 'grp'].includes(i.a));
  modal('Command palette', '<input id="pq" placeholder="Type a command or a name" autocomplete="off" aria-label="Command">\n<div id="pl" class="pl"></div>', [{ l: 'Close', f() { } }]); pl('')
}
dlg.addEventListener('input', e => { if (e.target.id == 'pq') pl(e.target.value) });
dlg.addEventListener('keydown', e => { if (e.key == 'Enter' && e.target.id == 'pq') { const b = dlg.querySelector('[data-pi]'); if (b) runP(+b.dataset.pi) } });
dlg.addEventListener('click', e => { const b = e.target.closest('[data-pi]'); if (b) runP(+b.dataset.pi); if (e.target.closest('[data-reset]') && X) { prefill(); $('#xs').innerHTML = splitHtml(); hint() } });
document.addEventListener('change', e => { if (e.target.id == 'so') { sort = e.target.value; $('#xl').innerHTML = xl(G()) } });
document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('[data-ck]'); if (c) { fc = c.dataset.ck; tab = 'exp'; render(); toast('Showing ' + c.dataset.c) } });
document.addEventListener('keydown', e => {
  const t = e.target, typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName);
  if ((e.key == 'k' || e.key == 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!dlg.open) palette() }
  else if (e.key == '/' && !typing && !dlg.open) { const f = $('#qs') || $('#qa'); if (f) { e.preventDefault(); f.focus() } }
  else if ((e.key == 'Enter' || e.key == ' ') && t.dataset && t.dataset.a == 'tog') { e.preventDefault(); A.tog(t.dataset) }
});
const prevN = {};
function count() { const rm = matchMedia('(prefers-reduced-motion:reduce)').matches; document.querySelectorAll('[data-n]').forEach(el => { const k = el.dataset.k, to = +el.dataset.n, from = prevN[k] ?? 0; prevN[k] = to; if (from == to || rm) return; const t0 = performance.now(); (function f(t) { const p = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - p, 3); el.textContent = money(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(f) })(t0) }) }
function insView(g) {
  const ex = g.exp.filter(e => !e.pay), tot = ex.reduce((s, e) => s + e.amt, 0);
  if (!ex.length) return '<div class="ok">Add some expenses to see insights.</div>';
  const by = {}; ex.forEach(e => { const k = e.cat || 'other'; by[k] = (by[k] || 0) + e.amt });
  const rows = CATS.filter(c => by[c[0]]).map(c => ({ k: c[0], em: c[1], l: c[2], v: by[c[0]] })); let off = 0;
  const segs = rows.map(r => { const q = r.v / tot * 100, s = `<circle class="seg" r="15.9155" cx="21" cy="21" fill="none" stroke="var(--c-${r.k})" stroke-width="6" stroke-dasharray="${q} ${100 - q}" stroke-dashoffset="${25 - off}" data-ck="${r.k}" data-c="${r.l}" data-m="${money(r.v)}"/>`; off += q; return s }).join('');
  const paid = {}, own = {}; g.people.forEach(p => { paid[p.id] = 0; own[p.id] = 0 }); ex.forEach(e => { paid[e.by] = (paid[e.by] || 0) + e.amt; const s = shares(e); for (const id in s) own[id] = (own[id] || 0) + s[id] });
  const mx = Math.max(1, ...Object.values(paid), ...Object.values(own)), big = ex.reduce((a, b) => b.amt > a.amt ? b : a);
  return `<h2>Where the money went</h2><div class="ins"><div class="dn"><svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Spending by category">${segs}</svg><div id="dc" class="dc"><b>${money(tot)}</b><span>Total</span></div></div>
 <ul class="lg">${rows.map(r => `<li data-ck="${r.k}" data-c="${r.l}" data-m="${money(r.v)}"><i style="background:var(--c-${r.k})"></i>${r.em} ${r.l}<b>${Math.round(r.v / tot * 100)}%</b></li>`).join('')}</ul></div>
 <h2 style="margin-top:24px">Spending over time</h2>${trend(ex)}<h2 style="margin-top:24px">Paid versus fair share</h2>${g.people.map(p => `<div class="pv"><b>${esc(p.name)}</b><div><div class="bar"><i style="width:${paid[p.id] / mx * 100}%;background:var(--ac)"></i></div><div class="bar"><i style="width:${own[p.id] / mx * 100}%;background:var(--mute)"></i></div></div><small>${money(paid[p.id])} / ${money(own[p.id])}</small></div>`).join('')}
 <p class="fact">Colored bar is what they paid, grey bar is what they owe. Biggest expense: <b>${esc(big.desc)}</b> at ${money(big.amt)}. Average expense: ${money(Math.round(tot / ex.length))}.</p>`
}
function graph(g, st) {
  const N = g.people.length, R = 82, pos = {}; g.people.forEach((p, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; pos[p.id] = [120 + R * Math.cos(a), 120 + R * Math.sin(a), i] });
  const ar = st.map(s => {
    const a = pos[s.from], b = pos[s.to], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    return `<line class="flow" x1="${a[0] + ux * 20}" y1="${a[1] + uy * 20}" x2="${b[0] - ux * 24}" y2="${b[1] - uy * 24}" marker-end="url(#ah)"/><text class="lb" x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}">${money(s.amt)}</text>`
  }).join('');
  const nd = g.people.map(p => { const [x, y, i] = pos[p.id]; return `<g class="nd" data-a="person" data-id="${p.id}"><circle cx="${x}" cy="${y}" r="17" fill="hsl(${HUE(i)} 60% 42%)"/><text x="${x}" y="${y + 4}" class="ni">${esc(p.name.charAt(0).toUpperCase())}</text><text x="${x}" y="${y + (y > 120 ? 31 : -23)}" class="nn">${esc(p.name.slice(0, 10))}</text></g>` }).join('');
  return `<svg viewBox="0 0 240 240" class="graph" role="img" aria-label="Who pays whom"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ac)"/></marker></defs>${ar}${nd}</svg>`
}
document.addEventListener('input', e => { if (e.target.id == 'qs') { qs = e.target.value.trim().toLowerCase(); $('#xl').innerHTML = xl(G()) } });
document.addEventListener('mouseover', e => { const d = $('#dc'); if (!d) return; if (!d.dataset.def) d.dataset.def = d.innerHTML; const c = e.target.closest && e.target.closest('[data-c]'); d.innerHTML = c ? `<b>${c.dataset.m}</b><span>${esc(c.dataset.c)}</span>` : d.dataset.def });
document.addEventListener('keydown', e => { if (e.key == 'n' && !e.metaKey && !e.ctrlKey && !dlg.open && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && G()) { e.preventDefault(); A.addE() } });

/* dialogs */
function modal(t, body, btns) { dlg.innerHTML = `<h2>${t}</h2>${body}<div class="acts">${btns.map((b, i) => `<button class="btn ${b.p ? 'pri' : ''}" data-b="${i}">${b.l}</button>`).join('')}</div>`; dlg._b = btns; if (!dlg.open) dlg.showModal(); const f = dlg.querySelector('input:not([type=radio]):not([type=checkbox])'); if (f) f.focus() }
dlg.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b && dlg._b[b.dataset.b].f() !== false) dlg.close() });
dlg.addEventListener('close', () => { X = null });
const conf = (t, msg, l, fn) => modal(t, `<p>${msg}</p>`, [{ l: 'Cancel', f() { } }, { l: l, p: 1, f: fn }]);
function grpDlg(g) {
  const o = c => `<option ${(g ? g.cur : 'USD') == c ? 'selected' : ''}>${c}</option>`;
  modal(g ? 'Edit group' : 'New group', `<label>Group name<input id="gn" maxlength="40" placeholder="Weekend trip" value="${g ? esc(g.name) : ''}"></label><label>Currency<select id="gc">${CUR.map(o).join('')}</select></label><label>Budget, optional<input id="gb" type="number" min="0" step="0.01" inputmode="decimal" value="${g && g.budget ? (g.budget / 100).toFixed(2) : ''}"></label>${g ? '' : '<label>People, separated by commas<input id="gp" placeholder="Ada, Ben, Chloe"></label>'}`,
    [{ l: 'Cancel', f() { } }, ...(g ? [{ l: 'Delete group', f() { conf('Delete group?', `"${esc(g.name)}" and all its expenses will be removed for good.`, 'Delete group', () => { S.groups = S.groups.filter(x => x !== g); S.active = null; save(); render() }); return false } }] : []),
    {
      l: g ? 'Save' : 'Create group', p: 1, f() {
        const n = $('#gn').value.trim(); if (!n) { toast('Give the group a name'); return false }
        const bd = toC($('#gb').value); if (g) { g.name = n; g.cur = $('#gc').value; g.budget = bd } else {
          const seen = new Set(), people = ($('#gp').value || '').split(',').map(s => s.trim()).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())).slice(0, 12).map(s => ({ id: uid(), name: s }));
          const ng = { id: uid(), name: n, cur: $('#gc').value, budget: bd, people, exp: [] }; S.groups.push(ng); S.active = ng.id; tab = 'exp'
        }
        save(); render()
      }
    }])
}
function splitHtml() {
  const g = G();
  if (X.mode == 'equal') return g.people.map(p => `<label class="chk"><input type="checkbox" data-w="${p.id}" ${X.who.includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('');
  return g.people.map(p => `<label class="num"><span>${esc(p.name)}</span><input type="number" step="0.01" min="0" inputmode="decimal" data-v="${p.id}" value="${esc(X.vals[p.id] ?? '')}"><em>${X.mode == 'pct' ? '%' : X.mode == 'shr' ? 'sh' : g.cur}</em></label>`).join('') + '<button class="link" data-reset>Reset to even split</button>'
}
function hint() {
  const a = toC(X.amt), g = G(); let h;
  if (X.mode == 'equal') { const k = X.who.length; h = k ? `${k} ${k == 1 ? 'person' : 'people'}, about ${money(Math.round(a / k))} each` : 'Pick at least one person' }
  else if (X.mode == 'shr') { const s = g.people.reduce((t, p) => t + (parseFloat(X.vals[p.id]) || 0), 0); h = s > 0 ? `${+s.toFixed(2)} shares, about ${money(Math.round(a / s))} per share` : 'Give at least one person a share' } else if (X.mode == 'exact') { const d = a - g.people.reduce((t, p) => t + toC(X.vals[p.id]), 0); h = d == 0 ? 'Amounts add up' : d > 0 ? `${money(d)} still to assign` : `${money(-d)} over the total` }
  else { const s = g.people.reduce((t, p) => t + (parseFloat(X.vals[p.id]) || 0), 0); h = Math.abs(s - 100) < .005 ? 'Percentages add up to 100%' : `Total is ${+s.toFixed(2)}%, it needs to be 100%` }
  $('#hint').textContent = h
}
function prefill() {
  const g = G(), n = g.people.length, a = toC(X.amt); X.vals = {}; if (X.mode == 'shr') { g.people.forEach(p => X.vals[p.id] = '1'); return }
  if (X.mode == 'exact') { const s = a ? shares({ mode: 'equal', amt: a, who: g.people.map(p => p.id) }) : {}; g.people.forEach(p => X.vals[p.id] = a ? (s[p.id] / 100).toFixed(2) : '') }
  else if (X.mode == 'pct') { let t = 0; g.people.forEach((p, i) => { const v = i == n - 1 ? +(100 - t).toFixed(2) : +(100 / n).toFixed(2); t += v; X.vals[p.id] = String(v) }) }
}
function expDlg(e) {
  const g = G(); if (g.people.length < 2) { toast('Add at least two people first'); return }
  const ids = g.people.map(p => p.id);
  X = e ? { id: e.id, desc: e.desc, amt: (e.amt / 100).toFixed(2), by: e.by, date: e.date, mode: e.mode, cat: e.cat || 'other', ct: 1, rec: !!e.rec, who: [...(e.who || ids)], vals: {} } : { id: null, desc: '', amt: '', by: ids[0], date: iso(Date.now()), mode: 'equal', cat: 'other', ct: 0, rec: false, who: [...ids], vals: {} };
  if (e && e.mode == 'exact') for (const k in e.vals) X.vals[k] = (e.vals[k] / 100).toFixed(2);
  if (e && (e.mode == 'pct' || e.mode == 'shr')) for (const k in e.vals) X.vals[k] = String(e.vals[k]);
  modal(e ? 'Edit expense' : 'Add expense', `<label>What was it for?<input id="xd" maxlength="60" placeholder="Dinner, taxi, tickets" value="${esc(X.desc)}"></label>
 <div class="g2"><label>Amount (${g.cur})<input id="xa" type="number" inputmode="decimal" min="0" step="0.01" value="${X.amt}"></label><label>Date<input id="xt" type="date" value="${X.date}"></label></div>
 <div class="chips tips"><span>Add tip</span>${[10, 15, 20].map(v => `<button class="chip" data-tip="${v}">${v}%</button>`).join('')}</div><label>Paid by<select id="xb">${g.people.map(p => `<option value="${p.id}" ${p.id == X.by ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
 <label class="chk"><input type="checkbox" id="xr" ${X.rec ? 'checked' : ''}><span>Repeat every month</span></label>
 <div class="seg cats" role="radiogroup" aria-label="Category">${CATS.map(c => `<label><input type="radio" name="cat" value="${c[0]}" ${X.cat == c[0] ? 'checked' : ''}><span>${c[1]} ${c[2]}</span></label>`).join('')}</div>
 <div class="seg" role="radiogroup" aria-label="Split method">${[['equal', 'Equal'], ['exact', 'Exact'], ['pct', 'Percent'], ['shr', 'Shares']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${X.mode == v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
 <div id="xs">${splitHtml()}</div><p id="hint" class="hint"></p>`, [{ l: 'Cancel', f() { } }, { l: e ? 'Save changes' : 'Add expense', p: 1, f: saveExp }]);
  hint()
}
function saveExp() {
  const g = G(), a = toC(X.amt), d = X.desc.trim();
  if (!d || !a) { toast('Add a description and an amount'); return false }
  const e = { id: X.id || uid(), desc: d, amt: a, by: X.by, date: X.date || iso(Date.now()), mode: X.mode, cat: X.cat };
  if (X.mode == 'equal') { if (!X.who.length) { toast('Pick who shares this'); return false } e.who = g.people.map(p => p.id).filter(id => X.who.includes(id)) }
  else {
    e.vals = {}; let s = 0; g.people.forEach(p => { const v = X.mode == 'exact' ? toC(X.vals[p.id]) : (parseFloat(X.vals[p.id]) || 0); e.vals[p.id] = v; s += v });
    if (X.mode == 'exact' && s != a) { toast('Amounts must add up to the total'); return false }
    if (X.mode == 'pct' && Math.abs(s - 100) >= .005) { toast('Percentages must total 100'); return false } if (X.mode == 'shr' && s <= 0) { toast('Give at least one person a share'); return false }
  }
  const i = g.exp.findIndex(x => x.id == e.id); if (X.rec) { e.rec = 'm'; e.nx = i >= 0 && g.exp[i].nx || nextM(e.date) } if (i < 0) g.exp.push(e); else g.exp[i] = e; recur(); save(); render(); toast(i < 0 ? 'Expense added' : 'Expense updated')
}
dlg.addEventListener('input', e => {
  if (!X) return; const t = e.target;
  if (t.id == 'xd') { X.desc = t.value; if (!X.ct) { X.cat = guess(t.value); const r = dlg.querySelector('[name=cat][value=' + X.cat + ']'); if (r) r.checked = true } } else if (t.id == 'xt') X.date = t.value; else if (t.id == 'xa') { X.amt = t.value; X.base = 0; hint() } else if (t.dataset.v) { X.vals[t.dataset.v] = t.value; hint() }
});
dlg.addEventListener('change', e => {
  if (!X) return; const t = e.target;
  if (t.id == 'xb') X.by = t.value; else if (t.id == 'xr') X.rec = t.checked; else if (t.name == 'cat') { X.cat = t.value; X.ct = 1 }
  else if (t.name == 'mode') { X.mode = t.value; prefill(); $('#xs').innerHTML = splitHtml(); hint() }
  else if (t.dataset.w) { X.who = t.checked ? [...X.who, t.dataset.w] : X.who.filter(i => i != t.dataset.w); hint() }
});

const A = {
  newG() { grpDlg() }, editG() { grpDlg(G()) }, fc(x) { fc = x.k; render() },
  qadd() { quick($('#qa').value) },
  tog(x) { open.has(x.id) ? open.delete(x.id) : open.add(x.id); $('#xl').innerHTML = xl(G()) },
  grp(x) { S.active = x.id; tab = 'exp'; save(); render() },
  pal() { if (!dlg.open) palette() },
  remind(x) { const g = G(), t = `Hi ${nm(x.f)}, a friendly reminder from our "${g.name}" group: you owe ${nm(x.t)} ${money(+x.m)}. Thanks!`; (navigator.share ? navigator.share({ text: t }) : Promise.reject()).catch(() => clip(t, 'Reminder copied')) },
  settleAll() { const g = G(), st = settle(net(g)); conf('Record all payments?', `This logs ${st.length} payment${st.length == 1 ? '' : 's'} so everyone ends up settled.`, 'Record all', () => { st.forEach(s => g.exp.push({ id: uid(), pay: 1, from: s.from, to: s.to, amt: s.amt, date: iso(Date.now()) })); save(); render(); toast('Everyone is settled up') }) },
  person(x) {
    const g = G(), p = g.people.find(q => q.id == x.id); if (!p) return; const nn = net(g), n = nn[p.id], ex = g.exp.filter(e => !e.pay); let paid = 0, own = 0; ex.forEach(e => { if (e.by == p.id) paid += e.amt; own += shares(e)[p.id] || 0 });
    const st = settle(nn).filter(s => s.from == p.id || s.to == p.id), mine = ex.filter(e => e.by == p.id).slice(-4).reverse();
    modal(esc(p.name), `<div class="pst"><div><span>Paid</span><b>${money(paid)}</b></div><div><span>Fair share</span><b>${money(own)}</b></div><div><span>Balance</span><b class="${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${n ? money(Math.abs(n)) : 'Settled'}</b></div></div>
  <h3>Next payments</h3>${st.length ? st.map(s => `<p class="ln"><span>${s.from == p.id ? 'Pays ' + esc(nm(s.to)) : 'Gets from ' + esc(nm(s.from))}</span><b>${money(s.amt)}</b></p>`).join('') : '<p class="ln">Nothing to settle.</p>'}
  <h3>Recent expenses they paid</h3>${mine.map(e => `<p class="ln"><span>${esc(e.desc)}</span><b>${money(e.amt)}</b></p>`).join('') || '<p class="ln">None yet.</p>'}`, [{ l: 'Close', p: 1, f() { } }])
  },
  csv() { const g = G(), q = v => '"' + String(v).replace(/"/g, '""') + '"'; clip(['Date,Description,Category,Paid by,Amount'].concat(g.exp.filter(e => !e.pay).map(e => [e.date, q(e.desc), e.cat || 'other', q(nm(e.by)), (e.amt / 100).toFixed(2)].join(','))).join('\n'), 'CSV copied') },
  backup() { modal('Backup and restore', '<p>Copy this text to keep your data safe. To restore, paste a backup over it and press Restore.</p><label>Your data<textarea id="bj" rows="8" spellcheck="false" style="width:100%;margin-top:4px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font-size:13px">' + esc(JSON.stringify(S)) + '</textarea></label>', [{ l: 'Close', f() { } }, { l: 'Copy', f() { clip($('#bj').value, 'Backup copied'); return false } }, { l: 'Restore', p: 1, f() { try { const v = JSON.parse($('#bj').value); if (!Array.isArray(v.groups)) throw 0; S = v; save(); render(); toast('Backup restored') } catch (e) { toast('That is not a Splitly backup'); return false } } }]) },
  theme() { const r = document.documentElement, d = r.dataset.theme != 'light'; S.theme = d ? 'light' : 'dark'; r.dataset.theme = S.theme; save() },
  tab(x) { tab = x.t; render() },
  addP() {
    const v = $('#pn').value.trim(), g = G(); if (!v) return; if (g.people.some(p => p.name.toLowerCase() == v.toLowerCase())) { toast('That name is already in the group'); return }
    if (g.people.length >= 12) { toast('Groups hold up to 12 people'); return } g.people.push({ id: uid(), name: v }); save(); render(); $('#pn').focus()
  },
  rmP(x) { const g = G(); if (involved(g, x.id)) { toast('They are part of an expense, so they cannot be removed'); return } g.people = g.people.filter(p => p.id != x.id); save(); render() },
  addE() { if (G()) expDlg() }, editE(x) { expDlg(G().exp.find(e => e.id == x.id)) },
  delE(x) { const g = G(), i = g.exp.findIndex(e => e.id == x.id), e = g.exp[i]; g.exp.splice(i, 1); save(); render(); toast('Entry deleted', () => { g.exp.splice(i, 0, e); save(); render() }) },
  pay(x) { G().exp.push({ id: uid(), pay: 1, from: x.f, to: x.t, amt: +x.m, date: iso(Date.now()) }); save(); render(); toast('Payment recorded') },
  copy() {
    const g = G(), n = net(g), st = settle(n); const t = `${g.name}\nTotal spent: ${money(g.exp.reduce((s, e) => s + (e.pay ? 0 : e.amt), 0))}\n` + (st.length ? 'To settle up:\n' + st.map(s => `- ${nm(s.from)} pays ${nm(s.to)} ${money(s.amt)}`).join('\n') : 'Everyone is settled up.');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Summary copied'), () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy') } catch (e) { } a.remove(); toast(ok ? 'Summary copied' : 'Copy is blocked in this view') })
  }
};
document.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a && A[a.dataset.a]) A[a.dataset.a](a.dataset) });
document.addEventListener('change', e => { if (e.target.id == 'gs') { S.active = e.target.value; tab = 'exp'; save(); render() } });
document.addEventListener('keydown', e => { if (e.key == 'Enter' && e.target.id == 'pn') A.addP() });
render();

