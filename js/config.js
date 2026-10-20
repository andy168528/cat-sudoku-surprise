/*
 * ✏️ 客製化設定檔：在這裡修改貓咪名字、甜蜜小語、照片與叫聲檔案。
 *
 * - photo：彩色寫真路徑（例如 'assets/cats/mimi.jpg'），留空字串則使用內建佔位圖。
 * - sound：貓叫聲路徑（支援 .mp3 / .m4a，例如 'assets/audio/mimi.m4a'），留空字串則使用 Web Audio 合成喵聲。
 * - unlock：解鎖條件
 *     { wins: N }            → 累積通關 N 次解鎖
 *     { level: L, wins: N }  → 在 Level L 通關 N 次解鎖
 * - pitch：合成喵聲的音高倍率（沒有音檔時使用），1 = 標準。
 *
 * 新增 / 更換照片或音檔後，請一併把 sw.js 裡的 CACHE_VERSION 加 1，確保離線快取會更新。
 * 這個檔案同時會被 Service Worker 讀取，所以照片與音檔會自動加入離線快取。
 */
(function (g) {
  g.CAT_SUDOKU_CONFIG = {
    herName: '老婆',
    fromName: '老公',

    cats: [
      { id: 'cat-01', name: '小麻糬', emoji: '🐱', color: '#f7c59f', pitch: 1.15, photo: '', sound: '', unlock: { wins: 1 }, story: '最愛窩在妳腿上打呼嚕的小麻糬。' },
      { id: 'cat-02', name: '奶茶',   emoji: '😺', color: '#e8b98a', pitch: 1.0,  photo: '', sound: '', unlock: { wins: 2 }, story: '聽到罐頭聲就會飛奔過來。' },
      { id: 'cat-03', name: '芝麻',   emoji: '🐈‍⬛', color: '#5b5b6b', pitch: 0.9, photo: '', sound: '', unlock: { wins: 3 }, story: '黑夜裡的小忍者，眼睛會發光。' },
      { id: 'cat-04', name: '布丁',   emoji: '😸', color: '#ffd166', pitch: 1.25, photo: '', sound: '', unlock: { wins: 5 }, story: '笑起來跟妳一樣甜。' },
      { id: 'cat-05', name: '雪球',   emoji: '🐈', color: '#dfe7fd', pitch: 1.1,  photo: '', sound: '', unlock: { level: 2, wins: 1 }, story: '第一次征服專家挑戰的紀念。' },
      { id: 'cat-06', name: '橘子',   emoji: '😻', color: '#f4a261', pitch: 0.95, photo: '', sound: '', unlock: { wins: 8 }, story: '圓滾滾的橘貓，吃飽就睡。' },
      { id: 'cat-07', name: '可可',   emoji: '😽', color: '#b08968', pitch: 1.05, photo: '', sound: '', unlock: { level: 2, wins: 3 }, story: '會偷偷親妳一下的撒嬌鬼。' },
      { id: 'cat-08', name: '月亮',   emoji: '🌙', color: '#cdb4db', pitch: 1.2,  photo: '', sound: '', unlock: { wins: 12 }, story: '陪妳熬夜解題的守護貓。' },
      { id: 'cat-09', name: '地獄貓王', emoji: '😼', color: '#e76f51', pitch: 0.8, photo: '', sound: '', unlock: { level: 3, wins: 1 }, story: '只有通過地獄考驗的人才能見到牠！' },
      { id: 'cat-10', name: '幸運招財貓', emoji: '🐾', color: '#ffafcc', pitch: 1.3, photo: '', sound: '', unlock: { wins: 20 }, story: '集滿 20 場勝利的超級幸運。' },
      { id: 'cat-11', name: '天使貓', emoji: '😇', color: '#bde0fe', pitch: 1.35, photo: '', sound: '', unlock: { level: 3, wins: 5 }, story: '地獄考驗 5 勝，妳就是我的天使。' },
      { id: 'cat-12', name: '我們家', emoji: '💖', color: '#ff8fab', pitch: 1.0,  photo: '', sound: '', unlock: { wins: 30 }, story: '全部收集完成！謝謝妳一直陪著我。' }
    ],

    // {name} 會被替換成 herName
    sweetMessages: [
      '{name}好聰明！這題連貓咪都看傻了 🐾',
      '解題的樣子最迷人了，{name} ❤️',
      '又破關了！今晚的罐罐我請客 😽',
      '全世界最會解數獨的就是{name}！',
      '妳每填一個數字，我就多愛妳一點。',
      '貓咪們排隊要跟{name}擊掌 🐱✋',
      '再難的題目都難不倒妳，就像妳總能搞定我 😆',
      '飛機上也能這麼厲害，{name}是天才吧！',
      '今天也辛苦了，給{name}一個大大的抱抱 🤗',
      '這一勝獻給世界上最可愛的人。'
    ],

    levelMessages: {
      1: '入門高難輕鬆過關！',
      2: '專家挑戰成功，太強了！',
      3: '連地獄考驗都通過了，簡直是傳說！'
    }
  };
})(typeof self !== 'undefined' ? self : this);
