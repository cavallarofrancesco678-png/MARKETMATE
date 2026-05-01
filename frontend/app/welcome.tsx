/**
 * Welcome Wizard — Onboarding MarketMate (protocollo "Fast-Enrollment")
 *
 * Flusso a 6 passi (senza OTP, senza email bloccante):
 *  0. Lingua   → scelta obbligatoria (bandiere circolari)
 *  1. Valore   → spiegazione + blocco sicurezza
 *  2. Settore  → ALIMENTARE / NON ALIMENTARE
 *  3. Identità → nome attività + nome titolare
 *  4. PIN      → 6 cifre + conferma (salvato in SecureStore)
 *  5. Done     → "ENTRA NELL'APP"
 *
 * Il PIN è memorizzato via expo-secure-store (Keychain iOS / Keystore Android),
 * equivalente a flutter_secure_storage.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { useAppLockStore } from '../src/store/appLockStore';
import { NeuBox } from '../src/components/NeuBox';
import { Colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES } from '../src/i18n';

const TOTAL_PAGES = 6;

// ═══ Input shared (extracted to avoid remount on each keystroke) ═══
interface WInputProps {
  label: string;
  icon: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  numeric?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}
const WInput = React.memo(function WInput(p: WInputProps) {
  return (
    <NeuBox pressed borderRadius={50} padding={0}>
      <View style={s.inputRow}>
        <Ionicons name={p.icon as any} size={22} color={Colors.primary} />
        <TextInput
          style={s.input}
          placeholder={p.label}
          placeholderTextColor={`${Colors.marrone}50`}
          value={p.value}
          onChangeText={p.onChangeText}
          secureTextEntry={p.secure}
          keyboardType={p.numeric ? 'number-pad' : 'default'}
          maxLength={p.maxLength}
          autoCapitalize={p.numeric ? 'none' : 'words'}
          autoFocus={p.autoFocus}
          returnKeyType="done"
        />
      </View>
    </NeuBox>
  );
});

const LINGUA_MAP: Record<string, string> = {};
LANGUAGES.forEach((l) => { LINGUA_MAP[l.label] = l.code; });

export default function WelcomeScreen() {
  const [page, setPage] = useState(0);

  // Step 0: Lingua (obbligatoria)
  const [langSelected, setLangSelected] = useState<string | null>(null);

  // Step 2: Settore
  const [isAlimentare, setIsAlimentare] = useState(true);

  // Step 3: Identità
  const [nomeAttivita, setNomeAttivita] = useState('');
  const [nomeTitolare, setNomeTitolare] = useState('');

  // Step 4: PIN
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [emailRecupero, setEmailRecupero] = useState('');
  const [pinError, setPinError] = useState('');

  const { setConfig } = useAppStore();
  const setStorePin = useAppLockStore((st) => st.setPin);
  const unlockLock = useAppLockStore((st) => st.unlock);
  const { t } = useTranslation();

  const pickLang = (label: string) => {
    setLangSelected(label);
    const code = LINGUA_MAP[label] || 'it';
    changeLanguage(code);
  };

  const showErr = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert(t('common.error') || 'Errore', msg);
  };

  const canGoNext = (): boolean => {
    if (page === 0) return !!langSelected;
    if (page === 3) return nomeAttivita.trim().length > 0;
    if (page === 4) return pin.length === 6 && pinConfirm === pin;
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (page < TOTAL_PAGES - 1) setPage(page + 1);
  };

  const goBack = () => { if (page > 0) setPage(page - 1); };

  const handleFinish = async () => {
    // Validazione finale PIN
    if (pin.length !== 6) {
      setPinError(t('welcome.pinTooShort'));
      setPage(4);
      return;
    }
    if (pin !== pinConfirm) {
      setPinError(t('welcome.pinMismatch'));
      setPage(4);
      return;
    }
    if (!nomeAttivita.trim()) {
      showErr(t('welcome.businessNamePlaceholder'));
      setPage(3);
      return;
    }

    // Salva PIN in SecureStore (Keychain/Keystore)
    try { await setStorePin(pin); } catch {}

    // Persisti configurazione
    setConfig({
      isConfigured: true,
      lingua: langSelected || 'Italiano',
      isAlimentare,
      nomeAttivita: nomeAttivita.trim() || 'MarketMate',
      nomeTitolare: nomeTitolare.trim() || 'Titolare',
      pin, // mantenuto anche in appStore per backward-compat
      emailRecupero: emailRecupero.trim(),
      phoneNumber: '',
      otpEnabled: false,
    });

    // Attendi che la persistenza sia effettivamente scritta su disco.
    try { await useAppStore.getState().saveToStorage(); } catch {}

    // L'utente ha appena creato il PIN → ingresso sbloccato diretto in home
    unlockLock();
    router.replace('/home');
  };

  // ═══ Indicator dots ═══
  const Indicator = () => (
    <View style={s.indicatorRow}>
      {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
        <View key={i} style={[s.dot, page === i && s.dotActive, i < page && s.dotDone]} />
      ))}
    </View>
  );

  // ═══ Navigation bar ═══
  const NavBar = () => {
    const hideNext = page === 0 || page === 1 || page === TOTAL_PAGES - 1; // questi step hanno CTA dedicato
    return (
      <View style={s.nav}>
        {page > 0 ? (
          <TouchableOpacity style={s.navBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={26} color={Colors.marrone} />
          </TouchableOpacity>
        ) : <View style={s.navBtn} />}
        {!hideNext && canGoNext() ? (
          <TouchableOpacity testID="onboard-forward-btn" style={s.navBtn} onPress={goNext} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-forward" size={30} color={Colors.primary} />
          </TouchableOpacity>
        ) : <View style={s.navBtn} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Indicator />

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ══════ STEP 0: LINGUA ══════ */}
          {page === 0 && (
            <View style={s.stepWrap}>
              <Image
                source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
                style={s.logoSm}
                contentFit="contain"
              />
              <Text style={s.stepTitle}>{t('welcome.chooseLanguage')}</Text>
              <Text style={s.stepHint}>{t('welcome.chooseLanguageHint')}</Text>

              <View style={s.flagsGrid}>
                {LANGUAGES.map((l) => {
                  const active = langSelected === l.label;
                  return (
                    <TouchableOpacity
                      key={l.label}
                      onPress={() => pickLang(l.label)}
                      activeOpacity={0.75}
                      style={[s.flagCircle, active && s.flagCircleActive]}
                    >
                      <Text style={s.flagEmoji}>{l.flag}</Text>
                      <Text style={[s.flagLabel, active && { color: Colors.primary, fontWeight: '900' }]}>
                        {l.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[s.ctaBtn, !langSelected && s.ctaBtnDisabled]}
                onPress={goNext}
                disabled={!langSelected}
                activeOpacity={0.85}
              >
                <Text style={s.ctaBtnTxt}>{t('welcome.start')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ══════ STEP 1: VALORE + SICUREZZA ══════ */}
          {page === 1 && (
            <View style={s.stepWrap}>
              <View style={s.heroIcon}>
                <Ionicons name="rocket" size={42} color={Colors.primary} />
              </View>
              <Text style={s.stepTitle}>{t('welcome.valueTitle')}</Text>
              <Text style={s.bodyTxt}>{t('welcome.valueBody')}</Text>

              <View style={s.securityCard}>
                <View style={s.securityHead}>
                  <Ionicons name="shield-checkmark" size={28} color={Colors.verde} />
                  <Text style={s.securityTitle}>{t('welcome.securityTitle')}</Text>
                </View>
                <Text style={s.securityBody}>{t('welcome.securityBody')}</Text>
              </View>

              <TouchableOpacity style={s.ctaBtn} onPress={goNext} activeOpacity={0.85}>
                <Text style={s.ctaBtnTxt}>{t('welcome.securityCta')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ══════ STEP 2: SETTORE ══════ */}
          {page === 2 && (
            <View style={s.stepWrap}>
              <Text style={s.stepTitle}>{t('welcome.sector')}</Text>
              <View style={{ width: '100%', marginTop: 12 }}>
                <TouchableOpacity onPress={() => setIsAlimentare(true)} style={{ width: '100%' }}>
                  <NeuBox pressed={isAlimentare} padding={22} borderRadius={24}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Ionicons name="fast-food" size={22} color={isAlimentare ? Colors.primary : Colors.marrone} />
                      <Text style={[s.optionTxt, isAlimentare && { color: Colors.primary }]}>{t('welcome.alimentare')}</Text>
                    </View>
                  </NeuBox>
                </TouchableOpacity>
                <View style={{ height: 16 }} />
                <TouchableOpacity onPress={() => setIsAlimentare(false)} style={{ width: '100%' }}>
                  <NeuBox pressed={!isAlimentare} padding={22} borderRadius={24}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Ionicons name="shirt" size={22} color={!isAlimentare ? Colors.primary : Colors.marrone} />
                      <Text style={[s.optionTxt, !isAlimentare && { color: Colors.primary }]}>{t('welcome.nonAlimentare')}</Text>
                    </View>
                  </NeuBox>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════ STEP 3: IDENTITÀ ══════ */}
          {page === 3 && (
            <View style={s.stepWrap}>
              <Text style={s.stepTitle}>{t('welcome.identity')}</Text>
              <View style={{ width: '100%' }}>
                <WInput
                  label={t('welcome.businessNamePlaceholder')}
                  icon="storefront-outline"
                  value={nomeAttivita}
                  onChangeText={setNomeAttivita}
                  autoFocus
                />
                <View style={{ height: 18 }} />
                <WInput
                  label={t('welcome.ownerNamePlaceholder')}
                  icon="person-outline"
                  value={nomeTitolare}
                  onChangeText={setNomeTitolare}
                />
              </View>
            </View>
          )}

          {/* ══════ STEP 4: PIN 6 CIFRE ══════ */}
          {page === 4 && (
            <View style={s.stepWrap}>
              <View style={s.heroIcon}>
                <Ionicons name="lock-closed" size={36} color={Colors.primary} />
              </View>
              <Text style={s.stepTitle}>{t('welcome.security')}</Text>
              <Text style={s.bodyTxt}>{t('welcome.createPin')}</Text>

              <View style={{ width: '100%', marginTop: 20 }}>
                <WInput
                  label={t('welcome.createPin')}
                  icon="keypad-outline"
                  value={pin}
                  onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
                  secure
                  numeric
                  maxLength={6}
                  autoFocus
                />
                <View style={{ height: 16 }} />
                <WInput
                  label={t('welcome.confirmPin')}
                  icon="keypad"
                  value={pinConfirm}
                  onChangeText={(v) => { setPinConfirm(v.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
                  secure
                  numeric
                  maxLength={6}
                />
                {pinError ? <Text style={s.errTxt}>{pinError}</Text> : null}
                <View style={{ height: 22 }} />
                <WInput
                  label={t('welcome.recoveryEmail')}
                  icon="mail-outline"
                  value={emailRecupero}
                  onChangeText={setEmailRecupero}
                />
              </View>
            </View>
          )}

          {/* ══════ STEP 5: COMPLETATO ══════ */}
          {page === 5 && (
            <View style={s.stepWrap}>
              <NeuBox borderRadius={100} padding={36} style={{ marginBottom: 30 }}>
                <Ionicons name="checkmark-done" size={80} color={Colors.verde} />
              </NeuBox>
              <Text style={s.stepTitle}>{t('welcome.completed')}</Text>
              <Text style={s.bodyTxt}>{t('welcome.configSaved')}</Text>

              <TouchableOpacity style={s.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
                <Text style={s.finishBtnTxt}>{t('welcome.enterApp')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <NavBar />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgWelcome },
  indicatorRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 22, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.shadowDark },
  dotActive: { width: 30, backgroundColor: Colors.primary },
  dotDone: { backgroundColor: Colors.verde },

  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 20 },
  stepWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 },

  logoSm: { width: 160, height: 160, marginBottom: 4 },
  heroIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(30,127,133,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(30,127,133,0.2)', marginBottom: 18,
  },

  stepTitle: { fontSize: 22, fontWeight: '900', color: Colors.marrone, letterSpacing: 1.5, marginBottom: 10, textAlign: 'center' },
  stepHint: { fontSize: 13, color: Colors.grey, textAlign: 'center', marginBottom: 24 },
  bodyTxt: { fontSize: 14, color: Colors.grey, textAlign: 'center', lineHeight: 22, marginBottom: 18, paddingHorizontal: 6 },

  flagsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 16, marginBottom: 26, width: '100%',
  },
  flagCircle: {
    width: 92, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6,
    borderRadius: 20, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: 'transparent',
  },
  flagCircleActive: { borderColor: Colors.primary, backgroundColor: 'rgba(30,127,133,0.08)' },
  flagEmoji: { fontSize: 38, marginBottom: 4 },
  flagLabel: { fontSize: 12, fontWeight: '700', color: Colors.marrone },

  securityCard: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 22,
    borderLeftWidth: 4, borderLeftColor: Colors.verde,
  },
  securityHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  securityTitle: { fontSize: 14, fontWeight: '900', color: Colors.verde, letterSpacing: 1 },
  securityBody: { fontSize: 13, color: Colors.grey, lineHeight: 20 },

  ctaBtn: {
    width: '100%', backgroundColor: Colors.primary, paddingVertical: 16,
    borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 10,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },

  optionTxt: { fontSize: 15, fontWeight: '900', color: Colors.marrone, textAlign: 'center' },

  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 6, gap: 10 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.marrone, paddingVertical: 14 },
  errTxt: { color: '#D46A6A', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },

  finishBtn: {
    width: '100%', backgroundColor: Colors.verde, paddingVertical: 20, borderRadius: 20, marginTop: 10,
  },
  finishBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 17, letterSpacing: 1.2, textAlign: 'center' },

  nav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  navBtn: { padding: 18, width: 68 },
});
