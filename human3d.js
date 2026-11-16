/* 3D-ihminen liikeohjeisiin.
   Malli: Quaternius "Universal Base Characters" (CC0), kansiossa 3d/. Animaatio tehdään itse:
   liiketyyppien (Mannequin.ARCH) alku- ja loppuasennot ohjaavat luurankoa "tähtäämällä" jokaisen
   luun lapsiluuta kohti haluttuun suuntaan. Kohdelihakset värjätään suoraan vartaloon. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MQ = window.Mannequin;
const LIME = new THREE.Color(0.62, 1.0, 0.12), SEC = new THREE.Color(0.86, 1.0, 0.62);
const cache = {};
let renderer = null, raf = 0, current = null;

/* ---------- Lataus ---------- */
async function load(sex) {
  if (cache[sex]) return cache[sex];
  const loader = new GLTFLoader();
  const [body, hair] = await Promise.all([loader.loadAsync(`3d/${sex}.gltf`), loader.loadAsync(`3d/hair_${sex}.gltf`)]);
  const root = body.scene, bones = {};
  root.traverse(o => { if (o.isBone) bones[o.name] = o; });
  // Hiukset samaan luurankoon (hiusmalli on sidottu omaan kopioonsa luurangosta)
  const hairMeshes = [];
  hair.scene.traverse(o => { if (o.isSkinnedMesh) hairMeshes.push(o); });
  hairMeshes.forEach(m => {
    if (m.material) { m.material = m.material.clone(); m.material.color.set(0x3a3c40); }
    const sk = new THREE.Skeleton(m.skeleton.bones.map(b => bones[b.name] || b), m.skeleton.boneInverses);
    root.add(m); m.bind(sk, m.bindMatrix);
  });
  let body3 = null;
  root.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; }
    if (o.isMesh && o.material && /Hair/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(0x3a3c40); }
    if (o.isSkinnedMesh && o.material && /Superhero/i.test(o.material.name)) body3 = o;
  });
  // Mustat ääriviivat: vartalosta ja hiuksista kopio, joka on pullistettu normaalin suuntaan ja piirretään takapuolelta
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1c20, side: THREE.BackSide });
  outlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normal * 0.0055;'); };
  const hulls = [];
  root.traverse(o => { if (o.isSkinnedMesh && !/Eye/i.test(o.material && o.material.name || '')) hulls.push(o); });
  hulls.forEach(o => { const h = new THREE.SkinnedMesh(o.geometry, outlineMat); h.frustumCulled = false; o.parent.add(h); h.bind(o.skeleton, o.bindMatrix); });
  const rest = new Map();
  Object.values(bones).forEach(b => rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() }));
  root.updateMatrixWorld(true);
  cache[sex] = { root, bones, rest, body: body3, paints: {} };
  return cache[sex];
}

