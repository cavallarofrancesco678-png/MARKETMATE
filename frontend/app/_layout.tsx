import React, { useEffect, useCallback, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { useAppStore } from '../src/store/appStore';
import { useAuthStore } from '../src/store/authStore';
import { useTutorialStore } from '../src/store/tutorialStore';
import { useAppLockStore } from '../src/store/appLockStore';
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
  const hydrateLock = useAppLockStore((s) => s.hydrate);
  const lockApp = useAppLockStore((s) => s.lock);

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
      try { await hydrateLock(); } catch (e) { console.warn('lock hydrate failed', e); }
      if (!cancelled) setStorageHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [loadFromStorage, authHydrate, tutHydrate, hydrateLock]);

  // ═══ APP LOCK GATE ═══
  // Quando l'app passa in background/inactive → re-lock. Al ritorno in foreground,
  // se era sbloccata, forziamo redirect a `/` (login) per richiedere il PIN.
  // La navigazione interna tra pagine NON triggera questo: solo il passaggio
  // dell'app in background lo fa.
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      const prev = prevAppState.current;
      // active → background/inactive → blocca
      if (prev === 'active' && (next === 'background' || next === 'inactive')) {
        lockApp();
      }
      // background/inactive → active → se configurato con PIN, manda al login
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        const { isLocked, hasPin } = useAppLockStore.getState();
        const { isConfigured } = useAppStore.getState();
        if (isLocked && hasPin && isConfigured) {
          try { router.replace('/'); } catch {}
        }
      }
      prevAppState.current = next;
    };
    const sub = AppState.addEventListener('change', handler);
    return () => { sub.remove(); };
  }, [lockApp]);

  // ═══ NOTA: l'auto-start del tutorial è stato spostato in /home/index.tsx
  // Così i pop-up NON appaiono durante la schermata Welcome / Setup iniziale
  // (l'utente può inserire tutti i dati senza interferenze).
  // Il tutorial parte automaticamente SOLO al primo ingresso in Home. ═══

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
