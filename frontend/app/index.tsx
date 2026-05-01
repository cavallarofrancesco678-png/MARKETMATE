/**
 * Login / Bentornato — tastierino PIN a 6 cifre custom.
 *
 * Logica:
 *  - Se !isConfigured  → bottone "CONFIGURA LA APP" → router.push('/welcome')
 *  - Se isConfigured ma appLockStore.isLocked=false → auto-redirect /home (no PIN)
 *  - Se isConfigured e isLocked=true → chiede PIN 6 cifre
 *
 * Il PIN viene richiesto SOLO al cold start o quando l'app torna da background.
 * La navigazione tra pagine interne (/home/*) NON triggera il PIN (vedi _layout.tsx).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { useAppLockStore } from '../src/store/appLockStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const PIN_LEN = 6;

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { isConfigured, nomeTitolare, loadFromStorage } = useAppStore();
  const verifyPin = useAppLockStore((st) => st.verifyPin);
  const hasPin = useAppLockStore((st) => st.hasPin);
  const isLocked = useAppLockStore((st) => st.isLocked);
  const unlock = useAppLockStore((st) => st.unlock);
  const hydrateLock = useAppLockStore((st) => st.hydrate);
  const lockHydrated = useAppLockStore((st) => st.isHydrated);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      await loadFromStorage();
      await hydrateLock();
      setIsLoading(false);
    })();
  }, []);

  // ═══ Auto-entry se app già sbloccata (navigazione interna) ═══
  useEffect(() => {
    if (isLoading) return;
    if (!isConfigured) return;
    if (!lockHydrated) return;
    if (!isLocked) {
      // Già sbloccato: vai in home
      router.replace('/home');
    } else if (!hasPin) {
      // Configurato ma senza PIN salvato (utente legacy) → sblocca direttamente
      unlock();
      router.replace('/home');
    }
  }, [isLoading, isConfigured, isLocked, hasPin, lockHydrated]);

  // Lock dopo 5 tentativi
  useEffect(() => {
    if (attempts >= 5) {
      setLocked(true);
      const timer = setTimeout(() => { setLocked(false); setAttempts(0); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  const tapHaptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {} };
  const errHaptic = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {} };
  const okHaptic = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {} };

  const pressDigit = async (d: string) => {
    if (locked) return;
    if (pin.length >= PIN_LEN) return;
    tapHaptic();
    const next = pin + d;
    setPin(next);
    setError('');

    if (next.length === PIN_LEN) {
      // Verifica automatica
      setTimeout(async () => {
        const ok = await verifyPin(next);
        if (ok) {
          okHaptic();
          unlock();
          router.replace('/home');
        } else {
          errHaptic();
          setAttempts((p) => p + 1);
          setError(t('login.wrongPin') || 'PIN errato');
          setPin('');
        }
      }, 100);
    }
  };

  const pressBack = () => {
    if (locked) return;
    tapHaptic();
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleConfigure = () => {
    router.push('/welcome');
  };

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.loadingTxt}>…</Text>
      </View>
    );
  }

  // ═══ Not configured: mostra solo CTA "CONFIGURA" ═══
  if (!isConfigured) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F0E6" />
        <View style={[s.content, { paddingTop: Math.max(insets.top + 20, 60) }]}>
          <View style={s.logoWrap}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={s.logo}
              contentFit="contain"
            />
          </View>
          <Text style={s.welcomeTitle}>{t('login.welcome')}</Text>
          <Text style={s.welcomeSub}>{t('login.manageMarket')}</Text>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            testID="accedi-btn"
            style={s.configBigBtn}
            onPress={handleConfigure}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket" size={18} color="#FFF" />
            <Text style={s.configBigTxt}>{t('login.firstTime')}</Text>
          </TouchableOpacity>

          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 10, 30) }]}>
            <Ionicons name="shield-checkmark" size={14} color="#1E7F85" />
            <Text style={s.footerTxt}>{t('login.dataProtected')}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ═══ CONFIGURED: Bentornato personalizzato + tastierino PIN ═══
  const ownerFirst = (nomeTitolare || '').trim().split(/\s+/)[0] || '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0E6" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[s.content, { paddingTop: Math.max(insets.top + 16, 50) }]}>
          <View style={s.logoWrap}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={s.logoSmall}
              contentFit="contain"
            />
          </View>

          <Text style={s.welcomeBack}>
            {(t('login.welcomeBack') || 'Bentornato')}{ownerFirst ? `, ${ownerFirst}!` : '!'}
          </Text>
          <Text style={s.hintSub}>{t('login.enterPin6')}</Text>

          {/* ═══ 6 slot indicator ═══ */}
          <View style={s.pinDots}>
            {Array.from({ length: PIN_LEN }).map((_, i) => (
              <View
                key={i}
                style={[
                  s.pinDot,
                  i < pin.length && s.pinDotFilled,
                  !!error && s.pinDotErr,
                ]}
              />
            ))}
          </View>

          {error ? <Text style={s.errorTxt}>{error}</Text> : <View style={{ height: 18 }} />}
          {locked && (
            <Text style={s.lockedTxt}>{t('login.locked') || 'Troppi tentativi. Riprova tra 30s'}</Text>
          )}

          {/* ═══ Tastierino numerico ═══ */}
          <View style={s.keypad}>
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <TouchableOpacity
                key={d}
                style={s.keyBtn}
                onPress={() => pressDigit(d)}
                activeOpacity={0.6}
                disabled={locked}
              >
                <Text style={s.keyTxt}>{d}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.keyBtn} />
            <TouchableOpacity
              style={s.keyBtn}
              onPress={() => pressDigit('0')}
              activeOpacity={0.6}
              disabled={locked}
            >
              <Text style={s.keyTxt}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.keyBtn}
              onPress={pressBack}
              activeOpacity={0.6}
              disabled={locked}
            >
              <Ionicons name="backspace-outline" size={26} color="#1A4040" />
            </TouchableOpacity>
          </View>

          {/* Riconfigura */}
          <TouchableOpacity onPress={handleConfigure} style={s.configLinkBtn}>
            <Ionicons name="settings-outline" size={13} color="#1E7F85" />
            <Text style={s.configLinkTxt}>{t('login.reconfigure') || 'Riconfigura App'}</Text>
          </TouchableOpacity>

          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
            <Ionicons name="shield-checkmark" size={12} color="#1E7F85" />
            <Text style={s.footerTxt}>{t('login.dataProtected')}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E6' },
  content: { flex: 1, paddingHorizontal: 28, alignItems: 'center' },
  loadingTxt: { fontSize: 14, fontWeight: '700', color: '#1A4040' },

  logoWrap: { marginBottom: 10 },
  logo: { width: 240, height: 240, borderRadius: 20 },
  logoSmall: { width: 110, height: 110 },

  welcomeTitle: { fontSize: 28, fontWeight: '900', color: '#1A4040', letterSpacing: 3, marginTop: 10, marginBottom: 4 },
  welcomeSub: { fontSize: 14, fontWeight: '600', color: '#7A9090', marginBottom: 10 },

  welcomeBack: { fontSize: 22, fontWeight: '900', color: '#1A4040', letterSpacing: 1, marginTop: 6, marginBottom: 4, textAlign: 'center' },
  hintSub: { fontSize: 12, fontWeight: '600', color: '#7A9090', marginBottom: 18, letterSpacing: 0.3 },

  pinDots: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#C0B8A8', backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  pinDotErr: { borderColor: '#D46A6A' },

  errorTxt: { color: '#D46A6A', fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 6, textAlign: 'center' },
  lockedTxt: { color: '#D46A6A', fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },

  keypad: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    width: '100%', maxWidth: 320, gap: 12, marginTop: 10, marginBottom: 12,
  },
  keyBtn: {
    width: '30%', aspectRatio: 1.4,
    backgroundColor: '#FFF',
    borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  keyTxt: { fontSize: 26, fontWeight: '700', color: '#1A4040' },

  configBigBtn: {
    width: '100%', backgroundColor: '#1E7F85', paddingVertical: 18,
    borderRadius: 18, flexDirection: 'row', gap: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  configBigTxt: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },

  configLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  configLinkTxt: { color: '#1E7F85', fontSize: 12, fontWeight: '700' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  footerTxt: { fontSize: 11, fontWeight: '600', color: '#B0A898', textAlign: 'center' },
});
