// 預先產生所有關卡題目（每關一個題庫，開啟即玩），輸出到 js/stages.js
// 執行：node scripts/build-stages.js [每關題數，預設 5]
// 已存在的題目會保留，只補產生不足的數量。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../js/sudoku.js');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8'), ctx);
const CONFIG = ctx.CAT_SUDOKU_CONFIG;
const POOL = Number(process.argv[2]) || 5;
const FILE = path.join(__dirname, '../js/stages.js');

let old = {};
try {
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx);
  old = JSON.parse(JSON.stringify(ctx.CAT_SUDOKU_STAGES || {}));
} catch (e) { /* 沒有舊檔就全部重新產生 */ }

const out = {};
CONFIG.chapters.forEach((c, idx) => {
  for (let s = 1; s <= c.stages; s++) {
    const id = c.key + '-' + String(s).padStart(2, '0');
    const pool = [].concat(old[id] || []).slice(0, POOL);
    const seen = new Set(pool.map(x => x.s));
    for (let k = 0; pool.length < POOL; k++) {
      const r = S.generate(c.level, { seed: (idx + 1) * 1e7 + s * 1e5 + k, timeLimit: 20000 });
      if (r.grade.level < S.LEVELS[c.level].minTech || seen.has(r.solution.join(''))) continue;
      if (S.countSolutions(r.puzzle, 2) !== 1) throw new Error('not unique ' + id);
      seen.add(r.solution.join(''));
      pool.push({ p: r.puzzle.join(''), s: r.solution.join(''), h: r.holes, g: r.grade.level });
      console.log(id, '#' + pool.length, 'holes', r.holes, 'grade', r.grade.level);
    }
    out[id] = pool;
  }
});
const body = '// 自動產生：node scripts/build-stages.js（請勿手動修改）\n' +
  '(function (g) {\n  g.CAT_SUDOKU_STAGES = {\n' +
  Object.keys(out).map(id => '    "' + id + '": [\n' +
    out[id].map(x => '      ' + JSON.stringify(x)).join(',\n') + '\n    ]').join(',\n') +
  '\n  };\n})(typeof self !== \'undefined\' ? self : this);\n';
fs.writeFileSync(FILE, body);
console.log('wrote js/stages.js:', Object.keys(out).length, 'stages x', POOL);
