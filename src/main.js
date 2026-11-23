import * as THREE from 'three';
import { WORKS, MELODY, STAFF_MIDI, LINKS, ytUrl } from './data.js';
import { PORTFOLIO, thumbOf } from './portfolio.js';
import { createBooth } from './booth.js';
import { createSea } from './sea.js';
import { createUnder, CHAPTERS } from './under.js';
import { createFlight } from './flight.js';
import { createPost } from './post.js';
import { AudioEngine } from './audio.js';
import { createIslandPlayer } from './islandplayer.js';
import { createBubblePlayer } from './bubbleplayer.js';

// ---------- 時間軸：每段佔多少捲動高度（vh），換算成 0–1 的進度 ----------
const SEG = [
  ['booth', 120], ['portal', 90], ['sea', 640], ['ab', 160], ['dive', 110], ['under', 660], ['toBub', 70],
  ['bubbles', 260], ['bubT', 110], ['flight', 640], ['desc', 150], ['hold', 80], ['exit', 80], ['outro', 40],
];
const TOTAL_VH = SEG.reduce((a, [, v]) => a + v, 0);
const END = {}; { let acc = 0; for (const [k, v] of SEG) { acc += v; END[k] = acc / TOTAL_VH; } }
const T = {
  K: 1500 / TOTAL_VH, // 舊版（1500vh）寫死的小常數要乘上這個
  boothEnd: END.booth, portalEnd: END.portal,
  seaStart: END.portal, seaEnd: END.sea,
  abStart: END.sea, abEnd: END.ab,
  diveStart: END.ab, diveEnd: END.dive,
  underEnd: END.under, bubStart: END.toBub, bubEnd: END.bubbles,
  bubTStart: END.bubbles, bubTEnd: END.bubT,
  flightEnd: END.flight, descEnd: END.desc,
  holdEnd: END.hold, exitStart: END.hold, exitEnd: END.exit,
};
document.getElementById('scroll-space').style.height = `${TOTAL_VH}vh`;
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

const [waterNormals, avatar, cloudsA, cloudsB, cloudsC, cloudsD, cloudsea, underwater, ...covers] = await Promise.all([
  loadTex('assets/waternormals.jpg', false),
  loadTex('assets/subai-avatar.jpg'),
  loadTex('assets/gen/clouds-a.png'),
  loadTex('assets/gen/clouds-b.png'),
  loadTex('assets/gen/clouds-c.png'),
  loadTex('assets/gen/clouds-d.png'),
  loadTex('assets/gen/cloudsea.png'),
  loadTex('assets/gen/underwater.png'),
  ...WORKS.map((w) => loadTex(w.cover)),
]);
if (waterNormals) waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
covers.forEach((c) => { if (c) c.anisotropy = 8; });

let buildLandmark = null;
try { ({ buildLandmark } = await import('./landmarks.js')); } catch (e) { console.warn('landmarks.js 載入失敗，改用替代地標', e); }

const booth = createBooth({ avatar });
const sea = createSea(renderer, { waterNormals, cloudsA, cloudsB, covers }, buildLandmark);
const under = createUnder(renderer, { underwater }, PORTFOLIO.map((w) => ({ ...w, thumb: thumbOf(w) })));
const flight = await createFlight(sea, { cloudsC, cloudsD, cloudsea });
sea.setFlight(flight);
const post = createPost(renderer, innerWidth, innerHeight);
const audio = new AudioEngine();
const islandPlayer = createIslandPlayer(WORKS, sea.islands, audio);
const bubblePlayer = createBubblePlayer(under, audio);

