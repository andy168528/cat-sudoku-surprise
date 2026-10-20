# 貓咪寫真放這裡 📸

1. 把照片放進這個資料夾，例如 `mimi.jpg`（建議正方形、寬 600px 以內、JPG/WebP，檔案小比較省快取空間）。
2. 打開 `js/config.js`，把對應貓咪的 `photo` 改成 `'assets/cats/mimi.jpg'`。
3. 把 `sw.js` 裡的 `CACHE_VERSION` 加 1（例如 `'v1'` → `'v2'`），重新部署。

沒有設定照片的貓咪會自動使用 CSS + Emoji 佔位圖；「貓咪影子」模式則是自動把圖案變成黑色剪影。
