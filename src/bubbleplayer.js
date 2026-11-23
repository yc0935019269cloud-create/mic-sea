// 水下作品氣泡：點一顆就播那首。
// - YouTube／Shorts：圓形影片疊在氣泡裡（兩個播放器接力，新的開始出聲後舊的才淡出）
// - 站內音檔（BGM、得獎作）：走 Web Audio，氣泡跟著音量脈動
// - 只放在 X 的影片：在氣泡旁打開 X 的嵌入卡片（要在卡片裡按播放）
import * as THREE from 'three';
import { whenYT } from './yt.js';
import { linkOf } from './portfolio.js';

const FADE_IN = 110, FADE_OUT = 85;

export function createBubblePlayer(under, audio) {
  const stage = document.createElement('div'); stage.id = 'bubble-stage'; document.body.appendChild(stage);
  const tip = document.createElement('div'); tip.className = 'bub-tip'; stage.appendChild(tip);
  const cap = document.createElement('div'); cap.className = 'bub-cap';
  cap.innerHTML = '<p class="bub-t"></p><p class="bub-c"></p><a class="bub-l" target="_blank" rel="noopener"></a>';
  stage.appendChild(cap);
  const capT = cap.querySelector('.bub-t'), capC = cap.querySelector('.bub-c'), capL = cap.querySelector('.bub-l');
  const xPanel = document.createElement('div'); xPanel.className = 'bub-x'; stage.appendChild(xPanel);

  const B = under.bubbles;
  let cur = -1, hoverI = -1, active = false;

  // ---------- YouTube 兩個圓形播放器 ----------
  const slots = [0, 1].map(() => {
    const el = document.createElement('div'); el.className = 'bub-vid';
    const holder = document.createElement('div'); el.appendChild(holder);
    stage.appendChild(el);
    return { el, holder, player: null, ready: false, idx: -1, state: 'idle', playing: false, vol: 0, vis: 0 };
  });
  whenYT().then((YT) => {
    for (const s of slots) {
      s.player = new YT.Player(s.holder, {
        width: 640, height: 360,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, mute: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
        events: {
          onReady: () => { s.ready = true; s.player.mute(); s.player.setVolume(0); },
          onStateChange: (e) => {
            s.playing = e.data === YT.PlayerState.PLAYING;
            if (s.playing && s.state === 'loading') { s.state = 'on'; for (const o of slots) if (o !== s && o.state === 'on') o.state = 'out'; }
            if (e.data === YT.PlayerState.ENDED && s.idx >= 0) s.player.seekTo(B[s.idx].w.start || 0, true);
          },
          onError: () => { s.playing = false; if (s.state === 'loading') s.state = 'idle'; failed.add(s.idx); },
        },
      });
    }
  });
  const failed = new Set();

  // ---------- 站內音檔 ----------
  const local = new Map();
  function localFor(i) {
    if (!local.has(i)) {
      const el = new Audio(B[i].w.src); el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
      const gain = audio.ctx.createGain(); gain.gain.value = 0;
      audio.ctx.createMediaElementSource(el).connect(gain).connect(audio.previewBus);
      local.set(i, { el, gain });
    }
    return local.get(i);
  }
  function stopLocal(i) {
    const l = local.get(i); if (!l) return;
    const t = audio.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t); l.gain.gain.setTargetAtTime(0, t, 0.35);
    setTimeout(() => { if (cur !== i) l.el.pause(); }, 2000);
  }

  function stopAll() {
    if (cur >= 0 && B[cur].w.kind === 'mp3' && audio.ready) stopLocal(cur);
    for (const s of slots) if (s.state === 'on' || s.state === 'loading') s.state = s.state === 'on' ? 'out' : 'idle';
    xPanel.classList.remove('on'); xPanel.innerHTML = '';
    cur = -1;
  }

  function select(i) {
    if (i < 0) return;
    if (i === cur) { stopAll(); return; }
    const prev = cur;
    if (prev >= 0 && B[prev].w.kind === 'mp3' && audio.ready) stopLocal(prev);
    if (prev >= 0 && B[prev].w.kind === 'x') { xPanel.classList.remove('on'); xPanel.innerHTML = ''; }
    cur = i;
    const w = B[i].w;
    if (w.kind === 'mp3') {
      for (const s of slots) if (s.state === 'on') s.state = 'out'; else if (s.state === 'loading') s.state = 'idle';
      if (!audio.ready) return;
      const l = localFor(i), t = audio.ctx.currentTime;
      l.el.play().catch(() => {});
      l.gain.gain.cancelScheduledValues(t); l.gain.gain.setTargetAtTime(1, t + 0.1, 0.45);
    } else if (w.kind === 'x') {
      for (const s of slots) if (s.state === 'on') s.state = 'out'; else if (s.state === 'loading') s.state = 'idle';
      xPanel.innerHTML = `<iframe src="https://platform.twitter.com/embed/Tweet.html?id=${w.id}&theme=dark&dnt=true&hideThread=true" title="${w.title}" loading="lazy" allowfullscreen></iframe><a class="bub-l" href="${linkOf(w)}" target="_blank" rel="noopener">在 X 開啟 ↗</a>`;
      xPanel.classList.add('on');
    } else {
      const ok = slots.every((s) => s.ready) && !failed.has(i);
      if (!ok) return;
      const on = slots.find((s) => s.state === 'on');
      const s = slots.find((x) => x !== on && x.state !== 'on');
      const v = w.kind === 'short';
      s.el.classList.toggle('vertical', v);
      s.player.setVolume(0); s.vol = 0; s.vis = 0; s.idx = i; s.state = 'loading'; s.playing = false;
      s.player.loadVideoById({ videoId: w.id, startSeconds: w.start || 0 });
    }
    capT.textContent = w.title;
    capC.textContent = [w.credit, w.note].filter(Boolean).join('・');
    capL.href = linkOf(w);
    capL.textContent = w.kind === 'mp3' ? '' : w.kind === 'x' ? '' : '在 YouTube 開啟 ↗';
  }

  // ---------- 投影：氣泡在螢幕上的位置與大小 ----------
  const v = new THREE.Vector3(), rgt = new THREE.Vector3();
  function screenOf(i) {
    const b = B[i], cam = under.cam;
    b.grp.getWorldPosition(v);
    const sc = b.grp.scale.x * b.r;
    rgt.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(sc).add(v);
    v.project(cam); rgt.project(cam);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    const r = Math.abs((rgt.x - v.x) * 0.5 * innerWidth);
    return { x, y, r, front: v.z < 1 };
  }

  return {
    select,
    hover(i, mx, my) {
      hoverI = i;
      B.forEach((b, k) => { b.hoverT = k === i ? 1 : 0; });
      if (i >= 0 && active) {
        const w = B[i].w;
        tip.innerHTML = `<b>${w.title}</b><span>${[w.credit, w.note].filter(Boolean).join('・')}</span><em>${i === cur ? '再點一下停止' : '點一下播放'}</em>`;
        tip.style.transform = `translate(${mx + 18}px, ${my + 14}px)`;
        tip.classList.add('on');
      } else tip.classList.remove('on');
    },
    update(dt, isActive, soundOn) {
      if (active && !isActive) { stopAll(); tip.classList.remove('on'); }
      active = isActive;
      stage.classList.toggle('active', isActive);
      // 氣泡的大小／亮度狀態
      B.forEach((b, k) => {
        b.hover += ((b.hoverT || 0) - b.hover) * Math.min(1, dt * 8);
        b.play += ((k === cur ? 1 : 0) - b.play) * Math.min(1, dt * 4);
      });
      // YouTube 音量與畫面
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
        if (s.idx >= 0 && s.vis > 0.003) {
          const p = screenOf(s.idx), d = p.r * 2 * 0.86;
          s.el.style.width = s.el.style.height = `${d.toFixed(1)}px`;
          s.el.style.transform = `translate(${(p.x - d / 2).toFixed(1)}px, ${(p.y - d / 2).toFixed(1)}px)`;
          s.el.style.opacity = s.vis.toFixed(3);
          const iframe = s.el.querySelector('iframe');
          if (iframe) {
            const vert = s.el.classList.contains('vertical');
            const iw = vert ? d : d * 16 / 9, ih = vert ? d * 16 / 9 : d;
            iframe.style.width = `${iw}px`; iframe.style.height = `${ih}px`;
            iframe.style.transform = `translate(${(d - iw) / 2}px, ${(d - ih) / 2}px)`;
          }
        } else s.el.style.opacity = '0';
      }
      // 字幕與 X 卡片跟著目前播放的氣泡
      if (cur >= 0) {
        const p = screenOf(cur);
        cap.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + p.r * 1.08 + 10).toFixed(1)}px) translateX(-50%)`;
        cap.classList.add('on');
        if (B[cur].w.kind === 'x') {
          const left = p.x > innerWidth / 2 ? p.x - p.r - 340 : p.x + p.r + 20;
          const ph = xPanel.offsetHeight || 470;
          xPanel.style.transform = `translate(${Math.max(12, Math.min(innerWidth - 332, left)).toFixed(1)}px, ${Math.max(70, Math.min(innerHeight - ph - 12, p.y - ph / 2)).toFixed(1)}px)`;
        }
      } else cap.classList.remove('on');
    },
    get playing() { return cur; },
    get audible() {
      if (cur < 0) return false;
      if (B[cur].w.kind === 'mp3') return audio.ready && !audio.muted;
      return slots.some((s) => s.ready && s.playing && s.state !== 'idle' && !s.player.isMuted());
    },
    get isLocal() { return cur >= 0 && B[cur].w.kind === 'mp3'; },
  };
}
