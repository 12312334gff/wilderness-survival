/* 荒野余生 3D · 场景搭建与主循环（Three.js） */
import * as THREE from '../vendor/three.module.js';
import { W, heightAt, forestDensity, generateObjects, generateAnimals, spawnPoint, clamp, buildHeightField, sampleHeight } from './world-data.js';

/* 共享高度场：地形网格与碰撞都从这份采样里取值 */
const HF = buildHeightField(220);
const groundAt = (x, z) => sampleHeight(HF, x, z);

const $ = (id) => document.getElementById(id);
const clock = new THREE.Clock();

/* ---------------- 渲染器 ---------------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfd9e8, 70, 210);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 600);
let camWide = window.innerWidth > window.innerHeight;

/* ---------------- 光照（昼夜） ---------------- */
const hemi = new THREE.HemisphereLight(0xbdd7ff, 0x3a3324, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 260;
const SH = 70;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH;
sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);

const MOON_DIR = new THREE.Vector3(-0.35, 0.75, 0.45).normalize();
const moon = new THREE.DirectionalLight(0x8fb2ff, 0.0);
scene.add(moon);

/* ---------------- 天空球 ---------------- */
const skyGeo = new THREE.SphereGeometry(420, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x4a8fd8) },
    bottomColor: { value: new THREE.Color(0xd8e8f0) },
    offset: { value: 30 },
    exponent: { value: 0.7 }
  },
  vertexShader: `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorld;
    void main(){ float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h,0.0), exponent)), 1.0); }`
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

/* 星星 */
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const r = 380;
    const y = Math.abs(u) * 0.9 + 0.08;
    pts.push(Math.cos(a) * Math.sqrt(1 - y * y) * r, y * r, Math.sin(a) * Math.sqrt(1 - y * y) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ---------------- 地形 ---------------- */
const TERRAIN_SEG = 220;
const terrainGeo = new THREE.PlaneGeometry(W.SIZE, W.SIZE, TERRAIN_SEG, TERRAIN_SEG);
terrainGeo.rotateX(-Math.PI / 2);
{
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x5c7d3a);
  const cGrass2 = new THREE.Color(0x6f8f45);
  const cDry = new THREE.Color(0x8f8a52);
  const cSand = new THREE.Color(0xd9c496);
  const cRock = new THREE.Color(0x7b766c);
  const cSnow = new THREE.Color(0xe6e9e4);
  const cWet = new THREE.Color(0x8f8a63);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundAt(x, z);
    pos.setY(i, h);
    // 坡度（局部差分）
    const hx = groundAt(x + 1.5, z) - groundAt(x - 1.5, z);
    const hz = groundAt(x, z + 1.5) - groundAt(x, z - 1.5);
    const slope = Math.min(1, Math.sqrt(hx * hx + hz * hz) / 5.0);
    const n = forestDensity(x, z);
    if (h < -0.3) tmp.copy(cWet);
    else if (h < 1.4) tmp.copy(cSand);
    else {
      tmp.copy(cGrass).lerp(cGrass2, n);
      tmp.lerp(cDry, clamp((h - 8) / 18, 0, 1) * 0.5);
      tmp.lerp(cRock, clamp((slope - 0.35) * 2.2, 0, 1));
      tmp.lerp(cSnow, clamp((h - 24) / 8, 0, 1));
    }
    // 轻微颗粒感
    const g = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    const v = 0.94 + Math.abs(g) * 0.12;
    colors[i * 3] = tmp.r * v;
    colors[i * 3 + 1] = tmp.g * v;
    colors[i * 3 + 2] = tmp.b * v;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
}
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

/* 海面 */
const waterGeo = new THREE.PlaneGeometry(900, 900, 1, 1);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e6f8f, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.88 });
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = W.WATER_LEVEL - 0.35;
scene.add(water);

/* ---------------- 物件（实例化） ---------------- */
const world = generateObjects();
const colliders = [];          // {x,z,r,kind,obj}
const harvestables = new Map();// index -> {kind, hp, mesh/inst}

const dummy = new THREE.Object3D();

/* 树干 */
const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
trunkGeo.translate(0, 0.5, 0);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1, flatShading: true });
const treeMeshes = [];

/* 叶子：用实例化的低多边形“叶团”，每个树 4 块 */
const leafGeo = new THREE.IcosahedronGeometry(1, 0);
const leafMatCanopy = new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: 0.95, flatShading: true });
const leafMatPalm = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.95, flatShading: true });
const leafInst = new THREE.InstancedMesh(leafGeo, leafMatCanopy, 6000);
leafInst.castShadow = true;
leafInst.receiveShadow = true;

const palmInst = new THREE.InstancedMesh(leafGeo, leafMatPalm, 400);
palmInst.castShadow = true;

