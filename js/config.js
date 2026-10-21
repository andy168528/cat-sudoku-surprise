/*
 * ✏️ 客製化設定檔：名稱、Lv、章節、關卡、時限、提示次數、貓咪、獎勵都在這裡修改。
 *
 * 【Lv modes】Lv.1～Lv.4，每個 Lv 都有四章（指西 / 指北 / 指南 / 鴻小兵），上一個 Lv 全破才解鎖下一個。
 *   - effect：搗亂效果（shift 推移 / size 變大變小 / eat 吃掉），每 chaosEveryMin 分鐘（遊玩時間）一次
 *   - rules ：第一次進入該 Lv 時顯示的規則說明
 * 【章節 chapters】
 *   - stages     ：每個 Lv 裡該章的關卡數
 *   - hints      ：每關可用提示次數（0 = 不能用提示）
 *   - timeLimits ：限時關卡 { 關卡編號: 分鐘 }，限時關不能暫停
 *   - level      ：題目難度（1 入門高難 / 2 專家 / 3 地獄 / 4 超地獄）
 *   - photoEvery ：每過幾關得到 1 張寫真
 * 【獎勵檔名】
 *   寫真：assets/cats/lv<Lv>-<章節 key>-<第幾張>.jpg（或 .png），例如 lv1-west-1.jpg、lv4-hong-3.jpg
 *   叫聲（只有 Lv.1，每關 1 段）：assets/audio/<章節 key>-<兩位數關卡>.m4a（或 .mp3），例如 west-01.m4a
 *   找不到檔案時，寫真顯示佔位圖、叫聲改用 Web Audio 合成喵聲（每關音高不同）。
 * 新增 / 更換檔案後，請把 sw.js 的 CACHE_VERSION 加 1，離線快取才會更新。
 */
(function (g) {
  var config = {
    appName: '喵南西北數讀',
    poweredBy: 'Powered by 鴻小兵',
    herName: '老婆',
    fromName: '老公',

    chapters: [
      { key: 'west',  label: '第一章', name: '指西',   desc: '入門高難',   level: 1, stages: 10, hints: 3, timeLimits: { 10: 20 }, photoEvery: 2,
        cat: { name: '小麻糬', emoji: '🐱', color: '#d9c9b0', pitch: 1.15, story: '最愛窩在妳腿上打呼嚕的小麻糬。' } },
      { key: 'north', label: '第二章', name: '指北',   desc: '專家挑戰',   level: 2, stages: 10, hints: 2, timeLimits: { 10: 25 }, photoEvery: 2,
        cat: { name: '雪球',   emoji: '🐈', color: '#d6dbe0', pitch: 1.05, story: '陪妳一路往北的白色雪球。' } },
      { key: 'south', label: '第三章', name: '指南',   desc: '地獄考驗',   level: 3, stages: 10, hints: 1, timeLimits: { 10: 30 }, photoEvery: 2,
        cat: { name: '貓王',   emoji: '😼', color: '#c9a99a', pitch: 0.9,  story: '只有走到指南的人才能見到牠。' } },
      { key: 'hong',  label: '終章',   name: '鴻小兵', desc: '超地獄考驗', level: 4, stages: 3,  hints: 0, timeLimits: { 1: 30, 2: 35, 3: 40 }, photoEvery: 1,
        cat: { name: '鴻小兵', emoji: '🐾', color: '#c8c2b6', pitch: 0.8,  story: '傳說中的鴻小兵，親自出題。' } }
    ],

    modes: [
      { lv: 1, name: '普通', effect: '',
        rules: ['每一列、每一行、每一個 3×3 宮都要填入 1～9，不能重複。', '標「限」的是限時關，要在時間內完成，而且不能暫停。'] },
      { lv: 2, name: '指西作亂', effect: 'shift',
        rules: ['指西來搗亂了！', '妳填的數字會被隨機抓走一個，往上、下、左或右推開 1～3 格（只會推到空格）。', '題目本身的數字不會被推走，被推走的數字不算失誤。'] },
      { lv: 3, name: '肥肥臭指北', effect: 'size',
        rules: ['肥肥臭指北來搗亂了！', '盤面上的數字會隨機明顯變大或縮小，看清楚再填喔。', '數字大小改變不影響答案。'] },
      { lv: 4, name: '暴食指南貓', effect: 'eat',
        rules: ['暴食指南貓肚子餓了！', '妳填的數字會被隨機吃掉一個，要自己再補回去。', '題目本身的數字不會被吃掉，被吃掉的數字不算失誤。'] }
    ],
    chaosEveryMin: 2,

    // 個別獎勵的寫真說明（選填），例如 'lv1-west-1': '第一次見面'
    captions: {},

    // 自訂檔案路徑（選填），例如 'lv1-west-1': { photo: 'assets/cats/mochi.jpg' }、'west-01': { sound: 'assets/audio/mochi.m4a' }
    media: {},

    // Lv.1 全破的終極大獎：可在 Lv.2～4 隨時拿出來掃射
    gun: {
      name: '老子弄不到槍',
      sounds: ['assets/audio/gun.m4a', 'assets/audio/gun.mp3'],
      message: '恭喜{name}破完 Lv.1 全部 33 關！這把槍送給妳，Lv.2～4 想發洩的時候隨時拿出來掃射。'
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

  // 依 Lv / 章節自動產生獎勵：寫真（每 photoEvery 關一張）、叫聲（只有 Lv.1，每關一段）
  config.rewards = [];
  config.modes.forEach(function (m) {
    config.chapters.forEach(function (c, idx) {
      for (var s = c.photoEvery, n = 1; s <= c.stages; s += c.photoEvery, n++) {
        var id = 'lv' + m.lv + '-' + c.key + '-' + n;
        config.rewards.push({ id: id, kind: 'photo', lv: m.lv, ch: idx + 1, stage: s, n: n,
          photo: (config.media[id] || {}).photo || '', sound: '', caption: config.captions[id] || '', pitch: c.cat.pitch });
      }
    });
  });
  config.chapters.forEach(function (c, idx) {
    for (var s = 1; s <= c.stages; s++) {
      var id = c.key + '-' + pad2(s);
      config.rewards.push({ id: id, kind: 'sound', lv: 1, ch: idx + 1, stage: s, n: s,
        photo: '', sound: (config.media[id] || {}).sound || '', caption: '',
        // 沒有音檔時，每一段的合成喵聲音高略有不同
        pitch: c.cat.pitch * (0.8 + ((s * 7) % 15) / 15 * 0.55) });
    }
  });

  // 取得寫真 / 叫聲候選路徑（App 與 Service Worker 共用）
  config.mediaFor = function (r) {
    if (r.kind === 'sound') return { photos: [], sounds: r.sound ? [r.sound] : ['assets/audio/' + r.id + '.m4a', 'assets/audio/' + r.id + '.mp3'] };
    return { photos: r.photo ? [r.photo] : ['assets/cats/' + r.id + '.jpg', 'assets/cats/' + r.id + '.png'], sounds: [] };
  };

  g.CAT_SUDOKU_CONFIG = config;
})(typeof self !== 'undefined' ? self : this);
