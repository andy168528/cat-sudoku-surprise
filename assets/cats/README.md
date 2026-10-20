# 貓咪寫真（照片）

每個收藏都有一個 `id`（見 `js/config.js` 的 `rewards`），把照片用這個 id 命名放進本資料夾就會自動使用：

| 章節 | 檔名 |
| --- | --- |
| 第一章・指西 | `west-1.jpg` ~ `west-4.jpg` |
| 第二章・指北 | `north-1.jpg` ~ `north-4.jpg` |
| 終章・指南 | `south-1.jpg` ~ `south-4.jpg` |

- 支援 `.jpg` 或 `.png`（先找 `.jpg`）。
- 建議正方形、寬度 600px 左右、單張 200KB 以內，離線快取比較快。
- 想用其他檔名，可以在 `config.js` 該收藏的 `photo` 欄位填路徑，例如 `photo: 'assets/cats/mochi.jpg'`。
- 沒放照片時會顯示 Emoji 佔位圖與「寫真預留」標籤。
- 放好後請把 `sw.js` 的 `CACHE_VERSION` 加 1（例如 `v2` → `v3`），離線快取才會更新。
