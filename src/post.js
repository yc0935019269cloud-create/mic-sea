// 後製：兩個場景各自渲染，再用「六角網罩」遮罩合成，接泛光、色調映射、色散與底片顆粒。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const fullVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const compositeFrag = /* glsl */`
  uniform sampler2D tBooth, tSea;
  uniform float uMix, uAspect, uTime;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec4 hexCoords(vec2 uv){
    const vec2 r = vec2(1.0, 1.7320508);
    const vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }
  float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
  void main(){
    float m = uMix;
    float e = m * m * (3.0 - 2.0 * m);
    vec2 bUv = (vUv - 0.5) * (1.0 - 0.45 * e) + 0.5;            // 錄音間繼續往前推
    vec2 sUv = (vUv - 0.5) * (1.0 - 0.22 * (1.0 - e)) + 0.5;    // 海從放大的狀態退回原樣
    vec3 booth = texture2D(tBooth, bUv).rgb;
    vec3 sea = texture2D(tSea, sUv).rgb;
    if (m <= 0.0001) { gl_FragColor = vec4(booth, 1.0); return; }
    if (m >= 0.9999) { gl_FragColor = vec4(sea, 1.0); return; }
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
    float web = (1.0 - smoothstep(0.42, 0.5, d)) ;               // 格線本身稍微壓暗錄音間
    vec3 col = mix(booth * mix(1.0, 0.55, smoothstep(0.0, 0.4, m)) * mix(0.85, 1.0, web), sea * (0.75 + 0.25 * t), mask);
    col += rim * vec3(3.2, 2.1, 1.0) * 0.9;
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
  const rtBooth = new THREE.WebGLRenderTarget(w * dpr, h * dpr, opts);
  const rtSea = new THREE.WebGLRenderTarget(w * dpr, h * dpr, opts);

  const composite = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { tBooth: { value: null }, tSea: { value: null }, uMix: { value: 0 }, uAspect: { value: w / h }, uTime: { value: 0 } },
    vertexShader: fullVert, fragmentShader: compositeFrag,
  }));
  composite.uniforms.tBooth.value = rtBooth.texture;
  composite.uniforms.tSea.value = rtSea.texture;

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
    rtBooth, rtSea, composite, bloom, finish, composer,
    resize(w2, h2) {
      const d = renderer.getPixelRatio();
      rtBooth.setSize(w2 * d, h2 * d); rtSea.setSize(w2 * d, h2 * d);
      composer.setSize(w2, h2);
      composite.uniforms.uAspect.value = w2 / h2;
    },
  };
}
