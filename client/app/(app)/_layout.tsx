import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Icon, type IconName } from '../../src/components/Icon';

function TabIcon({ name, color, focused, activeBg }: { name: IconName; color: string; focused: boolean; activeBg: string }) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: activeBg, borderRadius: 14 }]}>
      {/* Shape changes as well as color, so active state survives grayscale and
          color-blindness where a tint swap alone would not. */}
      <Icon name={name} size={focused ? 22 : 21} color={color} />
    </View>
  );
}

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isRTL } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const tabHeight = 62 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 0);

  const screens: { name: string; label: string; icon: IconName }[] = [
    { name: 'index', label: t('dashboard'), icon: 'home' },
    { name: 'medications', label: t('medications'), icon: 'medications' },
    { name: 'scanner', label: t('scanMedication'), icon: 'scan' },
    { name: 'history', label: t('analysisHistory'), icon: 'history' },
    { name: 'profile', label: t('profile'), icon: 'profile' },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0, marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
        },
      }}
    >
      {screens.map((s) => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{
            title: s.label,
            tabBarLabel: s.label,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={s.icon} color={color} focused={focused} activeBg={colors.primarySoft} />
            ),
          }}
        />
      ))}

      {/* Detail & flow screens live in this group but stay off the tab bar. */}
      {['analysis/[id]', 'medications/[id]', 'medications/add', 'reminders', 'settings', 'analyze'].map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}

      <Tabs.Screen name="+not-found" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 30,
  },
});
