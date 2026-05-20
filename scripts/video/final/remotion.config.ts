import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(23);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
