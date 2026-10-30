/* 荒野余生 3D · 世界参数与工具函数（纯逻辑，可被 Node 测试） */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorldData = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = {
    SIZE: 288,               // 地图边长（世界单位）
    HALF: 144,
    SEG: 144,                // 地形网格分段
    WATER_LEVEL: 0,
    SEED: 20261030,
    DAY_LENGTH: 240,         // 一天的真实秒数（4 分钟）
    NIGHT_START: 0.72,       // 一天的多少比例后天黑
    PLAYER_SPEED: 5.6,
    SPRINT: 1.75,
    PLAYER_R: 0.45,
    INTERACT_R: 3.0,
    REACH: 2.6               // 砍树时距离
  };

  /* ---------- 随机数 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 噪声 ---------- */
  function hash2(ix, iy, seed) {
    let h = ix * 374761393 + iy * 668265263 + seed * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    const u = smooth(fx), v = smooth(fy);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, y, seed, octaves) {
    let v = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < (octaves || 4); i++) {
      v += noise2(x * freq, y * freq, seed + i * 31) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return v / norm;
  }

  /* ---------- 地形高度 ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function heightAt(x, z) {
    const s = W.SEED;
    const nx = (x + W.HALF) / W.SIZE, nz = (z + W.HALF) / W.SIZE;   // 0..1
    // 岛屿轮廓：边缘下沉到水下（地图边界是海）
    const d = Math.sqrt((nx - 0.5) * (nx - 0.5) + (nz - 0.5) * (nz - 0.5)) * 2;
    const coast = 1 - smooth(clamp((d - 0.62) / 0.36, 0, 1));
    // 低频地形：几块缓丘
    const base = fbm(nx * 2.6, nz * 2.6, s, 4) * 24 - 7;
    // 山脉：只在地图的一侧崛起
    const ridgeN = fbm(nx * 1.8 + 5.3, nz * 1.8 + 9.1, s + 17, 3);
    const ridge = Math.pow(clamp((ridgeN - 0.42) / 0.5, 0, 1), 1.5) * 40;
    const mountainMask = clamp((0.5 - Math.hypot(nx - 0.32, nz - 0.38)) * 3.2, 0, 1);
    let h = base * (0.25 + coast * 0.75) + ridge * mountainMask;
    // 海岸压低成缓坡沙滩
    const beach = 1 - smooth(clamp((Math.abs(h) - 0.4) / 1.8, 0, 1));
    h = h * (1 - beach * 0.55);
    // 外圈强制入海
    h -= (1 - coast) * 22;
    return h;
  }

  /* ---------- 植被与资源分布 ---------- */
  function forestDensity(x, z) {
    const s = W.SEED + 99;
    const n = fbm((x + W.HALF) / 70, (z + W.HALF) / 70, s, 3);
    return clamp((n - 0.40) * 3.4, 0, 1);
  }

  function biomeAt(x, z) {
    const h = heightAt(x, z);
    if (h < -0.6) return 'water';
    if (h < 0.9) return 'beach';
    if (h > 17) return 'rock';
    return 'grass';
  }

  /* 树上单片叶子的取舍 */
  function leafPlane(rng, out, cx, cy, cz, r, count) {
    for (let i = 0; i < count; i++) {
      out.push({
        x: cx + (rng() - 0.5) * r * 1.6,
        y: cy + (rng() - 0.5) * r * 0.9,
        z: cz + (rng() - 0.5) * r * 1.6,
        s: 1.5 + rng() * 1.6
      });
    }
  }

  /* 生成世界里的所有物件（返回纯数据，渲染在 scene 里消费） */
  function generateObjects() {
    const trees = [], rocks = [], bushes = [], herbs = [], palms = [], stumps = [];
    const rng = mulberry32(W.SEED);
    const step = 5.2;
    for (let gz = -W.HALF + step; gz < W.HALF - step; gz += step) {
      for (let gx = -W.HALF + step; gx < W.HALF - step; gx += step) {
        const jx = gx + (rng() - 0.5) * step * 0.9;
        const jz = gz + (rng() - 0.5) * step * 0.9;
        const h = heightAt(jx, jz);
        if (h < 0.9) continue;
        const dens = forestDensity(jx, jz);
        const r = rng();
        const nearEdge = Math.max(Math.abs(jx), Math.abs(jz)) / W.HALF;
        if (nearEdge > 0.88) continue;
        if (h > 17) {
          if (r < 0.16) rocks.push({ x: jx, z: jz, y: h, s: 1.1 + rng() * 1.8, type: 'rock' });
          continue;
        }
        if (r < 0.05 + dens * 0.80) {
          // 树
          const p = { x: jx, z: jz, y: h, s: 2.2 + rng() * 2.0, lean: (rng() - 0.5) * 0.08, type: 'tree', leaves: [] };
          leafPlane(rng, p.leaves, jx, h + p.s * 1.55, jz, p.s * 1.05, 10 + Math.floor(rng() * 8));
          trees.push(p);
        } else if (r < 0.14) {
          rocks.push({ x: jx, z: jz, y: h, s: 0.9 + rng() * 2.4, type: 'rock' });
          stumps.push({ x: jx + 1.1, z: jz + 0.7, y: heightAt(jx + 1.1, jz + 0.7), s: 0.25 + rng() * 0.15 });
        } else if (r < 0.30) {
          bushes.push({ x: jx, z: jz, y: h, s: 1.0 + rng() * 0.9 });
        } else if (r < 0.38) {
          herbs.push({ x: jx, z: jz, y: h, s: 0.7 + rng() * 0.4 });
        }
      }
    }
    // 海岸椰子树
    for (let i = 0; i < 400; i++) {
      const x = (rng() - 0.5) * W.SIZE * 0.92;
      const z = (rng() - 0.5) * W.SIZE * 0.92;
      const h = heightAt(x, z);
      if (h > -0.4 && h < 1.6 && rng() < 0.5) {
        const p = { x, z, y: h, s: 1.2 + rng() * 0.8, lean: 0.05 + rng() * 0.12, type: 'palm', leaves: [] };
        leafPlane(rng, p.leaves, x, h + 4.2, z, 2.3, 9);
        palms.push(p);
      }
    }
    return { trees, rocks, bushes, herbs, palms, stumps };
  }

  /* 动物出生点 */
  function generateAnimals() {
    const rng = mulberry32(W.SEED + 7);
    const list = [];
    let tries = 0;
    while (list.length < 26 && tries++ < 3000) {
      const x = (rng() - 0.5) * W.SIZE * 0.8;
      const z = (rng() - 0.5) * W.SIZE * 0.8;
      const h = heightAt(x, z);
      if (h < 1 || h > 15) continue;
      const docile = rng() < 0.72;
      list.push({
        x, z, y: h,
        kind: docile ? (rng() < 0.5 ? 'deer' : 'rabbit') : (rng() < 0.5 ? 'boar' : 'wolf'),
        docile,
        s: docile ? 1 : 1.1,
        dir: rng() * Math.PI * 2,
        speed: docile ? (1.1 + rng() * 0.7) : (1.6 + rng() * 0.8)
      });
    }
    return list;
  }

  /* 玩家出生点：靠海的一块平地 */
  function spawnPoint() {
    const rng = mulberry32(W.SEED + 3);
    // 从海边往内陆找一块平缓的低地
    for (let i = 0; i < 900; i++) {
      const a = rng() * Math.PI * 2;
      const r = 30 + rng() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 1.6 || h > 7) continue;
      const h2 = heightAt(x + 2, z + 2);
      if (Math.abs(h2 - h) > 1.2) continue;
      return { x, z, y: h };
    }
    // 兜底：找任意一块陆地
    for (let i = 0; i < 4000; i++) {
      const x = (rng() - 0.5) * W.SIZE * 0.7, z = (rng() - 0.5) * W.SIZE * 0.7;
      const h = heightAt(x, z);
      if (h > 1 && h < 8) return { x, z, y: h };
    }
    return { x: 0, z: 0, y: heightAt(0, 0) };
  }

  return {
    W, mulberry32, noise2, fbm, hash2, heightAt, biomeAt, forestDensity,
    generateObjects, generateAnimals, spawnPoint, clamp,
    /* 地形高度采样表：渲染与碰撞共用同一份高度，避免 DS 差异造成的视觉/物理不一致 */
    buildHeightField: function (seg) {
      const n = seg || 220, size = W.SIZE, half = W.HALF;
      const step = size / n;
      const field = new Float32Array((n + 1) * (n + 1));
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const x = -half + i * step, z = -half + j * step;
          field[j * (n + 1) + i] = heightAt(x, z);
        }
      }
      return { n, step, half, field };
    },
    sampleHeight: function (hf, x, z) {
      const fx = (x + hf.half) / hf.step;
      const fz = (z + hf.half) / hf.step;
      let i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0) i = 0; if (j < 0) j = 0;
      if (i > hf.n - 1) i = hf.n - 1;
      if (j > hf.n - 1) j = hf.n - 1;
      const tx = Math.max(0, Math.min(1, fx - i));
      const tz = Math.max(0, Math.min(1, fz - j));
      const w = hf.n + 1;
      const h00 = hf.field[j * w + i], h10 = hf.field[j * w + i + 1];
      const h01 = hf.field[(j + 1) * w + i], h11 = hf.field[(j + 1) * w + i + 1];
      const a = h00 + (h10 - h00) * tx;
      const b = h01 + (h11 - h01) * tx;
      return a + (b - a) * tz;
    }
  };
});