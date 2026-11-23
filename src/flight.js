// 雲上飛行：氣泡轉場之後，在金色的雲海上飛，價目卡從雲間浮出；最後穿過雲層往下，接回俯瞰旋律。
// 物件直接加進五線譜之海的場景（同一片天空、同一個太陽），只在這一段顯示。
import * as THREE from 'three';
import { PRICES } from './portfolio.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const range = (a, b, x) => clamp01((x - a) / (b - a));

const floorVert = /* glsl */`
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
  }`;
const floorFrag = /* glsl */`
  uniform float uTime, uVis, uNear; uniform vec3 uCam;
  varying vec3 vW;
  #include <fog_pars_fragment>
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * n(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  void main(){
    vec2 p = vW.xz * 0.0085 + vec2(uTime * 0.01, uTime * 0.03);
    float d = fbm(p);
    float dens = smoothstep(0.26, 0.5, d);
    // 用往太陽方向（-z）的密度差當作受光面：朝陽的雲頂亮、背面暗
    float shade = clamp(0.55 + (d - fbm(p + vec2(0.0, -0.06))) * 5.0, 0.0, 1.0);
    float top = smoothstep(0.45, 0.8, d);
    vec3 shadow = vec3(0.56, 0.48, 0.74), light = vec3(1.35, 1.0, 0.8);
    vec3 col = mix(shadow, light, shade) * (0.72 + top * 0.4 + dens * 0.15);
    vec3 v = normalize(vW - uCam);
    col += vec3(1.0, 0.6, 0.35) * pow(max(0.0, -v.z), 5.0) * 0.4 * shade;
    float a = mix(0.82, 1.0, dens) * uVis * (1.0 - uNear); // 連成一片雲毯，形狀靠明暗
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
    #include <fog_fragment>
  }`;

