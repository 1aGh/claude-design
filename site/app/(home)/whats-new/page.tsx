import { permanentRedirect } from 'next/navigation';

// What's New folded into the combined Changelog & Roadmap timeline (DDR-09X).
// The release notes now render as the "Shipped" group of /changelog.
export default function WhatsNewPage() {
  permanentRedirect('/changelog');
}
