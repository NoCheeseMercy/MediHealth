import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  /** Leading glyph. */
  icon?: IconName;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  textStyle,
  fullWidth = true,
  icon,
}: ButtonProps) {
  const { colors, radius, isRTL } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<NonNullable<ButtonProps['variant']>, { bg: string; text: string; border: string }> = {
    primary: { bg: colors.primary, text: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.secondary, text: colors.onPrimary, border: colors.secondary },
    outline: { bg: 'transparent', text: colors.primary, border: colors.borderStrong },
    ghost: { bg: 'transparent', text: colors.textSecondary, border: 'transparent' },
    danger: { bg: colors.danger, text: colors.onPrimary, border: colors.danger },
    soft: { bg: colors.primarySoft, text: colors.onPrimarySoft, border: colors.primarySoft },
  };

  const heights = { sm: 40, md: 50, lg: 56 } as const;
  const fontSizes = { sm: 14, md: 15, lg: 16 } as const;
  const iconSizes = { sm: 16, md: 18, lg: 20 } as const;

  const v = palette[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderRadius: radius.md,
          height: heights[size],
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSizes[size]} color={v.text} /> : null}
          <Text style={[styles.text, { color: v.text, fontSize: fontSizes[size] }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});

export default Button;
