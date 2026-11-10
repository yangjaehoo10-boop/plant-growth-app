'use strict';
/* 블록뜰 — 오리지널 복셀 샌드박스. 의존성 없는 WebGL 구현. */
(() => {
  const CH = 16, H = 64, SEA = 20, PW = CH + 2;
  const SAVE_KEY = 'blockgarden-v1';
  const WATER = 7, GLASS = 10;

  // [이름, 윗면, 옆면, 아랫면, 알파]
  const DEFS = [
    null,
    ['잔디', [104, 178, 92], [146, 112, 84], [146, 112, 84], 255],
    ['흙', [146, 112, 84], [146, 112, 84], [146, 112, 84], 255],
    ['돌', [132, 138, 150], [132, 138, 150], [132, 138, 150], 255],
    ['모래', [232, 214, 160], [232, 214, 160], [232, 214, 160], 255],
    ['나무', [176, 142, 98], [112, 84, 60], [176, 142, 98], 255],
    ['잎', [58, 148, 96], [58, 148, 96], [58, 148, 96], 255],
    ['물', [56, 124, 214], [56, 124, 214], [56, 124, 214], 150],
    ['판자', [206, 164, 104], [206, 164, 104], [206, 164, 104], 255],
    ['벽돌', [184, 92, 78], [184, 92, 78], [184, 92, 78], 255],
    ['유리', [208, 236, 244], [208, 236, 244], [208, 236, 244], 80],
    ['눈', [242, 246, 252], [242, 246, 252], [242, 246, 252], 255],
    ['이끼돌', [104, 140, 120], [104, 140, 120], [104, 140, 120], 255],
  ];
  const HOTBAR = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 7];
  const TR = DEFS.map((d, i) => (i === 0 || i === WATER || i === GLASS ? 1 : 0)); // 투명
  const AOB = DEFS.map((d, i) => (TR[i] ? 0 : 1)); // 그림자를 만드는 블록
  const SOLID = DEFS.map((d, i) => (i !== 0 && i !== WATER ? 1 : 0));

  // ---------- 저장 ----------
  let save = null;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { save = null; }
  let SEED = save && Number.isFinite(save.seed) ? save.seed : (Math.random() * 1e9) | 0;
  const edits = new Map(); // key -> Map(idx -> block)
  if (save && save.edits) {
    for (const k in save.edits) {
      const m = new Map(), a = save.edits[k];
      for (let i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]);
      edits.set(k, m);
    }
  }
  let saveDirty = false;
  function writeSave() {
    saveDirty = false;
    const e = {};
    for (const [k, m] of edits) {
      const a = [];
      for (const [i, b] of m) a.push(i, b);
      e[k] = a;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: SEED, edits: e, sel, time: worldTime, fly,
        p: [player.x, player.y, player.z, player.yaw, player.pitch],
      }));
    } catch (err) { /* 저장 공간이 없으면 조용히 넘어간다 */ }
  }

  // ---------- 지형 ----------
  function hash(x, z, s) {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(s + SEED, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, z, s) {
    const xi = Math.floor(x), zi = Math.floor(z);
    let fx = x - xi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function fbm(x, z, s, oct) {
    let v = 0, amp = 1, tot = 0;
    for (let i = 0; i < oct; i++) { v += vnoise(x, z, s + i * 17) * amp; tot += amp; amp *= 0.5; x *= 2; z *= 2; }
    return v / tot;
  }
  function heightAt(x, z) {
    const c = (fbm(x * 0.006, z * 0.006, 1, 4) - 0.5) * 2.4;
    const d = fbm(x * 0.03, z * 0.03, 7, 3) - 0.5;
    const h = Math.floor(SEA + 3 + c * 30 + d * 10);
    return h < 2 ? 2 : h > 54 ? 54 : h;
  }
  const hasTree = (x, z, h) => h > SEA + 1 && h < 40 && hash(x, z, 99) < 0.014;

  const chunks = new Map();
  const key = (cx, cz) => cx + ',' + cz;
  function genChunk(cx, cz) {
    const data = new Uint8Array(CH * CH * H);
    const ox = cx * CH, oz = cz * CH;
    const hs = new Int16Array(20 * 20);
    for (let z = -2; z < 18; z++) for (let x = -2; x < 18; x++) hs[(z + 2) * 20 + x + 2] = heightAt(ox + x, oz + z);
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const h = hs[(z + 2) * 20 + x + 2];
      for (let y = 0; y <= h; y++) {
        let b = 3;
        if (y > h - 4) {
          if (h <= SEA + 1) b = 4;
          else if (h >= 46) b = y === h ? 11 : 3;
          else if (h >= 40) b = 3;
          else b = y === h ? 1 : 2;
        }
        data[(y * CH + z) * CH + x] = b;
      }
      for (let y = h + 1; y <= SEA; y++) data[(y * CH + z) * CH + x] = WATER;
    }
    const put = (x, y, z, b) => {
      if (x < 0 || x >= CH || z < 0 || z >= CH || y < 0 || y >= H) return;
      const i = (y * CH + z) * CH + x;
      if (b === 5 || data[i] === 0) data[i] = b;
    };
    for (let z = -2; z < 18; z++) for (let x = -2; x < 18; x++) {
      const h = hs[(z + 2) * 20 + x + 2], wx = ox + x, wz = oz + z;
      if (!hasTree(wx, wz, h)) continue;
      const th = 4 + ((hash(wx, wz, 5) * 3) | 0), top = h + th;
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy < 0 ? 2 : 1;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 || hash(wx + dx, wz + dz, top + dy) < 0.6)) continue;
          put(x + dx, top + dy, z + dz, 6);
        }
      }
      for (let y = h + 1; y < top; y++) put(x, y, z, 5);
    }
    const ed = edits.get(key(cx, cz));
    if (ed) for (const [i, b] of ed) data[i] = b;
    return { cx, cz, data, mesh: null };
  }
  let lastC = null;
  function ensureChunk(cx, cz) {
    if (lastC && lastC.cx === cx && lastC.cz === cz) return lastC;
    const k = key(cx, cz);
    let c = chunks.get(k);
    if (!c) { c = genChunk(cx, cz); chunks.set(k, c); }
    return (lastC = c);
  }
  function getBlock(x, y, z) {
    if (y < 0 || y >= H) return 0;
    const c = ensureChunk(x >> 4, z >> 4);
    return c.data[(y * CH + (z & 15)) * CH + (x & 15)];
  }
  function setBlock(x, y, z, b) {
    if (y < 1 || y >= H) return;
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    const c = ensureChunk(cx, cz), i = (y * CH + lz) * CH + lx;
    if (c.data[i] === b) return;
    c.data[i] = b;
    const k = key(cx, cz);
    if (!edits.has(k)) edits.set(k, new Map());
    edits.get(k).set(i, b);
    saveDirty = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx < 0 && lx > 0) || (dx > 0 && lx < 15) || (dz < 0 && lz > 0) || (dz > 0 && lz < 15)) continue;
      const n = chunks.get(key(cx + dx, cz + dz));
      if (n && n.mesh) buildMesh(n);
    }
  }

  // ---------- WebGL ----------
  const canvas = document.getElementById('c');
  const glOpts = { antialias: false, alpha: false, powerPreference: 'high-performance' };
  let gl = canvas.getContext('webgl2', glOpts);
  if (!gl) {
    gl = canvas.getContext('webgl', glOpts);
    if (gl && !gl.getExtension('OES_element_index_uint')) gl = null;
  }
  if (!gl) {
    document.getElementById('msg').textContent = '이 기기는 WebGL을 지원하지 않아 게임을 실행할 수 없습니다.';
    document.getElementById('start').disabled = true;
    return;
  }
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, `
    attribute vec3 aPos; attribute vec4 aCol;
    uniform mat4 uPV; uniform vec3 uOff;
    varying vec4 vCol; varying float vDist;
    void main(){ vec3 p = aPos + uOff; vCol = aCol; vDist = length(p); gl_Position = uPV * vec4(p, 1.0); }`));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec3 uFog; uniform float uLight; uniform vec2 uFogR;
    varying vec4 vCol; varying float vDist;
    void main(){ float f = smoothstep(uFogR.x, uFogR.y, vDist);
      gl_FragColor = vec4(mix(vCol.rgb * uLight, uFog, f), vCol.a); }`));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.bindAttribLocation(prog, 1, 'aCol');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {};
  for (const n of ['uPV', 'uOff', 'uFog', 'uLight', 'uFogR']) U[n] = gl.getUniformLocation(prog, n);
  gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function makeBuf(pos, col, idx) {
    const n = pos.length / 3;
    if (!n) return null;
    const ab = new ArrayBuffer(n * 16), f = new Float32Array(ab), u = new Uint8Array(ab);
    for (let i = 0; i < n; i++) {
      f[i * 4] = pos[i * 3]; f[i * 4 + 1] = pos[i * 3 + 1]; f[i * 4 + 2] = pos[i * 3 + 2];
      u[i * 16 + 12] = col[i * 4]; u[i * 16 + 13] = col[i * 4 + 1]; u[i * 16 + 14] = col[i * 4 + 2]; u[i * 16 + 15] = col[i * 4 + 3];
    }
    const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    return { vb, ib, count: idx.length };
  }
  function freeBuf(b) { if (b) { gl.deleteBuffer(b.vb); gl.deleteBuffer(b.ib); } }
  function drawBuf(b, mode) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 16, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
    gl.drawElements(mode, b.count, gl.UNSIGNED_INT, 0);
  }

  // ---------- 메시 생성 ----------
  // u × v = n 이 되도록 잡아 바깥에서 볼 때 반시계 방향이 된다.
  const FACES = [
    { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], s: 0.8 },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: 0.8 },
    { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], s: 1.0 },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], s: 0.5 },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], s: 0.66 },
    { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], s: 0.66 },
  ];
  const CA = [0, 1, 1, 0], CB = [0, 0, 1, 1], AOF = [0.5, 0.68, 0.84, 1];
  const pad = new Uint8Array(PW * PW * H);
  const pg = (x, y, z) => (y < 0 ? 3 : y >= H ? 0 : pad[(y * PW + z + 1) * PW + x + 1]);
  const aoT = [0, 0, 0, 0];

  function buildMesh(c) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = ensureChunk(c.cx + dx, c.cz + dz).data;
      const x0 = dx < 0 ? 15 : 0, x1 = dx > 0 ? 0 : 15, z0 = dz < 0 ? 15 : 0, z1 = dz > 0 ? 0 : 15;
      for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        pad[(y * PW + z + dz * CH + 1) * PW + x + dx * CH + 1] = n[(y * CH + z) * CH + x];
      }
    }
    const O = { p: [], c: [], i: [] }, T = { p: [], c: [], i: [] };
    const ox = c.cx * CH, oz = c.cz * CH;
    for (let y = 0; y < H; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const b = pad[(y * PW + z + 1) * PW + x + 1];
      if (!b) continue;
      const def = DEFS[b], A = TR[b] ? T : O;
      const jit = 0.93 + hash(ox + x, oz + z, y * 31 + 3) * 0.14;
      const lower = b === WATER && pg(x, y + 1, z) !== WATER;
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi], n = f.n, u = f.u, v = f.v;
        const nx = x + n[0], ny = y + n[1], nz = z + n[2];
        const nb = pg(nx, ny, nz);
        if (!(nb === 0 || (TR[nb] && nb !== b))) continue;
        const col = n[1] > 0 ? def[1] : n[1] < 0 ? def[3] : def[2];
        const sh = f.s * jit, base = A.p.length / 3;
        for (let k = 0; k < 4; k++) {
          const a = CA[k], bb = CB[k], su = a * 2 - 1, sv = bb * 2 - 1;
          const s1 = AOB[pg(nx + su * u[0], ny + su * u[1], nz + su * u[2])];
          const s2 = AOB[pg(nx + sv * v[0], ny + sv * v[1], nz + sv * v[2])];
          const cr = AOB[pg(nx + su * u[0] + sv * v[0], ny + su * u[1] + sv * v[1], nz + su * u[2] + sv * v[2])];
          const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
          aoT[k] = ao;
          let vy = y + (n[1] > 0 ? 1 : 0) + a * u[1] + bb * v[1];
          if (lower && vy === y + 1) vy -= 0.12;
          A.p.push(x + (n[0] > 0 ? 1 : 0) + a * u[0] + bb * v[0], vy, z + (n[2] > 0 ? 1 : 0) + a * u[2] + bb * v[2]);
          const m = sh * AOF[ao];
          A.c.push(Math.min(255, col[0] * m), Math.min(255, col[1] * m), Math.min(255, col[2] * m), def[4]);
        }
        if (aoT[0] + aoT[2] >= aoT[1] + aoT[3]) A.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else A.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      }
    }
    if (c.mesh) { freeBuf(c.mesh.o); freeBuf(c.mesh.t); }
    c.mesh = { o: makeBuf(O.p, O.c, O.i), t: makeBuf(T.p, T.c, T.i) };
  }

  // 선택 블록 테두리
  const outline = (() => {
    const p = [], c = [], i = [], a = -0.004, b = 1.004;
    for (let k = 0; k < 8; k++) { p.push(k & 1 ? b : a, k & 2 ? b : a, k & 4 ? b : a); c.push(20, 20, 24, 255); }
    for (let k = 0; k < 8; k++) for (const bit of [1, 2, 4]) if (!(k & bit)) i.push(k, k | bit);
    return makeBuf(p, c, i);
  })();

  // ---------- 플레이어 ----------
  const HW = 0.3, PH = 1.8, EYE = 1.62;
  const player = { x: 0, y: 40, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.2, ground: false };
  let fly = false, sel = 0, worldTime = 60;
  function spawn() {
    for (let r = 0; r < 400; r += 3) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
        const h = heightAt(x, z);
        if (h <= SEA + 1 || h >= 40) continue;
        let clear = true; // 나무 근처는 피한다
        for (let dz = -3; dz <= 3 && clear; dz++) for (let dx = -3; dx <= 3; dx++) {
          if (hasTree(x + dx, z + dz, heightAt(x + dx, z + dz))) { clear = false; break; }
        }
        if (clear) { player.x = x + 0.5; player.z = z + 0.5; player.y = h + 1.01; return; }
      }
    }
    player.x = 0.5; player.z = 0.5; player.y = 58;
  }
  if (save && save.p && save.p.every(Number.isFinite)) {
    [player.x, player.y, player.z, player.yaw, player.pitch] = save.p;
    sel = save.sel | 0; fly = !!save.fly;
    if (Number.isFinite(save.time)) worldTime = save.time;
  } else spawn();
  if (sel < 0 || sel >= HOTBAR.length) sel = 0;

  function boxHits(x, y, z) {
    const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW), y0 = Math.floor(y), y1 = Math.floor(y + PH);
    const z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
      if (SOLID[getBlock(xx, yy, zz)]) return true;
    }
    return false;
  }
  const input = { mx: 0, mz: 0, jump: false, down: false };
  const keys = {};
  let touchMode = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const E = 1e-3;

  function step(dt) {
    const p = player;
    let mx = input.mx, mz = input.mz;
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const jump = input.jump || keys.Space, down = input.down || keys.ShiftLeft;
    const inWater = getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === WATER;
    const speed = fly ? 11 : inWater ? 2.6 : 4.4;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const wx = (cy * mx + sy * mz) * speed, wz = (-sy * mx + cy * mz) * speed;
    const k = 1 - Math.exp(-(p.ground || fly ? 14 : 5) * dt);
    p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
    if (fly) p.vy += (((jump ? 1 : 0) - (down ? 1 : 0)) * 9 - p.vy) * k;
    else if (inWater) { p.vy = Math.max(p.vy - 8 * dt, -3); if (jump) p.vy = 3.2; }
    else { p.vy = Math.max(p.vy - 28 * dt, -48); if (jump && p.ground) p.vy = 8.7; }

    let blocked = false;
    let d = p.vx * dt;
    if (boxHits(p.x + d, p.y, p.z)) {
      p.x = d > 0 ? Math.floor(p.x + d + HW) - HW - E : Math.floor(p.x + d - HW) + 1 + HW + E;
      p.vx = 0; blocked = true;
    } else p.x += d;
    d = p.vz * dt;
    if (boxHits(p.x, p.y, p.z + d)) {
      p.z = d > 0 ? Math.floor(p.z + d + HW) - HW - E : Math.floor(p.z + d - HW) + 1 + HW + E;
      p.vz = 0; blocked = true;
    } else p.z += d;
    d = p.vy * dt;
    p.ground = false;
    if (boxHits(p.x, p.y + d, p.z)) {
      if (d < 0) { p.y = Math.floor(p.y + d) + 1; p.ground = true; }
      else p.y = Math.floor(p.y + d + PH) - PH - E;
      p.vy = 0;
    } else p.y += d;
    // 터치 조작에서는 한 칸 높이의 턱을 자동으로 넘는다
    if (touchMode && blocked && p.ground && len > 0.3 && !fly) p.vy = 8.7;
    if (p.y < -20) { spawn(); p.vx = p.vy = p.vz = 0; }
  }

  // ---------- 조준 / 블록 조작 ----------
  const cam = { f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], pos: [0, 0, 0], tan: 1, aspect: 1 };
  function rayDir(nx, ny) {
    const d = [0, 0, 0];
    for (let i = 0; i < 3; i++) d[i] = cam.f[i] + cam.r[i] * nx * cam.tan * cam.aspect + cam.u[i] * ny * cam.tan;
    const l = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / l, d[1] / l, d[2] / l];
  }
  function raycast(o, d, max) {
    const c = [Math.floor(o[0]), Math.floor(o[1]), Math.floor(o[2])], pr = c.slice();
    const st = [0, 0, 0], td = [0, 0, 0], tm = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      st[i] = d[i] > 0 ? 1 : -1;
      td[i] = d[i] === 0 ? Infinity : Math.abs(1 / d[i]);
      tm[i] = d[i] === 0 ? Infinity : (d[i] > 0 ? c[i] + 1 - o[i] : o[i] - c[i]) * td[i];
    }
    for (let n = 0; n < 64; n++) {
      if (SOLID[getBlock(c[0], c[1], c[2])]) return { b: c, p: pr };
      pr[0] = c[0]; pr[1] = c[1]; pr[2] = c[2];
      const a = tm[0] < tm[1] ? (tm[0] < tm[2] ? 0 : 2) : (tm[1] < tm[2] ? 1 : 2);
      if (tm[a] > max) return null;
      c[a] += st[a]; tm[a] += td[a];
    }
    return null;
  }
  let aim = touchMode ? null : [0, 0]; // 조준 지점(NDC)
  const target = (pt) => (pt ? raycast(cam.pos, rayDir(pt[0], pt[1]), 6.5) : null);
  function breakAt(pt) {
    const h = target(pt);
    if (h) setBlock(h.b[0], h.b[1], h.b[2], 0);
  }
  function placeAt(pt) {
    const h = target(pt);
    if (!h) return;
    const [x, y, z] = h.p, p = player;
    if (y < 1 || y >= H) return;
    const b = HOTBAR[sel];
    if (SOLID[b] && x + 1 > p.x - HW && x < p.x + HW && z + 1 > p.z - HW && z < p.z + HW && y + 1 > p.y && y < p.y + PH) return;
    setBlock(x, y, z, b);
  }

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), hud = $('hud'), bar = $('hotbar'), stick = $('stick'), knob = $('knob');
  let running = false;
  HOTBAR.forEach((b, i) => {
    const el = document.createElement('button');
    el.className = 'slot';
    const c = DEFS[b][1];
    el.innerHTML = `<i style="background:rgb(${c});opacity:${b === WATER || b === GLASS ? 0.7 : 1}"></i><span>${DEFS[b][0]}</span>`;
    const pick = (e) => { e.preventDefault(); e.stopPropagation(); selectSlot(i); };
    el.addEventListener('touchstart', pick, { passive: false });
    el.addEventListener('mousedown', pick);
    bar.appendChild(el);
  });
  function selectSlot(i) {
    sel = (i + HOTBAR.length) % HOTBAR.length;
    [...bar.children].forEach((el, j) => el.classList.toggle('on', j === sel));
    bar.children[sel].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    saveDirty = true;
  }
  function setFly(v) {
    fly = v; $('fly').classList.toggle('on', fly); $('down').style.display = fly ? '' : 'none';
    if (fly) player.vy = 0;
  }
  function applyTouchUI() {
    document.body.classList.toggle('touch', touchMode);
    $('help').innerHTML = touchMode
      ? '왼쪽 스틱: 이동 · 화면 드래그: 시점<br>짧게 탭: 블록 놓기 · 길게 누르기: 블록 캐기<br>⤒ 점프 · ✈ 비행 모드'
      : 'WASD: 이동 · 마우스: 시점 · Space: 점프<br>왼쪽 클릭: 캐기 · 오른쪽 클릭: 놓기<br>1~9 / 휠: 블록 선택 · F: 비행 · Esc: 메뉴';
  }
  function start() {
    overlay.style.display = 'none'; hud.style.display = ''; running = true;
    if (!touchMode && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) { /* 무시 */ } }
  }
  function pause() { running = false; overlay.style.display = ''; $('start').textContent = '계속하기'; writeSave(); }
  $('start').addEventListener('click', start);
  $('menu').addEventListener('click', () => { if (document.pointerLockElement) document.exitPointerLock(); pause(); });
  $('reset').addEventListener('click', () => {
    if (!confirm('지금 월드를 지우고 새 월드를 만들까요? 지은 것이 모두 사라집니다.')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
    saveDirty = false; noSave = true; location.reload();
  });
  let noSave = false;
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && running && !touchMode) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !noSave) writeSave(); });
  window.addEventListener('pagehide', () => { if (!noSave) writeSave(); });

  // 키보드 / 마우스
  window.addEventListener('keydown', (e) => {
    if (!running) return;
    keys[e.code] = true;
    if (e.code === 'KeyF') setFly(!fly);
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1); }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const SENS = 0.0024, PMAX = Math.PI / 2 - 0.01;
  function look(dx, dy, s) {
    player.yaw -= dx * s;
    player.pitch = Math.max(-PMAX, Math.min(PMAX, player.pitch - dy * s));
  }
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, SENS); });
  let mouseBreak = 0;
  canvas.addEventListener('mousedown', (e) => {
    if (!running || touchMode) return;
    if (document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (err) { /* 무시 */ } return; }
    if (e.button === 0) { breakAt(aim); mouseBreak = performance.now() + 260; }
    if (e.button === 2) placeAt(aim);
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseBreak = 0; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { if (running) selectSlot(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

  // 터치: 시점 드래그 / 탭 놓기 / 길게 눌러 캐기
  let lt = null; // 시점 터치
  const ndc = (t) => [(t.clientX / innerWidth) * 2 - 1, 1 - (t.clientY / innerHeight) * 2];
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!touchMode) { touchMode = true; aim = null; applyTouchUI(); }
    if (!running || lt) return;
    const t = e.changedTouches[0];
    lt = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: false, held: false, next: 0 };
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!lt) return;
    for (const t of e.changedTouches) if (t.identifier === lt.id) {
      look(t.clientX - lt.x, t.clientY - lt.y, 0.0055);
      lt.x = t.clientX; lt.y = t.clientY;
      if (Math.hypot(lt.x - lt.sx, lt.y - lt.sy) > 14) lt.moved = true;
    }
  }, { passive: false });
  const endLook = (e) => {
    e.preventDefault();
    if (!lt) return;
    for (const t of e.changedTouches) if (t.identifier === lt.id) {
      if (e.type === 'touchend' && running && !lt.moved && !lt.held && performance.now() - lt.t0 < 320) placeAt(ndc(t));
      lt = null; aim = null;
    }
  };
  canvas.addEventListener('touchend', endLook, { passive: false });
  canvas.addEventListener('touchcancel', endLook, { passive: false });

  // 가상 조이스틱
  let st = null;
  function stickMove(t) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = (t.clientX - r.left - R) / R, dy = (t.clientY - r.top - R) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    input.mx = dx; input.mz = dy;
    knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`;
  }
  stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; st = t.identifier; stickMove(t); }, { passive: false });
  stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === st) stickMove(t); }, { passive: false });
  const stickEnd = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === st) { st = null; input.mx = input.mz = 0; knob.style.transform = ''; }
  };
  stick.addEventListener('touchend', stickEnd, { passive: false });
  stick.addEventListener('touchcancel', stickEnd, { passive: false });
  function holdBtn(id, prop) {
    const el = $(id);
    const on = (e) => { e.preventDefault(); input[prop] = true; el.classList.add('down'); };
    const off = (e) => { e.preventDefault(); input[prop] = false; el.classList.remove('down'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
  }
  holdBtn('jump', 'jump'); holdBtn('down', 'down');
  $('fly').addEventListener('click', () => setFly(!fly));

  // ---------- 렌더 ----------
  let R = touchMode ? 4 : 6;
  let offs = [];
  function buildOffsets() {
    offs = [];
    for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) if (x * x + z * z <= R * R + 1) offs.push([x, z, x * x + z * z]);
    offs.sort((a, b) => a[2] - b[2]);
  }
  buildOffsets();
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize); resize();

  const pv = new Float32Array(16);
  function updateCamera() {
    const p = player, cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const f = [-sy * cp, sp, -cy * cp], r = [cy, 0, -sy];
    const u = [-r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1]];
    cam.f = f; cam.r = r; cam.u = u; cam.pos = [p.x, p.y + EYE, p.z];
    cam.aspect = canvas.width / canvas.height; cam.tan = Math.tan((70 * Math.PI) / 360);
    const near = 0.08, far = 420, a = 1 / cam.tan, A = (far + near) / (near - far), B = (2 * far * near) / (near - far);
    // PV = P * V, V의 행은 r, u, -f (카메라 기준 좌표라 이동 성분은 없다)
    for (let i = 0; i < 3; i++) {
      pv[i * 4] = (a / cam.aspect) * r[i]; pv[i * 4 + 1] = a * u[i]; pv[i * 4 + 2] = -A * f[i]; pv[i * 4 + 3] = f[i];
    }
    pv[12] = 0; pv[13] = 0; pv[14] = B; pv[15] = 0;
  }

  const vis = [];
  let slow = 0, lastEvict = 0;
  function render(now) {
    const day = Math.sin((worldTime / 600) * Math.PI * 2);
    const l = Math.max(0, Math.min(1, (day + 0.25) / 0.55)), light = 0.2 + 0.8 * l * l * (3 - 2 * l);
    let sky = [(12 + 138 * light) / 255, (16 + 184 * light) / 255, (34 + 206 * light) / 255];
    const head = getBlock(Math.floor(cam.pos[0]), Math.floor(cam.pos[1]), Math.floor(cam.pos[2])) === WATER;
    let fogA = (R - 1.5) * CH, fogB = R * CH - 2;
    if (head) { sky = [0.12 * light, 0.3 * light, 0.6 * light]; fogA = 1; fogB = 22; }
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uPV, false, pv);
    gl.uniform3f(U.uFog, sky[0], sky[1], sky[2]);
    gl.uniform1f(U.uLight, light);
    gl.uniform2f(U.uFogR, fogA, fogB);

    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    // 메시가 없는 가까운 청크부터 시간 예산 안에서 만든다
    const t0 = performance.now();
    vis.length = 0;
    for (const o of offs) {
      const c = ensureChunk(pcx + o[0], pcz + o[1]);
      if (!c.mesh) { if (performance.now() - t0 > 7) continue; buildMesh(c); }
      const cx = c.cx * CH + 8 - cam.pos[0], cz = c.cz * CH + 8 - cam.pos[2];
      if (cx * cam.f[0] + (32 - cam.pos[1]) * cam.f[1] + cz * cam.f[2] < -36) continue;
      vis.push(c);
    }
    gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.depthMask(true);
    for (const c of vis) if (c.mesh.o) {
      gl.uniform3f(U.uOff, c.cx * CH - cam.pos[0], -cam.pos[1], c.cz * CH - cam.pos[2]);
      drawBuf(c.mesh.o, gl.TRIANGLES);
    }
    const h = running ? target(aim) : null;
    if (h) {
      gl.uniform3f(U.uOff, h.b[0] - cam.pos[0], h.b[1] - cam.pos[1], h.b[2] - cam.pos[2]);
      drawBuf(outline, gl.LINES);
    }
    gl.enable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    for (let i = vis.length - 1; i >= 0; i--) {
      const c = vis[i];
      if (!c.mesh.t) continue;
      gl.uniform3f(U.uOff, c.cx * CH - cam.pos[0], -cam.pos[1], c.cz * CH - cam.pos[2]);
      drawBuf(c.mesh.t, gl.TRIANGLES);
    }
    gl.depthMask(true);

    if (now - lastEvict > 1500) {
      lastEvict = now;
      const lim = (R + 3) * (R + 3);
      for (const [k, c] of chunks) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > lim) {
          if (c.mesh) { freeBuf(c.mesh.o); freeBuf(c.mesh.t); }
          chunks.delete(k); if (lastC === c) lastC = null;
        }
      }
    }
  }

  let last = performance.now(), acc = 0, lastSave = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (running) {
      acc += dt; worldTime += dt;
      while (acc >= 1 / 120) { step(1 / 120); acc -= 1 / 120; }
      // 느린 기기에서는 시야 거리를 줄인다
      slow = dt > 0.045 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 90 && R > 3) { R--; buildOffsets(); slow = 0; }
    }
    updateCamera();
    if (running) {
      if (lt && !lt.moved && now - lt.t0 > 340 && now > lt.next) {
        lt.held = true; lt.next = now + 300;
        aim = [(lt.x / innerWidth) * 2 - 1, 1 - (lt.y / innerHeight) * 2];
        breakAt(aim);
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* 무시 */ } }
      }
      if (mouseBreak && now > mouseBreak) { breakAt(aim); mouseBreak = now + 260; }
      if (saveDirty && now - lastSave > 4000) { lastSave = now; writeSave(); }
    }
    render(now);
  }

  applyTouchUI(); selectSlot(sel); setFly(fly);
  hud.style.display = 'none';
  if (save) $('start').textContent = '이어서 하기';
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.__game = { player, getBlock, setBlock, start };
})();
