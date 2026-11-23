# 蘇白｜麥克風裡的海

three.js 捲動式混音作品集。純靜態檔，不用建置。

- 網站：https://yc0935019269cloud-create.github.io/mic-sea/
- 更新方式：改完 commit 並 push 到 `main`，GitHub Pages 約 1 分鐘後自動更新。
- 島上畫框與水下氣泡裡的 YouTube 只在正式網址播得出來；本機（localhost）預覽時 YouTube 會擋嵌入，屬正常現象。

## 整條路線

錄音間 → 穿過麥克風網罩 → 五線譜之海（8 座島，停下自動播）→ A/B 暴風雨 → 水面線轉場潛進水裡 →
水下 6 段（修音、EQ、壓縮、空間、和聲、母帶）→ 作品氣泡牆（26 首，點了就播）→ 氣泡轉場 →
雲上飛行＋價目卡 → 穿過雲層 → 俯瞰旋律 → 回到錄音間＋委託按鈕。

載入完要按「進入」才開始：瀏覽器規定點過才能出聲，所以預設是帶聲音進入，另有「靜音進入」。

## 本機預覽

在這個資料夾開 PowerShell：

```powershell
python -m http.server 5180
```

瀏覽器開 http://localhost:5180 。（直接雙擊 index.html 不行，ES module 需要伺服器。）

## 改內容

- 作品、連結、旋律：`src/data.js`
  - `WORKS`：8 件作品（標題、歌手、角色、YouTube、封面、島上地標、發光色）
  - `MELODY`：每座島在五線譜上的位置（0＝最下線 E4 … 8＝最上線 F5），高空看到、結尾譜架上寫的都是這段
  - `LINKS.commission`：委託按鈕要連到哪裡
- 水下氣泡牆的全部作品、雲上價目表：`src/portfolio.js`（`PORTFOLIO`、`PRICES`）
  - `kind`：`yt`、`short`、`mp3`（站內音檔，放 `assets/audio/works/`）、`x`（只放在 X 的影片）
- 水下 6 段的標題與一句說明：`src/under.js` 的 `CHAPTERS`
- 文案：`index.html` 的 `.ov` 區塊；出現時機由 `src/main.js` 依時間軸設定
- 捲動時間軸：`src/main.js` 的 `SEG`（每段佔幾個 vh）

## 檔案

| 檔案 | 內容 |
|---|---|
| `src/booth.js` | 深夜錄音間、麥克風、譜架、檯燈、進出鏡頭路徑 |
| `src/sea.js` | 天空、水、五線譜、島、封面畫框、音符、暴風雨、海上鏡頭 |
| `src/under.js` | 水下世界：6 段混音／母帶動畫、作品氣泡牆、上升氣泡 |
| `src/bubbleplayer.js` | 點氣泡播放：YouTube 圓形影片（兩個播放器接力）、站內音檔、X 卡片 |
| `src/flight.js` | 雲上飛行：雲海地板、掠過的雲、價目卡、往下穿過雲層 |
| `src/portfolio.js` | 氣泡牆作品清單、價目表內容 |
| `src/yt.js` | YouTube IFrame API 共用載入 |
| `src/post.js` | 轉場合成（六角網罩／水面線／氣泡）、泛光、調色、色散 |
| `src/audio.js` | 海浪底噪、A/B 交叉淡化、旋律合成音 |
| `src/landmarks.js` | 8 種島上地標（`landmarks-test.html` 可單獨看） |
| `assets/gen/` | GPT 生圖：雲 ×4、雲海、水下管風琴聖堂、載入畫面主視覺 |
| `assets/thumbs/` | YouTube 縮圖（氣泡用） |
| `assets/audio/works/` | 從本人公開 Drive 連結轉成 MP3 的 BGM 與得獎作 |
| `assets/covers/`、`assets/audio/` | 從個人商業網站素材區複製來的封面與 A/B 片段 |

## 除錯

瀏覽器主控台：

```js
__mixsea.p = 0.72      // 直接跳到某個捲動進度
__mixsea.setAB(0)      // A/B 滑桿：0 暴風雨、1 平靜
__mixsea.skipFade()    // 跳過開場淡入與「進入」
__mixsea.tick(60)      // 分頁在背景時手動推進 60 幀
__mixsea.T             // 各段的捲動進度
```
