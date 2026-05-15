import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';

// Mobile theme toggle — fumadocs renders it inside the burger menu (HomeLayout
// Header → NavigationMenuContent) and the sidebar drawer footer (DocsLayout).
// Keyboard-reachable via the menu trigger; we deliberately do NOT shadow the
// fumadocs button because DDR-011 mandates re-skin, not fork.
export function baseOptions(): BaseLayoutProps {
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <span className="mdcc-wm">md-claude</span>
          <span className="mdcc-sku">MDCC/00</span>
        </span>
      ),
    },
    links: [
      { text: 'Docs', url: '/docs' },
      { text: 'Plugins', url: '/#plugins' },
      { text: 'Source', url: githubUrl, external: true },
      {
        text: 'Buy me a coffee',
        url: 'https://www.buymeacoffee.com/mdovrtelm',
        external: true,
      },
    ],
    githubUrl,
  };
}
