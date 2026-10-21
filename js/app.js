(function () {
  'use strict';

  var S = window.CatSudoku;
  var Sound = window.CatSound;
  var CONFIG = window.CAT_SUDOKU_CONFIG;
  var STAGES = window.CAT_SUDOKU_STAGES || {};
  var REWARDS = CONFIG.rewards;
  var CHS = CONFIG.chapters;
  var MODES = CONFIG.modes;
  var CHAOS_MS = (CONFIG.chaosEveryMin || 2) * 60000;
  var PHOTOS = REWARDS.filter(function (r) { return r.kind === 'photo'; });
  var SOUNDS = REWARDS.filter(function (r) { return r.kind === 'sound'; });
  var ICONS = {
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="12" cy="12" r="3.5"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
    gun: '<svg viewBox="0 0 24 24"><path d="M2 7h17l2 2v3h-8l-1.5 2.5H9L8 21H3.5l1.5-9H2z"/><path d="M10.5 12v2.5"/><path d="M19 7V5"/></svg>'
  };

  var KEY_GAMES = 'catSudoku.games.v3';
  var KEY_PROGRESS = 'catSudoku.progress.v3';
  var OLD_PROGRESS = 'catSudoku.progress.v2';
  var KEY_SETTINGS = 'catSudoku.settings.v1';
  var MAX_HISTORY = 100;
  // 測試模式：只在 Devin 預覽網址或網址加 ?test=1 時出現（?test=0 關閉），正式網址預設看不到
  var TEST_MODE = (function () {
    try {
      var q = location.search;
      if (/[?&]test=0/.test(q)) sessionStorage.removeItem('catSudoku.test');
      else if (/[?&]test=1/.test(q) || /\.preview\.devinapps\.com$/.test(location.hostname)) sessionStorage.setItem('catSudoku.test', '1');
      return sessionStorage.getItem('catSudoku.test') === '1';
    } catch (e) { return false; }
  })();
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
  function M(lv) { return MODES[lv - 1]; }
  function lvName(lv) { return 'Lv.' + lv + ' ' + M(lv).name; }
  function chName(ch) { return C(ch).label + '・' + C(ch).name; }
  function ck(lv, ch) { return lv + '-' + ch; }
  function stageId(ch, s, lv) { return 'L' + (lv || store.lv) + '-' + C(ch).key + '-' + pad2(s); }
  function poolId(ch, s) { return C(ch).key + '-' + pad2(s); }
  function lvStages() { return CHS.reduce(function (n, c) { return n + c.stages; }, 0); }
  function stageText(s) { return '第' + (NUM_TEXT[s] || s) + '關'; }
  function limitMs(ch, s) { var m = (C(ch).timeLimits || {})[s]; return m ? m * 60000 : 0; }

  /* ---------------- 狀態 ---------------- */

  function freshProgress() { return { cleared: {}, best: {}, seen: [], wins: 0, fails: 0, rulesSeen: [], gun: false }; }
  // 舊版（四章 15 關）進度：前 10 關（鴻小兵前 3 關）轉成 Lv.1
  function migrateProgress() {
    var old = load(OLD_PROGRESS, null), p = freshProgress();
    if (!old || !old.cleared) return p;
    CHS.forEach(function (c, idx) {
      var list = (old.cleared[idx + 1] || []).filter(function (s) { return s <= c.stages; });
      if (list.length) p.cleared[ck(1, idx + 1)] = list;
      for (var s = 1; s <= c.stages; s++) {
        var b = (old.best || {})[c.key + '-' + pad2(s)];
        if (b != null) p.best['L1-' + c.key + '-' + pad2(s)] = b;
      }
    });
    p.wins = old.wins || 0;
    p.fails = old.fails || 0;
    return p;
  }
  var settings = Object.assign({ sound: true, errorCheck: true, highlight: true, autoNotes: true, galleryPhoto: true },
    load(KEY_SETTINGS, {}));
  var progress = Object.assign(freshProgress(), load(KEY_PROGRESS, null) || migrateProgress());
  var store = Object.assign({ lv: 1, current: 1, games: {} }, load(KEY_GAMES, {}));
  var game = null;

  var selected = -1;
  var noteMode = false;
  var paused = false;
  var countdownId = null;
  var timerId = null;
  var lastTick = 0;
  var tickCount = 0;
  var currentView = 'game';
  var cardMode = {};
  var cells = [];
  var numButtons = [];

  Sound.setEnabled(settings.sound);

  function persistGame() {
    if (game) {
      if (game.timeLimitMs && inPlay(game)) game.savedAt = Date.now();
      store.games[ck(game.lv, game.ch)] = game;
    }
    save(KEY_GAMES, store);
  }
  function persistProgress() { save(KEY_PROGRESS, progress); }
  function persistSettings() { save(KEY_SETTINGS, settings); }

  function clearedList(ch, lv) {
    var k = ck(lv || store.lv, ch);
    return progress.cleared[k] || (progress.cleared[k] = []);
  }
  function isStageCleared(ch, s, lv) { return clearedList(ch, lv).indexOf(s) >= 0; }
  function isChapterDone(ch, lv) {
    for (var s = 1; s <= C(ch).stages; s++) if (!isStageCleared(ch, s, lv)) return false;
    return true;
  }
  function isLvDone(lv) { return CHS.every(function (c, i) { return isChapterDone(i + 1, lv); }); }
  function isLvUnlocked(lv) { return lv === 1 || isLvDone(lv - 1); }
  function isChapterUnlocked(ch, lv) {
    lv = lv || store.lv;
    return isLvUnlocked(lv) && (ch === 1 || isChapterDone(ch - 1, lv));
  }
  function isStageUnlocked(ch, s, lv) { return isChapterUnlocked(ch, lv) && (s === 1 || isStageCleared(ch, s - 1, lv)); }
  function nextStage(ch, lv) {
    for (var s = 1; s <= C(ch).stages; s++) if (!isStageCleared(ch, s, lv)) return s;
    return C(ch).stages;
  }
  function hasGun() { return !!progress.gun || isLvDone(1); }
  function hintsAllowed(g) { return C(g.ch).hints || 0; }
  function isFrozen() { return !game || game.completed || game.failed || paused || !game.started; }
  function isReady(g) { return !!g && !g.completed && !g.failed && !g.started; }
  function inPlay(g) { return !!g && !g.completed && !g.failed && !!g.started; }

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
      if (c.el.className.replace(/ (pop|shake|moved|eaten)/g, '') !== cls) {
        var keep = c.el.className.match(/ (pop|shake|moved|eaten)/g);
        c.el.className = cls + (keep ? keep.join('') : '');
      }
      var txt = v ? String(v) : '';
      if (c.v.textContent !== txt) c.v.textContent = txt;
      var sc = game.scales ? game.scales[i] : 1;
      var tf = sc !== 1 ? 'scale(' + sc + ')' : '';
      if (c.v.style.transform !== tf) c.v.style.transform = tf;
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
    $('levelLabel').textContent = 'Lv.' + game.lv + '・' + chName(game.ch) + '・' + stageText(game.stage) + ' / ' + C(game.ch).stages;
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
    $('testBar').classList.toggle('hidden', !TEST_MODE);
    $('pauseOverlay').classList.toggle('hidden', !paused || !inPlay(game));
    renderReady();
    $('failOverlay').classList.toggle('hidden', !game.failed);
    if (game.failed) $('failText').textContent = '這一關要在 ' + fmtTime(game.timeLimitMs) + ' 內完成，再挑戰一次吧！';
    $('board').classList.toggle('blur', paused || !!game.failed || isReady(game));
    $('pauseBtn').innerHTML = paused ? ICONS.play : ICONS.pause;
    $('pauseBtn').classList.toggle('disabled', !inPlay(game) || !!game.timeLimitMs);
  }

  function renderReady() {
    var ready = isReady(game);
    $('readyOverlay').classList.toggle('hidden', !ready);
    $('readyOverlay').classList.toggle('counting', ready && !!countdownId);
    if (!ready) return;
    var c = C(game.ch), best = progress.best[game.id];
    $('readyKicker').textContent = 'Lv.' + game.lv + '・' + chName(game.ch) + '・' + stageText(game.stage) + ' / ' + c.stages;
    var replay = isStageCleared(game.ch, game.stage) ? '重玩・' : '';
    $('readyTitle').textContent = replay + (game.timeLimitMs ? '限時挑戰' : '準備好了嗎？');
    $('readyInfo').innerHTML =
      '<li>挖空 ' + game.holes + ' 格・' + esc(GRADE_TEXT[game.grade] || '') + '</li>' +
      '<li>' + (c.hints ? '提示 ' + c.hints + ' 次' : '不能使用提示') + '</li>' +
      '<li' + (game.timeLimitMs ? ' class="warn"' : '') + '>' + (game.timeLimitMs ? '限時 ' + fmtTime(game.timeLimitMs) + ' 內完成' : '不限時') + '</li>' +
      (best != null ? '<li>最佳紀錄 ' + fmtTime(best) + '</li>' : '');
    $('startBtn').textContent = game.timeLimitMs ? '開始倒數' : '開始';
  }

  function cancelCountdown() {
    if (countdownId) { clearInterval(countdownId); countdownId = null; }
    if (game) render();
  }
  function beginGame() {
    if (!isReady(game) || countdownId) return;
    Sound.click();
    var go = function () {
      countdownId = null;
      game.started = true;
      paused = false;
      persistGame();
      render();
      startTimer();
    };
    if (!game.timeLimitMs) { go(); return; }
    var n = 3;
    var show = function () { $('countdown').textContent = n > 0 ? n : '開始！'; };
    countdownId = setInterval(function () {
      n--;
      if (n < 0) { clearInterval(countdownId); go(); return; }
      show();
      if (n > 0) Sound.note(); else Sound.correct();
    }, 800);
    show();
    Sound.note();
    render();
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
    var cl = $('chaosLabel'), on = game.lv > 1 && !game.completed && !game.failed;
    cl.classList.toggle('hidden', !on);
    if (on) cl.textContent = M(game.lv).name + ' ' + fmtTime(Math.max(0, game.chaosAt - game.elapsedMs));
  }

  function buildLvTabs() {
    $('lvTabs').innerHTML = MODES.map(function (m) {
      return '<button class="lv-tab" data-lv="' + m.lv + '"><small>Lv.' + m.lv + '</small><b>' + esc(m.name) + '</b>' +
        '<span class="lock">' + ICONS.lock + '</span></button>';
    }).join('') + '<button id="rulesBtn" class="lv-rules">規則</button>';
  }

  function buildLevelTabs() {
    $('levelTabs').innerHTML = CHS.map(function (c, idx) {
      return '<button class="level-tab" data-ch="' + (idx + 1) + '" role="tab"><small>' + esc(c.label) + '</small>' +
        '<b>' + esc(c.name) + '</b><small>' + esc(c.desc) + '</small><span class="lock">' + ICONS.lock + '</span></button>';
    }).join('');
  }

  function renderTabs() {
    var lts = document.querySelectorAll('.lv-tab');
    for (var l = 0; l < lts.length; l++) {
      var lv = +lts[l].dataset.lv, un = isLvUnlocked(lv);
      lts[l].classList.toggle('active', lv === store.lv);
      lts[l].classList.toggle('locked', !un);
      lts[l].classList.toggle('done', isLvDone(lv));
      lts[l].querySelector('.lock').classList.toggle('hidden', un);
    }
    $('gunBtn').classList.toggle('hidden', !(hasGun() && store.lv > 1));
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
      (Object.keys(c.timeLimits || {}).length ? '・「限」為限時關' : '') + (got ? '・已過關卡可點選重玩' : '');
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
    if (isFrozen()) return;
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
    if (isFrozen() || document.hidden || (currentView !== 'game' && !game.timeLimitMs)) return;
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
    if (game.lv > 1 && game.elapsedMs >= game.chaosAt) chaos();
    if (++tickCount % 5 === 0) persistGame();
  }

  /* ---------------- 搗亂（Lv.2～4） ---------------- */

  function replaceHinted(from, to) {
    var k = game.hinted.indexOf(from);
    if (k < 0) return;
    if (to >= 0) game.hinted[k] = to; else game.hinted.splice(k, 1);
  }

  function chaos() {
    game.chaosAt = (Math.floor(game.elapsedMs / CHAOS_MS) + 1) * CHAOS_MS;
    var eff = M(game.lv).effect, msg = '', hit = -1, mine = [];
    for (var i = 0; i < 81; i++) if (!game.puzzle[i] && game.values[i]) mine.push(i);
    if (eff === 'size') {
      var sizes = [0.45, 0.55, 0.65, 1.35, 1.5, 1.7];
      game.scales = game.values.map(function () { return sizes[Math.floor(Math.random() * sizes.length)]; });
      msg = '肥肥臭指北把數字變得忽大忽小！';
    } else if (eff === 'shift') {
      var moves = [];
      mine.forEach(function (from) {
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
          for (var k = 1; k <= 3; k++) {
            var r = S.ROW[from] + d[0] * k, c = S.COL[from] + d[1] * k;
            if (r < 0 || r > 8 || c < 0 || c > 8) break;
            var to = r * 9 + c;
            if (!game.puzzle[to] && !game.values[to]) moves.push([from, to, k]);
          }
        });
      });
      if (moves.length) {
        var mv = moves[Math.floor(Math.random() * moves.length)];
        game.values[mv[1]] = game.values[mv[0]];
        game.values[mv[0]] = 0;
        game.notes[mv[1]] = 0;
        replaceHinted(mv[0], mv[1]);
        hit = mv[1];
        msg = '指西作亂！把一個數字推走了 ' + mv[2] + ' 格';
      }
    } else if (eff === 'eat' && mine.length) {
      hit = mine[Math.floor(Math.random() * mine.length)];
      game.values[hit] = 0;
      replaceHinted(hit, -1);
      msg = '暴食指南貓吃掉了一個數字！';
    }
    if (!msg) return;
    game.history = [];
    Sound.meow(null, eff === 'eat' ? 0.7 : eff === 'size' ? 1.5 : 1);
    toast(msg);
    persistGame();
    render();
    if (hit >= 0) flash(hit, eff === 'eat' ? 'eaten' : 'moved');
    if (eff === 'size') {
      var b = $('board');
      b.classList.remove('wobble');
      void b.offsetWidth;
      b.classList.add('wobble');
    }
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
      '<p class="story">這一關要在 ' + fmtTime(game.timeLimitMs) + ' 內完成才算過關。<br>換一個新盤面再挑戰一次，這次一定可以！</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">稍後</button>' +
      '<button class="btn primary" data-act="retry">重新挑戰</button></div>', function (act) {
      closeModal();
      if (act === 'retry') restartStage();
    });
  }
  function setPaused(v) {
    if (v && game && game.timeLimitMs && inPlay(game)) { toast('限時關不能暫停喔！'); return; }
    if (!inPlay(game)) v = false;
    paused = v;
    if (paused) stopTimer(); else startTimer();
    persistGame();
    render();
  }

  /* ---------------- 測試工具（只在測試模式） ---------------- */

  function testStart() {
    if (!game || game.completed || game.failed) { toast('這一關已經結束，先按「重來」或選下一關'); return false; }
    if (!game.started) { cancelCountdown(); game.started = true; }
    paused = false;
    return true;
  }
  function buildTestJump() {
    if (!TEST_MODE) return;
    $('testLv').innerHTML = MODES.map(function (m) { return '<option value="' + m.lv + '">Lv.' + m.lv + '</option>'; }).join('');
    $('testCh').innerHTML = CHS.map(function (c, i) { return '<option value="' + (i + 1) + '">' + esc(c.name) + '</option>'; }).join('');
    var fillStages = function () {
      var n = C(+$('testCh').value).stages, html = '';
      for (var k = 1; k <= n; k++) html += '<option value="' + k + '">第 ' + k + ' 關' + (limitMs(+$('testCh').value, k) ? '（限）' : '') + '</option>';
      $('testStage').innerHTML = html;
    };
    $('testCh').addEventListener('change', fillStages);
    $('testLv').value = store.lv;
    $('testCh').value = store.current;
    fillStages();
    if (game) $('testStage').value = game.stage;
  }

  // 跳到指定關卡：之前的關卡全部設為通關、之後的清空，讓解鎖與獎勵狀態一致
  function testJump(lv, ch, s) {
    var cleared = {};
    MODES.forEach(function (m) {
      CHS.forEach(function (c, i) {
        var list = [];
        for (var k = 1; k <= c.stages; k++) {
          if (m.lv < lv || (m.lv === lv && (i + 1 < ch || (i + 1 === ch && k < s)))) list.push(k);
        }
        if (list.length) cleared[ck(m.lv, i + 1)] = list;
      });
    });
    progress.cleared = cleared;
    progress.gun = lv > 1;
    persistProgress();
    stopTimer();
    cancelCountdown();
    closeModal();
    if (gun.on) endGun();
    store.lv = lv;
    store.current = ch;
    delete store.games[ck(lv, ch)];
    showView('game');
    loadStage(ch, s);
    toast('已跳到 Lv.' + lv + '・' + C(ch).name + '・' + stageText(s) + '（之前的關卡都設為通關）');
    maybeRules(lv);
  }

  function testAction(act) {
    if (!TEST_MODE) return;
    if (act === 'jump') { testJump(+$('testLv').value, +$('testCh').value, +$('testStage').value); return; }
    if (act === 'win') {
      if (!testStart()) return;
      game.values = game.solution.slice();
      game.notes = new Array(81).fill(0);
      persistGame();
      render();
      checkWin();
    } else if (act === 'chaos') {
      if (!game || game.lv === 1) { toast('Lv.1 沒有搗亂效果，請到 Lv.2～4 測試'); return; }
      if (!inPlay(game)) { toast('先按「開始」再測試搗亂'); return; }
      var eff = M(game.lv).effect, mine = 0;
      for (var i = 0; i < 81; i++) if (!game.puzzle[i] && game.values[i]) mine++;
      if (eff !== 'size' && !mine) { toast('先隨便填幾個數字，才有東西可以' + (eff === 'eat' ? '吃' : '推')); return; }
      chaos();
    } else if (act === 'timeup') {
      if (!game || !game.timeLimitMs) { toast('這一關不是限時關（限時關在關卡列標「限」）'); return; }
      if (!testStart()) return;
      timeUp();
    }
  }

  /* ---------------- 載入關卡 ---------------- */

  function hasProgress(g) {
    if (!g || g.completed || g.failed) return false;
    for (var i = 0; i < 81; i++) if ((g.values[i] && !g.puzzle[i]) || g.notes[i]) return true;
    return false;
  }

  function stagePuzzle(ch, s) {
    var pool = [].concat(STAGES[poolId(ch, s)] || []);
    if (pool.length) {
      var last = game && game.id === stageId(ch, s) ? game.variant : -1;
      var v = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && v === last) v = (v + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
      var pre = pool[v];
      var toArr = function (str) { return str.split('').map(Number); };
      var t = { puzzle: toArr(pre.p), solution: toArr(pre.s) };
      if (typeof S.transform === 'function') t = S.transform(t.puzzle, t.solution);
      return { puzzle: t.puzzle, solution: t.solution, holes: pre.h, grade: pre.g, variant: v };
    }
    var r = S.generate(C(ch).level, { seed: Math.floor(Math.random() * 1e9) });
    return { puzzle: r.puzzle, solution: r.solution, holes: r.holes, grade: r.grade.level };
  }

  function loadStage(ch, s) {
    stopTimer();
    cancelCountdown();
    $('loading').classList.remove('hidden');
    setTimeout(function () {
      var p;
      try {
        p = stagePuzzle(ch, s);
      } catch (e) {
        $('loading').classList.add('hidden');
        toast('翻頁失敗，請重新整理再試一次');
        return;
      }
      game = {
        lv: store.lv, ch: ch, stage: s, id: stageId(ch, s), puzzle: p.puzzle, solution: p.solution,
        values: p.puzzle.slice(), notes: new Array(81).fill(0),
        mistakes: 0, hints: 0, hinted: [], elapsedMs: 0, timeLimitMs: limitMs(ch, s),
        completed: false, failed: false, started: false, history: [], grade: p.grade, holes: p.holes, variant: p.variant,
        chaosAt: CHAOS_MS, scales: null, savedAt: 0, createdAt: Date.now()
      };
      store.current = ch;
      selected = -1;
      noteMode = false;
      paused = false;
      persistGame();
      $('loading').classList.add('hidden');
      render();
    }, 60);
  }

  function restartStage() { if (game) loadStage(game.ch, game.stage); }

  function resumeTimed(g) {
    if (g.savedAt) g.elapsedMs += Math.max(0, Date.now() - g.savedAt);
    g.savedAt = 0;
  }

  function resumeGame(g) {
    game = g;
    selected = -1;
    if (!game.hinted) game.hinted = [];
    if (!game.history) game.history = [];
    if (game.started === undefined) game.started = game.elapsedMs > 0 || hasProgress(game);
    if (game.chaosAt == null) game.chaosAt = CHAOS_MS;
    var timed = inPlay(game) && !!game.timeLimitMs;
    if (timed) resumeTimed(game);
    paused = inPlay(game) && !timed;
    render();
    if (timed) { if (game.elapsedMs >= game.timeLimitMs) timeUp(); else startTimer(); }
  }

  function openChapter(ch) {
    stopTimer();
    cancelCountdown();
    persistGame();
    store.current = ch;
    var g = store.games[ck(store.lv, ch)];
    if (g && g.id && !g.completed) {
      resumeGame(g);
      persistGame();
      toast('已翻到「' + C(ch).name + '」' + stageText(g.stage) + '的書籤');
    } else {
      loadStage(ch, nextStage(ch));
    }
  }

  function switchChapter(ch) {
    Sound.click();
    if (!isChapterUnlocked(ch)) {
      toast('先完成「' + C(ch - 1).name + '」全部 ' + C(ch - 1).stages + ' 關，才能翻開「' + C(ch).name + '」');
      return;
    }
    if (ch === store.current && game) return;
    openChapter(ch);
  }

  function switchLv(lv) {
    Sound.click();
    if (!isLvUnlocked(lv)) {
      toast('先破完 ' + lvName(lv - 1) + ' 全部 ' + lvStages() + ' 關，才能進入 ' + lvName(lv));
      return;
    }
    if (lv === store.lv && game) return;
    stopTimer();
    cancelCountdown();
    persistGame();
    store.lv = lv;
    var ch = 1;
    while (ch < CHS.length && isChapterDone(ch, lv)) ch++;
    openChapter(ch);
    maybeRules(lv);
  }

  function showRules(lv) {
    var m = M(lv);
    openModal('<p class="modal-kicker">Lv.' + lv + '・規則說明</p><h2 class="modal-title">' + esc(m.name) + '</h2>' +
      '<div class="ornament">— ✦ —</div><ol class="rules-list">' +
      m.rules.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
      '<div class="modal-actions"><button class="btn primary" data-act="ok">我知道了</button></div>', function () {
      if (progress.rulesSeen.indexOf(lv) < 0) { progress.rulesSeen.push(lv); persistProgress(); }
      closeModal();
    });
  }
  function maybeRules(lv) { if (progress.rulesSeen.indexOf(lv) < 0) showRules(lv); }

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
  function isUnlocked(r) { return isStageCleared(r.ch, r.stage, r.lv); }
  function rewardName(r) {
    return r.kind === 'sound' ? C(r.ch).cat.name + '叫聲・' + pad2(r.stage) : C(r.ch).cat.name + '・Lv.' + r.lv + '・' + r.n;
  }
  function playReward(r) { Sound.meow(CONFIG.mediaFor(r).sounds, r.pitch); }
  function unlockedSounds(ch) { return SOUNDS.filter(function (r) { return r.ch === ch && isUnlocked(r); }); }

  function checkWin() {
    if (!game || game.completed || game.failed) return;
    for (var i = 0; i < 81; i++) if (game.values[i] !== game.solution[i]) return;
    stopTimer();
    if (game.timeLimitMs && game.elapsedMs >= game.timeLimitMs) { if (!game.failed) timeUp(); return; }
    if (game.failed) return;
    game.completed = true;
    selected = -1;
    var lv = game.lv, ch = game.ch, s = game.stage;
    var firstClear = !isStageCleared(ch, s, lv);
    var hadGun = hasGun();
    if (firstClear) clearedList(ch, lv).push(s);
    progress.wins = (progress.wins || 0) + 1;
    var prevBest = progress.best[game.id];
    var isBest = !prevBest || game.elapsedMs < prevBest;
    if (isBest) progress.best[game.id] = game.elapsedMs;
    var chapterDone = firstClear && isChapterDone(ch, lv);
    var lvDone = chapterDone && isLvDone(lv);
    var o = {
      firstClear: firstClear, isBest: isBest, chapterDone: chapterDone, lvDone: lvDone,
      rewards: firstClear ? REWARDS.filter(function (r) { return r.lv === lv && r.ch === ch && r.stage === s; }) : [],
      nextCh: chapterDone && ch < CHS.length ? ch + 1 : 0,
      nextLv: lvDone && lv < MODES.length ? lv + 1 : 0,
      gunNow: !hadGun && hasGun()
    };
    o.allClear = lvDone && !o.nextLv;
    if (o.gunNow) progress.gun = true;
    persistProgress();
    persistGame();
    render();
    setTimeout(function () { celebrate(o); }, 350);
  }

  function soundArt(r) {
    return '<div class="cat-art photo sound-art" style="--c:' + esc(C(r.ch).cat.color || '#ddd6c8') + '">' + ICONS.sound +
      '<span class="cat-no">' + pad2(r.stage) + '</span></div>';
  }

  function celebrate(o) {
    Sound.win();
    var snd = o.rewards.filter(function (r) { return r.kind === 'sound'; })[0];
    if (snd) setTimeout(function () { playReward(snd); }, 900);
    confetti();
    var g = game, c = C(g.ch);
    var msgs = CONFIG.sweetMessages;
    var sweet = personalize(msgs[Math.floor(Math.random() * msgs.length)]);
    var allow = hintsAllowed(g);
    var title = o.lvDone ? lvName(g.lv) + '・完' : o.chapterDone ? esc(c.name) + '・完' : stageText(g.stage) + '・過關';
    var html = '<p class="modal-kicker">Lv.' + g.lv + '・' + esc(chName(g.ch)) + '</p>' +
      '<h2 class="modal-title">' + title + '</h2>' +
      '<div class="ornament">— ✦ —</div>' +
      '<p class="sweet">' + esc(sweet) + '<small>— ' + esc(CONFIG.fromName) + '</small></p>' +
      '<div class="result-stats"><span>時間 <b>' + fmtTime(g.elapsedMs) + '</b>' + (o.isBest ? ' <i class="best">（新紀錄）</i>' : '') + '</span>' +
      (g.timeLimitMs ? '<span>時限 <b>' + fmtTime(g.timeLimitMs) + '</b> 內完成</span>' : '') +
      '<span>失誤 <b>' + g.mistakes + '</b></span>' +
      '<span>提示 <b>' + (allow ? g.hints + '/' + allow : '—') + '</b></span></div>';
    if (o.rewards.length) {
      html += '<h3 class="unlock-title">獲得 ' + esc(c.cat.name) + ' 的' +
        o.rewards.map(function (r) { return r.kind === 'photo' ? '寫真' : '叫聲'; }).join('＋') + '</h3><div class="unlock-list">' +
        o.rewards.map(function (r) {
          return '<div class="unlock-item">' + (r.kind === 'photo' ? catArt(r, 'photo') : soundArt(r)) + '<b>' + esc(rewardName(r)) + '</b>' +
            (r.kind === 'sound' ? '<small>「' + esc(c.name) + '」打氣叫聲 ' + unlockedSounds(g.ch).length + ' 種</small>' : '') + '</div>';
        }).join('') + '</div>';
    } else if (o.firstClear) {
      html += '<p class="next-goal">再過一關就能得到下一張寫真</p>';
    } else {
      html += '<p class="next-goal">這一關已經通關過了，獎勵都收藏好了</p>';
    }
    if (o.nextCh) html += '<div class="chapter-unlocked">已解鎖 ' + esc(chName(o.nextCh)) + '</div>';
    if (o.nextLv) html += '<div class="chapter-unlocked">已解鎖 ' + esc(lvName(o.nextLv)) + '</div>';
    if (o.gunNow) html += '<div class="chapter-unlocked gun-unlocked">獲得終極大獎：「' + esc(CONFIG.gun.name) + '」</div>';
    if (o.allClear) html += '<div class="chapter-unlocked">喵南西北四個 Lv 全部制霸！</div>';
    var primary;
    if (o.gunNow) primary = '<button class="btn primary" data-act="gun">領取終極大獎</button>';
    else if (o.nextLv) primary = '<button class="btn primary" data-act="nextlv">前往 Lv.' + o.nextLv + '</button>';
    else if (o.nextCh) primary = '<button class="btn primary" data-act="nextch">前往' + esc(C(o.nextCh).label) + '</button>';
    else if (g.stage < c.stages) primary = '<button class="btn primary" data-act="next">下一關</button>';
    else primary = '<button class="btn primary" data-act="again">再玩一次</button>';
    html += '<div class="modal-actions"><button class="btn ghost" data-act="gallery">收藏</button>' + primary + '</div>';
    openModal(html, function (act) {
      closeModal();
      if (act === 'gallery') showView('gallery');
      if (act === 'gun') openGunPrize(o.nextLv);
      if (act === 'nextlv') switchLv(o.nextLv);
      if (act === 'nextch') switchChapter(o.nextCh);
      if (act === 'next') loadStage(g.ch, g.stage + 1);
      if (act === 'again') loadStage(g.ch, g.stage);
    });
  }

  function openGunPrize(nextLv) {
    Sound.win();
    openModal('<p class="modal-kicker">Lv.1 全破・終極大獎</p>' +
      '<div class="cat-art photo detail-art gun-art" style="--c:#e6dfcf">' + ICONS.gun + '</div>' +
      '<h2 class="modal-title">' + esc(CONFIG.gun.name) + '</h2>' +
      '<p class="story">' + esc(personalize(CONFIG.gun.message || '')) + '</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="try">試射一下</button>' +
      (nextLv ? '<button class="btn primary" data-act="nextlv">前往 Lv.' + nextLv + '</button>' :
        '<button class="btn primary" data-act="close">收好</button>') + '</div>', function (act) {
      closeModal();
      if (act === 'try') startGun();
      if (act === 'nextlv') switchLv(nextLv);
    });
  }

  /* ---------------- 終極大獎：老子弄不到槍 ---------------- */

  var gun = { on: false, firing: null, x: 0, y: 0, idle: null };

  function startGun() {
    if (!hasGun() || gun.on) return;
    gun.on = true;
    var layer = $('gunLayer');
    layer.innerHTML = '<p class="gun-tip">「' + esc(CONFIG.gun.name) + '」上膛！<br>點螢幕開槍，按住可以連射</p>';
    layer.classList.remove('hidden', 'fading');
    Sound.click();
    armGunIdle(4000);
  }
  function armGunIdle(ms) {
    clearTimeout(gun.idle);
    gun.idle = setTimeout(endGun, ms);
  }
  function shoot(x, y) {
    var layer = $('gunLayer');
    var size = 18 + Math.random() * 18;
    var h = document.createElement('span');
    h.className = 'hole';
    h.style.cssText = 'left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;width:' + size + 'px;height:' + size +
      'px;transform:rotate(' + Math.floor(Math.random() * 360) + 'deg)';
    layer.appendChild(h);
    var f = document.createElement('span');
    f.className = 'muzzle';
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    layer.appendChild(f);
    setTimeout(function () { f.remove(); }, 90);
    var tip = layer.querySelector('.gun-tip');
    if (tip) tip.remove();
    var holes = layer.querySelectorAll('.hole');
    if (holes.length > 150) holes[0].remove();
    Sound.gun(CONFIG.gun.sounds);
    var app = $('app');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
    if (navigator.vibrate) navigator.vibrate(25);
    armGunIdle(2500);
  }
  function stopFire() {
    if (gun.firing) { clearInterval(gun.firing); gun.firing = null; }
  }
  function endGun() {
    stopFire();
    var layer = $('gunLayer');
    layer.classList.add('fading');
    setTimeout(function () {
      layer.classList.add('hidden');
      layer.classList.remove('fading');
      layer.innerHTML = '';
      $('app').classList.remove('shake');
      gun.on = false;
    }, 1300);
  }
  function bindGun() {
    var layer = $('gunLayer');
    layer.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!gun.on || layer.classList.contains('fading')) return;
      gun.x = e.clientX;
      gun.y = e.clientY;
      shoot(gun.x, gun.y);
      stopFire();
      gun.firing = setInterval(function () {
        shoot(gun.x + (Math.random() - 0.5) * 36, gun.y + (Math.random() - 0.5) * 36);
      }, 110);
    });
    layer.addEventListener('pointermove', function (e) {
      if (gun.firing) { gun.x = e.clientX; gun.y = e.clientY; }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { layer.addEventListener(ev, stopFire); });
    $('gunBtn').addEventListener('click', startGun);
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
      var got = unlockedSounds(ch).length;
      btns[k].classList.toggle('locked', got === 0);
      btns[k].querySelector('.ico').innerHTML = got ? ICONS.sound : ICONS.lock;
      btns[k].querySelector('small').textContent = got + '/' + C(ch).stages;
    }
  }

  function cheer(ch, btn) {
    var list = unlockedSounds(ch);
    if (!list.length) {
      Sound.click();
      toast('通過 Lv.1「' + C(ch).name + '」' + stageText(1) + '，即可解鎖' + C(ch).cat.name + '的打氣叫聲');
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
    inner += '<span class="cat-no">' + (r.kind === 'photo' ? r.n : pad2(r.stage)) + '</span>';
    if (extraCls === 'locked') inner += '<span class="cat-q">?</span>';
    return '<div class="' + cls + '" style="--c:' + esc(cat.color || '#ddd6c8') + '">' + inner + '</div>';
  }

  function modeFor(r) {
    return cardMode[r.id] || (settings.galleryPhoto ? 'photo' : 'shadow');
  }

  function renderGallery() {
    var pGot = PHOTOS.filter(isUnlocked).length, sGot = SOUNDS.filter(isUnlocked).length;
    $('galleryProgress').textContent = '寫真 ' + pGot + ' / ' + PHOTOS.length + '・叫聲 ' + sGot + ' / ' + SOUNDS.length;
    $('galleryBar').style.width = ((pGot + sGot) / REWARDS.length * 100) + '%';
    $('galleryModeBtn').textContent = settings.galleryPhoto ? '全部切換成：貓咪影子' : '全部切換成：彩色寫真';
    var html = MODES.map(function (m) {
      var list = PHOTOS.filter(function (r) { return r.lv === m.lv; });
      var got = list.filter(isUnlocked).length;
      var head = '<div class="chapter-head"><h3>Lv.' + m.lv + '<small>' + esc(m.name) + '・寫真</small></h3><span>' + got + ' / ' + list.length + '</span></div>';
      var note = isLvUnlocked(m.lv) ? '' : '<p class="chapter-note">破完 ' + esc(lvName(m.lv - 1)) + ' 全部關卡後開啟</p>';
      var groups = CHS.map(function (c, idx) {
        var cards = list.filter(function (r) { return r.ch === idx + 1; }).map(function (r) {
          if (!isUnlocked(r)) {
            return '<button class="cat-card locked" data-id="' + r.id + '">' + catArt(r, 'shadow', 'locked') +
              '<div class="cat-sub">通過' + stageText(r.stage) + '</div></button>';
          }
          var isNew = progress.seen.indexOf(r.id) < 0;
          return '<button class="cat-card' + (isNew ? ' new' : '') + '" data-id="' + r.id + '">' + catArt(r, modeFor(r)) +
            '<div class="slots one"><span class="slot" data-toggle="' + r.id + '" aria-label="切換寫真/影子">' + ICONS.photo + '</span></div></button>';
        }).join('');
        return '<p class="sub-head">' + esc(c.label + '・' + c.name) + '</p><div class="gallery-grid">' + cards + '</div>';
      }).join('');
      return '<section class="chapter">' + head + note + groups + '</section>';
    }).join('');
    html += '<section class="chapter"><div class="chapter-head"><h3>叫聲<small>Lv.1 每關一段</small></h3><span>' + sGot + ' / ' + SOUNDS.length + '</span></div>' +
      CHS.map(function (c, idx) {
        return '<p class="sub-head">' + esc(c.label + '・' + c.name) + '</p><div class="sound-grid">' +
          SOUNDS.filter(function (r) { return r.ch === idx + 1; }).map(function (r) {
            var un = isUnlocked(r), isNew = un && progress.seen.indexOf(r.id) < 0;
            return '<button class="sound-chip' + (un ? '' : ' locked') + (isNew ? ' new' : '') + '" data-id="' + r.id + '">' +
              (un ? ICONS.sound : ICONS.lock) + pad2(r.stage) + '</button>';
          }).join('') + '</div>';
      }).join('') + '</section>';
    var g = hasGun();
    html += '<section class="chapter"><div class="chapter-head"><h3>終極大獎<small>Lv.1 全破後取得</small></h3><span>' + (g ? '已取得' : '未取得') + '</span></div>' +
      '<button class="ultimate-card' + (g ? '' : ' locked') + '" data-gun="1">' +
      (g ? ICONS.gun + ' 「' + esc(CONFIG.gun.name) + '」' : ICONS.lock + ' 破完 Lv.1 全部 ' + lvStages() + ' 關後取得') + '</button></section>';
    $('gallery').innerHTML = html;
  }

  function markSeen(r) {
    if (progress.seen.indexOf(r.id) < 0) { progress.seen.push(r.id); persistProgress(); }
  }

  function onGalleryClick(e) {
    if (e.target.closest('[data-gun]')) {
      Sound.click();
      if (hasGun()) openGunPrize(0); else toast('破完 Lv.1 全部 ' + lvStages() + ' 關就能拿到槍');
      return;
    }
    var chip = e.target.closest('.sound-chip');
    if (chip) {
      var sr = rewardById(chip.dataset.id);
      if (!isUnlocked(sr)) { Sound.click(); toast('通過 Lv.1「' + C(sr.ch).name + '」' + stageText(sr.stage) + '即可解鎖'); return; }
      playReward(sr);
      markSeen(sr);
      renderGallery();
      renderTabs();
      return;
    }
    var card = e.target.closest('.cat-card');
    if (!card) return;
    var r = rewardById(card.dataset.id);
    if (!r) return;
    if (card.classList.contains('locked')) {
      Sound.click();
      toast('通過 Lv.' + r.lv + '「' + C(r.ch).name + '」' + stageText(r.stage) + '即可解鎖');
      return;
    }
    if (e.target.closest('[data-toggle]')) {
      cardMode[r.id] = modeFor(r) === 'shadow' ? 'photo' : 'shadow';
      Sound.click();
      renderGallery();
      return;
    }
    Sound.click();
    markSeen(r);
    openCatDetail(r);
  }

  function openCatDetail(r) {
    var mode = modeFor(r);
    var cat = C(r.ch).cat;
    function html() {
      return '<p class="modal-kicker">Lv.' + r.lv + '・' + esc(chName(r.ch)) + '・第 ' + r.n + ' 張</p>' +
        catArt(r, mode, 'detail-art') +
        '<h2 class="modal-title">' + esc(rewardName(r)) + '</h2>' +
        (r.caption || cat.story ? '<p class="story">' + esc(r.caption || cat.story) + '</p>' : '') +
        '<div class="modal-actions">' +
        '<button class="btn ghost" data-act="mode">' + (mode === 'shadow' ? '彩色寫真' : '貓咪影子') + '</button>' +
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
    var rows = MODES.map(function (m) {
      var got = CHS.reduce(function (n, c, idx) { return n + clearedList(idx + 1, m.lv).length; }, 0);
      var ps = PHOTOS.filter(function (r) { return r.lv === m.lv; });
      return '<div class="stat-card"><b>' + esc(lvName(m.lv)) + '</b><small>' +
        (isLvUnlocked(m.lv) ? (m.effect ? '每 ' + (CONFIG.chaosEveryMin || 2) + ' 分鐘搗亂一次' : '一般玩法') : '未解鎖') + '</small>' +
        '<span>過關 ' + got + ' / ' + lvStages() + '</span>' +
        '<span>寫真 ' + ps.filter(isUnlocked).length + ' / ' + ps.length + '</span></div>';
    });
    rows.push('<div class="stat-card"><b>章節規則</b><small>每個 Lv 都一樣</small>' +
      CHS.map(function (c) {
        var t = Object.keys(c.timeLimits || {}).map(function (s) { return '第' + s + '關 ' + c.timeLimits[s] + '分'; }).join('、');
        return '<span>' + esc(c.name) + '：' + c.stages + ' 關・提示 ' + (c.hints || '禁') + (t ? '・限時 ' + esc(t) : '') + '</span>';
      }).join('') + '</div>');
    rows.push('<div class="stat-card"><b>總計</b><small>全部 Lv</small><span>過關 ' + (progress.wins || 0) + ' 次</span>' +
      '<span>超時 ' + (progress.fails || 0) + ' 次</span>' +
      '<span>叫聲 ' + SOUNDS.filter(isUnlocked).length + ' / ' + SOUNDS.length + '</span>' +
      '<span>終極大獎 ' + (hasGun() ? '已取得' : '未取得') + '</span></div>');
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
        store = { lv: 1, current: 1, games: {} };
        game = null;
        persistProgress();
        save(KEY_GAMES, store);
        renderSettings();
        toast('已重置');
        loadStage(1, 1);
        maybeRules(1);
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
    if (name === 'game') startTimer();
    else {
      if (!(game && game.timeLimitMs && inPlay(game))) stopTimer();
      cancelCountdown();
    }
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
    $('lvTabs').addEventListener('click', function (e) {
      if (e.target.closest('#rulesBtn')) { Sound.click(); showRules(store.lv); return; }
      var b = e.target.closest('.lv-tab');
      if (b) switchLv(+b.dataset.lv);
    });
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
    $('startBtn').addEventListener('click', beginGame);
    $('testBar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-test]');
      if (b) testAction(b.dataset.test);
    });
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
      if (currentView !== 'game' || !$('modal').classList.contains('hidden') || gun.on) return;
      if (isReady(game)) { if (e.key === 'Enter' || e.key === ' ') { beginGame(); e.preventDefault(); } return; }
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
      if (document.hidden) {
        cancelCountdown();
        if (inPlay(game) && !game.timeLimitMs) { paused = true; render(); }
        stopTimer();
        persistGame();
      } else if (inPlay(game) && game.timeLimitMs) {
        resumeTimed(game);
        if (game.elapsedMs >= game.timeLimitMs) timeUp(); else startTimer();
      }
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
    var controller = navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      status.textContent = '已完成離線快取，飛航模式也能閱讀';
    }).catch(function () {
      status.textContent = '離線快取註冊失敗（需透過 https 或 localhost 開啟）';
    });
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var hadController = !!controller;
      controller = navigator.serviceWorker.controller;
      if (!hadController || reloading) return;
      reloading = true;
      persistGame();
      location.reload();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg) reg.update();
      }).catch(function () {});
    });
  }

  /* ---------------- 啟動 ---------------- */

  function init() {
    document.title = CONFIG.appName;
    $('appName').textContent = CONFIG.appName;
    $('poweredBy').textContent = CONFIG.poweredBy;
    $('versionName').textContent = CONFIG.appName;
    $('versionPowered').textContent = CONFIG.poweredBy;
    var poolSize = Object.keys(STAGES).reduce(function (n, k) { return n + [].concat(STAGES[k]).length; }, 0);
    $('appVersion').textContent = 'v2.0.0・題庫 ' + poolSize + ' 題';
    if (!M(store.lv) || !isLvUnlocked(store.lv)) store.lv = 1;
    if (!C(store.current) || !isChapterUnlocked(store.current)) store.current = 1;
    var saved = store.games[ck(store.lv, store.current)];
    if (!saved || saved.completed) {
      while (store.current < CHS.length && isChapterDone(store.current) && isChapterUnlocked(store.current + 1)) store.current++;
      saved = store.games[ck(store.lv, store.current)];
    }
    buildLvTabs();
    buildLevelTabs();
    buildCheer();
    buildBoard();
    buildNumpad();
    bindEvents();
    bindSettings();
    bindGun();
    buildTestJump();
    if (saved && saved.id && !saved.completed) resumeGame(saved);
    else loadStage(store.current, nextStage(store.current));
    maybeRules(store.lv);
    registerSW();
  }

  init();
})();
