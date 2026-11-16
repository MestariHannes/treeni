/* Treeni – oma treenisovellus (PWA). Data tallentuu vain tähän laitteeseen (localStorage). */
(function () {
  'use strict';
  const DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
  const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
  const KEY = 'treeni.v1'; // avain pidetään samana, jotta vanhat tiedot säilyvät
  const VERSION = '3.0';
  const PAGE = 30;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Tila ---------- */
  /* Tietorakenne (schema 2). profile on suunniteltu niin, että tuleva AI-koutsi voi lukea sen sellaisenaan:
     goals = { progress: bool, weightLoss: { targetKg, pace } | null }
     profile = { v, name, sex, birthYear, goal, level, daysPerWeek, equipment, heightCm, weightKg, created, updated }
     bodyLog = [{ ts, kg }]   templates = [{ id, name, items: [{ id, sets, reps }] }]
     history = [{ start, end, templateId, name, items: [{ id, sets: [{ kg, reps }] }] }] */
  let S = { schema: 2, active: null, history: [], rest: 90, favs: [], profile: null, bodyLog: [], templates: [], lastBackup: 0 };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { if (typeof DEMO !== 'undefined' && DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  // Esittelytila (#esittely): esimerkkitiedot muistiin, ei tallenneta laitteelle
  const DEMO = /esittely/.test(location.hash);
  if (DEMO) {
    const D = 864e5, n = Date.now();
    S = Object.assign(S, { theme: (location.hash.match(/teema=(\w+)/) || [])[1] || S.theme, profile: { v: 1, name: 'Hannes', sex: 'male', goal: 'muscle', level: 'intermediate', daysPerWeek: 3, equipment: 'gym', heightCm: 182, weightKg: 86, birthYear: 1995 },
      goals: { progress: true, weightLoss: null }, bodyLog: [{ ts: n - 20 * D, kg: 87.4 }, { ts: n - 6 * D, kg: 86.2 }],
      history: [{ start: n - 9 * D, end: n - 9 * D + 3.1e6, templateId: 'full-gym-A', name: 'Koko keho A', items: [{ id: 'Barbell_Squat', sets: [{ kg: 80, reps: 10 }, { kg: 80, reps: 9 }] }] },
        { start: n - 2 * D, end: n - 2 * D + 2.9e6, templateId: 'full-gym-B', name: 'Koko keho B', items: [{ id: 'Romanian_Deadlift', sets: [{ kg: 70, reps: 10 }] }] }] });
  }

  let DB = [], BY = new Map();
  const ui = { side: 'front', sel: new Set(), q: '', equip: '', shown: PAGE, view: 'home', pick: null };

  /* ---------- Apufunktiot ---------- */
  const nameOf = e => FI.names[e.id] || e.name;
  const mName = m => Muscles.NAMES[m] || m;
  const eqName = q => FI.equipment[q] || q || 'Muu';
  const img = (e, i = 0) => e && e.images && e.images[i] ? IMG + e.images[i] : '';
  // Liikkeen pikkukuva: piirretty hahmo (Mannequin), valokuvat vain erikseen pyydettäessä
  // 3D-pikkukuva renderöidään laiskasti näkyviin tullessa; siihen asti piirretty hahmo
  const thumb = e => e ? `<span class="t3" data-t3="${esc(e.id)}">${Mannequin.svg(e)}</span>` : '';
  const T3 = new Map(); let t3q = [], t3busy = false;
  // Jonoon ne pikkukuvat, jotka ovat ruudulla tai lähellä (tarkistetaan piirron, näkymän vaihdon ja vierityksen yhteydessä)
  function hydrate3d(root) {
    if (!window.WebGLRenderingContext || S.anim2d) return;
    const vh = innerHeight + 300;
    (root || document).querySelectorAll('[data-t3]:not([data-done])').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.top < vh && r.bottom > -300) { el.dataset.done = '1'; t3q.push(el); }
    });
    if (t3q.length) pump3d();
  }
  let t3scroll = 0;
  addEventListener('scroll', () => { clearTimeout(t3scroll); t3scroll = setTimeout(() => hydrate3d(document.querySelector('.view:not([hidden])')), 120); }, { passive: true });
  async function pump3d() {
    if (t3busy) return; t3busy = true;
    try {
      const H = await import('./human3d.js');
      while (t3q.length) {
        const el = t3q.shift(), e = BY.get(el.dataset.t3); if (!e || !el.isConnected) continue;
        const key = Mannequin.classify(e) + '|' + e.primaryMuscles.join(',') + '|' + bodySex();
        if (!T3.has(key)) T3.set(key, await H.still(e, bodySex(), .45, 240, 180));
        el.innerHTML = `<img src="${T3.get(key)}" alt="">`; el.classList.add('on');
        await new Promise(r => setTimeout(r, 0));
      }
    } catch (err) { console.warn('3D-pikkukuvat ei käytössä', err); }
    t3busy = false;
  }
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
      // Suosituimmat ensin: lihasten kärkiliikkeet ja ohjelmien liikkeet
      const POP = new Set([...Object.values(FI.top).flat()]);
      const rank = e => (POP.has(e.id) ? 0 : 1) * 10 + (e.category === 'strength' || e.category === 'powerlifting' ? 0 : e.category === 'stretching' ? 5 : 2);
      DB.sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), 'fi'));
      BY = new Map(DB.map(e => [e.id, e]));
      const eq = [...new Set(DB.map(e => e.equipment).filter(Boolean))].sort((a, b) => eqName(a).localeCompare(eqName(b), 'fi'));
      $('#equip').insertAdjacentHTML('beforeend', eq.map(q => `<option value="${esc(q)}">${esc(eqName(q))}</option>`).join(''));
    } catch (e) {
      $('#count').textContent = 'Liikkeitä ei saatu ladattua. Tarkista nettiyhteys ja avaa sovellus uudelleen.';
      return;
    }
    renderList(); renderWorkout(); renderHistory(); renderHome();
  }

  /* ---------- Lihakset-näkymä ---------- */
  function renderMap() {
    const sex = bodySex();
    $('#map').innerHTML = Muscles.svg('front', { interactive: true, selected: ui.sel, sex }) + Muscles.svg('back', { interactive: true, selected: ui.sel, sex });
    document.querySelectorAll('#sexSeg button').forEach(b => b.classList.toggle('on', b.dataset.sex === sex));
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
      <div class="img">${thumb(e)}${S.favs.includes(e.id) ? '<span class="fav">★</span>' : ''}</div>
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
    hydrate3d($('#list'));
  }

  $('#map').addEventListener('click', ev => {
    const p = ev.target.closest('.m'); if (!p) return;
    const m = p.dataset.m;
    const adding = !ui.sel.has(m);
    adding ? ui.sel.add(m) : ui.sel.delete(m);
    ui.shown = PAGE; renderMap(); renderList();
    if (adding) openMuscle(m);
  });
  // Lihaksen alavalikko: lihaksen parhaat liikkeet, määrä 1–10
  function topFor(m) {
    const ids = (FI.top[m] || []).filter(id => BY.has(id));
    if (ids.length < 10) DB.forEach(e => { if (ids.length < 10 && e.primaryMuscles.includes(m) && !ids.includes(e.id)) ids.push(e.id); });
    return ids;
  }
  function openMuscle(m) {
    if (!DB.length) return;
    const n = Math.min(10, Math.max(1, S.topN || 5)), all = DB.filter(e => e.primaryMuscles.includes(m)).length;
    const card = $('#sheetCard');
    card.innerHTML = `<div class="sheet-top"><h3>${esc(mName(m))}</h3><button class="x" data-close aria-label="Sulje">✕</button></div>
      <div class="pane">
        <div class="stepper"><span>Parhaat liikkeet</span><button data-topn="-1" aria-label="Vähemmän">−</button><b>${n}</b><button data-topn="1" aria-label="Enemmän">+</button></div>
        <ul class="toplist">${topFor(m).slice(0, n).map((id, i) => { const e = BY.get(id); return `<li>
          <button class="tl" data-ex="${esc(id)}"><i>${i + 1}</i><span class="th">${thumb(e)}</span><span class="tn"><b>${esc(nameOf(e))}</b><small>${esc(eqName(e.equipment))}${FI_OHJE[id] ? ' · ' + esc(FI_OHJE[id].short) : ''}</small></span></button>
          <button class="tadd" data-add="${esc(id)}" aria-label="Lisää treeniin">+</button></li>`; }).join('')}</ul>
        <button class="cta alt" data-close>Näytä kaikki ${all} liikettä</button></div>`;
    $('#sheet').hidden = false; hydrate3d(card);
    card.querySelectorAll('[data-topn]').forEach(b => b.addEventListener('click', () => {
      S.topN = Math.min(10, Math.max(1, n + +b.dataset.topn)); save(); openMuscle(m);
    }));
  }
  // Kehon malli: profiilin sukupuoli (tai valinta ilman profiilia)
  function bodySex() { return (S.profile && S.profile.sex) || S.bodySex || 'male'; }
  $('#sexSeg').addEventListener('click', ev => {
    const b = ev.target.closest('[data-sex]'); if (!b) return;
    if (S.profile) S.profile.sex = b.dataset.sex; else S.bodySex = b.dataset.sex;
    save(); renderMap();
  });
  $('#selChips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-unsel],[data-clear]'); if (!b) return;
    b.dataset.clear !== undefined ? ui.sel.clear() : ui.sel.delete(b.dataset.unsel);
    ui.shown = PAGE; renderMap(); renderList();
  });
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
      <div class="anim" id="mqBox"></div>
      <div class="anim-bar"><span>Hahmo näyttää liikkeen suunnan. Vihreä = kohdelihas.</span>${(e.images || []).length ? '<button class="linkbtn2" data-photos>Valokuvat</button>' : ''}</div>
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
          ${quickHow(e)}
          <h4>Kohdelihakset</h4>${Muscles.pair({ primary: e.primaryMuscles, secondary: sec, sex: bodySex() })}
          <div class="tags" style="margin-top:10px">${e.primaryMuscles.map(m => `<span class="tag p">${esc(mName(m))}</span>`).join('')}${sec.map(m => `<span class="tag">${esc(mName(m))}</span>`).join('')}</div>
          <h4>Tiedot</h4><div class="tags"><span class="tag">${esc(eqName(e.equipment))}</span><span class="tag">${esc(FI.level[e.level] || e.level)}</span>${FI.names[e.id] ? `<span class="tag">${esc(e.name)}</span>` : ''}</div>
          ${howTo(e)}`;
        const more = pane.querySelector('[data-more]');
        if (more) more.addEventListener('click', () => { const d = pane.querySelector('.more-box'); d.hidden = !d.hidden; more.textContent = d.hidden ? 'Tarkemmat ohjeet' : 'Piilota tarkemmat ohjeet'; });
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
    play3d($('#mqBox', card), e);
    const ph = card.querySelector('[data-photos]');
    if (ph) ph.addEventListener('click', () => {
      const box = $('#mqBox', card), showing = box.dataset.photos === '1';
      clearInterval(animT);
      if (showing) { box.dataset.photos = ''; ph.textContent = 'Valokuvat'; play3d(box, e); return; }
      Mannequin.stop(); if (H3) H3.stop(); box.dataset.photos = '1'; ph.textContent = 'Hahmo';
      box.innerHTML = (e.images || []).slice(0, 2).map((s, i) => `<img src="${IMG + s}" alt="" style="opacity:${i ? 0 : 1}">`).join('');
      const ims = box.querySelectorAll('img');
      if (ims.length > 1) { let k = 0; animT = setInterval(() => { k ^= 1; ims[0].style.opacity = k ? 0 : 1; ims[1].style.opacity = k ? 1 : 0; }, 1100); }
    });
  }
  // 3D-ihminen (ladataan vasta tarvittaessa); sillä välin ja virhetilanteessa piirretty hahmo
  let H3 = null, heroEx = null;
  // Koti-näkymän elävä 3D-ihminen (sama 3D-piirtäjä kuin liikkeen tiedoissa, joten se pysähtyy lehden ajaksi)
  function heroPlay(e) {
    if (e) heroEx = e;
    const box = $('#today3d');
    if (!box || !heroEx || !window.WebGLRenderingContext || S.anim2d || ui.view !== 'home' || !$('#sheet').hidden) return;
    import('./human3d.js').then(m => { H3 = m; return m.play(box, heroEx, bodySex()); }).catch(() => {});
  }
  function play3d(box, e) {
    Mannequin.play(box, e);
    if (!window.WebGLRenderingContext || S.anim2d) return;
    box.classList.add('loading3d');
    import('./human3d.js').then(m => { H3 = m; return m.play(box, e, bodySex()); })
      .then(() => { Mannequin.stop(); box.classList.remove('loading3d'); })
      .catch(err => { console.warn('3D ei käytössä:', err); box.classList.remove('loading3d'); });
  }
  // Lyhyt ohje heti näkyviin, tarkemmat ohjeet erillisestä painikkeesta
  function quickHow(e) {
    const o = FI_OHJE[e.id];
    return o ? `<div class="how"><b>Näin teet sen</b><p>${esc(o.short)}</p></div>` : '';
  }
  function howTo(e) {
    const o = FI_OHJE[e.id];
    if (o) return `<button class="cta alt more-btn" data-more>Tarkemmat ohjeet</button>
      <div class="more-box" hidden><h4>Suoritus</h4><ol>${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <h4>Vinkit</h4><ul class="tips">${o.tips.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    return `<button class="cta alt more-btn" data-more>Tarkemmat ohjeet</button>
      <div class="more-box" hidden><h4>Suoritus</h4><ol>${(e.instructions || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="note">Tämän liikkeen ohjeet ovat vielä englanniksi. Suomenkieliset ohjeet on tehty 169 yleisimmälle liikkeelle.</p></div>`;
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
  function closeSheet() { $('#sheet').hidden = true; clearInterval(animT); Mannequin.stop(); if (H3) H3.stop(); heroPlay(); }
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
  function addToWorkout(id, opt = {}) {
    if (!S.active) S.active = { start: Date.now(), items: [] };
    if (S.active.items.some(i => i.id === id)) { if (!opt.quiet) toast('Liike on jo treenissä'); return; }
    const prev = lastSets(id);
    const n = opt.sets || Math.max(3, prev.length);
    S.active.items.push({ id, reps: opt.reps || '', sets: Array.from({ length: n }, () => ({ kg: '', reps: '', done: false })) });
    save(); renderWorkout(); renderHome();
    if (!opt.quiet) toast(`Lisätty: ${BY.get(id) ? nameOf(BY.get(id)) : id}`);
  }
  // Valmis ohjelma tai oma pohja: { id, name, items: [{ id, sets, reps }] }
  function startTemplate(t) {
    if (S.active && S.active.items.length) { toast('Treeni on jo käynnissä'); return go('workout'); }
    S.active = { start: Date.now(), items: [], templateId: t.id, name: t.name };
    t.items.forEach(it => addToWorkout(it.id, { sets: it.sets, reps: it.reps, quiet: true }));
    save(); go('workout'); toast(`${t.name}: tsemppiä!`);
  }
  /* ---------- Tavoitetila: nosta painoja joka viikko (progressiivinen ylikuorma) ---------- */
  function progressOn() { return !!(S.goals && S.goals.progress); }
  // Jos viime kerralla kaikki sarjat ylsivät toistoalueen ylärajaan, ehdota lisää painoa; muuten yksi toisto lisää
  function nextLoad(it, prev, e) {
    const top = parseInt(String(it.reps || '').split(/[–-]/).pop(), 10) || 12;
    const lo = parseInt(it.reps, 10) || Math.max(1, top - 4);
    const kg = Math.max(...prev.map(x => +x.kg || 0));
    if (!kg) return null; // oman painon liikkeet: ei painoehdotusta
    const allTop = prev.length && prev.every(x => (+x.reps || 0) >= top);
    const step = e && /dumbbell|kettlebell/.test(e.equipment || '') ? 2 : 2.5;
    if (allTop) return { kg: kg + step, reps: lo, up: true };
    const best = prev.reduce((a, x) => (+x.kg || 0) === kg ? Math.max(a, +x.reps || 0) : a, 0);
    return { kg, reps: Math.min(top, best + 1), up: false };
  }
  // Tämän viikon nousut: liikkeet, joiden paras arvioitu 1RM ylitti aiemman ennätyksen
  function weekGains() {
    const ws = weekStart(Date.now()).getTime(), before = {}, now = {};
    S.history.forEach(w => w.items.forEach(i => i.sets.forEach(x => {
      const v = e1rm(+x.kg || 0, +x.reps || 0), t = w.start < ws ? before : now;
      t[i.id] = Math.max(t[i.id] || 0, v);
    })));
    return Object.keys(now).filter(id => before[id] && now[id] > before[id] + .01);
  }

  /* ---------- Tavoitetila: painonpudotus ---------- */
  function lastWeight() { const l = S.bodyLog[S.bodyLog.length - 1]; return l ? l.kg : (S.profile && S.profile.weightKg) || null; }
  // Suuntaa-antava energiantarve (Mifflin–St Jeor), vaatii pituuden, painon ja iän
  function kcalTarget() {
    const P = S.profile || {}, w = lastWeight(), g = S.goals && S.goals.weightLoss;
    if (!g || !w || !P.heightCm || !P.birthYear) return null;
    const age = new Date().getFullYear() - P.birthYear;
    const bmr = 10 * w + 6.25 * P.heightCm - 5 * age + (P.sex === 'female' ? -161 : 5);
    const tdee = bmr * Math.min(1.9, 1.3 + .05 * (+P.daysPerWeek || 3));
    const kcal = tdee - (+g.pace || .5) * 7700 / 7;
    const floor = P.sex === 'female' ? 1200 : 1500;
    return { kcal: Math.round(Math.max(floor, kcal) / 10) * 10, floored: kcal < floor };
  }
  function weightCard() {
    const g = S.goals && S.goals.weightLoss; if (!g) return '';
    const w = lastWeight(), start = (S.bodyLog[0] && S.bodyLog[0].kg) || w, tgt = +g.targetKg || null;
    const pct = w && tgt && start > tgt ? Math.max(0, Math.min(1, (start - w) / (start - tgt))) : 0;
    const left = w && tgt ? Math.max(0, w - tgt) : null, weeks = left ? Math.ceil(left / (+g.pace || .5)) : null;
    const pts = S.bodyLog.slice(-12).map(x => x.kg), k = kcalTarget();
    let spark = '';
    if (pts.length > 1) {
      const lo = Math.min(...pts, tgt || Infinity), hi = Math.max(...pts), sp = hi - lo || 1;
      spark = `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts.map((v, i) => `${i * 100 / (pts.length - 1)},${28 - (v - lo) / sp * 26}`).join(' ')}"/></svg>`;
    }
    return `<div class="goalcard">
      <div class="gc-h"><b>Painonpudotus</b><button class="mini" data-weigh>+ Punnitse</button></div>
      <div class="gc-row"><span class="big">${w ? fmt(w) + ' kg' : '–'}</span><span>tavoite ${tgt ? fmt(tgt) + ' kg' : '–'}</span></div>
      <div class="bar"><i style="width:${Math.round(pct * 100)}%"></i></div>
      ${spark}
      <p class="gc-note">${left === 0 ? 'Tavoitepaino saavutettu!' : weeks ? `Tahdilla ${fmt(+g.pace || .5)} kg/vk noin ${weeks} viikkoa jäljellä.` : 'Lisää paino ja tavoite profiiliin.'}
      ${k ? ` Energia noin <b>${k.kcal} kcal/päivä</b>${k.floored ? ' (alaraja)' : ''}.` : (S.profile && !S.profile.birthYear ? ' Lisää syntymävuosi profiiliin, niin saat kaloriarvion.' : '')}</p></div>`;
  }
  function progressCard() {
    if (!progressOn()) return '';
    const g = weekGains();
    return `<div class="goalcard"><div class="gc-h"><b>Nosta painoja joka viikko</b><span class="pill2">${g.length ? '↑ ' + g.length : '0'}</span></div>
      <p class="gc-note">${g.length ? `Tällä viikolla ennätys nousi ${g.length} liikkeessä: ${g.slice(0, 3).map(id => esc(BY.get(id) ? nameOf(BY.get(id)) : id)).join(', ')}.` : 'Treenissä ↑-merkki näyttää, missä kannattaa lisätä painoa tänään.'}</p></div>`;
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
      <div class="wo-head"><h2>${esc(S.active.name || 'Treeni')}</h2><span id="elapsed"></span></div>
      <div class="rest-row">Lepoaika sarjojen välissä
        <select id="restSel">${[0, 30, 60, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === S.rest ? 'selected' : ''}>${s ? (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : s + ' s') : 'Ei ajastinta'}</option>`).join('')}</select></div>
      ${S.active.items.map((it, xi) => {
        const e = BY.get(it.id); const prev = lastSets(it.id);
        return `<div class="ex" data-xi="${xi}">
          <div class="ex-h"><span class="th">${thumb(e)}</span><div class="nm" data-ex="${esc(it.id)}">${esc(e ? nameOf(e) : it.id)}${it.reps ? `<small>Tavoite ${it.sets.length} × ${esc(it.reps)}</small>` : ''}</div><button data-rmex="${xi}" aria-label="Poista liike">✕</button></div>
          <table class="sets"><thead><tr><th>Sarja</th><th>Edellinen</th><th>kg</th><th>Toistot</th><th>✓</th></tr></thead><tbody>
          ${it.sets.map((s, si) => {
            const p = prev[si];
            const b = it.sets[si - 1];
            let ph = p || (b && b.reps ? b : null) || (it.reps ? { kg: null, reps: parseInt(it.reps, 10) } : null); // ehdotus: viime kerta, edellinen sarja tai tavoite
            const up = p && progressOn() ? nextLoad(it, prev, e) : null; // tavoitetila: nosta painoja
            if (up) ph = up;
            return `<tr class="${s.done ? 'done' : ''}" data-si="${si}">
              <td class="n">${si + 1}</td>
              <td class="prev">${p ? `${fmt(+p.kg || 0)}×${+p.reps || 0}` : '–'}${up && up.up ? '<em class="upb">↑</em>' : ''}</td>
              <td><input inputmode="decimal" data-f="kg" value="${esc(s.kg)}" placeholder="${ph && ph.kg != null ? fmt(+ph.kg || 0) : 'kg'}"></td>
              <td><input inputmode="numeric" data-f="reps" value="${esc(s.reps)}" placeholder="${ph ? +ph.reps || 0 : '0'}"></td>
              <td><button class="ok" data-ok>✓</button></td></tr>`;
          }).join('')}
          </tbody></table>
          <button class="addset" data-addset="${xi}">+ Lisää sarja</button></div>`;
      }).join('')}
      <button class="cta alt" data-go="muscles">+ Lisää liike</button>
      <button class="cta alt" id="saveTpl">Tallenna pohjaksi</button>
      <button class="cta" id="finish">${finishArmed ? 'Vahvista: tallenna ja lopeta' : 'Lopeta treeni'}</button>
      <button class="cta alt" id="discard" style="color:var(--danger)">Hylkää treeni</button>`;
    tickElapsed();
    hydrate3d(box);
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
      if (items.length) { S.history.push({ start: S.active.start, end: Date.now(), templateId: S.active.templateId || null, name: S.active.name || null, items }); toast('Treeni tallennettu 💪'); }
      else toast('Ei tehtyjä sarjoja, treeniä ei tallennettu');
      S.active = null; stopRest(); save(); renderWorkout(); renderHistory(); renderHome(); go('home'); return;
    }
    if (t.id === 'saveTpl') {
      const name = (prompt('Pohjan nimi', S.active.name || 'Oma treeni') || '').trim(); if (!name) return;
      S.templates.push({ id: 'own-' + Date.now(), name, items: S.active.items.map(i => ({ id: i.id, sets: i.sets.length, reps: i.reps || '' })) });
      save(); renderHome(); toast(`Pohja tallennettu: ${name}`); return;
    }
    if (t.id === 'discard') {
      if (t.dataset.armed) { S.active = null; stopRest(); save(); renderWorkout(); renderHome(); toast('Treeni hylätty'); return; }
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
        ${w.name ? `<div class="wn">${esc(w.name)}</div>` : ''}<ul>${w.items.map(i => `<li>${esc(BY.get(i.id) ? nameOf(BY.get(i.id)) : i.id)}: ${i.sets.map(s => `${fmt(s.kg)}×${s.reps}`).join(', ')}</li>`).join('')}</ul></div>`).join('')}`;
  }

  /* ---------- Viikot ja putki ---------- */
  const DAY = 864e5;
  function weekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
  function weekCount(d) { const a = d.getTime(), e = new Date(d); e.setDate(e.getDate() + 7); return S.history.filter(w => w.start >= a && w.start < e.getTime()).length; }
  function streak(target) {
    const w = weekStart(Date.now()); let n = 0;
    if (weekCount(w) >= target) n++;
    for (;;) { w.setDate(w.getDate() - 7); if (weekCount(w) >= target) n++; else break; }
    return n;
  }
  function program() { return S.profile ? Programs.forProfile(S.profile) : null; }

  /* ---------- Koti ---------- */
  function ring(done, target) {
    const r = 34, c = 2 * Math.PI * r, f = Math.min(1, done / target);
    return `<svg class="ring" viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" class="bg"/>
      <circle cx="42" cy="42" r="${r}" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/>
      <text x="42" y="47">${done}/${target}</text></svg>`;
  }
  function tplCard(t, sub) {
    return `<div class="plan">
      <div class="plan-h"><div><h3>${esc(t.name)}</h3>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>
      <ul>${t.items.map(i => { const e = BY.get(i.id); return `<li data-ex="${esc(i.id)}"><span class="th">${thumb(e)}</span><span>${esc(e ? nameOf(e) : (FI.names[i.id] || i.id))}</span><b>${i.sets} × ${esc(i.reps || '–')}</b></li>`; }).join('')}</ul>
      <button class="cta" data-start="${esc(t.id)}">Aloita treeni</button></div>`;
  }
  function findTpl(id) {
    const p = program();
    return (p && p.sessions.find(s => s.id === id)) || S.templates.find(t => t.id === id);
  }
  function renderHome() {
    const box = $('#home'); if (!box) return;
    if (!S.profile) { box.innerHTML = '<div class="empty"><h2>Tervetuloa</h2><p>Luo profiili, niin saat oman treeniohjelman.</p><button class="cta" id="obOpen">Aloita</button></div>'; return; }
    const P = S.profile, prog = program(), g = Programs.GOALS[P.goal] || Programs.GOALS.muscle;
    const target = +P.daysPerWeek || 3, ws = weekStart(Date.now()), done = weekCount(ws), st = streak(target);
    const now = new Date(), h = now.getHours();
    const hello = h < 5 ? 'Hyvää yötä' : h < 10 ? 'Huomenta' : h < 17 ? 'Hei' : 'Iltaa';
    const days = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'].map((n, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i); const a = d.getTime();
      const has = S.history.some(w => w.start >= a && w.start < a + DAY);
      const today = d.toDateString() === now.toDateString();
      return `<span class="${has ? 'on' : ''} ${today ? 'is-today' : ''}">${n}</span>`;
    }).join('');
    const nxt = (ui.pick && findTpl(ui.pick)) || Programs.next(prog, S.history);
    const last = S.history[S.history.length - 1];
    const left = Math.max(0, target - done);
    const msg = done >= target ? 'Viikon tavoite täynnä. Hienoa!' : done ? `Vielä ${left} ${left === 1 ? 'treeni' : 'treeniä'} tavoitteeseen.` : 'Uusi viikko, uudet treenit.';
    const needBackup = S.history.length >= 5 && Date.now() - (S.lastBackup || 0) > 30 * DAY;
    const mins = Math.round(nxt.items.reduce((a, i) => a + (+i.sets || 3), 0) * 2.5 / 5) * 5;
    const own = nxt.id.startsWith('own-');
    box.innerHTML = `
      <div class="hello"><p>${now.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'numeric' })}</p><h2>${hello}, ${esc(P.name)}!</h2></div>
      ${S.active ? `<button class="banner" data-go="workout"><b>Treeni käynnissä</b><span>${esc(S.active.name || 'Oma treeni')} · ${S.active.items.length} liikettä</span><i>Jatka →</i></button>` : ''}
      <div class="today">
        <div class="today-3d" id="today3d" aria-hidden="true"></div>
        <p class="today-k">Tänään</p>
        <h3>${esc(nxt.name)}</h3>
        <p class="today-m">${nxt.items.length} liikettä · noin ${mins} min${own ? ' · oma pohja' : ` · ${esc(g.name.toLowerCase())}`}</p>
        <button class="go-btn" data-start="${esc(nxt.id)}">Aloita treeni</button>
        <div class="today-l"><button data-toggle="list">${ui.showList ? 'Piilota liikkeet' : 'Näytä liikkeet'}</button><button data-toggle="pick">${ui.showPick ? 'Sulje' : 'Vaihda treeni'}</button></div>
        ${ui.showPick ? `<div class="chips picks">${prog.sessions.map(s => `<button class="chip ${s.id === nxt.id ? '' : 'ghost'}" data-pick="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
          ${S.templates.map(t => `<button class="chip ${t.id === nxt.id ? '' : 'ghost'}" data-pick="${esc(t.id)}">★ ${esc(t.name)}</button>`).join('')}</div>
          ${own ? `<button class="linkbtn" data-deltpl="${esc(nxt.id)}">Poista pohja</button>` : ''}` : ''}
        ${ui.showList ? `<ul class="today-ul">${nxt.items.map(i => { const e = BY.get(i.id); return `<li data-ex="${esc(i.id)}"><span class="th">${thumb(e)}</span><span>${esc(e ? nameOf(e) : (FI.names[i.id] || i.id))}</span><b>${i.sets} × ${esc(i.reps || '–')}</b></li>`; }).join('')}</ul>` : ''}
      </div>
      <div class="week">
        ${ring(done, target)}
        <div class="week-t"><h3>${done >= target ? 'Viikon tavoite täynnä!' : `${done}/${target} tällä viikolla`}</h3><p>${st ? `🔥 ${st} viikon putki` : msg}</p><div class="days">${days}</div></div>
      </div>
      ${weightCard()}${progressCard()}
      ${needBackup ? '<button class="banner warn" data-backup><b>Ota varmuuskopio</b><span>Tiedot ovat vain tässä puhelimessa.</span><i>Vie →</i></button>' : ''}
      <div class="quick">
        <button data-go="muscles"><svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2.5"/><path d="M6 9h12M12 9v6m0 0-3 6m3-6 3 6"/></svg>Etsi liike</button>
        <button data-go="history"><svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-6"/></svg>Kehitys</button>
      </div>
      ${last ? `<p class="lastline">Viimeksi ${date(last.start)}: <b>${esc(last.name || last.items.map(i => BY.get(i.id) ? nameOf(BY.get(i.id)) : i.id).slice(0, 2).join(', '))}</b></p>` : ''}`;
    hydrate3d(box);
    heroPlay(nxt.items[0] && BY.get(nxt.items[0].id));
  }
  $('#home').addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('#obOpen')) return openOnboard();
    if (t.closest('[data-go]')) return go(t.closest('[data-go]').dataset.go);
    if (t.closest('[data-backup]')) return exportData();
    if (t.closest('[data-weigh]')) {
      const v = parseFloat(String(prompt('Paino tänään (kg)', lastWeight() ? fmt(lastWeight()) : '') || '').replace(',', '.'));
      if (v > 20 && v < 400) { S.bodyLog.push({ ts: Date.now(), kg: v }); if (S.profile) S.profile.weightKg = v; save(); renderHome(); toast('Paino kirjattu'); }
      return;
    }
    const tg = t.closest('[data-toggle]'); if (tg) { const k = tg.dataset.toggle === 'list' ? 'showList' : 'showPick'; ui[k] = !ui[k]; return renderHome(); }
    const pk = t.closest('[data-pick]'); if (pk) { ui.pick = pk.dataset.pick; ui.showPick = false; return renderHome(); }
    const sb = t.closest('[data-start]'); if (sb) { const tp = findTpl(sb.dataset.start); if (tp) startTemplate(tp); return; }
    const dl = t.closest('[data-deltpl]');
    if (dl) {
      if (!dl.dataset.armed) { dl.dataset.armed = '1'; dl.textContent = 'Vahvista: poista pohja'; return; }
      S.templates = S.templates.filter(x => x.id !== dl.dataset.deltpl); ui.pick = null; save(); renderHome(); toast('Pohja poistettu');
    }
  });

  /* ---------- Profiili ---------- */
  function renderAvatar() {
    const b = $('#profileBtn'); b.textContent = S.profile ? (S.profile.name || '?').trim().charAt(0).toUpperCase() : '?';
  }
  const opts = (name, map, val) => Object.entries(map).map(([k, v]) =>
    `<label class="opt"><input type="radio" name="${name}" value="${esc(k)}" ${String(val) === String(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('');
  function profileForm(p, submit) {
    p = p || {};
    const goals = Object.fromEntries(Object.entries(Programs.GOALS).map(([k, v]) => [k, v.name]));
    return `<form class="pform" id="pform" autocomplete="off">
      <label class="fld"><span>Nimi</span><input name="name" required maxlength="30" value="${esc(p.name || '')}" placeholder="Etunimi"></label>
      <fieldset><legend>Kehon malli</legend><div class="opts">${opts('sex', { male: 'Mies', female: 'Nainen' }, p.sex || S.bodySex || 'male')}</div></fieldset>
      <fieldset><legend>Tavoite</legend><div class="opts">${opts('goal', goals, p.goal || 'muscle')}</div></fieldset>
      <fieldset><legend>Kokemus</legend><div class="opts">${opts('level', Programs.LEVELS, p.level || 'beginner')}</div></fieldset>
      <fieldset><legend>Treenejä viikossa</legend><div class="opts">${opts('daysPerWeek', Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, String(i + 1)])), p.daysPerWeek || 3)}</div></fieldset>
      <fieldset><legend>Missä treenaat</legend><div class="opts">${opts('equipment', Programs.EQUIP, p.equipment || 'gym')}</div></fieldset>
      <fieldset><legend>Teema</legend><div class="opts">${opts('theme', { auto: 'Automaattinen', light: 'Vaalea', dark: 'Tumma', black: 'Musta' }, S.theme || 'auto')}</div></fieldset>
      <div class="two">
        <label class="fld"><span>Pituus (cm) <i>vapaaehtoinen</i></span><input name="heightCm" inputmode="numeric" value="${esc(p.heightCm || '')}"></label>
        <label class="fld"><span>Paino (kg) <i>vapaaehtoinen</i></span><input name="weightKg" inputmode="decimal" value="${esc(p.weightKg || '')}"></label>
      </div>
      <label class="fld"><span>Syntymävuosi <i>vapaaehtoinen, kaloriarviota varten</i></span><input name="birthYear" inputmode="numeric" maxlength="4" value="${esc(p.birthYear || '')}"></label>
      <fieldset><legend>Tavoitetilat <i class="lg-i">kytke päälle tarvittaessa</i></legend>
        <label class="sw"><input type="checkbox" name="gProgress" ${S.goals && S.goals.progress ? 'checked' : ''}><span></span><b>Nosta painoja joka viikko</b><small>Sovellus ehdottaa lisää painoa, kun olet tehnyt kaikki toistot.</small></label>
        <label class="sw"><input type="checkbox" name="gLoss" ${S.goals && S.goals.weightLoss ? 'checked' : ''}><span></span><b>Painonpudotus</b><small>Painon seuranta, tavoite ja suuntaa-antava kaloriarvio.</small></label>
        <div class="two loss-f">
          <label class="fld"><span>Tavoitepaino (kg)</span><input name="targetKg" inputmode="decimal" value="${esc((S.goals && S.goals.weightLoss && S.goals.weightLoss.targetKg) || '')}"></label>
          <label class="fld"><span>Tahti</span><select name="pace">${[.25, .5, .75].map(v => `<option value="${v}" ${((S.goals && S.goals.weightLoss && +S.goals.weightLoss.pace) || .5) === v ? 'selected' : ''}>${fmt(v)} kg / viikko</option>`).join('')}</select></label>
        </div></fieldset>
      <p class="note">Tiedot tallentuvat vain tähän laitteeseen. Ohjelma muodostetaan tavoitteen, kokemuksen, treenipäivien ja välineiden mukaan.</p>
      <button class="cta" type="submit">${submit}</button></form>`;
  }
  function readForm(f) {
    const d = new FormData(f), num = k => { const v = parseFloat(String(d.get(k) || '').replace(',', '.')); return v > 0 ? v : null; };
    const old = S.profile || {};
    const p = { v: 1, name: String(d.get('name') || '').trim(), sex: d.get('sex') || 'male', goal: d.get('goal'), level: d.get('level'), daysPerWeek: +d.get('daysPerWeek'),
      equipment: d.get('equipment'), heightCm: num('heightCm'), weightKg: num('weightKg'), birthYear: (n => n > 1900 && n < 2020 ? n : null)(+d.get('birthYear')), created: old.created || Date.now(), updated: Date.now() };
    if (p.weightKg && p.weightKg !== old.weightKg) S.bodyLog.push({ ts: Date.now(), kg: p.weightKg });
    S.theme = d.get('theme') || 'auto'; applyTheme();
    S.goals = { progress: !!d.get('gProgress'), weightLoss: d.get('gLoss') ? { targetKg: num('targetKg'), pace: +d.get('pace') || .5 } : null };
    if (p.goal !== old.goal) S.rest = (Programs.GOALS[p.goal] || {}).rest || S.rest;
    S.profile = p; ui.pick = null; save(); renderAvatar(); renderHome(); renderMap();
  }
  function openOnboard() {
    const o = $('#onboard');
    o.innerHTML = `<div class="ob-in"><h1 class="brand">TREENI<span>.</span></h1>
      <h2>Tehdään sinulle ohjelma</h2><p class="lead">Kerro vähän itsestäsi. Voit muuttaa näitä myöhemmin profiilista.</p>
      ${profileForm(S.profile, 'Valmis, aloitetaan')}</div>`;
    o.hidden = false;
    $('#pform', o).addEventListener('submit', ev => { ev.preventDefault(); readForm(ev.target); o.hidden = true; go('home'); toast('Profiili tallennettu'); });
  }
  function openProfile() {
    if (!S.profile) return openOnboard();
    const card = $('#sheetCard');
    card.innerHTML = `<div class="sheet-top"><h3>Profiili</h3><button class="x" data-close aria-label="Sulje">✕</button></div>
      <div class="pane">${profileForm(S.profile, 'Tallenna')}
        <h4>Varmuuskopio</h4>
        <p class="note">Tiedot ovat vain tässä laitteessa. Vie ne tiedostoksi säännöllisesti ja aina ennen puhelimen vaihtoa.${S.lastBackup ? ` Viimeksi ${date(S.lastBackup)}.` : ''}</p>
        <div class="two"><button class="cta alt" type="button" data-export>Vie tiedot</button><button class="cta alt" type="button" data-import>Tuo tiedot</button></div>
        <p class="note">TREENI ${VERSION} · liikkeet: free-exercise-db</p></div>`;
    $('#sheet').hidden = false;
    $('#pform', card).addEventListener('submit', ev => { ev.preventDefault(); readForm(ev.target); closeSheet(); toast('Profiili päivitetty'); });
    card.querySelector('[data-export]').addEventListener('click', exportData);
    card.querySelector('[data-import]').addEventListener('click', () => $('#importFile').click());
  }
  $('#profileBtn').addEventListener('click', openProfile);

  /* ---------- Varmuuskopio ---------- */
  function exportData() {
    const name = `treeni-varmuuskopio-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify({ app: 'treeni', schema: 2, exported: new Date().toISOString(), state: S }, null, 1)], { type: 'application/json' });
    const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
    const done = () => { S.lastBackup = Date.now(); save(); renderHome(); };
    if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Treeni-varmuuskopio' }).then(done).catch(() => {});
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      done(); toast('Varmuuskopio ladattu');
    }
  }
  $('#importFile').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text()), st = d && d.state;
      if (!st || !Array.isArray(st.history)) throw new Error('muoto');
      if (!confirm(`Korvataanko nykyiset tiedot varmuuskopiolla? Siinä on ${st.history.length} treeniä${st.profile ? ` (${st.profile.name})` : ''}.`)) return;
      S = Object.assign({ schema: 2, active: null, history: [], rest: 90, favs: [], profile: null, bodyLog: [], templates: [], lastBackup: 0 }, st);
      save(); closeSheet(); renderAvatar(); renderWorkout(); renderHistory(); renderHome(); renderList(); go('home');
      toast('Tiedot palautettu');
      if (!S.profile) openOnboard();
    } catch (e) { toast('Tiedostoa ei voitu lukea'); }
  });

  /* ---------- Teema ---------- */
  function applyTheme() {
    const t = S.theme || 'auto', r = document.documentElement;
    if (t === 'auto') delete r.dataset.theme; else r.dataset.theme = t;
    const dark = t === 'black' || t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'black' ? '#000000' : dark ? '#11130E' : '#5A7608');
  }
  applyTheme();

  /* ---------- Navigointi ---------- */
  function go(v) {
    ui.view = v;
    document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'workout') renderWorkout();
    if (v === 'history') renderHistory();
    if (v === 'home') renderHome(); else if (H3 && $('#sheet').hidden) H3.stop();
    window.scrollTo(0, 0);
    setTimeout(() => hydrate3d($('#view-' + v)), 30);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

  /* ---------- Käynnistys ---------- */
  // Linkillä voi esivalita lihakset, esim. #m=chest,shoulders
  const hm = /m=([^&]+)/.exec(location.hash);
  if (hm) decodeURIComponent(hm[1]).split(',').filter(m => Muscles.NAMES[m]).forEach(m => ui.sel.add(m));
  renderMap(); renderWorkout(); renderHistory(); renderHome(); renderAvatar(); loadDB();
  if (!S.profile) openOnboard();
  // Avausefekti pois animaation jälkeen
  document.body.classList.add('opening');
  setTimeout(() => { const sp = $('#splash'); if (sp) sp.remove(); document.body.classList.remove('opening'); }, 2000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
