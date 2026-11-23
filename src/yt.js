// YouTube IFrame API 只能載一次；島上播放器與氣泡播放器共用這個 Promise。
let ready = null;
export function whenYT() {
  if (ready) return ready;
  ready = new Promise((res) => {
    if (window.YT && window.YT.Player) { res(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(window.YT); };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(sc);
  });
  return ready;
}
