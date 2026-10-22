# 貓咪寫真

照檔名放進這個資料夾，App 會自動使用（`.jpg` 或 `.png`）。沒有檔案時顯示 Emoji 佔位圖。

規則：`lv<Lv>-<章節 key>-<第幾張>.jpg`，每章每過 2 關一張、鴻小兵每關一張。

| 章節 | key | 每個 Lv 的張數 | 例子 |
| --- | --- | --- | --- |
| 第一章・指西 | `west` | 5 | `lv1-west-1.jpg` ~ `lv1-west-5.jpg` |
| 第二章・指北 | `north` | 5 | `lv1-north-1.jpg` ~ `lv1-north-5.jpg` |
| 第三章・指南 | `south` | 5 | `lv1-south-1.jpg` ~ `lv1-south-5.jpg` |
| 終章・鴻小兵 | `hong` | 3 | `lv1-hong-1.jpg` ~ `lv1-hong-3.jpg` |

Lv.2～4 把開頭換成 `lv2-`、`lv3-`、`lv4-`，四個 Lv 共 72 張。

放好後把 `sw.js` 的 `CACHE_VERSION` 加 1，離線快取才會更新。
