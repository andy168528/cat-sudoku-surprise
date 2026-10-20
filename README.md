# 喵南西北數讀

*Powered by 鴻小兵*

專為老婆設計的**高難度貓咪主題數獨**，Kobo 電子書風格（紙張底色、墨黑文字、襯線字體）。純 HTML / CSS / JavaScript，不需要任何建置工具或後端；
支援 PWA，在 iPhone「加入主畫面」後，**飛航模式下也能完整離線遊玩**。

## ✨ 功能

### 階段一：高難度數獨引擎
- **唯一解保證**：位元遮罩 + MRV 回溯求解器，挖洞時每一步都驗證解的數量 = 1。
- **邏輯難度評分**：內建邏輯解題器（唯一候選、隱性唯一、區塊摒除、數對/數組、X-Wing、XY-Wing、劍魚），確保高等級題目真的需要進階推理。

| 章節 | 名稱 | 挖空格數 | 推理要求 | 解鎖條件 |
| --- | --- | --- | --- | --- |
| 第一章 | 指西（入門高難） | 50 – 52 | 一般書籍高難度 | 一開始就能玩 |
| 第二章 | 指北（專家挑戰） | 54 – 56 | 至少需要「區塊摒除」 | 通過「指西」1 次 |
| 終章 | 指南（地獄考驗） | 58 以上 | 至少需要「數對/數組」，多數題目超出 X-Wing 等級 | 通過「指北」1 次 |

> 章節名稱（第一章／終章、指西…）都在 `js/config.js` 的 `chapters` 修改，例如想改成「卷一」或「Boss」只要改 `label`。

- 填數字、**鉛筆筆記**（填數字後自動清除同行列宮的筆記，可關閉）
- **錯誤提示**：填錯變紅 + 震動音效、重複數字衝突高亮、錯誤次數統計（可關閉）
- **計時器**：切到背景 / 畫廊 / 暫停時自動停止
- **復原**、**清除**、**提示**（會先指出填錯的格子，再給出下一步可推得的數字）
- **自動存檔**（localStorage）：三個難度各自保存進度，關閉分頁或重新整理都不會遺失
- 桌機鍵盤操作：`1-9` 填數、方向鍵移動、`Backspace` 清除、`N` 筆記模式、`H` 提示、`Ctrl/⌘+Z` 復原

### 階段二：分章收藏（寫真＋叫聲）與貓貓打氣
- **每章各 4 個收藏，共 12 個**，各章分開計算：只看「該章」的通關次數解鎖（1 / 3 / 5 / 10 次）。
- 每個收藏都有兩個預留位置：**寫真**（`assets/cats/<id>.jpg`）與**叫聲**（`assets/audio/<id>.m4a`）。

| 章節 | 收藏 id | 寫真 | 叫聲 |
| --- | --- | --- | --- |
| 第一章・指西 | `west-1` ~ `west-4` | `assets/cats/west-1.jpg` … | `assets/audio/west-1.m4a` … |
| 第二章・指北 | `north-1` ~ `north-4` | `assets/cats/north-1.jpg` … | `assets/audio/north-1.m4a` … |
| 終章・指南 | `south-1` ~ `south-4` | `assets/cats/south-1.jpg` … | `assets/audio/south-1.m4a` … |

- **貓貓打氣**：遊戲畫面上有「指西／指北／指南」三個按鈕，各自輪流播放該章**已解鎖**的叫聲；該章還沒解鎖任何收藏時按鈕是鎖住的。
- **貓咪收藏頁**：依章節分區，未解鎖顯示「?」與解鎖條件；已解鎖可切換「彩色寫真 / 貓咪影子」、單獨播放叫聲。
- **通關彈窗**：像書本章節結尾的「完」頁，有甜蜜小語、時間（含新紀錄）、新解鎖收藏，第一次通關還會提示「已解鎖下一章」。
- 沒放照片時顯示 Emoji 佔位圖，沒放音檔時用 Web Audio 合成喵聲（每隻貓音高不同）。
- 所有文字、名字、解鎖條件、照片與音檔路徑都在 [`js/config.js`](js/config.js) 修改。

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
2. 等頁面載入完成，到「設定」頁確認底部顯示 **「已完成離線快取，飛航模式也能閱讀」**。
3. 點下方 **分享按鈕（方框加箭頭）→「加入主畫面」→「新增」**。
4. 從主畫面的「喵南西北」圖示開啟一次（全螢幕、沒有網址列）。
5. **離線測試**：打開「飛航模式」並關閉 Wi-Fi → 完全關閉 App（上滑移除）→ 再從主畫面打開，應能正常開新局、切換章節、看收藏與按「貓貓打氣」。
6. **存檔測試**：玩到一半直接關掉 App，再打開應回到原本的盤面、筆記與計時。

> ⚠️ iOS 小提醒
> - 主畫面 App 與 Safari 分頁的存檔是**分開的**（iOS 的設計），請讓老婆固定從主畫面圖示開啟。
> - 第一次聽到聲音需要先點一下畫面（iOS 規定需使用者互動才能播放音訊）；若沒有聲音，請確認手機側邊的**靜音鍵**沒有開啟。
> - 若很長一段時間（數週）沒打開，iOS 可能清除網站資料；上飛機前打開一次即可確保快取最新。

## 🎨 換成自家貓咪的照片與叫聲

1. **最簡單**：照收藏 id 命名直接放檔案，不用改程式：
   - 寫真：`assets/cats/west-1.jpg`（或 `.png`）
   - 叫聲：`assets/audio/west-1.m4a`（或 `.mp3`）
   - 詳見 [`assets/cats/README.md`](assets/cats/README.md)、[`assets/audio/README.md`](assets/audio/README.md)。
2. 想改名字、故事、解鎖次數、或用其他檔名，編輯 `js/config.js` 的 `rewards`：

   ```js
   { id: 'west-1', level: 1, wins: 1, name: '小麻糬', emoji: '🐱', color: '#d9c9b0', pitch: 1.15,
     photo: '',   // 留空 = 自動找 assets/cats/west-1.jpg / .png
     sound: '',   // 留空 = 自動找 assets/audio/west-1.m4a / .mp3
     story: '最愛窩在妳腿上打呼嚕的小麻糬。' },
   ```
   - `level`：屬於哪一章（1 指西、2 指北、3 指南）；`wins`：該章要通關幾次才解鎖。
3. 也可以修改 `appName`、`poweredBy`、`chapters`（章節名稱）、`herName`、`fromName`、`sweetMessages`、`levelMessages`。
4. **把 `sw.js` 的 `CACHE_VERSION` 加 1**（例如 `v2` → `v3`），`git push` 後重新打開 App 兩次即可更新離線快取。

## 🛠️ 技術說明

- 題目在裝置上即時生成（指西、指北約數毫秒，指南平均數十毫秒），每題都保證唯一解，不需要網路或題庫。
- 難度評分：邏輯解題器依序嘗試各技巧，記錄解題所需的最高技巧等級；若在時間預算內找不到符合要求的題目，會回傳評分最高的一題。
- 無任何第三方相依套件。
