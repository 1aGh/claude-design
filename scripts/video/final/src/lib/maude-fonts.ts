/**
 * Font loading for the v4 maude-DS intro film.
 *
 * The maude DS type stack is Inter Tight (display) + Inter (body) + JetBrains
 * Mono (mono). All three are on Google Fonts, so unlike the project DS (Berkeley
 * Mono, license-gated) these load deterministically in CI / headless Chromium.
 */

import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';

export const inter = loadInter('normal', { weights: ['400', '500', '600'] });
export const interTight = loadInterTight('normal', { weights: ['600', '700'] });
export const jetBrainsMono = loadJetBrains('normal', { weights: ['400', '500', '700'] });

export const ensureMaudeFontsLoaded = async () => {
  await Promise.all([
    inter.waitUntilDone(),
    interTight.waitUntilDone(),
    jetBrainsMono.waitUntilDone(),
  ]);
};
