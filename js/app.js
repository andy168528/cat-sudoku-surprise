(function () {
  'use strict';

  var S = window.CatSudoku;
  var Sound = window.CatSound;
  var CONFIG = window.CAT_SUDOKU_CONFIG;
  var STAGES = window.CAT_SUDOKU_STAGES || {};
  var REWARDS = CONFIG.rewards;
  var CHS = CONFIG.chapters;
  var ICONS = {
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="12" cy="12" r="3.5"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>'
  };

  var KEY_GAMES = 'catSudoku.games.v2';
  var KEY_PROGRESS = 'catSudoku.progress.v2';
  var KEY_SETTINGS = 'catSudoku.settings.v1';
  var MAX_HISTORY = 100;
  var GRADE_TEXT = { 1: '基本技巧', 2: '區塊摒除', 3: '數對 / 數組', 4: 'X-Wing 級', 5: '超進階推理' };
  var NUM_TEXT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

  function $(id) { return document.getElementById(id); }
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 儲存空間已滿 */ }
  }
  function bit(d) { return 1 << (d - 1); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (m < 10 ? '0' : '') + m, ss = (sec < 10 ? '0' : '') + sec;
    return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function personalize(t) { return t.replace(/\{name\}/g, CONFIG.herName); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- 章節 / 關卡 ---------------- */

  function C(ch) { return CHS[ch - 1]; }
  function chName(ch) { return C(ch).label + '・' + C(ch).name; }
  function stageId(ch, s) { return C(ch).key + '-' + pad2(s); }
  function stageText(s) { return '第' + (NUM_TEXT[s] || s) + '關'; }
  function limitMs(ch, s) { var m = (C(ch).timeLimits || {})[s]; return m ? m * 60000 : 0; }

  /* ---------------- 狀態 ---------------- */

  function freshProgress() { return { cleared: {}, best: {}, seen: [], wins: 0, fails: 0, ultimate: false }; }
  var settings = Object.assign({ sound: true, errorCheck: true, highlight: true, autoNotes: true, galleryPhoto: true },
    load(KEY_SETTINGS, {}));
  var progress = Object.assign(freshProgress(), load(KEY_PROGRESS, {}));
  var store = Object.assign({ current: 1, games: {} }, load(KEY_GAMES, {}));
  var game = store.games[store.current] || null;

  var selected = -1;
  var noteMode = false;
  var paused = false;
  var timerId = null;
  var lastTick = 0;
  var tickCount = 0;
  var currentView = 'game';
  var cardMode = {};
  var cells = [];
  var numButtons = [];

  Sound.setEnabled(settings.sound);

  function persistGame() {
    if (game) store.games[game.ch] = game;
    save(KEY_GAMES, store);
  }
  function persistProgress() { save(KEY_PROGRESS, progress); }
  function persistSettings() { save(KEY_SETTINGS, settings); }

  function clearedList(ch) { return progress.cleared[ch] || (progress.cleared[ch] = []); }
  function isStageCleared(ch, s) { return clearedList(ch).indexOf(s) >= 0; }
  function isChapterDone(ch) {
    for (var s = 1; s <= C(ch).stages; s++) if (!isStageCleared(ch, s)) return false;
    return true;
  }
  function isChapterUnlocked(ch) { return ch === 1 || isChapterDone(ch - 1); }
  function isStageUnlocked(ch, s) { return isChapterUnlocked(ch) && (s === 1 || isStageCleared(ch, s - 1)); }
  function nextStage(ch) {
    for (var s = 1; s <= C(ch).stages; s++) if (!isStageCleared(ch, s)) return s;
    return C(ch).stages;
  }
  function allDone() { return CHS.every(function (c, i) { return isChapterDone(i + 1); }); }
  function hintsAllowed(g) { return C(g.ch).hints || 0; }
  function isFrozen() { return !game || game.completed || game.failed || paused; }

  /* ---------------- 盤面 ---------------- */

  function buildBoard() {
    var board = $('board');
    board.innerHTML = '';
    cells = [];
    for (var i = 0; i < 81; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.i = i;
      var notes = '';
      for (var d = 1; d <= 9; d++) notes += '<span></span>';
      cell.innerHTML = '<span class="v"></span><div class="notes">' + notes + '</div>';
      board.appendChild(cell);
      cells.push({ el: cell, v: cell.firstChild, notes: cell.lastChild.children });
    }
    board.addEventListener('click', function (e) {
      var c = e.target.closest('.cell');
      if (c) selectCell(+c.dataset.i);
    });
  }

  function buildNumpad() {
    var pad = $('numpad');
    pad.innerHTML = '';
    numButtons = [];
    for (var d = 1; d <= 9; d++) {
      var b = document.createElement('button');
      b.className = 'num';
      b.dataset.n = d;
      b.innerHTML = d + '<small class="num-count"></small>';
      pad.appendChild(b);
      numButtons.push(b);
    }
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('.num');
      if (b) input(+b.dataset.n);
    });
  }

  function computeConflicts() {
    var set = new Set();
    for (var u = 0; u < 27; u++) {
      var seen = {};
      S.UNITS[u].forEach(function (c) {
        var v = game.values[c];
        if (!v) return;
        if (seen[v] != null) { set.add(c); set.add(seen[v]); } else seen[v] = c;
      });
    }
    return set;
  }

  function isPeer(a, b) {
    return S.ROW[a] === S.ROW[b] || S.COL[a] === S.COL[b] || S.BOX[a] === S.BOX[b];
  }

  function render() {
    renderTabs();
    if (!game) return;
    var selVal = selected >= 0 ? game.values[selected] : 0;
    var conflicts = computeConflicts();
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var filled = 0;
    for (var i = 0; i < 81; i++) {
      var v = game.values[i];
      var given = game.puzzle[i] !== 0;
      if (v) { counts[v]++; filled++; }
      var cls = 'cell';
      if (S.COL[i] === 2 || S.COL[i] === 5) cls += ' br';
      if (S.ROW[i] === 2 || S.ROW[i] === 5) cls += ' bb';
      if (given) cls += ' given'; else if (v) cls += ' user';
      if (i === selected) cls += ' selected';
      else if (settings.highlight && selected >= 0 && isPeer(i, selected)) cls += ' peer';
      if (settings.highlight && selVal && v === selVal) cls += ' same';
      if (!given && v && settings.errorCheck && v !== game.solution[i]) cls += ' wrong';
      if (conflicts.has(i) && settings.errorCheck) cls += ' conflict';
      if (game.hinted.indexOf(i) >= 0) cls += ' hinted';
      var c = cells[i];
      if (c.el.className.replace(/ (pop|shake)/g, '') !== cls) {
        var keep = c.el.className.match(/ (pop|shake)/g);
        c.el.className = cls + (keep ? keep.join('') : '');
      }
      var txt = v ? String(v) : '';
      if (c.v.textContent !== txt) c.v.textContent = txt;
      var n = v ? 0 : game.notes[i];
      for (var d = 1; d <= 9; d++) {
        var span = c.notes[d - 1];
        var on = (n & bit(d)) ? String(d) : '';
        if (span.textContent !== on) span.textContent = on;
        span.className = on && settings.highlight && d === selVal ? 'hl' : '';
      }
    }
    for (var k = 1; k <= 9; k++) {
      var left = 9 - counts[k];
      var btn = numButtons[k - 1];
      btn.classList.toggle('done', left <= 0);
      btn.lastChild.textContent = left > 0 ? left : '✓';
    }
    $('levelLabel').textContent = chName(game.ch) + '・' + stageText(game.stage) + ' / ' + C(game.ch).stages;
    $('gradeLabel').textContent = '挖空 ' + game.holes + '・' + (GRADE_TEXT[game.grade] || '—');
    $('filledLabel').textContent = filled + ' / 81';
    $('mistakes').textContent = game.mistakes;
    renderTimer();
    var allow = hintsAllowed(game);
    var hb = $('hintBtn');
    hb.classList.toggle('disabled', allow === 0 || game.hints >= allow);
    $('hintCount').textContent = allow === 0 ? '禁用' : (allow - game.hints) + '/' + allow;
    $('notesBtn').classList.toggle('active', noteMode);
    $('notesState').textContent = noteMode ? '開' : '關';
    $('pauseOverlay').classList.toggle('hidden', !paused || !!game.failed);
    $('failOverlay').classList.toggle('hidden', !game.failed);
    if (game.failed) $('failText').textContent = '這一關要在 ' + fmtTime(game.timeLimitMs) + ' 內完成，再挑戰一次吧！';
    $('board').classList.toggle('blur', paused || !!game.failed);
    $('pauseBtn').innerHTML = paused ? ICONS.play : ICONS.pause;
  }

  function renderTimer() {
    if (!game) return;
    var timed = game.timeLimitMs > 0;
    var stat = $('timer').parentNode;
    $('timerLabel').textContent = timed ? '剩餘時間' : '時間';
    if (timed) {
      var remain = Math.max(0, game.timeLimitMs - game.elapsedMs);
      $('timer').textContent = fmtTime(remain);
      stat.classList.toggle('urgent', !game.completed && remain <= 60000);
    } else {
      $('timer').textContent = fmtTime(game.elapsedMs);
      stat.classList.remove('urgent');
    }
    stat.classList.toggle('timed', timed);
  }

  function buildLevelTabs() {
    $('levelTabs').innerHTML = CHS.map(function (c, idx) {
      return '<button class="level-tab" data-ch="' + (idx + 1) + '" role="tab"><small>' + esc(c.label) + '</small>' +
        '<b>' + esc(c.name) + '</b><small>' + esc(c.desc) + '</small><span class="lock">' + ICONS.lock + '</span></button>';
    }).join('');
  }

  function renderTabs() {
    var tabs = document.querySelectorAll('.level-tab');
    for (var t = 0; t < tabs.length; t++) {
      var ch = +tabs[t].dataset.ch;
      var unlocked = isChapterUnlocked(ch);
      tabs[t].classList.toggle('active', ch === store.current);
      tabs[t].classList.toggle('locked', !unlocked);
      tabs[t].classList.toggle('done', isChapterDone(ch));
      tabs[t].querySelector('.lock').classList.toggle('hidden', unlocked);
    }
    renderStages();
    var hasNew = REWARDS.some(function (r) { return isUnlocked(r) && progress.seen.indexOf(r.id) < 0; });
    $('galleryBadge').classList.toggle('hidden', !hasNew);
    renderCheer();
  }

  function renderStages() {
    var ch = store.current, c = C(ch);
    var html = '';
    for (var s = 1; s <= c.stages; s++) {
      var cls = 'stage';
      if (isStageCleared(ch, s)) cls += ' cleared';
      if (!isStageUnlocked(ch, s)) cls += ' locked';
      if (game && game.ch === ch && game.stage === s) cls += ' current';
      if (limitMs(ch, s)) cls += ' timed';
      html += '<button class="' + cls + '" data-stage="' + s + '" aria-label="' + stageText(s) + '">' + s + '</button>';
    }
    var el = $('stageStrip');
    el.style.setProperty('--n', c.stages);
    el.classList.toggle('few', c.stages <= 5);
    if (el.innerHTML !== html) el.innerHTML = html;
    var got = clearedList(ch).length;
    $('stageMeta').textContent = '已過 ' + got + ' / ' + c.stages + ' 關・每關提示 ' + (c.hints ? c.hints + ' 次' : '不能用') +
      (Object.keys(c.timeLimits || {}).length ? '・「限」為限時關' : '');
  }

  function flash(i, cls) {
    var el = cells[i].el;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 450);
  }

  /* ---------------- 互動 ---------------- */

  function selectCell(i) {
    if (!game || paused || game.failed) return;
    selected = i;
    render();
  }

  function pushHistory() {
    game.history.push({ v: game.values.slice(), n: game.notes.slice() });
    if (game.history.length > MAX_HISTORY) game.history.shift();
  }

  function canEdit() {
    return !isFrozen() && selected >= 0 && game.puzzle[selected] === 0;
  }

  function input(d) {
    if (isFrozen()) return;
    if (selected < 0) { toast('先點一個格子喔'); return; }
    if (!canEdit()) { Sound.click(); return; }
    var i = selected;
    if (noteMode) {
      if (game.values[i]) return;
      pushHistory();
      game.notes[i] ^= bit(d);
      Sound.note();
    } else if (game.values[i] === d) {
      pushHistory();
      game.values[i] = 0;
      Sound.click();
    } else {
      pushHistory();
      game.values[i] = d;
      game.notes[i] = 0;
      if (settings.autoNotes) {
        S.PEERS[i].forEach(function (p) { game.notes[p] &= ~bit(d); });
      }
      if (d !== game.solution[i]) {
        game.mistakes++;
        if (settings.errorCheck) {
          Sound.error();
          flash(i, 'shake');
          if (navigator.vibrate) navigator.vibrate(80);
        } else {
          Sound.click();
        }
      } else {
        Sound.correct();
        flash(i, 'pop');
      }
    }
    persistGame();
    render();
    checkWin();
  }

  function erase() {
    if (!canEdit()) return;
    var i = selected;
    if (!game.values[i] && !game.notes[i]) return;
    pushHistory();
    game.values[i] = 0;
    game.notes[i] = 0;
    Sound.click();
    persistGame();
    render();
  }

  function undo() {
    if (isFrozen()) return;
    var h = game.history.pop();
    if (!h) { toast('沒有可以復原的步驟'); return; }
    game.values = h.v;
    game.notes = h.n;
    Sound.click();
    persistGame();
    render();
  }

  function toggleNotes() {
    noteMode = !noteMode;
    Sound.click();
    render();
  }

  function hint() {
    if (isFrozen()) return;
    var allow = hintsAllowed(game);
    if (allow === 0) { Sound.error(); toast(C(game.ch).name + '章不能使用提示，全靠實力！'); return; }
    if (game.hints >= allow) { Sound.error(); toast('本關提示已用完（每關 ' + allow + ' 次）'); return; }
    for (var i = 0; i < 81; i++) {
      if (game.values[i] && game.values[i] !== game.solution[i]) {
        selected = i;
        render();
        flash(i, 'shake');
        Sound.error();
        toast('這一格好像不太對喔（不扣提示次數）');
        return;
      }
    }
    var h = S.findHint(game.values, game.solution);
    if (!h) return;
    pushHistory();
    selected = h.index;
    game.values[h.index] = h.value;
    game.notes[h.index] = 0;
    if (settings.autoNotes) S.PEERS[h.index].forEach(function (p) { game.notes[p] &= ~bit(h.value); });
    game.hints++;
    game.hinted.push(h.index);
    Sound.meow(null, 1.3);
    toast('提示（' + h.technique + '）：第 ' + (S.ROW[h.index] + 1) + ' 列第 ' + (S.COL[h.index] + 1) + ' 行是 ' + h.value +
      '・剩 ' + (allow - game.hints) + ' 次');
    persistGame();
    render();
    flash(h.index, 'pop');
    checkWin();
  }

  function moveSelection(dr, dc) {
    if (selected < 0) { selectCell(0); return; }
    var r = (S.ROW[selected] + dr + 9) % 9, c = (S.COL[selected] + dc + 9) % 9;
    selectCell(r * 9 + c);
  }

  /* ---------------- 計時器 / 時限 ---------------- */

  function startTimer() {
    stopTimer();
    if (isFrozen() || currentView !== 'game' || document.hidden) return;
    lastTick = Date.now();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (timerId) {
      var id = timerId;
      timerId = null;
      clearInterval(id);
      tick();
    }
  }
  function tick() {
    if (!game || game.completed || game.failed) return;
    var now = Date.now();
    game.elapsedMs += now - lastTick;
    lastTick = now;
    renderTimer();
    if (game.timeLimitMs && game.elapsedMs >= game.timeLimitMs) { timeUp(); return; }
    if (++tickCount % 5 === 0) persistGame();
  }
  function timeUp() {
    if (game.failed) return;
    game.failed = true;
    stopTimer();
    game.elapsedMs = game.timeLimitMs;
    selected = -1;
    progress.fails = (progress.fails || 0) + 1;
    persistProgress();
    persistGame();
    render();
    Sound.error();
    openModal('<p class="modal-kicker">' + esc(chName(game.ch)) + '・' + stageText(game.stage) + '</p>' +
      '<h2 class="modal-title">時間到</h2><div class="ornament">— ✦ —</div>' +
      '<p class="story">這一關要在 ' + fmtTime(game.timeLimitMs) + ' 內完成才算過關。<br>同一題再挑戰一次，這次一定可以！</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">稍後</button>' +
      '<button class="btn primary" data-act="retry">重新挑戰</button></div>', function (act) {
      closeModal();
      if (act === 'retry') restartStage();
    });
  }
  function setPaused(v) {
    if (!game || game.completed || game.failed) v = false;
    paused = v;
    if (paused) stopTimer(); else startTimer();
    persistGame();
    render();
  }

  /* ---------------- 載入關卡 ---------------- */

  function hasProgress(g) {
    if (!g || g.completed || g.failed) return false;
    for (var i = 0; i < 81; i++) if ((g.values[i] && !g.puzzle[i]) || g.notes[i]) return true;
    return false;
  }

  function stagePuzzle(ch, s) {
    var pre = STAGES[stageId(ch, s)];
    if (pre) {
      var toArr = function (str) { return str.split('').map(Number); };
      return { puzzle: toArr(pre.p), solution: toArr(pre.s), holes: pre.h, grade: pre.g };
    }
    var r = S.generate(C(ch).level, { seed: ch * 100000 + s * 1000 });
    return { puzzle: r.puzzle, solution: r.solution, holes: r.holes, grade: r.grade.level };
  }

  function loadStage(ch, s) {
    stopTimer();
    $('loading').classList.remove('hidden');
    setTimeout(function () {
      var p = stagePuzzle(ch, s);
      game = {
        ch: ch, stage: s, id: stageId(ch, s), puzzle: p.puzzle, solution: p.solution,
        values: p.puzzle.slice(), notes: new Array(81).fill(0),
        mistakes: 0, hints: 0, hinted: [], elapsedMs: 0, timeLimitMs: limitMs(ch, s),
        completed: false, failed: false, history: [], grade: p.grade, holes: p.holes, createdAt: Date.now()
      };
      store.current = ch;
      selected = -1;
      noteMode = false;
      paused = false;
      persistGame();
      $('loading').classList.add('hidden');
      render();
      startTimer();
      if (game.timeLimitMs) toast('限時關：' + fmtTime(game.timeLimitMs) + ' 內完成才算過關');
    }, 60);
  }

  function restartStage() { if (game) loadStage(game.ch, game.stage); }

  function switchChapter(ch) {
    Sound.click();
    if (!isChapterUnlocked(ch)) {
      toast('先完成「' + C(ch - 1).name + '」全部 ' + C(ch - 1).stages + ' 關，才能翻開「' + C(ch).name + '」');
      return;
    }
    if (ch === store.current && game) return;
    stopTimer();
    persistGame();
    store.current = ch;
    var g = store.games[ch];
    if (g && g.id && !g.completed) {
      game = g;
      selected = -1;
      paused = false;
      persistGame();
      render();
      startTimer();
      toast('已翻到「' + C(ch).name + '」' + stageText(g.stage) + '的書籤');
    } else {
      loadStage(ch, nextStage(ch));
    }
  }

  function switchStage(s) {
    var ch = store.current;
    Sound.click();
    if (!isStageUnlocked(ch, s)) { toast('先通過' + stageText(s - 1) + '，才能挑戰' + stageText(s)); return; }
    if (game && game.ch === ch && game.stage === s && !game.completed) return;
    if (hasProgress(game)) {
      confirmModal('前往' + stageText(s) + '？', '目前' + stageText(game.stage) + '的進度將會消失喔！', '前往', function () { loadStage(ch, s); });
    } else {
      loadStage(ch, s);
    }
  }

  function requestRestart() {
    if (!game) return;
    if (hasProgress(game)) {
      confirmModal('重來這一關？', '盤面、時間與提示次數都會重新開始。', '重來', restartStage);
    } else {
      restartStage();
    }
  }

  /* ---------------- 過關 & 獎勵 ---------------- */

  function rewardById(id) { return REWARDS.filter(function (r) { return r.id === id; })[0]; }
  function isUnlocked(r) { return isStageCleared(r.ch, r.stage); }
  function rewardName(r) { return C(r.ch).cat.name + '・' + pad2(r.stage); }
  function playReward(r) { Sound.meow(CONFIG.mediaFor(r).sounds, r.pitch); }

  function checkWin() {
    if (!game || game.completed || game.failed) return;
    for (var i = 0; i < 81; i++) if (game.values[i] !== game.solution[i]) return;
    stopTimer();
    if (game.timeLimitMs && game.elapsedMs >= game.timeLimitMs) { if (!game.failed) timeUp(); return; }
    if (game.failed) return;
    game.completed = true;
    selected = -1;
    var ch = game.ch, s = game.stage;
    var firstClear = !isStageCleared(ch, s);
    if (firstClear) clearedList(ch).push(s);
    progress.wins = (progress.wins || 0) + 1;
    var prevBest = progress.best[game.id];
    var isBest = !prevBest || game.elapsedMs < prevBest;
    if (isBest) progress.best[game.id] = game.elapsedMs;
    var reward = firstClear ? rewardById(game.id) : null;
    var chapterDone = firstClear && isChapterDone(ch);
    var nextCh = chapterDone && ch < CHS.length ? ch + 1 : 0;
    var ultimate = chapterDone && allDone();
    if (ultimate) progress.ultimate = true;
    persistProgress();
    persistGame();
    render();
    setTimeout(function () { celebrate(reward, isBest, chapterDone, nextCh, ultimate); }, 350);
  }

  function celebrate(reward, isBest, chapterDone, nextCh, ultimate) {
    Sound.win();
    if (reward) setTimeout(function () { playReward(reward); }, 900);
    confetti();
    var g = game, c = C(g.ch);
    var msgs = CONFIG.sweetMessages;
    var sweet = personalize(msgs[Math.floor(Math.random() * msgs.length)]);
    var allow = hintsAllowed(g);
    var html = '<p class="modal-kicker">' + esc(chName(g.ch)) + '</p>' +
      '<h2 class="modal-title">' + (chapterDone ? esc(c.name) + '・完' : stageText(g.stage) + '・過關') + '</h2>' +
      '<div class="ornament">— ✦ —</div>' +
      '<p class="sweet">' + esc(sweet) + '<small>— 愛妳的' + esc(CONFIG.fromName) + '</small></p>' +
      '<div class="result-stats"><span>時間 <b>' + fmtTime(g.elapsedMs) + '</b>' + (isBest ? ' <i class="best">（新紀錄）</i>' : '') + '</span>' +
      (g.timeLimitMs ? '<span>時限 <b>' + fmtTime(g.timeLimitMs) + '</b> 內完成</span>' : '') +
      '<span>失誤 <b>' + g.mistakes + '</b></span>' +
      '<span>提示 <b>' + (allow ? g.hints + '/' + allow : '—') + '</b></span></div>';
    if (reward) {
      var n = clearedList(g.ch).length;
      html += '<h3 class="unlock-title">獲得 ' + esc(c.cat.name) + ' 的寫真＋叫聲</h3><div class="unlock-list">' +
        '<div class="unlock-item">' + catArt(reward, 'photo') + '<b>' + esc(rewardName(reward)) + '</b>' +
        '<small>「' + esc(c.name) + '」打氣叫聲 ' + n + ' 種</small></div></div>';
    } else {
      html += '<p class="next-goal">這一關的寫真與叫聲已經收藏過了</p>';
    }
    if (nextCh) html += '<div class="chapter-unlocked">已解鎖 ' + esc(chName(nextCh)) + '</div>';
    if (ultimate) html += '<div class="chapter-unlocked">喵南西北全部制霸！終極獎勵已開啟</div>';
    var primary;
    if (ultimate) primary = '<button class="btn primary" data-act="ultimate">打開終極獎勵</button>';
    else if (nextCh) primary = '<button class="btn primary" data-act="nextch">前往' + esc(C(nextCh).label) + '</button>';
    else if (g.stage < c.stages) primary = '<button class="btn primary" data-act="next">下一關</button>';
    else primary = '<button class="btn primary" data-act="again">再玩一次</button>';
    html += '<div class="modal-actions"><button class="btn ghost" data-act="gallery">收藏</button>' + primary + '</div>';
    openModal(html, function (act) {
      closeModal();
      if (act === 'gallery') showView('gallery');
      if (act === 'ultimate') openUltimate();
      if (act === 'nextch') switchChapter(nextCh);
      if (act === 'next') loadStage(g.ch, g.stage + 1);
      if (act === 'again') loadStage(g.ch, g.stage);
    });
  }

  function openUltimate() {
    var u = CONFIG.ultimateReward || {};
    var art = '<div class="cat-art photo ultimate-art detail-art"><span class="cat-emoji">🏆</span><span class="cat-tag">終極獎勵預留</span>' +
      (u.photo ? '<img src="' + esc(u.photo) + '" alt="" onerror="this.remove()">' : '') + '</div>';
    Sound.win();
    if (u.sound) setTimeout(function () { Sound.meow([u.sound], 1); }, 700);
    openModal('<p class="modal-kicker">喵南西北・全卷完</p>' + art +
      '<h2 class="modal-title">' + esc(u.title || '終極獎勵') + '</h2>' +
      '<p class="story">' + esc(personalize(u.message || '')) + '</p>' +
      '<div class="modal-actions"><button class="btn primary" data-act="close">闔上</button></div>', function () { closeModal(); });
  }

  /* ---------------- 貓貓打氣 ---------------- */

  var lastCheer = {};

  function buildCheer() {
    $('cheerBtns').innerHTML = CHS.map(function (c, idx) {
      return '<button class="cheer-btn" data-cheer="' + (idx + 1) + '"><span class="ico"></span>' + esc(c.name) + ' <small></small></button>';
    }).join('');
  }

  function renderCheer() {
    var btns = document.querySelectorAll('.cheer-btn');
    for (var k = 0; k < btns.length; k++) {
      var ch = +btns[k].dataset.cheer;
      var got = clearedList(ch).length;
      btns[k].classList.toggle('locked', got === 0);
      btns[k].querySelector('.ico').innerHTML = got ? ICONS.sound : ICONS.lock;
      btns[k].querySelector('small').textContent = got + '/' + C(ch).stages;
    }
  }

  function cheer(ch, btn) {
    var list = REWARDS.filter(function (r) { return r.ch === ch && isUnlocked(r); });
    if (!list.length) {
      Sound.click();
      toast('通過「' + C(ch).name + '」' + stageText(1) + '，即可解鎖' + C(ch).cat.name + '的打氣叫聲');
      return;
    }
    var pool = list.length > 1 ? list.filter(function (r) { return r.id !== lastCheer[ch]; }) : list;
    var r = pool[Math.floor(Math.random() * pool.length)];
    lastCheer[ch] = r.id;
    playReward(r);
    toast(C(ch).cat.name + ' 為妳打氣！（第 ' + r.stage + ' 聲・共 ' + list.length + ' 種）');
    btn.classList.remove('ringing');
    void btn.offsetWidth;
    btn.classList.add('ringing');
    setTimeout(function () { btn.classList.remove('ringing'); }, 520);
  }

  /* ---------------- 貓咪收藏 ---------------- */

  window.__catImgNext = function (img) {
    var list = JSON.parse(img.getAttribute('data-srcs') || '[]');
    var i = +(img.getAttribute('data-i') || 0) + 1;
    if (i < list.length) { img.setAttribute('data-i', i); img.src = list[i]; }
    else img.remove();
  };

  function catArt(r, mode, extraCls) {
    var cat = C(r.ch).cat;
    var cls = 'cat-art ' + (mode === 'shadow' ? 'shadow' : 'photo') + (extraCls ? ' ' + extraCls : '');
    var inner = '<span class="cat-emoji">' + cat.emoji + '</span>';
    if (mode !== 'shadow') {
      var photos = CONFIG.mediaFor(r).photos;
      inner += '<span class="cat-tag">寫真預留</span>' +
        '<img src="' + esc(photos[0]) + '" data-srcs="' + esc(JSON.stringify(photos)) + '" alt="' + esc(rewardName(r)) + '" onerror="__catImgNext(this)">';
    }
    inner += '<span class="cat-no">' + pad2(r.stage) + '</span>';
    if (extraCls === 'locked') inner += '<span class="cat-q">?</span>';
    return '<div class="' + cls + '" style="--c:' + esc(cat.color || '#ddd6c8') + '">' + inner + '</div>';
  }

  function modeFor(r) {
    return cardMode[r.id] || (settings.galleryPhoto ? 'photo' : 'shadow');
  }

  function renderGallery() {
    var unlockedCount = REWARDS.filter(isUnlocked).length;
    $('galleryProgress').textContent = '已收集 ' + unlockedCount + ' / ' + REWARDS.length + '（每關一張寫真＋一段叫聲）';
    $('galleryBar').style.width = (unlockedCount / REWARDS.length * 100) + '%';
    $('galleryModeBtn').textContent = settings.galleryPhoto ? '全部切換成：貓咪影子' : '全部切換成：彩色寫真';
    var html = CHS.map(function (c, idx) {
      var ch = idx + 1;
      var list = REWARDS.filter(function (r) { return r.ch === ch; });
      var got = list.filter(isUnlocked).length;
      var head = '<div class="chapter-head"><h3>' + esc(c.label) + '<small>' + esc(c.name) + '・' + esc(c.cat.name) + '</small></h3><span>' + got + ' / ' + list.length + '</span></div>';
      var note = isChapterUnlocked(ch) ? '' : '<p class="chapter-note">完成「' + esc(C(ch - 1).name) + '」全部關卡後翻開本章</p>';
      var cards = list.map(function (r) {
        if (!isUnlocked(r)) {
          return '<button class="cat-card locked" data-id="' + r.id + '">' + catArt(r, 'shadow', 'locked') +
            '<div class="cat-sub">通過' + stageText(r.stage) + '</div></button>';
        }
        var mode = modeFor(r);
        var isNew = progress.seen.indexOf(r.id) < 0;
        return '<button class="cat-card' + (isNew ? ' new' : '') + '" data-id="' + r.id + '">' + catArt(r, mode) +
          '<div class="slots"><span class="slot" data-toggle="' + r.id + '" aria-label="切換寫真/影子">' + ICONS.photo + '</span>' +
          '<span class="slot" data-play="' + r.id + '" aria-label="播放叫聲">' + ICONS.sound + '</span></div></button>';
      }).join('');
      return '<section class="chapter">' + head + note + '<div class="gallery-grid">' + cards + '</div></section>';
    }).join('');
    var done = allDone();
    html += '<section class="chapter"><div class="chapter-head"><h3>終極獎勵<small>全部通關後開啟</small></h3><span>' + (done ? '已開啟' : '未開啟') + '</span></div>' +
      '<button class="ultimate-card' + (done ? '' : ' locked') + '" data-ultimate="1">' +
      (done ? '🏆 打開終極獎勵' : ICONS.lock + ' 完成四章全部 ' + REWARDS.length + ' 關後開啟') + '</button></section>';
    $('gallery').innerHTML = html;
  }

  function markSeen(r) {
    if (progress.seen.indexOf(r.id) < 0) { progress.seen.push(r.id); persistProgress(); }
  }

  function onGalleryClick(e) {
    if (e.target.closest('[data-ultimate]')) {
      Sound.click();
      if (allDone()) openUltimate(); else toast('完成四章全部關卡，終極獎勵就會開啟');
      return;
    }
    var card = e.target.closest('.cat-card');
    if (!card) return;
    var r = rewardById(card.dataset.id);
    if (!r) return;
    if (card.classList.contains('locked')) {
      Sound.click();
      toast('通過「' + C(r.ch).name + '」' + stageText(r.stage) + '即可解鎖');
      return;
    }
    if (e.target.closest('[data-toggle]')) {
      cardMode[r.id] = modeFor(r) === 'shadow' ? 'photo' : 'shadow';
      Sound.click();
      renderGallery();
      return;
    }
    playReward(r);
    markSeen(r);
    if (e.target.closest('[data-play]')) { renderGallery(); renderTabs(); return; }
    openCatDetail(r);
  }

  function openCatDetail(r) {
    var mode = modeFor(r);
    var cat = C(r.ch).cat;
    function html() {
      return '<p class="modal-kicker">' + esc(chName(r.ch)) + '・' + stageText(r.stage) + '</p>' +
        catArt(r, mode, 'detail-art') +
        '<h2 class="modal-title">' + esc(rewardName(r)) + '</h2>' +
        '<p class="story">' + esc(r.caption || cat.story || '') + '</p>' +
        '<div class="modal-actions">' +
        '<button class="btn ghost" data-act="mode">' + (mode === 'shadow' ? '彩色寫真' : '貓咪影子') + '</button>' +
        '<button class="btn ghost" data-act="meow">播放叫聲</button>' +
        '<button class="btn primary" data-act="close">闔上</button></div>';
    }
    openModal(html(), function handler(act) {
      if (act === 'mode') {
        mode = mode === 'shadow' ? 'photo' : 'shadow';
        cardMode[r.id] = mode;
        Sound.click();
        openModal(html(), handler);
        renderGallery();
      }
      if (act === 'meow') playReward(r);
      if (act === 'close') closeModal();
    });
    renderGallery();
    renderTabs();
  }

  /* ---------------- 設定 ---------------- */

  function renderSettings() {
    $('setSound').checked = settings.sound;
    $('setErrorCheck').checked = settings.errorCheck;
    $('setHighlight').checked = settings.highlight;
    $('setAutoNotes').checked = settings.autoNotes;
    var rows = CHS.map(function (c, idx) {
      var ch = idx + 1;
      var timed = Object.keys(c.timeLimits || {}).map(function (s) { return stageText(+s) + ' ' + c.timeLimits[s] + ' 分'; }).join('、');
      return '<div class="stat-card"><b>' + esc(chName(ch)) + '</b><small>' + esc(c.desc) + (isChapterUnlocked(ch) ? '' : '・未解鎖') + '</small>' +
        '<span>過關 ' + clearedList(ch).length + ' / ' + c.stages + '</span>' +
        '<span>提示 ' + (c.hints ? '每關 ' + c.hints + ' 次' : '不能用') + '</span>' +
        (timed ? '<span>限時 ' + esc(timed) + '</span>' : '') + '</div>';
    });
    rows.push('<div class="stat-card"><b>總計</b><small>全部章節</small><span>過關 ' + (progress.wins || 0) + ' 次</span>' +
      '<span>超時 ' + (progress.fails || 0) + ' 次</span>' +
      '<span>收藏 ' + REWARDS.filter(isUnlocked).length + ' / ' + REWARDS.length + '</span></div>');
    $('statsList').innerHTML = rows.join('');
  }

  function bindSettings() {
    [['setSound', 'sound'], ['setErrorCheck', 'errorCheck'], ['setHighlight', 'highlight'], ['setAutoNotes', 'autoNotes']]
      .forEach(function (pair) {
        $(pair[0]).addEventListener('change', function (e) {
          settings[pair[1]] = e.target.checked;
          if (pair[1] === 'sound') Sound.setEnabled(settings.sound);
          persistSettings();
          Sound.click();
          render();
        });
      });
    $('resetBtn').addEventListener('click', function () {
      confirmModal('重置所有進度？', '關卡、收藏與存檔都會清空，無法復原。', '確定重置', function () {
        stopTimer();
        progress = freshProgress();
        store = { current: 1, games: {} };
        game = null;
        persistProgress();
        save(KEY_GAMES, store);
        renderSettings();
        toast('已重置');
        loadStage(1, 1);
      });
    });
  }

  /* ---------------- 視圖切換 ---------------- */

  function showView(name) {
    currentView = name;
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.toggle('active', views[i].id === 'view-' + name);
    var tabs = document.querySelectorAll('.tab');
    for (i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.view === name);
    if (name === 'gallery') renderGallery();
    if (name === 'settings') renderSettings();
    if (name === 'game') startTimer(); else stopTimer();
    persistGame();
    window.scrollTo(0, 0);
  }

  /* ---------------- Modal / Toast / Confetti ---------------- */

  var modalHandler = null;
  function openModal(html, handler) {
    $('modalBody').innerHTML = html;
    modalHandler = handler || null;
    $('modal').classList.remove('hidden');
  }
  function closeModal() {
    $('modal').classList.add('hidden');
    modalHandler = null;
  }
  function confirmModal(title, text, okText, onOk) {
    openModal('<h2 class="modal-title">' + esc(title) + '</h2><p class="story">' + esc(text) + '</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="cancel">取消</button>' +
      '<button class="btn primary" data-act="ok">' + esc(okText) + '</button></div>', function (act) {
      closeModal();
      if (act === 'ok') onOk();
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  function confetti() {
    var canvas = $('confetti');
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.style.display = 'block';
    var glyphs = ['🐾', '✦', '✧', '🐾', '❦'];
    var parts = [];
    for (var i = 0; i < 70; i++) {
      parts.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
        vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2,
        r: Math.random() * Math.PI, vr: -0.05 + Math.random() * 0.1,
        s: 16 + Math.random() * 18, g: glyphs[i % glyphs.length]
      });
    }
    var start = performance.now();
    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = t > 3000 ? Math.max(0, 1 - (t - 3000) / 800) : 1;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.font = p.s + 'px serif';
        ctx.fillStyle = '#1d1d1b';
        ctx.fillText(p.g, -p.s / 2, p.s / 2);
        ctx.restore();
      });
      if (t < 3800) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); canvas.style.display = 'none'; }
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 事件綁定 ---------------- */

  function bindEvents() {
    $('levelTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.level-tab');
      if (b) switchChapter(+b.dataset.ch);
    });
    $('stageStrip').addEventListener('click', function (e) {
      var b = e.target.closest('.stage');
      if (b) switchStage(+b.dataset.stage);
    });
    $('cheerBtns').addEventListener('click', function (e) {
      var b = e.target.closest('.cheer-btn');
      if (b) cheer(+b.dataset.cheer, b);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { Sound.click(); showView(b.dataset.view); });
    });
    $('undoBtn').addEventListener('click', undo);
    $('eraseBtn').addEventListener('click', erase);
    $('notesBtn').addEventListener('click', toggleNotes);
    $('hintBtn').addEventListener('click', hint);
    $('newBtn').addEventListener('click', requestRestart);
    $('retryBtn').addEventListener('click', restartStage);
    $('pauseBtn').addEventListener('click', function () { Sound.click(); setPaused(!paused); });
    $('resumeBtn').addEventListener('click', function () { setPaused(false); });
    $('gallery').addEventListener('click', onGalleryClick);
    $('galleryModeBtn').addEventListener('click', function () {
      settings.galleryPhoto = !settings.galleryPhoto;
      cardMode = {};
      persistSettings();
      Sound.click();
      renderGallery();
    });
    $('modal').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (btn && modalHandler) { modalHandler(btn.dataset.act); return; }
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (currentView !== 'game' || !$('modal').classList.contains('hidden')) return;
      if (e.key >= '1' && e.key <= '9') { input(+e.key); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { moveSelection(-1, 0); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { moveSelection(1, 0); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { moveSelection(0, -1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { moveSelection(0, 1); e.preventDefault(); }
      else if (e.key === 'n' || e.key === 'N') toggleNotes();
      else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { undo(); e.preventDefault(); }
      else if (e.key === 'h' || e.key === 'H') hint();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopTimer(); persistGame(); }
      else startTimer();
    });
    window.addEventListener('pagehide', function () { stopTimer(); persistGame(); });
  }

  /* ---------------- PWA ---------------- */

  function registerSW() {
    var status = $('offlineStatus');
    if (!('serviceWorker' in navigator)) {
      status.textContent = '此瀏覽器不支援離線模式';
      return;
    }
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      status.textContent = '已完成離線快取，飛航模式也能閱讀';
    }).catch(function () {
      status.textContent = '離線快取註冊失敗（需透過 https 或 localhost 開啟）';
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) toast('已更新，下次開啟即套用新版本');
    });
  }

  /* ---------------- 啟動 ---------------- */

  function init() {
    document.title = CONFIG.appName;
    $('appName').textContent = CONFIG.appName;
    $('poweredBy').textContent = CONFIG.poweredBy;
    $('versionName').textContent = CONFIG.appName;
    $('versionPowered').textContent = CONFIG.poweredBy;
    if (!C(store.current) || !isChapterUnlocked(store.current)) store.current = 1;
    game = store.games[store.current] || null;
    buildLevelTabs();
    buildCheer();
    buildBoard();
    buildNumpad();
    bindEvents();
    bindSettings();
    if (game && game.id && !game.completed) {
      if (!game.hinted) game.hinted = [];
      if (!game.history) game.history = [];
      render();
      startTimer();
    } else {
      loadStage(store.current, nextStage(store.current));
    }
    registerSW();
  }

  init();
})();
