/*
 * Cat Sudoku engine
 * - 唯一解生成（位元遮罩 + MRV 回溯）
 * - 邏輯解題評分（唯一候選、隱性唯一、區塊摒除、數對/數組、X-Wing、XY-Wing、劍魚）
 * 可同時在瀏覽器主執行緒、Web Worker、Node.js 執行。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CatSudoku = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALL = 0x1ff;
  var ROW = new Uint8Array(81), COL = new Uint8Array(81), BOX = new Uint8Array(81);
  for (var i = 0; i < 81; i++) {
    ROW[i] = (i / 9) | 0;
    COL[i] = i % 9;
    BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0);
  }
  // 0-8: rows, 9-17: cols, 18-26: boxes
  var UNITS = [];
  for (var u = 0; u < 27; u++) UNITS.push([]);
  for (i = 0; i < 81; i++) {
    UNITS[ROW[i]].push(i);
    UNITS[9 + COL[i]].push(i);
    UNITS[18 + BOX[i]].push(i);
  }
  var PEERS = [];
  var PEER_SET = [];
  for (i = 0; i < 81; i++) {
    var s = new Set(UNITS[ROW[i]].concat(UNITS[9 + COL[i]], UNITS[18 + BOX[i]]));
    s.delete(i);
    PEERS.push(Array.from(s));
    PEER_SET.push(s);
  }
  var POP = new Uint8Array(512);
  for (var m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);

  function bit(d) { return 1 << (d - 1); }
  function digitOf(mask) { return 32 - Math.clz32(mask); }
  function digitsOf(mask) {
    var out = [];
    for (var d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
    return out;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function combos(arr, k, cb) {
    var idx = [];
    function rec(start, depth) {
      if (depth === k) return cb(idx.map(function (x) { return arr[x]; }));
      for (var i = start; i < arr.length; i++) {
        idx[depth] = i;
        if (rec(i + 1, depth + 1)) return true;
      }
      return false;
    }
    return rec(0, 0);
  }

  /* ---------------- 回溯求解 / 計算解數 ---------------- */

  function search(grid, limit, rnd) {
    var g = Array.from(grid);
    var rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
    for (var i = 0; i < 81; i++) {
      var v = g[i];
      if (!v) continue;
      var b = bit(v);
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return { count: 0, solution: null };
      rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
    }
    var count = 0, solution = null;

    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        var n = POP[m];
        if (n < bestN) {
          best = i; bestMask = m; bestN = n;
          if (n <= 1) break;
        }
      }
      if (best < 0) {
        count++;
        if (!solution) solution = g.slice();
        return count >= limit;
      }
      if (bestN === 0) return false;
      var r = ROW[best], c = COL[best], bx = BOX[best];
      var ds = digitsOf(bestMask);
      if (rnd) shuffle(ds, rnd);
      for (var k = 0; k < ds.length; k++) {
        var bb = bit(ds[k]);
        g[best] = ds[k];
        rows[r] |= bb; cols[c] |= bb; boxes[bx] |= bb;
        if (rec()) return true;
        rows[r] &= ~bb; cols[c] &= ~bb; boxes[bx] &= ~bb;
      }
      g[best] = 0;
      return false;
    }

    rec();
    return { count: count, solution: solution };
  }

  function countSolutions(grid, limit) { return search(grid, limit || 2).count; }
  function solve(grid) { return search(grid, 1).solution; }
  function generateSolution(rnd) { return search(new Array(81).fill(0), 1, rnd).solution; }

  /* ---------------- 邏輯解題（評分用） ---------------- */

  var TECHNIQUES = {
    nakedSingle: { name: '唯一候選數', level: 1 },
    hiddenSingle: { name: '隱性唯一', level: 1 },
    lockedCandidates: { name: '區塊摒除', level: 2 },
    nakedSubset: { name: '顯性數對/數組', level: 3 },
    hiddenSubset: { name: '隱性數對/數組', level: 3 },
    xWing: { name: 'X-Wing', level: 4 },
    xyWing: { name: 'XY-Wing', level: 4 },
    swordfish: { name: '劍魚 Swordfish', level: 4 }
  };

  function computeCandidates(vals) {
    var cand = new Uint16Array(81);
    for (var i = 0; i < 81; i++) {
      if (vals[i]) continue;
      var used = 0;
      var peers = PEERS[i];
      for (var k = 0; k < peers.length; k++) if (vals[peers[k]]) used |= bit(vals[peers[k]]);
      cand[i] = ALL & ~used;
    }
    return cand;
  }

  function Logic(puzzle) {
    this.vals = Array.from(puzzle);
    this.cand = computeCandidates(this.vals);
  }
  Logic.prototype.place = function (i, d) {
    this.vals[i] = d;
    this.cand[i] = 0;
    var b = bit(d), peers = PEERS[i];
    for (var k = 0; k < peers.length; k++) this.cand[peers[k]] &= ~b;
  };
  Logic.prototype.eliminate = function (cells, mask) {
    var changed = false;
    for (var k = 0; k < cells.length; k++) {
      var c = cells[k];
      if (this.cand[c] & mask) { this.cand[c] &= ~mask; changed = true; }
    }
    return changed;
  };
  Logic.prototype.nakedSingle = function () {
    for (var i = 0; i < 81; i++) {
      if (!this.vals[i] && POP[this.cand[i]] === 1) {
        return { index: i, value: digitOf(this.cand[i]) };
      }
    }
    return null;
  };
  Logic.prototype.hiddenSingle = function () {
    for (var u = 0; u < 27; u++) {
      var cells = UNITS[u];
      for (var d = 1; d <= 9; d++) {
        var b = bit(d), found = -1, n = 0;
        for (var k = 0; k < 9; k++) {
          if (this.cand[cells[k]] & b) { n++; found = cells[k]; if (n > 1) break; }
        }
        if (n === 1) return { index: found, value: d };
      }
    }
    return null;
  };
  Logic.prototype.lockedCandidates = function () {
    var self = this;
    // Pointing: box -> row/col
    for (var bx = 0; bx < 9; bx++) {
      var boxCells = UNITS[18 + bx];
      for (var d = 1; d <= 9; d++) {
        var b = bit(d);
        var cs = boxCells.filter(function (c) { return self.cand[c] & b; });
        if (cs.length < 2) continue;
        var r = ROW[cs[0]], c0 = COL[cs[0]];
        if (cs.every(function (c) { return ROW[c] === r; })) {
          if (this.eliminate(UNITS[r].filter(function (c) { return BOX[c] !== bx; }), b)) return true;
        }
        if (cs.every(function (c) { return COL[c] === c0; })) {
          if (this.eliminate(UNITS[9 + c0].filter(function (c) { return BOX[c] !== bx; }), b)) return true;
        }
      }
    }
    // Claiming: row/col -> box
    for (var u = 0; u < 18; u++) {
      for (d = 1; d <= 9; d++) {
        b = bit(d);
        cs = UNITS[u].filter(function (c) { return self.cand[c] & b; });
        if (cs.length < 2) continue;
        var box = BOX[cs[0]];
        if (cs.every(function (c) { return BOX[c] === box; })) {
          if (this.eliminate(UNITS[18 + box].filter(function (c) { return cs.indexOf(c) < 0; }), b)) return true;
        }
      }
    }
    return false;
  };
  Logic.prototype.nakedSubset = function () {
    var self = this;
    for (var size = 2; size <= 3; size++) {
      for (var u = 0; u < 27; u++) {
        var empties = UNITS[u].filter(function (c) { return !self.vals[c]; });
        if (empties.length <= size) continue;
        var pool = empties.filter(function (c) { return POP[self.cand[c]] <= size; });
        var hit = combos(pool, size, function (group) {
          var union = 0;
          for (var k = 0; k < group.length; k++) union |= self.cand[group[k]];
          if (POP[union] !== size) return false;
          var others = empties.filter(function (c) { return group.indexOf(c) < 0; });
          return self.eliminate(others, union);
        });
        if (hit) return true;
      }
    }
    return false;
  };
  Logic.prototype.hiddenSubset = function () {
    var self = this;
    for (var size = 2; size <= 3; size++) {
      for (var u = 0; u < 27; u++) {
        var cells = UNITS[u];
        var digits = [];
        for (var d = 1; d <= 9; d++) {
          var n = 0;
          for (var k = 0; k < 9; k++) if (self.cand[cells[k]] & bit(d)) n++;
          if (n >= 1 && n <= size) digits.push(d);
        }
        var hit = combos(digits, size, function (group) {
          var mask = 0;
          for (var k = 0; k < group.length; k++) mask |= bit(group[k]);
          var where = cells.filter(function (c) { return self.cand[c] & mask; });
          if (where.length !== size) return false;
          var changed = false;
          for (k = 0; k < where.length; k++) {
            var nc = self.cand[where[k]] & mask;
            if (nc !== self.cand[where[k]]) { self.cand[where[k]] = nc; changed = true; }
          }
          return changed;
        });
        if (hit) return true;
      }
    }
    return false;
  };
  Logic.prototype.fish = function (size) {
    var self = this;
    for (var d = 1; d <= 9; d++) {
      var b = bit(d);
      for (var orient = 0; orient < 2; orient++) {
        var base = orient === 0 ? 0 : 9;   // rows or cols as base
        var cover = orient === 0 ? 9 : 0;
        var lines = [];
        for (var l = 0; l < 9; l++) {
          var mask = 0, n = 0;
          var cells = UNITS[base + l];
          for (var k = 0; k < 9; k++) {
            if (self.cand[cells[k]] & b) { mask |= 1 << k; n++; }
          }
          if (n >= 2 && n <= size) lines.push({ line: l, mask: mask });
        }
        var hit = combos(lines, size, function (group) {
          var union = 0;
          for (var k = 0; k < group.length; k++) union |= group[k].mask;
          if (POP[union] !== size) return false;
          var baseLines = group.map(function (g) { return g.line; });
          var targets = [];
          for (var p = 0; p < 9; p++) {
            if (!(union & (1 << p))) continue;
            UNITS[cover + p].forEach(function (c) {
              var lineOfC = orient === 0 ? ROW[c] : COL[c];
              if (baseLines.indexOf(lineOfC) < 0) targets.push(c);
            });
          }
          return self.eliminate(targets, b);
        });
        if (hit) return true;
      }
    }
    return false;
  };
  Logic.prototype.xyWing = function () {
    var self = this;
    var bivalue = [];
    for (var i = 0; i < 81; i++) if (!self.vals[i] && POP[self.cand[i]] === 2) bivalue.push(i);
    for (var p = 0; p < bivalue.length; p++) {
      var pivot = bivalue[p], pm = self.cand[pivot];
      var wings = bivalue.filter(function (c) {
        return c !== pivot && PEER_SET[pivot].has(c) && POP[self.cand[c] & pm] === 1;
      });
      for (var a = 0; a < wings.length; a++) {
        for (var bIdx = a + 1; bIdx < wings.length; bIdx++) {
          var w1 = self.cand[wings[a]], w2 = self.cand[wings[bIdx]];
          if ((w1 & pm) === (w2 & pm)) continue;
          var z = (w1 & ~pm);
          if (z !== (w2 & ~pm) || POP[z] !== 1) continue;
          var targets = PEERS[wings[a]].filter(function (c) {
            return c !== pivot && PEER_SET[wings[bIdx]].has(c);
          });
          if (self.eliminate(targets, z)) return true;
        }
      }
    }
    return false;
  };
  Logic.prototype.filled = function () {
    for (var i = 0; i < 81; i++) if (!this.vals[i]) return false;
    return true;
  };

  function grade(puzzle) {
    var L = new Logic(puzzle);
    var used = {}, maxLevel = 0, steps = 0;
    function mark(id) {
      used[id] = (used[id] || 0) + 1;
      if (TECHNIQUES[id].level > maxLevel) maxLevel = TECHNIQUES[id].level;
      steps++;
    }
    var guard = 0;
    while (!L.filled() && guard++ < 2000) {
      var s = L.nakedSingle();
      if (s) { L.place(s.index, s.value); mark('nakedSingle'); continue; }
      s = L.hiddenSingle();
      if (s) { L.place(s.index, s.value); mark('hiddenSingle'); continue; }
      if (L.lockedCandidates()) { mark('lockedCandidates'); continue; }
      if (L.nakedSubset()) { mark('nakedSubset'); continue; }
      if (L.hiddenSubset()) { mark('hiddenSubset'); continue; }
      if (L.fish(2)) { mark('xWing'); continue; }
      if (L.xyWing()) { mark('xyWing'); continue; }
      if (L.fish(3)) { mark('swordfish'); continue; }
      break;
    }
    var solved = L.filled();
    return {
      solved: solved,
      // level 5 = 超出上述技巧（需要更進階的鏈/試誤推理）
      level: solved ? maxLevel : 5,
      steps: steps,
      used: used
    };
  }

  /* ---------------- 題目生成 ---------------- */

  var LEVELS = {
    1: { name: '入門高難', minHoles: 50, maxHoles: 52, minTech: 1 },
    2: { name: '專家挑戰', minHoles: 54, maxHoles: 56, minTech: 2 },
    3: { name: '地獄考驗', minHoles: 58, maxHoles: 64, minTech: 3 },
    4: { name: '超地獄考驗', minHoles: 60, maxHoles: 64, minTech: 5 }
  };

  function dig(solution, target, rnd) {
    var puzzle = solution.slice();
    var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }), rnd);
    var holes = 0;
    for (var k = 0; k < order.length && holes < target; k++) {
      var i = order[k], v = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[i] = v;
      else holes++;
    }
    return { puzzle: puzzle, holes: holes };
  }

  function generate(level, opts) {
    opts = opts || {};
    var cfg = LEVELS[level] || LEVELS[1];
    var seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    var rnd = mulberry32(seed);
    var deadline = Date.now() + (opts.timeLimit || 6000);
    var best = null, attempts = 0;
    while (true) {
      attempts++;
      var solution = generateSolution(rnd);
      var target = cfg.minHoles + Math.floor(rnd() * (cfg.maxHoles - cfg.minHoles + 1));
      var res = dig(solution, target, rnd);
      if (res.holes >= cfg.minHoles) {
        var g = grade(res.puzzle);
        var result = {
          level: level, levelName: cfg.name, seed: seed, attempts: attempts,
          puzzle: res.puzzle, solution: solution, holes: res.holes, grade: g
        };
        if (g.level >= cfg.minTech) return result;
        if (!best || g.level > best.grade.level) best = result;
      }
      if (best && Date.now() > deadline) return best;
    }
  }

  /* ---------------- 等價變換（換數字、換行列、換宮、轉置）---------------- */

  function shuffled(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function lineMap(rnd) {
    var map = [];
    shuffled([0, 1, 2], rnd).forEach(function (band) {
      shuffled([0, 1, 2], rnd).forEach(function (k) { map.push(band * 3 + k); });
    });
    return map;
  }
  function transform(puzzle, solution, rnd) {
    rnd = rnd || Math.random;
    var digits = [0].concat(shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd));
    var rows = lineMap(rnd), cols = lineMap(rnd), flip = rnd() < 0.5;
    var p = new Array(81), sol = new Array(81);
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var src = flip ? cols[c] * 9 + rows[r] : rows[r] * 9 + cols[c];
        p[r * 9 + c] = digits[puzzle[src]];
        sol[r * 9 + c] = digits[solution[src]];
      }
    }
    return { puzzle: p, solution: sol };
  }

  /* ---------------- 提示 ---------------- */

  function findHint(values, solution) {
    var L = new Logic(values);
    var s = L.nakedSingle();
    if (s) return { index: s.index, value: s.value, technique: TECHNIQUES.nakedSingle.name };
    s = L.hiddenSingle();
    if (s) return { index: s.index, value: s.value, technique: TECHNIQUES.hiddenSingle.name };
    for (var i = 0; i < 81; i++) {
      if (!values[i]) return { index: i, value: solution[i], technique: '進階推理' };
    }
    return null;
  }

  return {
    LEVELS: LEVELS,
    TECHNIQUES: TECHNIQUES,
    ROW: ROW, COL: COL, BOX: BOX, PEERS: PEERS, UNITS: UNITS,
    mulberry32: mulberry32,
    countSolutions: countSolutions,
    solve: solve,
    generateSolution: generateSolution,
    grade: grade,
    generate: generate,
    transform: transform,
    findHint: findHint,
    computeCandidates: computeCandidates
  };
});
