# 喵南西北數讀

*Powered by 鴻小兵*

專為老婆設計的**高難度貓咪主題數獨**，Kobo 電子書風格（紙張底色、墨黑文字、襯線字體）。純 HTML / CSS / JavaScript，不需要任何建置工具或後端；
支援 PWA，在 iPhone「加入主畫面」後，**飛航模式下也能完整離線遊玩**。

## ✨ 功能

### 階段一：高難度數獨引擎
- **唯一解保證**：位元遮罩 + MRV 回溯求解器，挖洞時每一步都驗證解的數量 = 1。
- **邏輯難度評分**：內建邏輯解題器（唯一候選、隱性唯一、區塊摒除、數對/數組、X-Wing、XY-Wing、劍魚），確保高等級題目真的需要進階推理。

| 章節 | 名稱 | 關卡 | 挖空格數 | 推理要求 | 每關提示 | 限時關 |
| --- | --- | --- | --- | --- | --- | --- |
| 第一章 | 指西（入門高難） | 15 | 50 – 52 | 一般書籍高難度 | 3 次 | 第 15 關 20 分鐘 |
| 第二章 | 指北（專家挑戰） | 15 | 54 – 56 | 至少需要「區塊摒除」 | 2 次 | 第 15 關 25 分鐘 |
| 第三章 | 指南（地獄考驗） | 15 | 58 以上 | 至少需要「數對/數組」 | 1 次 | 第 15 關 30 分鐘 |
| 終章 | 鴻小兵（超地獄考驗） | 3 | 60 以上 | 超出 X-Wing 的超進階推理 | 不能用 | 3 關全部限時：30 / 35 / 40 分鐘 |

- **關卡解鎖**：每一關要過了才開下一關；整章全部過關，才解鎖下一章。
- **固定題目**：48 關的題目已預先產生在 `js/stages.js`（每題都驗證唯一解），打開即玩、每次重玩同一關都是同一題。要換題目可執行 `node scripts/build-stages.js` 重新產生。
- **限時關**：右上角改成倒數「剩餘時間」，最後 1 分鐘閃紅。時間到就算失敗，盤面鎖住，按「重新挑戰」用同一題重來。暫停、切到收藏/設定頁或 App 在背景時不計時。
- **提示**：工具列顯示剩餘次數（例如 `3/3`）；用完就不能再按，終章顯示「禁用」。指出填錯格子時不扣次數。
- 章節名稱、關卡數、提示次數、時限（分鐘）都在 `js/config.js` 的 `chapters` 修改。

- 填數字、**鉛筆筆記**（填數字後自動清除同行列宮的筆記，可關閉）
- **錯誤提示**：填錯變紅 + 震動音效、重複數字衝突高亮、錯誤次數統計（可關閉）
- **開局準備畫面**：進入關卡時先遮住盤面，顯示挖空格數、提示次數、時限與最佳紀錄，按「開始」才計時；限時關會先倒數 3、2、1。
- **計時器**：切到畫廊 / 設定或按暫停時停止；App 切到背景或重新打開時會自動暫停，按「繼續閱讀」才接著計時
- **復原**、**清除**、**提示**（會先指出填錯的格子，再給出下一步可推得的數字）
- **自動存檔**（localStorage）：四章各自保存目前關卡的進度，關閉分頁或重新整理都不會遺失
- 桌機鍵盤操作：`1-9` 填數、方向鍵移動、`Backspace` 清除、`N` 筆記模式、`H` 提示、`Ctrl/⌘+Z` 復原

### 階段二：每關獎勵（寫真＋叫聲）、貓貓打氣與終極獎勵
- **每章一隻專屬貓咪，每過一關得到牠的 1 張寫真＋1 段叫聲**：第一～三章各 15 組、終章 3 組，共 48 組。
- 檔名規則是「章節 key＋兩位數關卡」，放進資料夾就會自動使用：

| 章節 | 貓咪 | 寫真 | 叫聲 |
| --- | --- | --- | --- |
| 第一章・指西 | 小麻糬 | `assets/cats/west-01.jpg` ~ `west-15.jpg` | `assets/audio/west-01.m4a` ~ `west-15.m4a` |
| 第二章・指北 | 雪球 | `assets/cats/north-01.jpg` ~ `north-15.jpg` | `assets/audio/north-01.m4a` ~ `north-15.m4a` |
| 第三章・指南 | 貓王 | `assets/cats/south-01.jpg` ~ `south-15.jpg` | `assets/audio/south-01.m4a` ~ `south-15.m4a` |
| 終章・鴻小兵 | 鴻小兵 | `assets/cats/hong-01.jpg` ~ `hong-03.jpg` | `assets/audio/hong-01.m4a` ~ `hong-03.m4a` |

