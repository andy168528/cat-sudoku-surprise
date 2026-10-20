# 貓叫聲音檔放這裡 🔊

1. 把音檔放進這個資料夾，例如 `mimi.m4a` 或 `mimi.mp3`（建議 1–3 秒、128kbps 以內）。
   - iPhone 錄音 App 錄好的 `.m4a` 可以直接使用。
2. 打開 `js/config.js`，把對應貓咪的 `sound` 改成 `'assets/audio/mimi.m4a'`。
3. 把 `sw.js` 裡的 `CACHE_VERSION` 加 1，重新部署。

沒有設定音檔（或檔案讀取失敗）時，會自動改用 Web Audio 合成的「喵～」聲，每隻貓的音高由 `pitch` 決定。
