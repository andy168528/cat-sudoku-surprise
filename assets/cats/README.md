# 貓咪寫真（照片）

每章是一隻專屬貓咪，**每過一關得到牠的 1 張寫真**。照片用「章節 key＋兩位數關卡」命名放進本資料夾就會自動使用：

| 章節 | 貓咪 | 檔名 |
| --- | --- | --- |
| 第一章・指西 | 小麻糬 | `west-01.jpg` ~ `west-15.jpg` |
| 第二章・指北 | 雪球 | `north-01.jpg` ~ `north-15.jpg` |
| 第三章・指南 | 貓王 | `south-01.jpg` ~ `south-15.jpg` |
| 終章・鴻小兵 | 鴻小兵 | `hong-01.jpg` ~ `hong-03.jpg` |

- 支援 `.jpg` 或 `.png`（先找 `.jpg`）。
- 建議正方形、寬度 600px 左右、單張 200KB 以內，離線快取比較快。
- 想用其他檔名，在 `js/config.js` 的 `media` 填路徑，例如 `'west-01': { photo: 'assets/cats/mochi.jpg' }`。
- 每張照片的說明文字寫在 `config.js` 的 `captions`，例如 `'west-01': '第一次見面'`。
- 終極獎勵的照片填在 `config.js` 的 `ultimateReward.photo`。
- 沒放照片時會顯示 Emoji 佔位圖與「寫真預留」標籤。
- 放好後請把 `sw.js` 的 `CACHE_VERSION` 加 1（例如 `v3` → `v4`），離線快取才會更新。
