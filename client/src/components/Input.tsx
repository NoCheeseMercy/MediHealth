import React, { useState } from 'react';
import { TextInput, View, Text, Pressable, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Icon, type IconName } from './Icon';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows a show/hide toggle and starts masked. */
  secure?: boolean;
  icon?: IconName;
}

export function Input({ label, error, hint, secure, icon, style, multiline, ...props }: InputProps) {
  const { colors, radius, font, isRTL } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.ring : colors.border;

  // RN's paddingStart/End follow I18nManager, which this app doesn't flip
  // globally (it aligns per-text instead), so compute the sides by hand.
  const leadingPad = icon ? 44 : 16;
  const trailingPad = secure ? 46 : 16;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text
          style={[
            font.label,
            { color: colors.textSecondary, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
        {icon ? (
          <View
            pointerEvents="none"
            style={[styles.adornment, isRTL ? styles.adornmentRight : styles.adornmentLeft]}
          >
            <Icon name={icon} size={19} color={focused ? colors.ring : colors.textMuted} />
          </View>
        ) : null}

        <TextInput
          {...props}
          multiline={multiline}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor,
              borderRadius: radius.md,
              color: colors.text,
              textAlign: isRTL ? 'right' : 'left',
              paddingHorizontal: isRTL ? trailingPad : leadingPad,
              paddingVertical: multiline ? 14 : 14,
              minHeight: multiline ? 110 : 52,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
        />

        {secure ? (
          <View style={[styles.adornment, isRTL ? styles.adornmentLeft : styles.adornmentRight]}>
            <Pressable
              onPress={() => setRevealed((r) => !r)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 10 }}
            >
              <Icon name={revealed ? 'eyeOff' : 'eye'} size={19} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
          }}
        >
          <Icon name="alert" size={13} color={colors.danger} />
          <Text style={[font.caption, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text
          style={[
            font.caption,
            { color: colors.textMuted, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  adornment: { position: 'absolute', zIndex: 2 },
  adornmentLeft: { left: 12 },
  adornmentRight: { right: 12 },
});

export default Input;
