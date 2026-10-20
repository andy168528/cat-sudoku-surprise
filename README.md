# 🐾 Cat Sudoku Surprise — 貓咪數獨大驚喜

專為老婆設計的**高難度貓咪主題數獨**。純 HTML / CSS / JavaScript，不需要任何建置工具或後端；
支援 PWA，在 iPhone「加入主畫面」後，**飛航模式下也能完整離線遊玩**。

## ✨ 功能

### 階段一：高難度數獨引擎
- **唯一解保證**：位元遮罩 + MRV 回溯求解器，挖洞時每一步都驗證解的數量 = 1。
- **邏輯難度評分**：內建邏輯解題器（唯一候選、隱性唯一、區塊摒除、數對/數組、X-Wing、XY-Wing、劍魚），確保高等級題目真的需要進階推理。

| 等級 | 名稱 | 挖空格數 | 推理要求 |
| --- | --- | --- | --- |
| Level 1 | 入門高難 | 50 – 52 | 一般書籍高難度 |
| Level 2 | 專家挑戰 | 54 – 56 | 至少需要「區塊摒除」 |
| Level 3 | 地獄考驗 | 58 以上 | 至少需要「數對/數組」，多數題目超出 X-Wing 等級 |

- 填數字、**鉛筆筆記**（填數字後自動清除同行列宮的筆記，可關閉）
- **錯誤提示**：填錯變紅 + 震動音效、重複數字衝突高亮、錯誤次數統計（可關閉）
- **計時器**：切到背景 / 畫廊 / 暫停時自動停止
- **復原**、**清除**、**提示**（會先指出填錯的格子，再給出下一步可推得的數字）
- **自動存檔**（localStorage）：三個難度各自保存進度，關閉分頁或重新整理都不會遺失
- 桌機鍵盤操作：`1-9` 填數、方向鍵移動、`Backspace` 清除、`N` 筆記模式、`H` 提示、`Ctrl/⌘+Z` 復原

### 階段二：貓咪獎勵與成就
- **貓咪畫廊**：12 隻貓咪，未解鎖顯示「?」剪影與解鎖條件，已解鎖可在「彩色寫真 / 貓咪影子」間切換（單張或全部）。
- **通關驚喜彈窗**：甜蜜小語、通關時間（含新紀錄）、錯誤 / 提示次數、新解鎖的貓咪、Emoji 彩帶動畫與勝利音效。
- **音效**：優先讀取本地 `mp3 / m4a` 貓叫聲，缺檔時自動使用 Web Audio 合成喵聲與嗶聲。
- 所有文字、貓咪名字、解鎖條件、照片與音檔路徑都在 [`js/config.js`](js/config.js) 一個檔案裡修改。

### 階段三：PWA 離線
- `manifest.json`（standalone、直式、主題色、192/512/maskable 圖示）+ iOS `apple-touch-icon` 與相關 meta。
- `sw.js`：安裝時預先快取所有檔案（包含 config 中設定的照片與音檔），之後採 stale-while-revalidate 策略，連網時背景更新。

## 📁 專案結構

```
├── index.html            # 主頁面
├── manifest.json         # PWA 設定
├── sw.js                 # Service Worker（離線快取）
├── vercel.json           # Vercel 標頭設定（sw.js 不快取）
├── css/style.css         # 樣式（手機優先、支援瀏海安全區）
├── js/
│   ├── config.js         # ✏️ 客製化：貓咪、甜蜜小語、照片、音檔
│   ├── sudoku.js         # 數獨引擎（生成 / 唯一解 / 難度評分 / 提示）
│   ├── audio.js          # 音效（音檔 + Web Audio 合成）
│   └── app.js            # 遊戲介面與狀態
├── icons/                # App 圖示
├── assets/cats/          # 放貓咪照片
├── assets/audio/         # 放貓叫聲 mp3 / m4a
└── tests/engine.test.js  # 引擎測試（node tests/engine.test.js）
```

## 💻 本機預覽

