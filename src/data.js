// 作品資料：之後換作品、改文案只改這裡。
// role 欄位依 Google Doc「Cover、混音、編曲作品合集」；標「待確認」的請本人核對。
// start：停在這座島時，影片從第幾秒開始播（預設略過前奏，請本人改成副歌秒數）
export const WORKS = [
  { title: 'わたしの一番かわいいところ', credit: '貓葉みのり', original: 'FRUITS ZIPPER', role: '混音', yt: 'jR6jmVAc5qk', start: 35, cover: 'assets/covers/work-01.jpg', landmark: 'carousel', accent: 0xffa8c8 },
  { title: '迷人的危險', credit: 'Rtea 雪狼阿茶 & ORI 禮', original: 'dance flow', role: 'Cover 混音（待確認）', yt: 'mJzbweQiWR4', start: 35, cover: 'assets/covers/work-02.jpg', landmark: 'stage', accent: 0xff8a72 },
  { title: '九萬字', credit: '拉爾妮蒂 LarNiti', original: '黃詩扶', role: 'Cover 混音（待確認）', yt: 'liuNYQyRfOo', start: 35, cover: 'assets/covers/work-03.jpg', landmark: 'gate', accent: 0xffb35c },
  { title: 'ほろよい', credit: '鬼城雪乃', original: 'さんひ', role: 'Cover 混音（待確認）', yt: '-usQpjLVQDY', start: 35, cover: 'assets/covers/work-04.jpg', landmark: 'greenhouse', accent: 0xffd27a },
  { title: '偽裝', credit: '羊駝 AlpacaOHO feat. 干達', original: '', role: 'Cover 混音（待確認）', yt: 'wSMrbaXE5FE', start: 35, cover: 'assets/covers/work-05.jpg', landmark: 'observatory', accent: 0xa9c0ff },
  { title: '求救訊號', credit: 'Angniss Crowley', original: 'Vast & Hazy', role: 'Cover 混音（待確認）', yt: 'shorts/4aSfcLTSfYQ', start: 0, cover: 'assets/covers/work-06.jpg', landmark: 'lighthouse', accent: 0xfff0c0 },
  { title: '한숨 (BREATHE)', credit: 'Angniss Crowley', original: 'LEE HI', role: 'Cover 混音（待確認）', yt: 'shorts/utTLyjVGHTk', start: 0, cover: 'assets/covers/work-07.jpg', landmark: 'windmill', accent: 0xc4ecff },
  { title: 'Golden', credit: '澄音琉璃・安格妮斯・索伊拉', original: 'HUNTR/X', role: 'Cover 混音（待確認）', yt: 'NIwl6V0kU-0', start: 35, cover: 'assets/covers/work-08.jpg', landmark: 'belltower', accent: 0xffc94a },
];

// 每座島在五線譜上的位置：0 = 最下線 E4，往上每一格是一個音（線、間交替），8 = 最上線 F5。
// 從高空看下去，島的排列就是這段旋律。之後可以換成本人得獎曲的主旋律前 8 個音。
export const MELODY = [2, 4, 5, 4, 6, 8, 7, 5];
export const STAFF_MIDI = [64, 65, 67, 69, 71, 72, 74, 76, 77];

export const LINKS = {
  x: 'https://x.com/subaiyaya',
  commission: '#', // TODO：接到正式網站的委託表單
};

export const ytUrl = (id) =>
  id.startsWith('shorts/') ? `https://www.youtube.com/${id}` : `https://www.youtube.com/watch?v=${id}`;
