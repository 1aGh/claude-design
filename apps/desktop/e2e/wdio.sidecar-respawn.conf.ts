/**
 * WebdriverIO config for the issue #115 regression scenario.
 *
 * ONE THING MAKES THIS CONFIG NECESSARY: the canvas-origin split must be ON.
 * The base config forces `MAUDE_CANVAS_ORIGIN_SPLIT=0` so WebDriver can switch
 * into a same-origin canvas iframe — but with the split off there IS no separate
 * canvas origin, `canvasOrigin` is absent from `/_config`, and `canvasUrl()`
 * returns a relative URL that survives a respawn for free. The bug would be
 * unreproducible and the scenario would pass against the broken code.
 *
 * The assignment below runs AFTER `./wdio.conf`'s module body (ESM evaluates the
 * import first), so it overwrites the base's `0` — and the value is read by the
 * app at launch, not at config load, so the override is what the sidecar sees.
 *
 * The trade-off this buys back: the canvas iframe is cross-origin here, so
 * `enterCanvasFrame()` will NOT work in this suite. The scenario is written to
 * assert entirely from the top frame (`data-canvas-state`) for that reason.
 *
 * Run: `pnpm test:e2e:desktop:sidecar-respawn`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as base } from './wdio.conf';

const HERE = dirname(fileURLToPath(import.meta.url));

// The whole reason this config exists — see the header.
process.env.MAUDE_CANVAS_ORIGIN_SPLIT = '1';

const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
process.env.MAUDE_E2E_RUN_DIR = resolve(
  HERE,
  '../../../.ai/device/scenario-runs/sidecar-respawn-canvas-switch',
  stamp
);

export const config: WebdriverIO.Config = {
  ...base,
  specs: [resolve(HERE, 'scenarios', 'sidecar-respawn-canvas-switch.e2e.ts')],
  // A crash + respawn + two cold canvas mounts, each of which can pay the
  // boot-self-heal cost on a fresh bundle.
  mochaOpts: { ...base.mochaOpts, timeout: 480_000 },
};
