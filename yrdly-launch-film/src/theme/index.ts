import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
export const C = {
  green: '#82DB7E',
  ink: '#0B160F',
  paper: '#F2F0E7',
  yellow: '#F7F17C',
  forest: '#163C2B',
};
export const fontsReady = Promise.all([
  loadFont({ family: 'Outfit', url: staticFile('brand/fonts/Outfit_700Bold.ttf'), weight: '700' }),
  loadFont({
    family: 'Outfit',
    url: staticFile('brand/fonts/Outfit_800ExtraBold.ttf'),
    weight: '800',
  }),
  loadFont({ family: 'Inter', url: staticFile('brand/fonts/Inter_500Medium.ttf'), weight: '500' }),
]);