let leafCount = 0, palmCount = 0;

function addTree(p, i) {
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(p.x, p.y - 0.2, p.z);
  trunk.scale.set(p.s * 0.42, p.s * 2.0, p.s * 0.42);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.rotation.z = p.lean;
  scene.add(trunk);
  const lut = [];
  // 每棵树用 5~7 个叶团，形状有随机感
  const n = 5 + Math.floor((p.s * 13.37) % 3);
  for (let k = 0; k < n; k++) {
    if (leafCount >= 6000) break;
    const a = (k / n) * Math.PI * 2 + (i % 7);
    const rr = (0.35 + ((i * 31 + k * 17) % 100) / 220) * p.s;
    dummy.position.set(
      p.x + Math.cos(a) * rr * 0.9 + p.lean * 4,
      p.y + p.s * (1.6 + (k % 3) * 0.22),
      p.z + Math.sin(a) * rr * 0.9
    );
    const sc = p.s * (0.85 + ((i + k) % 5) * 0.08);
    dummy.scale.set(sc, sc * 0.85, sc);
    dummy.rotation.set(i + k, a, k * 0.5);
    dummy.updateMatrix();
    leafInst.setMatrixAt(leafCount, dummy.matrix);
    lut.push(leafCount++);
  }
  treeMeshes.push({ trunk, kind: 'tree', hp: 3, maxHp: 3, leaves: lut, x: p.x, z: p.z, y: p.y, r: p.s * 0.5 });
  colliders.push({ x: p.x, z: p.z, r: 0.55 + p.s * 0.16, kind: 'tree', ref: treeMeshes.length - 1 });
}

world.trees.forEach((p, i) => addTree(p, i));

world.palms.forEach((p) => {
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(p.x, p.y - 0.2, p.z);
  trunk.scale.set(p.s * 0.5, p.s * 6.0, p.s * 0.5);
  trunk.rotation.z = p.lean;
  trunk.castShadow = true;
  scene.add(trunk);
  for (let k = 0; k < 7; k++) {
    if (palmCount >= 400) break;
    const a = (k / 7) * Math.PI * 2;
    dummy.position.set(p.x + Math.cos(a) * 1.2 + p.lean * 20, p.y + p.s * 6.0, p.z + Math.sin(a) * 1.2);
    dummy.scale.set(1.9, 0.35, 1.9);
    dummy.rotation.set(0, a, 0);
    dummy.updateMatrix();
    palmInst.setMatrixAt(palmCount++, dummy.matrix);
  }
  colliders.push({ x: p.x, z: p.z, r: 0.6, kind: 'palm' });
});
leafInst.count = leafCount;
palmInst.count = palmCount;
scene.add(leafInst, palmInst);

/* 石头 */
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.9, flatShading: true });
const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, world.rocks.length + 1);
rockInst.castShadow = true;
rockInst.receiveShadow = true;
world.rocks.forEach((p, i) => {
  dummy.position.set(p.x, p.y + p.s * 0.35, p.z);
  dummy.scale.set(p.s, p.s * 0.8, p.s);
  dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
  dummy.updateMatrix();
  rockInst.setMatrixAt(i, dummy.matrix);
  colliders.push({ x: p.x, z: p.z, r: p.s * 0.9, kind: 'rock', ref: i });
});
scene.add(rockInst);

/* 灌木 */
const bushGeo = new THREE.IcosahedronGeometry(1, 0);
const bushMat = new THREE.MeshStandardMaterial({ color: 0x4b6b30, roughness: 1, flatShading: true });
const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, world.bushes.length + 1);
bushInst.castShadow = true;
world.bushes.forEach((p, i) => {
  dummy.position.set(p.x, p.y + p.s * 0.5, p.z);
  dummy.scale.set(p.s, p.s * 0.7, p.s);
  dummy.rotation.set(i, i * 0.9, i * 0.3);
  dummy.updateMatrix();
  bushInst.setMatrixAt(i, dummy.matrix);
});
scene.add(bushInst);

/* 草药（小簇黄花） */
const herbGeo = new THREE.ConeGeometry(0.35, 0.8, 5);
const herbMat = new THREE.MeshStandardMaterial({ color: 0xa8d24a, roughness: 0.8, emissive: 0x2b3a10, emissiveIntensity: 0.4 });
const herbInst = new THREE.InstancedMesh(herbGeo, herbMat, world.herbs.length + 1);
world.herbs.forEach((p, i) => {
  dummy.position.set(p.x, p.y + 0.4, p.z);
  dummy.scale.set(p.s, p.s, p.s);
  dummy.rotation.set(0, i, 0);
  dummy.updateMatrix();
  herbInst.setMatrixAt(i, dummy.matrix);
});
scene.add(herbInst);

