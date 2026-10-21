// 執行：node tests/stages.test.js —— 檢查章節設定與預先產生的關卡題目
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../js/sudoku.js');

const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/stages.js'), 'utf8'), ctx);
const CONFIG = ctx.CAT_SUDOKU_CONFIG;
const STAGES = ctx.CAT_SUDOKU_STAGES;

const A = x => JSON.parse(JSON.stringify(x)); // 跨 vm context 的陣列需轉成本地陣列
const chs = CONFIG.chapters;
assert.deepStrictEqual(A(chs.map(c => c.label + '・' + c.name)), ['第一章・指西', '第二章・指北', '第三章・指南', '終章・鴻小兵']);
assert.deepStrictEqual(A(chs.map(c => c.stages)), [10, 10, 10, 3]);
assert.deepStrictEqual(A(chs.map(c => c.hints)), [3, 2, 1, 0]);
assert.deepStrictEqual(A(chs.map(c => c.level)), [1, 2, 3, 4]);
chs.slice(0, 3).forEach(c => assert.ok(c.timeLimits[10] > 0, c.name + ' 第10關要限時'));
[1, 2, 3].forEach(s => assert.ok(chs[3].timeLimits[s] > 0, '鴻小兵第' + s + '關要限時'));

// Lv.1～4：每個 Lv 33 關，共 132 關
assert.deepStrictEqual(A(CONFIG.modes.map(m => m.name)), ['普通', '指西作亂', '肥肥臭指北', '暴食指南貓']);
assert.deepStrictEqual(A(CONFIG.modes.map(m => m.effect)), ['', 'shift', 'size', 'eat']);
CONFIG.modes.forEach(m => assert.ok(m.rules.length > 0, 'Lv.' + m.lv + ' 要有規則說明'));
assert.strictEqual(chs.reduce((n, c) => n + c.stages, 0) * CONFIG.modes.length, 132);
const photos = CONFIG.rewards.filter(r => r.kind === 'photo'), sounds = CONFIG.rewards.filter(r => r.kind === 'sound');
assert.strictEqual(photos.length, 72, '寫真：每 Lv 5+5+5+3');
assert.strictEqual(sounds.length, 33, '叫聲：只有 Lv.1，每關一段');
assert.ok(sounds.every(r => r.lv === 1));
assert.strictEqual(new Set(CONFIG.rewards.map(r => r.id)).size, CONFIG.rewards.length);
photos.forEach(r => assert.strictEqual(r.stage % chs[r.ch - 1].photoEvery, 0));
assert.deepStrictEqual(A(photos.filter(r => r.lv === 1 && r.ch === 1).map(r => r.stage)), [2, 4, 6, 8, 10]);
assert.deepStrictEqual(A(photos.filter(r => r.lv === 4 && r.ch === 4).map(r => r.stage)), [1, 2, 3]);
CONFIG.rewards.forEach(r => {
  const m = CONFIG.mediaFor(r);
  assert.ok(r.kind === 'photo' ? m.photos.length && !m.sounds.length : m.sounds.length && !m.photos.length);
  assert.ok(r.pitch > 0.4 && r.pitch < 2);
});
assert.ok(CONFIG.gun && CONFIG.gun.name === '老子弄不到槍');

const toArr = s => s.split('').map(Number);
const POOL = 20;
const all = [];
const solSeen = new Set();
const stageIds = [];
chs.forEach((c, idx) => { for (let s = 1; s <= c.stages; s++) stageIds.push({ id: c.key + '-' + String(s).padStart(2, '0'), ch: idx + 1 }); });
stageIds.forEach(r => {
  const pool = A(STAGES[r.id] || []);
  assert.ok(pool.length >= POOL, r.id + ' 題庫至少 ' + POOL + ' 題，目前 ' + pool.length);
  const lv = S.LEVELS[chs[r.ch - 1].level];
  pool.forEach((st, k) => {
    assert.ok(st.h >= pool[0].h && st.g >= Math.max(pool[0].g, lv.minTech), r.id + '#' + k + ' 不可比第 1 題容易');
    all.push(Object.assign({ id: r.id + '#' + k, r: r }, st));
  });
});
all.forEach(st => {
  const r = st.r;
  assert.ok(!solSeen.has(st.s), st.id + ' 與其他題重複'); solSeen.add(st.s);
  const p = toArr(st.p), sol = toArr(st.s);
  const lv = S.LEVELS[chs[r.ch - 1].level];
  assert.strictEqual(S.countSolutions(p, 2), 1, st.id + ' unique');
  assert.deepStrictEqual(S.solve(p), sol, st.id + ' solution');
  p.forEach((v, i) => { if (v) assert.strictEqual(v, sol[i]); });
  const holes = p.filter(v => v === 0).length;
  assert.strictEqual(holes, st.h);
  assert.ok(holes >= lv.minHoles && holes <= lv.maxHoles, st.id + ' holes ' + holes);
  assert.ok(S.grade(p).level >= lv.minTech, st.id + ' grade');
});

// 重來時的等價變換：盤面不同，但唯一解、挖空數、難度都不變
all.forEach((st, n) => {
  const id = st.id;
  const p = st.p.split('').map(Number), sol = st.s.split('').map(Number);
  const rnd = S.mulberry32(1234 + n);
  const t = S.transform(p, sol, rnd);
  assert.notStrictEqual(t.puzzle.join(''), st.p, id + ' 變換後應不同');
  assert.strictEqual(t.puzzle.filter(v => !v).length, st.h, id + ' 挖空數不變');
  for (let i = 0; i < 81; i++) if (t.puzzle[i]) assert.strictEqual(t.puzzle[i], t.solution[i]);
  assert.strictEqual(S.countSolutions(t.puzzle.slice(), 2), 1, id + ' 變換後仍唯一解');
  assert.deepStrictEqual(S.solve(t.puzzle.slice()), t.solution, id + ' 解答對應');
  if (n % 20 === 0) assert.strictEqual(S.grade(t.puzzle).level, st.g, id + ' 難度不變');
});
console.log('All stage/config tests passed ✅（每個 Lv 33 關 × 每關 ' + POOL + ' 題，共 ' + all.length + ' 題皆為唯一解）');
