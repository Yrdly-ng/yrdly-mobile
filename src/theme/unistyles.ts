import { UnistylesRegistry } from 'react-native-unistyles';
import { Appearance } from 'react-native';
import { getStoredThemePreferenceSync } from '../lib/theme-preference';
import {
  G,
  GLOW,
  GLOW_STRONG,
  GOLD,
  BLUE,
  AMBER,
  RED,
  DANGER,
  WARNING,
  DIVIDER,
  SEVERITY,
  spacing,
  radii,
  fonts,
  glass,
} from '../constants/tokens';

export const darkTheme = {
  colors: {
    G,
    GLOW,
    GLOW_STRONG,
    DARK: '#050505',
    SURFACE_ALT: '#0A0A0A',
    GLASS_BG: 'rgba(8,8,8,0.74)',
    GLASS_BORDER: 'rgba(255,255,255,0.09)',
    SURFACE: 'rgba(255,255,255,0.055)',
    LABEL: 'rgba(255,255,255,0.38)',
    MUTED: 'rgba(255,255,255,0.55)',
    SKELETON: 'rgba(255,255,255,0.14)',
    TEXT_PRIMARY: '#FFFFFF',
    TEXT_SECONDARY: '#A0A0A0',
    GOLD,
    BLUE,
    AMBER,
    RED,
    DANGER,
    WARNING,
    DIVIDER,
  },
  spacing,
  radii,
  fonts,
  glass,
  SEVERITY,
};

export const lightTheme = {
  colors: {
    G,
    GLOW,
    GLOW_STRONG,
    DARK: '#FFFFFF', // True black -> True white
    SURFACE_ALT: '#F9F9F9', // Lifted canvas -> Light gray
    GLASS_BG: 'rgba(255,255,255,0.74)',
    GLASS_BORDER: 'rgba(0,0,0,0.09)',
    SURFACE: 'rgba(0,0,0,0.055)',
    LABEL: 'rgba(0,0,0,0.45)',
    MUTED: 'rgba(0,0,0,0.6)',
    SKELETON: 'rgba(0,0,0,0.09)',
    TEXT_PRIMARY: '#1C1C1C',
    TEXT_SECONDARY: '#757575',
    GOLD,
    BLUE,
    AMBER,
    RED,
    DANGER,
    WARNING,
    DIVIDER: 'rgba(0,0,0,0.09)',
  },
  spacing,
  radii,
  fonts,
  glass: {
    ...glass,
    background: 'rgba(255,255,255,0.74)',
    border: 'rgba(0,0,0,0.09)',
    blurIntensity: 80,
  },
  SEVERITY,
};

export const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

const breakpoints = {
  phone: 0,
  tablet: 768,
  large: 1024,
};

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

UnistylesRegistry.addBreakpoints(breakpoints)
  .addThemes({
    light: lightTheme,
    dark: darkTheme,
  })
  .addConfig({
    adaptiveThemes: false,
    // Resolve the saved theme before the first paint so every screen renders
    // in one theme from the start, instead of flashing the system theme first.
    initialTheme: getStoredThemePreferenceSync() ?? Appearance.getColorScheme() ?? 'dark',
  });
