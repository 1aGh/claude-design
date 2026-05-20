/**
 * DemoVideo — autoplay-muted loop of the marketing demo at site/public/demo.mp4.
 *
 * Sized via mdcc-demo-video CSS class (global.css) — catalog-graded chrome
 * (1 px hairline frame, SKU stamp top-left, hold-and-loop semantics, paper
 * background to match catalog cards). Reduced motion users get a poster
 * frame, no autoplay.
 */
export function DemoVideo() {
  return (
    <section className="mdcc-demo-video" aria-label="Live demo">
      <div className="mdcc-demo-video-head">
        <span>
          <strong>demo.mp4</strong> · ~90 s · catalog cut
        </span>
        <span>MDCC-MKT/00 · v0.16.0</span>
      </div>
      <video
        className="mdcc-demo-video-player"
        src="/demo.mp4"
        poster="/demo-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    </section>
  );
}