/* 树桩装饰 */
const stumpGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.5, 6);
const stumpMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 });
const stumpInst = new THREE.InstancedMesh(stumpGeo, stumpMat, world.stumps.length + 1);
world.stumps.forEach((p, i) => {
  dummy.position.set(p.x, p.y + 0.2, p.z);
  dummy.scale.set(p.s * 3, p.s * 3, p.s * 3);
  dummy.updateMatrix();
  stumpInst.setMatrixAt(i, dummy.matrix);
});
scene.add(stumpInst);

/* ---------------- 玩家 ---------------- */
const player = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0,
  group: new THREE.Group(),
  legL: null, legR: null, armL: null, armR: null,
  walkPhase: 0,
  stamina: 1,
  energy: 0.85, hunger: 0.9, thirst: 0.78, warmth: 0.75,
  hasWood: false, hasSpear: false,
  alive: true,
  dehydrating: false
};
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc99b6e, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26313d, roughness: 0.9 });
  // 躯干
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 8), bodyMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  player.group.add(torso);
  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  player.group.add(head);
  // 背包
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.28), new THREE.MeshStandardMaterial({ color: 0x7a4f28, roughness: 1 }));
  pack.position.set(0, 1.18, -0.34);
  pack.castShadow = true;
  player.group.add(pack);
  // 腿
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.5, 3, 6);
  player.legL = new THREE.Mesh(legGeo, pantsMat);
  player.legR = new THREE.Mesh(legGeo, pantsMat);
  player.legL.position.set(-0.15, 0.42, 0);
  player.legR.position.set(0.15, 0.42, 0);
  player.legL.castShadow = player.legR.castShadow = true;
  player.group.add(player.legL, player.legR);
  // 手臂
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.46, 3, 6);
  player.armL = new THREE.Mesh(armGeo, skinMat);
  player.armR = new THREE.Mesh(armGeo, skinMat);
  player.armL.position.set(-0.42, 1.18, 0);
  player.armR.position.set(0.42, 1.18, 0);
  player.armL.castShadow = player.armR.castShadow = true;
  player.group.add(player.armL, player.armR);
  // 手里的火把（默认隐藏）
  const torch = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x5a4028 }));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  flame.position.y = 0.42;
  torch.add(stick, flame);
  torch.position.set(0.42, 1.3, 0.1);
  torch.rotation.z = -0.3;
  torch.visible = false;
  player.torch = torch;
  player.flame = flame;
  player.group.add(torch);

  const sp = spawnPoint();
  player.pos.set(sp.x, sp.y, sp.z);
  player.group.position.copy(player.pos);
  scene.add(player.group);
}

/* 挥手采集动画用的状态 */
const anim = { swing: 0 };

/* ---------------- 野兽 ---------------- */
const animals = [];
{
  const list = generateAnimals();
  list.forEach((a) => {
    const g = new THREE.Group();
    const danger = !a.docile;
    const col = danger ? 0x5b3b26 : (a.kind === 'rabbit' ? 0xbfa98c : 0x9a6f45);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34 * a.s, 0.7 * a.s, 4, 7), mat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.55 * a.s;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * a.s, 8, 7), mat);
    head.position.set(0.55 * a.s, 0.72 * a.s, 0);
    head.castShadow = true;
    g.add(head);
    if (danger) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), mat);
      ear.position.set(0.62 * a.s, 0.98 * a.s, 0.14 * a.s);
      const ear2 = ear.clone();
      ear2.position.z = -0.14 * a.s;
      g.add(ear, ear2);
    }
    g.position.set(a.x, a.y, a.z);
    scene.add(g);
    animals.push({
      kind: a.kind, docile: a.docile, group: g, body,
      pos: new THREE.Vector3(a.x, a.y, a.z),
      home: new THREE.Vector3(a.x, a.y, a.z),
      dir: a.dir, speed: a.speed, state: 'idle', timer: Math.random() * 3,
      alive: true, react: 0
    });
  });
}

/* ---------------- 采集特效 ---------------- */
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
function spawnParticles(pos, color, n) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(particleGeo, mat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m,
      v: new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 4),
      life: 0.9
    });
  }
}

/* 砍击的木头飞屑 */
function hitFx(x, y, z, kind) {
  spawnParticles(new THREE.Vector3(x, y + 1.2, z), kind === 'rock' ? 0x9b968b : 0x8a6a3a, 7);
}

/* 树叶抖动的记录 */
const shake = [];

