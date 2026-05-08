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
  // FIX UX (richiesta utente): il re-lock automatico quando l'app va in
  // background/inactive è stato DISATTIVATO. Il PIN viene richiesto SOLO al
  // cold start dell'app (apertura completa dopo chiusura totale). Quando
  // l'utente naviga tra le pagine o apre brevemente un'altra app
  // (es. WhatsApp per condividere, image picker, ecc.) e torna, NON deve
  // più reinserire il PIN.
  //
  // Razionale: l'utente è in genere il titolare/collaboratore con il telefono
  // in mano per tutto il giorno; il blocco continuo era una frizione UX
  // inaccettabile. La sicurezza al cold start (boot, kill manuale dell'app)
  // resta intatta.
  //
  // Se in futuro serve un re-lock dopo tot minuti di inattività, va aggiunto
  // un timer più morbido (es. 30 minuti) anziché basato su AppState.
  // ═══════════════════════════════════════════════════════════════════

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
