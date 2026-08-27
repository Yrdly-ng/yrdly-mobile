/**
 * YRDLY Design Tokens
 * Source of truth for all colors, spacing, radii, and typography.
 * Derived from Figma Make output — yrdly-technical-summary.md §2 & §5.
 */

// ─── Core Palette ────────────────────────────────────────────────────────────
export const G = '#82DB7E'; // YRDLY Green — primary accent
export const GLOW = 'rgba(130,219,126,0.26)'; // Green ambient glow / shadow
export const GLOW_STRONG = 'rgba(130,219,126,0.45)'; // Bright green glow
export const DARK = '#050505'; // True deep black canvas
export const SURFACE_ALT = '#0A0A0A'; // Slightly lifted canvas
export const GLASS_BG = 'rgba(8,8,8,0.74)'; // Frosted glass background
export const GLASS_BORDER = 'rgba(255,255,255,0.09)'; // Glass surface border
export const SURFACE = 'rgba(255,255,255,0.055)'; // Elevated card / row
export const LABEL = 'rgba(255,255,255,0.38)'; // Secondary / muted label
export const MUTED = 'rgba(255,255,255,0.55)'; // Tertiary body text

// ─── Text ─────────────────────────────────────────────────────────────────────
export const TEXT_PRIMARY = '#FFFFFF';
export const TEXT_SECONDARY = '#A0A0A0';

// ─── Functional / Semantic Accents ───────────────────────────────────────────
export const GOLD = '#F59E0B'; // Marketplace & Verified Gold
export const BLUE = '#2196F3'; // Information
export const AMBER = '#E65100'; // Safety Alert Amber
export const RED = '#EF4444'; // Emergency / Danger
export const DANGER = '#FF5C5C'; // Inline error
export const WARNING = '#FFB648'; // Inline warning
export const DIVIDER = 'rgba(255,255,255,0.09)';

// ─── Severity Colors (Safety Alert System) ───────────────────────────────────
export const SEVERITY = {
  information: {
    bg: 'rgba(33,150,243,0.08)',
    border: 'rgba(33,150,243,0.25)',
    text: '#64B5F6',
    icon: '#2196F3',
  },
  caution: {
    bg: 'rgba(230,81,0,0.08)',
    border: 'rgba(230,81,0,0.28)',
    text: '#FFB74D',
    icon: '#E65100',
  },
  urgent: {
    bg: 'rgba(183,28,28,0.12)',
    border: 'rgba(239,68,68,0.3)',
    text: '#EF4444',
    icon: '#EF4444',
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20, // screen horizontal padding
  xl: 24, // section gap
  xxl: 32,
  h40: 40,
  h48: 48,
  h64: 64,
  h96: 96,
  /** iOS home indicator safe area clearance */
  safeBottom: 34,
  /** Status bar clearance */
  safeTop: 54,
} as const;

// ─── Border Radii ─────────────────────────────────────────────────────────────
export const radii = {
  card: 20,
  modal: 24,
  glassCard: 32,
  input: 16,
  button: 18,
  chip: 20,
  badge: 8,
  iconBox: 12,
  bottomSheet: 24,
  avatar: 9999,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const fonts = {
  display: 'Outfit',
  body: 'Inter',
} as const;

// ─── Glassmorphism helpers ────────────────────────────────────────────────────
export const glass = {
  background: GLASS_BG,
  border: GLASS_BORDER,
  borderWidth: 1,
  borderRadius: radii.card,
  /** For expo-blur: use <BlurView intensity={80} tint="dark" /> */
  blurIntensity: 80,
} as const;

// ─── Convenience flat export (mirrors Figma Make tokens object) ───────────────
const tokens = {
  G,
  GLOW,
  GLOW_STRONG,
  DARK,
  SURFACE_ALT,
  GLASS_BG,
  GLASS_BORDER,
  SURFACE,
  LABEL,
  MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
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
} as const;

export default tokens;
