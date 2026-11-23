import * as THREE from 'three';
import { WORKS, MELODY, STAFF_MIDI, LINKS, ytUrl } from './data.js';
import { createBooth } from './booth.js';
import { createSea } from './sea.js';
import { createPost } from './post.js';
import { AudioEngine } from './audio.js';
import { createIslandPlayer } from './islandplayer.js';

// ---------- 時間軸（捲動進度 0–1） ----------
const T = {
  boothEnd: 0.10, portalEnd: 0.16,
  seaStart: 0.16, seaEnd: 0.66,
  abStart: 0.66, abEnd: 0.78,
  riseStart: 0.79, riseEnd: 0.86, holdEnd: 0.915,
  exitStart: 0.915, exitEnd: 0.965,
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const range = (a, b, x) => clamp01((x - a) / (b - a));
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = THREE.MathUtils.lerp;

// ---------- 載入 ----------
const fill = document.getElementById('loader-fill');
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => { fill.style.width = `${Math.round((done / total) * 100)}%`; };
const loader = new THREE.TextureLoader(manager);
const loadTex = (url, srgb = true) => new Promise((res) => loader.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));

const isMobile = matchMedia('(max-width: 720px)').matches || matchMedia('(pointer: coarse)').matches;
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 1.6));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const [waterNormals, avatar, cloudsA, cloudsB, ...covers] = await Promise.all([
  loadTex('assets/waternormals.jpg', false),
  loadTex('assets/subai-avatar.jpg'),
  loadTex('assets/gen/clouds-a.png'),
  loadTex('assets/gen/clouds-b.png'),
  ...WORKS.map((w) => loadTex(w.cover)),
]);
if (waterNormals) waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
covers.forEach((c) => { if (c) c.anisotropy = 8; });

let buildLandmark = null;
try { ({ buildLandmark } = await import('./landmarks.js')); } catch (e) { console.warn('landmarks.js 載入失敗，改用替代地標', e); }

const booth = createBooth({ avatar });
const sea = createSea(renderer, { waterNormals, cloudsA, cloudsB, covers }, buildLandmark);
const post = createPost(renderer, innerWidth, innerHeight);
const audio = new AudioEngine();
const islandPlayer = createIslandPlayer(WORKS, sea.islands, audio);

// ---------- 介面 ----------
const ovs = [...document.querySelectorAll('.ov')].map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b, interactive: el.hasAttribute('data-interactive') }));
const card = document.getElementById('card');
const cardSound = document.getElementById('card-sound');
let cardSoundState = '';
const cardEls = { i: document.getElementById('card-i'), title: document.getElementById('card-title'), credit: document.getElementById('card-credit'), role: document.getElementById('card-role'), orig: document.getElementById('card-orig'), yt: document.getElementById('card-yt') };
let cardIdx = -1;
function setCard(i) {
  if (i === cardIdx || i < 0) return;
  cardIdx = i; const w = WORKS[i];
  cardEls.i.textContent = String(i + 1).padStart(2, '0');
  cardEls.title.textContent = w.title;
  cardEls.credit.textContent = w.credit;
  cardEls.role.textContent = w.role;
  cardEls.orig.textContent = w.original ? `原曲 ${w.original}` : '';
  cardEls.yt.href = ytUrl(w.yt);
}

const rail = document.getElementById('rail');
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
const NPTS = WORKS.length + 2;
const islandP = (i) => T.seaStart - 0.02 + ((i + 1) / (NPTS - 1)) * (T.seaEnd - T.seaStart + 0.02);
WORKS.forEach((w, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" aria-label="${w.title}"><span class="lbl">${String(i + 1).padStart(2, '0')}</span><span class="dot"></span></button>`;
  li.querySelector('button').addEventListener('click', () => scrollTo({ top: islandP(i) * maxScroll() }));
  rail.appendChild(li);
});
const railItems = [...rail.children];

document.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault(); scrollTo({ top: a.dataset.jump === '0' ? 0 : maxScroll() });
}));
document.getElementById('cta-x').href = LINKS.x;
document.getElementById('cta-commission').href = LINKS.commission;

const soundBtn = document.getElementById('sound'), soundLabel = document.getElementById('sound-label');
function setSound(on) {
  audio.init(); audio.setMuted(!on);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundLabel.textContent = on ? '聲音開啟' : '開啟聲音';
}
soundBtn.addEventListener('click', () => setSound(audio.muted));

