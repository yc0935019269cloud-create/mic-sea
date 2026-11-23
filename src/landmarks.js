import * as THREE from 'three';

export const LANDMARK_KINDS = ['lighthouse','carousel','gate','greenhouse','stage','belltower','observatory','windmill'];

function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function makeCtx(opts) {
  const accent = new THREE.Color(opts.accent ?? 0xffb070);
  const base = new THREE.Color(opts.base ?? 0xf3e6dc);
  const rand = rng(opts.seed ?? 1);
  const group = new THREE.Group();
  const body = (tint = 0, rough = 0.7) => {
    const c = base.clone();
    c.offsetHSL((rand() - 0.5) * 0.02, 0, tint + (rand() - 0.5) * 0.04);
    return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05 });
  };
  const colored = (hex, rough = 0.7) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05 });
  const glow = (k = 3) => new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.4), emissive: accent, emissiveIntensity: k, roughness: 0.6 });
  const beam = (op = 0.25) => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  return { THREE, accent, base, rand, group, body, colored, glow, beam, add };
}

const builders = {
  lighthouse(c) {
    const { group, add, body, glow, beam, colored } = c;
    add(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 24), body(-0.1), 0, 0.25, 0);
    const stripes = [body(0.03), colored(0xd9605a)];
    for (let i = 0; i < 4; i++) {
      const r0 = 1.7 - i * 0.2, r1 = 1.7 - (i + 1) * 0.2;
      add(new THREE.CylinderGeometry(r1, r0, 1.4, 20), stripes[i % 2], 0, 0.5 + 0.7 + i * 1.4, 0);
    }
    add(new THREE.CylinderGeometry(1.35, 1.0, 0.25, 20), body(-0.05), 0, 6.2, 0);
    add(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 16), glow(3.5), 0, 6.9, 0);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), body(-0.1), Math.cos(a) * 0.75, 6.9, Math.sin(a) * 0.75);
    }
    add(new THREE.ConeGeometry(1.0, 0.9, 20), colored(0xd9605a), 0, 7.95, 0);
    add(new THREE.SphereGeometry(0.12, 8, 6), glow(3), 0, 8.5, 0);
    const bg = new THREE.Group(); bg.position.y = 6.9; group.add(bg);
    const geo = new THREE.ConeGeometry(0.8, 3.6, 16, 1, true);
    geo.rotateZ(-Math.PI / 2); geo.translate(1.8, 0, 0);
    const b1 = new THREE.Mesh(geo, beam(0.22));
    const b2 = b1.clone(); b2.rotation.y = Math.PI;
    bg.add(b1, b2);
    return (t) => { bg.rotation.y = t * 0.6; };
  },

  carousel(c) {
    const { group, add, body, glow, colored, rand } = c;
    add(new THREE.CylinderGeometry(2.9, 3.0, 0.4, 28), body(-0.08), 0, 0.2, 0);
    const spin = new THREE.Group(); spin.position.y = 0.4; group.add(spin);
    add(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 28), colored(0xc99a7a), 0, 0.1, 0, spin);
    add(new THREE.CylinderGeometry(0.35, 0.35, 5, 12), body(-0.03), 0, 2.6, 0, spin);
    const N = 6, horses = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      const x = Math.cos(a) * 2.2, z = Math.sin(a) * 2.2;
      add(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 6), colored(0xd8b86a, 0.5), x, 2.5, z, spin);
      add(new THREE.SphereGeometry(0.09, 6, 4), glow(3), x, 4.85, z, spin);
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4;
      const h = new THREE.Group();
      h.position.set(Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5);
      h.rotation.y = -a;
      const hm = body(0.02 - rand() * 0.06);
      add(new THREE.BoxGeometry(0.9, 0.45, 0.4), hm, 0, 0.7, 0, h);
      add(new THREE.BoxGeometry(0.3, 0.7, 0.28), hm, 0.45, 1.1, 0, h);
      add(new THREE.BoxGeometry(0.35, 0.25, 0.25), hm, 0.65, 1.4, 0, h);
      for (const [dx, dz] of [[-0.3, -0.12], [-0.3, 0.12], [0.3, -0.12], [0.3, 0.12]])
        add(new THREE.BoxGeometry(0.1, 0.45, 0.1), hm, dx, 0.3, dz, h);
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), colored(0xd8b86a, 0.5), 0, 1.2, 0, h);
      spin.add(h); horses.push({ h, ph: i * 1.6 });
    }
    add(new THREE.ConeGeometry(3.2, 1.8, 28), colored(0xd9605a), 0, 5.9, 0, spin);
    add(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 28), body(0.02), 0, 4.95, 0, spin);
    add(new THREE.SphereGeometry(0.2, 8, 6), glow(3), 0, 6.95, 0, spin);
    const bulbG = new THREE.SphereGeometry(0.12, 6, 4), bm = glow(3.5);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      add(bulbG, bm, Math.cos(a) * 3.2, 4.75, Math.sin(a) * 3.2, spin);
    }
    return (t) => {
      spin.rotation.y = t * 0.3;
      for (const o of horses) o.h.position.y = 1.2 + Math.sin(t * 2 + o.ph) * 0.25;
    };
  },

  gate(c) {
    const { group, add, colored, body, glow, rand } = c;
    const red = colored(0xd9605a, 0.6), dark = colored(0x3a3036, 0.8);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.28, 0.34, 6.4, 14), red, s * 2.2, 3.2, 0);
      add(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), dark, s * 2.2, 0.15, 0);
      add(new THREE.BoxGeometry(0.2, 0.2, 0.2), glow(3), s * 2.2, 0.0, 0.35);
    }
    add(new THREE.BoxGeometry(5.6, 0.4, 0.5), red, 0, 5.3, 0);
    const kasagi = add(new THREE.BoxGeometry(7, 0.5, 0.8), dark, 0, 6.6, 0);
    add(new THREE.BoxGeometry(6.0, 0.35, 0.7), dark, 0, 6.3, 0);
    for (const s of [-1, 1]) {
      const e = add(new THREE.BoxGeometry(1.2, 0.5, 0.8), dark, s * 3.5, 6.8, 0);
      e.rotation.z = s * 0.25;
    }
    add(new THREE.BoxGeometry(1.0, 1.3, 0.3), body(), 0, 5.8 - 0.1, 0);
    add(new THREE.BoxGeometry(0.6, 0.9, 0.2), glow(2.5), 0, 5.7, 0.2);
    add(new THREE.BoxGeometry(5.4, 0.25, 0.4), red, 0, 4.2, 0);
    const lanterns = [];
    const lg = new THREE.SphereGeometry(0.32, 10, 8); lg.scale(1, 1.25, 1);
    const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Group();
      p.position.set(-2 + i, 5.1, 0);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), dark, 0, -0.2, 0, p);
      add(lg, glow(3), 0, -0.75, 0, p);
      add(cap, dark, 0, -0.4, 0, p);
      group.add(p); lanterns.push({ p, ph: rand() * 6 });
    }
    return (t) => { for (const l of lanterns) l.p.rotation.z = Math.sin(t * 1.5 + l.ph) * 0.12; };
  },

  greenhouse(c) {
    const { group, add, body, glow, colored, rand } = c;
    add(new THREE.BoxGeometry(5.6, 0.5, 4.6), body(-0.08), 0, 0.25, 0);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xdff2f0, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.22,
      transmission: 0.0, side: THREE.DoubleSide, depthWrite: false
    });
    const frame = body(-0.05, 0.6);
    const shape = new THREE.Group(); shape.position.y = 0.5; group.add(shape);
    const wallH = 2.2, W = 2.6, D = 4.2;
    // 桶形拱頂：半圓柱 + 牆
    const arch = new THREE.CylinderGeometry(W, W, D, 20, 1, true, 0, Math.PI);
    arch.rotateZ(Math.PI / 2); arch.rotateY(Math.PI / 2);
    arch.rotateX(0);
    const roofGeo = new THREE.CylinderGeometry(W, W, D, 20, 1, true, -Math.PI / 2, Math.PI);
    roofGeo.rotateX(Math.PI / 2);
    const roof = add(roofGeo, glass, 0, wallH, 0, shape);
    roof.castShadow = false; roof.renderOrder = 2;
    for (const s of [-1, 1]) {
      const w = add(new THREE.BoxGeometry(0.05, wallH, D), glass, s * W, wallH / 2, 0, shape);
      w.castShadow = false; w.renderOrder = 2;
    }
    for (const s of [-1, 1]) {
      const f = add(new THREE.BoxGeometry(W * 2, wallH, 0.05), glass, 0, wallH / 2, s * D / 2, shape);
      f.castShadow = false; f.renderOrder = 2;
    }
    const rib = new THREE.TorusGeometry(W, 0.07, 6, 18, Math.PI);
    for (let i = 0; i < 5; i++) {
      add(rib, frame, 0, wallH, -D / 2 + i * D / 4, shape);
    }
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.1, 0.1, D), frame, s * W, 0.05, 0, shape);
      add(new THREE.BoxGeometry(0.1, 0.1, D), frame, 0, W + wallH, 0, shape);
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.1, wallH, 0.1), frame, s * W, wallH / 2, -D / 2 + i * D / 4, shape);
    }
    const bulbs = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Group();
      p.position.set((rand() - 0.5) * 3.2, 0, -1.6 + i * 0.8);
      add(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), colored(0xb98466), 0, 0.15, 0, p);
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5), colored(0x6fa070), 0, 0.55, 0, p);
      const b = add(new THREE.SphereGeometry(0.32 + rand() * 0.15, 10, 8), glow(3), 0, 1.0 + rand() * 0.5, 0, p);
      bulbs.push({ b, ph: rand() * 6 });
      shape.add(p);
    }
    return (t) => { for (const o of bulbs) o.b.material.emissiveIntensity; };
  },

  stage(c) {
    const { group, add, body, glow, colored, beam } = c;
    const dark = colored(0x3a3036, 0.8);
    add(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 24, 1, false, -Math.PI / 2, Math.PI), body(-0.05), 0, 0.35, 0);
    add(new THREE.BoxGeometry(6.4, 0.7, 0.1), body(-0.05), 0, 0.35, 0);
    add(new THREE.CylinderGeometry(3.0, 3.0, 0.1, 24, 1, false, -Math.PI / 2, Math.PI), colored(0xc99a7a), 0, 0.75, 0);
    // 後牆（弧形）
    const wall = add(new THREE.CylinderGeometry(3.1, 3.1, 5.2, 24, 1, true, -Math.PI / 2 + Math.PI, Math.PI), body(-0.03), 0, 3.3, 0);
    wall.material.side = THREE.DoubleSide;
    wall.rotation.y = 0;
    // 頂棚：半個圓頂
    const shell = add(new THREE.SphereGeometry(3.4, 24, 8, Math.PI, Math.PI, 0, Math.PI / 2), colored(0xd9605a), 0, 5.9, 0);
    shell.material.side = THREE.DoubleSide;
    shell.scale.set(1, 0.7, 1);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.15, 0.15, 5.2, 8), body(), s * 3.1, 3.3, 0);
    // 立麥
    add(new THREE.CylinderGeometry(0.2, 0.25, 0.08, 10), dark, 0, 0.84, 1.3);
    add(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), dark, 0, 1.6, 1.3);
    add(new THREE.SphereGeometry(0.1, 8, 6), glow(3), 0, 2.4, 1.3);
    // 燈
    const lights = [];
    const cg = new THREE.ConeGeometry(0.9, 4.2, 14, 1, true);
    cg.translate(0, -2.1, 0);
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 2.2, 5.0, 1.0);
      add(new THREE.CylinderGeometry(0.2, 0.28, 0.4, 10), dark, 0, 0, 0, p);
      add(new THREE.SphereGeometry(0.17, 8, 6), glow(4), 0, -0.25, 0, p);
      const cone = new THREE.Mesh(cg, beam(0.18)); cone.position.y = -0.25; p.add(cone);
      group.add(p); lights.push({ p, s });
    }
    return (t) => { for (const l of lights) { l.p.rotation.z = Math.sin(t * 0.9 + l.s) * 0.35; l.p.rotation.x = Math.sin(t * 0.6 + l.s * 2) * 0.12; } };
  },

  belltower(c) {
    const { group, add, body, glow, colored } = c;
    const brick = body(-0.04);
    add(new THREE.BoxGeometry(3, 0.5, 3), body(-0.1), 0, 0.25, 0);
    add(new THREE.BoxGeometry(2.0, 5.2, 2.0), brick, 0, 3.1, 0);
    for (let i = 0; i < 3; i++) {
      add(new THREE.BoxGeometry(0.35, 0.7, 0.1), glow(2.5), 0, 1.6 + i * 1.3, 1.03);
      add(new THREE.BoxGeometry(0.1, 0.7, 0.35), glow(2.5), 1.03, 1.6 + i * 1.3, 0);
    }
    add(new THREE.BoxGeometry(2.4, 0.3, 2.4), body(), 0, 5.85, 0);
    // 鐘室四柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      add(new THREE.BoxGeometry(0.3, 1.8, 0.3), body(0.02), sx * 0.95, 6.9, sz * 0.95);
    add(new THREE.BoxGeometry(2.4, 0.3, 2.4), body(), 0, 7.95, 0);
    add(new THREE.ConeGeometry(1.8, 1.3, 4), colored(0xd9605a), 0, 8.75, 0).rotation.y = Math.PI / 4;
    const pivot = new THREE.Group(); pivot.position.set(0, 7.7, 0); group.add(pivot);
    add(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6).rotateZ(Math.PI / 2), colored(0x3a3036), 0, 0, 0, pivot);
    const bell = new THREE.CylinderGeometry(0.2, 0.6, 0.9, 16, 1, true);
    const bm = new THREE.MeshStandardMaterial({ color: 0xd8b86a, emissive: c.accent, emissiveIntensity: 2, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
    add(bell, bm, 0, -0.65, 0, pivot);
    add(new THREE.SphereGeometry(0.15, 8, 6), glow(3), 0, -1.15, 0, pivot);
    add(new THREE.SphereGeometry(0.2, 8, 6), bm, 0, -0.2, 0, pivot);
    return (t) => { pivot.rotation.z = Math.sin(t * 1.2) * 0.45; };
  },

  observatory(c) {
    const { group, add, body, glow, colored } = c;
    add(new THREE.CylinderGeometry(2.8, 3.0, 0.5, 28), body(-0.08), 0, 0.25, 0);
    add(new THREE.CylinderGeometry(2.4, 2.5, 3.4, 28), body(-0.02), 0, 2.2, 0);
    add(new THREE.CylinderGeometry(2.55, 2.55, 0.2, 28), colored(0xc99a7a), 0, 3.95, 0);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      add(new THREE.BoxGeometry(0.4, 0.8, 0.1), glow(2.5), Math.cos(a) * 2.42, 2.0, Math.sin(a) * 2.42).rotation.y = -a + Math.PI / 2;
    }
    const dome = new THREE.Group(); dome.position.y = 4.05; group.add(dome);
    // 圓頂開縫：跨越 phi 缺口
    const gap = 0.5;
    const dg = new THREE.SphereGeometry(2.4, 28, 12, gap / 2, Math.PI * 2 - gap, 0, Math.PI / 2);
    const dm = body(0.03); dm.side = THREE.DoubleSide;
    add(dg, dm, 0, 0, 0, dome);
    // 縫內發光
    const sl = add(new THREE.BoxGeometry(0.2, 2.2, 0.08), glow(3), 0, 1.2, 0, dome);
    sl.visible = false;
    const scope = new THREE.Group(); scope.position.set(0, 1.3, 0); group.add(scope);
    const scopeYaw = new THREE.Group(); scope.add(scopeYaw);
    const tube = add(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 12), colored(0x8a7a72, 0.5), 0, 0, 0, scopeYaw);
    tube.rotation.x = Math.PI / 2 - 0.9; tube.position.set(0, 0.7, -0.9 * 0 + 0.8);
    add(new THREE.SphereGeometry(0.2, 8, 6), glow(4), 0, 1.3, 1.5 * 0 + 1.6, scopeYaw);
    add(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8), body(-0.1), 0, 0.3, 0, scopeYaw).position.y = -0.4;
    // 圓頂開縫朝 +x（phi=0 附近缺口 → 開向 +z? 以 rotation 對齊）
    dome.rotation.y = 0;
    return (t) => {
      dome.rotation.y = Math.sin(t * 0.2) * 0.6;
      scopeYaw.rotation.y = Math.sin(t * 0.35) * 0.9;
    };
  },

  windmill(c) {
    const { group, add, body, glow, colored } = c;
    add(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 8), body(-0.1), 0, 0.25, 0);
    add(new THREE.CylinderGeometry(1.1, 1.9, 5.0, 8), body(-0.02), 0, 3.0, 0);
    add(new THREE.BoxGeometry(0.7, 1.2, 0.1), colored(0x8a5a4a), 0, 1.1, 1.75).rotation.x = 0;
    for (let i = 0; i < 2; i++) add(new THREE.BoxGeometry(0.4, 0.5, 0.1), glow(3), 0, 3.4 + i * 1.2, 1.35 - i * 0.28);
    add(new THREE.CylinderGeometry(1.25, 1.25, 0.25, 8), body(-0.06), 0, 5.6, 0);
    add(new THREE.ConeGeometry(1.4, 1.6, 8), colored(0xd9605a), 0, 6.5, 0);
    const hub = new THREE.Group(); hub.position.set(0, 5.9, 1.3); group.add(hub);
    add(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10).rotateX(Math.PI / 2), colored(0x3a3036), 0, 0, -0.2, hub);
    add(new THREE.SphereGeometry(0.25, 10, 8), glow(3), 0, 0, 0.2, hub);
    const bladeMat = body(0.05), frameMat = colored(0x8a5a4a);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm);
      add(new THREE.BoxGeometry(0.14, 3.8, 0.1), frameMat, 0, 1.9, 0.25, arm);
      add(new THREE.BoxGeometry(0.9, 2.4, 0.04), bladeMat, 0.5, 2.3, 0.27, arm);
    }
    return (t) => { hub.rotation.z = -t * 0.8; };
  }
};

export function buildLandmark(kind, opts = {}) {
  const fn = builders[kind];
  if (!fn) throw new Error('Unknown landmark kind: ' + kind);
  const c = makeCtx(opts);
  const anim = fn(c);
  const fit = { carousel: 0.75, gate: 0.78, stage: 0.8, windmill: 0.85, lighthouse: 0.95 }[kind] ?? 1;
  c.group.scale.setScalar(fit);
  c.group.userData.kind = kind;
  c.group.userData.update = (t, dt) => { if (anim) anim(t, dt); };
  return c.group;
}
