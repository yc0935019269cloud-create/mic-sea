// 聲音：海浪底噪、A/B 對照交叉淡化、旋律彩蛋的合成音。瀏覽器規定要使用者點過才能出聲。
export class AudioEngine {
  constructor() { this.ready = false; this.muted = true; this.abPlaying = false; }

  init() {
    if (this.ready) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);

    // 殘響（程式產生的脈衝響應）
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
    this.reverb.connect(this.wet).connect(this.master);

    // 海浪：粉紅雜訊 → 低通
    const nlen = ctx.sampleRate * 6, nb = ctx.createBuffer(1, nlen, ctx.sampleRate), nd = nb.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < nlen; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    this.seaFilter = ctx.createBiquadFilter(); this.seaFilter.type = 'lowpass'; this.seaFilter.frequency.value = 520; this.seaFilter.Q.value = 0.4;
    this.seaGain = ctx.createGain(); this.seaGain.gain.value = 0;
    noise.connect(this.seaFilter).connect(this.seaGain).connect(this.master);
    noise.start();

    // 錄音間：很輕的房間底噪（低頻嗡聲）
    this.room = ctx.createOscillator(); this.room.frequency.value = 60; this.room.type = 'sine';
    this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0;
    this.room.connect(this.roomGain).connect(this.master); this.room.start();

    // 作品預覽：島上自動播放的混音片段都走這條，分析器拿來讓畫框跟著音樂發光
    this.previewBus = ctx.createGain();
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
    this.previewBus.connect(this.analyser).connect(this.master);
    this._lvl = new Uint8Array(this.analyser.fftSize);

    // A/B
    this.abGainA = ctx.createGain(); this.abGainB = ctx.createGain();
    this.abBus = ctx.createGain(); this.abBus.gain.value = 0;
    this.abGainA.connect(this.abBus); this.abGainB.connect(this.abBus); this.abBus.connect(this.master);
    this.elA = new Audio('assets/audio/ab-before.mp3'); this.elB = new Audio('assets/audio/ab-after.mp3');
    for (const el of [this.elA, this.elB]) { el.loop = true; el.preload = 'auto'; }
    ctx.createMediaElementSource(this.elA).connect(this.abGainA);
    ctx.createMediaElementSource(this.elB).connect(this.abGainB);
    this.setAB(0);
    this.ready = true;
  }

  setMuted(m) {
    if (!this.ready) return;
    this.muted = m;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.4);
  }

  setAB(x) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.abGainA.gain.setTargetAtTime(Math.cos(x * Math.PI / 2), t, 0.05);
    this.abGainB.gain.setTargetAtTime(Math.sin(x * Math.PI / 2), t, 0.05);
  }

  async playAB(on) {
    if (!this.ready) return;
    this.abPlaying = on;
    const t = this.ctx.currentTime;
    if (on) {
      this.elB.currentTime = this.elA.currentTime;
      await Promise.all([this.elA.play(), this.elB.play()]).catch(() => {});
      this.abBus.gain.setTargetAtTime(1, t, 0.15);
    } else {
      this.abBus.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => { if (!this.abPlaying) { this.elA.pause(); this.elB.pause(); } }, 600);
    }
  }

  // 每幀：依場景調整環境聲
  update(st) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const uw = st.under || 0; // 水下：海浪聲變悶、變小
    const sea = (st.seaVis * (1 - st.reveal * 0.5) + uw * 0.6) * (this.abPlaying ? 0.35 : 1) * (st.duck ? 0.25 : 1);
    this.seaGain.gain.setTargetAtTime(sea * (0.5 + st.storm * 0.9), t, 0.3);
    this.seaFilter.frequency.setTargetAtTime((420 + st.storm * 2200 + st.vel * 1800) * (1 - uw) + (150 + st.vel * 300) * uw, t, 0.2);
    this.roomGain.gain.setTargetAtTime((1 - st.seaVis - uw) * 0.012, t, 0.3);
    // A/B 時一起變化：Before 時讓聲音也像隔著霧（壓高頻）
    // 離開 A/B 區段就停播
    if (this.abPlaying && !st.inAB) this.playAB(false);
  }

  // 預覽音量（0–1 左右），給畫框脈動用
  level() {
    if (!this.ready) return 0;
    this.analyser.getByteTimeDomainData(this._lvl);
    let s = 0;
    for (let i = 0; i < this._lvl.length; i++) { const v = (this._lvl[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / this._lvl.length);
  }

  // 旋律彩蛋：柔和的鐘琴音色
  note(freq, when, dur = 1.6, vel = 0.22) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2).connect(g);
    g.connect(this.master); g.connect(this.reverb);
    o1.start(when); o2.start(when); o1.stop(when + dur + 0.1); o2.stop(when + dur + 0.1);
  }
}