const abInput = document.getElementById('ab'), abPlay = document.getElementById('ab-play'), abIcon = document.getElementById('ab-icon');
let abValue = 0;
abInput.addEventListener('input', () => { abValue = +abInput.value; audio.setAB(abValue); });
abPlay.addEventListener('click', () => {
  if (audio.muted) setSound(true);
  audio.playAB(!audio.abPlaying);
  abIcon.setAttribute('d', audio.abPlaying ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
});

// ---------- 輸入 ----------
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });
let pTarget = 0, p = 0, vel = 0;
const readScroll = () => { pTarget = clamp01(scrollY / Math.max(1, maxScroll())); };
addEventListener('scroll', readScroll, { passive: true });
readScroll(); p = pTarget;

function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  booth.cam.aspect = w / h; booth.cam.updateProjectionMatrix();
  sea.resize(w, h);
  post.resize(w, h);
  islandPlayer.resize(w, h);
}
addEventListener('resize', onResize);

// ---------- 旋律彩蛋 ----------
let melodyPlayed = false;
function playMelody() {
  melodyPlayed = true;
  const beat = 0.42;
  const start = audio.ready ? audio.ctx.currentTime + 0.35 : 0;
  MELODY.forEach((k, i) => {
    const freq = 440 * Math.pow(2, (STAFF_MIDI[k] - 69) / 12);
    if (audio.ready && !audio.muted) audio.note(freq, start + i * beat, i === MELODY.length - 1 ? 3.2 : 1.6);
    setTimeout(() => { sea.islands[i].pulse = 1; }, 350 + i * beat * 1000);
  });
}

// ---------- 主迴圈 ----------
const clock = new THREE.Clock();
const seaPose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(), island: -1, islandW: 0, reveal: 0, headZ: 0 };
const tmp = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();
let storm = 0, fadeIn = 0, started = false;