/* ---------------- 营火 ---------------- */
const camp = { built: false, lit: false, group: null, light: null, fire: null, pos: new THREE.Vector3() };
function buildCampfire(x, z) {
  if (camp.built) return;
  const y = groundAt(x, z);
  const g = new THREE.Group();
  // 石圈
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(rockGeo, rockMat);
    s.position.set(Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1);
    s.scale.set(0.34, 0.28, 0.34);
    s.rotation.set(i, i, 0);
    s.castShadow = true;
    g.add(s);
  }
  // 柴
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 5), trunkMat);
    log.position.y = 0.16;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    g.add(log);
  }
  // 火苗
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.15, 7),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.95 })
  );
  flame.position.y = 0.78;
  flame.visible = false;
  g.add(flame);
  const flame2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.7, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe08a })
  );
  flame2.position.y = 0.62;
  flame2.visible = false;
  g.add(flame2);

  const light = new THREE.PointLight(0xff9a3c, 0, 26, 2);
  light.position.y = 1.4;
  g.add(light);

  g.position.set(x, y, z);
  scene.add(g);
  camp.built = true;
  camp.group = g;
  camp.fire = flame;
  camp.fire2 = flame2;
  camp.light = light;
  camp.pos.set(x, y, z);
  colliders.push({ x, z, r: 1.25, kind: 'camp' });
}

/* ---------------- 火把光 ---------------- */
const torchLight = new THREE.PointLight(0xffa54a, 0, 16, 2);
scene.add(torchLight);

/* ---------------- 输入 ---------------- */
const input = { x: 0, y: 0, sprint: false, action: false };
let camYawOffset = 0;          // 手指拖动带来的镜头偏移
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyE' || e.code === 'KeyF') { input.action = true; doAction(); input.action = false; }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

/* 手指在画布右半边拖动 = 转动镜头（左半边留给摇杆区域） */
let lookId = null, lookX = 0;
const canvasEl = document.getElementById('gl');
canvasEl.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  if (t.clientX < window.innerWidth * 0.38) return;
  lookId = t.identifier; lookX = t.clientX;
}, { passive: true });
canvasEl.addEventListener('touchmove', (e) => {
  if (lookId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== lookId) continue;
    const dx = t.clientX - lookX;
    lookX = t.clientX;
    camYawOffset -= dx * 0.006;
  }
}, { passive: true });
canvasEl.addEventListener('touchend', () => { lookId = null; });
canvasEl.addEventListener('touchcancel', () => { lookId = null; });

/* 虚拟摇杆 */
const stickWrap = $('stick');
const stickKnob = $('knob');
let stickId = null, stickOrigin = { x: 0, y: 0 };
const STICK_R = 46;
function stickStart(e) {
  const t = e.changedTouches ? e.changedTouches[0] : e;
  stickId = t.identifier === undefined ? 'mouse' : t.identifier;
  const rect = stickWrap.getBoundingClientRect();
  // 允许手指落在摇杆区域附近
  stickOrigin.x = rect.left + rect.width / 2;
  stickOrigin.y = rect.top + rect.height / 2;
  stickMove(e);
}
function stickMove(e) {
  if (stickId === null) return;
  const list = e.touches ? e.touches : [e];
  let t = null;
  for (let i = 0; i < list.length; i++) {
    const id = list[i].identifier === undefined ? 'mouse' : list[i].identifier;
    if (id === stickId) t = list[i];
  }
  if (!t) return;
  let dx = t.clientX - stickOrigin.x;
  let dy = t.clientY - stickOrigin.y;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.x = dx / STICK_R;
  input.y = -dy / STICK_R;
  const mag = Math.hypot(input.x, input.y);
  input.sprint = mag > 0.88;
  if (e.preventDefault) e.preventDefault();
}
function stickEnd(e) {
  if (stickId === null) return;
  stickId = null;
  stickKnob.style.transform = 'translate(0px, 0px)';
  input.x = 0; input.y = 0; input.sprint = false;
}
stickWrap.addEventListener('touchstart', stickStart, { passive: false });
stickWrap.addEventListener('touchmove', stickMove, { passive: false });
stickWrap.addEventListener('touchend', stickEnd);
stickWrap.addEventListener('touchcancel', stickEnd);
stickWrap.addEventListener('mousedown', (e) => { stickStart(e); });
window.addEventListener('mousemove', (e) => { if (stickId !== null) stickMove(e); });
window.addEventListener('mouseup', stickEnd);

/* 动作按钮 */
const btnAction = $('btnAction');
function doAction() {
  if (!player.alive) return;
  // 1) 优先交互最近的可采集物
  const near = findNearest();
  if (near) {
    if (near.kind === 'tree' || near.kind === 'palm') {
      chopTree(near);
      return;
    }
    if (near.kind === 'rock') {
      mineRock(near);
      return;
    }
  }
  // 2) 手机端若有营火木材，靠近空地可放营火（只有收集过木材才可用）
  if (player.hasWood && !camp.built) {
    const fx = player.pos.x + Math.sin(player.yaw) * 2.0;
    const fz = player.pos.z + Math.cos(player.yaw) * 2.0;
    if (groundAt(fx, fz) > 0.5 && nearestCollider(fx, fz, 1.6) === null) {
      buildCampfire(fx, fz);
      player.hasWood = false;
      camp.lit = true;
      setCmd('camp', true);
    }
  }
}
btnAction.addEventListener('touchstart', (e) => { e.preventDefault(); doAction(); }, { passive: false });
btnAction.addEventListener('click', (e) => { e.preventDefault(); doAction(); });