/* ---------- Lihasten väritys ---------- */
function paint(M, primary, secondary) {
  const mesh = M.body; if (!mesh) return;
  const key = primary.join(',') + '|' + secondary.join(',');
  const g = mesh.geometry;
  if (!M.paints[key]) {
    const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
    const sk = mesh.skeleton, bi = {}, bp = {};
    sk.bones.forEach((b, i) => { bi[b.name] = i; bp[b.name] = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert()); });
    const col = new Float32Array(n * 3), v = new THREE.Vector3();
    const P = name => bp[name] || new THREE.Vector3();
    const neckY = P('neck_01').y, sp3 = P('spine_03'), sp2 = P('spine_02'), pel = P('pelvis'), thX = Math.abs(P('thigh_l').x);
    const sm = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    // Lihas → paino (skin-painot × sijaintiehto). F = vartalon etupuoli, B = takapuoli.
    const RULES = {
      chest: (w, v, F) => (w.spine_03 + w.clavicle_l + w.clavicle_r + w.spine_02 * .5) * F * sm(v.y, sp3.y - .12, sp3.y - .06) * (1 - sm(v.y, neckY - .07, neckY - .02)) * (1 - sm(Math.abs(v.x), .17, .22)),
      abdominals: (w, v, F) => (w.spine_01 + w.spine_02 + w.pelvis * .6) * F * sm(v.y, pel.y - .02, pel.y + .04) * (1 - sm(v.y, sp3.y - .1, sp3.y - .05)),
      lats: (w, v, F, B) => (w.spine_02 + w.spine_03) * (B + .4 * F * sm(Math.abs(v.x), .12, .16)) * sm(Math.abs(v.x), .05, .1) * (1 - sm(v.y, sp3.y + .04, sp3.y + .1)),
      'middle back': (w, v, F, B) => (w.spine_02 + w.spine_03) * B * (1 - sm(Math.abs(v.x), .08, .12)) * sm(v.y, sp2.y - .02, sp2.y + .04) * (1 - sm(v.y, neckY - .12, neckY - .07)),
      traps: (w, v, F, B) => (w.spine_03 + w.neck_01 + w.clavicle_l + w.clavicle_r) * B * sm(v.y, sp3.y + .02, sp3.y + .08),
      'lower back': (w, v, F, B) => (w.spine_01 + w.pelvis) * B * sm(v.y, pel.y + .02, pel.y + .07) * (1 - sm(v.y, sp2.y, sp2.y + .05)),
      glutes: (w, v, F, B) => (w.pelvis + (w.thigh_l + w.thigh_r) * .7) * B * sm(v.y, pel.y - .24, pel.y - .17) * (1 - sm(v.y, pel.y + .02, pel.y + .07)),
      quadriceps: (w, v, F) => (w.thigh_l + w.thigh_r) * F * (1 - sm(v.y, pel.y - .1, pel.y - .04)),
      hamstrings: (w, v, F, B) => (w.thigh_l + w.thigh_r) * B * (1 - sm(v.y, pel.y - .2, pel.y - .14)),
      adductors: (w, v) => (w.thigh_l + w.thigh_r) * (1 - sm(Math.abs(v.x), thX - .03, thX + .01)) * (1 - sm(v.y, pel.y - .1, pel.y - .05)),
      abductors: (w, v) => (w.thigh_l + w.thigh_r + w.pelvis) * sm(Math.abs(v.x), thX + .05, thX + .09) * sm(v.y, pel.y - .3, pel.y - .2),
      calves: (w, v, F, B) => (w.calf_l + w.calf_r) * B,
      biceps: (w, v, F) => (w.upperarm_l + w.upperarm_r) * F,
      triceps: (w, v, F, B) => (w.upperarm_l + w.upperarm_r) * B,
      forearms: w => w.lowerarm_l + w.lowerarm_r + (w.hand_l + w.hand_r) * .3,
      shoulders: (w, v) => (w.upperarm_l + w.upperarm_r + w.clavicle_l + w.clavicle_r) * (1 - sm(Math.min(v.distanceTo(P('upperarm_l')), v.distanceTo(P('upperarm_r'))), .09, .14)),
      neck: w => w.neck_01 + w.Head * .25
    };
    const names = Object.keys(bi), w = {};
    for (let i = 0; i < n; i++) {
      names.forEach(k => w[k] = 0);
      for (let j = 0; j < 4; j++) { const b = sk.bones[si.getComponent(i, j)]; if (b) w[b.name] = (w[b.name] || 0) + sw.getComponent(i, j); }
      v.fromBufferAttribute(pos, i);
      // Etu-/takapuoli lähimmän vartaloluun suhteen
      const ref = v.y > pel.y ? sp2.z : pel.z;
      const F = sm(v.z - ref, -.01, .03), B = 1 - sm(v.z - ref, -.03, .01);
      const val = names => Math.min(1, names.reduce((a, m) => a + (RULES[m] ? RULES[m](w, v, F, B) : 0), 0) * 1.6);
      const a = val(primary), b2 = Math.min(1 - a, val(secondary));
      col[i * 3] = a; col[i * 3 + 1] = b2; col[i * 3 + 2] = 0;
    }
    M.paints[key] = col;
  }
  // Yksi pysyvä väriattribuutti, jonka sisältö vaihdetaan (attribuutin vaihto ei aina päivity näytönohjaimelle)
  let ca = g.getAttribute('color');
  if (!ca || ca.itemSize !== 3 || !ca.userData || !ca.userData.ours) { ca = new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3); ca.userData = { ours: true }; g.setAttribute('color', ca); }
  ca.array.set(M.paints[key]); ca.needsUpdate = true;
  if (!mesh.material.userData.hl) {
    // Oma värjäys: ihon väri sekoittuu limenvihreään painon mukaan (ei kerrota tekstuuria)
    mesh.material.vertexColors = true;
    // Kuvitustyyli (Lyfta-esikuva): vaaleanharmaa hahmo, tummat piirroslinjat lihasten rajoissa, mustat ääriviivat,
    // kohdelihas punaisena säikeineen. Kuviot lasketaan lepoasennon koordinaateista, joten ne liikkuvat vartalon mukana.
    if (mesh.material.normalScale) mesh.material.normalScale.set(2.6, 2.6);
    mesh.material.roughness = .8; mesh.material.transparent = false;
    const NOISE = `
varying vec3 vBind;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
    mesh.material.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
        .replace('#include <color_fragment>', `
  vec3 P = vBind;
  float head = smoothstep(1.47, 1.56, P.y);
  float f1 = vnoise(vec3(P.x * 170.0, P.y * 10.0, P.z * 170.0));
  float f2 = vnoise(vec3(P.x * 340.0 + 3.1, P.y * 18.0, P.z * 340.0));
  float fib = smoothstep(0.55, 0.95, f1 * 0.6 + f2 * 0.4) * (1.0 - head);
  float lum0 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float cloth = 1.0 - smoothstep(0.11, 0.24, lum0);
  float tr = smoothstep(0.28, 0.55, vColor.r), ts = smoothstep(0.28, 0.55, vColor.g);
  diffuseColor.rgb = vec3(0.8);
`).replace('#include <opaque_fragment>', `
  // Sävytys: valoisuus → harmaa kuvitusasteikko
  float L = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  float g = 0.50 + 0.44 * smoothstep(0.08, 0.75, L);
  // Piirroslinjat: pinnan suunnan jyrkkä muutos (lihasten rajat ja poimut)
  float ink = smoothstep(0.10, 0.32, length(fwidth(normal)));
  float rimD = smoothstep(0.55, 0.92, 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))));
  vec3 col = vec3(g) * vec3(0.98, 0.98, 1.0);
  col *= 1.0 - fib * 0.18;
  vec3 red = mix(vec3(0.62, 0.07, 0.05), vec3(0.96, 0.32, 0.24), smoothstep(0.1, 0.8, L));
  red *= 1.0 - fib * 0.45;
  col = mix(col, red, tr);
  col = mix(col, mix(vec3(0.93, 0.62, 0.55), vec3(0.98, 0.78, 0.72), smoothstep(0.1, 0.8, L)) * (1.0 - fib * 0.2), ts * 0.7);
  col = mix(col, vec3(0.18 + 0.12 * L), cloth);
  col *= 1.0 - ink * 0.55;
  col *= 1.0 - rimD * 0.35;
  outgoingLight = col;
