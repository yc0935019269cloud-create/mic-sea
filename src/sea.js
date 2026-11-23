// 五線譜之海：主場景。z 軸是時間（往 -z 前進），x 軸是音高（x 越小音越高）。
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { WORKS, MELODY } from './data.js';

export const STAFF_GAP = 5;                       // 相鄰音（線到間）的距離
export const pitchX = (k) => 20 - k * STAFF_GAP;  // k=0 最下線 → x=20；k=8 最上線 → x=-20
export const islandZ = (i) => -40 - i * 36;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const range = (a, b, x) => clamp01((x - a) / (b - a));

function rockFactor(a, seed) {
  return 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2.3) + 0.03 * Math.sin(a * 13 + seed * 0.7);
}

function makeRock(seed) {
  const geo = new THREE.CylinderGeometry(4.4, 2.0, 5, 56, 10);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const a = Math.atan2(v.z, v.x);
    const yn = (v.y + 2.5) / 5; // 0 底 → 1 頂
    let f = rockFactor(a, seed);
    f += (1 - yn) * (0.12 * Math.sin(a * 5 + v.y * 1.7 + seed) + 0.06 * Math.sin(a * 11 - v.y * 3.1));
    v.x *= f; v.z *= f;
    v.y += (1 - yn) * 0.25 * Math.sin(a * 4 + seed);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeCap(seed) {
  const geo = new THREE.CylinderGeometry(4.55, 4.4, 0.42, 56, 1);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const f = rockFactor(Math.atan2(v.z, v.x), seed);
    pos.setXYZ(i, v.x * f, v.y, v.z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

function placeholderLandmark(accent) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 6, 6), new THREE.MeshStandardMaterial({ color: 0xf3e6dc, roughness: 0.7 }));
  m.position.y = 3; g.add(m);
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: accent, emissiveIntensity: 3 }));
  top.position.y = 6.8; g.add(top);
  g.userData.update = (t) => { top.rotation.y = t; };
  return g;
}

