// 水下世界：A/B 暴風雨之後潛進海裡。用光與水的意象講混音與母帶在做什麼（6 段），最後是作品氣泡牆。
// 座標：水面 y=0，往 -z 前進。每一段放在鏡頭路徑旁，鏡頭在每一段前停留（和島一樣）。
import * as THREE from 'three';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const range = (a, b, x) => clamp01((x - a) / (b - a));
const ss = (a, b, x) => { const t = range(a, b, x); return t * t * (3 - 2 * t); };

export const CHAPTERS = [
  { key: 'tuning', en: 'Tuning', zh: '修音', line: '把每個音，輕輕放回它該在的位置。' },
  { key: 'eq', en: 'Equalizer', zh: 'EQ', line: '收掉混濁，讓該亮的頻率亮起來。' },
  { key: 'comp', en: 'Compression', zh: '壓縮', line: '忽大忽小的聲音，變得穩定而有力。' },
  { key: 'space', en: 'Space', zh: '空間', line: '殘響與延遲，替聲音蓋一座房子。' },
  { key: 'harmony', en: 'Harmony', zh: '和聲', line: '一條旋律，長出陪伴它的聲部。' },
  { key: 'master', en: 'Mastering', zh: '母帶', line: '全部收成一顆珍珠：飽滿、清透，在哪裡播都好聽。' },
];

const FOG = new THREE.Color(0.043, 0.192, 0.25); // 線性色：和背景漸層、水面淡出用同一個值，地平線才不會有接縫

