# 蘇白｜麥克風裡的海

three.js 捲動式混音作品集。純靜態檔，不用建置。

- 網站：https://yc0935019269cloud-create.github.io/mic-sea/
- 更新方式：改完 commit 並 push 到 `main`，GitHub Pages 約 1 分鐘後自動更新。
- 島上畫框的 YouTube 只在正式網址播得出來；本機（localhost）預覽時 YouTube 會擋嵌入，屬正常現象。

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
- 文案：`index.html` 的各個 `.ov` 區塊（`data-a`／`data-b` 是出現的捲動進度）
- 捲動時間軸：`src/main.js` 的 `T`

## 檔案

| 檔案 | 內容 |
|---|---|
| `src/booth.js` | 深夜錄音間、麥克風、譜架、檯燈、進出鏡頭路徑 |
| `src/sea.js` | 天空、水、五線譜、島、封面畫框、音符、暴風雨、海上鏡頭 |
| `src/post.js` | 兩個場景的六角網罩合成、泛光、調色、色散 |
| `src/audio.js` | 海浪底噪、A/B 交叉淡化、旋律合成音 |
| `src/landmarks.js` | 8 種島上地標（`landmarks-test.html` 可單獨看） |
| `assets/gen/` | GPT 生圖：雲 ×2、載入畫面主視覺 |
| `assets/covers/`、`assets/audio/` | 從個人商業網站素材區複製來的封面與 A/B 片段 |

## 除錯

瀏覽器主控台：

```js
__mixsea.p = 0.72      // 直接跳到某個捲動進度
__mixsea.setAB(0)      // A/B 滑桿：0 暴風雨、1 平靜
__mixsea.skipFade()    // 跳過開場淡入
```
