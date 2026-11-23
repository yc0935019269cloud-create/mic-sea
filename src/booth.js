// 深夜錄音間：開場與結尾的場景。座標單位是公尺，麥克風頭在 (0, 1.62, 0)。
import * as THREE from 'three';
import { MELODY } from './data.js';

export const MIC_HEAD = new THREE.Vector3(0, 1.62, 0);

// 六角網罩貼圖（白＝金屬，黑＝孔），可無縫重複。
export function hexGrilleCanvas(R = 18) {
  const w = Math.sqrt(3) * R;
  const cols = 8, rows = 8;
  const W = Math.round(cols * w), H = Math.round(rows * 1.5 * R);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff'; g.lineWidth = R * 0.32; g.lineJoin = 'round';
  for (let r = -1; r <= rows + 1; r++) {
    for (let col = -1; col <= cols + 1; col++) {
      const cx = col * w + (r & 1) * w / 2, cy = r * 1.5 * R;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 90);
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.stroke();
    }
  }
  return c;
}

// 譜架上的手寫譜：和海上島嶼排出的旋律是同一段（伏筆）。
function sheetCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 720;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 720);
  grd.addColorStop(0, '#f4ead6'); grd.addColorStop(1, '#e6d6ba');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 720);
  g.fillStyle = '#3a2c28';
  g.font = 'italic 44px "Cormorant Garamond", serif';
  g.fillText('for you', 70, 110);
  g.font = '28px "Noto Serif TC", serif';
  g.fillText('— 蘇白', 820, 110);
  const top = 260, gap = 26, left = 70, right = 954;
  g.strokeStyle = '#4a3a34'; g.lineWidth = 2.2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(left, top + i * gap); g.lineTo(right, top + i * gap); g.stroke(); }
  // 第二行空譜（等下一個音符）
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(left, 500 + i * gap); g.lineTo(right, 500 + i * gap); g.stroke(); }
  const bottom = top + 4 * gap;
  MELODY.forEach((k, i) => {
    const x = 190 + i * 95, y = bottom - k * gap / 2;
    g.save(); g.translate(x, y); g.rotate(-0.35);
    g.beginPath(); g.ellipse(0, 0, 15, 10.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.lineWidth = 2.6; g.beginPath();
    if (k < 4) { g.moveTo(x + 13, y - 3); g.lineTo(x + 13, y - 82); } else { g.moveTo(x - 13, y + 3); g.lineTo(x - 13, y + 82); }
    g.stroke();
  });
  g.font = 'italic 30px "Cormorant Garamond", serif';
  g.fillStyle = 'rgba(58,44,40,0.55)';
  g.fillText('?', 200, 560);
  return c;
}

function cityCanvas() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 400;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 400);
  grd.addColorStop(0, '#0b1230'); grd.addColorStop(0.7, '#1d2350'); grd.addColorStop(1, '#3a2a55');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 400);
  for (let i = 0; i < 26; i++) {
    const bw = 18 + Math.random() * 40, bh = 60 + Math.random() * 220, bx = Math.random() * 512;
    g.fillStyle = `rgba(8,10,24,${0.75 + Math.random() * 0.25})`;
    g.fillRect(bx, 400 - bh, bw, bh);
    for (let k = 0; k < bh / 9; k++) if (Math.random() < 0.35) {
      g.fillStyle = Math.random() < 0.7 ? 'rgba(255,190,120,0.9)' : 'rgba(170,200,255,0.8)';
      g.fillRect(bx + 3 + Math.random() * (bw - 6), 400 - bh + 4 + k * 9, 2.2, 2.2);
    }
  }
  return c;
}

function dustSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function foamWall(mesh, start, idx, origin, u, v, normal, nu, nv, step, colors, holes = () => false) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const spin = new THREE.Quaternion().setFromAxisAngle(normal, Math.PI / 4);
  q.premultiply(spin);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  let n = start;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const pi = Math.floor(i / 5), pj = Math.floor(j / 5);
    if (i % 5 === 4 || j % 5 === 4) continue; // 面板間留縫
    p.copy(origin).addScaledVector(u, i * step).addScaledVector(v, j * step).addScaledVector(normal, step * 0.32);
    if (holes(p)) continue;
    const h = 0.85 + ((i * 7 + j * 13 + idx) % 5) * 0.05;
    s.set(1, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.set(colors[(pi + pj + idx) % colors.length]);
    mesh.setColorAt(n, col);
    n++;
  }
  return n;
}

