import React, { useEffect, useCallback, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
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

// ═══ NESSUN WIPE FORZATO ═══
// Android isola automaticamente lo storage di ogni nuova installazione, quindi
// chi scarica l'APK per la PRIMA VOLTA su un dispositivo trova l'app vuota
// senza bisogno di alcun reset esplicito.
// Chi AGGIORNA l'app da una versione precedente mantiene tutti i suoi dati
// (storico giornate, fornitori, fiere, configurazione, PIN, ecc.).
//
// In passato qui c'era una funzione freshInstallWipe() che azzerava lo storage
// al primo avvio basandosi su un flag versione: è stata RIMOSSA perché causava
// la perdita di dati agli utenti che aggiornavano l'app.

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
      // Hydrate normale degli store. Su nuova installazione i campi sono vuoti;
      // su aggiornamento mantengono i valori dell'utente.
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
  //
  // IMPORTANTE:
  //  • Su WEB il re-lock è DISATTIVATO: nel browser "andare in background"
  //    significa cambiare tab / minimizzare la finestra, quindi chiedere il PIN
  //    ogni volta sarebbe scomodo. Su web il PIN è richiesto solo al cold start.
  //  • Su mobile nativo è attivo MA con un grace period di 60 secondi:
  //    se l'utente rientra entro questo tempo (es. risposta a notifica rapida)
  //    non viene richiesto il PIN.
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);
  const lastBackgroundAt = useRef<number>(0);
  const GRACE_MS = 60_000; // 60 secondi

  useEffect(() => {
    if (Platform.OS === 'web') return; // disattivato su web
    const handler = (next: AppStateStatus) => {
      const prev = prevAppState.current;
      // active → background/inactive → memorizza timestamp
      if (prev === 'active' && (next === 'background' || next === 'inactive')) {
        lastBackgroundAt.current = Date.now();
      }
      // background/inactive → active
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        const elapsed = Date.now() - lastBackgroundAt.current;
        if (elapsed > GRACE_MS) {
          // Oltre il grace period: re-lock e redirect al login
          lockApp();
          const { hasPin } = useAppLockStore.getState();
          const { isConfigured } = useAppStore.getState();
          if (hasPin && isConfigured) {
            try { router.replace('/'); } catch {}
          }
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
