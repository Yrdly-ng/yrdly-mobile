import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const local = createRequire(import.meta.url);
const sibling = createRequire(path.resolve('../../../landing-page-flyover/package.json'));
function find(name) {
  try {
    return local(name);
  } catch {
    return sibling(name);
  }
}
export const ffmpeg = process.env.FFMPEG_PATH || find('ffmpeg-static');
export const ffprobe =
  process.env.FFPROBE_PATH ||
  path.resolve(
    '../../../landing-page-flyover/node_modules/.pnpm/@ffprobe-installer+darwin-x64@5.1.0/node_modules/@ffprobe-installer/darwin-x64/ffprobe'
  );
if (!fs.existsSync(ffmpeg)) throw Error('Set FFMPEG_PATH to a compatible FFmpeg executable.');