/* ---------------- 采集逻辑 ---------------- */
function nearestCollider(x, z, r) {
  let best = null, bd = r * r;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.kind !== 'tree' && c.kind !== 'rock' && c.kind !== 'camp' && c.kind !== 'palm') continue;
    const dx = c.x - x, dz = c.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}

function findNearest() {
  const px = player.pos.x, pz = player.pos.z;
  let best = null, bestD = W.INTERACT_R * W.INTERACT_R;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const dx = c.x - px, dz = c.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) { bestD = d2; best = c; }
  }
  return best;
}

function chopTree(c) {
  if (!c || c.dead) return;
  const t = treeMeshes[c.ref];
  if (!t || t.falling !== undefined) return;
  anim.swing = 0.35;
  hitFx(c.x, c.y, c.z, 'tree');
  shake.push({ t, time: 0.35 });
  t.hp -= 1;
  if (t.hp <= 0) {
    // 倒下
    t.falling = 0;
    player.hasWood = true;
    setCmd('wood', true);
    spawnParticles(new THREE.Vector3(c.x, c.y + 2.2, c.z), 0x6f8f45, 10);
  } else {
    if (navigator.vibrate) navigator.vibrate(12);
  }
}

function mineRock(c) {
  anim.swing = 0.35;
  hitFx(c.x, c.y, c.z, 'rock');
  if (player.hasSpear) return;             // 有工具可以更快，这里保持简单
  c.ref = c.ref;
  // 石头慢慢变小直到消失
  const idx = c.ref;
  const p = world.rocks[idx];
  p.hp = (p.hp || 3) - 1;
  if (p.hp <= 0) {
    c.dead = true;
    dummy.position.set(c.x, -999, c.z);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    rockInst.instanceMatrix.needsUpdate = true;
    player.hasSpear = true;
    setCmd('stone', true);
    spawnParticles(new THREE.Vector3(c.x, c.y + 1, c.z), 0xa9a59a, 10);
  } else {
    // 缩小一点
    dummy.position.set(c.x, p.y + p.s * 0.35 * (p.hp / 3), c.z);
    const sc = p.s * (0.55 + 0.45 * (p.hp / 3));
    dummy.scale.set(sc, sc * 0.8, sc);
    dummy.rotation.set(idx * 0.7, idx * 1.3, idx * 0.4);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    rockInst.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 玩家移动与碰撞 ---------------- */
function collideMove(nx, nz) {
  const r = W.PLAYER_R;
  let x = nx, z = nz;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.dead) continue;
    const dx = x - c.x, dz = z - c.z;
    const rr = c.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = c.x + dx / d * rr;
      z = c.z + dz / d * rr;
    }
  }
  // 不能走进深水
  if (groundAt(x, z) < W.WATER_LEVEL + 0.25) {
    x = player.pos.x;
    z = player.pos.z;
  }
  return { x, z };
}

/* ---------------- HUD 命令（给覆盖层脚本用） ---------------- */
const pendingCmds = [];
function setCmd(k, v) { pendingCmds.push([k, v]); }
function setStatSingle(key, v) { pendingCmds.push([key, v]); }

