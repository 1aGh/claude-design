/**
 * Font loading for Remotion compositions.
 *
 * The active DS (project) uses Berkeley Mono / TX-02 as the primary type —
 * licensed fonts, not available on Google Fonts. We fall back to JetBrains
 * Mono via @remotion/google-fonts/JetBrainsMono so Remotion renders something
 * monospace and deterministic in CI/headless contexts.
 *
 * On the local dev machine where Berkeley Mono is installed, the token's
 * font stack ('Berkeley Mono', 'JetBrains Mono', …) will resolve to Berkeley
 * first. In CI or fresh checkouts where it isn't installed, JetBrains Mono
 * (loaded here) is the deterministic fallback.
 */

import { loadFont } from '@remotion/google-fonts/JetBrainsMono';

export const jetBrainsMono = loadFont('normal', {
  weights: ['400', '500', '700'],
});

export const ensureFontsLoaded = async () => {
  await jetBrainsMono.waitUntilDone();
};
