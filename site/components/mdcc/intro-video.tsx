/**
 * IntroVideo — the landing intro-film player placement (board A of
 * .design/ui/Studio Intro Video.tsx, maude DS). Ported pixels, not re-derived.
 *
 * The 38-second film is a CONTENT FOLLOW-UP — this ships the polished player
 * chrome now (dotted stage + play control + scrubber) with the control
 * disabled and a "coming soon" badge. When the cut lands, swap the stage for a
 * real <video src poster> and enable the controls.
 *
 * Dependency-free server component; icons inlined (thin-stroke 1.4 line glyphs).
 */

type IconName = 'play' | 'volume' | 'cc' | 'expand';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  play: <polygon points="5 3.5 12.5 8 5 12.5" fill="currentColor" stroke="none" />,
  volume: (
    <>
      <polygon points="3 6 5.5 6 8 3.5 8 12.5 5.5 10 3 10" fill="currentColor" stroke="none" />
      <path d="M10.5 6a3 3 0 0 1 0 4" />
    </>
  ),
  cc: (
    <>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <path d="M6.5 7a1.4 1.4 0 0 0-2 1.2 1.4 1.4 0 0 0 2 1.2" />
      <path d="M11 7a1.4 1.4 0 0 0-2 1.2 1.4 1.4 0 0 0 2 1.2" />
    </>
  ),
  expand: (
    <>
      <polyline points="3 6 3 3 6 3" />
      <polyline points="10 3 13 3 13 6" />
      <polyline points="13 10 13 13 10 13" />
      <polyline points="6 13 3 13 3 10" />
    </>
  ),
};

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export function IntroVideo() {
  return (
    <section className="mdcc-iv" aria-label="Intro video — coming soon">
      <div className="mdcc-iv-stage" role="img" aria-label="Maude intro video poster — coming soon">
        <button
          type="button"
          className="mdcc-iv-play"
          aria-label="Intro video — coming soon"
          disabled
        >
          <Icon name="play" size={30} />
        </button>
      </div>
      <div className="mdcc-iv-title">
        Maude in 38 seconds<small>v3 · re-cut · captions on</small>
      </div>
      <span className="mdcc-iv-badge">intro · coming soon</span>
      <div className="mdcc-iv-cap">“The repo is the source of truth.”</div>
      <div className="mdcc-iv-scrub" aria-hidden="true">
        <span className="mdcc-iv-scrub-ic">
          <Icon name="play" size={14} />
        </span>
        <span className="mdcc-iv-scrub-ic">
          <Icon name="volume" size={14} />
        </span>
        <div className="mdcc-iv-scrub-track">
          <div className="mdcc-iv-scrub-fill" />
          <span className="mdcc-iv-scrub-chap" style={{ left: '24%' }} />
          <span className="mdcc-iv-scrub-chap" style={{ left: '58%' }} />
          <span className="mdcc-iv-scrub-chap" style={{ left: '82%' }} />
        </div>
        <span className="mdcc-iv-scrub-time">0:00 / 0:38</span>
        <span className="mdcc-iv-scrub-ic">
          <Icon name="cc" size={14} />
        </span>
        <span className="mdcc-iv-scrub-ic">
          <Icon name="expand" size={14} />
        </span>
      </div>
    </section>
  );
}
