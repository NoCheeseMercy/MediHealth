import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Icon, type IconName } from '../src/components/Icon';
import { Button } from '../src/components/Button';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  const slides: { title: string; desc: string; icon: IconName }[] = [
    { title: t('onboarding1Title'), desc: t('onboarding1Desc'), icon: 'bulb' },
    { title: t('onboarding2Title'), desc: t('onboarding2Desc'), icon: 'scan' },
    { title: t('onboarding3Title'), desc: t('onboarding3Desc'), icon: 'reminders' },
    { title: t('onboarding4Title'), desc: t('onboarding4Desc'), icon: 'dashboard' },
  ];

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_complete', '1');
    router.replace('/login');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <LinearGradient colors={[colors.heroFrom, colors.heroTo]} style={styles.container}>
      {/* Skip was pinned `right: 24` unconditionally — sat over the content in RTL. */}
      <TouchableOpacity
        style={[styles.skip, isRTL ? { left: 24 } : { right: 24 }, { top: insets.top + 14 }]}
        onPress={finish}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{t('skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={ref}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconRing, { borderRadius: radius.pill }]}>
              <Icon name={item.icon} size={40} color="#FFF" />
            </View>
            <Text style={[styles.title, { textAlign: 'center' }]}>{item.title}</Text>
            <Text style={[styles.desc, { textAlign: 'center' }]}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <Button
          title={index === slides.length - 1 ? t('getStarted') : t('next')}
          onPress={() => {
            if (index === slides.length - 1) finish();
            else ref.current?.scrollToIndex({ index: index + 1 });
          }}
          icon={index === slides.length - 1 ? 'check' : undefined}
          style={styles.cta}
          textStyle={{ color: colors.heroFrom }}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { position: 'absolute', zIndex: 10 },
  skipText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700', padding: 8 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 60 },
  iconRing: {
    width: 108,
    height: 108,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  title: { fontSize: 27, fontWeight: '800', color: '#FFF', marginBottom: 14, letterSpacing: -0.5 },
  desc: { fontSize: 16, color: 'rgba(255,255,255,0.88)', lineHeight: 25 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 26, backgroundColor: '#FFF' },
  footer: { paddingHorizontal: 24 },
  cta: { backgroundColor: '#FFF', borderColor: '#FFF' },
});
