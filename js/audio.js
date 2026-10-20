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

  function playFile(url) {
    var c = getCtx();
    if (!c) return Promise.reject(new Error('no audio'));
    var cached = bufferCache[url];
    var p = cached ? Promise.resolve(cached) : fetch(url)
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
      .then(function (buf) { bufferCache[url] = buf; return buf; });
    return p.then(function (buf) {
      if (!enabled) return;
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    });
  }

  var Sound = {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    click: function () { tone({ freq: 880, dur: 0.05, vol: 0.08, type: 'triangle' }); },
    note: function () { tone({ freq: 1320, dur: 0.04, vol: 0.05, type: 'sine' }); },
    error: function () {
      tone({ freq: 220, dur: 0.12, vol: 0.15, type: 'square' });
      tone({ freq: 160, dur: 0.16, vol: 0.12, type: 'square', delay: 0.1 });
    },
    correct: function () { tone({ freq: 660, to: 990, dur: 0.12, vol: 0.1, type: 'triangle' }); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ freq: f, dur: 0.25, vol: 0.14, type: 'triangle', delay: i * 0.12 });
      });
      tone({ freq: 1319, dur: 0.5, vol: 0.12, type: 'sine', delay: 0.5 });
    },
    // cat: { sound, pitch }
    meow: function (cat) {
      if (!enabled) return;
      cat = cat || {};
      if (cat.sound) {
        playFile(cat.sound).catch(function () { synthMeow(cat.pitch); });
      } else {
        synthMeow(cat.pitch);
      }
    }
  };

  g.CatSound = Sound;
})(window);