async function drawCard(c) {
  const W = 1024, H = 1408;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const navy = '#1d2b55', dim = '#56607e', gold = '#b9864a';
  // 底：半透明奶油色玻璃
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(255,251,245,0.93)'); bg.addColorStop(1, 'rgba(250,238,228,0.88)');
  rr(8, 8, W - 16, H - 16, 54); g.fillStyle = bg; g.fill();
  rr(34, 34, W - 68, H - 68, 36); g.strokeStyle = 'rgba(185,134,74,0.55)'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // 標籤
  g.fillStyle = gold; g.font = 'italic 500 40px "Cormorant Garamond"';
  const spaced = c.tag.split('').join('  ');
  g.fillText(spaced, W / 2, 150);
  // 標題
  g.fillStyle = navy; g.font = '500 96px "Noto Serif TC"';
  g.fillText(c.title, W / 2, 285);
  let y = 345;
  if (c.sub) { g.fillStyle = dim; g.font = '400 36px "Noto Sans TC"'; g.fillText(c.sub, W / 2, y); y += 40; }
  g.strokeStyle = 'rgba(185,134,74,0.6)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2 - 60, y + 20); g.lineTo(W / 2 + 60, y + 20); g.stroke();
  y += 120;
  // 價格
  for (const [lbl, price] of c.rows) {
    g.textAlign = 'left'; g.fillStyle = dim; g.font = '400 42px "Noto Sans TC"'; g.fillText(lbl, 120, y);
    g.textAlign = 'right'; g.fillStyle = navy; g.font = '600 74px "Cormorant Garamond"';
    const pw = g.measureText(price).width; g.fillText(price, W - 210, y);
    g.font = '500 34px "Cormorant Garamond"'; g.fillStyle = gold; g.fillText('NTD', W - 120, y);
    g.strokeStyle = 'rgba(29,43,85,0.22)'; g.setLineDash([3, 9]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(230, y - 14); g.lineTo(W - 230 - pw, y - 14); g.stroke(); g.setLineDash([]);
    y += 120;
  }
  if (c.rows.length) y += 10;
  // 備註
  g.textAlign = c.tag === 'HOW' ? 'left' : 'center';
  const nx = c.tag === 'HOW' ? 210 : W / 2;
  g.fillStyle = '#34406a'; g.font = '400 40px "Noto Sans TC"';
  for (const line of c.notes) { g.fillText(line, nx, y); y += c.tag === 'HOW' ? 92 : 72; }
  // 頁尾
  if (c.foot) {
    g.textAlign = 'center'; g.fillStyle = gold; g.font = '500 34px "Noto Sans TC"';
    g.fillText(c.foot, W / 2, H - 120);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,220,180,0.9)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export async function createFlight(sea, tex) {
  const scene = sea.scene;
  try {
    await Promise.all(['500 96px "Noto Serif TC"', '400 40px "Noto Sans TC"', '600 74px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"'].map((f) => document.fonts.load(f, '價目表 Cover NTD 0123')));
  } catch (e) { /* 字型載不到就用系統字 */ }

  const group = new THREE.Group(); scene.add(group); group.visible = false;
  let H = sea.topHeight(), FLOOR = H + 170;
  const zMid = sea.zMid;
  const Z0 = zMid + 1500;

  // ---------- 雲海地板 ----------
  const floorMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uVis: { value: 0 }, uNear: { value: 0 }, uCam: { value: new THREE.Vector3() } }]),
    vertexShader: floorVert, fragmentShader: floorFrag, fog: true, transparent: true, depthWrite: true, side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000, 1, 1), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 5; group.add(floor);

  // ---------- 遠方雲海（GPT 生圖） ----------
  const premul = (t) => { if (t) { t.premultiplyAlpha = true; t.needsUpdate = true; } return t; };
  [tex.cloudsC, tex.cloudsD, tex.cloudsea].forEach(premul);
  const pmBlend = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  const far = [];
  if (tex.cloudsea) {
    for (let i = 0; i < 3; i++) {
      const w = 5200, h = w * (tex.cloudsea.image.height / tex.cloudsea.image.width);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex.cloudsea, fog: false, ...pmBlend }));
      m.userData.off = new THREE.Vector3((i - 1) * 4200, 0, -3200 - Math.abs(i - 1) * 600);
      m.renderOrder = 6; group.add(m); far.push(m);
    }
  }

  // ---------- 掠過身邊的雲 ----------
  const puffs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const puffTex = [tex.cloudsC, tex.cloudsD].filter(Boolean);
  if (puffTex.length) {
    for (let i = 0; i < 46; i++) {
      const t = puffTex[i % puffTex.length];
      const mat = new THREE.SpriteMaterial({ map: t, fog: true, ...pmBlend, color: new THREE.Color(1, 1, 1) });
      const s = new THREE.Sprite(mat);
      const near = i < 14;
      const w = near ? rnd(45, 90) : rnd(160, 420);
      s.scale.set(w, w * (t.image.height / t.image.width), 1);
      const side = i % 2 ? 1 : -1;
      s.userData.rel = new THREE.Vector3(near ? side * rnd(26, 60) : side * rnd(60, 520), near ? rnd(-14, 26) : rnd(-30, 140), 0);
      s.userData.z = Z0 + 200 - (i / 46) * 1700 + rnd(-60, 60);
      s.userData.a = near ? 0.92 : 0.85;
      s.renderOrder = 7;
      group.add(s); puffs.push(s);
    }
  }

  // ---------- 價目卡 ----------
  const halo = haloTex();
  const cards = [];
  const CARD_W = 22, CARD_H = CARD_W * 1408 / 1024;
  for (let i = 0; i < PRICES.length; i++) {
    const map = await drawCard(PRICES[i]);
    const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.7, 1.7, 1.7), transparent: true, depthWrite: false, fog: false, opacity: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), mat);
    m.renderOrder = 8;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    glow.scale.set(CARD_W * 2.2, CARD_H * 1.6, 1); glow.renderOrder = 7;
    group.add(glow); group.add(m);
    cards.push({ m, glow, side: i % 2 ? 1 : -1, z: Z0 - 160 - i * 190 });
  }
  const Z1 = cards[cards.length - 1].z - 150;

  // ---------- 鏡頭路徑 ----------
  let camCurve, lookCurve, NP;
  function build() {
    H = sea.topHeight(); FLOOR = H + 170;
    floor.position.set(0, FLOOR, zMid);
    const narrow = sea.cam.aspect < 1;
    const cp = [new THREE.Vector3(0, FLOOR + 75, Z0 + 80)], lp = [new THREE.Vector3(0, FLOOR + 40, Z0 - 260)];
    cards.forEach((c) => {
      const x = c.side * (narrow ? 0 : 16);
      c.m.position.set(x, FLOOR + 56, c.z);
      c.m.rotation.set(0, -c.side * (narrow ? 0 : 0.32), 0);
      c.glow.position.set(x, FLOOR + 56, c.z - 1);
      c.base = c.m.position.clone();
      const dist = narrow ? 78 : 50;
      cp.push(new THREE.Vector3(x * 0.35, FLOOR + 54, c.z + dist));
      lp.push(new THREE.Vector3(x * 0.85, FLOOR + 55.5, c.z));
    });
    cp.push(new THREE.Vector3(0, FLOOR + 40, Z1)); lp.push(new THREE.Vector3(0, FLOOR - 60, Z1 - 260));
    camCurve = new THREE.CatmullRomCurve3(cp, false, 'centripetal');
    lookCurve = new THREE.CatmullRomCurve3(lp, false, 'centripetal');
    NP = cp.length;
    far.forEach((m) => m.position.set(m.userData.off.x, FLOOR + 160, Z1 + m.userData.off.z));
    puffs.forEach((s) => { s.position.set(s.userData.rel.x, FLOOR + s.userData.rel.y, s.userData.z); });
  }
  build();

  const top = new THREE.Vector3(), topLook = new THREE.Vector3(), endPos = new THREE.Vector3(), endLook = new THREE.Vector3();
  // flight：bubTStart → flightEnd；descend：flightEnd → descEnd
  function pose(p, T, out) {
    out.up.set(0, 1, 0);
    out.reveal = 0; out.card = -1;
    if (p <= T.flightEnd) {
      const s = range(T.bubTStart, T.flightEnd, p);
      const idxf = s * (NP - 1);
      const i0 = Math.min(Math.floor(idxf), NP - 2), fr = idxf - i0;
      const f = fr - Math.sin(2 * Math.PI * fr) / (2 * Math.PI) * 0.9;
      const u = (i0 + f) / (NP - 1);
      camCurve.getPoint(u, out.pos); lookCurve.getPoint(u, out.look);
      const near = Math.round(idxf);
      if (near >= 1 && near <= cards.length) out.card = near - 1;
      out.headZ = out.pos.z;
      return out;
    }
    camCurve.getPoint(1, endPos); lookCurve.getPoint(1, endLook);
    top.set(H * 0.04, H, zMid); topLook.set(H * 0.04, 0, zMid);
    const a = smooth(range(T.flightEnd, T.descEnd, p));
    out.pos.lerpVectors(endPos, top, a);
    out.pos.y = THREE.MathUtils.lerp(endPos.y, H, Math.pow(a, 0.75));
    out.look.lerpVectors(endLook, topLook, smooth(range(0.0, 0.7, a)));
    const ua = smooth(range(0.35, 1.0, a));
    out.up.set(-ua, 1 - ua, 0).normalize();
    out.reveal = smooth(range(0.55, 1.0, a));
    out.headZ = zMid;
    return out;
  }

  const fogWhite = new THREE.Color(1.0, 0.9, 0.86);
  const tmp = new THREE.Vector3();
  function update(t, dt, p, T, cam) {
    const vis = range(T.bubTStart, T.bubTStart + (T.bubTEnd - T.bubTStart) * 0.5, p) * (1 - range(T.flightEnd + (T.descEnd - T.flightEnd) * 0.55, T.descEnd, p));
    group.visible = vis > 0.001;
    if (!group.visible) return 0;
    const dy = cam.position.y - FLOOR;
    const near = Math.exp(-Math.abs(dy) / 22) * (p > T.flightEnd ? 1 : 0);
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uVis.value = vis;
    floorMat.uniforms.uNear.value = clamp01(near * 1.2) * (dy < 0 ? 1 : 0.6);
    floorMat.uniforms.uCam.value.copy(cam.position);
    // 穿過雲層時整個畫面泛白（霧變白變濃）
    scene.fog.color.lerp(fogWhite, clamp01(near * 1.1) * vis);
    scene.fog.density += near * 0.014 * vis;
    const desc = range(T.flightEnd, T.flightEnd + (T.descEnd - T.flightEnd) * 0.25, p);
    far.forEach((m) => { m.material.opacity = vis * (1 - desc); m.visible = desc < 1; m.lookAt(cam.position.x, m.position.y, cam.position.z); });
    puffs.forEach((s, i) => {
      s.position.x = s.userData.rel.x + Math.sin(t * 0.03 + i) * 8;
      const d = s.position.distanceTo(cam.position);
      s.material.opacity = vis * s.userData.a * clamp01((d - 30) / 70);
    });
    cards.forEach((c, i) => {
      tmp.copy(c.base);
      c.m.position.set(tmp.x, tmp.y + Math.sin(t * 0.6 + i) * 0.5, tmp.z);
      c.m.rotation.z = Math.sin(t * 0.4 + i * 1.7) * 0.012;
      const dz = cam.position.z - c.base.z;          // 鏡頭在卡片前方時是正的
      const show = clamp01((260 - dz) / 120) * clamp01((dz + 8) / 16);
      c.m.material.opacity = vis * show;
      c.glow.material.opacity = vis * show * 0.35;
    });
    return vis;
  }

  return { pose, update, resize: build, get floor() { return FLOOR; } };
}
