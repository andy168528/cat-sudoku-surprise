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
assert.deepStrictEqual(A(chs.map(c => c.stages)), [15, 15, 15, 3]);
assert.deepStrictEqual(A(chs.map(c => c.hints)), [3, 2, 1, 0]);
assert.deepStrictEqual(A(chs.map(c => c.level)), [1, 2, 3, 4]);
chs.slice(0, 3).forEach(c => assert.ok(c.timeLimits[15] > 0, c.name + ' 第15關要限時'));
[1, 2, 3].forEach(s => assert.ok(chs[3].timeLimits[s] > 0, '鴻小兵第' + s + '關要限時'));

assert.strictEqual(CONFIG.rewards.length, 48);
assert.strictEqual(new Set(CONFIG.rewards.map(r => r.id)).size, 48);
CONFIG.rewards.forEach(r => {
  const m = CONFIG.mediaFor(r);
  assert.ok(m.photos.length && m.sounds.length);
  assert.ok(r.pitch > 0.4 && r.pitch < 2);
});
assert.ok(CONFIG.ultimateReward && CONFIG.ultimateReward.title);

const toArr = s => s.split('').map(Number);
const POOL = 5;
const all = [];
const solSeen = new Set();
CONFIG.rewards.forEach(r => {
  const pool = A(STAGES[r.id] || []);
  assert.ok(pool.length >= POOL, r.id + ' 題庫至少 ' + POOL + ' 題，目前 ' + pool.length);
  pool.forEach((st, k) => all.push(Object.assign({ id: r.id + '#' + k, r: r }, st)));
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
console.log('All stage/config tests passed ✅（48 關 × 題庫共 ' + all.length + ' 題，皆為唯一解）');
