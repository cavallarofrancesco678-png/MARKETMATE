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
import { useTeamSyncStore } from '../src/store/teamSyncStore';
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
      // ═══ Auto-login cloud + sync per collaboratori ═══
      // Se l'utente è entrato tramite codice invito, prova un login silent
      // sul backend (riusa code+password salvati in SecureStore) e scarica
      // i dati aggiornati del team. Se il backend risponde 403 = utente
      // revocato dall'admin → reset completo dell'app.
      try {
        const teamStore = useTeamSyncStore.getState();
        await teamStore.loadFromSecureStore();
        const appState = useAppStore.getState() as any;
        if (appState.joinedViaInviteCode) {
          const result = await teamStore.collabLoginSilent();
          if (result.revoked) {
            // RESET completo: utente revocato
            await teamStore.logout();
            try { await (useAppStore.getState() as any).resetAll?.(); } catch {}
            try { await (useAppStore.getState() as any).saveToStorage?.(); } catch {}
            setIsLoading(false);
            return;
          }
          // Aggiorna i dati locali con quelli appena scaricati dal cloud
          if (result.ok && result.data) {
            try {
              const td = result.data;
              const merge: any = {};
              // Type-safe merging: applichiamo i campi solo se sono effettivamente
              // del tipo atteso (array vs oggetto), per non rompere consumer
              // che assumono certe shape (es. storicoGiornate è Array, non Map).
              if (Array.isArray(td.storicoGiornate)) merge.storicoGiornate = td.storicoGiornate;
              if (Array.isArray(td.storicoCarburante)) merge.storicoCarburante = td.storicoCarburante;
              if (td.storicoScontrini && typeof td.storicoScontrini === 'object') merge.storicoScontrini = td.storicoScontrini;
              if (Array.isArray(td.fiere)) merge.fiere = td.fiere;
              if (Array.isArray(td.appuntiAgenda)) merge.appuntiAgenda = td.appuntiAgenda;
              if (Array.isArray(td.ordiniAgenda)) merge.ordiniAgenda = td.ordiniAgenda;
              if (td.storicoDiario && typeof td.storicoDiario === 'object') merge.storicoDiario = td.storicoDiario;
              if (Array.isArray(td.fornitori)) merge.fornitori = td.fornitori;
              if (Array.isArray(td.collaboratori)) merge.collaboratori = td.collaboratori;
              if (Array.isArray(td.codiciInvito)) merge.codiciInvito = td.codiciInvito;
              if (td.speseFisseAnnuali && typeof td.speseFisseAnnuali === 'object') merge.speseFisseAnnuali = td.speseFisseAnnuali;
              if (typeof td.nomeAttivita === 'string') merge.nomeAttivita = td.nomeAttivita;
              if (typeof td.nomeTitolare === 'string') merge.nomeTitolare = td.nomeTitolare;
              useAppStore.setState(merge);
              try { await (useAppStore.getState() as any).saveToStorage?.(); } catch {}
            } catch {}
          }
        } else if (appState.isConfigured) {
          // ═══ Admin: silent login + PULL dei dati dal cloud ═══
          // Se l'admin è già registrato, faccio login silenzioso e poi un pull
          // per recuperare eventuali contributi dei collaboratori (sync inverso).
          // Strategia merge:
          //  - storicoGiornate: union per data, cloud vince in caso di collisione
          //    (LWW = ultimo che scrive vince, per la stessa data)
          //  - altri array (collaboratori, fornitori, fiere, ordini, ecc.):
          //    overwrite con la versione cloud se non vuota
          //  - oggetti (storicoScontrini, storicoDiario, speseFisseAnnuali):
          //    spread merge cloud-prima
          const ok = await teamStore.adminLoginSilent();
          if (ok) {
            try {
              const cloudData = await teamStore.pullData();
              if (cloudData) {
                const local: any = useAppStore.getState();
                const merge: any = {};

                // ── storicoGiornate: union per data ──
                if (Array.isArray(cloudData.storicoGiornate)) {
                  const cloudByDate = new Map<string, any>();
                  cloudData.storicoGiornate.forEach((g: any) => {
                    try {
                      const k = new Date(g.data).toISOString().slice(0, 10);
                      cloudByDate.set(k, g);
                    } catch {}
                  });
                  const localByDate = new Map<string, any>();
                  (local.storicoGiornate || []).forEach((g: any) => {
                    try {
                      const k = new Date(g.data).toISOString().slice(0, 10);
                      localByDate.set(k, g);
                    } catch {}
                  });
                  // Unione: cloud vince in caso di collisione
                  const merged = new Map<string, any>(localByDate);
                  cloudByDate.forEach((v, k) => merged.set(k, v));
                  merge.storicoGiornate = Array.from(merged.values());
                }

                // ── Altri array: cloud vince se non vuoto ──
                if (Array.isArray(cloudData.collaboratori) && cloudData.collaboratori.length > 0) merge.collaboratori = cloudData.collaboratori;
                if (Array.isArray(cloudData.fornitori) && cloudData.fornitori.length > 0) merge.fornitori = cloudData.fornitori;
                if (Array.isArray(cloudData.fiere) && cloudData.fiere.length > 0) merge.fiere = cloudData.fiere;
                if (Array.isArray(cloudData.appuntiAgenda) && cloudData.appuntiAgenda.length > 0) merge.appuntiAgenda = cloudData.appuntiAgenda;
                if (Array.isArray(cloudData.ordiniAgenda) && cloudData.ordiniAgenda.length > 0) merge.ordiniAgenda = cloudData.ordiniAgenda;
                if (Array.isArray(cloudData.storicoCarburante) && cloudData.storicoCarburante.length > 0) merge.storicoCarburante = cloudData.storicoCarburante;
                if (Array.isArray(cloudData.codiciInvito) && cloudData.codiciInvito.length > 0) merge.codiciInvito = cloudData.codiciInvito;

                // ── Oggetti: spread merge ──
                if (cloudData.storicoScontrini && typeof cloudData.storicoScontrini === 'object') {
                  merge.storicoScontrini = { ...(local.storicoScontrini || {}), ...cloudData.storicoScontrini };
                }
                if (cloudData.storicoDiario && typeof cloudData.storicoDiario === 'object') {
                  merge.storicoDiario = { ...(local.storicoDiario || {}), ...cloudData.storicoDiario };
                }
                if (cloudData.speseFisseAnnuali && typeof cloudData.speseFisseAnnuali === 'object') {
                  merge.speseFisseAnnuali = { ...(local.speseFisseAnnuali || {}), ...cloudData.speseFisseAnnuali };
                }

                if (Object.keys(merge).length > 0) {
                  useAppStore.setState(merge);
                  try { await (useAppStore.getState() as any).saveToStorage?.(); } catch {}
                }
              }
            } catch {}
          }
        }
      } catch {}
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
        <View style={[s.content, { paddingTop: Math.max(insets.top + 24, 64) }]}>
          {/* Spazio flessibile in alto per centrare verticalmente */}
          <View style={{ flex: 0.5 }} />

          <View style={s.logoWrapBig}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={s.logoBig}
              contentFit="contain"
            />
          </View>

          <Text style={s.welcomeTitle}>{t('login.goodMorning') || 'BUONGIORNO'}</Text>
          <Text style={s.welcomeSub}>{t('login.manageMarket')}</Text>

          {/* Spazio flessibile per centrare */}
          <View style={{ flex: 0.6 }} />

          <TouchableOpacity
            testID="accedi-btn"
            style={s.configCenterBtn}
            onPress={handleConfigure}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket" size={18} color="#FFF" />
            <Text style={s.configCenterTxt} numberOfLines={1} adjustsFontSizeToFit>
              {t('login.configureApp') || 'CONFIGURA LA APP'}
            </Text>
          </TouchableOpacity>

          {/* Spazio verso il footer */}
          <View style={{ flex: 1 }} />

          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
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
  logoWrapBig: { marginBottom: 18, alignItems: 'center' },
  logo: { width: 240, height: 240, borderRadius: 20 },
  logoBig: { width: 320, height: 320, borderRadius: 24 },
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

  configCenterBtn: {
    alignSelf: 'center',
    minWidth: 260,
    paddingHorizontal: 26,
    paddingVertical: 17,
    backgroundColor: '#1E7F85',
    borderRadius: 30,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    // Ombra morbida
    shadowColor: '#1E7F85',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  configCenterTxt: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },

  configLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  configLinkTxt: { color: '#1E7F85', fontSize: 12, fontWeight: '700' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  footerTxt: { fontSize: 11, fontWeight: '600', color: '#B0A898', textAlign: 'center' },
});
