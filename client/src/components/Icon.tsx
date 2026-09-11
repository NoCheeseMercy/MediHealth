import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Semantic glyph names. Screens ask for `icon="pill"`, never a raw glyph string,
 * so the whole app can be re-skinned by editing this map alone.
 * Validated against MaterialCommunityIcons 6596-glyph set.
 */
export const GLYPHS = {
  home: 'home',
  dashboard: 'chart-areaspline',
  medications: 'pill',
  medication: 'medical-bag',
  scan: 'camera-retake',
  camera: 'camera-plus',
  gallery: 'image-plus',
  history: 'history',
  profile: 'account-circle-outline',
  settings: 'cog-outline',
  reminders: 'bell-outline',
  reminderOn: 'bell-ring-outline',
  clock: 'clock-outline',
  schedule: 'calendar-month-outline',
  shield: 'shield-check',
  shieldAlert: 'shield-alert',
  shieldOff: 'shield-off-outline',
  alert: 'alert-circle-outline',
  info: 'information-outline',
  check: 'check-circle-outline',
  checkAll: 'check-all',
  close: 'close',
  plus: 'plus',
  search: 'magnify',
  chevronRight: 'chevron-right',
  chevronLeft: 'chevron-left',
  chevronDown: 'chevron-down',
  delete: 'delete-outline',
  edit: 'pencil-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  lock: 'lock-outline',
  email: 'email-outline',
  logout: 'logout',
  language: 'translate',
  moon: 'weather-night',
  sun: 'white-balance-sunny',
  auto: 'monitor-screenshot',
  trending: 'trending-up',
  bulb: 'lightbulb-outline',
  water: 'water-outline',
  food: 'food-apple-outline',
  flash: 'flash-outline',
  heart: 'heart-pulse',
  document: 'file-document-outline',
  clipboard: 'clipboard-text-outline',
  refresh: 'refresh',
  dots: 'dots-vertical',
  stethoscope: 'stethoscope',
  notes: 'text',
  bookmark: 'bookmark-outline',
  tune: 'tune',
  download: 'download',
} as const;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  name: IconName;
  size?: number;
  /** Omit to inherit the themed text color. */
  color?: string;
  style?: React.ComponentProps<typeof MaterialCommunityIcons>['style'];
}

export function Icon({ name, size = 22, color, style }: IconProps) {
  const { colors } = useTheme();
  return (
    <MaterialCommunityIcons
      name={GLYPHS[name]}
      size={size}
      color={color ?? colors.textSecondary}
      style={style}
      // Keeps the glyph from being read out as noise by TalkBack / VoiceOver
      // when it sits next to a real text label.
      accessible={false}
    />
  );
}

export default Icon;