#include <opaque_fragment>`);
    };
    mesh.material.userData.hl = true; mesh.material.needsUpdate = true;
  }
}

/* ---------- Asennot ---------- */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function aim(bone, child, dir) {
  if (!bone || !child) return;
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  const cur = _b.sub(_a); if (cur.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(cur.normalize(), dir);
  bone.getWorldQuaternion(_wq).premultiply(_q);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}
// 2D-kulma (0 = ylös, 90 = eteen) → 3D-suunta sivukuvassa; x = pieni sivusuuntainen loitonnus
const sag = (deg, x = 0) => { const r = deg * Math.PI / 180; return new THREE.Vector3(x, Math.cos(r), Math.sin(r)).normalize(); };
const frontDir = (deg, side) => { const r = deg * Math.PI / 180; return new THREE.Vector3(side * Math.sin(r), Math.cos(r), 0).normalize(); };

function pose(M, a, p) {
  const B = M.bones;
  M.root.position.set(0, 0, 0);
  M.rest.forEach((r, b) => { b.quaternion.copy(r.q); b.position.copy(r.p); });
  M.root.updateMatrixWorld(true);
  if (a.front) {
    const up = new THREE.Vector3(0, 1, 0);
    ['pelvis', 'spine_01', 'spine_02', 'spine_03'].forEach((n, i, arr) => aim(B[n], B[arr[i + 1] || 'neck_01'], up));
    if (p.sh) { aim(B.clavicle_l, B.upperarm_l, new THREE.Vector3(1, -p.sh * .05, 0).normalize()); aim(B.clavicle_r, B.upperarm_r, new THREE.Vector3(-1, -p.sh * .05, 0).normalize()); }
    aim(B.neck_01, B.Head, frontDir(p.tilt || 0, 1));
    [['l', 1], ['r', -1]].forEach(([s, m]) => {
      aim(B['upperarm_' + s], B['lowerarm_' + s], frontDir(p.upper, m));
      aim(B['lowerarm_' + s], B['hand_' + s], frontDir(p.fore, m));
      aim(B['hand_' + s], B['middle_01_' + s], frontDir(p.fore, m));
      const leg = p.leg ?? 178;
      aim(B['thigh_' + s], B['calf_' + s], frontDir(leg, m));
      aim(B['calf_' + s], B['foot_' + s], frontDir(leg, m));
      aim(B['foot_' + s], B['ball_' + s], sag(100, m * .25));
    });
    return;
  }
  const t = p.torso;
  aim(B.pelvis, B.spine_01, sag(t)); aim(B.spine_01, B.spine_02, sag(t)); aim(B.spine_02, B.spine_03, sag(t));
  aim(B.spine_03, B.neck_01, sag(t)); aim(B.neck_01, B.Head, sag(p.head ?? t));
  // Lähempi puoli = oikea (kamera katsoo hahmon oikealta), kaukaisempi = vasen
  const arm = (s, m) => {
    aim(B['upperarm_' + s], B['lowerarm_' + s], sag(p.upper, m * .16));
    aim(B['lowerarm_' + s], B['hand_' + s], sag(p.fore, m * .06));
    aim(B['hand_' + s], B['middle_01_' + s], sag(p.wrist ?? p.fore, m * .04));
  };
  arm('r', -1); arm('l', 1);
  const leg = (s, m, th, sh, ft) => {
    aim(B['thigh_' + s], B['calf_' + s], sag(th, m * .05));
    aim(B['calf_' + s], B['foot_' + s], sag(sh, m * .03));
    aim(B['foot_' + s], B['ball_' + s], sag((ft ?? 90) + 14, m * .12));
  };
  grip(M);
  leg('r', -1, p.thigh, p.shin, p.foot);
  leg('l', 1, p.thigh2 ?? p.thigh, p.shin2 ?? p.shin, p.foot2 ?? p.foot);
}
const wp = (M, n) => M.bones[n].getWorldPosition(new THREE.Vector3());
// Sormet koukkuun (ote tangosta / käsipainosta)
const _cq = new THREE.Quaternion();
function grip(M) {
  Object.values(M.bones).forEach(b => {
    const m = /^(index|middle|ring|pinky)_0([123])_/.exec(b.name);
    if (m) { _cq.setFromAxisAngle(GRIP_AXIS, m[2] === '1' ? .9 : 1.1); b.quaternion.multiply(_cq); }
    else if (/^thumb_0[23]_/.test(b.name)) { _cq.setFromAxisAngle(GRIP_AXIS, .5); b.quaternion.multiply(_cq); }
  });
  M.root.updateMatrixWorld(true);
}
export const GRIP_AXIS = new THREE.Vector3(1, 0, 0);

/* ---------- Kiinnitys lattiaan / tankoon ---------- */
function anchorName(a) {
  if (a.front) return 'ball_r';
  return { feet: 'ball_r', toes: 'ball_r', hip: 'pelvis', hands: 'hand_r', elbows: 'lowerarm_r', knees: 'calf_r', shoulders: 'spine_03' }[a.A.anchor] || 'pelvis';
}
function dropY(M, a) {
  // Kuinka paljon hahmoa siirretään pystysuunnassa, jotta se lepää lattialla / penkillä / roikkuu tangossa
  const y = n => wp(M, n).y;
  const feet = () => Math.min(y('ball_l') - .03, y('ball_r') - .03, y('foot_l') - .08, y('foot_r') - .08);
  const all = () => Math.min(feet(), y('pelvis') - .12, y('spine_02') - .12, y('spine_03') - .12, y('Head') - .11, y('hand_l') - .04, y('hand_r') - .04, y('lowerarm_l') - .05, y('lowerarm_r') - .05, y('calf_l') - .06, y('calf_r') - .06);
  const A = a.A;
  // Roikkuu tangossa tai nojaa dippitelineeseen: jalat irti lattiasta
  if (A.anchor === 'hands' && ((a.prop === 'bar' && A.at[1] < 80) || a.prop === 'bars')) return .12 - Math.min(feet(), y('calf_l') - .05, y('calf_r') - .05);
  if (a.bench || a.seat || A.anchor === 'hip' && a.prop === 'bench' || a.prop === 'hyper') {
    const shinDown = Math.abs((A.shin ?? 180) - 180) < 40;
    return shinDown ? -feet() : .62 - y('pelvis');
  }
  return -all();
}

/* ---------- Välineet ---------- */
const MAT = {
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: .8, roughness: .3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: .1, roughness: .7 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0, roughness: .8 }),
  mat: new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: .9 }),
  matEdge: new THREE.MeshStandardMaterial({ color: 0x8e96a0, roughness: .9 }),
  cable: new THREE.MeshBasicMaterial({ color: 0x222222 })
};
function radTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let _glow, _shadow;
const glowTex = () => _glow || (_glow = radTex([[0, 'rgba(183,239,20,.55)'], [.35, 'rgba(110,170,20,.22)'], [1, 'rgba(0,0,0,0)']]));
const shadowTex = () => _shadow || (_shadow = radTex([[0, 'rgba(0,0,0,.45)'], [.6, 'rgba(0,0,0,.15)'], [1, 'rgba(0,0,0,0)']]));
function cyl(r, len, mat, axis = 'x') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function makeDumbbell() { const g = new THREE.Group(); g.add(cyl(.016, .16, MAT.metal)); [-.07, .07].forEach(x => { const p = cyl(.06, .045, MAT.black); p.position.x = x; g.add(p); }); return g; }
function makeBarbell(light) { const g = new THREE.Group(); g.add(cyl(.014, light ? 1.3 : 1.9, MAT.metal)); [-1, 1].forEach(sx => { const p = cyl(light ? .11 : .225, light ? .04 : .06, MAT.black); p.position.x = sx * (light ? .52 : .74); g.add(p); }); return g; }
function makeKettle() { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(.09, 24, 16), MAT.black); s.position.y = -.1; g.add(s); const h = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 8, 20, Math.PI), MAT.black); h.position.y = -.03; h.rotation.y = Math.PI / 2; g.add(h); return g; }

