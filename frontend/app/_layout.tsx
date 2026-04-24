import React, { useEffect, useCallback, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { useAppStore } from '../src/store/appStore';
import { useAuthStore } from '../src/store/authStore';
import { useTutorialStore } from '../src/store/tutorialStore';
import { TutorialOverlay } from '../src/components/TutorialOverlay';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });
  const [storageHydrated, setStorageHydrated] = useState(false);
  const loadFromStorage = useAppStore((s) => s.loadFromStorage);
  const authHydrate = useAuthStore((s) => s.hydrate);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const tutHydrate = useTutorialStore((s) => s.hydrate);
  const tutHydrated = useTutorialStore((s) => s.isHydrated);
  const tutHasCompleted = useTutorialStore((s) => s.hasCompletedOnce);
  const tutStart = useTutorialStore((s) => s.start);
  const isConfigured = useAppStore((s) => s.isConfigured);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded && storageHydrated && authHydrated && tutHydrated) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, storageHydrated, authHydrated, tutHydrated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadFromStorage(); } catch (e) { console.warn('loadFromStorage failed', e); }
      try { await authHydrate(); } catch (e) { console.warn('auth hydrate failed', e); }
      try { await tutHydrate(); } catch (e) { console.warn('tut hydrate failed', e); }
      if (!cancelled) setStorageHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [loadFromStorage, authHydrate, tutHydrate]);

  // ═══ AUTO-START tutorial per nuovi utenti ═══
  useEffect(() => {
    if (storageHydrated && tutHydrated && !tutHasCompleted && !isConfigured) {
      // Piccolo delay per far montare il resto dell'app
      const t = setTimeout(() => tutStart(), 900);
      return () => clearTimeout(t);
    }
  }, [storageHydrated, tutHydrated, tutHasCompleted, isConfigured, tutStart]);

  useEffect(() => { onLayoutReady(); }, [onLayoutReady]);

  if (!fontsLoaded || !storageHydrated || !authHydrated || !tutHydrated) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" translucent={false} backgroundColor="#D8EDE5" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="home" />
        <Stack.Screen name="auth/index" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Tutorial overlay sopra tutte le schermate */}
      <TutorialOverlay />
    </SafeAreaProvider>
  );
}
