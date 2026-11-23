// 島上自動播放：停在哪座島就播哪首，歌與歌之間交疊淡入淡出，沒有斷層。
// - YouTube：兩個播放器輪流接力。下一首在另一個播放器載好、真的開始播之後，前一首才開始淡出。
//   影片用 CSS3D 貼在各自那座島的畫框上（看得到畫面，不是背景偷放音軌）。
// - 本機預覽（works[i].audio）：有填就優先用，同樣交叉淡化，畫框跟著音量發光。
// - 島與島之間移動時繼續播上一首，直到停到下一座島才換；離開海面才全部淡出。
// 注意：在 localhost／127.0.0.1 上，有版權認領的翻唱影片會回錯誤 150；
// 2026-11-23 在 w3schools.com 與 GitHub Pages 實測都能播，所以上線後正常。
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const PX = 720, PY = 405;          // 橫式播放器 DOM 尺寸；直式（Shorts）用 405×720
const FADE_IN = 110, FADE_OUT = 85; // 音量每秒變化量（0–100）：淡入約 0.9 秒、淡出約 1.2 秒

export function createIslandPlayer(works, islands, audio) {
  const failed = new Set();
  const idOf = (yt) => yt.replace('shorts/', '');
  let cur = -1; // 目前「應該在播」的作品

  // ---------- 本機預覽 ----------
  const local = new Map(); // idx → { el, gain }
  let localCur = -1;
  function localFor(i) {
    if (!local.has(i)) {
      const el = new Audio(works[i].audio);
      el.loop = true; el.preload = 'auto';
      const gain = audio.ctx.createGain(); gain.gain.value = 0;
      audio.ctx.createMediaElementSource(el).connect(gain).connect(audio.previewBus);
      local.set(i, { el, gain });
    }
    return local.get(i);
  }
  function switchLocal(i) {
    const t = audio.ctx.currentTime;
    if (localCur >= 0) {
      const oldIdx = localCur, old = local.get(oldIdx);
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0, t, 0.8);
      setTimeout(() => { if (localCur !== oldIdx) old.el.pause(); }, 4000);
    }
    localCur = -1;
    if (i >= 0) {
      const nw = localFor(i);
      if (nw.el.paused) nw.el.currentTime = works[i].start || 0;
      nw.el.play().catch(() => {});
      nw.gain.gain.cancelScheduledValues(t);
      nw.gain.gain.setTargetAtTime(1, t + 0.15, 0.6);
      localCur = i;
    }
  }

  // ---------- YouTube：兩個播放器接力 ----------
  const css = new CSS3DRenderer();
  css.setSize(innerWidth, innerHeight);
  css.domElement.className = 'css3d';
  document.body.appendChild(css.domElement);
  const scene = new THREE.Scene();

  // state：idle 閒置／loading 載入中（靜音、隱藏）／on 正在播／out 淡出中
  const slots = [0, 1].map(() => {
    const wrap = document.createElement('div');
    wrap.className = 'yt3d';
    wrap.style.width = `${PX}px`; wrap.style.height = `${PY}px`;
    const holder = document.createElement('div');
    wrap.appendChild(holder);
    const obj = new CSS3DObject(wrap);
    scene.add(obj);
    return { wrap, holder, obj, player: null, ready: false, idx: -1, state: 'idle', playing: false, vol: 0, vis: 0, pw: PX };
  });
  css.render(scene, new THREE.PerspectiveCamera()); // 先渲染一次，把播放器元素掛進頁面，YouTube 才建得起來
  css.domElement.style.visibility = 'hidden';

  function onPlaying(s) {
    if (s.state !== 'loading') return;
    s.state = 'on';
    for (const o of slots) if (o !== s && o.state === 'on') o.state = 'out'; // 新的真的出聲了，舊的才淡出
  }

  window.onYouTubeIframeAPIReady = () => {
    for (const s of slots) {
      s.player = new YT.Player(s.holder, {
        width: PX, height: PY,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, mute: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
        events: {
          onReady: () => { s.ready = true; s.player.mute(); s.player.setVolume(0); },
          onStateChange: (e) => {
            s.playing = e.data === YT.PlayerState.PLAYING;
            if (s.playing) onPlaying(s);
            if (e.data === YT.PlayerState.ENDED && s.idx >= 0) s.player.seekTo(works[s.idx].start || 0, true);
          },
          onError: (e) => {
            (window.__ytErrors ||= []).push({ idx: s.idx, code: e.data });
            if (s.idx >= 0) failed.add(s.idx);
            s.playing = false;
            if (s.state === 'loading') s.state = 'idle'; // 載不到就讓舊的繼續播
          },
        },
      });
    }
  };
  const sc = document.createElement('script');
  sc.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(sc);

  function switchYt(i) {
    const on = slots.find((s) => s.state === 'on');
    const usable = i >= 0 && !failed.has(i) && slots.every((s) => s.ready);
    if (!usable) { if (on) on.state = 'out'; for (const s of slots) if (s.state === 'loading') s.state = 'idle'; return; }
    // 用「不是正在播的那一個」來載下一首；正在播的繼續播，等新的出聲才淡出
    const s = slots.find((x) => x !== on && x.state !== 'on');
    const v = islands[i].frame.userData.size.vertical;
    s.pw = v ? PY : PX; const ph = v ? PX : PY;
    s.wrap.style.width = `${s.pw}px`; s.wrap.style.height = `${ph}px`;
    s.player.setSize(s.pw, ph);
    s.player.setVolume(0); s.vol = 0; s.vis = 0;
    s.idx = i; s.state = 'loading'; s.playing = false;
    s.player.loadVideoById({ videoId: idOf(works[i].yt), startSeconds: works[i].start || 0 });
  }

  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), scl = new THREE.Vector3();

  return {
    // idx：目前最接近的島（-1＝不在海上）；weight：停留程度 0–1
    update(dt, idx, weight, soundOn, cam) {
      // 決定該播哪首：停穩（>0.6）才換；在島與島之間移動時保持上一首；離開海面才停
      const want = idx < 0 ? -1 : (weight > 0.6 ? idx : cur);
      const ytReady = slots.every((s) => s.ready);
      if (want !== cur && (ytReady || want < 0 || works[want].audio)) {
        cur = want;
        const useLocal = cur >= 0 && !!works[cur].audio;
        if (audio.ready) switchLocal(useLocal && soundOn ? cur : -1);
        switchYt(useLocal ? -1 : cur);
      }
      // 開關聲音時，本機預覽要跟著開始／停止
      if (audio.ready && cur >= 0 && works[cur].audio && (soundOn ? localCur !== cur : localCur >= 0)) switchLocal(soundOn ? cur : -1);
      if (localCur >= 0) {
        islands[localCur].pulse = Math.max(islands[localCur].pulse, Math.min(1, audio.level() * 3.2));
      }

      // 每個播放器的音量與畫面淡入淡出
      let anyVis = false;
      for (const s of slots) {
        if (!s.ready) continue;
        if (soundOn && s.player.isMuted()) s.player.unMute();
        if (!soundOn && !s.player.isMuted()) s.player.mute();
        const target = s.state === 'on' ? 100 : 0;
        s.vol = target > s.vol ? Math.min(target, s.vol + FADE_IN * dt) : Math.max(target, s.vol - FADE_OUT * dt);
        s.player.setVolume(Math.round(s.vol));
        const vt = s.state === 'on' && s.playing ? 1 : 0;
        s.vis += (vt - s.vis) * Math.min(1, dt * (vt ? 3.6 : 2.4));
        if (s.state === 'out' && s.vol <= 0.5 && s.vis < 0.02) { s.player.pauseVideo(); s.state = 'idle'; s.idx = -1; }
        if (s.idx >= 0 && s.vis > 0.002) {
          const f = islands[s.idx].frame;
          f.updateWorldMatrix(true, false);
          f.matrixWorld.decompose(pos, q, scl);
          s.obj.position.copy(pos); s.obj.quaternion.copy(q);
          s.obj.scale.setScalar(f.userData.size.w / s.pw);
          s.obj.translateZ(0.03);
          s.wrap.style.opacity = s.vis.toFixed(3);
          s.obj.visible = true; anyVis = true;
        } else { s.wrap.style.opacity = '0'; s.obj.visible = false; }
      }
      if (anyVis) { css.domElement.style.visibility = 'visible'; css.render(scene, cam); }
      else css.domElement.style.visibility = 'hidden';
    },
    // 給資訊卡顯示狀態
    status(idx, soundOn) {
      if (idx < 0) return '';
      if (works[idx].audio) {
        if (!soundOn) return 'needs-sound';
        return localCur === idx ? 'local' : '';
      }
      if (failed.has(idx)) return 'blocked';
      const s = slots.find((x) => x.idx === idx && x.state === 'on' && x.playing);
      if (s) return soundOn ? 'yt' : 'yt-muted';
      return '';
    },
    get audible() {
      return localCur >= 0 || slots.some((s) => s.ready && s.playing && s.state !== 'idle' && !s.player.isMuted());
    },
    resize(w, h) { css.setSize(w, h); },
    get debug() { return slots.map((s) => ({ idx: s.idx, state: s.state, vol: Math.round(s.vol), playing: s.playing })); },
  };
}
