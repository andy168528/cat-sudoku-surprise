// 預先產生所有關卡題目（固定題目、開啟即玩），輸出到 js/stages.js
// 執行：node scripts/build-stages.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../js/sudoku.js');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8'), ctx);
const CONFIG = ctx.CAT_SUDOKU_CONFIG;

const out = {};
CONFIG.chapters.forEach((c, idx) => {
  for (let s = 1; s <= c.stages; s++) {
    const id = c.key + '-' + String(s).padStart(2, '0');
    let r;
    for (let k = 0; ; k++) {
      r = S.generate(c.level, { seed: (idx + 1) * 100000 + s * 1000 + k, timeLimit: 20000 });
      if (r.grade.level >= S.LEVELS[c.level].minTech) break;
    }
    if (S.countSolutions(r.puzzle, 2) !== 1) throw new Error('not unique ' + id);
    out[id] = { p: r.puzzle.join(''), s: r.solution.join(''), h: r.holes, g: r.grade.level };
    console.log(id, 'holes', r.holes, 'grade', r.grade.level);
  }
});
const body = '// 自動產生：node scripts/build-stages.js（請勿手動修改）\n' +
  '(function (g) {\n  g.CAT_SUDOKU_STAGES = ' + JSON.stringify(out, null, 0).replace(/\},"/g, '},\n    "') + ';\n})(typeof self !== \'undefined\' ? self : this);\n';
fs.writeFileSync(path.join(__dirname, '../js/stages.js'), body);
console.log('wrote js/stages.js with', Object.keys(out).length, 'stages');
