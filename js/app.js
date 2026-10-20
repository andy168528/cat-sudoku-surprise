(function () {
  'use strict';

  var S = window.CatSudoku;
  var Sound = window.CatSound;
  var CONFIG = window.CAT_SUDOKU_CONFIG;
  var REWARDS = CONFIG.rewards;
  var CH = CONFIG.chapters;
  var ICONS = {
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="12" cy="12" r="3.5"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>'
  };
  function chName(L) { return CH[L].label + '・' + CH[L].name; }

  var KEY_GAMES = 'catSudoku.games.v1';
  var KEY_PROGRESS = 'catSudoku.progress.v1';
  var KEY_SETTINGS = 'catSudoku.settings.v1';
  var MAX_HISTORY = 100;
  var GRADE_TEXT = { 1: '基本技巧', 2: '區塊摒除', 3: '數對 / 數組', 4: 'X-Wing 級', 5: '超進階推理' };

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

  /* ---------------- 狀態 ---------------- */

  var settings = Object.assign({ sound: true, errorCheck: true, highlight: true, autoNotes: true, galleryPhoto: true },
    load(KEY_SETTINGS, {}));
  var progress = Object.assign({ totalWins: 0, wins: { 1: 0, 2: 0, 3: 0 }, best: {}, unlocked: [], seen: [] },
    load(KEY_PROGRESS, {}));
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
    if (game) store.games[game.level] = game;
    save(KEY_GAMES, store);
  }
  function persistProgress() { save(KEY_PROGRESS, progress); }
  function persistSettings() { save(KEY_SETTINGS, settings); }

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
    var cfg = S.LEVELS[game.level];
    $('levelLabel').textContent = chName(game.level) + '・' + cfg.name + '・挖空 ' + game.holes + ' 格';
    $('gradeLabel').textContent = '推理：' + (GRADE_TEXT[game.grade] || '—');
    $('filledLabel').textContent = filled + ' / 81';
    $('mistakes').textContent = game.mistakes;
    $('timer').textContent = fmtTime(game.elapsedMs);
    $('notesBtn').classList.toggle('active', noteMode);
    $('notesState').textContent = noteMode ? '開' : '關';
    $('pauseOverlay').classList.toggle('hidden', !paused);
    $('board').classList.toggle('blur', paused);
    $('pauseBtn').innerHTML = paused ? ICONS.play : ICONS.pause;
  }

  function isLevelUnlocked(L) {
    return L === 1 || (progress.wins[L - 1] || 0) >= 1;
  }

  function buildLevelTabs() {
    $('levelTabs').innerHTML = [1, 2, 3].map(function (L) {
      return '<button class="level-tab" data-level="' + L + '" role="tab"><small>' + esc(CH[L].label) + '</small>' +
        '<b>' + esc(CH[L].name) + '</b><small>' + esc(CH[L].desc) + '</small><span class="lock">' + ICONS.lock + '</span></button>';
    }).join('');
  }

  function renderTabs() {
    var tabs = document.querySelectorAll('.level-tab');
    for (var t = 0; t < tabs.length; t++) {
      var L = +tabs[t].dataset.level;
      var unlocked = isLevelUnlocked(L);
      tabs[t].classList.toggle('active', L === store.current);
      tabs[t].classList.toggle('locked', !unlocked);
      tabs[t].querySelector('.lock').classList.toggle('hidden', unlocked);
      var g = store.games[L];
      tabs[t].classList.toggle('in-progress', !!(g && !g.completed));
    }
    var hasNew = progress.unlocked.some(function (id) { return progress.seen.indexOf(id) < 0; });
    $('galleryBadge').classList.toggle('hidden', !hasNew);
    renderCheer();
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
    if (!game || paused) return;
    selected = i;
    render();
  }

  function pushHistory() {
    game.history.push({ v: game.values.slice(), n: game.notes.slice() });
    if (game.history.length > MAX_HISTORY) game.history.shift();
  }

  function canEdit() {
    return game && !game.completed && !paused && selected >= 0 && game.puzzle[selected] === 0;
  }

  function input(d) {
    if (!game || game.completed || paused) return;
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
    if (!game || game.completed || paused) return;
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
    if (!game || game.completed || paused) return;
    for (var i = 0; i < 81; i++) {
      if (game.values[i] && game.values[i] !== game.solution[i]) {
        selected = i;
        render();
        flash(i, 'shake');
        Sound.error();
        toast('這一格好像不太對喔');
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
    toast('提示（' + h.technique + '）：第 ' + (S.ROW[h.index] + 1) + ' 列第 ' + (S.COL[h.index] + 1) + ' 行是 ' + h.value);
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

  /* ---------------- 計時器 ---------------- */

  function startTimer() {
    stopTimer();
    if (!game || game.completed || paused || currentView !== 'game' || document.hidden) return;
    lastTick = Date.now();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (timerId) {
      tick();
      clearInterval(timerId);
      timerId = null;
    }
  }
  function tick() {
    if (!game) return;
    var now = Date.now();
    game.elapsedMs += now - lastTick;
    lastTick = now;
    $('timer').textContent = fmtTime(game.elapsedMs);
    if (++tickCount % 5 === 0) persistGame();
  }
  function setPaused(v) {
    if (!game || game.completed) v = false;
    paused = v;
    if (paused) stopTimer(); else startTimer();
    persistGame();
    render();
  }

  /* ---------------- 新局 / 切換難度 ---------------- */

  function hasProgress(g) {
    if (!g || g.completed) return false;
    for (var i = 0; i < 81; i++) if ((g.values[i] && !g.puzzle[i]) || g.notes[i]) return true;
    return false;
  }

  function newGame(level) {
    stopTimer();
    $('loading').classList.remove('hidden');
    setTimeout(function () {
      var r = S.generate(level);
      game = {
        level: level, seed: r.seed, puzzle: r.puzzle, solution: r.solution,
        values: r.puzzle.slice(), notes: new Array(81).fill(0),
        mistakes: 0, hints: 0, hinted: [], elapsedMs: 0, completed: false,
        history: [], grade: r.grade.level, holes: r.holes, createdAt: Date.now()
      };
      store.current = level;
      selected = -1;
      noteMode = false;
      paused = false;
      persistGame();
      $('loading').classList.add('hidden');
      render();
      startTimer();
    }, 60);
  }

  function switchLevel(level) {
    Sound.click();
    if (!isLevelUnlocked(level)) {
      toast('先通過「' + CH[level - 1].name + '」才能翻開「' + CH[level].name + '」');
      return;
    }
    if (level === store.current && game) {
      if (game.completed) { newGame(level); return; }
      return;
    }
    stopTimer();
    persistGame();
    store.current = level;
    var g = store.games[level];
    if (g && !g.completed) {
      game = g;
      selected = -1;
      paused = false;
      persistGame();
      render();
      startTimer();
      toast('已翻到「' + CH[level].name + '」的書籤');
    } else {
      newGame(level);
    }
  }

  function requestNewGame() {
    if (hasProgress(game)) {
      confirmModal('開新的一局？', '目前這局的進度將會消失喔！', '開新局', function () { newGame(store.current); });
    } else {
      newGame(store.current);
    }
  }

  /* ---------------- 過關 & 獎勵 ---------------- */

  function meets(r) { return (progress.wins[r.level] || 0) >= r.wins; }
  function unlockText(r) { return '通過「' + CH[r.level].name + '」' + r.wins + ' 次'; }
  function rewardById(id) { return REWARDS.filter(function (r) { return r.id === id; })[0]; }
  function isUnlocked(r) { return progress.unlocked.indexOf(r.id) >= 0; }
  function playReward(r) { Sound.meow(CONFIG.mediaFor(r).sounds, r.pitch); }

  function checkWin() {
    if (!game || game.completed) return;
    for (var i = 0; i < 81; i++) if (game.values[i] !== game.solution[i]) return;
    stopTimer();
    game.completed = true;
    selected = -1;
    var L = game.level;
    var wasNextLocked = L < 3 && !isLevelUnlocked(L + 1);
    progress.totalWins++;
    progress.wins[L] = (progress.wins[L] || 0) + 1;
    var prevBest = progress.best[L];
    var isBest = !prevBest || game.elapsedMs < prevBest;
    if (isBest) progress.best[L] = game.elapsedMs;
    var newly = REWARDS.filter(function (r) { return !isUnlocked(r) && meets(r); });
    newly.forEach(function (r) { progress.unlocked.push(r.id); });
    persistProgress();
    persistGame();
    render();
    var nextChapter = wasNextLocked && isLevelUnlocked(L + 1) ? L + 1 : 0;
    setTimeout(function () { celebrate(newly, isBest, nextChapter); }, 350);
  }

  function celebrate(newly, isBest, nextChapter) {
    Sound.win();
    if (newly[0]) setTimeout(function () { playReward(newly[0]); }, 900);
    confetti();
    var L = game.level;
    var msgs = CONFIG.sweetMessages;
    var sweet = personalize(msgs[Math.floor(Math.random() * msgs.length)]);
    var html = '<p class="modal-kicker">' + esc(CH[L].label) + '</p>' +
      '<h2 class="modal-title">' + esc(CH[L].name) + '・完</h2>' +
      '<div class="ornament">— ✦ —</div>' +
      '<p class="level-msg">' + esc(CONFIG.levelMessages[L] || '') + '</p>' +
      '<p class="sweet">' + esc(sweet) + '<small>— 愛妳的' + esc(CONFIG.fromName) + '</small></p>' +
      '<div class="result-stats"><span>時間 <b>' + fmtTime(game.elapsedMs) + '</b>' + (isBest ? ' <i class="best">（新紀錄）</i>' : '') + '</span>' +
      '<span>失誤 <b>' + game.mistakes + '</b></span><span>提示 <b>' + game.hints + '</b></span></div>';
    if (newly.length) {
      html += '<h3 class="unlock-title">解鎖新收藏</h3><div class="unlock-list">' +
        newly.map(function (r) {
          return '<div class="unlock-item">' + catArt(r, 'photo') + '<b>' + esc(r.name) + '</b><small>寫真＋叫聲</small></div>';
        }).join('') + '</div>';
    } else {
      var next = REWARDS.filter(function (r) { return r.level === L && !isUnlocked(r); })[0];
      html += next
        ? '<p class="next-goal">本章下一個收藏：' + unlockText(next) + '</p>'
        : '<p class="next-goal">「' + esc(CH[L].name) + '」的收藏已全部到手</p>';
    }
    if (nextChapter) {
      html += '<div class="chapter-unlocked">已解鎖 ' + esc(chName(nextChapter)) + '</div>';
    }
    html += '<div class="modal-actions">' +
      '<button class="btn ghost" data-act="gallery">收藏</button>' +
      (nextChapter ? '<button class="btn ghost" data-act="next">前往下一章</button>' : '') +
      '<button class="btn primary" data-act="again">再讀一局</button></div>';
    openModal(html, function (act) {
      if (act === 'gallery') { closeModal(); showView('gallery'); }
      if (act === 'next') { closeModal(); switchLevel(nextChapter); }
      if (act === 'again') { closeModal(); newGame(game.level); }
    });
  }

  /* ---------------- 貓貓打氣 ---------------- */

  var cheerIndex = { 1: 0, 2: 0, 3: 0 };

  function buildCheer() {
    $('cheerBtns').innerHTML = [1, 2, 3].map(function (L) {
      return '<button class="cheer-btn" data-cheer="' + L + '"><span class="ico"></span>' + esc(CH[L].name) + ' <small></small></button>';
    }).join('');
  }

  function renderCheer() {
    var btns = document.querySelectorAll('.cheer-btn');
    for (var k = 0; k < btns.length; k++) {
      var L = +btns[k].dataset.cheer;
      var all = REWARDS.filter(function (r) { return r.level === L; });
      var got = all.filter(isUnlocked).length;
      btns[k].classList.toggle('locked', got === 0);
      btns[k].querySelector('.ico').innerHTML = got ? ICONS.sound : ICONS.lock;
      btns[k].querySelector('small').textContent = got + '/' + all.length;
    }
  }

  function cheer(L, btn) {
    var list = REWARDS.filter(function (r) { return r.level === L && isUnlocked(r); });
    if (!list.length) {
      var first = REWARDS.filter(function (r) { return r.level === L; })[0];
      Sound.click();
      toast(first ? unlockText(first) + '，即可解鎖「' + CH[L].name + '」打氣叫聲' : '尚無叫聲');
      return;
    }
    var r = list[cheerIndex[L] % list.length];
    cheerIndex[L]++;
    playReward(r);
    toast(r.name + ' 為妳打氣！');
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
    var cls = 'cat-art ' + (mode === 'shadow' ? 'shadow' : 'photo') + (extraCls ? ' ' + extraCls : '');
    var inner = '<span class="cat-emoji">' + r.emoji + '</span>';
    if (mode !== 'shadow') {
      var photos = CONFIG.mediaFor(r).photos;
      inner += '<span class="cat-tag">寫真預留</span>' +
        '<img src="' + esc(photos[0]) + '" data-srcs="' + esc(JSON.stringify(photos)) + '" alt="' + esc(r.name) + '" onerror="__catImgNext(this)">';
    }
    if (extraCls === 'locked') inner += '<span class="cat-q">?</span>';
    return '<div class="' + cls + '" style="--c:' + esc(r.color || '#ddd6c8') + '">' + inner + '</div>';
  }

  function modeFor(r) {
    return cardMode[r.id] || (settings.galleryPhoto ? 'photo' : 'shadow');
  }

  function renderGallery() {
    var unlockedCount = REWARDS.filter(isUnlocked).length;
    $('galleryProgress').textContent = '已收集 ' + unlockedCount + ' / ' + REWARDS.length + '（每個收藏含寫真與叫聲）';
    $('galleryBar').style.width = (unlockedCount / REWARDS.length * 100) + '%';
    $('galleryModeBtn').textContent = settings.galleryPhoto ? '全部切換成：貓咪影子' : '全部切換成：彩色寫真';
    $('gallery').innerHTML = [1, 2, 3].map(function (L) {
      var list = REWARDS.filter(function (r) { return r.level === L; });
      var got = list.filter(isUnlocked).length;
      var head = '<div class="chapter-head"><h3>' + esc(CH[L].label) + '<small>' + esc(CH[L].name) + '</small></h3><span>' + got + ' / ' + list.length + '</span></div>';
      var note = isLevelUnlocked(L) ? '' : '<p class="chapter-note">先通過「' + esc(CH[L - 1].name) + '」翻開本章</p>';
      var cards = list.map(function (r) {
        if (!isUnlocked(r)) {
          return '<button class="cat-card locked" data-id="' + r.id + '">' + catArt(r, 'shadow', 'locked') +
            '<div class="cat-name">???</div><div class="cat-sub">' + unlockText(r) + '</div></button>';
        }
        var mode = modeFor(r);
        var isNew = progress.seen.indexOf(r.id) < 0;
        return '<button class="cat-card' + (isNew ? ' new' : '') + '" data-id="' + r.id + '">' + catArt(r, mode) +
          '<div class="cat-name">' + esc(r.name) + '</div>' +
          '<div class="slots"><span class="slot" data-toggle="' + r.id + '">' + ICONS.photo + (mode === 'shadow' ? '寫真' : '影子') + '</span>' +
          '<span class="slot" data-play="' + r.id + '">' + ICONS.sound + '叫聲</span></div></button>';
      }).join('');
      return '<section class="chapter">' + head + note + '<div class="gallery-grid">' + cards + '</div></section>';
    }).join('');
  }

  function markSeen(r) {
    if (progress.seen.indexOf(r.id) < 0) { progress.seen.push(r.id); persistProgress(); }
  }

  function onGalleryClick(e) {
    var card = e.target.closest('.cat-card');
    if (!card) return;
    var r = rewardById(card.dataset.id);
    if (!r) return;
    if (card.classList.contains('locked')) {
      Sound.click();
      toast(unlockText(r) + ' 即可解鎖');
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
    function html() {
      return '<p class="modal-kicker">' + esc(chName(r.level)) + '</p>' +
        catArt(r, mode, 'detail-art') +
        '<h2 class="modal-title">' + esc(r.name) + '</h2>' +
        '<p class="story">' + esc(r.story || '') + '</p>' +
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
    var rows = [1, 2, 3].map(function (L) {
      return '<div class="stat-card"><b>' + esc(chName(L)) + '</b><small>' + esc(CH[L].desc) + (isLevelUnlocked(L) ? '' : '・未解鎖') + '</small>' +
        '<span>通關 ' + (progress.wins[L] || 0) + ' 次</span>' +
        '<span>最佳 ' + (progress.best[L] ? fmtTime(progress.best[L]) : '—') + '</span></div>';
    });
    rows.push('<div class="stat-card"><b>總計</b><small>全部章節</small><span>通關 ' + progress.totalWins + ' 次</span>' +
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
      confirmModal('重置所有進度？', '閱讀紀錄、收藏與存檔都會清空，無法復原。', '確定重置', function () {
        stopTimer();
        progress = { totalWins: 0, wins: { 1: 0, 2: 0, 3: 0 }, best: {}, unlocked: [], seen: [] };
        store = { current: 1, games: {} };
        game = null;
        persistProgress();
        save(KEY_GAMES, store);
        renderSettings();
        toast('已重置');
        newGame(1);
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
      if (b) switchLevel(+b.dataset.level);
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
    $('newBtn').addEventListener('click', requestNewGame);
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
    progress.unlocked = progress.unlocked.filter(function (id) { return !!rewardById(id); });
    if (!isLevelUnlocked(store.current)) {
      store.current = 1;
      game = store.games[1] || null;
    }
    buildLevelTabs();
    buildCheer();
    buildBoard();
    buildNumpad();
    bindEvents();
    bindSettings();
    if (game && !game.completed) {
      if (!game.hinted) game.hinted = [];
      if (!game.history) game.history = [];
      render();
      startTimer();
    } else {
      newGame(store.current || 1);
    }
    registerSW();
  }

  init();
})();