function boothPose(pp, cam) {
  if (pp < T.exitStart) {
    const a = smooth(range(0, T.boothEnd, pp));
    booth.inPath.getPoint(a, cam.position);
    booth.inLook.getPoint(a, tmp);
    if (pp > T.boothEnd) cam.position.z = lerp(0.235, 0.15, range(T.boothEnd, T.portalEnd, pp));
  } else {
    const a = smooth(range(T.exitStart, 1.0, pp));
    booth.outPath.getPoint(a, cam.position);
    booth.outLook.getPoint(a, tmp);
  }
  cam.up.set(0, 1, 0);
  cam.lookAt(tmp); cam.updateMatrix();
  // 滑鼠視差：離麥克風越近越小
  const dist = cam.position.distanceTo(tmp);
  const k = Math.min(1, dist / 2.5) * 0.12;
  right.setFromMatrixColumn(cam.matrix, 0); upv.setFromMatrixColumn(cam.matrix, 1);
  cam.position.addScaledVector(right, mouse.sx * k).addScaledVector(upv, -mouse.sy * k * 0.6);
  cam.lookAt(tmp);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  const prev = p;
  p += (pTarget - p) * (1 - Math.exp(-dt * 3.6));
  if (Math.abs(pTarget - p) < 1e-5) p = pTarget;
  vel += (Math.abs(p - prev) / Math.max(dt, 1e-3) - vel) * 0.15;
  mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 2.5));
  mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 2.5));

  // 兩個世界的混合比例
  let m = 0;
  if (p >= T.boothEnd && p < T.portalEnd) m = range(T.boothEnd, T.portalEnd, p);
  else if (p >= T.portalEnd && p < T.exitStart) m = 1;
  else if (p >= T.exitStart && p < T.exitEnd) m = 1 - range(T.exitStart, T.exitEnd, p);

  // 暴風雨：只在 A/B 區段，由滑桿控制
  const abW = range(T.abStart + 0.005, T.abStart + 0.03, p) * (1 - range(T.abEnd - 0.01, T.abEnd + 0.008, p));
  storm += (abW * (1 - abValue) - storm) * (1 - Math.exp(-dt * 2.2));

  // 鏡頭
  if (m < 1) { boothPose(p, booth.cam); booth.update(t, dt); }
  if (m > 0) {
    sea.pose(p, T, seaPose);
    const c = sea.cam;
    c.position.copy(seaPose.pos); c.up.copy(seaPose.up); c.lookAt(seaPose.look); c.updateMatrix();
    const k = (1 - seaPose.reveal) * 1.6 + seaPose.reveal * 6;
    right.setFromMatrixColumn(c.matrix, 0); upv.setFromMatrixColumn(c.matrix, 1);
    c.position.addScaledVector(right, mouse.sx * k).addScaledVector(upv, -mouse.sy * k * 0.5);
    c.lookAt(seaPose.look);
    sea.update(t, dt, { storm, reveal: seaPose.reveal, headZ: seaPose.headZ });
  }

  // 旋律
  if (seaPose.reveal > 0.97 && m > 0.99 && !melodyPlayed) playMelody();
  if (seaPose.reveal < 0.3) melodyPlayed = false;

  // 渲染
  if (m < 1) { renderer.setRenderTarget(post.rtBooth); renderer.render(booth.scene, booth.cam); }
  if (m > 0) { renderer.setRenderTarget(post.rtSea); renderer.render(sea.scene, sea.cam); }
  renderer.setRenderTarget(null);
  renderer.toneMappingExposure = lerp(1.05, 0.52 * (1 - storm * 0.3), m);
  post.composite.uniforms.uMix.value = m;
  post.composite.uniforms.uTime.value = t;
  post.bloom.strength = lerp(0.6, 0.42, m) + seaPose.reveal * 0.3 * m;
  post.bloom.threshold = lerp(0.92, 3.2, m);          // 天空本身很亮，海景段只讓真正的發光體泛光
  post.finish.uniforms.uGrade.value = m * (1 - storm * 0.6);
  post.finish.uniforms.uTime.value = t;
  post.finish.uniforms.uVel.value = clamp01(vel * 2.2);
  if (started) fadeIn = Math.min(1, fadeIn + dt / 1.6);
  post.finish.uniforms.uFade.value = smooth(fadeIn);
  post.composer.render(dt);

  // 介面
  const f = 0.012;
  for (const o of ovs) {
    const vis = (o.a <= 0 ? 1 : range(o.a - f, o.a, p)) * (1 - range(o.b, o.b + f, p));
    o.el.style.opacity = vis.toFixed(3);
    o.el.style.transform = `translateY(${((1 - vis) * 14).toFixed(1)}px)`;
    if (o.interactive) o.el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
  }
  const showCard = m > 0.99 && seaPose.island >= 0 && p <= T.seaEnd;
  if (showCard) setCard(seaPose.island);
  const cv = showCard ? seaPose.islandW : 0;
  card.style.opacity = cv.toFixed(3);
  card.style.transform = `translateY(${((1 - cv) * 18).toFixed(1)}px)`;
  card.style.pointerEvents = cv > 0.5 ? 'auto' : 'none';
  rail.classList.toggle('show', p > T.seaStart - 0.01 && p < T.seaEnd + 0.01);
  railItems.forEach((li, i) => li.classList.toggle('on', showCard && seaPose.island === i && cv > 0.3));

  // 島上畫框的影片：停在哪座島就播哪首
  const soundOn = audio.ready && !audio.muted;
  islandPlayer.update(dt, showCard ? seaPose.island : -1, cv, soundOn, sea.cam);
  const ss = showCard ? islandPlayer.status(seaPose.island, soundOn) : '';
  if (ss !== cardSoundState) {
    cardSoundState = ss;
    cardSound.textContent = {
      local: '正在播放・混音成品片段',
      'needs-sound': '點右上角「開啟聲音」，停在島上就會自動播放',
      yt: '正在播放',
      'yt-muted': '靜音播放中・點右上角「開啟聲音」收聽',
      blocked: /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
        ? '本機預覽時 YouTube 不給嵌入，上線後就會在畫框裡播放'
        : '這支影片目前無法嵌入，請點下方連結聆聽',
      '': '',
    }[ss];
    cardSound.classList.toggle('on', ss === 'local' || ss === 'yt');
  }

  audio.update({ seaVis: m, storm, reveal: seaPose.reveal, vel: clamp01(vel * 2), inAB: abW > 0.2, duck: islandPlayer.audible });
}
function frame() { tick(); requestAnimationFrame(frame); }

onResize();
frame();
requestAnimationFrame(() => {
  document.getElementById('loader').classList.add('done');
  started = true;
});
window.__mixsea = { T, works: WORKS, audio, islandPlayer, get p() { return p; }, set p(v) { p = pTarget = v; }, sea, booth, renderer, setAB(v) { abValue = v; abInput.value = v; }, skipFade() { fadeIn = 1; },
  // 測試用：分頁隱藏時 requestAnimationFrame 不跑，手動推進 n 幀；storm 可直接指定
  tick(n = 1) { for (let i = 0; i < n; i++) tick(); }, set storm(v) { storm = v; }, get storm() { return storm; }, flash(v = 1) { sea.flash(v); } };