function buildProps(M, a, scene) {
  const g = new THREE.Group(); scene.add(g);
  const dyn = []; // päivittyvät joka kuvassa
  const hands = () => [wp(M, 'hand_l'), wp(M, 'hand_r')];
  const pr = a.prop || '';
  if (pr.startsWith('barbell') && pr !== 'barbellfront') {
    const heavy = /squat|deadlift|hinge|bench|bentrow/.test(a.key || '') || pr !== 'barbell';
    const bb = makeBarbell(!heavy); g.add(bb);
    dyn.push(() => {
      if (pr === 'barbell@shoulder') { const s = wp(M, 'spine_03'), n = wp(M, 'neck_01'); bb.position.copy(n).lerp(s, .35); bb.position.z -= .08; }
      else { const [l, r] = hands(); bb.position.copy(l).add(r).multiplyScalar(.5); }
    });
  }
  if (pr === 'barbellfront') { const bb = makeBarbell(); bb.scale.set(.6, 1, 1); g.add(bb); dyn.push(() => { const [l, r] = hands(); bb.position.copy(l).add(r).multiplyScalar(.5); }); }
  if (pr === 'dumbbell') { const d = [makeDumbbell(), makeDumbbell()]; d.forEach(x => g.add(x)); dyn.push(() => { const h = hands(); d.forEach((x, i) => x.position.copy(h[i])); }); }
  if (pr === 'kettlebell') { const k = makeKettle(); g.add(k); dyn.push(() => { const [l, r] = hands(); k.position.copy(l).add(r).multiplyScalar(.5); }); }
  if (pr === 'wheel') { const w = cyl(.1, .06, MAT.black); g.add(w); dyn.push(() => { const [l, r] = hands(); w.position.copy(l).add(r).multiplyScalar(.5); w.position.y = .1; }); }
  return { g, dyn };
}
function buildStatic(M, a, scene, A0) {
  // Kiinteät välineet sijoitetaan alkuasennon perusteella
  const g = new THREE.Group(); scene.add(g);
  const P = n => A0[n];
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1.8, 64), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(0, .002, P('pelvis').z); spot.visible = false; g.add(spot);
  const shade = new THREE.Mesh(new THREE.CircleGeometry(.75, 48), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2; shade.scale.set(1, 1.6, 1); shade.position.set(0, .003, P('pelvis').z); g.add(shade);
  if (a.floor === 'mat') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.7, .02, 1.95), [MAT.matEdge, MAT.matEdge, MAT.mat, MAT.matEdge, MAT.matEdge, MAT.matEdge]);
    m.position.set(0, .01, P('pelvis').z); g.add(m);
  }
  if (a.bench || a.prop === 'bench') {
    const sup = Math.min(P('pelvis').y, P('spine_03').y) - .11;
    if (a.bench === 'incline') {
      const s = P('pelvis'), e = P('spine_03'), len = s.distanceTo(e) + .25, b = box(.32, .07, len, MAT.pad);
      b.position.copy(s).lerp(e, .5); b.position.y -= .1; b.lookAt(new THREE.Vector3(e.x, e.y - .1, e.z)); g.add(b);
      const l1 = box(.05, s.y - .15, .05, MAT.metal); l1.position.set(0, (s.y - .15) / 2, s.z); g.add(l1);
    } else {
      const zs = [P('pelvis').z, P('spine_03').z, P('Head').z];
      const z0 = Math.min(...zs) - .12, z1 = Math.max(...zs) + .25, len = Math.max(.5, z1 - z0);
      const b = box(.32, .07, len, MAT.pad); b.position.set(0, sup - .035, (z0 + z1) / 2); g.add(b);
      [z0 + .1, z1 - .1].forEach(z => { const l = box(.05, sup - .07, .05, MAT.metal); l.position.set(0, (sup - .07) / 2, z); g.add(l); });
    }
  }
  if (a.seat) {
    const y = P('pelvis').y - .1;
    const s = box(.4, .06, .4, MAT.pad); s.position.set(0, y - .03, P('pelvis').z + .02); g.add(s);
    const l = box(.06, y - .06, .06, MAT.metal); l.position.set(0, (y - .06) / 2, P('pelvis').z); g.add(l);
    if (a.seat === 'recline') { const bk = box(.4, .06, .7, MAT.pad); const s0 = P('pelvis'), e = P('spine_03'); bk.position.copy(s0).lerp(e, .5); bk.position.y -= .12; bk.lookAt(new THREE.Vector3(e.x, e.y - .12, e.z)); g.add(bk); }
  }
  if (a.prop === 'bar') {
    const h = P('hand_r'), bar = cyl(.017, 1.3, MAT.metal); bar.position.set(0, h.y + .02, h.z); g.add(bar);
    [-.62, .62].forEach(x => { const post = cyl(.03, h.y + .02, MAT.metal, 'y'); post.position.set(x, (h.y + .02) / 2, h.z - .05); g.add(post); });
  }
  if (a.prop === 'bars') {
    const h = P('hand_r');
    [-.27, .27].forEach(x => { const r = cyl(.02, .9, MAT.metal, 'z'); r.position.set(x, h.y - .02, h.z + .1); g.add(r); const post = cyl(.025, h.y, MAT.metal, 'y'); post.position.set(x, h.y / 2, h.z - .3); g.add(post); });
  }
  if (a.prop === 'hyper') { const pad = box(.4, .1, .35, MAT.pad); const p = P('pelvis'); pad.position.set(0, p.y - .13, p.z + .05); g.add(pad); const l = box(.06, p.y - .18, .06, MAT.metal); l.position.set(0, (p.y - .18) / 2, p.z); g.add(l); }
  if (a.prop === 'sled') { const f = P('ball_r'), pl = box(.45, .4, .04, MAT.metal); pl.position.set(0, f.y + .05, f.z + .06); pl.rotation.x = -.6; g.add(pl); }
  return g;
}
function buildCable(M, a, scene, A0, k) {
  if (!a.cable) return null;
  const mk = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 1, 6), MAT.cable); scene.add(m); return m; };
  const pul = [];
  if (a.cable === 'side') {
    const h = A0.hand_r; [[-1.1, 'hand_r'], [1.1, 'hand_l']].forEach(([x, n]) => pul.push({ p: new THREE.Vector3(x, 2.1, h.z), n, m: mk() }));
  } else {
    // 2D-kaapelipiste → 3D: siirtymä alkuasennon kädestä
    const d2 = [a.cable[0] - 110, MQ.GROUND - a.cable[1]];
    pul.push({ p: new THREE.Vector3(0, Math.max(.1, d2[1] * k), A0.pelvis.z + d2[0] * k), n: 'hand_r', m: mk() });
  }
  pul.forEach(c => { const st = box(.12, .12, .12, MAT.black); st.position.copy(c.p); scene.add(st); });
  return () => pul.forEach(c => {
    const h = wp(M, c.n), mid = h.clone().add(c.p).multiplyScalar(.5), len = h.distanceTo(c.p);
    c.m.position.copy(mid); c.m.scale.set(1, len, 1); c.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.p.clone().sub(h).normalize());
  });
}

