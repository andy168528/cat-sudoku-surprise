/*
 * 音效模組：優先播放本地 mp3 / m4a 音檔，失敗時改用 Web Audio 合成（嗶聲、喵聲）。
 * iOS Safari 需要使用者互動後才能發聲，因此在第一次觸控時解鎖 AudioContext。
 */
(function (g) {
  'use strict';
  var ctx = null;
  var enabled = true;
  var bufferCache = {};

  function getCtx() {
    if (!ctx) {
      var AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function unlock() {
    var c = getCtx();
    if (!c) return;
    // 播放一段無聲 buffer，完成 iOS 解鎖
    var src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) {
    g.addEventListener(ev, function once() {
      unlock();
      g.removeEventListener(ev, once, true);
    }, true);
  });

  function tone(opts) {
    var c = getCtx();
    if (!c || !enabled) return;
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.15, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  // 合成喵聲：鋸齒波 + 帶通濾波 + 音高滑音
  function synthMeow(pitch) {
    var c = getCtx();
    if (!c || !enabled) return;
    pitch = pitch || 1;
    var t0 = c.currentTime;
    var dur = 0.55;
    var osc = c.createOscillator();
    var filter = c.createBiquadFilter();
    var gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420 * pitch, t0);
    osc.frequency.linearRampToValueAtTime(760 * pitch, t0 + 0.18);
    osc.frequency.linearRampToValueAtTime(520 * pitch, t0 + dur);
    filter.type = 'bandpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(900 * pitch, t0);
    filter.frequency.linearRampToValueAtTime(1800 * pitch, t0 + 0.2);
    filter.frequency.linearRampToValueAtTime(1000 * pitch, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.06);
    gain.gain.setValueAtTime(0.35, t0 + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter).connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  var missing = {};
  var gunBuf = null;

  // 合成槍聲：衰減白噪音 + 低通掃頻 + 低頻重擊
  function synthGun() {
    var c = getCtx();
    if (!c || !enabled) return;
    var t0 = c.currentTime, len = Math.floor(c.sampleRate * 0.25);
    if (!gunBuf || gunBuf.sampleRate !== c.sampleRate) {
      gunBuf = c.createBuffer(1, len, c.sampleRate);
      var d = gunBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    var src = c.createBufferSource();
    src.buffer = gunBuf;
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4000, t0);
    f.frequency.exponentialRampToValueAtTime(300, t0 + 0.2);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.9, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    src.connect(f).connect(gain).connect(c.destination);
    src.start(t0);
    tone({ freq: 140, to: 40, dur: 0.12, vol: 0.4, type: 'sine' });
  }

  function loadBuffer(url) {
    var c = getCtx();
    if (!c) return Promise.reject(new Error('no audio'));
    if (bufferCache[url]) return Promise.resolve(bufferCache[url]);
    if (missing[url]) return Promise.reject(new Error('missing ' + url));
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('missing ' + url);
        return r.arrayBuffer();
      })
      .then(function (ab) {
        return new Promise(function (resolve, reject) {
          // Safari 舊版只支援 callback 形式
          c.decodeAudioData(ab, resolve, reject);
        });
      })
      .then(function (buf) { bufferCache[url] = buf; return buf; })
      .catch(function (e) { missing[url] = true; throw e; });
  }

  // 依序嘗試多個路徑，第一個成功的就播放
  function playFirst(urls) {
    var list = [].concat(urls || []);
    function next(i) {
      if (i >= list.length) return Promise.reject(new Error('no playable file'));
      return loadBuffer(list[i]).catch(function () { return next(i + 1); });
    }
    return next(0).then(function (buf) {
      if (!enabled) return;
      var c = getCtx();
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    });
  }

  // 遊戲音效：每次從貓叫聲音檔隨機挑一段（不連續重複），新的一段會先停掉上一段
  var fxPool = [], fxLast = '', fxSrc = null;
  function stopFx() {
    if (fxSrc) { try { fxSrc.stop(); } catch (e) { /* 已結束 */ } fxSrc = null; }
  }
  function pickFx() {
    var ok = fxPool.filter(function (u) { return !missing[u]; });
    var list = ok.length > 1 ? ok.filter(function (u) { return u !== fxLast; }) : ok;
    return list.length ? list[Math.floor(Math.random() * list.length)] : '';
  }
  function effect(tries) {
    if (!enabled) return;
    var url = pickFx();
    if (!url) { synthMeow(0.8 + Math.random() * 0.6); return; }
    fxLast = url;
    loadBuffer(url).then(function (buf) {
      if (!enabled) return;
      var c = getCtx();
      stopFx();
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      fxSrc = src;
      src.onended = function () { if (fxSrc === src) fxSrc = null; };
    }).catch(function () {
      if ((tries || 0) < 3) effect((tries || 0) + 1); else synthMeow(1);
    });
  }

  var Sound = {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    setEffects: function (urls) { fxPool = [].concat(urls || []); },
    // 填數字專用：遊戲原生音效
    tap: {
      click: function () { tone({ freq: 880, dur: 0.05, vol: 0.08, type: 'triangle' }); },
      note: function () { tone({ freq: 1320, dur: 0.04, vol: 0.05, type: 'sine' }); },
      error: function () {
        tone({ freq: 220, dur: 0.12, vol: 0.15, type: 'square' });
        tone({ freq: 160, dur: 0.16, vol: 0.12, type: 'square', delay: 0.1 });
      },
      correct: function () { tone({ freq: 660, to: 990, dur: 0.12, vol: 0.1, type: 'triangle' }); }
    },
    effect: function () { effect(0); },
    click: function () { effect(0); },
    note: function () { effect(0); },
    error: function () { effect(0); },
    correct: function () { effect(0); },
    win: function () { effect(0); },
    // 槍聲：有 assets/audio/gun.m4a / gun.mp3 就播放，沒有就合成
    gun: function (urls) {
      if (!enabled) return;
      if (urls && urls.length) playFirst(urls).catch(synthGun); else synthGun();
    },
    // urls：音檔候選路徑（mp3 / m4a）；全部失敗時以 pitch 合成喵聲
    meow: function (urls, pitch) {
      if (!enabled) return;
      if (urls && urls.length) {
        playFirst(urls).catch(function () { synthMeow(pitch); });
      } else {
        synthMeow(pitch);
      }
    }
  };

  g.CatSound = Sound;
})(window);
