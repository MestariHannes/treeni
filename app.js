/* Treeni – oma treenisovellus (PWA). Data tallentuu vain tähän laitteeseen (localStorage). */
(function () {
  'use strict';
  const DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
  const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
  const KEY = 'treeni.v1';
  const PAGE = 30;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Tila ---------- */
  let S = { active: null, history: [], rest: 90, favs: [] };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  let DB = [], BY = new Map();
  const ui = { side: 'front', sel: new Set(), q: '', equip: '', shown: PAGE, view: 'muscles' };

  /* ---------- Apufunktiot ---------- */
  const nameOf = e => FI.names[e.id] || e.name;
  const mName = m => Muscles.NAMES[m] || m;
  const eqName = q => FI.equipment[q] || q || 'Muu';
  const img = (e, i = 0) => e && e.images && e.images[i] ? IMG + e.images[i] : '';
  const e1rm = (kg, r) => kg * (1 + r / 30);
  const fmt = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const dur = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const date = ts => new Date(ts).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });

  function toast(t) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
  }

  /* ---------- Liikepankki ---------- */
  async function loadDB() {
    $('#count').textContent = 'Ladataan liikkeitä…';
    try {
      const r = await fetch(DB_URL);
      DB = await r.json();
      const rank = e => (FI.names[e.id] ? 0 : 1) * 10 + (e.category === 'strength' || e.category === 'powerlifting' ? 0 : e.category === 'stretching' ? 5 : 2);
      DB.sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), 'fi'));
      BY = new Map(DB.map(e => [e.id, e]));
      const eq = [...new Set(DB.map(e => e.equipment).filter(Boolean))].sort((a, b) => eqName(a).localeCompare(eqName(b), 'fi'));
      $('#equip').insertAdjacentHTML('beforeend', eq.map(q => `<option value="${esc(q)}">${esc(eqName(q))}</option>`).join(''));
    } catch (e) {
      $('#count').textContent = 'Liikkeitä ei saatu ladattua. Tarkista nettiyhteys ja avaa sovellus uudelleen.';
      return;
    }
    renderList(); renderWorkout(); renderHistory();
  }

  /* ---------- Lihakset-näkymä ---------- */
  function renderMap() {
    $('#map').innerHTML = Muscles.svg('front', { interactive: true, selected: ui.sel }) + Muscles.svg('back', { interactive: true, selected: ui.sel });
    const c = $('#selChips');
    c.innerHTML = ui.sel.size
      ? [...ui.sel].map(m => `<button class="chip" data-unsel="${esc(m)}">${esc(mName(m))} <b>×</b></button>`).join('') +
        (ui.sel.size > 1 ? '<button class="chip ghost" data-clear>Tyhjennä</button>' : '')
      : '<span class="chip ghost">Napauta lihasta kartalta</span>';
  }
  function filtered() {
    const q = ui.q.trim().toLowerCase();
    return DB.filter(e =>
      (!ui.sel.size || e.primaryMuscles.some(m => ui.sel.has(m))) &&
      (!ui.equip || e.equipment === ui.equip) &&
      (!q || nameOf(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q)));
  }
  function card(e) {
    return `<button class="card" data-ex="${esc(e.id)}">
      <div class="img"><img loading="lazy" src="${img(e)}" alt="">${S.favs.includes(e.id) ? '<span class="fav">★</span>' : ''}</div>
      <div class="txt"><div class="nm">${esc(nameOf(e))}</div><div class="sub">${esc(e.primaryMuscles.map(mName).join(', '))} · ${esc(eqName(e.equipment))}</div></div>
    </button>`;
  }
  function renderList() {
    if (!DB.length) return;
    const list = filtered();
    const what = ui.sel.size ? [...ui.sel].map(mName).join(' + ') : 'Kaikki lihakset';
    $('#count').textContent = `${what}: ${list.length} liikettä`;
    $('#list').innerHTML = list.slice(0, ui.shown).map(card).join('');
    $('#more').hidden = list.length <= ui.shown;
  }

  $('#map').addEventListener('click', ev => {
    const p = ev.target.closest('.m'); if (!p) return;
    const m = p.dataset.m;
    ui.sel.has(m) ? ui.sel.delete(m) : ui.sel.add(m);
    ui.shown = PAGE; renderMap(); renderList();
  });
  $('#selChips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-unsel],[data-clear]'); if (!b) return;
    b.dataset.clear !== undefined ? ui.sel.clear() : ui.sel.delete(b.dataset.unsel);
    ui.shown = PAGE; renderMap(); renderList();
  });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    ui.side = b.dataset.side;
    document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
    renderMap();
  }));
  $('#search').addEventListener('input', ev => { ui.q = ev.target.value; ui.shown = PAGE; renderList(); });
  $('#equip').addEventListener('change', ev => { ui.equip = ev.target.value; ui.shown = PAGE; renderList(); });
  $('#more').addEventListener('click', () => { ui.shown += PAGE; renderList(); });
  document.addEventListener('click', ev => {
    const c = ev.target.closest('[data-ex]'); if (c) openEx(c.dataset.ex);
  });

  /* ---------- Historia per liike ---------- */
  function sessionsFor(id) {
    return S.history.filter(w => w.items.some(i => i.id === id))
      .map(w => ({ start: w.start, sets: w.items.find(i => i.id === id).sets }));
  }
  function recordsFor(id) {
    let maxKg = 0, maxKgReps = 0, best = 0, mostReps = 0, vol = 0;
    sessionsFor(id).forEach(s => s.sets.forEach(x => {
      const kg = +x.kg || 0, r = +x.reps || 0;
      if (kg > maxKg || (kg === maxKg && r > maxKgReps)) { maxKg = kg; maxKgReps = r; }
      best = Math.max(best, e1rm(kg, r)); mostReps = Math.max(mostReps, r); vol += kg * r;
    }));
    return { maxKg, maxKgReps, best, mostReps, vol };
  }
  function lastSets(id) {
    for (let i = S.history.length - 1; i >= 0; i--) {
      const it = S.history[i].items.find(x => x.id === id);
      if (it) return it.sets;
    }
    return [];
  }

  /* ---------- Liikkeen tiedot ---------- */
  let animT = null;
  function openEx(id, tab = 'info') {
    const e = BY.get(id); if (!e) return;
    const card = $('#sheetCard');
    const sec = (e.secondaryMuscles || []);
    card.innerHTML = `
      <div class="sheet-top"><h3>${esc(nameOf(e))}</h3>
        <button class="x" data-fav="${esc(id)}" aria-label="Suosikki">${S.favs.includes(id) ? '★' : '☆'}</button>
        <button class="x" data-close aria-label="Sulje">✕</button></div>
      <div class="anim">${(e.images || []).slice(0, 2).map((s, i) => `<img src="${IMG + s}" alt="" style="opacity:${i ? 0 : 1}">`).join('')}</div>
      <div class="tabs2">
        <button data-tab="info" class="${tab === 'info' ? 'on' : ''}">Tietoa</button>
        <button data-tab="hist" class="${tab === 'hist' ? 'on' : ''}">Historia</button>
        <button data-tab="rec" class="${tab === 'rec' ? 'on' : ''}">Ennätykset</button>
      </div>
      <div class="pane" id="pane"></div>
      <button class="cta" data-add="${esc(id)}">${S.active ? 'Lisää treeniin' : 'Aloita treeni tällä liikkeellä'}</button>`;
    const pane = $('#pane', card);
    const show = t => {
      card.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      if (t === 'info') {
        pane.innerHTML = `
          <h4>Kohdelihakset</h4>${Muscles.pair({ primary: e.primaryMuscles, secondary: sec })}
          <div class="tags" style="margin-top:10px">${e.primaryMuscles.map(m => `<span class="tag p">${esc(mName(m))}</span>`).join('')}${sec.map(m => `<span class="tag">${esc(mName(m))}</span>`).join('')}</div>
          <h4>Tiedot</h4><div class="tags"><span class="tag">${esc(eqName(e.equipment))}</span><span class="tag">${esc(FI.level[e.level] || e.level)}</span>${FI.names[e.id] ? `<span class="tag">${esc(e.name)}</span>` : ''}</div>
          <h4>Suoritus</h4><ol>${(e.instructions || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <p class="note">Ohjeet ovat toistaiseksi englanniksi.</p>`;
      } else if (t === 'hist') {
        const ss = sessionsFor(id).reverse();
        pane.innerHTML = ss.length ? chart(ss.slice().reverse()) + ss.map(s => `<div class="hist" style="margin-top:10px"><div class="d">${date(s.start)}</div><ul>${s.sets.map(x => `<li>${fmt(+x.kg || 0)} kg × ${+x.reps || 0}</li>`).join('')}</ul></div>`).join('')
          : '<p class="empty">Ei vielä tehtyjä sarjoja tällä liikkeellä.</p>';
      } else {
        const r = recordsFor(id);
        pane.innerHTML = r.vol ? `<div class="prs">
          <div class="pr">Suurin paino <b>${fmt(r.maxKg)} kg × ${r.maxKgReps}</b></div>
          <div class="pr">Arvioitu 1RM <b>${fmt(r.best)} kg</b></div>
          <div class="pr">Eniten toistoja sarjassa <b>${r.mostReps}</b></div>
          <div class="pr">Kokonaisvolyymi <b>${Math.round(r.vol).toLocaleString('fi-FI')} kg</b></div></div>
          <p class="note">Arvioitu 1RM lasketaan Epleyn kaavalla.</p>`
          : '<p class="empty">Ennätykset näkyvät, kun olet tehnyt liikettä.</p>';
      }
    };
    show(tab);
    card.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    $('#sheet').hidden = false;
    clearInterval(animT);
    const ims = card.querySelectorAll('.anim img');
    if (ims.length > 1) { let k = 0; animT = setInterval(() => { k ^= 1; ims[0].style.opacity = k ? 0 : 1; ims[1].style.opacity = k ? 1 : 0; }, 1100); }
  }
  function chart(ss) {
    const pts = ss.map(s => Math.max(...s.sets.map(x => +x.kg || 0)));
    if (pts.length < 2) return '';
    const W = 320, H = 140, p = 22, lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
    const xy = pts.map((v, i) => [p + i * (W - 2 * p) / (pts.length - 1), H - p - (v - lo) / span * (H - 2 * p)]);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="M${xy.map(a => a.join(' ')).join(' L')}"/>${xy.map(a => `<circle cx="${a[0]}" cy="${a[1]}" r="4"/>`).join('')}
      <text x="${p}" y="14">${fmt(hi)} kg</text><text x="${p}" y="${H - 6}">${fmt(lo)} kg</text></svg>`;
  }
  function closeSheet() { $('#sheet').hidden = true; clearInterval(animT); }
  $('#sheet').addEventListener('click', ev => {
    if (ev.target.closest('[data-close]')) return closeSheet();
    const f = ev.target.closest('[data-fav]');
    if (f) {
      const id = f.dataset.fav, i = S.favs.indexOf(id);
      i < 0 ? S.favs.push(id) : S.favs.splice(i, 1); save();
      f.textContent = i < 0 ? '★' : '☆'; renderList(); return;
    }
    const a = ev.target.closest('[data-add]');
    if (a) { addToWorkout(a.dataset.add); closeSheet(); }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeSheet(); });

  /* ---------- Treeni ---------- */
  function addToWorkout(id) {
    if (!S.active) S.active = { start: Date.now(), items: [] };
    if (S.active.items.some(i => i.id === id)) { toast('Liike on jo treenissä'); return; }
    const prev = lastSets(id);
    const n = Math.max(3, prev.length);
    S.active.items.push({ id, sets: Array.from({ length: n }, () => ({ kg: '', reps: '', done: false })) });
    save(); renderWorkout(); toast(`Lisätty: ${nameOf(BY.get(id))}`);
  }
  let finishArmed = false;
  function renderWorkout() {
    const box = $('#workout');
    const badge = $('#badge');
    const n = S.active ? S.active.items.length : 0;
    badge.hidden = !n; badge.textContent = n;
    if (!S.active) {
      box.innerHTML = `<div class="empty"><h2>Ei treeniä käynnissä</h2>
        <p>Valitse lihas kartalta, avaa liike ja paina “Aloita treeni”.</p>
        <button class="cta" data-go="muscles">Valitse liikkeet</button></div>`;
      return;
    }
    box.innerHTML = `
      <div class="wo-head"><h2>Treeni</h2><span id="elapsed"></span></div>
      <div class="rest-row">Lepoaika sarjojen välissä
        <select id="restSel">${[0, 30, 60, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === S.rest ? 'selected' : ''}>${s ? (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : s + ' s') : 'Ei ajastinta'}</option>`).join('')}</select></div>
      ${S.active.items.map((it, xi) => {
        const e = BY.get(it.id); const prev = lastSets(it.id);
        return `<div class="ex" data-xi="${xi}">
          <div class="ex-h"><img src="${img(e)}" alt=""><div class="nm" data-ex="${esc(it.id)}">${esc(e ? nameOf(e) : it.id)}</div><button data-rmex="${xi}" aria-label="Poista liike">✕</button></div>
          <table class="sets"><thead><tr><th>Sarja</th><th>Edellinen</th><th>kg</th><th>Toistot</th><th>✓</th></tr></thead><tbody>
          ${it.sets.map((s, si) => {
            const p = prev[si];
            const b = it.sets[si - 1];
            const ph = p || (b && b.reps ? b : null); // ehdotus: viime kerta tai edellinen sarja
            return `<tr class="${s.done ? 'done' : ''}" data-si="${si}">
              <td class="n">${si + 1}</td>
              <td class="prev">${p ? `${fmt(+p.kg || 0)}×${+p.reps || 0}` : '–'}</td>
              <td><input inputmode="decimal" data-f="kg" value="${esc(s.kg)}" placeholder="${ph ? fmt(+ph.kg || 0) : 'kg'}"></td>
              <td><input inputmode="numeric" data-f="reps" value="${esc(s.reps)}" placeholder="${ph ? +ph.reps || 0 : '0'}"></td>
              <td><button class="ok" data-ok>✓</button></td></tr>`;
          }).join('')}
          </tbody></table>
          <button class="addset" data-addset="${xi}">+ Lisää sarja</button></div>`;
      }).join('')}
      <button class="cta alt" data-go="muscles">+ Lisää liike</button>
      <button class="cta" id="finish">${finishArmed ? 'Vahvista: tallenna ja lopeta' : 'Lopeta treeni'}</button>
      <button class="cta alt" id="discard" style="color:var(--danger)">Hylkää treeni</button>`;
    tickElapsed();
  }
  function tickElapsed() {
    const el = $('#elapsed'); if (el && S.active) {
      const s = Math.floor((Date.now() - S.active.start) / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }
  setInterval(tickElapsed, 1000);

  $('#workout').addEventListener('input', ev => {
    const inp = ev.target.closest('input[data-f]'); if (!inp) return;
    const xi = +inp.closest('[data-xi]').dataset.xi, si = +inp.closest('[data-si]').dataset.si;
    S.active.items[xi].sets[si][inp.dataset.f] = inp.value.replace(',', '.'); save();
  });
  $('#workout').addEventListener('change', ev => {
    if (ev.target.id === 'restSel') { S.rest = +ev.target.value; save(); }
  });
  $('#workout').addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-go]')) return go(t.closest('[data-go]').dataset.go);
    if (t.closest('[data-ok]')) {
      const tr = t.closest('tr'), xi = +t.closest('[data-xi]').dataset.xi, si = +tr.dataset.si;
      const s = S.active.items[xi].sets[si];
      if (!s.done) {
        const [ik, ir] = tr.querySelectorAll('input');
        if (!s.kg && ik.placeholder !== 'kg') s.kg = ik.placeholder.replace(',', '.');
        if (!s.reps && ir.placeholder !== '0') s.reps = ir.placeholder;
        if (!(+s.reps > 0)) { toast('Lisää toistot ensin'); return; }
        s.done = true; startRest();
      } else s.done = false;
      save(); renderWorkout(); return;
    }
    if (t.closest('[data-addset]')) {
      const it = S.active.items[+t.closest('[data-addset]').dataset.addset];
      const last = it.sets[it.sets.length - 1] || {};
      it.sets.push({ kg: last.kg || '', reps: last.reps || '', done: false }); save(); renderWorkout(); return;
    }
    if (t.closest('[data-rmex]')) { S.active.items.splice(+t.closest('[data-rmex]').dataset.rmex, 1); save(); renderWorkout(); return; }
    if (t.id === 'finish') {
      if (!finishArmed) { finishArmed = true; renderWorkout(); setTimeout(() => { finishArmed = false; if (ui.view === 'workout') renderWorkout(); }, 4000); return; }
      finishArmed = false;
      const items = S.active.items.map(i => ({ id: i.id, sets: i.sets.filter(s => s.done).map(s => ({ kg: +s.kg || 0, reps: +s.reps || 0 })) })).filter(i => i.sets.length);
      if (items.length) { S.history.push({ start: S.active.start, end: Date.now(), items }); toast('Treeni tallennettu 💪'); }
      else toast('Ei tehtyjä sarjoja, treeniä ei tallennettu');
      S.active = null; stopRest(); save(); renderWorkout(); renderHistory(); go('history'); return;
    }
    if (t.id === 'discard') {
      if (t.dataset.armed) { S.active = null; stopRest(); save(); renderWorkout(); toast('Treeni hylätty'); return; }
      t.dataset.armed = '1'; t.textContent = 'Vahvista hylkäys'; setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = 'Hylkää treeni'; } }, 4000);
    }
  });

  /* ---------- Lepoajastin ---------- */
  let restEnd = 0, restT = null;
  const pill = $('#timerPill');
  function startRest() {
    if (!S.rest) return;
    restEnd = Date.now() + S.rest * 1000; pill.hidden = false; pill.classList.remove('done');
    clearInterval(restT); restT = setInterval(tickRest, 250); tickRest();
  }
  function tickRest() {
    const left = Math.ceil((restEnd - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(restT); pill.textContent = 'Lepo ohi – seuraava sarja!'; pill.classList.add('done');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(stopRest, 6000); return;
    }
    pill.textContent = `Lepo ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}  ✕`;
  }
  function stopRest() { clearInterval(restT); pill.hidden = true; }
  pill.addEventListener('click', stopRest);

  /* ---------- Historia ---------- */
  function renderHistory() {
    const box = $('#history');
    if (!S.history.length) {
      box.innerHTML = '<div class="empty"><h2>Ei vielä treenejä</h2><p>Tehdyt treenit, ennätykset ja kehitys näkyvät täällä.</p></div>';
      return;
    }
    const weekAgo = Date.now() - 7 * 864e5;
    const sets = S.history.reduce((a, w) => a + w.items.reduce((b, i) => b + i.sets.length, 0), 0);
    const ids = [...new Set(S.history.flatMap(w => w.items.map(i => i.id)))];
    const prs = ids.map(id => ({ id, r: recordsFor(id) })).filter(x => x.r.maxKg > 0).sort((a, b) => b.r.best - a.r.best).slice(0, 8);
    box.innerHTML = `
      <div class="wo-head"><h2>Historia</h2></div>
      <div class="stats">
        <div class="stat"><b>${S.history.length}</b><span>treeniä</span></div>
        <div class="stat"><b>${S.history.filter(w => w.start > weekAgo).length}</b><span>7 päivässä</span></div>
        <div class="stat"><b>${sets}</b><span>sarjaa</span></div></div>
      ${prs.length ? `<h3 class="section-t">Ennätykset</h3><div class="prs">${prs.map(x => `<button class="pr" data-ex="${esc(x.id)}" style="text-align:left;width:100%">${esc(BY.get(x.id) ? nameOf(BY.get(x.id)) : x.id)} <b>${fmt(x.r.maxKg)} kg × ${x.r.maxKgReps}</b></button>`).join('')}</div>` : ''}
      <h3 class="section-t">Treenit</h3>
      ${S.history.slice().reverse().map(w => `<div class="hist"><div class="d">${date(w.start)} <span>${dur(w.end - w.start)}</span></div>
        <ul>${w.items.map(i => `<li>${esc(BY.get(i.id) ? nameOf(BY.get(i.id)) : i.id)}: ${i.sets.map(s => `${fmt(s.kg)}×${s.reps}`).join(', ')}</li>`).join('')}</ul></div>`).join('')}`;
  }

  /* ---------- Navigointi ---------- */
  function go(v) {
    ui.view = v;
    document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'workout') renderWorkout();
    if (v === 'history') renderHistory();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

  /* ---------- Käynnistys ---------- */
  // Linkillä voi esivalita lihakset, esim. #m=chest,shoulders
  const hm = /m=([^&]+)/.exec(location.hash);
  if (hm) decodeURIComponent(hm[1]).split(',').filter(m => Muscles.NAMES[m]).forEach(m => ui.sel.add(m));
  renderMap(); renderWorkout(); renderHistory(); loadDB();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