/* ---------- Toisto ---------- */
export function stop() { cancelAnimationFrame(raf); raf = 0; if (current) { current.dispose(); current = null; } }

async function setup(ex, sex, w, h) {
  const key0 = MQ.classify(ex), a = Object.assign({ key: key0 }, MQ.ARCH[key0]);
  const M = await load(sex === 'female' ? 'female' : 'male');
  paint(M, ex.primaryMuscles || [], ex.secondaryMuscles || []);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = .95;
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9098a0, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-2, 3.5, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .5); scene.add(rim);
  const rim2 = new THREE.PointLight(0xffffff, 0, 1); scene.add(rim2);
  scene.add(M.root);

  // Alkuasento: pudotus lattialle ja kiinnityspiste
  const anchor = anchorName(a);
  pose(M, a, MQ.poseAt(a, 0));
  const dy = dropY(M, a);
  M.root.position.y = dy; M.root.updateMatrixWorld(true);
  const A0 = {}; ['pelvis', 'spine_03', 'Head', 'hand_r', 'hand_l', 'ball_r', anchor].forEach(n => A0[n] = wp(M, n));
  const target = A0[anchor].clone();
  const k = (wp(M, 'neck_01').distanceTo(wp(M, 'pelvis'))) / MQ.L.torso;
  buildStatic(M, a, scene, A0);
  const props = buildProps(M, a, scene);
  const cable = buildCable(M, a, scene, A0, k);
  const place = t => {
    pose(M, a, MQ.poseAt(a, t));
    M.root.position.set(0, dy, 0); M.root.updateMatrixWorld(true);
    const off = target.clone().sub(wp(M, anchor)); M.root.position.add(off); M.root.updateMatrixWorld(true);
  };
  // Kamera: rajaus alku- ja loppuasennon mukaan
  const bbox = new THREE.Box3();
  [0, .45].forEach(t => { place(t); ['Head', 'hand_l', 'hand_r', 'ball_l', 'ball_r', 'pelvis', 'calf_l', 'calf_r', 'lowerarm_l'].forEach(n => bbox.expandByPoint(wp(M, n))); });
  bbox.min.y = Math.min(bbox.min.y, 0);
  bbox.expandByScalar(.16);
  const center = bbox.getCenter(new THREE.Vector3()), size = bbox.getSize(new THREE.Vector3());
  const aspect = w / h, cam = new THREE.PerspectiveCamera(28, aspect, .05, 50);
  const fitH = Math.max(size.y, (a.front ? size.x : size.z) / aspect);
  const dist = fitH / (2 * Math.tan(THREE.MathUtils.degToRad(14))) * 1.04;
  const tA = a.A.torso ?? 0, lying = !a.front && ['hip', 'shoulders'].includes(a.A.anchor) && (Math.abs(tA - 270) < 40 || Math.abs(tA - 90) < 40);
  const dir = a.front ? new THREE.Vector3(.28, .1, 1).normalize() : lying ? new THREE.Vector3(-.85, .7, .5).normalize() : new THREE.Vector3(-1, .14, .62).normalize();
  // Kohdelihas takapuolella → kamera takaviistoon, jotta punainen lihas näkyy
  const BACKM = ['hamstrings', 'glutes', 'lats', 'middle back', 'lower back', 'traps', 'triceps', 'calves'];
  if (BACKM.includes((ex.primaryMuscles || [])[0]) && !(lying && a.A.torso > 200)) dir.z = -dir.z;
  cam.position.copy(center).addScaledVector(dir, dist); cam.lookAt(center);
  // Vihreä takavalo kameraa vastapäätä, valokeila lattialle
  rim.position.copy(center).addScaledVector(dir, -3).add(new THREE.Vector3(0, 2.2, 0));
  rim2.position.copy(center).addScaledVector(dir, -1.2).add(new THREE.Vector3(0, .4, 0));
  const frame = t => { place(t); props.dyn.forEach(f => f()); if (cable) cable(); renderer.render(scene, cam); };
  const dispose = () => { scene.remove(M.root); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };
  // Kuvakulman kääntö (sormella pyöritys): kamera kiertää pystyakselin ympäri
  const orbit = yaw => { cam.position.copy(center).addScaledVector(dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw), dist); cam.lookAt(center); };
  return { a, frame, dispose, orbit };
}

