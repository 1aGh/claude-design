import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Coffee } from 'lucide-react';
import { gitConfig } from './shared';

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
        text: (
          <span className="inline-flex items-center gap-1.5">
            <Coffee size={14} aria-hidden />
            Buy me a coffee
          </span>
        ),
        url: 'https://www.buymeacoffee.com/mdovrtelm',
        external: true,
      },
    ],
    githubUrl,
  };
}
