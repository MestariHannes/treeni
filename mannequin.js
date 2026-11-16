/* Liikeanimaatiot: oma nivelhahmo (mannekiini), ei kolmannen osapuolen kuvia.
   Jokaisella liiketyypillä (ARCH) on alku- ja loppuasento A ja B. Kulmat ovat absoluuttisia suuntia
   asteina: 0 = ylös, 90 = eteen (oikealle), 180 = alas, 270 = taakse. Hahmo katsoo oikealle.
   anchor kertoo, mikä kohta pysyy paikallaan (jalat lattialla, kädet tangossa, lantio penkillä…). */
(function () {
  const L = { torso: 50, upper: 28, fore: 26, thigh: 42, shin: 40, foot: 13 };
  const GROUND = 206;
  const rad = d => d * Math.PI / 180;
  const vec = (a, l) => [l * Math.sin(rad(a)), -l * Math.cos(rad(a))];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // Perusasennot
  const STAND = { torso: 0, thigh: 180, shin: 180, foot: 90, upper: 180, fore: 180, anchor: 'feet', at: [105, GROUND - 4] };
  const SEAT = { torso: 0, thigh: 90, shin: 180, foot: 90, upper: 165, fore: 95, anchor: 'hip', at: [92, 150] };
  const LIE = { torso: 270, thigh: 100, shin: 175, foot: 90, upper: 95, fore: 95, anchor: 'hip', at: [120, 150] };
  const P = (base, o) => Object.assign({}, base, o);

  const BENCH = { type: 'bench', x: 50, y: 154, w: 98, h: 8 };
  const ARCH = {
    squat: { A: P(STAND, { torso: 4, upper: 215, fore: 25 }), B: P(STAND, { torso: 38, thigh: 98, shin: 205, upper: 225, fore: 40 }), prop: 'barbell@shoulder', hi: 'thigh' },
    goblet: { A: P(STAND, { torso: 4, upper: 165, fore: 15 }), B: P(STAND, { torso: 25, thigh: 98, shin: 208, upper: 150, fore: 25 }), prop: 'kettlebell', hi: 'thigh' },
    bwsquat: { A: P(STAND, { upper: 180, fore: 180 }), B: P(STAND, { torso: 32, thigh: 98, shin: 205, upper: 90, fore: 90 }), hi: 'thigh' },
    lunge: { A: P(STAND, { torso: 0, at: [120, GROUND - 4], thigh2: 180, shin2: 180 }), B: P(STAND, { torso: 4, at: [120, GROUND - 4], thigh: 112, shin: 185, thigh2: 200, shin2: 262, foot2: 160 }), prop: 'dumbbell', hi: 'thigh' },
    legpress: { A: P(SEAT, { torso: 300, at: [80, 160], thigh: 40, shin: 150 }), B: P(SEAT, { torso: 300, at: [80, 160], thigh: 62, shin: 68 }), prop: 'sled', seat: 'recline', hi: 'thigh' },
    legext: { A: P(SEAT, { shin: 180, upper: 170, fore: 170 }), B: P(SEAT, { shin: 98, upper: 170, fore: 170 }), seat: 'chair', hi: 'thigh' },
    legcurl: { A: P(LIE, { torso: 268, at: [100, 148], thigh: 92, shin: 90, foot: 180, upper: 175, fore: 270 }), B: P(LIE, { torso: 268, at: [100, 148], thigh: 92, shin: 15, foot: 100, upper: 175, fore: 270 }), prop: 'bench', hi: 'thigh' },
    hinge: { A: P(STAND, { upper: 182, fore: 180 }), B: P(STAND, { torso: 78, thigh: 168, shin: 186, upper: 180, fore: 180 }), prop: 'barbell', hi: 'thigh' },
    deadlift: { A: P(STAND, { upper: 182, fore: 180 }), B: P(STAND, { torso: 62, thigh: 122, shin: 202, upper: 182, fore: 180 }), prop: 'barbell@floor', hi: 'torso' },
    swing: { A: P(STAND, { torso: 70, thigh: 160, shin: 190, upper: 200, fore: 200 }), B: P(STAND, { torso: 0, upper: 88, fore: 88 }), prop: 'kettlebell', hi: 'thigh' },
    bridge: { A: P(LIE, { anchor: 'feet', at: [140, GROUND - 4], torso: 268, thigh: 58, shin: 168, upper: 180, fore: 90 }), B: P(LIE, { anchor: 'feet', at: [140, GROUND - 4], torso: 252, thigh: 100, shin: 168, upper: 160, fore: 90 }), floor: 'mat', hi: 'thigh' },
    kickback: { A: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 92, upper: 180, fore: 180, thigh: 180, shin: 270, foot: 180, thigh2: 180, shin2: 270, foot2: 180 }), B: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 92, upper: 180, fore: 180, thigh: 268, shin: 300, foot: 0, thigh2: 180, shin2: 270, foot2: 180 }), floor: 'mat', hi: 'thigh' },
    calf: { A: P(STAND, { anchor: 'toes', at: [118, GROUND - 3] }), B: P(STAND, { anchor: 'toes', at: [118, GROUND - 3], foot: 130 }), prop: 'dumbbell', hi: 'shin' },
    seatcalf: { A: P(SEAT, { shin: 180 }), B: P(SEAT, { shin: 180, foot: 130 }), seat: 'chair', hi: 'shin' },
    bench: { A: P(LIE, { upper: 2, fore: 0 }), B: P(LIE, { upper: 158, fore: 2 }), prop: 'barbell', bench: BENCH, hi: 'torso' },
    incline: { A: P(LIE, { torso: 300, upper: 20, fore: 18 }), B: P(LIE, { torso: 300, upper: 170, fore: 20 }), prop: 'dumbbell', bench: 'incline', hi: 'torso' },
    dbbench: { A: P(LIE, { upper: 2, fore: 0 }), B: P(LIE, { upper: 158, fore: 2 }), prop: 'dumbbell', bench: BENCH, hi: 'torso' },
    pushup: { A: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 72, upper: 180, fore: 180, thigh: 252, shin: 252, foot: 165 }), B: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 84, upper: 285, fore: 172, thigh: 264, shin: 264, foot: 175 }), floor: 'mat', hi: 'torso' },
    dip: { A: P(STAND, { anchor: 'hands', at: [112, 118], torso: 4, upper: 180, fore: 180, thigh: 190, shin: 165 }), B: P(STAND, { anchor: 'hands', at: [112, 118], torso: 18, upper: 262, fore: 172, thigh: 200, shin: 170 }), prop: 'bars', hi: 'upper' },
    benchdip: { A: P(SEAT, { anchor: 'hands', at: [78, 150], torso: 8, upper: 180, fore: 180, thigh: 90, shin: 180 }), B: P(SEAT, { anchor: 'hands', at: [78, 150], torso: 8, upper: 245, fore: 178, thigh: 100, shin: 168 }), bench: { type: 'bench', x: 40, y: 152, w: 44, h: 8 }, hi: 'upper' },
    ohpress: { A: P(STAND, { upper: 160, fore: 12 }), B: P(STAND, { upper: 4, fore: 2 }), prop: 'barbell', hi: 'shoulder' },
    seatpress: { A: P(SEAT, { upper: 160, fore: 12 }), B: P(SEAT, { upper: 4, fore: 2 }), prop: 'dumbbell', seat: 'chair', hi: 'shoulder' },
    bentrow: { A: P(STAND, { torso: 72, thigh: 165, shin: 192, upper: 180, fore: 180 }), B: P(STAND, { torso: 72, thigh: 165, shin: 192, upper: 252, fore: 165 }), prop: 'barbell', hi: 'torso' },
    dbrow: { A: P(STAND, { torso: 80, thigh: 165, shin: 192, upper: 180, fore: 180 }), B: P(STAND, { torso: 80, thigh: 165, shin: 192, upper: 252, fore: 165 }), prop: 'dumbbell', hi: 'torso' },
    cablerow: { A: P(SEAT, { anchor: 'hip', at: [70, 182], thigh: 85, shin: 100, foot: 0, torso: 8, upper: 88, fore: 88 }), B: P(SEAT, { anchor: 'hip', at: [70, 182], thigh: 85, shin: 100, foot: 0, torso: 352, upper: 205, fore: 95 }), cable: [190, 178], hi: 'torso' },
    invrow: { A: P(STAND, { anchor: 'hands', at: [150, 120], torso: 112, upper: 0, fore: 0, thigh: 290, shin: 290, foot: 200 }), B: P(STAND, { anchor: 'hands', at: [150, 120], torso: 100, upper: 238, fore: 15, thigh: 280, shin: 280, foot: 190 }), prop: 'bar', hi: 'torso' },
    pullup: { A: P(STAND, { anchor: 'hands', at: [110, 34], torso: 0, upper: 0, fore: 0, thigh: 185, shin: 150 }), B: P(STAND, { anchor: 'hands', at: [110, 34], torso: 6, upper: 150, fore: 8, thigh: 190, shin: 152 }), prop: 'bar', hi: 'torso' },
    pulldown: { A: P(SEAT, { at: [92, 160], torso: 350, upper: 8, fore: 4 }), B: P(SEAT, { at: [92, 160], torso: 345, upper: 158, fore: 10 }), cable: [112, 12], seat: 'chair', hi: 'torso' },
    curl: { A: P(STAND, { upper: 178, fore: 178 }), B: P(STAND, { upper: 172, fore: 22 }), prop: 'dumbbell', hi: 'upper' },
    bbcurl: { A: P(STAND, { upper: 178, fore: 178 }), B: P(STAND, { upper: 172, fore: 22 }), prop: 'barbell', hi: 'upper' },
    wristcurl: { A: P(SEAT, { upper: 160, fore: 92, wrist: 150 }), B: P(SEAT, { upper: 160, fore: 92, wrist: 50 }), prop: 'dumbbell', seat: 'chair', hi: 'fore' },
    pushdown: { A: P(STAND, { torso: 10, upper: 172, fore: 70 }), B: P(STAND, { torso: 10, upper: 175, fore: 178 }), cable: [132, 10], hi: 'upper' },
    ohext: { A: P(STAND, { upper: 8, fore: 4 }), B: P(STAND, { upper: 8, fore: 200 }), prop: 'dumbbell', hi: 'upper' },
    skull: { A: P(LIE, { upper: 345, fore: 0 }), B: P(LIE, { upper: 345, fore: 250 }), prop: 'barbell', bench: BENCH, hi: 'upper' },
    tkick: { A: P(STAND, { torso: 72, thigh: 165, shin: 192, upper: 262, fore: 175 }), B: P(STAND, { torso: 72, thigh: 165, shin: 192, upper: 262, fore: 262 }), prop: 'dumbbell', hi: 'upper' },
    facepull: { A: P(STAND, { upper: 88, fore: 88 }), B: P(STAND, { upper: 262, fore: 20 }), cable: [196, 64], hi: 'shoulder' },
    frontraise: { A: P(STAND, { upper: 178, fore: 176 }), B: P(STAND, { upper: 88, fore: 86 }), prop: 'dumbbell', hi: 'shoulder' },
    crunch: { A: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 268, thigh: 48, shin: 145, upper: 225, fore: 20, head: 268 }), B: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 300, thigh: 48, shin: 145, upper: 255, fore: 40, head: 330 }), floor: 'mat', hi: 'torso' },
    situp: { A: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 268, thigh: 48, shin: 145, upper: 225, fore: 20 }), B: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 350, thigh: 48, shin: 145, upper: 200, fore: 30 }), floor: 'mat', hi: 'torso' },
    legraise: { A: P(STAND, { anchor: 'hands', at: [110, 34], upper: 0, fore: 0, thigh: 182, shin: 182 }), B: P(STAND, { anchor: 'hands', at: [110, 34], upper: 0, fore: 0, torso: 350, thigh: 92, shin: 120 }), prop: 'bar', hi: 'torso' },
    floorlegraise: { A: P(LIE, { anchor: 'hip', at: [100, GROUND - 8], torso: 270, thigh: 92, shin: 92, upper: 260, fore: 270 }), B: P(LIE, { anchor: 'hip', at: [100, GROUND - 8], torso: 270, thigh: 8, shin: 8, upper: 260, fore: 270 }), floor: 'mat', hi: 'torso' },
    plank: { A: P(STAND, { anchor: 'elbows', at: [150, GROUND - 4], torso: 86, upper: 180, fore: 90, thigh: 266, shin: 266, foot: 170 }), B: P(STAND, { anchor: 'elbows', at: [150, GROUND - 4], torso: 84, upper: 180, fore: 90, thigh: 265, shin: 265, foot: 170 }), floor: 'mat', hi: 'torso', static: true },
    twist: { A: P(SEAT, { anchor: 'hip', at: [100, GROUND - 8], torso: 330, thigh: 60, shin: 130, upper: 120, fore: 60 }), B: P(SEAT, { anchor: 'hip', at: [100, GROUND - 8], torso: 330, thigh: 60, shin: 130, upper: 160, fore: 120 }), floor: 'mat', hi: 'torso' },
    superman: { A: P(LIE, { anchor: 'hip', at: [100, GROUND - 8], torso: 90, thigh: 270, shin: 270, foot: 180, upper: 90, fore: 90, head: 90 }), B: P(LIE, { anchor: 'hip', at: [100, GROUND - 8], torso: 76, thigh: 282, shin: 284, foot: 190, upper: 70, fore: 70, head: 70 }), floor: 'mat', hi: 'torso' },
    backext: { A: P(STAND, { anchor: 'hip', at: [92, 130], torso: 150, thigh: 248, shin: 248, foot: 160, upper: 180, fore: 180 }), B: P(STAND, { anchor: 'hip', at: [92, 130], torso: 70, thigh: 248, shin: 248, foot: 160, upper: 170, fore: 30 }), prop: 'hyper', hi: 'torso' },
    climber: { A: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 74, upper: 180, fore: 180, thigh: 252, shin: 252, foot: 165, thigh2: 252, shin2: 252 }), B: P(STAND, { anchor: 'hands', at: [150, GROUND - 2], torso: 74, upper: 180, fore: 180, thigh: 120, shin: 220, foot: 165, thigh2: 252, shin2: 252 }), floor: 'mat', hi: 'thigh', fast: true },
    bicycle: { A: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 290, thigh: 40, shin: 120, thigh2: 80, shin2: 82, upper: 225, fore: 20 }), B: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 290, thigh: 80, shin: 82, thigh2: 40, shin2: 120, upper: 225, fore: 20 }), floor: 'mat', hi: 'torso' },
    rollout: { A: P(STAND, { anchor: 'knees', at: [88, GROUND - 4], torso: 58, thigh: 180, shin: 270, foot: 180, upper: 165, fore: 165 }), B: P(STAND, { anchor: 'knees', at: [88, GROUND - 4], torso: 84, thigh: 128, shin: 270, foot: 180, upper: 92, fore: 92 }), prop: 'wheel', floor: 'mat', hi: 'torso' },
    deadbug: { A: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 270, thigh: 0, shin: 90, upper: 0, fore: 0 }), B: P(LIE, { anchor: 'hip', at: [112, GROUND - 8], torso: 270, thigh: 75, shin: 85, upper: 280, fore: 280 }), floor: 'mat', hi: 'torso' },
    jump: { A: P(STAND, { torso: 30, thigh: 100, shin: 205, upper: 220, fore: 220 }), B: P(STAND, { at: [105, GROUND - 26], torso: 0, thigh: 182, shin: 182, foot: 140, upper: 10, fore: 10 }), hi: 'thigh' },
    stretch: { A: P(STAND, { upper: 180, fore: 180 }), B: P(STAND, { upper: 175, fore: 172 }), static: true, hi: null },
    stand: { A: P(STAND, {}), B: P(STAND, { upper: 176, fore: 174 }), static: true, hi: null },
    // Edestä kuvatut liikkeet (front: true): kulma on oikean käden/jalan suunta, vasen peilataan
    lateral: { front: true, A: { upper: 172, fore: 176 }, B: { upper: 95, fore: 98 }, prop: 'dumbbell', hi: 'shoulder' },
    reversefly: { front: true, A: { upper: 168, fore: 172 }, B: { upper: 98, fore: 100 }, prop: 'dumbbell', hi: 'shoulder' },
    fly: { front: true, A: { upper: 100, fore: 102 }, B: { upper: 150, fore: 162 }, cable: 'side', hi: 'torso' },
    shrug: { front: true, A: { upper: 178, fore: 180, sh: 0 }, B: { upper: 178, fore: 180, sh: -7 }, prop: 'dumbbell', hi: 'torso' },
    upright: { front: true, A: { upper: 172, fore: 186 }, B: { upper: 95, fore: 205 }, prop: 'barbellfront', hi: 'shoulder' },
    abduct: { front: true, A: { upper: 178, fore: 180, leg: 182 }, B: { upper: 178, fore: 180, leg: 155 }, hi: 'thigh' },
    adduct: { front: true, A: { upper: 178, fore: 180, leg: 155 }, B: { upper: 178, fore: 180, leg: 180 }, hi: 'thigh' },
    neck: { front: true, A: { upper: 178, fore: 180, tilt: 0 }, B: { upper: 178, fore: 180, tilt: 14 }, hi: 'neck' }
  };

  /* ---------- Liike → liiketyyppi ---------- */
  function classify(e) {
    const n = (e.name || '').toLowerCase(), m = e.primaryMuscles || [], eq = e.equipment || '', has = s => n.includes(s);
    if (e.category === 'stretching' || has('stretch') || has('smr')) return 'stretch';
    if (m.includes('neck')) return 'neck';
    if (has('calf') || has('calves')) return has('seated') ? 'seatcalf' : 'calf';
    if (has('shrug')) return 'shrug';
    if (has('upright')) return 'upright';
    if (has('face pull')) return 'facepull';
    if (has('reverse fl') || has('rear delt') || has('rear lateral')) return 'reversefly';
    if (has('lateral raise') || has('side lateral')) return 'lateral';
    if (has('front') && has('raise') && m.includes('shoulders')) return 'frontraise';
    if (has('fly') || has('flye') || has('crossover') || has('pec deck') || has('butterfly')) return 'fly';
    if (has('pulldown') || has('pull-down')) return 'pulldown';
    if (has('pull-up') || has('pullup') || has('pull up') || has('chin-up') || has('chin up') || has('muscle up') || has('rope climb')) return 'pullup';
    if (has('inverted row')) return 'invrow';
    if (has('row')) return (has('seated') || has('cable')) ? 'cablerow' : (eq === 'dumbbell' || has('one-arm') || has('one arm')) ? 'dbrow' : 'bentrow';
    if (has('swing')) return 'swing';
    if (has('hyperextension') || has('back extension')) return 'backext';
    if (has('superman')) return 'superman';
    if (has('romanian') || has('stiff') || has('good morning') || has('pull through')) return 'hinge';
    if (has('deadlift') || has('rack pull') || has('clean') || has('snatch')) return 'deadlift';
    if (has('hip thrust') || has('bridge') || has('butt lift')) return 'bridge';
    if (has('kickback')) return m.includes('triceps') ? 'tkick' : 'kickback';
    if (has('leg press') || has('sled')) return 'legpress';
    if (has('leg extension')) return 'legext';
    if (has('leg curl') || has('ham raise')) return 'legcurl';
    if (has('adduct') || m.includes('adductors')) return 'adduct';
    if (has('abduct') || m.includes('abductors')) return 'abduct';
    if (has('lunge') || has('split squat') || has('step up') || has('step-up')) return 'lunge';
    if (has('jump') || has('bound') || e.category === 'plyometrics') return 'jump';
    if (has('goblet') || has('plie')) return 'goblet';
    if (has('squat') || has('hack')) return eq === 'body only' ? 'bwsquat' : 'squat';
    if (has('push-up') || has('pushup') || has('push up')) return 'pushup';
    if (has('bench dip')) return 'benchdip';
    if (has('dip')) return 'dip';
    if (has('skullcrusher') || has('lying triceps') || has('french')) return 'skull';
    if (has('pushdown') || has('press down') || has('pressdown')) return 'pushdown';
    if (has('extension') && m.includes('triceps')) return 'ohext';
    if (has('curl') && (m.includes('forearms') || has('wrist'))) return 'wristcurl';
    if (has('curl')) return eq === 'barbell' || eq === 'e-z curl bar' ? 'bbcurl' : 'curl';
    if (has('incline') && has('press')) return 'incline';
    if ((has('press') || has('push')) && m.includes('chest')) return eq === 'dumbbell' ? 'dbbench' : 'bench';
    if (has('press') && m.includes('shoulders')) return has('seated') ? 'seatpress' : 'ohpress';
    if (has('press') && m.includes('triceps')) return 'bench';
    if (has('plank')) return 'plank';
    if (has('mountain')) return 'climber';
    if (has('air bike') || has('bicycle')) return 'bicycle';
    if (has('dead bug')) return 'deadbug';
    if (has('roller') || has('rollout') || has('ab wheel')) return 'rollout';
    if (has('twist') || has('woodchop')) return 'twist';
    if (has('sit-up') || has('situp') || has('sit up')) return 'situp';
    if (has('crunch') || has('jackknife') || has('v-up')) return 'crunch';
    if (has('leg raise') || has('knee raise') || has('leg lift')) return has('hanging') ? 'legraise' : 'floorlegraise';
    // Varalla: lihaksen mukaan
    const f = { quadriceps: 'bwsquat', hamstrings: 'hinge', glutes: 'bridge', chest: 'pushup', shoulders: 'ohpress', biceps: 'curl', triceps: 'pushdown',
      lats: 'pulldown', 'middle back': 'dbrow', 'lower back': 'backext', abdominals: 'crunch', forearms: 'wristcurl', traps: 'shrug', calves: 'calf' };
    return f[m[0]] || 'stand';
  }

  /* ---------- Kinematiikka ---------- */
  function solve(p) {
    const j = {};
    const thigh2 = p.thigh2 ?? p.thigh, shin2 = p.shin2 ?? p.shin, foot2 = p.foot2 ?? p.foot;
    if (p.anchor === 'feet' || p.anchor === 'toes') {
      let ankle = p.at;
      if (p.anchor === 'toes') ankle = add(p.at, vec(p.foot, L.foot), -1);
      const knee = add(ankle, vec(p.shin, L.shin), -1);
      j.hip = add(knee, vec(p.thigh, L.thigh), -1);
    } else if (p.anchor === 'hands' || p.anchor === 'elbows') {
      const elbow = p.anchor === 'hands' ? add(p.at, vec(p.fore, L.fore), -1) : p.at;
      const sh = add(elbow, vec(p.upper, L.upper), -1);
      j.hip = add(sh, vec(p.torso, L.torso), -1);
    } else if (p.anchor === 'knees') {
      j.hip = add(p.at, vec(p.thigh, L.thigh), -1);
    } else j.hip = p.at;
    j.sh = add(add(j.hip, vec(p.torso, L.torso)), [0, p.sh || 0]);
    j.neck = add(j.sh, vec(p.torso, 5));
    j.head = add(j.neck, vec(p.head ?? p.torso, 11));
    j.elbow = add(j.sh, vec(p.upper, L.upper)); j.wrist = add(j.elbow, vec(p.fore, L.fore));
    j.hand = add(j.wrist, vec(p.wrist ?? p.fore, 6));
    j.knee = add(j.hip, vec(p.thigh, L.thigh)); j.ankle = add(j.knee, vec(p.shin, L.shin)); j.toe = add(j.ankle, vec(p.foot, L.foot));
    j.knee2 = add(j.hip, vec(thigh2, L.thigh)); j.ankle2 = add(j.knee2, vec(shin2, L.shin)); j.toe2 = add(j.ankle2, vec(foot2, L.foot));
    return j;
  }
  function lerpPose(a, b, t) {
    const o = {};
    for (const k in a) o[k] = typeof a[k] === 'number' && typeof b[k] === 'number' ? a[k] + (b[k] - a[k]) * t : Array.isArray(a[k]) ? a[k].map((v, i) => v + ((b[k] || a[k])[i] - v) * t) : a[k];
    for (const k in b) if (!(k in o)) o[k] = b[k];
    return o;
  }

  /* ---------- Piirto ---------- */
  const f1 = n => n.toFixed(1);
  const seg = (a, b, w, c) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  // Lihasmainen raaja: ääriviiva + pohja + valoviiva
  function limb(a, b, w, tone, hi) {
    const c = hi ? 'var(--mq-hi)' : tone === 'far' ? 'var(--mq-far)' : 'var(--mq)';
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w * .22, ny = dx / l * w * .22;
    return seg(a, b, w + 2.2, 'var(--mq-edge)') + seg(a, b, w, c) +
      `<line x1="${f1(a[0] + nx)}" y1="${f1(a[1] + ny)}" x2="${f1(b[0] + nx)}" y2="${f1(b[1] + ny)}" stroke="#fff" stroke-opacity="${hi ? .35 : .45}" stroke-width="${f1(w * .28)}" stroke-linecap="round"/>`;
  }
  function torso(j, p, hi) {
    // Rintakehä leveämpi kuin vyötärö: kaksi päällekkäistä kapselia
    const mid = add(j.hip, vec(p.torso, L.torso * .62));
    return limb(j.hip, mid, 19, 'near', hi) + limb(mid, j.sh, 24, 'near', hi);
  }
  function head(j, p) {
    return seg(j.sh, j.neck, 9, 'var(--mq-edge)') + seg(j.sh, j.neck, 7, 'var(--mq)') +
      `<circle cx="${f1(j.head[0])}" cy="${f1(j.head[1])}" r="10.5" fill="var(--mq)" stroke="var(--mq-edge)" stroke-width="1.1"/>` +
      `<circle cx="${f1(j.head[0] - 3)}" cy="${f1(j.head[1] - 3.5)}" r="4" fill="#fff" opacity=".4"/>`;
  }
  const disc = (c, r) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}" fill="var(--prop)" stroke="var(--prop-edge)" stroke-width="1.2"/><circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r * .3}" fill="var(--prop-edge)"/>`;
  function propAt(prop, j, back) {
    if (!prop) return '';
    if (prop === 'barbell@shoulder') return back ? disc(add(j.sh, [-3, -4]), 13) : '';
    if (prop === 'barbell' || prop === 'barbell@floor') return back ? disc(j.hand, 13) : '';
    if (prop === 'dumbbell') return disc(j.hand, back ? 5.5 : 6);
    if (prop === 'kettlebell') return back ? '' : `<circle cx="${f1(j.hand[0])}" cy="${f1(j.hand[1] + 6)}" r="7.5" fill="var(--prop)" stroke="var(--prop-edge)" stroke-width="1.2"/><path d="M${f1(j.hand[0] - 4)} ${f1(j.hand[1] + 1)} Q${f1(j.hand[0])} ${f1(j.hand[1] - 6)} ${f1(j.hand[0] + 4)} ${f1(j.hand[1] + 1)}" fill="none" stroke="var(--prop-edge)" stroke-width="2"/>`;
    if (prop === 'wheel') return back ? '' : disc([j.hand[0], GROUND - 8], 8);
    return '';
  }
  function scenery(a, j) {
    let s = `<line x1="0" y1="${GROUND}" x2="220" y2="${GROUND}" stroke="var(--mq-edge)" stroke-opacity=".35" stroke-width="1.5"/>`;
    if (a.floor === 'mat') s += `<rect x="20" y="${GROUND - 3}" width="180" height="3" rx="1.5" fill="var(--prop)" opacity=".5"/>`;
    const b = a.bench;
    if (b === 'incline') s += `<path d="M58 168 L130 152 L132 160 L60 176 Z" fill="var(--prop)"/><path d="M70 172 L66 ${GROUND} M120 158 L124 ${GROUND}" stroke="var(--prop-edge)" stroke-width="3"/>`;
    else if (b) s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="var(--prop)"/><path d="M${b.x + 10} ${b.y + b.h} V${GROUND} M${b.x + b.w - 10} ${b.y + b.h} V${GROUND}" stroke="var(--prop-edge)" stroke-width="3"/>`;
    if (a.seat === 'chair') s += `<rect x="70" y="152" width="40" height="7" rx="3" fill="var(--prop)"/><path d="M90 159 V${GROUND}" stroke="var(--prop-edge)" stroke-width="3"/>`;
    if (a.seat === 'recline') { const b1 = add(j.hip, [-2, 13]), b2 = add(j.sh, [-11, 8]); s += seg(b1, b2, 8, 'var(--prop)') + `<path d="M${f1(b1[0])} ${f1(b1[1])} V${GROUND}" stroke="var(--prop-edge)" stroke-width="3"/>`; }
    if (a.prop === 'bar') s += `<line x1="70" y1="${f1(j.hand[1] - 1)}" x2="190" y2="${f1(j.hand[1] - 1)}" stroke="var(--prop-edge)" stroke-width="3.5" stroke-linecap="round"/><path d="M180 ${f1(j.hand[1] - 1)} V${GROUND}" stroke="var(--prop)" stroke-width="4"/>`;
    if (a.prop === 'bars') s += `<path d="M${f1(j.hand[0] - 22)} ${f1(j.hand[1] + 1)} H${f1(j.hand[0] + 14)} M${f1(j.hand[0] - 16)} ${f1(j.hand[1] + 1)} V${GROUND}" stroke="var(--prop-edge)" stroke-width="3.5" stroke-linecap="round"/>`;
    if (a.prop === 'hyper') s += `<path d="M78 128 L106 128 L104 136 L80 136 Z M58 176 L76 176" fill="var(--prop)" stroke="var(--prop)" stroke-width="4"/><path d="M92 136 V${GROUND}" stroke="var(--prop-edge)" stroke-width="3"/>`;
    if (a.prop === 'sled') s += `<rect x="${f1(j.toe[0] - 2)}" y="${f1(j.toe[1] - 22)}" width="8" height="34" rx="2" fill="var(--prop)" transform="rotate(-30 ${f1(j.toe[0])} ${f1(j.toe[1])})"/>`;
    return s;
  }
  function cableLine(a, j) {
    if (!a.cable || a.cable === 'side') return '';
    return `<line x1="${f1(j.hand[0])}" y1="${f1(j.hand[1])}" x2="${a.cable[0]}" y2="${a.cable[1]}" stroke="var(--prop-edge)" stroke-width="1.4"/><circle cx="${a.cable[0]}" cy="${a.cable[1]}" r="4" fill="var(--prop)" stroke="var(--prop-edge)"/>`;
  }
  function drawSide(a, p) {
    const j = solve(p), hi = a.hi;
    let s = scenery(a, j);
    // Kaukainen puoli (tummempi)
    s += limb(j.hip, j.knee2, 15, 'far', hi === 'thigh') + limb(j.knee2, j.ankle2, 12, 'far', hi === 'shin') + limb(j.ankle2, j.toe2, 7, 'far');
    s += propAt(a.prop, j, true);
    s += limb(j.sh, j.elbow, 11, 'far', hi === 'upper') + limb(j.elbow, j.wrist, 9, 'far', hi === 'fore') + limb(j.wrist, j.hand, 7, 'far');
    // Vartalo
    s += torso(j, p, hi === 'torso') + head(j, p);
    if (hi === 'shoulder') s += `<circle cx="${f1(j.sh[0])}" cy="${f1(j.sh[1])}" r="8" fill="var(--mq-hi)" stroke="var(--mq-edge)" stroke-width="1"/>`;
    // Lähempi puoli
    s += limb(j.hip, j.knee, 16, 'near', hi === 'thigh') + limb(j.knee, j.ankle, 12.5, 'near', hi === 'shin') + limb(j.ankle, j.toe, 7.5, 'near');
    s += cableLine(a, j);
    s += limb(j.sh, j.elbow, 11.5, 'near', hi === 'upper' || hi === 'shoulder') + limb(j.elbow, j.wrist, 9.5, 'near', hi === 'fore') + limb(j.wrist, j.hand, 7.5, 'near');
    s += propAt(a.prop, j, false);
    return s;
  }
  function drawFront(a, p) {
    const cx = 110, hipY = 118 - (p.lift || 0), shY = 66 + (p.sh || 0), hi = a.hi;
    const shL = [cx - 17, shY], shR = [cx + 17, shY], hpL = [cx - 9, hipY], hpR = [cx + 9, hipY];
    const arm = (sh, m) => { const e = add(sh, vec(p.upper * m, L.upper)), w = add(e, vec(p.fore * m, L.fore)), h = add(w, vec(p.fore * m, 6)); return { e, w, h }; };
    const leg = (hp, m) => { const k = add(hp, vec((p.leg ?? 180) * m, L.thigh)), an = add(k, vec((p.leg ?? 180) * m, L.shin)); return { k, an }; };
    const aL = arm(shL, -1), aR = arm(shR, 1), lL = leg(hpL, -1), lR = leg(hpR, 1);
    let s = `<line x1="0" y1="${GROUND}" x2="220" y2="${GROUND}" stroke="var(--mq-edge)" stroke-opacity=".35" stroke-width="1.5"/>`;
    [lL, lR].forEach((l, i) => { const hp = i ? hpR : hpL; s += limb(hp, l.k, 16, 'near', hi === 'thigh') + limb(l.k, l.an, 12.5, 'near', hi === 'shin') + limb(l.an, add(l.an, [i ? 6 : -6, 2]), 7.5, 'near'); });
    const th = hi === 'torso';
    s += `<path d="M${cx - 21} ${shY - 2} Q${cx} ${shY - 8} ${cx + 21} ${shY - 2} L${cx + 13} ${hipY + 4} Q${cx} ${hipY + 8} ${cx - 13} ${hipY + 4} Z" fill="${th ? 'var(--mq-hi)' : 'var(--mq)'}" stroke="var(--mq-edge)" stroke-width="1.2"/>`;
    s += `<path d="M${cx - 12} ${shY + 4} Q${cx} ${shY + 1} ${cx + 12} ${shY + 4}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`;
    const hc = add([cx, shY - 8], vec(p.tilt || 0, 13));
    s += seg([cx, shY - 2], [cx, shY - 10], 9, 'var(--mq-edge)') + seg([cx, shY - 2], [cx, shY - 10], 7, hi === 'neck' ? 'var(--mq-hi)' : 'var(--mq)');
    s += `<circle cx="${f1(hc[0])}" cy="${f1(hc[1])}" r="10.5" fill="var(--mq)" stroke="var(--mq-edge)" stroke-width="1.1"/>`;
    [[aL, shL], [aR, shR]].forEach(([a2, sh]) => {
      s += limb(sh, a2.e, 11.5, 'near', hi === 'upper' || hi === 'shoulder') + limb(a2.e, a2.w, 9.5, 'near', hi === 'fore') + limb(a2.w, a2.h, 7.5, 'near');
      if (hi === 'shoulder') s += `<circle cx="${f1(sh[0])}" cy="${f1(sh[1])}" r="8" fill="var(--mq-hi)" stroke="var(--mq-edge)" stroke-width="1"/>`;
      if (a.prop === 'dumbbell') s += disc(a2.h, 6);
      if (a.cable === 'side') s += `<line x1="${f1(a2.h[0])}" y1="${f1(a2.h[1])}" x2="${sh[0] < cx ? 8 : 212}" y2="40" stroke="var(--prop-edge)" stroke-width="1.4"/>`;
    });
    if (a.prop === 'barbellfront') s += seg([aL.h[0] - 14, aL.h[1]], [aR.h[0] + 14, aR.h[1]], 3.5, 'var(--prop-edge)');
    return s;
  }
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function frame(a, t) {
    // t 0..1: A → B (40 %), tauko, B → A (40 %), tauko
    const k = a.static ? (Math.sin(t * Math.PI * 2) + 1) / 2 : t < .4 ? ease(t / .4) : t < .5 ? 1 : t < .9 ? 1 - ease((t - .5) / .4) : 0;
    const p = lerpPose(a.A, a.B, k);
    return a.front ? drawFront(a, p) : drawSide(a, p);
  }

  /* ---------- Julkinen rajapinta ---------- */
  let raf = 0;
  window.Mannequin = {
    ARCH, classify,
    // Piirtää yhden kuvan (t = 0..1) esim. listan pikkukuvaksi
    svg(e, t = .45) { const a = ARCH[classify(e)]; return `<svg class="mq" viewBox="0 0 220 220" aria-hidden="true">${frame(a, t)}</svg>`; },
    // Käynnistää animaation annettuun elementtiin; palauttaa pysäytysfunktion
    play(el, e) {
      cancelAnimationFrame(raf);
      const a = ARCH[classify(e)], dur = a.fast ? 1400 : a.static ? 4000 : 3200;
      el.innerHTML = `<svg class="mq" viewBox="4 14 212 200" role="img" aria-label="Liikkeen animaatio"></svg>`;
      const svg = el.firstChild, t0 = performance.now();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const loop = now => { svg.innerHTML = frame(a, reduce ? .45 : ((now - t0) % dur) / dur); if (!reduce) raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
    stop() { cancelAnimationFrame(raf); },
    // Testikäyttöön: yksi kuva liiketyypistä
    frameOf(key, t) { return `<svg class="mq" viewBox="0 0 220 220">${frame(ARCH[key], t)}</svg>`; }
  };
})();
