/**
 * DemoVideo — the marketing showreel at site/public/demo.mp4.
 *
 * Autoplays muted + looping (browsers require muted to autoplay), but exposes
 * native `controls` so visitors can unmute the voiceover and go fullscreen.
 * Sized via the mdcc-demo-video CSS class (global.css).
 */
export function DemoVideo() {
  return (
    <section className="mdcc-demo-video" aria-label="Live demo">
      <div className="mdcc-demo-video-head">
        <span>
          <strong>demo.mp4</strong> · ~1:45 · showreel
        </span>
        <span>MAUDE/INTRO</span>
      </div>
      <video
        className="mdcc-demo-video-player"
        src="/demo.mp4"
        poster="/demo-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        controls
        controlsList="nodownload"
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    </section>
  );
}
