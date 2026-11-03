import { Config } from '@remotion/cli/config';
Config.setPublicDir('assets');
Config.setBrowserExecutable('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
// Parallel Chrome captures produce tiled frames on this rendering machine.
Config.setConcurrency(1);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
