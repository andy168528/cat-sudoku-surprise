/*
 * ✏️ 客製化設定檔：名稱、章節、關卡、時限、提示次數、貓咪、甜蜜小語都在這裡修改。
 *
 * 【章節 chapters】每章一隻專屬貓咪，每過一關得到牠的「1 張寫真 + 1 段叫聲」。
 *   - stages     ：關卡數
 *   - hints      ：每關可用提示次數（0 = 不能用提示）
 *   - timeLimits ：限時關卡 { 關卡編號: 分鐘 }，時間內完成才算過關
 *   - level      ：題目難度（1 入門高難 / 2 專家 / 3 地獄 / 4 超地獄）
 *   要整章全部過關，才會解鎖下一章。
 *
 * 【寫真 / 叫聲檔名】<章節 key>-<兩位數關卡>，例如：
 *   assets/cats/west-01.jpg（或 .png）、assets/audio/west-01.m4a（或 .mp3）
 *   找不到檔案時，寫真顯示佔位圖、叫聲改用 Web Audio 合成喵聲（每關音高不同）。
 *   想用其他檔名，在下方 media 填路徑即可。
 * 新增 / 更換檔案後，請把 sw.js 的 CACHE_VERSION 加 1，離線快取才會更新。
 */
(function (g) {
  var config = {
    appName: '喵南西北數讀',
    poweredBy: 'Powered by 鴻小兵',
    herName: '老婆',
    fromName: '老公',

    chapters: [
      { key: 'west',  label: '第一章', name: '指西',   desc: '入門高難',   level: 1, stages: 15, hints: 3, timeLimits: { 15: 20 },
        cat: { name: '小麻糬', emoji: '🐱', color: '#d9c9b0', pitch: 1.15, story: '最愛窩在妳腿上打呼嚕的小麻糬。' } },
      { key: 'north', label: '第二章', name: '指北',   desc: '專家挑戰',   level: 2, stages: 15, hints: 2, timeLimits: { 15: 25 },
        cat: { name: '雪球',   emoji: '🐈', color: '#d6dbe0', pitch: 1.05, story: '陪妳一路往北的白色雪球。' } },
      { key: 'south', label: '第三章', name: '指南',   desc: '地獄考驗',   level: 3, stages: 15, hints: 1, timeLimits: { 15: 30 },
        cat: { name: '貓王',   emoji: '😼', color: '#c9a99a', pitch: 0.9,  story: '只有走到指南的人才能見到牠。' } },
      { key: 'hong',  label: '終章',   name: '鴻小兵', desc: '超地獄考驗', level: 4, stages: 3,  hints: 0, timeLimits: { 1: 30, 2: 35, 3: 40 },
        cat: { name: '鴻小兵', emoji: '🐾', color: '#c8c2b6', pitch: 0.8,  story: '傳說中的鴻小兵，親自出題。' } }
    ],

    // 個別關卡的寫真說明（選填），例如 'west-01': '第一次見面'
    captions: {},

    // 自訂檔案路徑（選填），例如 'west-01': { photo: 'assets/cats/mochi.jpg', sound: 'assets/audio/mochi.m4a' }
    media: {},

    // 全部通關後的終極獎勵（之後補加）
    ultimateReward: {
      title: '終極獎勵',
      message: '恭喜{name}征服喵南西北！終極獎勵正在準備中，敬請期待。',
      photo: '',
      sound: ''
    },

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
      '這一關獻給世界上最可愛的人。'
    ]
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // 依章節自動產生每一關的獎勵（寫真 + 叫聲）
  config.rewards = [];
  config.chapters.forEach(function (c, idx) {
    for (var s = 1; s <= c.stages; s++) {
      var id = c.key + '-' + pad2(s);
      var m = config.media[id] || {};
      config.rewards.push({
        id: id, ch: idx + 1, stage: s,
        photo: m.photo || '', sound: m.sound || '',
        caption: config.captions[id] || '',
        // 沒有音檔時，每一關的合成喵聲音高略有不同
        pitch: c.cat.pitch * (0.8 + ((s * 7) % 15) / 15 * 0.55)
      });
    }
  });

  // 取得寫真 / 叫聲候選路徑（App 與 Service Worker 共用）
  config.mediaFor = function (r) {
    return {
      photos: r.photo ? [r.photo] : ['assets/cats/' + r.id + '.jpg', 'assets/cats/' + r.id + '.png'],
      sounds: r.sound ? [r.sound] : ['assets/audio/' + r.id + '.m4a', 'assets/audio/' + r.id + '.mp3']
    };
  };

  g.CAT_SUDOKU_CONFIG = config;
})(typeof self !== 'undefined' ? self : this);
