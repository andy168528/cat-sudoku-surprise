// 執行：node tests/engine.test.js
const assert = require('assert');
const S = require('../js/sudoku.js');

function validSolution(g) {
  for (const unit of S.UNITS) {
    const set = new Set(unit.map(i => g[i]));
    if (set.size !== 9 || set.has(0)) return false;
  }
  return true;
}

for (const level of [1, 2, 3]) {
  const cfg = S.LEVELS[level];
  const times = [];
  for (let k = 0; k < 15; k++) {
    const t0 = Date.now();
    const r = S.generate(level, { seed: level * 1000 + k });
    times.push(Date.now() - t0);
    assert.ok(validSolution(r.solution), 'solution must be valid');
    assert.strictEqual(S.countSolutions(r.puzzle, 2), 1, 'puzzle must have a unique solution');
    assert.ok(r.holes >= cfg.minHoles && r.holes <= cfg.maxHoles, `L${level} holes ${r.holes}`);
    assert.strictEqual(r.puzzle.filter(v => v === 0).length, r.holes);
    r.puzzle.forEach((v, i) => { if (v) assert.strictEqual(v, r.solution[i]); });
    assert.deepStrictEqual(S.solve(r.puzzle), r.solution);
    assert.ok(r.grade.level >= cfg.minTech, `L${level} grade ${r.grade.level}`);
  }
  console.log(`Level ${level} OK — avg ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}ms, max ${Math.max(...times)}ms`);
}

// 同一個 seed 需產生相同題目
assert.deepStrictEqual(S.generate(2, { seed: 7 }).puzzle, S.generate(2, { seed: 7 }).puzzle);

// 提示必須與解答一致
const r = S.generate(1, { seed: 99 });
const h = S.findHint(r.puzzle, r.solution);
assert.strictEqual(h.value, r.solution[h.index]);
console.log('All engine tests passed ✅');
