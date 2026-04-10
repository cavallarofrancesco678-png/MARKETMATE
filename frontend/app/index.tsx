import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const { isConfigured, pin: savedPin, nomeAttivita, loadFromStorage, otpEnabled, phoneNumber } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  useEffect(() => {
    const init = async () => {
      await loadFromStorage();
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (attempts >= 5) {
      setLocked(true);
      const timer = setTimeout(() => { setLocked(false); setAttempts(0); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  const generateOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpStep(true);
    const msg = `Codice OTP inviato al ${phoneNumber}: ${code}`;
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('OTP Inviato', msg);
  };

  const handleAccedi = () => {
    if (locked) return;
    if (!isConfigured) {
      router.push('/welcome');
      return;
    }
    if (!savedPin || pin === savedPin) {
      setPin('');
      if (otpEnabled && phoneNumber) {
        generateOtp();
      } else {
        router.replace('/home');
      }
    } else {
      setAttempts(prev => prev + 1);
      if (Platform.OS === 'web') window.alert(t('login.wrongPin'));
      else Alert.alert(t('login.error'), t('login.wrongPin'));
      setPin('');
    }
  };

  const handleOtpVerify = () => {
    if (otpInput === generatedOtp) {
      setOtpStep(false);
      setOtpInput('');
      router.replace('/home');
    } else {
      if (Platform.OS === 'web') window.alert('Codice OTP errato');
      else Alert.alert('Errore', 'Codice OTP errato');
      setOtpInput('');
    }
  };

  const handleConfigura = () => {
    router.push('/welcome');
  };

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.loadingTxt}>Caricamento...</Text>
      </View>
    );
  }

  const topSpacing = Math.max(insets.top + 10, 50);

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[s.content, { paddingTop: topSpacing }]}>
          {/* ═══ LOGO ═══ */}
          <View style={s.logoWrap}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={s.logo}
              resizeMode="contain"
            />
          </View>

          {/* ═══ BENTORNATO (vicino al logo) ═══ */}
          <Text style={s.welcomeTitle}>BENTORNATO</Text>
          <Text style={s.welcomeSub}>
            {isConfigured ? nomeAttivita || 'MarketMate' : 'Gestisci il tuo mercato'}
          </Text>

          {/* ═══ PIN INPUT ═══ */}
          <View style={s.inputSection}>
            {!otpStep ? (
              <>
                <View style={s.pinCard}>
                  <Ionicons name="lock-closed" size={18} color="#1E7F85" />
                  <TextInput
                    style={s.pinInput}
                    placeholder={t('login.enterPin') || 'Inserisci PIN'}
                    placeholderTextColor="#B0A898"
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!locked}
                  />
                </View>
                {locked && (
                  <Text style={s.lockedTxt}>{t('login.locked') || 'Troppi tentativi. Riprova tra 30s'}</Text>
                )}
              </>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={32} color="#1E7F85" />
                  <Text style={s.otpTitle}>Codice OTP inviato</Text>
                  <Text style={s.otpSub}>Inserisci il codice a 6 cifre</Text>
                </View>
                <View style={s.pinCard}>
                  <Ionicons name="keypad" size={18} color="#1E7F85" />
                  <TextInput
                    style={s.pinInput}
                    placeholder="000000"
                    placeholderTextColor="#B0A898"
                    value={otpInput}
                    onChangeText={setOtpInput}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
              </>
            )}
          </View>

          {/* ═══ ACCEDI ═══ */}
          <TouchableOpacity
            style={[s.accediBtn, locked && { opacity: 0.5 }]}
            onPress={otpStep ? handleOtpVerify : handleAccedi}
            activeOpacity={0.8}
            disabled={locked}
          >
            <Text style={s.accediBtnTxt}>
              {otpStep ? 'VERIFICA OTP' : t('login.login') || 'ACCEDI'}
            </Text>
          </TouchableOpacity>

          {otpStep && (
            <TouchableOpacity onPress={() => { setOtpStep(false); setOtpInput(''); }} style={{ marginTop: 10 }}>
              <Text style={s.backLink}>{'← Torna al PIN'}</Text>
            </TouchableOpacity>
          )}

          {/* ═══ RICONFIGURA ═══ */}
          <TouchableOpacity onPress={handleConfigura} style={s.configBtn}>
            <Ionicons name="settings-outline" size={16} color="#1E7F85" />
            <Text style={s.configTxt}>
              {isConfigured ? (t('login.reconfigure') || 'Riconfigura App') : (t('login.firstTime') || 'Prima configurazione')}
            </Text>
          </TouchableOpacity>

          {/* ═══ SPACER ═══ */}
          <View style={{ flex: 1 }} />

          {/* ═══ FOOTER AMICHEVOLE ═══ */}
          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 10, topSpacing) }]}>
            <Ionicons name="heart" size={14} color="#E8A060" />
            <Text style={s.footerTxt}>
              I tuoi dati sono protetti e restano sul tuo dispositivo
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 36,
    alignItems: 'center',
  },
  loadingTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A4040',
  },
  // Logo
  logoWrap: {
    marginBottom: 8,
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 20,
  },
  // Testi benvenuto
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 3,
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A9090',
    marginBottom: 28,
  },
  // PIN
  inputSection: {
    width: '100%',
    marginBottom: 16,
  },
  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  pinInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A4040',
    textAlign: 'center',
    paddingVertical: 14,
  },
  lockedTxt: {
    color: '#D46A6A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  otpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A4040',
    marginTop: 6,
  },
  otpSub: {
    fontSize: 11,
    color: '#7A9090',
    marginTop: 2,
  },
  // Accedi
  accediBtn: {
    width: '100%',
    backgroundColor: '#1E7F85',
    paddingVertical: 16,
    borderRadius: 16,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(30,127,133,0.3)',
  },
  accediBtnTxt: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 2,
    textAlign: 'center',
  },
  backLink: {
    color: '#1E7F85',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Riconfigura
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(30,127,133,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(30,127,133,0.15)',
  },
  configTxt: {
    color: '#1E7F85',
    fontSize: 12,
    fontWeight: '700',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B0A898',
    textAlign: 'center',
  },
});