/* ---------------- 昼夜 ---------------- */
const day = { time: 0.18, dayNo: 1 };
const sunDir = new THREE.Vector3();
function updateSky(dt) {
  day.time += dt / W.DAY_LENGTH;
  if (day.time >= 1) { day.time -= 1; day.dayNo++; }

  const t = day.time;
  const isNight = t > W.NIGHT_START || t < 0.26;
  // 太阳方位：东（+X）升起，西（-X）落下；用单位方向，位置由跟随玩家的偏移决定
  const dayPhase = (t - 0.06) / 0.70;
  const sunAngle = Math.PI * clamp(dayPhase, 0, 1);
  const sunH = Math.max(0.08, Math.sin(sunAngle));
  sunDir.set(Math.cos(sunAngle), sunH, 0.42).normalize();
  sun.intensity = clamp(Math.sin(Math.PI * clamp(dayPhase, 0, 1)) * 2.8, 0.04, 2.8);

  const top = new THREE.Color(0x4a8fd8);
  const bottom = new THREE.Color(0xd8e8f0);
  const nightTop = new THREE.Color(0x060b1c);
  const nightBottom = new THREE.Color(0x101a2e);
  const dusk = new THREE.Color(0xff8f5a);

  let night = 0;
  if (t > W.NIGHT_START) night = clamp((t - W.NIGHT_START) / (1 - W.NIGHT_START), 0, 1);
  else if (t < 0.26) night = 1 - clamp(t / 0.26, 0, 1);
  const glow = clamp(1 - Math.abs(t - 0.74) * 8, 0, 1) + clamp(1 - Math.abs(t - 0.22) * 8, 0, 1);

  skyMat.uniforms.topColor.value.copy(top).lerp(nightTop, night);
  skyMat.uniforms.bottomColor.value.copy(bottom).lerp(nightBottom, night).lerp(dusk, Math.min(0.6, glow) * (1 - night * 0.7));
  hemi.intensity = 0.55 * (1 - night) + 0.09;
  hemi.color.setHSL(0.58, 0.55, 0.65 + night * 0.1);
  sun.color.setHSL(0.09 - Math.min(0.06, glow * 0.06), 0.7, 0.62);
  moon.intensity = night * 0.35;
  starMat.opacity = night;
  waterMat.color.setRGB(0.18 + 0.0 * night, 0.44 * (1 - night * 0.6), 0.56 * (1 - night * 0.5));
  scene.fog.color.copy(skyMat.uniforms.bottomColor.value);
  scene.fog.near = isNight ? 24 : 70;
  scene.fog.far = isNight ? 95 : 210;
  renderer.toneMappingExposure = 1.05 - night * 0.35;

  return { night, t };
}

/* ---------------- 第三人称镜头 ---------------- */
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
camera.position.set(0, 8, 12);

function updateCamera(dt, night) {
  const targetY = player.pos.y + 2.1;
  camTarget.lerp(new THREE.Vector3(player.pos.x, targetY, player.pos.z), Math.min(1, dt * 6));
  // 镜头从角色背后右上侧观察；camYawOffset 让玩家用指尖拖动视角
  const yaw = player.yaw + camYawOffset;
  // 横屏视野宽，镜头拉远拉高一些；竖屏收紧，保证角色够大
  const wide = camWide;
  const back = wide ? 9.4 : 7.4;
  const up = wide ? 5.0 : 5.4;
  const side = wide ? 1.1 : 1.6;
  const wanted = new THREE.Vector3(
    camTarget.x - Math.sin(yaw) * back + Math.cos(yaw) * side,
    camTarget.y + up,
    camTarget.z - Math.cos(yaw) * back - Math.sin(yaw) * side
  );
  // 不要钻进地下
  const gh = groundAt(wanted.x, wanted.z) + 1.6;
  if (wanted.y < gh) wanted.y = gh;
  camPos.lerp(wanted, Math.min(1, dt * 4.5));
  camera.position.copy(camPos);
  camera.lookAt(camTarget.x, camTarget.y + 0.4, camTarget.z);

  // 跟随阴影相机：太阳光以玩家为中心、沿固定方向照射
  sun.target.position.set(player.pos.x, player.pos.y, player.pos.z);
  sun.position.set(
    player.pos.x + sunDir.x * 95,
    player.pos.y + sunDir.y * 95,
    player.pos.z + sunDir.z * 95
  );
}