不需要安裝任何套件，任選一個靜態伺服器：

```bash
git clone https://github.com/andy168528/cat-sudoku-surprise.git
cd cat-sudoku-surprise
python3 -m http.server 8080      # 或 npx serve .
```

打開 <http://localhost:8080>。（Service Worker 只能在 `https://` 或 `localhost` 下運作，直接雙擊 `index.html` 可以玩，但不會有離線快取。）

執行引擎測試（需要 Node.js）：

```bash
node tests/engine.test.js
```

## 🚀 部署到 Vercel

**方法 A：網頁操作（最簡單）**
1. 到 <https://vercel.com> 用 GitHub 帳號登入。
2. 點 **Add New… → Project**，選擇 `cat-sudoku-surprise` 儲存庫，按 **Import**。
3. Framework Preset 選 **Other**，Build Command 與 Output Directory **保持空白**（純靜態網站）。
4. 按 **Deploy**，約 30 秒後會得到 `https://cat-sudoku-surprise-xxx.vercel.app` 網址。
5. 之後每次 `git push` 到 `main`，Vercel 會自動重新部署。

**方法 B：命令列**
```bash
npm i -g vercel
cd cat-sudoku-surprise
vercel          # 第一次會引導登入與建立專案
vercel --prod   # 正式部署
```

> `vercel.json` 已設定 `sw.js` 不被快取，確保更新能即時推送到手機。

## 📱 在 iPhone 安裝與離線測試

1. 用 **Safari** 打開部署好的網址（必須是 Safari，Chrome for iOS 無法加入主畫面為 PWA）。
2. 等頁面載入完成，到「⚙️ 設定」頁確認底部顯示 **「✅ 已完成離線快取，飛航模式也能玩」**。
3. 點下方 **分享按鈕（方框加箭頭）→「加入主畫面」→「新增」**。
4. 從主畫面的「貓咪數獨」圖示開啟一次（全螢幕、沒有網址列）。
5. **離線測試**：打開「飛航模式」並關閉 Wi-Fi → 完全關閉 App（上滑移除）→ 再從主畫面打開，應能正常開新局、切換難度、看畫廊與聽到音效。
6. **存檔測試**：玩到一半直接關掉 App，再打開應回到原本的盤面、筆記與計時。

> ⚠️ iOS 小提醒
> - 主畫面 App 與 Safari 分頁的存檔是**分開的**（iOS 的設計），請讓老婆固定從主畫面圖示開啟。
> - 第一次聽到聲音需要先點一下畫面（iOS 規定需使用者互動才能播放音訊）；若沒有聲音，請確認手機側邊的**靜音鍵**沒有開啟。
> - 若很長一段時間（數週）沒打開，iOS 可能清除網站資料；上飛機前打開一次即可確保快取最新。

## 🎨 換成自家貓咪的照片與叫聲

1. 照片放到 `assets/cats/`、音檔放到 `assets/audio/`（詳見各資料夾的 README）。
2. 編輯 `js/config.js`：

   ```js
   { id: 'cat-01', name: '小麻糬', emoji: '🐱', color: '#f7c59f',
     photo: 'assets/cats/mochi.jpg',
     sound: 'assets/audio/mochi.m4a',
     unlock: { wins: 1 }, story: '最愛窩在妳腿上打呼嚕的小麻糬。' },
   ```
3. 也可以修改 `herName`、`fromName`、`sweetMessages`（甜蜜小語）、`levelMessages` 與解鎖條件。
4. **把 `sw.js` 的 `CACHE_VERSION` 加 1**，`git push` 後重新打開 App 兩次即可更新離線快取。

## 🛠️ 技術說明

- 題目在裝置上即時生成（Level 1/2 約數毫秒，Level 3 平均數十毫秒），每題都保證唯一解，不需要網路或題庫。
- 難度評分：邏輯解題器依序嘗試各技巧，記錄解題所需的最高技巧等級；若在時間預算內找不到符合要求的題目，會回傳評分最高的一題。
- 無任何第三方相依套件。