export function createBooth(tex) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040508);
  scene.fog = new THREE.Fog(0x040508, 5, 13);
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 40);

  const updaters = [];

  // ---------- 房間 ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 7.4), new THREE.MeshStandardMaterial({ color: 0x2a1f19, roughness: 0.7, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.9); floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.MeshStandardMaterial({ color: 0x3b2638, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.2); rug.receiveShadow = true; scene.add(rug);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.3), wallMat); back.position.set(0, 1.65, -2.5); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.3), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-3.1, 1.65, 0.9); scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.3), wallMat); right.rotation.y = -Math.PI / 2; right.position.set(3.1, 1.65, 0.9); scene.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 7.4), wallMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.3, 0.9); scene.add(ceil);

  // 吸音棉（金字塔）
  const step = 0.15;
  const foamGeo = new THREE.ConeGeometry(step * 0.7, step * 0.62, 4, 1);
  const foam = new THREE.InstancedMesh(foamGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 2600);
  foam.receiveShadow = true;
  const colors = [0x22252e, 0x2b2230, 0x1d2027];
  let n = 0;
  n = foamWall(foam, n, 0, new THREE.Vector3(-2.85, 0.35, -2.5), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), 39, 19, step, colors);
  const windowHole = (p) => p.z > -1.55 && p.z < -0.15 && p.y > 1.15 && p.y < 2.35;
  n = foamWall(foam, n, 1, new THREE.Vector3(-3.1, 0.35, -2.35), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 38, 19, step, colors, windowHole);
  n = foamWall(foam, n, 2, new THREE.Vector3(3.1, 0.35, -2.35), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0), 38, 19, step, colors);
  foam.count = n; foam.instanceMatrix.needsUpdate = true; foam.instanceColor.needsUpdate = true;
  scene.add(foam);

  // 窗外的夜景
  const city = new THREE.CanvasTexture(cityCanvas()); city.colorSpace = THREE.SRGBColorSpace;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ map: city, color: new THREE.Color(1.3, 1.3, 1.5) }));
  win.rotation.y = Math.PI / 2; win.position.set(-3.08, 1.75, -0.85); scene.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.6, metalness: 0.4 });
  [[0, 0.57, 1.42, 0.05], [0, -0.57, 1.42, 0.05], [0.69, 0, 0.05, 1.2], [-0.69, 0, 0.05, 1.2], [0, 0, 0.03, 1.1]].forEach(([dz, dy, w, h]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameMat); b.position.set(-3.05, 1.75 + dy, -0.85 + dz); scene.add(b);
  });
  const winLight = new THREE.PointLight(0x5a74ff, 6, 7, 1.6); winLight.position.set(-2.6, 1.8, -0.85); scene.add(winLight);

  // ---------- 麥克風 ----------
  const mic = new THREE.Group(); scene.add(mic);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.35, metalness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a860, roughness: 0.25, metalness: 1.0 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.42, 48), metal); body.position.y = 1.31; body.castShadow = true; mic.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 16, 64), gold); ring.rotation.x = Math.PI / 2; ring.position.y = 1.525; mic.add(ring);
  const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.12, 12, 48), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8 }));
  inner.position.copy(MIC_HEAD); mic.add(inner);
  const grilleTex = new THREE.CanvasTexture(hexGrilleCanvas());
  grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping; grilleTex.anisotropy = 8;
  const gimg = grilleTex.image; grilleTex.repeat.set(6, 6 * gimg.width / gimg.height);
  // 膠囊內建 UV 在中段會被拉長，改用「繞一圈的角度 × 高度/周長」的等比例 UV
  const grilleGeo = new THREE.CapsuleGeometry(0.106, 0.12, 16, 64);
  {
    const pos = grilleGeo.attributes.position, uv = grilleGeo.attributes.uv, C = 2 * Math.PI * 0.106;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      uv.setXY(i, Math.atan2(x, z) / (2 * Math.PI) + 0.5, y / C);
    }
    uv.needsUpdate = true;
  }
  const grille = new THREE.Mesh(grilleGeo, new THREE.MeshStandardMaterial({
    color: 0xc9c2b6, metalness: 1, roughness: 0.28, alphaMap: grilleTex, alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  grille.position.copy(MIC_HEAD); grille.castShadow = true; mic.add(grille);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.2, 0.4) }));
  led.position.set(0, 1.42, 0.066); mic.add(led);
  // 防震架
  const shock = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 12, 64), metal); shock.rotation.x = Math.PI / 2; shock.position.y = 1.3; mic.add(shock);
  const shock2 = shock.clone(); shock2.position.y = 1.18; mic.add(shock2);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.6 }));
    s.position.set(Math.cos(a) * 0.1, 1.24, Math.sin(a) * 0.1); s.rotation.z = Math.cos(a) * 0.6; s.rotation.x = -Math.sin(a) * 0.6; mic.add(s);
  }
  // 腳架
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1.14, 16), metal); pole.position.y = 0.6; pole.castShadow = true; mic.add(pole);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + 0.4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 8), metal);
    leg.position.set(Math.cos(a) * 0.26, 0.14, Math.sin(a) * 0.26); leg.lookAt(0, 0.4, 0); leg.rotateX(Math.PI / 2);
    leg.castShadow = true; mic.add(leg);
  }
  // 防噴罩：鏡頭會從正中央穿過去
  const popRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.006, 12, 64), metal); popRing.position.set(0, 1.62, 0.34); mic.add(popRing);
  const popMesh = new THREE.Mesh(new THREE.CircleGeometry(0.13, 48), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, transparent: true, opacity: 0.32, roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
  popMesh.position.copy(popRing.position); mic.add(popMesh);
  const gooseneck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.016, 1.0, 0.0), new THREE.Vector3(0.12, 1.25, 0.12), new THREE.Vector3(0.14, 1.5, 0.3), new THREE.Vector3(0.13, 1.6, 0.34),
  ]), 32, 0.006, 8), metal); mic.add(gooseneck);

  // ---------- 譜架 ----------
  const stand = new THREE.Group(); stand.position.set(-0.85, 0, 0.55); stand.rotation.y = 0.55; scene.add(stand);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.05, 12), metal); sp.position.y = 0.52; stand.add(sp);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.012), metal); desk.position.set(0, 1.18, 0); desk.rotation.x = -0.38; desk.castShadow = true; stand.add(desk);
  const sheetTex = new THREE.CanvasTexture(sheetCanvas()); sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.anisotropy = 8;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9 }));
  sheet.position.set(0, 1.19, 0.009); sheet.rotation.x = -0.38; stand.add(sheet);

  // ---------- 桌子、檯燈、照片 ----------
  const table = new THREE.Group(); table.position.set(1.75, 0, -1.2); table.rotation.y = -0.35; scene.add(table);
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.55 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), wood); top.position.y = 0.76; top.castShadow = top.receiveShadow = true; table.add(top);
  [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.04), wood); l.position.set(x, 0.38, z); table.add(l); });
  // 監聽喇叭
  [-0.55, 0.45].forEach((x) => {
    const spk = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.5 }));
    spk.position.set(x, 0.94, -0.18); spk.castShadow = true; table.add(spk);
    const woof = new THREE.Mesh(new THREE.CircleGeometry(0.065, 32), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.3, metalness: 0.6 }));
    woof.position.set(x, 0.9, -0.069); table.add(woof);
  });
  // 錄音介面
  const iface = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: 0xb0361f, roughness: 0.4, metalness: 0.3 }));
  iface.position.set(-0.05, 0.81, 0.08); table.add(iface);
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3, 0.8) });
  for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, 0.004), ledMat); d.position.set(-0.15 + k * 0.014, 0.83, 0.161); table.add(d); }
  // 耳機
  const hp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 10, 32, Math.PI), new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.5 }));
  hp.position.set(0.25, 0.79, 0.15); hp.rotation.set(-Math.PI / 2, 0, 0.4); table.add(hp);
  // 照片（本人頭像）
  const photo = new THREE.Group(); photo.position.set(0.22, 0.785, -0.05); photo.rotation.set(-0.18, -0.35, 0); table.add(photo);
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.012), new THREE.MeshStandardMaterial({ color: 0xcaa36a, roughness: 0.3, metalness: 0.8 }));
  pf.position.y = 0.085; photo.add(pf);
  if (tex.avatar) {
    const av = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshStandardMaterial({ map: tex.avatar, roughness: 0.6 }));
    av.position.set(0, 0.085, 0.0065); photo.add(av);
  }
  // 檯燈
  const lamp = new THREE.Group(); lamp.position.set(-0.55, 0.785, 0.15); table.add(lamp);
  const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), gold); lpole.position.y = 0.21; lamp.add(lpole);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.11, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d3a2e, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(0.04, 0.44, 0.02); shade.rotation.z = 0.5; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.6) }));
  bulb.position.set(0.055, 0.405, 0.02); lamp.add(bulb);

  // ---------- 燈光 ----------
  scene.add(new THREE.HemisphereLight(0x46527a, 0x1c1410, 1.1));
  const lampLight = new THREE.PointLight(0xffa860, 7, 6, 1.6);
  table.updateMatrixWorld(true); bulb.getWorldPosition(lampLight.position); scene.add(lampLight);
  const key = new THREE.SpotLight(0xffc690, 70, 9, 0.34, 0.6, 2);
  key.position.set(1.3, 2.9, 1.7); key.target.position.copy(MIC_HEAD).add(new THREE.Vector3(0, -0.2, 0));
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0x86a6ff, 80, 9, 0.35, 0.7, 2);
  rim.position.set(-0.7, 2.6, -1.6); rim.target.position.copy(MIC_HEAD); scene.add(rim, rim.target);
  const wash = new THREE.SpotLight(0xff9f70, 28, 10, 0.9, 1, 2); // 打亮吸音牆，讓空間有輪廓
  wash.position.set(1.6, 2.9, 2.2); wash.target.position.set(-0.8, 1.2, -2.5); scene.add(wash, wash.target);
  const fill = new THREE.SpotLight(0xff8f6a, 16, 8, 0.6, 1, 2);
  fill.position.set(-1.8, 1.2, 2.4); fill.target.position.set(-0.6, 1.1, 0.4); scene.add(fill, fill.target);

  // ---------- 灰塵 ----------
  const DN = 700;
  const dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 3.2; dpos[i * 3 + 1] = Math.random() * 3; dpos[i * 3 + 2] = (Math.random() - 0.5) * 3.6 + 0.6;
    dseed[i] = Math.random() * 100;
  }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
    map: dustSprite(), size: 0.012, color: new THREE.Color(2.2, 1.6, 1.1), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  scene.add(dust);

  updaters.push((t, dt) => {
    for (let i = 0; i < DN; i++) {
      const s = dseed[i];
      dpos[i * 3] += Math.sin(t * 0.21 + s) * 0.0006;
      dpos[i * 3 + 1] += Math.sin(t * 0.13 + s * 1.7) * 0.0005 - 0.00012;
      dpos[i * 3 + 2] += Math.cos(t * 0.17 + s) * 0.0006;
      if (dpos[i * 3 + 1] < 0) dpos[i * 3 + 1] = 3;
    }
    dgeo.attributes.position.needsUpdate = true;
    const flick = 1 + Math.sin(t * 23.0) * 0.015 + Math.sin(t * 7.3) * 0.02;
    lampLight.intensity = 2.4 * flick;
    led.material.color.setRGB(4 * (0.75 + 0.25 * Math.sin(t * 2.2)), 1.2, 0.4);
  });

  // ---------- 鏡頭路徑 ----------
  const inPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.5, 1.85, 3.4), new THREE.Vector3(1.15, 1.72, 1.75), new THREE.Vector3(0.12, 1.63, 0.75), new THREE.Vector3(0, 1.62, 0.235),
  ], false, 'centripetal');
  const inLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 1.35, 0), new THREE.Vector3(0, 1.5, 0), MIC_HEAD.clone(), MIC_HEAD.clone(),
  ]);
  const outPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.62, 0.16), new THREE.Vector3(0.05, 1.64, 0.9), new THREE.Vector3(-0.6, 1.72, 2.1), new THREE.Vector3(-1.45, 1.78, 3.05),
  ], false, 'centripetal');
  const outLook = new THREE.CatmullRomCurve3([
    MIC_HEAD.clone(), MIC_HEAD.clone(), new THREE.Vector3(-0.35, 1.45, 0.2), new THREE.Vector3(-0.55, 1.3, 0.3),
  ]);

  return { scene, cam, inPath, inLook, outPath, outLook, update(t, dt) { updaters.forEach((f) => f(t, dt)); } };
}
