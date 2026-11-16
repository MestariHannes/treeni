/* Lihaskartta v2: piirretty itse, ei kolmannen osapuolen kuvia.
   Lihasnimet vastaavat free-exercise-db:n primaryMuscles-arvoja.
   Kaikki muodot piirretään vasemmalle puolelle (x < 100) ja peilataan. Naisen malli tehdään
   samasta piirroksesta korkeuden mukaan muuttuvalla leveyskertoimella (warp) ja omilla muodoilla. */
(function () {
  const MUSCLES = {
    chest: 'Rinta', shoulders: 'Olkapäät', biceps: 'Hauis', triceps: 'Ojentajat',
    forearms: 'Kyynärvarret', abdominals: 'Vatsa', quadriceps: 'Etureidet',
    hamstrings: 'Takareidet', glutes: 'Pakarat', calves: 'Pohkeet',
    lats: 'Leveä selkä', 'middle back': 'Keskiselkä', 'lower back': 'Alaselkä',
    traps: 'Epäkkäät', adductors: 'Lähentäjät', abductors: 'Loitontajat', neck: 'Niska'
  };

  // Naisen leveyskerroin korkeuden (y) mukaan: kapeammat hartiat ja vyötärö, leveämmät lantiot
  const FEMALE_K = [[0, .93], [56, .9], [78, .87], [120, .88], [168, .84], [196, .98], [226, 1.05], [262, 1.02], [300, .96], [420, .94]];
  function kAt(y) {
    for (let i = 1; i < FEMALE_K.length; i++) {
      const [y1, k1] = FEMALE_K[i - 1], [y2, k2] = FEMALE_K[i];
      if (y <= y2) return k1 + (k2 - k1) * Math.max(0, (y - y1) / (y2 - y1));
    }
    return FEMALE_K[FEMALE_K.length - 1][1];
  }
  // Muuntaa absoluuttisen polun (M L C Q Z) koordinaatit
  function warp(d, sex) {
    if (sex !== 'female') return d;
    const t = d.match(/[MLCQZ]|-?\d*\.?\d+/g); let out = '', nums = [];
    const flush = () => { for (let i = 0; i + 1 < nums.length; i += 2) { const x = nums[i], y = nums[i + 1]; out += ` ${(100 + (x - 100) * kAt(y)).toFixed(1)} ${y}`; } nums = []; };
    t.forEach(s => { if (/[A-Z]/.test(s)) { flush(); out += ' ' + s; } else nums.push(+s); });
    flush(); return out.trim();
  }

  /* ---------- Siluetti (vasen puoli) ---------- */
  const BODY = 'M100 52 L92 53 C91 61 89 67 85 70 C76 74 63 74 55 78 C45 82 40 92 40 104 C38 120 36 136 36 152 ' +
    'C34 166 30 184 28 204 C27 214 25 222 23 230 C21 238 23 247 28 249 C32 249 34 241 35 233 C37 222 39 214 41 206 ' +
    'C45 190 48 174 50 160 C52 146 55 130 58 118 C60 113 62 111 64 112 C66 132 68 152 70 168 C70 180 66 192 66 204 ' +
    'C64 230 64 262 68 292 C69 302 68 312 68 322 C66 342 68 362 72 380 C72 388 68 396 70 402 C76 407 86 407 90 402 ' +
    'C92 394 90 386 90 380 C92 360 94 340 92 320 C92 310 94 302 95 296 C98 270 100 240 100 222 Z';
  const HEAD = 'M100 8 C89 8 84 17 84 30 C84 37 85 43 88 48 C91 53 95 56 100 56 Z';
  const EAR = 'M85 28 C82 28 81 32 82 36 C83 39 85 39 86 38 Z';
  const HAIR = {
    male: { front: 'M100 7 C88 7 83 15 83 27 C85 22 88 17 92 16 C96 18 98 18 100 17 Z',
            back: 'M100 7 C88 7 83 15 83 28 C83 38 85 44 88 47 C92 46 96 46 100 46 Z' },
    female: { front: 'M100 5 C86 5 79 15 80 30 C80 44 79 56 76 66 C74 72 72 76 69 80 C76 82 84 80 88 74 C86 64 85 48 86 34 C88 24 93 18 100 17 Z',
              back: 'M100 5 C86 5 80 16 81 32 C81 48 79 64 77 78 C84 82 92 82 100 81 Z' }
  };

  /* ---------- Lihakset (vasen puoli, peilataan) ---------- */
  const rr = (x, y, w, h, r) => `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
  const FOREARM = 'M45 160 C40 164 36 176 33 190 C31 200 29 210 28 218 C31 222 35 222 38 218 C41 206 45 192 48 180 C50 172 51 166 49 162 C48 160 46 159 45 160 Z';
  const FRONT = [
    ['neck', 'M92 54 C94 60 96 66 98 71 L95 72 C93 66 91 60 90 56 Z'],
    ['traps', 'M90 60 C88 66 84 70 72 74 C82 76 90 75 95 72 C93 68 91 64 90 60 Z'],
    ['shoulders', 'M60 77 C50 79 42 86 40 100 C40 108 42 114 46 120 C50 116 54 108 58 100 C61 94 64 88 67 84 C66 80 63 78 60 77 Z'],
    ['chest', 'M98 79 C88 76 76 78 68 84 C63 90 60 100 59 110 C61 118 67 124 77 126 C87 128 94 126 98 124 Z', 'male'],
    ['chest', 'M98 81 C88 79 76 81 68 86 C62 94 59 106 60 116 C63 128 72 136 84 136 C92 135 96 130 98 124 Z', 'female'],
    ['biceps', 'M50 113 C44 119 40 132 40 146 C40 154 43 160 47 162 C51 160 54 152 56 142 C58 132 58 122 56 116 C54 112 52 111 50 113 Z'],
    ['forearms', FOREARM],
    ['lats', 'M62 114 C63 128 65 142 68 154 C70 146 71 136 71 128 C69 120 66 116 62 114 Z'],
    ['abdominals', 'M72 132 C72 150 73 166 74 180 C76 190 79 196 84 200 L84 138 C80 134 76 132 72 132 Z'],
    ['abdominals', rr(87, 128, 11, 17, 4)], ['abdominals', rr(87, 148, 11, 17, 4)], ['abdominals', rr(87, 168, 11, 18, 4)],
    ['abdominals', 'M87 189 L98 189 L98 214 C94 212 90 206 87 198 Z'],
    ['abductors', 'M68 198 C66 206 66 212 67 218 C71 214 76 208 79 204 C75 200 71 198 68 198 Z'],
    ['quadriceps', 'M67 216 C64 238 64 262 68 286 C70 292 74 296 78 294 C79 270 79 244 78 222 C74 216 70 214 67 216 Z'],
    ['quadriceps', 'M80 208 C76 228 76 256 80 284 C82 290 86 292 90 288 C92 262 92 234 90 214 C88 208 83 206 80 208 Z'],
    ['quadriceps', 'M92 258 C89 270 89 282 91 294 C94 298 98 294 98 286 C99 276 97 264 92 258 Z'],
    ['adductors', 'M91 216 C90 228 90 242 92 254 C96 246 99 236 99 224 C98 219 95 216 91 216 Z'],
    ['calves', 'M69 322 C66 336 66 352 70 368 C73 360 75 346 75 330 C74 324 71 320 69 322 Z'],
    ['calves', 'M88 320 C92 334 93 350 89 368 C86 354 84 338 85 324 C86 320 87 319 88 320 Z']
  ];
  // Säären etuosa (ei omaa lihasryhmää liikepankissa): piirretään koristeeksi
  const DECO = { front: ['M77 322 C75 340 76 358 80 376 C82 360 83 340 82 324 C81 320 78 320 77 322 Z'], back: [] };
  const BACK = [
    ['traps', 'M100 54 C95 62 88 68 70 75 C80 80 88 86 92 96 C96 110 99 126 100 144 Z'],
    ['shoulders', 'M58 77 C48 79 41 88 40 102 C41 110 43 116 46 120 C51 112 57 102 64 94 C68 88 70 82 66 78 C64 77 61 76 58 77 Z'],
    ['middle back', 'M72 90 C65 96 62 106 64 116 C70 124 80 128 91 128 C93 116 93 104 90 95 C86 90 79 88 72 90 Z'],
    ['lats', 'M63 120 C63 136 66 152 71 166 C78 176 88 181 100 183 L100 150 C96 143 93 137 92 132 C82 132 70 128 63 120 Z'],
    ['lower back', 'M86 180 C86 190 87 199 89 207 L100 207 L100 186 C95 186 90 184 86 180 Z'],
    ['triceps', 'M50 114 C43 122 39 136 40 150 C42 158 46 162 50 162 C54 156 57 146 58 134 C58 124 56 116 53 113 C52 112 51 113 50 114 Z'],
    ['forearms', FOREARM],
    ['glutes', 'M69 206 C65 220 67 236 75 246 C83 252 94 252 100 248 L100 211 C92 204 80 202 69 206 Z'],
    ['abductors', 'M67 199 C69 195 77 194 87 198 C81 202 73 205 67 208 Z'],
    ['hamstrings', 'M67 252 C64 270 66 286 72 298 C77 292 80 278 81 258 C77 253 71 251 67 252 Z'],
    ['hamstrings', 'M83 256 C81 274 83 288 88 298 C94 296 97 290 97 280 C97 268 96 258 94 252 C90 254 86 256 83 256 Z'],
    ['calves', 'M69 316 C65 332 67 348 73 360 C78 354 81 340 81 322 C77 315 72 314 69 316 Z'],
    ['calves', 'M83 318 C82 336 84 352 89 362 C93 354 94 340 93 324 C91 318 86 316 83 318 Z'],
    ['calves', 'M73 358 C75 369 78 378 83 384 C87 378 90 368 90 359 C86 363 82 365 78 363 C76 361 74 360 73 358 Z']
  ];
  // Koristeviivat (ei napautettavia): solisluu, polvet, lapaluut
  const LINES = {
    front: ['M97 75 C88 74 74 75 62 80', 'M73 299 C79 305 88 305 94 299', 'M72 312 C78 316 86 316 92 312'],
    back: ['M74 300 C80 304 88 304 94 300', 'M100 150 L100 206']
  };

  // Lihassäikeiden suunta (asteina) lihaksittain; vasen puoli, peilautuu automaattisesti
  const FIB = {
    front: { neck: 25, traps: 60, shoulders: 8, chest: -22, biceps: 4, forearms: 14, lats: 20, abdominals: 0, abductors: 20, quadriceps: 6, adductors: -18, calves: 2 },
    back: { traps: -38, shoulders: -8, 'middle back': 65, lats: -48, 'lower back': 0, triceps: 2, forearms: 14, glutes: -42, abductors: 70, hamstrings: 2, calves: 2 }
  };
  function cls(m, o) {
    if (o.selected && o.selected.has(m)) return 'm sel';
    if (o.primary && o.primary.includes(m)) return 'm pri';
    if (o.secondary && o.secondary.includes(m)) return 'm sec';
    return 'm';
  }
  let uid = 0;
  function figure(side, o) {
    const sex = o.sex === 'female' ? 'female' : 'male', w = d => warp(d, sex), id = 'sh' + (++uid);
    const list = (side === 'front' ? FRONT : BACK).filter(x => !x[2] || x[2] === sex);
    const mus = list.map(([m, d]) => `<path class="${cls(m, o)}" data-m="${m}" d="${w(d)}"><title>${MUSCLES[m]}</title></path>`).join('');
    const shade = list.map(([, d]) => `<path d="${w(d)}"/>`).join('');
    const angs = [...new Set(list.map(([m]) => FIB[side][m] || 0))];
    const fib = list.map(([m, d]) => `<path d="${w(d)}" fill="url(#${id}f${angs.indexOf(FIB[side][m] || 0)})"/>`).join('');
    const lines = LINES[side].map(d => `<path d="${w(d)}"/>`).join('');
    const deco = DECO[side].map(d => `<path class="dec" d="${w(d)}"/>`).join('');
    const hair = `<path class="hair" d="${w(HAIR[sex][side])}"/>`;
    const half = `<path class="sil" d="${w(BODY)}"/><path class="sil" d="${w(HEAD)}"/>${side === 'front' ? `<path class="sil ear" d="${w(EAR)}"/>` : ''}${hair}` +
      `${deco}${mus}<g class="fib">${fib}</g><g class="shade" fill="url(#${id})">${shade}</g><g class="ln">${lines}</g>`;
    const defs = `<defs><radialGradient id="${id}" cx=".38" cy=".3" r=".85">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
      ${angs.map((a, i) => `<pattern id="${id}f${i}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(${a})"><line x1="0" y1="0" x2="0" y2="2.4" stroke="#000" stroke-opacity=".13" stroke-width=".55"/></pattern>`).join('')}</defs>`;
    return defs + `<g>${half}</g><g transform="translate(200,0) scale(-1,1)">${half}</g>`;
  }

  window.Muscles = {
    NAMES: MUSCLES,
    svg(side, o = {}) {
      return `<svg class="bodymap${o.interactive ? ' live' : ''}" viewBox="14 2 172 410" role="img" aria-label="Lihaskartta ${side === 'front' ? 'edestä' : 'takaa'}">${figure(side, o)}</svg>`;
    },
    pair(o = {}) {
      return `<div class="pair">${this.svg('front', o)}${this.svg('back', o)}</div>`;
    }
  };
})();
