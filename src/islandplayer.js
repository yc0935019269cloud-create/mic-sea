// 島上自動播放：停在哪座島就播哪首。
// 優先播本機的混音預覽片段（works[i].audio），畫框跟著音量發光；
// 沒有本機檔的作品才嘗試 YouTube 嵌入（用 CSS3D 對齊到島上畫框，看得到畫面，不是背景偷放）。
// 注意：在 localhost／127.0.0.1 上，有版權認領的翻唱影片會回錯誤 150；
// 2026-11-23 在 w3schools.com 實測同樣 3 支都能播，所以上線到正式網域就會正常。
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const PX = 720, PY = 405; // 橫式播放器的 DOM 尺寸；直式（Shorts）用 405×720，再依畫框寬度縮放到 3D

export function createIslandPlayer(works, islands, audio) {
  // ---------- 本機預覽 ----------
  const local = new Map(); // idx → { el, gain }
  function localFor(i) {
    if (!works[i].audio || !audio.ready) return null;
    if (!local.has(i)) {
      const el = new Audio(works[i].audio);
      el.loop = true; el.preload = 'auto';
      const gain = audio.ctx.createGain(); gain.gain.value = 0;
      audio.ctx.createMediaElementSource(el).connect(gain).connect(audio.previewBus);
      local.set(i, { el, gain, started: false });
    }
    return local.get(i);
  }
  let localCur = -1;

  // ---------- YouTube ----------
  const css = new CSS3DRenderer();
  css.setSize(innerWidth, innerHeight);
  css.domElement.className = 'css3d';
  document.body.appendChild(css.domElement);
  const scene = new THREE.Scene();
  const wrap = document.createElement('div');
  wrap.className = 'yt3d';
  wrap.style.width = `${PX}px`; wrap.style.height = `${PY}px`;
  const holder = document.createElement('div');
  wrap.appendChild(holder);
  const obj = new CSS3DObject(wrap);
  scene.add(obj);
  css.render(scene, new THREE.PerspectiveCamera()); // 先渲染一次，把播放器元素掛進頁面，YouTube 才建得起來
  css.domElement.style.visibility = 'hidden';

  let player = null, ready = false, ytCur = -1, playing = false, vis = 0, vol = 0, pw = PX;
  const failed = new Set();
  const idOf = (yt) => yt.replace('shorts/', '');
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(holder, {
      width: PX, height: PY,
      playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, mute: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
      events: {
        onReady: () => { ready = true; player.mute(); },
        onStateChange: (e) => {
          playing = e.data === YT.PlayerState.PLAYING;
          if (e.data === YT.PlayerState.ENDED && ytCur >= 0) player.seekTo(works[ytCur].start || 0, true);
        },
        onError: (e) => {
          (window.__ytErrors ||= []).push({ idx: ytCur, code: e.data });
          if (ytCur >= 0) failed.add(ytCur);
          playing = false;
        },
      },
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);

  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();

  return {
    // idx：目前最接近的島（-1＝不在海上）；weight：停留程度 0–1
    update(dt, idx, weight, soundOn, cam) {
      // 遲滯：停留夠久（>0.6）才換歌，快離開（<0.25）才停，避免飛過時亂切
      const keep = (c) => (idx < 0 ? -1 : weight > 0.6 ? idx : (idx === c && weight > 0.25 ? c : -1));
      const t = audio.ready ? audio.ctx.currentTime : 0;

      // 本機預覽（要先開聲音：瀏覽器規定使用者點過才能出聲）
      let wantLocal = soundOn ? keep(localCur) : -1;
      if (wantLocal >= 0 && !works[wantLocal].audio) wantLocal = -1;
      if (wantLocal !== localCur) {
        if (localCur >= 0) {
          const oldIdx = localCur, old = local.get(oldIdx);
          old.gain.gain.setTargetAtTime(0, t, 0.35);
          setTimeout(() => { if (localCur !== oldIdx) old.el.pause(); }, 1600);
        }
        if (wantLocal >= 0) {
          const nw = localFor(wantLocal);
          if (nw) {
            if (!nw.started || nw.el.paused) { nw.el.currentTime = works[wantLocal].start || 0; nw.started = true; }
            nw.el.play().catch(() => {});
          }
        }
        localCur = wantLocal;
      }
      if (localCur >= 0) local.get(localCur)?.gain.gain.setTargetAtTime(Math.min(1, weight * 1.25), t, 0.25);
      if (localCur >= 0 && audio.ready) {
        const lv = Math.min(1, audio.level() * 3.2);
        islands[localCur].pulse = Math.max(islands[localCur].pulse, lv);
      }

      // YouTube（只給沒有本機檔、也還沒被擋的作品）
      let wantYt = keep(ytCur);
      if (wantYt >= 0 && (works[wantYt].audio || failed.has(wantYt))) wantYt = -1;
      if (ready && wantYt !== ytCur) {
        if (wantYt >= 0) {
          const v = islands[wantYt].frame.userData.size.vertical;
          pw = v ? PY : PX; const ph = v ? PX : PY;
          wrap.style.width = `${pw}px`; wrap.style.height = `${ph}px`;
          player.setSize(pw, ph);
          player.loadVideoById({ videoId: idOf(works[wantYt].yt), startSeconds: works[wantYt].start || 0 });
          vol = 0; player.setVolume(0);
        } else player.pauseVideo();
        ytCur = wantYt; playing = false;
      }
      if (ready && ytCur >= 0) {
        if (soundOn && player.isMuted()) player.unMute();
        if (!soundOn && !player.isMuted()) player.mute();
        vol += ((soundOn ? 100 * Math.min(1, weight * 1.25) : 0) - vol) * Math.min(1, dt * 2.5);
        player.setVolume(Math.round(vol));
      }
      const tv = ytCur >= 0 && playing ? Math.min(1, weight * 1.4) : 0;
      vis += (tv - vis) * Math.min(1, dt * 3);
      if (ytCur >= 0 && vis > 0.002) {
        const f = islands[ytCur].frame;
        f.updateWorldMatrix(true, false);
        f.matrixWorld.decompose(pos, q, sc);
        obj.position.copy(pos); obj.quaternion.copy(q);
        obj.scale.setScalar(f.userData.size.w / pw);
        obj.translateZ(0.03);
        wrap.style.opacity = vis.toFixed(3);
        css.domElement.style.visibility = 'visible';
        css.render(scene, cam);
      } else css.domElement.style.visibility = 'hidden';
    },
    // 給資訊卡顯示狀態
    status(idx, soundOn) {
      if (idx < 0) return '';
      if (works[idx].audio) {
        if (!soundOn) return 'needs-sound';
        return localCur === idx ? 'local' : '';
      }
      if (failed.has(idx)) return 'blocked';
      if (ytCur === idx && playing) return soundOn ? 'yt' : 'yt-muted';
      return '';
    },
    get audible() {
      return (localCur >= 0) || (ready && ytCur >= 0 && playing && !player.isMuted());
    },
    resize(w, h) { css.setSize(w, h); },
  };
}
