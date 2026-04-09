import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { NeuBox, NeuInset } from '../src/components/NeuBox';
import { Colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

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

  useEffect(() => {
    const init = async () => {
      await loadFromStorage();
      setIsLoading(false);
    };
    init();
  }, []);

  // Lock after 5 failed attempts for 30 seconds
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
    // Simulate SMS sending - show code in alert
    const msg = `Codice OTP inviato al ${phoneNumber}: ${code}`;
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('OTP Inviato', msg);
    }
  };

  const handleAccedi = () => {
    if (locked) {
      if (Platform.OS === 'web') {
        window.alert(t('login.locked') || 'Troppi tentativi. Riprova tra 30 secondi.');
      } else {
        Alert.alert(t('common.error'), t('login.locked'));
      }
      return;
    }
    if (savedPin && pin !== savedPin) {
      setAttempts(a => a + 1);
      if (Platform.OS === 'web') {
        window.alert(t('login.wrongPin') || 'PIN errato');
      } else {
        Alert.alert(t('common.error'), t('login.wrongPin'));
      }
      setPin('');
      return;
    }
    // If OTP enabled, go to OTP step
    if (otpEnabled && phoneNumber) {
      generateOtp();
      return;
    }
    setAttempts(0);
    router.replace('/home');
  };

  const handleOtpVerify = () => {
    if (otpInput === generatedOtp) {
      setAttempts(0);
      setOtpStep(false);
      setOtpInput('');
      router.replace('/home');
    } else {
      setAttempts(a => a + 1);
      if (Platform.OS === 'web') {
        window.alert('Codice OTP errato');
      } else {
        Alert.alert('Errore', 'Codice OTP errato');
      }
      setOtpInput('');
    }
  };

  const handleConfigura = () => {
    router.push('/welcome');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContent}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>{t('login.welcome')}</Text>
          <Text style={styles.subtitle}>
            {isConfigured ? nomeAttivita : t('login.manageMarket')}
          </Text>

          <View style={styles.inputContainer}>
            {!otpStep ? (
              <>
                <NeuInset style={styles.pinInput}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('login.enterPin')}
                    placeholderTextColor={Colors.grey}
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!locked}
                  />
                </NeuInset>
                {locked && (
                  <Text style={{ color: '#D46A6A', fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' }}>
                    {t('login.locked')}
                  </Text>
                )}
              </>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={36} color="#1E7F85" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.marrone, marginTop: 8, textAlign: 'center' }}>
                    {t('login.otpSent') || 'Codice OTP inviato'}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.grey, textAlign: 'center', marginTop: 4 }}>
                    {t('login.enterOtp') || 'Inserisci il codice a 6 cifre'}
                  </Text>
                </View>
                <NeuInset style={styles.pinInput}>
                  <TextInput
                    style={styles.input}
                    placeholder="000000"
                    placeholderTextColor={Colors.grey}
                    value={otpInput}
                    onChangeText={setOtpInput}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </NeuInset>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.accediButton, locked && { opacity: 0.5 }]}
            onPress={otpStep ? handleOtpVerify : handleAccedi}
            activeOpacity={0.8}
            disabled={locked}
          >
            <Text style={styles.accediText}>{otpStep ? (t('login.verifyOtp') || 'VERIFICA OTP') : t('login.login')}</Text>
          </TouchableOpacity>

          {otpStep && (
            <TouchableOpacity onPress={() => { setOtpStep(false); setOtpInput(''); }} style={{ marginTop: 12 }}>
              <Text style={{ color: '#1E7F85', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                {t('login.backToPin') || '← Torna al PIN'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <TouchableOpacity onPress={handleConfigura} style={styles.configButton}>
            <Ionicons name="rocket-outline" size={20} color={Colors.terracotta} />
            <Text style={styles.configText}>
              {isConfigured ? t('login.reconfigure') : t('login.firstTime')}
            </Text>
          </TouchableOpacity>

          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={24} color="#1E7F85" />
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityLine}>{t('login.securityLine1')}</Text>
              <Text style={styles.securityLine}>{t('login.securityLine2')}</Text>
              <Text style={styles.securityLine}>{t('login.securityLine3')}</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.marrone,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingVertical: 60,
    alignItems: 'center',
  },
  innerContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 4,
    alignItems: 'center',
  },
  logoTextBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 30,
  },
  logoMainText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 4,
    marginTop: 10,
  },
  logoSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.grey,
    letterSpacing: 2,
    marginTop: 4,
  },
  logoImage: {
    width: 320,
    height: 320,
    borderRadius: 24,
  },
  logoBox: {
    backgroundColor: Colors.caramello,
    borderRadius: 25,
    padding: 25,
    borderWidth: 3,
    borderColor: Colors.terracotta,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    marginTop: 15,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marroneChiaro,
    letterSpacing: 3,
  },
  securityBadge: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginTop: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(30,127,133,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(30,127,133,0.2)',
  },
  securityTextContainer: {
    alignItems: 'center' as const,
  },
  securityLine: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2A6565',
    letterSpacing: 0.2,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  securityText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#1E7F85',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.grey,
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 25,
  },
  pinInput: {
    borderRadius: 30,
  },
  input: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.marrone,
    textAlign: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  accediButton: {
    width: '100%',
    backgroundColor: Colors.verde,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#6B8E6B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  accediText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.lightGrey,
    marginVertical: 20,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 25,
    backgroundColor: Colors.bgCard,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  configText: {
    color: Colors.terracotta,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
