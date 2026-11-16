/* Lihaskartta: piirretty itse, ei kolmannen osapuolen kuvia.
   Lihasnimet vastaavat free-exercise-db:n primaryMuscles-arvoja. */
(function () {
  const MUSCLES = {
    chest: 'Rinta', shoulders: 'Olkapäät', biceps: 'Hauis', triceps: 'Ojentajat',
    forearms: 'Kyynärvarret', abdominals: 'Vatsa', quadriceps: 'Etureidet',
    hamstrings: 'Takareidet', glutes: 'Pakarat', calves: 'Pohkeet',
    lats: 'Leveä selkä', 'middle back': 'Keskiselkä', 'lower back': 'Alaselkä',
    traps: 'Epäkkäät', adductors: 'Lähentäjät', abductors: 'Loitontajat', neck: 'Niska'
  };

  // Vartalon siluetti (vasen puoli, peilataan)
  const BODY_SIDE = [
    'M70 74 Q86 69 100 68 L100 206 Q84 206 68 200 L64 150 Q55 120 60 86 Z',
    'M61 80 Q46 85 42 110 L37 150 Q44 158 54 153 L63 112 Z',
    'M37 150 Q29 175 30 200 L36 214 Q44 212 46 200 L54 156 Z',
    'M68 196 Q61 240 69 292 L97 292 Q101 250 100 204 Z',
    'M69 292 Q63 330 72 380 L91 380 Q97 330 97 292 Z'
  ];
  const BODY_CENTER = '<ellipse cx="100" cy="36" rx="16" ry="20"/><rect x="92" y="52" width="16" height="20" rx="5"/>';
  const BODY_EXTRA_SIDE = '<ellipse cx="33" cy="222" rx="6" ry="10"/><ellipse cx="81" cy="388" rx="11" ry="6"/>';

  const FRONT = {
    side: [
      ['shoulders', 'M62 78 Q48 82 46 102 Q56 105 66 95 Q71 85 62 78 Z'],
      ['chest', 'M98 82 Q80 80 68 90 Q65 110 74 121 Q88 127 98 122 Z'],
      ['biceps', 'M48 107 Q42 125 44 146 Q52 149 56 142 Q61 124 60 105 Q54 102 48 107 Z'],
      ['forearms', 'M42 153 Q34 173 34 198 Q40 202 44 198 Q50 176 54 157 Q48 152 42 153 Z'],
      ['abdominals', 'M70 128 Q66 156 72 188 Q78 192 82 186 L82 132 Q76 126 70 128 Z'],
      ['traps', 'M92 71 Q82 74 73 79 Q86 81 94 78 Z'],
      ['abductors', 'M68 198 Q64 211 66 227 Q72 222 74 206 Z'],
      ['quadriceps', 'M75 205 Q66 240 72 284 Q84 292 94 284 Q98 250 94 214 Q86 202 75 205 Z'],
      ['adductors', 'M96 211 Q90 231 94 262 Q99 250 99 214 Z'],
      ['calves', 'M72 300 Q66 326 72 356 Q78 361 81 352 Q83 324 81 300 Z']
    ],
    center: [
      ['neck', 'M93 57 L93 70 Q100 73 107 70 L107 57 Z'],
      ['abdominals', 'M85 128h13v19h-13z M102 128h13v19h-13z M85 150h13v19h-13z M102 150h13v19h-13z M86 172h12v20h-12z M102 172h12v20h-12z']
    ]
  };
  const BACK = {
    side: [
      ['shoulders', 'M64 80 Q50 84 46 102 Q56 106 66 96 Q72 86 64 80 Z'],
      ['triceps', 'M48 107 Q40 126 44 148 Q52 150 58 140 Q61 122 60 105 Q54 102 48 107 Z'],
      ['forearms', 'M42 153 Q34 173 34 198 Q40 202 44 198 Q50 176 54 157 Q48 152 42 153 Z'],
      ['middle back', 'M85 98 Q77 106 77 121 Q85 130 94 132 L93 106 Z'],
      ['lats', 'M70 99 Q64 123 70 149 Q80 168 95 177 L96 141 Q80 135 74 123 Q71 109 74 100 Z'],
      ['lower back', 'M86 173 Q84 186 86 198 L99 198 L99 177 Q92 177 86 173 Z'],
      ['glutes', 'M70 203 Q66 221 74 237 Q88 245 99 237 L99 207 Q86 199 70 203 Z'],
      ['hamstrings', 'M72 241 Q66 263 72 290 Q84 296 94 288 Q98 264 96 243 Q86 247 72 241 Z'],
      ['calves', 'M70 299 Q64 321 70 347 Q80 353 90 345 Q96 321 92 299 Q82 295 70 299 Z']
    ],
    center: [
      ['neck', 'M93 55 L93 66 Q100 70 107 66 L107 55 Z'],
      ['traps', 'M100 62 Q87 71 74 80 Q91 90 100 139 Q109 90 126 80 Q113 71 100 62 Z']
    ]
  };

  function cls(m, o) {
    if (o.selected && o.selected.has(m)) return 'm sel';
    if (o.primary && o.primary.includes(m)) return 'm pri';
    if (o.secondary && o.secondary.includes(m)) return 'm sec';
    return 'm';
  }
  function paths(list, o) {
    return list.map(([m, d]) => `<path class="${cls(m, o)}" data-m="${m}" d="${d}"><title>${MUSCLES[m]}</title></path>`).join('');
  }
  function figure(side, o) {
    const def = side === 'front' ? FRONT : BACK;
    const body = BODY_SIDE.map(d => `<path d="${d}"/>`).join('') + BODY_EXTRA_SIDE;
    const half = body + paths(def.side, o);
    return `<g class="body">${BODY_CENTER}</g>` +
      `<g>${half}</g><g transform="translate(200,0) scale(-1,1)">${half}</g>` +
      paths(def.center, o);
  }

  window.Muscles = {
    NAMES: MUSCLES,
    svg(side, o = {}) {
      return `<svg class="bodymap${o.interactive ? ' live' : ''}" viewBox="20 10 160 390" role="img" aria-label="Lihaskartta ${side === 'front' ? 'edestä' : 'takaa'}">${figure(side, o)}</svg>`;
    },
    pair(o = {}) {
      return `<div class="pair">${this.svg('front', o)}${this.svg('back', o)}</div>`;
    }
  };
})();
