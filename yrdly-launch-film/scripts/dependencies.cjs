const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '../../..');
const mobile = process.env.YRDLY_MOBILE_ROOT || path.join(workspace, 'yrdly-mobile');
const filmTools = process.env.YRDLY_RENDER_TOOLS || path.join(workspace, 'landing-page-flyover');
const local = createRequire(path.join(root, 'package.json'));
const app = createRequire(path.join(mobile, 'package.json'));
const render = createRequire(path.join(filmTools, 'package.json'));
function dep(name) {
  try { return local(name); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return ['sharp', '@playwright/test'].includes(name) ? render(name) : app(name);
  }
}
module.exports = {root, mobile, workspace, dep};