// Pysäytyskuva (dataURL), esim. pikkukuviin ja tarkistukseen
export async function still(ex, sex, t = .45, w = 240, h = 180) {
  const S = await setup(ex, sex, w, h);
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  S.frame(t); const url = renderer.domElement.toDataURL('image/png'); S.dispose();
  return url;
}

export async function play(el, ex, sex) {
  stop();
  const w = el.clientWidth || 320, h = el.clientHeight || 220;
  const S = await setup(ex, sex, w, h);
  if (!el.isConnected) { S.dispose(); return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  el.innerHTML = ''; el.appendChild(renderer.domElement);
  renderer.domElement.className = 'h3d';
  const dur = MQ.duration(S.a) * (el.dataset.slow ? 2 : 1);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Pyöritys vetämällä
  let yaw = 0, drag = null, paused = false;
  const cv = renderer.domElement;
  cv.style.touchAction = 'pan-y';
  cv.onpointerdown = e => { drag = { x: e.clientX, y0: yaw, moved: false }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; yaw = drag.y0 + dx * .012; S.orbit(yaw); if (reduce || paused) S.frame(lastT); };
  cv.onpointerup = () => { if (drag && !drag.moved) { paused = !paused; el.classList.toggle('paused', paused); } drag = null; };
  let lastT = .45, tp = 0;
  const tick = now => {
    if (!paused) { tp += Math.min(50, now - (tick.prev || now)); lastT = reduce ? .45 : (tp % dur) / dur; }
    tick.prev = now; S.frame(lastT);
    if (!reduce || drag) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  current = { dispose: S.dispose };
}

// Vianetsintä: nivelten paikat (y) annetulla hetkellä
export async function debugJoints(ex, sex, t = 0) {
  const key0 = MQ.classify(ex), a = Object.assign({ key: key0 }, MQ.ARCH[key0]);
  const M = await load(sex === 'female' ? 'female' : 'male');
  pose(M, a, MQ.poseAt(a, t));
  const r = {}; ['pelvis', 'spine_03', 'Head', 'upperarm_r', 'lowerarm_r', 'hand_r', 'ball_r', 'calf_r'].forEach(n => { const v = wp(M, n); r[n] = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; });
  r.drop = +dropY(M, a).toFixed(2);
  return r;
}