/* ---------------- 主循环 ---------------- */
const tmpV = new THREE.Vector3();
let lastInteract = null;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  renderer.render(scene, camera);
  if (paused) return;

  const skyState = updateSky(dt);

  /* --- 输入合成 --- */
  let ix = input.x, iy = input.y;
  if (keys['KeyW'] || keys['ArrowUp']) iy = 1;
  if (keys['KeyS'] || keys['ArrowDown']) iy = -1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix = -1;
  if (keys['KeyD'] || keys['ArrowRight']) ix = 1;
  const sprintKey = keys['ShiftLeft'] || keys['ShiftRight'];
  const mag = Math.min(1, Math.hypot(ix, iy));

  /* --- 体力 --- */
  const sprinting = (input.sprint || sprintKey) && mag > 0.3 && player.stamina > 0.02 && player.thirst > 0.05;
  player.stamina = clamp(player.stamina + (sprinting ? -dt * 0.22 : dt * 0.16), 0, 1);

  /* --- 移动 --- */
  if (player.alive) {
    const speed = W.PLAYER_SPEED * (sprinting ? W.SPRINT : 1) * (0.55 + 0.45 * Math.min(1, player.stamina * 3));
    if (mag > 0.05) {
      // 相机朝向的相对方向（相机 yaw = 角色 yaw + 偏移）
      const camYaw = player.yaw + camYawOffset;
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = (fx * iy + rx * ix);
      const dz = (fz * iy + rz * ix);
      const dl = Math.hypot(dx, dz) || 1;
      const nx = dx / dl * speed * dt * mag;
      const nz = dz / dl * speed * dt * mag;
      const res = collideMove(player.pos.x + nx, player.pos.z + nz);
      player.pos.x = res.x;
      player.pos.z = res.z;
      // 转身朝向移动方向
      const wantYaw = Math.atan2(dx, dz);
      let dy = ((wantYaw - player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      player.yaw += dy * Math.min(1, dt * 12);
      player.walkPhase += dt * (sprinting ? 15 : 10) * mag;
    } else {
      player.walkPhase += (0 - (player.walkPhase % (Math.PI * 2))) * 0;
    }
    player.pos.y = groundAt(player.pos.x, player.pos.z);
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.yaw;

    // 手脚摆动
    const sw = Math.sin(player.walkPhase) * 0.6 * (mag > 0.05 ? 1 : 0);
    player.legL.rotation.x = sw;
    player.legR.rotation.x = -sw;
    player.armL.rotation.x = -sw * 0.8;
    player.armR.rotation.x = sw * 0.8;
    if (anim.swing > 0) {
      anim.swing = Math.max(0, anim.swing - dt);
      player.armR.rotation.x = -Math.sin((1 - anim.swing / 0.35) * Math.PI) * 1.8;
    }
  }

  /* --- 镜头慢慢回到角色背后（拖拽视角后自动回正） --- */
  camYawOffset *= Math.exp(-dt * 1.2);

  /* --- 树倒下 --- */
  for (let i = shake.length - 1; i >= 0; i--) {
    shake[i].time -= dt;
    if (shake[i].time <= 0) shake.splice(i, 1);
  }
  treeMeshes.forEach((t, ti) => {
    if (shake.length) {
      const s = shake.find((x) => x.t === t);
      if (s) {
        const k = Math.sin(s.time * 60) * 0.06;
        t.trunk.rotation.z = t.lean + k;
      }
    }
    if (t.falling !== undefined) {
      t.falling = Math.min(1, t.falling + dt * 1.4);
      const a = t.falling * t.falling * Math.PI * 0.5;
      t.trunk.rotation.z = a;
      t.trunk.position.y = t.y - 0.2 - t.falling * 0.3;
      t.leaves.forEach((idx) => {
        dummy.position.set(t.x + Math.sin(a) * 3, t.y + t.s * 1.6 - t.falling * 4, t.z);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        leafInst.setMatrixAt(idx, dummy.matrix);
      });
      leafInst.instanceMatrix.needsUpdate = true;
      if (t.falling >= 1 && !t.gone) {
        t.gone = true;
        for (let c = 0; c < colliders.length; c++) {
          if (colliders[c].kind === 'tree' && colliders[c].ref === ti) colliders[c].dead = true;
        }
      }
    }
  });

  /* --- 野兽行为 --- */
  const night = skyState.night;
  animals.forEach((a) => {
    if (!a.alive) return;
    const dx = player.pos.x - a.pos.x;
    const dz = player.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    // 夜里掠食者更凶
    const aggroR = a.docile ? 0 : (night > 0.4 ? 26 : 11);
    const fleeR = a.docile ? 9 : 0;
    if (a.docile && dist < fleeR) {
      a.state = 'flee';
      a.dir = Math.atan2(-dx, -dz);
    } else if (!a.docile && dist < aggroR) {
      a.state = 'hunt';
      a.dir = Math.atan2(dx, dz);
    } else if (dist > 34 && a.state === 'hunt') {
      a.state = 'idle';
    }
    if (a.state === 'idle') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 1.4 + Math.random() * 3;
        a.dir = Math.random() * Math.PI * 2;
        a.move = Math.random() < 0.7;
      }
      if (a.move) {
        const nx = a.pos.x + Math.sin(a.dir) * a.speed * 0.4 * dt;
        const nz = a.pos.z + Math.cos(a.dir) * a.speed * 0.4 * dt;
        if (groundAt(nx, nz) > 0.6) { a.pos.x = nx; a.pos.z = nz; }
      }
    } else if (a.state === 'flee') {
      const nx = a.pos.x + Math.sin(a.dir) * a.speed * 2.6 * dt;
      const nz = a.pos.z + Math.cos(a.dir) * a.speed * 2.6 * dt;
      if (groundAt(nx, nz) > 0.6) { a.pos.x = nx; a.pos.z = nz; }
    } else if (a.state === 'hunt') {
      const nx = a.pos.x + Math.sin(a.dir) * a.speed * 1.9 * dt;
      const nz = a.pos.z + Math.cos(a.dir) * a.speed * 1.9 * dt;
      if (groundAt(nx, nz) > 0.6) { a.pos.x = nx; a.pos.z = nz; }
      a.react = Math.max(0, a.react - dt);
      if (dist < 1.6 && a.react <= 0 && player.alive) {
        // 扑咬
        a.react = 1.2;
        player.energy = clamp(player.energy - 0.11, 0, 1);
        setStatSingle('energy', player.energy);
        setCmd('hit', true);
        if (player.energy <= 0) die();
      }
    }
    a.pos.y = groundAt(a.pos.x, a.pos.z);
    a.group.position.copy(a.pos);
    a.group.rotation.y = a.dir;
    // 跑动时身体起伏
    if (a.state !== 'idle') a.group.position.y += Math.abs(Math.sin(performance.now() * 0.012)) * 0.12;
  });

  /* --- 生存数值：口渴每分钟下降，饥饿在走动时消耗 --- */
  const moving = mag > 0.05;
  player.thirst = clamp(player.thirst - dt / 300, 0, 1);
  player.hunger = clamp(player.hunger - dt * (moving ? 0.0016 : 0.0006), 0, 1);
  const canRecover = player.hunger > 0.15 && player.thirst > 0.12;
  player.energy = clamp(player.energy + dt * (canRecover ? 0.0035 : -0.004), 0, 1);
  if (player.thirst <= 0.02 && !player.dehydrating) {
    player.dehydrating = true;
    setCmd('thirst', true);
  }
  if (player.energy <= 0 && player.alive) die();
  setStatSingle('energy', player.energy);
  setStatSingle('stamina', player.stamina);
  setStatSingle('thirst', player.thirst);
  setStatSingle('hunger', player.hunger);
  frameOut.energy = player.energy;
  frameOut.stamina = player.stamina;
  frameOut.thirst = player.thirst;
  frameOut.hunger = player.hunger;

  /* --- 营火 --- */
  if (camp.built) {
    const flick = 0.85 + Math.sin(performance.now() * 0.017) * 0.12 + Math.sin(performance.now() * 0.031) * 0.06;
    if (camp.lit) {
      camp.light.intensity = 22 * flick;
      camp.fire.visible = true;
      camp.fire2.visible = true;
      camp.fire.scale.set(flick, 0.9 + flick * 0.2, flick);
      camp.fire.rotation.y += dt * 0.6;
    } else {
      camp.light.intensity = 0;
    }
  }
  // 火把光
  if (player.hasWood && night > 0.2) {
    torchLight.position.set(
      player.pos.x + Math.sin(player.yaw + 0.5) * 0.6,
      player.pos.y + 1.6,
      player.pos.z + Math.cos(player.yaw + 0.5) * 0.6
    );
    torchLight.intensity = 9 * (0.9 + Math.sin(performance.now() * 0.02) * 0.1);
  } else {
    torchLight.intensity = 0;
  }

  /* --- 粒子 --- */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.v.y -= 9.8 * dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.life -= dt;
    p.mesh.scale.setScalar(Math.max(0.001, p.life));
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry = particleGeo; particles.splice(i, 1); }
  }

  /* --- 镜头 & 百分比时长 --- */
  updateCamera(dt, night);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  /* --- 交互提示 --- */
  const near = findNearest();
  if (near !== lastInteract) {
    lastInteract = near;
    setCmd('near', near ? (near.kind === 'rock' ? 'rock' : near.kind === 'camp' ? 'camp' : 'tree') : null);
  }

  /* --- 结算给覆盖层 --- */
  frameOut.night = night;
  frameOut.time = day.time;
  frameOut.dayNo = day.dayNo;
  frameOut.alive = player.alive;
  if (pendingCmds.length) {
    frameOut.cmds = frameOut.cmds.concat(pendingCmds);
    pendingCmds.length = 0;
  }
  if (window.HUDBridge) window.HUDBridge(frameOut);
  frameOut.cmds = [];
}

/* 每帧输出给 overlay.js 的桥接对象 */
const frameOut = { night: 0, time: 0, dayNo: 1, alive: true, cmds: [] };
window.__frame = frameOut;

function die() {
  player.alive = false;
  setCmd('dead', true);
}

let paused = false;
window.__pause = (v) => { paused = !!v; };
window.__resume = () => { paused = false; clock.getDelta(); };

/* 视口变化（含手机旋转：转屏后立即重排） */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  // 横屏视野宽：稍微收窄 FOV，避免角色显太小
  camWide = w > h;
  camera.fov = camWide ? 56 : 58;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, camWide ? 2 : 2));
  renderer.setSize(w, h, false);
  // 横竖屏切换时让镜头立刻贴合，别从很远的地方滑过来
  if (player && player.pos) {
    player.group.position.copy(player.pos);
  }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

/* 启动 */
setCmd('ready', true);
tick();