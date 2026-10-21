/*
 * Service Worker：預先快取所有檔案，讓遊戲在飛航模式下也能完整遊玩。
 * 策略：stale-while-revalidate（先回快取，背景連網時再更新）。
 * 更新檔案（特別是新增照片 / 音檔）後，請把 CACHE_VERSION 加 1。
 */
var CACHE_VERSION = 'v23';
var CACHE_NAME = 'cat-sudoku-' + CACHE_VERSION;

try { importScripts('js/config.js'); } catch (e) { /* config 讀取失敗時仍可運作 */ }

var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/sudoku.js',
  './js/stages.js',
  './js/audio.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

function mediaAssets() {
  var cfg = self.CAT_SUDOKU_CONFIG;
  if (!cfg || !cfg.rewards || !cfg.mediaFor) return [];
  var out = [];
  cfg.rewards.forEach(function (r) {
    var m = cfg.mediaFor(r);
    m.photos.concat(m.sounds).forEach(function (u) { out.push('./' + u.replace(/^\.?\//, '')); });
  });
  ((cfg.gun || {}).sounds || []).forEach(function (x) { out.push('./' + x.replace(/^\.?\//, '')); });
  return out;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // cache: 'reload' 繞過瀏覽器 HTTP 快取，避免新版快取混入舊檔
      return cache.addAll(CORE_ASSETS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).then(function () {
        // 照片 / 音檔為選配：個別快取，缺檔不影響安裝
        return Promise.all(mediaAssets().map(function (url) {
          return cache.add(url).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('cat-sudoku-') === 0 && k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isNav = req.mode === 'navigate';
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        if (!cached && isNav) return cache.match('./index.html');
        return cached;
      }).then(function (cached) {
        var network = fetch(req, { cache: 'no-cache' }).then(function (res) {
          if (res && res.ok && res.type === 'basic') {
            cache.put(isNav ? './index.html' : req, res.clone());
          }
          return res;
        }).catch(function () { return cached; });
        if (cached) {
          event.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network;
      });
    })
  );
});
