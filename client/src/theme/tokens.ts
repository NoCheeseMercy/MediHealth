/**
 * Design tokens for MediHealth.
 *
 * Two palettes (light/dark) that expose the *same keys* so components never
 * branch on isDark. Colors are chosen for WCAG AA contrast against their own
 * backgrounds — the previous theme shipped 7 keys and no semantic colors, which
 * forced every component to hardcode hex values and broke dark mode wholesale.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Palette {
  /** App canvas, behind everything. */
  background: string;
  /** Elevated canvas for hero areas / nav bars. */
  backgroundElevated: string;
  /** Standard card surface. Kept as `card` for back-compat. */
  surface: string;
  /** Cards nested inside other cards. */
  surfaceRaised: string;
  /** Low-emphasis fills: chips, inputs, dividers-between rows. */
  surfaceMuted: string;
  /** Overlay scrim behind modals. */
  overlay: string;

  /** Primary brand fill — pair with `onPrimary` for text. */
  primary: string;
  /** Stronger primary for pressed states and emphasis. */
  primaryStrong: string;
  /** Text/icon color that sits on `primary`. */
  onPrimary: string;
  /** Pale primary wash for soft badges and selected rows. */
  primarySoft: string;
  /** Readable text on `primarySoft`. */
  onPrimarySoft: string;

  /** Secondary brand accent (info-ish). */
  secondary: string;
  secondarySoft: string;
  onSecondarySoft: string;

  text: string;
  textSecondary: string;
  /** Placeholders, disabled labels, timestamps. */
  textMuted: string;
  /** Text on any brand-filled surface. */
  onDark: string;

  border: string;
  borderStrong: string;

  success: string;
  successSoft: string;
  onSuccessSoft: string;
  warning: string;
  warningSoft: string;
  onWarningSoft: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;

  /** Score tiers. Distinct from success/warning/danger: "monitor" is amber,
   *  "warning" is orange, so a 55 and a 45 don't look identical. */
  tierSafe: string;
  tierSafeSoft: string;
  tierMonitor: string;
  tierMonitorSoft: string;
  tierCaution: string;
  tierCautionSoft: string;
  tierDanger: string;
  tierDangerSoft: string;

  /** Gradient stops for the header. */
  heroFrom: string;
  heroTo: string;
  /** Ring color for focused inputs. */
  ring: string;
  shadow: string;
}

const light: Palette = {
  background: '#F4F7F7',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EDF2F2',
  overlay: 'rgba(6, 24, 27, 0.55)',

  primary: '#0F766E',
  primaryStrong: '#115E59',
  onPrimary: '#FFFFFF',
  primarySoft: '#D9F1EE',
  onPrimarySoft: '#0B4F4A',

  secondary: '#0369A1',
  secondarySoft: '#DBEAFE',
  onSecondarySoft: '#1E40AF',

  text: '#081A1D',
  textSecondary: '#4A6165',
  textMuted: '#7C9296',
  onDark: '#FFFFFF',

  border: '#DCE6E6',
  borderStrong: '#B9C9C9',

  success: '#047857',
  successSoft: '#D6F3E4',
  onSuccessSoft: '#065F46',
  warning: '#B45309',
  warningSoft: '#FCEBC8',
  onWarningSoft: '#8A4506',
  danger: '#BE123C',
  dangerSoft: '#FBE0E4',
  onDangerSoft: '#9F1239',

  tierSafe: '#047857',
  tierSafeSoft: '#D6F3E4',
  tierMonitor: '#B45309',
  tierMonitorSoft: '#FCEBC8',
  tierCaution: '#C2410C',
  tierCautionSoft: '#FEE4D2',
  tierDanger: '#BE123C',
  tierDangerSoft: '#FBE0E4',

  heroFrom: '#0F766E',
  heroTo: '#0E7490',
  ring: '#0F766E',
  shadow: 'rgba(8, 26, 29, 0.09)',
};

const dark: Palette = {
  background: '#071417',
  backgroundElevated: '#0D1F23',
  surface: '#102A2F',
  surfaceRaised: '#17373D',
  surfaceMuted: '#0B2126',
  overlay: 'rgba(0, 0, 0, 0.66)',

  primary: '#2CC9B8',
  primaryStrong: '#5EEAD4',
  onPrimary: '#04211E',
  primarySoft: '#0F3A3A',
  onPrimarySoft: '#8EE7DA',

  secondary: '#38BDF8',
  secondarySoft: '#12303F',
  onSecondarySoft: '#7DD3FC',

  text: '#E9F3F2',
  textSecondary: '#9DB6B7',
  textMuted: '#6E8A8C',
  onDark: '#04211E',

  border: '#1E3E44',
  borderStrong: '#2C555C',

  success: '#34D399',
  successSoft: '#0C3529',
  onSuccessSoft: '#6EE7B7',
  warning: '#FBBF24',
  warningSoft: '#3B2A08',
  onWarningSoft: '#FCD34D',
  danger: '#FB7185',
  dangerSoft: '#3D1520',
  onDangerSoft: '#FDA4AF',

  tierSafe: '#34D399',
  tierSafeSoft: '#0C3529',
  tierMonitor: '#FBBF24',
  tierMonitorSoft: '#3B2A08',
  tierCaution: '#FB923C',
  tierCautionSoft: '#3D2410',
  tierDanger: '#FB7185',
  tierDangerSoft: '#3D1520',

  heroFrom: '#0B3A3C',
  heroTo: '#08282F',
  ring: '#2CC9B8',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

export const palettes: Record<'light' | 'dark', Palette> = { light, dark };

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 44,
} as const;

export const font = {
  /** Big screen titles. */
  display: { fontSize: 27, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 23 },
  /** Labels above inputs, section headers. */
  label: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.2 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 19 },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.4 },
  /** Tabular figures so scores in a list line up. */
  metric: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -1 },
} as const;

export type { Palette as ThemeColors };
