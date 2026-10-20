/*
 * ✏️ 客製化設定檔：名稱、章節、獎勵（寫真＋叫聲）、甜蜜小語都在這裡修改。
 *
 * 【獎勵 rewards】每一個獎勵 = 一張寫真 + 一段叫聲，依章節（level）分開：
 *   - level：屬於哪一章（1 指西 / 2 指北 / 3 指南）
 *   - wins ：在該章通關幾次後解鎖
 *   - photo：寫真路徑；留空 '' 會自動尋找 assets/cats/<id>.jpg（或 .png）
 *   - sound：叫聲路徑；留空 '' 會自動尋找 assets/audio/<id>.m4a（或 .mp3）
 *   找不到檔案時，寫真顯示佔位圖、叫聲改用 Web Audio 合成的喵聲（音高由 pitch 決定）。
 *
 * 所以最簡單的做法：把檔案命名成獎勵的 id（例如 west-1.jpg、west-1.m4a）丟進資料夾即可。
 * 新增 / 更換檔案後，請把 sw.js 的 CACHE_VERSION 加 1，離線快取才會更新。
 * 這個檔案也會被 Service Worker 讀取，所有寫真與叫聲都會自動加入離線快取。
 */
(function (g) {
  var config = {
    appName: '喵南西北數讀',
    poweredBy: 'Powered by 鴻小兵',
    herName: '老婆',
    fromName: '老公',

    // label：章節字眼（可改成「卷一」「Chapter I」「Boss」等）
    chapters: {
      1: { label: '第一章', name: '指西', desc: '入門高難' },
      2: { label: '第二章', name: '指北', desc: '專家挑戰' },
      3: { label: '終章',   name: '指南', desc: '地獄考驗' }
    },

    rewards: [
      // 第一章・指西
      { id: 'west-1',  level: 1, wins: 1,  name: '小麻糬', emoji: '🐱', color: '#d9c9b0', pitch: 1.15, photo: '', sound: '', story: '最愛窩在妳腿上打呼嚕的小麻糬。' },
      { id: 'west-2',  level: 1, wins: 3,  name: '奶茶',   emoji: '😺', color: '#cdb79e', pitch: 1.0,  photo: '', sound: '', story: '聽到罐頭聲就會飛奔過來。' },
      { id: 'west-3',  level: 1, wins: 5,  name: '芝麻',   emoji: '🐈‍⬛', color: '#9a958c', pitch: 0.9, photo: '', sound: '', story: '黑夜裡的小忍者，眼睛會發光。' },
      { id: 'west-4',  level: 1, wins: 10, name: '布丁',   emoji: '😸', color: '#e3d3a8', pitch: 1.25, photo: '', sound: '', story: '笑起來跟妳一樣甜。' },
      // 第二章・指北
      { id: 'north-1', level: 2, wins: 1,  name: '雪球',   emoji: '🐈', color: '#d6dbe0', pitch: 1.1,  photo: '', sound: '', story: '第一次征服指北的紀念。' },
      { id: 'north-2', level: 2, wins: 3,  name: '橘子',   emoji: '😻', color: '#dcc1a0', pitch: 0.95, photo: '', sound: '', story: '圓滾滾的橘貓，吃飽就睡。' },
      { id: 'north-3', level: 2, wins: 5,  name: '可可',   emoji: '😽', color: '#bfae9a', pitch: 1.05, photo: '', sound: '', story: '會偷偷親妳一下的撒嬌鬼。' },
      { id: 'north-4', level: 2, wins: 10, name: '月亮',   emoji: '🌙', color: '#cfcad8', pitch: 1.2,  photo: '', sound: '', story: '陪妳熬夜解題的守護貓。' },
      // 終章・指南
      { id: 'south-1', level: 3, wins: 1,  name: '貓王',   emoji: '😼', color: '#c9a99a', pitch: 0.8,  photo: '', sound: '', story: '只有走到終章的人才能見到牠！' },
      { id: 'south-2', level: 3, wins: 2,  name: '招財貓', emoji: '🐾', color: '#d8c0b8', pitch: 1.3,  photo: '', sound: '', story: '指南兩勝，好運滾滾來。' },
      { id: 'south-3', level: 3, wins: 3,  name: '天使貓', emoji: '😇', color: '#c8d3dc', pitch: 1.35, photo: '', sound: '', story: '指南三勝，妳就是我的天使。' },
      { id: 'south-4', level: 3, wins: 5,  name: '我們家', emoji: '🏠', color: '#d2c4b4', pitch: 1.0,  photo: '', sound: '', story: '全部收集完成！謝謝妳一直陪著我。' }
    ],

    // {name} 會被替換成 herName
    sweetMessages: [
      '{name}好聰明！這題連貓咪都看傻了。',
      '解題的樣子最迷人了，{name}。',
      '又破關了！今晚的罐罐我請客。',
      '全世界最會解數獨的就是{name}！',
      '妳每填一個數字，我就多愛妳一點。',
      '貓咪們排隊要跟{name}擊掌。',
      '再難的題目都難不倒妳，就像妳總能搞定我。',
      '飛機上也能這麼厲害，{name}是天才吧！',
      '今天也辛苦了，給{name}一個大大的抱抱。',
      '這一勝獻給世界上最可愛的人。'
    ],

    levelMessages: {
      1: '指西，順利讀完。',
      2: '指北，專家級的推理。',
      3: '指南，連終章都被妳征服了。'
    }
  };

  // 取得某個獎勵的寫真 / 叫聲候選路徑（App 與 Service Worker 共用）
  config.mediaFor = function (r) {
    return {
      photos: r.photo ? [r.photo] : ['assets/cats/' + r.id + '.jpg', 'assets/cats/' + r.id + '.png'],
      sounds: r.sound ? [r.sound] : ['assets/audio/' + r.id + '.m4a', 'assets/audio/' + r.id + '.mp3']
    };
  };

  g.CAT_SUDOKU_CONFIG = config;
})(typeof self !== 'undefined' ? self : this);