- **貓貓打氣**：遊戲畫面有「指西／指北／指南／鴻小兵」四個按鈕，可以一直按，每按一次從該章**已解鎖**的叫聲隨機挑一段（不會連續重複），過幾關就有幾種聲音（按鈕上顯示 `已解鎖/總數`）。
- **貓咪收藏頁**：依章節分區，每關一格；未解鎖顯示「?」，已解鎖可切換「彩色寫真 / 貓咪影子」、單獨播放叫聲。
- **過關彈窗**：甜蜜小語、時間（含新紀錄）、失誤、提示次數，以及這一關得到的寫真＋叫聲；整章完成會提示「已解鎖下一章」。
- **終極獎勵**：四章 48 關全部通關後跳出「終極獎勵」頁（收藏頁最下方也能再打開）。內容尚未決定，先放佔位，之後在 `config.js` 的 `ultimateReward` 填文字、照片、聲音即可。
- 沒放照片時顯示 Emoji 佔位圖，沒放音檔時用 Web Audio 合成喵聲（每關音高不同）。

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
│   ├── config.js         # ✏️ 客製化：章節、關卡、時限、提示、貓咪、照片、音檔
│   ├── sudoku.js         # 數獨引擎（生成 / 唯一解 / 難度評分 / 提示）
│   ├── stages.js         # 48 關預先產生的題目（自動產生）
│   ├── audio.js          # 音效（音檔 + Web Audio 合成）
│   └── app.js            # 遊戲介面與狀態
├── icons/                # App 圖示
├── assets/cats/          # 放貓咪照片
├── assets/audio/         # 放貓叫聲 mp3 / m4a
├── scripts/build-stages.js  # 重新產生 js/stages.js
└── tests/                # node tests/engine.test.js、node tests/stages.test.js
```

## 💻 本機預覽

不需要安裝任何套件，任選一個靜態伺服器：

```bash
git clone https://github.com/andy168528/cat-sudoku-surprise.git
cd cat-sudoku-surprise
python3 -m http.server 8080      # 或 npx serve .
```

打開 <http://localhost:8080>。（Service Worker 只能在 `https://` 或 `localhost` 下運作，直接雙擊 `index.html` 可以玩，但不會有離線快取。）

執行測試（需要 Node.js）：

```bash
node tests/engine.test.js   # 引擎
node tests/stages.test.js   # 章節設定與 48 關題目
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
2. 等頁面載入完成，到「設定」頁確認底部顯示 **「已完成離線快取，飛航模式也能閱讀」**。
3. 點下方 **分享按鈕（方框加箭頭）→「加入主畫面」→「新增」**。
4. 從主畫面的「喵南西北」圖示開啟一次（全螢幕、沒有網址列）。
5. **離線測試**：打開「飛航模式」並關閉 Wi-Fi → 完全關閉 App（上滑移除）→ 再從主畫面打開，應能正常闖關、切換章節、看收藏與按「貓貓打氣」。
6. **存檔測試**：玩到一半直接關掉 App，再打開應回到原本的盤面、筆記與計時（會先停在暫停畫面）。

> ⚠️ iOS 小提醒
> - 主畫面 App 與 Safari 分頁的存檔是**分開的**（iOS 的設計），請讓老婆固定從主畫面圖示開啟。
> - 第一次聽到聲音需要先點一下畫面（iOS 規定需使用者互動才能播放音訊）；若沒有聲音，請確認手機側邊的**靜音鍵**沒有開啟。
> - 若很長一段時間（數週）沒打開，iOS 可能清除網站資料；上飛機前打開一次即可確保快取最新。

## 🎨 換成自家貓咪的照片與叫聲

1. **最簡單**：照檔名規則直接放檔案，不用改程式：
   - 寫真：`assets/cats/west-01.jpg`（或 `.png`）
   - 叫聲：`assets/audio/west-01.m4a`（或 `.mp3`）
   - 詳見 [`assets/cats/README.md`](assets/cats/README.md)、[`assets/audio/README.md`](assets/audio/README.md)。
2. 編輯 `js/config.js`：
   - `chapters`：章節名稱、關卡數、每關提示次數、限時關（`timeLimits: { 15: 20 }` = 第 15 關 20 分鐘）、專屬貓咪（名字、Emoji、顏色、音高、故事）。
   - `captions`：每張寫真的說明，例如 `'west-01': '第一次見面'`。
   - `media`：想用其他檔名時填路徑，例如 `'west-01': { photo: 'assets/cats/mochi.jpg', sound: 'assets/audio/mochi.m4a' }`。
   - `ultimateReward`：終極獎勵的標題、文字、照片、聲音。
3. 也可以修改 `appName`、`poweredBy`、`herName`、`fromName`、`sweetMessages`。
4. **把 `sw.js` 的 `CACHE_VERSION` 加 1**（例如 `v5` → `v6`），`git push` 後重新打開 App 兩次即可更新離線快取。

## 🛠️ 技術說明

- 48 關題目由同一套引擎預先產生並內建，每題都保證唯一解，不需要網路；萬一缺少某關資料，會在裝置上即時生成。
- 這一版改用新的存檔格式（`catSudoku.*.v2`），舊版的通關紀錄不會沿用，會從第一章第一關開始。
- 難度評分：邏輯解題器依序嘗試各技巧，記錄解題所需的最高技巧等級；若在時間預算內找不到符合要求的題目，會回傳評分最高的一題。
- 無任何第三方相依套件。
