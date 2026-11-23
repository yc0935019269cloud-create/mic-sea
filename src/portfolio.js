// 水下氣泡作品牆：全部作品（來源：Google Doc「Cover、混音、編曲作品合集」＋個人商業網站的作品連結）。
// kind：yt＝YouTube 橫式、short＝YouTube Shorts、mp3＝站內音檔（從本人公開的 Drive 連結轉檔）、x＝只放在 X 的影片
// group：cover＝Cover／混音、bgm＝伴奏／BGM／配樂、special＝特別作品
// 2-h1Bj7hIxk《深昏睡》2026-11-24 在 YouTube 已無法嵌入（oEmbed 失敗），先不放。
export const PORTFOLIO = [
  { kind: 'yt', id: 'jR6jmVAc5qk', title: 'わたしの一番かわいいところ', credit: '貓葉みのり', group: 'cover', start: 35 },
  { kind: 'yt', id: 'mJzbweQiWR4', title: '迷人的危險', credit: 'Rtea 雪狼阿茶 & ORI 禮', group: 'cover', start: 35 },
  { kind: 'yt', id: 'liuNYQyRfOo', title: '九萬字', credit: '拉爾妮蒂 LarNiti', group: 'cover', start: 35 },
  { kind: 'yt', id: '-usQpjLVQDY', title: 'ほろよい', credit: '鬼城雪乃', group: 'cover', start: 35 },
  { kind: 'yt', id: 'wSMrbaXE5FE', title: '偽裝', credit: '羊駝 AlpacaOHO feat. 干達', group: 'cover', start: 35 },
  { kind: 'short', id: '4aSfcLTSfYQ', title: '求救訊號', credit: 'Angniss Crowley', group: 'cover', start: 0 },
  { kind: 'short', id: 'utTLyjVGHTk', title: '한숨 (BREATHE)', credit: 'Angniss Crowley', group: 'cover', start: 0 },
  { kind: 'yt', id: 'NIwl6V0kU-0', title: 'Golden', credit: '澄音琉璃・安格妮斯・索伊拉', group: 'cover', start: 35 },
  { kind: 'yt', id: 'oZbd98ZkhN4', title: '逢いたくていま', credit: '安提·萊特 AntiLight', group: 'cover', start: 35, note: '伴奏與混音' },
  { kind: 'yt', id: 'uvanL5ONtT0', title: '群青', credit: 'ORI 央莉', group: 'cover', start: 35 },
  { kind: 'yt', id: 'yHyIfCz-pmc', title: 'JANE DOE', credit: '林媛媛 & 伊zomi', group: 'cover', start: 35 },
  { kind: 'short', id: 'ALCK6O1zPhU', title: 'テレパシ', credit: '苒茉莉莉 Molily', group: 'cover', start: 0 },
  { kind: 'short', id: 'ropGDcJ6mWo', title: '大眠', credit: '苒茉莉莉 Molily', group: 'cover', start: 0 },
  { kind: 'short', id: 'alktRw402vQ', title: 'Bunny Girl', credit: '苒茉莉莉 Molily', group: 'cover', start: 0 },
  { kind: 'x', id: '1961781514997485994', user: 'xitakesi', title: 'メリーゴーランド', credit: '希塔克絲', group: 'cover' },
  { kind: 'yt', id: 'wkQoa6W84K8', title: 'ほろよい（伴奏）', credit: '舒狐 Sofox', group: 'bgm', start: 30, note: '伴奏' },
  { kind: 'yt', id: 'nZiLNLHgU1E', title: '背景故事配樂', credit: '柳芒響 MX', group: 'bgm', start: 0, note: '配樂' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-sofox.mp3', title: '待機 BGM', credit: 'Relive_舒狐 Sofox', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-sakinezumi-op.mp3', title: 'OP', credit: 'Relive_咲鼠', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-sparky.mp3', title: '待機與 ED BGM', credit: 'Sparky', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-sylvia.mp3', title: '待機 BGM', credit: '熙維亞多娜娜·安德斯·多拉多魯', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-eloi.mp3', title: '待機 BGM', credit: '艾蘿伊', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-feather.mp3', title: '收藏 BGM', credit: '羽毛毛雨', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-lavey-op.mp3', title: '直播 OP', credit: '菈維露德 Lavey Rood', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/bgm-lavey-bgm.mp3', title: '待機與 ED BGM', credit: '菈維露德 Lavey Rood', group: 'bgm' },
  { kind: 'mp3', src: 'assets/audio/works/award-cmu.mp3', title: '詞曲創作比賽・冠軍', credit: '中國醫藥大學', group: 'special', note: '編曲・樂器演奏・混音' },
];

export const thumbOf = (w) => (w.kind === 'yt' || w.kind === 'short') ? `assets/thumbs/${w.id}.jpg` : null;
export const linkOf = (w) => {
  if (w.kind === 'yt') return `https://www.youtube.com/watch?v=${w.id}`;
  if (w.kind === 'short') return `https://www.youtube.com/shorts/${w.id}`;
  if (w.kind === 'x') return `https://x.com/${w.user}/status/${w.id}`;
  return w.src;
};

// 雲上的價目表（內容照本人的價目表圖 pricing-reference.png）
export const PRICES = [
  { tag: 'COVER', title: 'Cover 整首', sub: '無修改次數限制', rows: [['單人', '3,500'], ['雙人', '4,800']],
    notes: ['無音準節拍校正 −1,500', '急件（4 天內）+2,000', '和聲 +500'], foot: '工期 14 天內' },
  { tag: 'SHORTS', title: 'Shorts', sub: '一分鐘內', rows: [['單人', '900'], ['雙人', '1,400']],
    notes: ['無音準節拍校正 −500', '急件（4 天內）+800', '和聲 +300'], foot: '工期 14 天內' },
  { tag: 'QUICK MIX', title: '混音快速方案', sub: '免費修改 3 次，之後每次 +150', rows: [['單人', '3,000'], ['雙人', '4,200']],
    notes: ['包含人工和聲、空間系效果', '音準節拍校正', 'EQ・COMP・SATURATION…渾身解數'], foot: '工期 14 天內' },
  { tag: 'LOOP BGM', title: 'Loop BGM', sub: '2 分鐘內', rows: [['單首', '3,000–4,000'], ['兩首', '5,000–7,000']],
    notes: ['價格依曲風與樂器數量浮動', '歡迎私訊議價'], foot: '' },
  { tag: 'BONUS', title: '優惠', sub: '', rows: [], notes: ['老客戶甜甜價 9 折', '一條龍合作'], foot: '' },
  { tag: 'HOW', title: '委託流程', sub: '', rows: [], notes: ['1　私訊推特或 DC', '2　繳交音檔（WAV）', '3　確認製作方向', '4　製作完畢提出修改', '5　繳交尾款'], foot: 'X @subaiyaya　DC .subai' },
];