// ---------- 介面 ----------
// 段落文字的出現區間由時間軸算，不寫死在 HTML
const segLen = (a, b) => b - a;
const chapterP = (i) => T.diveStart + ((i + 1) / 6.5) * segLen(T.diveStart, T.underEnd);
{
  const ovRoot = document.getElementById('overlay');
  CHAPTERS.forEach((c, i) => {
    const sec = document.createElement('section');
    sec.className = 'ov ov-chapter';
    const half = 0.3 / 6.5 * segLen(T.diveStart, T.underEnd);
    sec.dataset.a = String(chapterP(i) - half); sec.dataset.b = String(chapterP(i) + half);
    sec.innerHTML = `<p class="ch-num">${String(i + 1).padStart(2, '0')}<span>${c.en}</span></p><h3 class="ch-title">${c.zh}</h3><p class="ch-line">${c.line}</p>`;
    ovRoot.appendChild(sec);
  });
  const set = (sel, a, b) => { const el = document.querySelector(sel); if (el) { el.dataset.a = String(a); el.dataset.b = String(b); } };
  set('.ov-hint', -1, 0.03 * T.K);
  set('.ov-ab', T.abStart + segLen(T.abStart, T.abEnd) * 0.2, T.abEnd - segLen(T.abStart, T.abEnd) * 0.06);
  set('.ov-bubbles', T.bubStart, T.bubEnd);
  set('.ov-outro', T.exitEnd, 2);
}
const ovs = [...document.querySelectorAll('.ov')].map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b, interactive: el.hasAttribute('data-interactive') }));
const card = document.getElementById('card');
const cardSound = document.getElementById('card-sound');
let cardSoundState = '';
const cardEls = { i: document.getElementById('card-i'), title: document.getElementById('card-title'), credit: document.getElementById('card-credit'), yt: document.getElementById('card-yt') };
let cardIdx = -1;
function setCard(i) {
  if (i === cardIdx || i < 0) return;
  cardIdx = i; const w = WORKS[i];
  cardEls.i.textContent = String(i + 1).padStart(2, '0');
  cardEls.title.textContent = w.title;
  cardEls.credit.textContent = w.credit;
  cardEls.yt.href = ytUrl(w.yt);
}

const rail = document.getElementById('rail');
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
const NPTS = WORKS.length + 2;
const islandP = (i) => T.seaStart - 0.02 * T.K + ((i + 1) / (NPTS - 1)) * (T.seaEnd - T.seaStart + 0.02 * T.K);
WORKS.forEach((w, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" aria-label="${w.title}"><span class="lbl">${String(i + 1).padStart(2, '0')}</span><span class="dot"></span></button>`;
  li.querySelector('button').addEventListener('click', () => scrollTo({ top: islandP(i) * maxScroll() }));
  rail.appendChild(li);
});
const railItems = [...rail.children];

document.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const to = a.dataset.jump === '0' ? 0 : a.dataset.jump === 'price' ? (T.bubTEnd + 0.004) : 1;
  scrollTo({ top: to * maxScroll() });
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
const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1 };
addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; mouse.px = e.clientX; mouse.py = e.clientY; });
let pTarget = 0, p = 0, vel = 0;
const readScroll = () => { pTarget = clamp01(scrollY / Math.max(1, maxScroll())); };
addEventListener('scroll', readScroll, { passive: true });
readScroll(); p = pTarget;

// 水下氣泡：滑過顯示曲名、點一下播放
let bubblesActive = false;
canvas.addEventListener('click', (e) => {
  if (!bubblesActive) return;
  const i = under.pick(e.clientX, e.clientY);
  if (i >= 0) { if (!audio.ready) setSound(true); bubblePlayer.select(i); }
});

function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  booth.cam.aspect = w / h; booth.cam.updateProjectionMatrix();
  sea.resize(w, h);
  under.resize(w, h);
  flight.resize();
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
const underPose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(), chapter: -1, chW: 0, bubbles: 0, rise: 0, idxf: 0 };
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
  const dist = cam.position.distanceTo(tmp);
  const k = Math.min(1, dist / 2.5) * 0.12;
  right.setFromMatrixColumn(cam.matrix, 0); upv.setFromMatrixColumn(cam.matrix, 1);
  cam.position.addScaledVector(right, mouse.sx * k).addScaledVector(upv, -mouse.sy * k * 0.6);
  cam.lookAt(tmp);
}

