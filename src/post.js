// 後製：兩個場景各自渲染，再依轉場種類合成（六角網罩／水面線／氣泡），接泛光、色調映射、色散與底片顆粒。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const fullVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const compositeFrag = /* glsl */`
  uniform sampler2D tA, tB;
  uniform float uMix, uAspect, uTime, uMode;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + 19.19)); }
  vec4 hexCoords(vec2 uv){
    const vec2 r = vec2(1.0, 1.7320508);
    const vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }
  float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }

  // 0：麥克風六角網罩（A＝錄音間、B＝海）
  vec3 hexMix(float m){
    float e = m * m * (3.0 - 2.0 * m);
    vec2 bUv = (vUv - 0.5) * (1.0 - 0.45 * e) + 0.5;
    vec2 sUv = (vUv - 0.5) * (1.0 - 0.22 * (1.0 - e)) + 0.5;
    vec3 booth = texture2D(tA, bUv).rgb;
    vec3 sea = texture2D(tB, sUv).rgb;
    vec2 c = vUv - 0.5; c.x *= uAspect;
    float scale = mix(22.0, 1.6, e);
    vec4 hx = hexCoords(c * scale);
    float d = hexDist(hx.xy);
    float rad = length(hx.zw / scale);
    float n = hash(hx.zw + 3.1);
    float t = clamp(m * 2.3 - rad * 1.15 - n * 0.28, 0.0, 1.0);
    float open = t * 0.62;
    float aa = fwidth(d) * 1.5;
    float mask = (1.0 - smoothstep(open - aa, open + aa, d)) * step(0.0001, t);
    float rim = exp(-abs(d - open) * 70.0) * step(0.0001, t) * (1.0 - smoothstep(0.75, 1.0, m));
    float web = (1.0 - smoothstep(0.42, 0.5, d));
    vec3 col = mix(booth * mix(1.0, 0.55, smoothstep(0.0, 0.4, m)) * mix(0.85, 1.0, web), sea * (0.75 + 0.25 * t), mask);
    col += rim * vec3(3.2, 2.1, 1.0) * 0.9;
    return col;
  }

  // 1：潛水——水面線由下往上掃過鏡頭（A＝海面、B＝水下）
  vec3 diveMix(float m){
    float x = vUv.x;
    float line = mix(-0.12, 1.12, m);
    line += sin(x * 9.0 + uTime * 1.7) * 0.018 + sin(x * 23.0 - uTime * 2.6) * 0.008 + sin(x * 3.0 + uTime * 0.6) * 0.012;
    float dy = vUv.y - line;                 // 正：在水面線上方（還是海面）
    float under = 1.0 - smoothstep(-0.003, 0.003, dy);
    // 水下那半邊：靠近水面線的地方折射、偏青
    vec2 uU = vUv + vec2(sin(vUv.y * 40.0 + uTime * 3.0), cos(vUv.x * 33.0 - uTime * 2.0)) * 0.006 * exp(-abs(dy) * 6.0);
    vec3 B = texture2D(tB, uU).rgb;
    // 水面上那半邊：水珠糊糊的
    vec2 uA = vUv + vec2(0.0, -0.01 * exp(-abs(dy) * 30.0));
    vec3 A = texture2D(tA, uA).rgb;
    vec3 col = mix(A, B, under);
    float men = exp(-abs(dy) * 260.0);       // 水面那條亮線
    float dark = exp(-abs(dy + 0.012) * 120.0) * under;
    col += vec3(0.8, 1.0, 1.0) * men * 0.9;
    col *= 1.0 - dark * 0.35;
    return col;
  }

  // 2：氣泡——一顆顆氣泡長大，裡面看到的是下一個世界（A＝水下、B＝雲上）
  vec3 bubbleMix(float m){
    vec2 c = vUv - 0.5; c.x *= uAspect;
    vec3 A = texture2D(tA, vUv).rgb;
    float cover = 0.0; vec2 lens = vec2(0.0); float rim = 0.0;
    for (int L = 0; L < 3; L++) {
      float sc = 3.0 + float(L) * 3.5;
      vec2 g = c * sc + vec2(0.0, uTime * 0.25 * (1.0 + float(L)) + m * (2.0 + float(L) * 2.0));
      vec2 id = floor(g), f = fract(g);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 r = hash2(id + o + float(L) * 7.3);
        vec2 ctr = o + 0.2 + r * 0.6;
        float delay = r.x * 0.55 + float(L) * 0.08;
        float rad = clamp((m - delay) * 2.2, 0.0, 1.0) * (0.55 + r.y * 0.6);
        float d = length(f - ctr);
        float inside = 1.0 - smoothstep(rad - 0.02, rad, d);
        if (inside > cover) { cover = inside; lens = (f - ctr) / max(rad, 0.001) * 0.035 / sc; }
        rim += exp(-abs(d - rad) * 90.0) * step(0.001, rad) * (1.0 - smoothstep(0.7, 1.0, m));
      }
    }
    cover = max(cover, smoothstep(0.82, 0.98, m));
    vec3 B = texture2D(tB, vUv - lens * (1.0 - m)).rgb;
    vec3 col = mix(A, B, cover);
    vec3 film = 0.5 + 0.5 * cos(6.2832 * (vUv.x * 2.0 + vUv.y + uTime * 0.2 + vec3(0.0, 0.33, 0.67)));
    col += film * min(rim, 1.5) * 0.45;
    return col;
  }

  void main(){
    float m = uMix;
    if (m <= 0.0001) { gl_FragColor = vec4(texture2D(tA, vUv).rgb, 1.0); return; }
    if (m >= 0.9999) { gl_FragColor = vec4(texture2D(tB, vUv).rgb, 1.0); return; }
    vec3 col = uMode < 0.5 ? hexMix(m) : uMode < 1.5 ? diveMix(m) : bubbleMix(m);
    gl_FragColor = vec4(col, 1.0);
  }`;

const finishFrag = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float uTime, uVel, uFade, uGrade;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 dir = vUv - 0.5;
    float ca = 0.0012 + uVel * 0.018;
    vec3 col;
    col.r = texture2D(tDiffuse, vUv - dir * ca).r;
    col.g = texture2D(tDiffuse, vUv).g;
    col.b = texture2D(tDiffuse, vUv + dir * ca).b;
    // 調色：一點對比、一點飽和，暗部偏紫、亮部偏金
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.0 + uGrade * 0.28);
    col = (col - 0.5) * (1.0 + uGrade * 0.14) + 0.5;
    col += uGrade * (vec3(0.025, 0.0, 0.04) * (1.0 - l) + vec3(0.02, 0.01, -0.02) * l);
    col = max(col, 0.0);
    float v = smoothstep(0.95, 0.28, length(dir * vec2(1.0, 1.2)));
    col *= mix(0.5, 1.0, v);
    col += (hash(vUv * vec2(1931.0, 1087.0) + fract(uTime * 7.0) * 91.0) - 0.5) * 0.04;
    col *= uFade;
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createPost(renderer, w, h) {
  const opts = { type: THREE.HalfFloatType, samples: 4 };
  const dpr = renderer.getPixelRatio();
  const rtA = new THREE.WebGLRenderTarget(w * dpr, h * dpr, opts);
  const rtB = new THREE.WebGLRenderTarget(w * dpr, h * dpr, opts);

  const composite = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uMode: { value: 0 }, uAspect: { value: w / h }, uTime: { value: 0 } },
    vertexShader: fullVert, fragmentShader: compositeFrag,
  }));
  composite.uniforms.tA.value = rtA.texture;
  composite.uniforms.tB.value = rtB.texture;

  const composer = new EffectComposer(renderer);
  composer.addPass(composite);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.65, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVel: { value: 0 }, uFade: { value: 1 }, uGrade: { value: 0 } },
    vertexShader: fullVert, fragmentShader: finishFrag,
  }));
  composer.addPass(finish);

  return {
    rtA, rtB, composite, bloom, finish, composer,
    resize(w2, h2) {
      const d = renderer.getPixelRatio();
      rtA.setSize(w2 * d, h2 * d); rtB.setSize(w2 * d, h2 * d);
      composer.setSize(w2, h2);
      composite.uniforms.uAspect.value = w2 / h2;
    },
  };
}
