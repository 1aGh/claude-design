// LICENSE-NOTE: Remotion is used here under the free-tier license
// (https://www.remotion.dev/docs/license). maude is a solo OSS project (≤3
// employees as of 2026-05-20), which qualifies. If the org grows beyond 3
// people, a Company License ($100/mo) is required before this code can keep
// rendering.
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(23);
