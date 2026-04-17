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
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const { isConfigured, pin: savedPin, nomeAttivita, loadFromStorage } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const init = async () => {
      await loadFromStorage();
      setIsLoading(false);
    };
    init();
  }, []);

  // Auto-login: se configurato senza PIN → vai alla Home
  useEffect(() => {
    if (!isLoading && isConfigured && !savedPin) {
      router.replace('/home');
    }
  }, [isLoading, isConfigured, savedPin]);

  // Lock dopo 5 tentativi
  useEffect(() => {
    if (attempts >= 5) {
      setLocked(true);
      const timer = setTimeout(() => { setLocked(false); setAttempts(0); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  const handleAccedi = () => {
    if (locked) return;
    setError('');

    if (!isConfigured) {
      // Prima volta → configura
      router.push('/welcome');
      return;
    }

    if (savedPin) {
      // Ha PIN → verifica
      if (pin === savedPin) {
        router.replace('/home');
      } else if (pin.length > 0) {
        setAttempts(prev => prev + 1);
        setError(t('login.wrongPin') || 'PIN errato');
        setPin('');
      } else {
        setError(t('login.enterPin') || 'Inserisci il PIN');
      }
    } else {
      // Nessun PIN → vai alla Home
      router.replace('/home');
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

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0E6" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[s.content, { paddingTop: Math.max(insets.top + 20, 60) }]}>

          {/* ═══ LOGO (più grande) ═══ */}
          <View style={s.logoWrap}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={s.logo}
              contentFit="contain"
            />
          </View>

          {/* ═══ BENTORNATO ═══ */}
          <Text style={s.welcomeTitle}>BENTORNATO</Text>
          <Text style={s.welcomeSub}>
            {isConfigured ? nomeAttivita || 'MarketMate' : 'Gestisci il tuo mercato'}
          </Text>

          {/* ═══ PIN INPUT ═══ */}
          <View style={s.inputSection}>
            <View style={s.pinCard}>
              <Ionicons name="lock-closed" size={18} color="#1E7F85" />
              <TextInput
                testID="pin-input"
                style={s.pinInput}
                placeholder={t('login.enterPin') || 'Inserisci PIN'}
                placeholderTextColor="#B0A898"
                value={pin}
                onChangeText={(v) => { setPin(v); setError(''); }}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                editable={!locked}
                onSubmitEditing={handleAccedi}
              />
            </View>
            {error ? <Text style={s.errorTxt}>{error}</Text> : null}
            {locked && (
              <Text style={s.lockedTxt}>{t('login.locked') || 'Troppi tentativi. Riprova tra 30s'}</Text>
            )}
          </View>

          {/* ═══ ACCEDI ═══ */}
          <TouchableOpacity
            testID="accedi-btn"
            style={[s.accediBtn, locked && { opacity: 0.5 }]}
            onPress={handleAccedi}
            activeOpacity={0.8}
            disabled={locked}
          >
            <Text style={s.accediBtnTxt}>
              {isConfigured ? (t('login.login') || 'ACCEDI') : 'CONFIGURA LA APP'}
            </Text>
          </TouchableOpacity>

          {/* ═══ RICONFIGURA (solo se già configurato) ═══ */}
          {isConfigured && (
            <TouchableOpacity onPress={handleConfigura} style={s.configBtn}>
              <Ionicons name="settings-outline" size={14} color="#1E7F85" />
              <Text style={s.configTxt}>{t('login.reconfigure') || 'Riconfigura App'}</Text>
            </TouchableOpacity>
          )}

          {/* ═══ PRIMA VOLTA (solo se NON configurato) ═══ */}
          {!isConfigured && (
            <TouchableOpacity onPress={handleConfigura} style={s.configBtn}>
              <Ionicons name="rocket-outline" size={14} color="#1E7F85" />
              <Text style={s.configTxt}>Prima volta? Configura la App</Text>
            </TouchableOpacity>
          )}

          {/* ═══ SPACER ═══ */}
          <View style={{ flex: 1 }} />

          {/* ═══ FOOTER ═══ */}
          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 10, 30) }]}>
            <Ionicons name="shield-checkmark" size={14} color="#1E7F85" />
            <Text style={s.footerTxt}>{t('login.dataProtected') || 'Dati protetti e crittografati'}</Text>
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
  logoWrap: {
    marginBottom: 12,
  },
  logo: {
    width: 280,
    height: 280,
    borderRadius: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 3,
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A9090',
    marginBottom: 32,
  },
  inputSection: {
    width: '100%',
    marginBottom: 20,
  },
  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
  },
  pinInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#1A4040',
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorTxt: {
    color: '#D46A6A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  lockedTxt: {
    color: '#D46A6A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  accediBtn: {
    width: '100%',
    backgroundColor: '#1E7F85',
    paddingVertical: 16,
    borderRadius: 16,
  },
  accediBtnTxt: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