// ---------- 共用：會發光的帶狀線（CPU 算點，面向 +z） ----------
const ribbonFrag = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main(){
    float a = abs(vUv.y - 0.5) * 2.0;
    float core = exp(-a * a * 5.0);
    float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
    gl_FragColor = vec4(uColor * core * ends * uOpacity, 1.0);
  }`;
const ribbonVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
function makeRibbon(n, width, color, opacity = 1) {
  const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= n; i++) {
    uv.set([i / n, 0, i / n, 1], i * 4);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color().copy(color) }, uOpacity: { value: opacity } },
    vertexShader: ribbonVert, fragmentShader: ribbonFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const P = [];
  for (let i = 0; i <= n; i++) P.push(new THREE.Vector3());
  // fn(s, out) 把 s∈[0,1] 的中心點寫進 out
  mesh.userData.set = (fn) => {
    for (let i = 0; i <= n; i++) fn(i / n, P[i]);
    for (let i = 0; i <= n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const h = width / 2, p = P[i];
      pos.set([p.x + dy * h, p.y - dx * h, p.z, p.x - dy * h, p.y + dx * h, p.z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return mesh;
}
const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

// 柔光點（給珍珠光暈、音符頭）
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- 氣泡殼：薄膜干涉的彩虹邊 ----------
const shellVert = /* glsl */`
  varying vec3 vN; varying vec3 vV;
  void main(){
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    #else
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
    #endif
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const shellFrag = /* glsl */`
  uniform float uTime, uGain; uniform vec3 uTint;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float rim = pow(f, 2.6);
    vec3 film = 0.5 + 0.5 * cos(6.2832 * (f * 1.6 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
    vec3 L = normalize(vec3(-0.4, 0.8, 0.45));
    float spec = pow(max(dot(reflect(-L, normalize(vN)), normalize(vV)), 0.0), 40.0);
    vec3 col = (film * 0.75 + uTint * 0.5) * rim * 1.5 + spec * 2.2 + uTint * 0.03;
    gl_FragColor = vec4(col * uGain, 1.0);
  }`;
function shellMaterial(tint, gain = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGain: { value: gain }, uTint: { value: new THREE.Color().copy(tint) } },
    vertexShader: shellVert, fragmentShader: shellFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// 圓形縮圖（氣泡裡的作品）
const diskFrag = /* glsl */`
  uniform sampler2D uMap; uniform float uOpacity, uPulse; uniform vec2 uRep, uOff; varying vec2 vUv;
  void main(){
    vec2 c = vUv - 0.5; float r = length(c) * 2.0;
    float mask = 1.0 - smoothstep(0.92, 1.0, r);
    vec3 col = texture2D(uMap, vUv * uRep + uOff).rgb;
    col *= mix(1.0, 0.55, smoothstep(0.35, 1.0, r)); r = clamp(r, 0.0, 1.0);          // 邊緣暗一點，像被水包著
    col += vec3(0.6, 0.85, 1.0) * pow(r, 6.0) * 0.25;
    col *= 0.82 + uPulse * 0.6;
    gl_FragColor = vec4(col * mask * uOpacity, mask * uOpacity);
  }`;

// 沒有縮圖的作品（BGM、X、得獎作）畫一張字卡
function titleCard(w) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const pal = w.group === 'special' ? ['#fff3dc', '#e9b980', '#7a4f2a'] : w.group === 'bgm' ? ['#2b5b6b', '#123744', '#f2c27b'] : ['#3a3566', '#1b1a3a', '#c9b8ff'];
  const gr = g.createRadialGradient(200, 170, 20, 256, 256, 320);
  gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = w.group === 'special' ? 'rgba(122,79,42,0.35)' : 'rgba(242,194,123,0.28)'; g.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(80, 300 + i * 14); g.lineTo(432, 300 + i * 14); g.stroke(); }
  g.fillStyle = w.group === 'special' ? '#5b3a1c' : '#f6efe6'; g.textAlign = 'center';
  g.font = '500 22px "Cormorant Garamond", serif';
  g.fillText(w.group === 'special' ? 'AWARD' : w.kind === 'x' ? 'ON X' : 'BGM', 256, 150);
  const fit = (txt, max, size, weight) => { let s = size; do { g.font = `${weight} ${s}px "Noto Serif TC", serif`; s -= 2; } while (g.measureText(txt).width > max && s > 16); };
  fit(w.title, 380, 46, 500); g.fillText(w.title, 256, 236);
  g.fillStyle = w.group === 'special' ? 'rgba(91,58,28,0.8)' : 'rgba(246,239,230,0.75)';
  fit(w.credit, 360, 26, 400); g.fillText(w.credit, 256, 400);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createUnder(renderer, tex, works) {
  const scene = new THREE.Scene();
  scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG.clone(), 0.019);
  const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
  const halo = haloTexture();

  // 環境光（給珍珠的反射）：上方亮、下方深
  {
    const env = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y; vec3 c = mix(vec3(0.02,0.07,0.1), vec3(0.5,0.95,1.0), smoothstep(-0.2, 1.0, y)); c += vec3(1.6,1.4,1.1) * smoothstep(0.82, 0.97, y); gl_FragColor = vec4(c, 1.0); }`,
    });
    env.add(new THREE.Mesh(g, m));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env).texture;
  }

  // ---------- 遠景：沉沒的管風琴聖堂（GPT 生圖） ----------
  // 邊緣用 alpha 漸層淡掉，讓整張圖融進霧裡
  const edge = document.createElement('canvas'); edge.width = 256; edge.height = 256;
  { const g = edge.getContext('2d'); const id = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const u = x / 255, v = y / 255;
      const e = Math.min(1, Math.min(u, 1 - u) / 0.28) * Math.min(1, Math.min(v, 1 - v) / 0.3);
      const a = Math.round(255 * e * e * (3 - 2 * e)); const o = (y * 256 + x) * 4;
      id.data[o] = id.data[o + 1] = id.data[o + 2] = a; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0); }
  const backMat = new THREE.MeshBasicMaterial({ map: tex.underwater || null, alphaMap: new THREE.CanvasTexture(edge), color: 0xffffff, fog: false, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
  if (!tex.underwater) backMat.color.set(0x0e3a4a);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(330, 220), backMat);
  back.renderOrder = -1; scene.add(back);

  // 背景漸層（上亮下深）
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.016,0.05,0.085), vec3(0.043,0.192,0.25), smoothstep(-0.6, 0.15, y)); c = mix(c, vec3(0.3,0.68,0.7), smoothstep(0.25, 0.95, y)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), domeMat); dome.renderOrder = -2; scene.add(dome);

  // ---------- 水面（從下往上看） ----------
  const surfMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCam; varying vec3 vW;
      void main(){
        vec2 p = vW.xz * 0.06;
        float r = sin(p.x * 3.1 + uTime * 0.7) * sin(p.y * 2.7 - uTime * 0.5) + sin((p.x + p.y) * 4.3 + uTime * 0.9) * 0.5 + sin(p.x * 9.0 - p.y * 7.0 + uTime * 1.3) * 0.25;
        float d = length(vW.xz - uCam.xz);
        float window = exp(-d * d / (2.0 * pow(max(8.0, -uCam.y * 1.1), 2.0)));
        vec3 c = mix(vec3(0.1, 0.36, 0.42), vec3(0.75, 1.05, 1.0), window);
        c += pow(max(r, 0.0), 3.0) * 0.35 * (0.3 + window);
        float fade = exp(-d / 110.0);
        gl_FragColor = vec4(mix(vec3(0.043, 0.192, 0.25), c, fade), smoothstep(0.0, 0.25, fade) * 0.95);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), surfMat);
  surface.rotation.x = Math.PI / 2; surface.position.y = 0;
  surface.renderOrder = -1.5; // 一律先畫（它是最遠的背景）；不然原點在鏡頭後面時會被排到最後，蓋住氣泡
  scene.add(surface);

  // ---------- 海床與焦散光 ----------
  const bedMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec3 vW;
#include <fog_pars_fragment>
      float c(vec2 p, float t){ return sin(p.x + t) + sin(p.y * 1.2 - t * 0.8) + sin((p.x + p.y) * 0.7 + t * 1.3); }
      void main(){
        vec2 p = vW.xz * 0.22;
        float k = abs(c(p, uTime * 0.9) + c(p * 1.7 + 3.1, -uTime * 0.7) * 0.6);
        float caus = pow(max(0.0, 1.0 - k * 0.42), 5.0);
        vec3 col = vec3(0.03, 0.09, 0.1) + vec3(0.35, 0.75, 0.7) * caus * 0.55;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), bedMat);
  bed.rotation.x = -Math.PI / 2; bed.position.y = -46; scene.add(bed);

  // ---------- 光柱 ----------
  const rayMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uGain; varying vec2 vUv; varying vec3 vW;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - x), 2.2) * pow(clamp(vUv.y, 0.0, 1.0), 1.6);
        a *= 0.6 + 0.4 * sin(uTime * 0.6 + vW.x * 0.3 + vW.z * 0.11);
        gl_FragColor = vec4(vec3(0.55, 0.95, 0.9) * a * 0.22 * uGain, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const rays = [];
  for (let i = 0; i < 22; i++) {
    const w = 4 + Math.random() * 9, h = 70;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(geo, rayMat);
    // 光柱只放在章節那一段；氣泡牆前面不放，免得把作品縮圖洗白
    const z = i < 18 ? 30 - i * 26 + Math.random() * 10 : -640 - (i - 18) * 40;
    m.position.set((Math.random() - 0.5) * 70, 0, z);
    m.userData.tilt = (Math.random() - 0.5) * 0.5;
    scene.add(m); rays.push(m);
  }

  // ---------- 浮游光點 ----------
  const PN = 2600, pBox = new THREE.Vector3(110, 50, 160);
  const pBase = new Float32Array(PN * 3), pPos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pBase[i * 3] = Math.random() * pBox.x; pBase[i * 3 + 1] = Math.random() * pBox.y; pBase[i * 3 + 2] = Math.random() * pBox.z; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const motes = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9fe8e0, size: 0.14, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  motes.frustumCulled = false; scene.add(motes);

  // ---------- 鏡頭路徑 ----------
  const CH_Z = (i) => -70 - i * 72;
  const CH_X = (i) => (i % 2 ? 4 : -4);
  const CH_Y = -13;
  const BUB_Z = CH_Z(5) - 150, BUB_Y = -21;
  const camPts = [new THREE.Vector3(0, -2.5, 60)], lookPts = [new THREE.Vector3(0, -9, 0)];
  for (let i = 0; i < 6; i++) { camPts.push(new THREE.Vector3(CH_X(i) * 0.5, CH_Y + 2.2, CH_Z(i) + 24)); lookPts.push(new THREE.Vector3(CH_X(i), CH_Y + 0.6, CH_Z(i))); }
  const bubCam = new THREE.Vector3(0, BUB_Y, BUB_Z + 38);
  camPts.push(bubCam.clone()); lookPts.push(new THREE.Vector3(0, BUB_Y, BUB_Z));
  const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal');
  const NP = camPts.length; // 8

  const chapters = [];
  const addCh = (i, build) => {
    const g = new THREE.Group(); g.position.set(CH_X(i), CH_Y, CH_Z(i)); scene.add(g);
    const api = build(g); chapters.push({ g, ...api }); return api;
  };

  // ---------- 1 修音：歪歪扭扭的音高線，被吸回五線譜 ----------
  addCh(0, (g) => {
    const staff = [];
    for (let k = 0; k < 5; k++) { const r = makeRibbon(2, 0.06, new THREE.Color(0.8, 0.75, 0.6), 0.35); r.userData.set((s, o) => o.set(-15 + s * 30, k * 1.2 - 1.2, 0)); g.add(r); staff.push(r); }
    const notes = [0, 2, 3, 2, 4, 6, 5, 3]; // 以格（半線距 0.6）為單位
    const det = [0.7, -0.55, 0.45, -0.8, 0.6, -0.4, 0.75, -0.6];
    const curve = makeRibbon(320, 0.2, new THREE.Color(3.2, 2.2, 1.2)); g.add(curve);
    const heads = notes.map(() => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(3, 2.1, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.scale.setScalar(1.3); g.add(m); return m; });
    const ny = (v) => -1.2 + v * 0.6;
    return {
      update(t, u) {
        const k = ss(0.12, 0.72, u);
        curve.userData.set((s, o) => {
          const f = s * 8, seg = Math.min(7, Math.floor(f)), fr = f - seg;
          const a = notes[seg], b = notes[Math.min(7, seg + 1)];
          const tgt = a + (b - a) * ss(0.82, 1.0, fr);
          const raw = tgt + det[seg] * (1 - ss(0.0, 0.25, fr)) * 0.9 + Math.sin(s * 47 + t * 2.3) * 0.45 + Math.sin(s * 113 - t * 3.7) * 0.18 + Math.sin(fr * Math.PI) * det[(seg + 3) % 8] * 0.6;
          o.set(-14 + s * 28, ny(raw + (tgt - raw) * k) + Math.sin(fr * 40 + t * 9) * 0.04 * k, 0);
        });
        heads.forEach((h, i) => { h.position.set(-14 + (i + 0.45) * 3.5, ny(notes[i]), 0.05); h.material.opacity = k * (0.6 + 0.4 * Math.sin(t * 2 + i)); });
        staff.forEach((r) => { r.material.uniforms.uOpacity.value = 0.25 + k * 0.35; });
      },
    };
  });

  // ---------- 2 EQ：一排像海草的光柱；混濁的低頻退下去，該亮的頻段亮起來 ----------
  addCh(1, (g) => {
    const N = 48;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1, 0.34), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), N);
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) { const s = i / (N - 1); col.setHSL(0.08 + s * 0.45, 0.7, 0.5).multiplyScalar(1.15); bars.setColorAt(i, col); }
    g.add(bars);
    const curve = makeRibbon(160, 0.12, new THREE.Color(2.6, 2.4, 2.0), 0.9); g.add(curve);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const eqGain = (s, k) => k * (-1.6 * ss(0.16, 0.0, s) - 1.1 * Math.exp(-Math.pow((s - 0.25) / 0.07, 2)) + 0.8 * Math.exp(-Math.pow((s - 0.62) / 0.08, 2)) + 0.6 * ss(0.8, 1.0, s));
    return {
      update(t, u) {
        const k = ss(0.15, 0.75, u);
        for (let i = 0; i < N; i++) {
          const s = i / (N - 1);
          let h = 2.4 + 1.6 * Math.exp(-Math.pow((s - 0.22) / 0.1, 2)) + 1.2 * Math.exp(-Math.pow((s - 0.05) / 0.06, 2)) - s * 0.9;
          h += Math.sin(t * 2.1 + i * 0.7) * 0.45 + Math.sin(t * 5.3 + i * 1.9) * 0.25 + Math.sin(t * 0.7 + i * 0.13) * 0.4;
          h = Math.max(0.15, h * Math.pow(2, eqGain(s, k) * 0.9));
          ps.set(-14 + s * 28, -2.4 + h / 2, Math.sin(i * 1.7) * 0.6); sc.set(1, h, 1); M.compose(ps, q, sc); bars.setMatrixAt(i, M);
        }
        bars.instanceMatrix.needsUpdate = true;
        curve.userData.set((s, o) => o.set(-14.5 + s * 29, 4.4 + eqGain(s, k) * 1.1, 0.4));
        curve.material.uniforms.uOpacity.value = 0.25 + k * 0.75;
      },
    };
  });

  // ---------- 3 壓縮：亂跳的光球被一層玻璃壓平，再一起抬高 ----------
  addCh(2, (g) => {
    const N = 14;
    const orbs = [], trails = [];
    const amp = [], fq = [], ph = [];
    for (let i = 0; i < N; i++) {
      amp.push(1.2 + Math.pow(Math.random(), 2.2) * 7.5); fq.push(1.4 + Math.random() * 2.2); ph.push(Math.random() * 6);
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12), glowMat(1.9, 1.25, 0.75)); g.add(o); orbs.push(o);
      const tr = makeRibbon(2, 0.12, new THREE.Color(1.4, 0.9, 0.6), 0.45); g.add(tr); trails.push(tr);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uHit: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uOpacity, uHit; varying vec2 vUv;
        void main(){ float e = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)) * smoothstep(0.5, 0.2, abs(vUv.y - 0.5));
          float grid = smoothstep(0.96, 1.0, abs(sin(vUv.x * 80.0))) * 0.25;
          vec3 c = vec3(0.6, 1.0, 1.0) * (0.14 + grid + uHit * 0.25);
          gl_FragColor = vec4(c * e * uOpacity, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    glass.rotation.x = -Math.PI / 2 + 0.18; g.add(glass);
    return {
      update(t, u) {
        const k = ss(0.08, 0.45, u), mk = ss(0.55, 0.9, u);
        const thr = THREE.MathUtils.lerp(9.5, 2.6, k);
        let hit = 0;
        for (let i = 0; i < N; i++) {
          const raw = Math.abs(Math.sin(t * fq[i] + ph[i])) * amp[i] * (0.7 + 0.3 * Math.sin(t * 0.37 + i));
          const comp = raw > thr ? thr + (raw - thr) / 5 : raw;
          if (raw > thr) hit += 1;
          const y = comp + mk * 1.8 - 3.2;
          const x = -13 + i * 2;
          orbs[i].position.set(x, y, 0);
          orbs[i].scale.setScalar(0.8 + Math.min(1, comp / 6) * 0.5);
          trails[i].userData.set((s, o) => o.set(x, -3.2 + (y + 3.2) * s, -0.05));
        }
        glass.position.y = thr - 3.2 + mk * 1.8 + 0.45;
        glass.material.uniforms.uOpacity.value = k;
        glass.material.uniforms.uHit.value += (Math.min(1, hit / 4) - glass.material.uniforms.uHit.value) * 0.2;
      },
    };
  });

  // ---------- 4 空間：光的脈衝在沉沒的聖堂裡擴散出回音 ----------
  addCh(3, (g) => {
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(3.4, 2.6, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    core.scale.setScalar(3.2); g.add(core);
    const rings = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 96), glowMat(1.6, 2.2, 2.4)); m.visible = false; g.add(m);
      rings.push({ m, born: -99 });
    }
    const echoes = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(2.4, 1.9, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.scale.setScalar(2.0); s.visible = false; g.add(s); echoes.push(s);
    }
    let last = -99, ri = 0;
    return {
      update(t, u) {
        const k = ss(0.05, 0.7, u);
        const period = 2.4;
        if (t - last > period) { last = t; const r = rings[ri++ % rings.length]; r.born = t; }
        const since = t - last;
        core.material.opacity = 0.35 + Math.exp(-since * 5) * 0.9;
        core.scale.setScalar(2.6 + Math.exp(-since * 5) * 1.6);
        const decay = THREE.MathUtils.lerp(0.5, 3.2, k);
        for (const r of rings) {
          const age = t - r.born;
          if (age < 0 || age > decay * 2.2) { r.m.visible = false; continue; }
          r.m.visible = true;
          const rad = 1 + age * THREE.MathUtils.lerp(2.6, 4.2, k);
          r.m.scale.setScalar(rad);
          r.m.material.opacity = Math.exp(-age / decay * 1.4) * 0.8 * (1 - smooth(range(10, 22, rad)));
        }
        // 延遲：左右來回、越來越淡
        const nEcho = Math.round(k * 6);
        echoes.forEach((e, i) => {
          const at = (i + 1) * 0.32;
          e.visible = i < nEcho && since > at;
          if (!e.visible) return;
          const side = i % 2 ? 1 : -1;
          e.position.set(side * (2.6 + i * 1.5), Math.sin(i) * 0.3, -i * 0.4);
          e.material.opacity = Math.pow(0.62, i + 1) * Math.exp(-(since - at) * 1.6) * 1.6;
        });
      },
    };
  });

  // ---------- 5 和聲：一條旋律分出三個聲部，彼此纏繞 ----------
  addCh(4, (g) => {
    const cols = [new THREE.Color(3.2, 2.3, 1.2), new THREE.Color(3.0, 1.6, 1.4), new THREE.Color(1.6, 1.8, 3.2)];
    const offs = [0, 1.5, 2.7];
    const rib = cols.map((c) => { const r = makeRibbon(260, 0.18, c); g.add(r); return r; });
    return {
      update(t, u) {
        const sep = ss(0.12, 0.7, u);
        rib.forEach((r, j) => {
          r.userData.set((s, o) => {
            const mel = Math.sin(s * 9.4 + t * 0.5) * 1.1 + Math.sin(s * 21 - t * 0.3) * 0.35;
            o.set(-14 + s * 28, mel + (offs[j] - 1.4) * sep * 0.9, Math.sin(s * 14 + j * 2.09 + t * 0.9) * 1.1 * sep);
          });
          r.material.uniforms.uOpacity.value = j === 0 ? 1 : 0.25 + sep * 0.75;
        });
      },
    };
  });

  // ---------- 6 母帶：所有光流進一顆珍珠，被打磨到發亮 ----------
  const master = addCh(5, (g) => {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(1.6, 64, 32), new THREE.MeshPhysicalMaterial({
      color: 0xf6efe6, roughness: 0.12, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05,
      iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], envMapIntensity: 1.6, emissive: new THREE.Color(0.25, 0.2, 0.15),
    }));
    g.add(pearl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(1.4, 1.2, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.setScalar(9); g.add(glow);
    const light = new THREE.PointLight(0xffe2b8, 0, 30, 2); g.add(light);
    const N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random() * Math.PI * 2; seed[i * 3 + 2] = (Math.random() - 0.5) * 2; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flow = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(1.5, 1.2, 0.85), size: 0.11, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    flow.frustumCulled = false; g.add(flow);
    const meter = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.82, 128, 1, Math.PI / 2, 0.0001), glowMat(2.6, 2.0, 1.2)); g.add(meter);
    return {
      pearl,
      update(t, u) {
        const k = ss(0.05, 0.85, u);
        pearl.scale.setScalar(0.95 + k * 0.6 + Math.sin(t * 1.3) * 0.015);
        pearl.rotation.y = t * 0.2;
        pearl.material.emissive.setRGB(0.05 + k * 0.16, 0.045 + k * 0.13, 0.04 + k * 0.1);
        glow.material.opacity = 0.12 + k * 0.3;
        glow.scale.setScalar(5 + k * 5);
        light.intensity = k * 8;
        for (let i = 0; i < N; i++) {
          const ph = (seed[i * 3] + t * 0.12) % 1;
          const r = 1.4 + (1 - ph) * 13;
          const a = seed[i * 3 + 1] + ph * 5.5 + t * 0.2;
          pos.set([Math.cos(a) * r, seed[i * 3 + 2] * (1 - ph) * 4, Math.sin(a) * r * 0.55], i * 3);
        }
        geo.attributes.position.needsUpdate = true;
        flow.material.opacity = 0.25 + k * 0.75;
        meter.geometry.dispose();
        meter.geometry = new THREE.RingGeometry(2.7, 2.82, 128, 1, Math.PI / 2, Math.max(0.0001, -Math.PI * 2 * k));
        meter.material.opacity = k * 0.9;
      },
    };
  });

  // ---------- 作品氣泡牆 ----------
  const loader = new THREE.TextureLoader();
  const bubbles = [];
  const diskGeo = new THREE.PlaneGeometry(1, 1), shellGeo = new THREE.SphereGeometry(1, 48, 24);
  const tints = { cover: new THREE.Color(0.55, 0.75, 1.0), bgm: new THREE.Color(1.0, 0.8, 0.5), special: new THREE.Color(1.0, 0.92, 0.75) };
  works.forEach((w, i) => {
    const r = w.group === 'special' ? 3.9 : 2.6;
    const disk = new THREE.Mesh(diskGeo, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uPulse: { value: 0 }, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2(0, 0) } },
      vertexShader: ribbonVert, fragmentShader: diskFrag, transparent: true, depthWrite: false,
    }));
    disk.scale.setScalar(r * 1.72);
    const thumb = w.thumb;
    if (thumb) {
      loader.load(thumb, (tx) => {
        tx.colorSpace = THREE.SRGBColorSpace;
        // hqdefault 是 480×360（4:3），16:9 影片上下各有黑邊：只取中間那塊，再裁成正方形
        const u = disk.material.uniforms;
        // Shorts 的 hqdefault 是直式畫面左右補暗邊：中間只有約 42% 寬是影片
        if (w.kind === 'short') u.uRep.value.set(0.42, 0.56); else u.uRep.value.set(0.5625, 0.75);
        u.uOff.value.set((1 - u.uRep.value.x) / 2, (1 - u.uRep.value.y) / 2);
        u.uMap.value = tx;
      });
    } else {
      disk.material.uniforms.uMap.value = titleCard(w);
    }
    const shell = new THREE.Mesh(shellGeo, shellMaterial(tints[w.group]));
    shell.scale.setScalar(r);
    const grp = new THREE.Group(); grp.add(disk); grp.add(shell);
    scene.add(grp);
    shell.userData.bubble = i;
    bubbles.push({ w, r, grp, disk, shell, base: new THREE.Vector3(), hover: 0, play: 0, appear: 0, seed: Math.random() * 10 });
  });
  function layoutBubbles(aspect) {
    const narrow = aspect < 1;
    const rx = narrow ? 10 : Math.min(30, 16.5 * aspect), ry = narrow ? 24 : 15.5;
    const n = bubbles.length, ga = Math.PI * (3 - Math.sqrt(5));
    bubbles.forEach((b, i) => {
      const rr = Math.sqrt((i + 1.4) / (n + 1.4));
      const a = i * ga;
      b.base.set(Math.cos(a) * rr * rx, BUB_Y + Math.sin(a) * rr * ry, BUB_Z + Math.sin(i * 2.3) * 4);
      if (b.w.group === 'special') b.base.set(0, BUB_Y, BUB_Z + 3);
    });
    bubCam.z = BUB_Z + (narrow ? 74 : 46);
    camPts[NP - 1].copy(bubCam);
    camCurve.updateArcLengths();
  }
  // 讓得獎作在正中間：把它換到 0 號
  {
    const si = bubbles.findIndex((b) => b.w.group === 'special');
    if (si > 0) { const [s] = bubbles.splice(si, 1); bubbles.unshift(s); }
  }

  // ---------- 上升的氣泡群（轉場用，平常也有零星幾顆） ----------
  const RB = 260;
  const rising = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 12), shellMaterial(new THREE.Color(0.7, 0.9, 1.0), 0.9), RB);
  rising.frustumCulled = false; scene.add(rising);
  const rs = [];
  for (let i = 0; i < RB; i++) rs.push({ p: new THREE.Vector3(), r: 0.1, v: 1, wob: Math.random() * 6, alive: false });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  function spawn(b, burst, center) {
    b.alive = true;
    const big = burst > 0 && Math.random() < burst;
    b.r = big ? 0.6 + Math.random() * 2.4 : 0.05 + Math.random() * 0.18;
    b.v = big ? 6 + Math.random() * 10 : 1.5 + Math.random() * 2.5;
    b.p.set(center.x + (Math.random() - 0.5) * (big ? 60 : 90), center.y - 30 - Math.random() * 30, center.z - 10 - Math.random() * (big ? 50 : 120));
  }

  // ---------- 姿態 ----------
  const tmpV = new THREE.Vector3();
  // 回傳鏡頭、目前段落與每段的進度
  function pose(p, T, out) {
    out.up.set(0, 1, 0);
    out.chapter = -1; out.chW = 0; out.bubbles = 0; out.rise = 0;
    // 進度：diveStart → underEnd 走過 0..6（每段停留），underEnd → bubStart 到氣泡牆
    let idxf;
    if (p < T.underEnd) idxf = range(T.diveStart, T.underEnd, p) * 6.5;
    else idxf = 6.5 + range(T.underEnd, T.bubStart, p) * 0.5;
    idxf = Math.min(idxf, NP - 1);
    const i0 = Math.min(Math.floor(idxf), NP - 2), fr = idxf - i0;
    const f = fr - Math.sin(2 * Math.PI * fr) / (2 * Math.PI) * 0.9;
    const uu = (i0 + f) / (NP - 1);
    camCurve.getPoint(uu, out.pos); lookCurve.getPoint(uu, out.look);
    out.idxf = idxf;
    const near = Math.round(idxf);
    if (near >= 1 && near <= 6) { out.chapter = near - 1; out.chW = 1 - range(0.22, 0.4, Math.abs(idxf - near)); }
    out.bubbles = range(T.underEnd + (T.bubStart - T.underEnd) * 0.5, T.bubStart, p) * (1 - range(T.bubEnd, T.bubEnd + (T.bubTEnd - T.bubEnd) * 0.4, p));
    // 轉場：往上看，氣泡群上升
    if (p > T.bubEnd) {
      const a = smooth(range(T.bubEnd, T.bubTEnd, p));
      out.rise = a;
      out.pos.y += a * 8;
      tmpV.set(0, BUB_Y + 60, BUB_Z - 30);
      out.look.lerp(tmpV, smooth(range(0, 0.8, a)));
    }
    return out;
  }

  let riseBurst = 0;
  function update(t, dt, st) {
    surfMat.uniforms.uTime.value = t; surfMat.uniforms.uCam.value.copy(cam.position);
    bedMat.uniforms.uTime.value = t;
    rayMat.uniforms.uTime.value = t;
    const deep = clamp01(-cam.position.y / 14);
    rayMat.uniforms.uGain.value = 0.8 + (1 - deep) * 0.5;
    for (const r of rays) { r.rotation.set(0, Math.atan2(cam.position.x - r.position.x, cam.position.z - r.position.z), r.userData.tilt); }
    // 背景聖堂：一直在前方遠處，靠近「空間」那段最清楚
    back.position.set(cam.position.x * 0.6, cam.position.y + 12, cam.position.z - 330);
    const spaceW = st.chapter === 3 ? st.chW : 0;
    backMat.opacity = 0.32 + spaceW * 0.5;
    // 浮游光點跟著鏡頭繞
    const cp = cam.position;
    for (let i = 0; i < PN; i++) {
      const bx = pBase[i * 3] + Math.sin(t * 0.1 + i) * 0.5, by = pBase[i * 3 + 1] + t * 0.15, bz = pBase[i * 3 + 2];
      pPos[i * 3] = cp.x - pBox.x / 2 + (((bx - cp.x) % pBox.x) + pBox.x) % pBox.x;
      pPos[i * 3 + 1] = Math.min(-0.3, cp.y - pBox.y / 2 + (((by - cp.y) % pBox.y) + pBox.y) % pBox.y);
      pPos[i * 3 + 2] = cp.z - pBox.z / 2 + (((bz - cp.z) % pBox.z) + pBox.z) % pBox.z;
    }
    pGeo.attributes.position.needsUpdate = true;

    // 各段動畫：只更新看得到的
    chapters.forEach((c, i) => {
      const u = clamp01((st.idxf - (i + 1)) * 0.85 + 0.55);
      const vis = Math.abs(st.idxf - (i + 1)) < 1.6;
      c.g.visible = vis;
      if (vis) c.update(t, u);
    });

    // 氣泡牆
    bubbles.forEach((b, i) => {
      b.appear += ((st.bubbles > 0.02 ? 1 : 0) * clamp01(st.bubbles * 2.2 - i * 0.03) - b.appear) * Math.min(1, dt * 3);
      const a = b.appear;
      b.grp.visible = a > 0.003;
      if (!b.grp.visible) return;
      const wob = Math.sin(t * 0.55 + b.seed) * 0.35;
      b.grp.position.set(b.base.x + Math.sin(t * 0.3 + b.seed) * 0.25, b.base.y + wob - (1 - smooth(a)) * 14, b.base.z);
      const target = 1 + b.hover * 0.14 + b.play * 0.28;
      const sc = smooth(a) * target * (1 + (st.level || 0) * b.play * 0.12);
      b.grp.scale.setScalar(sc);
      b.disk.quaternion.copy(cam.quaternion);
      b.disk.material.uniforms.uOpacity.value = a * (b.play > 0.5 && b.w.kind !== 'mp3' ? 1 - b.play * 0.0 : 1);
      b.disk.material.uniforms.uPulse.value = b.play * (st.level || 0) * 2.5;
      b.shell.material.uniforms.uTime.value = t + b.seed;
      b.shell.material.uniforms.uGain.value = a * (0.85 + b.hover * 0.6 + b.play * 0.7);
    });

    // 上升的小氣泡：平常零星；轉場時大量、大顆
    riseBurst = st.rise;
    const want = Math.floor(30 + st.rise * (RB - 30));
    for (let i = 0; i < RB; i++) {
      const b = rs[i];
      if (!b.alive) { if (i < want) spawn(b, st.rise, cp); else { M.makeScale(0, 0, 0); rising.setMatrixAt(i, M); continue; } }
      b.p.y += b.v * dt * (1 + st.rise * 2.5);
      b.p.x += Math.sin(t * 2 + b.wob) * dt * 0.6;
      if (b.p.y > -0.4 || b.p.y > cp.y + 45) b.alive = false;
      S.setScalar(b.r); M.compose(b.p, Q, S); rising.setMatrixAt(i, M);
    }
    rising.instanceMatrix.needsUpdate = true;
    rising.material.uniforms.uTime.value = t;
  }

  // 滑鼠指到哪顆氣泡
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hits = ray.intersectObjects(bubbles.filter((b) => b.appear > 0.6).map((b) => b.shell), false);
    return hits.length ? hits[0].object.userData.bubble : -1;
  }
  // 依 bubbles 陣列索引（已重排）找作品
  function resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); layoutBubbles(w / h); }
  layoutBubbles(innerWidth / innerHeight);
  bubbles.forEach((b, i) => { b.shell.userData.bubble = i; });

  return { scene, cam, pose, update, resize, pick, bubbles, chapters: CHAPTERS, master, get burst() { return riseBurst; } };
}