const staffVert = /* glsl */`
  varying vec3 vW; varying vec2 vUv;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const staffFrag = /* glsl */`
  uniform float uTime, uGlow, uHeadZ, uStorm;
  varying vec3 vW; varying vec2 vUv;
  void main(){
    float across = abs(vUv.x - 0.5) * 2.0;
    float core = exp(-across * across * 5.0);
    float ends = smoothstep(90.0, 40.0, vW.z) * smoothstep(-420.0, -340.0, vW.z);
    float pulse = pow(0.5 + 0.5 * sin(vW.z * 0.045 + uTime * 1.6), 10.0);
    float head = exp(-abs(vW.z - uHeadZ) / 60.0);
    float flick = mix(1.0, 0.55 + 0.45 * sin(uTime * 31.0 + vW.z), uStorm);
    vec3 col = vec3(1.7, 1.32, 0.92) * (0.35 + pulse * 1.1 + head * 0.8) * uGlow * flick;
    gl_FragColor = vec4(col * core * ends, 1.0);
  }`;

export function createSea(renderer, tex, buildLandmark) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 20000);
  const fogCalm = new THREE.Color(0xd9a493), fogStorm = new THREE.Color(0x3c3a45);
  const FOG_CALM = 0.00042;
  scene.fog = new THREE.FogExp2(fogCalm.clone(), FOG_CALM);

  // ---------- 天空與太陽 ----------
  const sun = new THREE.Vector3();
  const sky = new Sky(); sky.scale.setScalar(15000);
  const su = sky.material.uniforms;
  const skyCalm = { turbidity: 6.5, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.86, elevation: 2.4 };
  const skyStorm = { turbidity: 20, rayleigh: 0.35, mieCoefficient: 0.03, mieDirectionalG: 0.6, elevation: -0.6 };
  const azimuth = 172;
  function setSun(elev) {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azimuth));
    su.sunPosition.value.copy(sun);
  }
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) su[k].value = skyCalm[k];
  setSun(skyCalm.elevation);

  // 用天空產生環境光（讓島與建築吃到黃昏的反光）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.add(sky);
  scene.environmentIntensity = 0.9;

  // ---------- 水 ----------
  const water = new Water(new THREE.PlaneGeometry(20000, 20000), {
    textureWidth: 512, textureHeight: 512, waterNormals: tex.waterNormals, sunDirection: sun.clone(),
    sunColor: 0xffd6a8, waterColor: 0x0d2333, distortionScale: 2.4, fog: true, alpha: 1.0,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 1.6;
  scene.add(water);
  const waterCalm = new THREE.Color(0x0d2333), waterStorm = new THREE.Color(0x232530);

  // ---------- 光 ----------
  const hemi = new THREE.HemisphereLight(0xffc7b8, 0x2a2440, 0.9); scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb98a, 2.6); scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x8fa6ff, 0.5); fillLight.position.set(60, 40, 120); scene.add(fillLight);

  // ---------- 五線譜 ----------
  const staffMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 1 }, uHeadZ: { value: 0 }, uStorm: { value: 0 } },
    vertexShader: staffVert, fragmentShader: staffFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const staffLines = [];
  for (const k of [0, 2, 4, 6, 8]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 520), staffMat);
    m.rotation.x = -Math.PI / 2; m.position.set(pitchX(k), 0.12, -150); m.scale.x = 0.4;
    m.renderOrder = 3; scene.add(m); staffLines.push(m);
  }

  // ---------- 島 ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb08a7c, roughness: 0.95, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x7d9a74, roughness: 0.9, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8a66, roughness: 0.85, flatShading: true });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf2a7b8, roughness: 0.8, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4034, roughness: 0.9 });
  const flowerGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const islands = [];
  const camPts = [], lookPts = [];
  camPts.push(new THREE.Vector3(6, 14, 70)); lookPts.push(new THREE.Vector3(0, 3, -60));

  WORKS.forEach((w, i) => {
    const k = MELODY[i], x = pitchX(k), z = islandZ(i), seed = i * 1.37 + 0.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const rock = new THREE.Mesh(makeRock(seed), rockMat); rock.position.y = -0.9; g.add(rock);
    const cap = new THREE.Mesh(makeCap(seed), capMat); cap.position.y = 1.78; g.add(cap);
    // 小石頭
    for (let s = 0; s < 7; s++) {
      const a = seed * 3 + s * 0.9, r = 4.6 + (s % 3) * 0.7;
      const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + (s % 4) * 0.22, 0), rockMat);
      st.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); st.rotation.set(s, s * 2, 0); g.add(st);
    }
    // 花
    const flowers = new THREE.InstancedMesh(flowerGeo, blossomMat, 36);
    const m4 = new THREE.Matrix4();
    for (let f = 0; f < 36; f++) {
      const a = f * 2.399 + seed, r = 2.6 + (f % 5) * 0.35;
      m4.makeTranslation(Math.cos(a) * r, 2.02, Math.sin(a) * r); flowers.setMatrixAt(f, m4);
    }
    g.add(flowers);
    // 樹（一兩棵，呼應主視覺）
    const trees = 1 + (i % 2);
    for (let tr = 0; tr < trees; tr++) {
      const a = seed * 2 + tr * 2.4 + 2.2, r = 3.1;
      const tg = new THREE.Group(); tg.position.set(Math.cos(a) * r, 1.95, Math.sin(a) * r);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 6), trunkMat); trunk.position.y = 0.9; tg.add(trunk);
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 + tr * 0.2, 1), (i + tr) % 3 === 0 ? blossomMat : leafMat);
      foliage.position.y = 2.2; foliage.scale.set(1.2, 0.9, 1.2); tg.add(foliage);
      g.add(tg);
    }
    // 地標
    let lm;
    try { lm = buildLandmark ? buildLandmark(w.landmark, { accent: w.accent, base: 0xf3e6dc, seed: i }) : null; } catch (e) { console.warn('landmark failed', w.landmark, e); }
    if (!lm) lm = placeholderLandmark(w.accent);
    lm.position.y = 1.98; lm.rotation.y = Math.PI * 0.25 + (i % 3) * 0.3; g.add(lm);
    // 封面畫框（朝向鏡頭路徑）
    const frame = new THREE.Group(); frame.position.set(7, 7.4, -6); frame.rotation.y = Math.atan2(12, 25);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.55, 0.9), transparent: true, opacity: 0.9 }));
    glow.position.z = -0.02; frame.add(glow);
    const coverTex = tex.covers[i];
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), new THREE.MeshBasicMaterial({ map: coverTex || null, color: coverTex ? new THREE.Color(1.6, 1.6, 1.6) : 0x333333 }));
    frame.add(cover);
    g.add(frame);

    const island = { group: g, landmark: lm, frame, glow, x, z, k, pulse: 0 };
    islands.push(island);
    camPts.push(new THREE.Vector3(x + 19, 5.8, z + 19));
    lookPts.push(new THREE.Vector3(x + 3.5, 4.6, z - 3));
  });
  const last = islands[islands.length - 1];
  camPts.push(new THREE.Vector3(last.x + 6, 6.5, last.z - 28)); lookPts.push(new THREE.Vector3(0, 8, last.z - 400));
  const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal');
  const NPTS = camPts.length;

  // ---------- 音符（從高空才看得出來） ----------
  const glyphs = [];
  const zMid = (islandZ(0) + islandZ(WORKS.length - 1)) / 2;
  islands.forEach((isl) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.0, 4.2, 2.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.2, 64), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(isl.x, 0.3, isl.z); ring.scale.set(0.95, 1.3, 1); ring.rotation.z = -0.4; scene.add(ring);
    const up = isl.k < 4; // 低音符桿朝上（螢幕上方＝-x）並在右側（-z）
    const stemGeo = new THREE.PlaneGeometry(30, 0.9); stemGeo.translate(15, 0, 0);
    const stem = new THREE.Mesh(stemGeo, mat);
    stem.rotation.x = -Math.PI / 2;
    stem.position.set(isl.x + (up ? -1.4 : 1.4), 0.3, isl.z + (up ? -5.3 : 5.3));
    stem.rotation.z = up ? Math.PI : 0;
    scene.add(stem);
    glyphs.push({ ring, stem, mat });
  });

  // ---------- 雲（GPT 生圖） ----------
  const clouds = [];
  // 生圖的 PNG 是「直通 alpha」，透明區的 RGB 不是 0；上傳時先預乘，否則會疊出方形亮框
  for (const t of [tex.cloudsA, tex.cloudsB]) if (t) { t.premultiplyAlpha = true; t.needsUpdate = true; }
  function addCloud(t, x, y, z, w, flip = false) {
    if (!t) return;
    const h = w * (t.image.height / t.image.width);
    const mat = new THREE.MeshBasicMaterial({
      map: t, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1, 1, 1),
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); if (flip) m.scale.x = -1; m.renderOrder = 2;
    scene.add(m); clouds.push({ m, mat, base: new THREE.Vector3(x, y, z) });
  }
  addCloud(tex.cloudsA, -2100, 900, -5200, 4200);
  addCloud(tex.cloudsA, 2600, 700, -5600, 3600, true);
  addCloud(tex.cloudsB, 300, 260, -4800, 6200);
  addCloud(tex.cloudsB, -3800, 420, -3000, 4200, true);

  // ---------- 暴風雨：天幕、雨、閃電 ----------
  const veilMat = new THREE.MeshBasicMaterial({ color: fogStorm.clone(), side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const veil = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), veilMat); veil.renderOrder = 1; scene.add(veil);
  // 地平線霧帶：圍著鏡頭的圓筒，底部濃、往上淡，把雲的下緣與暗海之間的硬切線揉掉
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
    vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vY;
      void main(){ float a = pow(1.0 - smoothstep(-40.0, 1300.0, vY), 2.2) * smoothstep(-120.0, -10.0, vY); gl_FragColor = vec4(uColor, a * uOpacity); }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
  });
  const haze = new THREE.Mesh(new THREE.CylinderGeometry(3400, 3400, 1600, 96, 1, true), hazeMat);
  haze.position.y = 600; haze.renderOrder = 4; scene.add(haze);

  const RN = 6000;
  const rainPos = new Float32Array(RN * 6), rainOff = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { rainOff[i * 3] = (Math.random() - 0.5) * 110; rainOff[i * 3 + 1] = Math.random() * 45; rainOff[i * 3 + 2] = (Math.random() - 0.5) * 110; }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xc8d0e2, transparent: true, opacity: 0, fog: true, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  let flash = 0;

  // ---------- 鏡頭 ----------
  const AB_POS = new THREE.Vector3(0, 4.2, last.z - 75), AB_LOOK = new THREE.Vector3(0, 16, last.z - 1000);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function topHeight() {
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const needW = Math.abs(islandZ(WORKS.length - 1) - islandZ(0)) + 80;
    return Math.max(175, needW / (2 * half * cam.aspect));
  }

  // 依捲動進度回傳鏡頭姿態；也回傳目前停在哪座島（給資訊卡）
  function pose(p, T, out) {
    out.up.set(0, 1, 0);
    out.island = -1; out.islandW = 0; out.reveal = 0;
    if (p <= T.seaEnd) {
      const s = range(T.seaStart - 0.02, T.seaEnd, p);
      const idxf = s * (NPTS - 1);
      const i0 = Math.min(Math.floor(idxf), NPTS - 2), fr = idxf - i0;
      const f = fr - Math.sin(2 * Math.PI * fr) / (2 * Math.PI) * 0.92; // 在每座島前放慢
      const u = (i0 + f) / (NPTS - 1);
      camCurve.getPoint(u, out.pos); lookCurve.getPoint(u, out.look);
      const near = Math.round(idxf);
      if (near >= 1 && near <= WORKS.length) { out.island = near - 1; out.islandW = 1 - range(0.2, 0.34, Math.abs(idxf - near)); }
      out.headZ = out.pos.z;
      return out;
    }
    const camEnd = camPts[NPTS - 1], lookEnd = lookPts[NPTS - 1];
    if (p <= T.riseStart) {
      const a = smooth(range(T.seaEnd, T.abStart + 0.03, p));
      out.pos.lerpVectors(camEnd, AB_POS, a); out.look.lerpVectors(lookEnd, AB_LOOK, a);
      out.headZ = out.pos.z;
      return out;
    }
    const H = topHeight();
    const a = smooth(range(T.riseStart, T.riseEnd, p));
    tmpA.set(H * 0.2, H, zMid); tmpB.set(H * 0.2, 0, zMid); // 往 +x 偏，讓五線譜落在畫面上半部、下半部留給標語
    out.pos.lerpVectors(AB_POS, tmpA, a);
    out.pos.y = THREE.MathUtils.lerp(AB_POS.y, H, Math.pow(a, 0.8));
    out.look.lerpVectors(AB_LOOK, tmpB, smooth(range(0.0, 0.85, a)));
    const ua = smooth(range(0.35, 1.0, a));
    out.up.set(-ua, 1 - ua, 0).normalize();
    if (p > T.holdEnd) { // 往下沉，準備退回麥克風
      const d = smooth(range(T.holdEnd, T.exitEnd, p));
      out.pos.y = THREE.MathUtils.lerp(H, H * 0.55, d);
    }
    out.reveal = smooth(range(T.riseStart + (T.riseEnd - T.riseStart) * 0.55, T.riseEnd, p));
    out.headZ = zMid;
    return out;
  }

  // ---------- 每幀更新 ----------
  const stormState = { s: 0 };
  function update(t, dt, st) {
    const s = st.storm;
    stormState.s = s;
    // 天空
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) su[k].value = THREE.MathUtils.lerp(skyCalm[k], skyStorm[k], s);
    setSun(THREE.MathUtils.lerp(skyCalm.elevation, skyStorm.elevation, s));
    water.material.uniforms.sunDirection.value.copy(sun);
    sunLight.position.copy(sun).multiplyScalar(500);
    sunLight.intensity = THREE.MathUtils.lerp(2.6, 0.25, s);
    // 水
    const wu = water.material.uniforms;
    wu.time.value += dt * (0.55 + s * 1.4);
    wu.distortionScale.value = THREE.MathUtils.lerp(2.4, 14, s);
    wu.size.value = THREE.MathUtils.lerp(1.6, 0.55, s);
    wu.waterColor.value.copy(waterCalm).lerp(waterStorm, s);
    // 霧
    scene.fog.color.copy(fogCalm).lerp(fogStorm, s);
    scene.fog.density = THREE.MathUtils.lerp(FOG_CALM, 0.016, s * s);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.9, 0.25, s);
    // 閃電
    if (s > 0.55 && Math.random() < dt * 0.35 * s) flash = 1;
    flash = Math.max(0, flash - dt * 3.2);
    const fl = flash * flash * (0.6 + 0.4 * Math.sin(t * 90));
    hemi.intensity = THREE.MathUtils.lerp(0.9, 0.35, s) + fl * 4;
    veilMat.opacity = s * 0.9;
    veilMat.color.copy(fogStorm).multiplyScalar(1 + fl * 2.5);
    clouds.forEach((c, i) => {
      // 暴風雨時雲往冷灰藍走（直接壓暗橘雲會變成髒的橄欖色），閃電時從內部打亮
      c.mat.color.setRGB(
        THREE.MathUtils.lerp(1, 0.2, s) + fl * 0.9,
        THREE.MathUtils.lerp(1, 0.23, s) + fl * 0.95,
        THREE.MathUtils.lerp(1, 0.32, s) + fl * 1.1);
      c.m.position.x = c.base.x + Math.sin(t * 0.01 + i) * 60;
    });
    haze.position.x = cam.position.x; haze.position.z = cam.position.z;
    hazeMat.uniforms.uColor.value.copy(fogCalm).lerp(fogStorm, s).multiplyScalar(1 + fl * 1.5);
    hazeMat.uniforms.uOpacity.value = 0.12 * (1 - s) + 0.97 * s;
    // 雨：細、密、遠處融進霧裡
    rainMat.opacity = s * 0.32;
    if (s > 0.01) {
      const cp = cam.position;
      for (let i = 0; i < RN; i++) {
        rainOff[i * 3 + 1] -= dt * 55;
        if (rainOff[i * 3 + 1] < 0) rainOff[i * 3 + 1] += 45;
        const x = cp.x + rainOff[i * 3], y = rainOff[i * 3 + 1], z = cp.z + rainOff[i * 3 + 2];
        rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
        rainPos[i * 6 + 3] = x - 0.25; rainPos[i * 6 + 4] = y + 1.3; rainPos[i * 6 + 5] = z + 0.12;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // 五線譜
    staffMat.uniforms.uTime.value = t;
    staffMat.uniforms.uHeadZ.value = st.headZ;
    staffMat.uniforms.uStorm.value = s;
    staffMat.uniforms.uGlow.value = (1 + st.reveal * 1.4) * (1 - s * 0.5);
    staffLines.forEach((m) => { m.scale.x = THREE.MathUtils.lerp(0.4, 1.5, st.reveal); });
    // 島
    islands.forEach((isl, i) => {
      isl.landmark.userData.update && isl.landmark.userData.update(t, dt);
      isl.frame.position.y = 7.4 + Math.sin(t * 0.8 + i) * 0.25;
      isl.frame.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.015;
      isl.pulse = Math.max(0, isl.pulse - dt * 1.6);
      const g = glyphs[i];
      const stagger = clamp01(st.reveal * 1.6 - i * 0.075);
      g.mat.opacity = stagger * 0.75 + isl.pulse * 1.2;
      g.stem.scale.x = Math.max(0.001, smooth(clamp01(stagger * 1.2 - 0.2)));
      isl.glow.material.color.setRGB(2.2 + isl.pulse * 4, 1.55 + isl.pulse * 3, 0.9 + isl.pulse * 1.6);
    });
  }

  function resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); }

  return { scene, cam, islands, pose, update, resize, stormState, zMid };
}