// 目前要合成哪兩個世界：A → B，m 是轉場進度；mode 0 網罩、1 水面線、2 氣泡
const W = { booth: 0, sea: 1, under: 2 };
function worlds(pp) {
  if (pp < T.boothEnd) return [W.booth, W.sea, 0, 0];
  if (pp < T.portalEnd) return [W.booth, W.sea, range(T.boothEnd, T.portalEnd, pp), 0];
  if (pp < T.diveStart) return [W.sea, W.under, 0, 1];
  if (pp < T.diveEnd) return [W.sea, W.under, range(T.diveStart, T.diveEnd, pp), 1];
  if (pp < T.bubEnd) return [W.under, W.sea, 0, 2];
  if (pp < T.bubTEnd) return [W.under, W.sea, range(T.bubEnd + segLen(T.bubEnd, T.bubTEnd) * 0.3, T.bubTEnd, pp), 2];
  if (pp < T.exitStart) return [W.booth, W.sea, 1, 0];
  if (pp < T.exitEnd) return [W.booth, W.sea, 1 - range(T.exitStart, T.exitEnd, pp), 0];
  return [W.booth, W.sea, 0, 0];
}

let simT = 0;
function tick(fixedDt) {
  const dt = fixedDt || Math.min(clock.getDelta(), 1 / 20);
  simT += dt;
  const t = simT;
  const prev = p;
  p += (pTarget - p) * (1 - Math.exp(-dt * 3.6));
  if (Math.abs(pTarget - p) < 1e-5) p = pTarget;
  vel += (Math.abs(p - prev) / Math.max(dt, 1e-3) - vel) * 0.15;
  mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 2.5));
  mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 2.5));

  const [wa, wb, m, mode] = worlds(p);
  const weight = (w) => (wa === w ? 1 - m : 0) + (wb === w ? m : 0);
  const seaW = weight(W.sea), underW = weight(W.under), boothW = weight(W.booth);

  // 暴風雨：只在 A/B 區段，由滑桿控制
  const abLen = segLen(T.abStart, T.abEnd);
  const abW = range(T.abStart + abLen * 0.04, T.abStart + abLen * 0.25, p) * (1 - range(T.abEnd - abLen * 0.1, T.abEnd + abLen * 0.06, p));
  storm += (abW * (1 - abValue) - storm) * (1 - Math.exp(-dt * 2.2));

  // 鏡頭與場景更新：只動看得到的
  if (boothW > 0) { boothPose(p, booth.cam); booth.update(t, dt); }
  let flightVis = 0;
  if (seaW > 0) {
    sea.pose(p, T, seaPose);
    const c = sea.cam;
    c.position.copy(seaPose.pos); c.up.copy(seaPose.up); c.lookAt(seaPose.look); c.updateMatrix();
    const k = (1 - seaPose.reveal) * 1.6 + seaPose.reveal * 6;
    right.setFromMatrixColumn(c.matrix, 0); upv.setFromMatrixColumn(c.matrix, 1);
    c.position.addScaledVector(right, mouse.sx * k).addScaledVector(upv, -mouse.sy * k * 0.5);
    c.lookAt(seaPose.look);
    sea.update(t, dt, { storm, reveal: seaPose.reveal, headZ: seaPose.headZ });
    flightVis = flight.update(t, dt, p, T, c);
  }
  if (underW > 0) {
    under.pose(p, T, underPose);
    const c = under.cam;
    c.position.copy(underPose.pos); c.up.copy(underPose.up); c.lookAt(underPose.look); c.updateMatrix();
    right.setFromMatrixColumn(c.matrix, 0); upv.setFromMatrixColumn(c.matrix, 1);
    c.position.addScaledVector(right, mouse.sx * 1.2).addScaledVector(upv, -mouse.sy * 0.7);
    c.lookAt(underPose.look); c.updateMatrixWorld();
    const lvl = bubblePlayer.isLocal ? Math.min(1, audio.level() * 3.2) : (bubblePlayer.playing >= 0 ? 0.35 + 0.25 * Math.sin(t * 5.2) : 0);
    under.update(t, dt, { ...underPose, level: lvl });
  }

  // 旋律
  if (seaPose.reveal > 0.97 && seaW > 0.99 && !melodyPlayed) playMelody();
  if (seaPose.reveal < 0.3) melodyPlayed = false;

  // 渲染
  const scn = [booth.scene, sea.scene, under.scene], cams = [booth.cam, sea.cam, under.cam];
  if (m < 1) { renderer.setRenderTarget(post.rtA); renderer.render(scn[wa], cams[wa]); }
  if (m > 0) { renderer.setRenderTarget(post.rtB); renderer.render(scn[wb], cams[wb]); }
  renderer.setRenderTarget(null);
  const mixW = (arr) => arr[wa] * (1 - m) + arr[wb] * m;
  renderer.toneMappingExposure = mixW([1.05, 0.52 * (1 - storm * 0.3) + flightVis * 0.06, 0.78]);
  post.composite.uniforms.uMix.value = m;
  post.composite.uniforms.uMode.value = mode;
  post.composite.uniforms.uTime.value = t;
  post.bloom.strength = mixW([0.6, 0.42, 0.5]) + seaPose.reveal * 0.3 * seaW;
  post.bloom.threshold = mixW([0.92, 3.2, 1.25]);
  post.finish.uniforms.uGrade.value = mixW([0, 1 - storm * 0.6, 0.55]);
  post.finish.uniforms.uTime.value = t;
  post.finish.uniforms.uVel.value = clamp01(vel * 2.2);
  if (started) fadeIn = Math.min(1, fadeIn + dt / 1.6);
  post.finish.uniforms.uFade.value = smooth(fadeIn);
  post.composer.render(dt);

  // 介面
  const f = 0.012 * T.K;
  for (const o of ovs) {
    const vis = (o.a <= 0 ? 1 : range(o.a - f, o.a, p)) * (1 - range(o.b, o.b + f, p));
    o.el.style.opacity = vis.toFixed(3);
    o.el.style.transform = `translateY(${((1 - vis) * 14).toFixed(1)}px)`;
    if (o.interactive) o.el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
  }
  const showCard = seaW > 0.99 && seaPose.island >= 0 && p <= T.seaEnd;
  if (showCard) setCard(seaPose.island);
  const cv = showCard ? seaPose.islandW : 0;
  card.style.opacity = cv.toFixed(3);
  card.style.transform = `translateY(${((1 - cv) * 18).toFixed(1)}px)`;
  card.style.pointerEvents = cv > 0.5 ? 'auto' : 'none';
  rail.classList.toggle('show', p > T.seaStart - 0.01 * T.K && p < T.seaEnd + 0.01 * T.K);
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

  // 水下氣泡
  bubblesActive = underW > 0.99 && underPose.bubbles > 0.6;
  bubblePlayer.update(dt, bubblesActive, soundOn);
  if (bubblesActive && mouse.px >= 0) {
    const hi = under.pick(mouse.px, mouse.py);
    bubblePlayer.hover(hi, mouse.px, mouse.py);
    canvas.style.cursor = hi >= 0 ? 'pointer' : '';
  } else { bubblePlayer.hover(-1); canvas.style.cursor = ''; }

  audio.update({ seaVis: seaW, under: underW, storm, reveal: seaPose.reveal, vel: clamp01(vel * 2), inAB: abW > 0.2, duck: islandPlayer.audible || bubblePlayer.audible });
}
function frame() { tick(); requestAnimationFrame(frame); }

onResize();
frame();
// 載入完成：顯示「進入」。按下去才開始；瀏覽器規定要點一下才能出聲，所以預設是帶聲音進入
document.getElementById('loader').classList.add('ready');
function enter(withSound) {
  setSound(withSound);
  document.getElementById('loader').classList.add('done');
  started = true;
}
document.getElementById('enter').addEventListener('click', () => enter(true));
document.getElementById('enter-mute').addEventListener('click', () => enter(false));
window.__mixsea = { T, post, works: WORKS, audio, islandPlayer, bubblePlayer, under, flight, get p() { return p; }, set p(v) { p = pTarget = v; }, sea, booth, renderer, setAB(v) { abValue = v; abInput.value = v; },
  skipFade() { fadeIn = 1; started = true; document.getElementById('loader').classList.add('done'); },
  // 測試用：分頁隱藏時 requestAnimationFrame 不跑，手動推進 n 幀；storm 可直接指定
  tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); }, set storm(v) { storm = v; }, get storm() { return storm; }, flash(v = 1) { sea.flash(v); } };
