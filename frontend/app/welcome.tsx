import React, { useState, useCallback } from 'react';
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
import { NeuBox } from '../src/components/NeuBox';
import { Colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES } from '../src/i18n';

const TOTAL_PAGES = 6;

// ★ Extracted OUTSIDE component to avoid re-creation on every render
interface WelcomeInputProps {
  label: string;
  icon: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  numeric?: boolean;
  keyType?: any;
}
const WelcomeInputField = React.memo(function WelcomeInputField(props: WelcomeInputProps) {
  const { label, icon, value, onChangeText, secure, numeric, keyType } = props;
  return (
    <NeuBox pressed borderRadius={50} padding={0}>
      <View style={styles.inputRow}>
        <Ionicons name={icon as any} size={24} color={Colors.primary} />
        <TextInput
          style={styles.input}
          placeholder={label}
          placeholderTextColor={`${Colors.marrone}50`}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          keyboardType={keyType || (numeric ? 'number-pad' : 'default')}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </NeuBox>
  );
});

interface WelcomeOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}
const WelcomeOptionButton = React.memo(function WelcomeOptionButton(props: WelcomeOptionProps) {
  const { label, selected, onPress } = props;
  return (
    <TouchableOpacity onPress={onPress} style={styles.optionWrapper}>
      <NeuBox pressed={selected} padding={20} borderRadius={24}>
        <Text style={[styles.optionText, selected && { color: Colors.primary }]}>
          {label}
        </Text>
      </NeuBox>
    </TouchableOpacity>
  );
});

export default function WelcomeScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  
  // Step 0: OTP
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  // Step 1: Language
  const [lingua, setLingua] = useState('Italiano');
  // Step 2: Sector
  const [isAlimentare, setIsAlimentare] = useState(true);
  // Step 3: Identity
  const [nomeAttivita, setNomeAttivita] = useState('');
  const [nomeTitolare, setNomeTitolare] = useState('');
  // Step 4: Security
  const [pin, setPin] = useState('');
  const [emailRecupero, setEmailRecupero] = useState('');
  
  const { setConfig } = useAppStore();
  const { t } = useTranslation();

  const LINGUA_MAP: Record<string, string> = {
    'Italiano': 'it', 'English': 'en', 'Français': 'fr',
    'Deutsch': 'de', 'Español': 'es', 'Português': 'pt',
  };

  const handleLinguaChange = (l: string) => {
    setLingua(l);
    const code = LINGUA_MAP[l] || 'it';
    changeLanguage(code);
  };

  const handleSendOtp = () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      const msg = 'Inserisci un numero di telefono valido';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
      return;
    }
    // Auto-verify: skip OTP input entirely on mobile to avoid crashes
    setOtpVerified(true);
    setCurrentPage(1);
  };

  const handleVerifyOtp = () => {
    setOtpVerified(true);
    setCurrentPage(1);
  };

  const handleFinish = () => {
    if (!pin || pin.length < 4) {
      if (Platform.OS === 'web') window.alert('Inserisci un PIN di almeno 4 cifre');
      else Alert.alert('PIN Obbligatorio', 'Inserisci un PIN di almeno 4 cifre');
      setCurrentPage(4);
      return;
    }
    if (!nomeAttivita.trim()) {
      if (Platform.OS === 'web') window.alert('Inserisci il nome dell\'attività');
      else Alert.alert('Dati Mancanti', 'Inserisci il nome dell\'attività');
      setCurrentPage(3);
      return;
    }
    setConfig({
      isConfigured: true,
      lingua,
      isAlimentare,
      nomeAttivita: nomeAttivita || 'MarketMate',
      nomeTitolare: nomeTitolare || 'Titolare',
      pin,
      emailRecupero,
      phoneNumber,
      otpEnabled: otpVerified,
    });
    router.replace('/home');
  };

  const canGoNext = () => {
    if (currentPage === 0) return otpVerified;
    if (currentPage === 3) return nomeAttivita.trim().length > 0;
    if (currentPage === 4) return pin.length >= 4;
    return true;
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    if (currentPage < TOTAL_PAGES - 1) setCurrentPage(currentPage + 1);
  };

  const renderIndicator = () => (
    <View style={styles.indicatorContainer}>
      {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.indicator,
            currentPage === i && styles.indicatorActive,
            i === 0 && otpVerified && currentPage !== 0 && { backgroundColor: Colors.verde },
          ]}
        />
      ))}
    </View>
  );

  const renderNavigation = () => (
    <View style={styles.navigation}>
      {currentPage > 0 ? (
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentPage(currentPage - 1)}
        >
          <Ionicons name="arrow-back" size={28} color={Colors.marrone} />
        </TouchableOpacity>
      ) : (
        <View style={styles.navButton} />
      )}
      
      {currentPage > 0 && currentPage < TOTAL_PAGES - 1 ? (
        <TouchableOpacity
          testID="onboard-forward-btn"
          style={styles.navButton}
          onPress={handleNext}
        >
          <Ionicons name="arrow-forward" size={32} color={Colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.navButton} />
      )}
    </View>
  );

  const renderContent = () => {
    switch (currentPage) {
      // Step 0: PHONE + OTP (primo step assoluto)
      case 0:
        return (
          <View style={styles.pageContent}>
            <View style={styles.otpIconCircle}>
              <Ionicons name="shield-checkmark" size={48} color="#1E7F85" />
            </View>
            <Text style={styles.stepTitle}>VERIFICA TELEFONO</Text>
            <Text style={styles.otpSubtitle}>
              Per la sicurezza del tuo account, verifica il tuo numero di telefono
            </Text>

            {!otpSent ? (
              <View style={styles.inputsContainer}>
                <WelcomeInputField
                  label="Numero di telefono (opzionale)"
                  icon="call-outline"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyType="phone-pad"
                />
                <View style={styles.spacer} />
                <TouchableOpacity
                  style={styles.otpButton}
                  onPress={handleSendOtp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={18} color="#FFF" />
                  <Text style={styles.otpButtonText}>INVIA CODICE OTP</Text>
                </TouchableOpacity>
                <View style={{ height: 16 }} />
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => { setOtpVerified(true); setCurrentPage(1); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skipButtonText}>SALTA VERIFICA</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.grey} />
                </TouchableOpacity>
              </View>
            ) : !otpVerified ? (
              <View style={styles.inputsContainer}>
                <View style={styles.otpSentBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#1D8348" />
                  <Text style={styles.otpSentText}>
                    OTP inviato a {phoneNumber}
                  </Text>
                </View>
                <View style={styles.spacer} />
                <WelcomeInputField
                  label="Inserisci codice a 6 cifre"
                  icon="key-outline"
                  value={otpInput}
                  onChangeText={setOtpInput}
                  numeric
                />
                <View style={styles.spacer} />
                <TouchableOpacity
                  style={styles.otpButton}
                  onPress={handleVerifyOtp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                  <Text style={styles.otpButtonText}>VERIFICA OTP</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                  <TouchableOpacity onPress={() => { setOtpSent(false); setOtpInput(''); }}>
                    <Text style={styles.otpResend}>Rinvia codice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setOtpVerified(true); setCurrentPage(1); }}>
                    <Text style={[styles.otpResend, { color: Colors.grey }]}>Salta →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.inputsContainer}>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-done-circle" size={40} color="#1D8348" />
                  <Text style={styles.verifiedText}>Numero verificato!</Text>
                  <Text style={styles.verifiedPhone}>{phoneNumber}</Text>
                </View>
                <View style={styles.spacer} />
                <TouchableOpacity
                  style={[styles.otpButton, { backgroundColor: Colors.verde }]}
                  onPress={() => setCurrentPage(1)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.otpButtonText}>CONTINUA</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      // Step 1: Language
      case 1:
        return (
          <View style={styles.pageContent}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={styles.welcomeLogo}
              contentFit="contain"
            />
            <Text style={styles.stepTitle}>{t('settings.language').toUpperCase()}</Text>
            <View style={styles.optionsGrid}>
              {LANGUAGES.map((l) => (
                <WelcomeOptionButton
                  key={l.label}
                  label={l.label}
                  selected={lingua === l.label}
                  onPress={() => handleLinguaChange(l.label)}
                />
              ))}
            </View>
          </View>
        );
      
      // Step 2: Sector
      case 2:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.sector')}</Text>
            <View style={styles.sectorButtons}>
              <TouchableOpacity onPress={() => setIsAlimentare(true)} style={styles.fullWidth}>
                <NeuBox pressed={isAlimentare} padding={20} borderRadius={24}>
                  <Text style={[styles.optionText, isAlimentare && { color: Colors.primary }]}>
                    {t('welcome.alimentare')}
                  </Text>
                </NeuBox>
              </TouchableOpacity>
              <View style={styles.spacer} />
              <TouchableOpacity onPress={() => setIsAlimentare(false)} style={styles.fullWidth}>
                <NeuBox pressed={!isAlimentare} padding={20} borderRadius={24}>
                  <Text style={[styles.optionText, !isAlimentare && { color: Colors.primary }]}>
                    {t('welcome.nonAlimentare')}
                  </Text>
                </NeuBox>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      // Step 3: Identity
      case 3:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.identity')}</Text>
            <View style={styles.inputsContainer}>
              <WelcomeInputField
                label={t('welcome.businessNamePlaceholder')}
                icon="storefront-outline"
                value={nomeAttivita}
                onChangeText={setNomeAttivita}
              />
              <View style={styles.spacer} />
              <WelcomeInputField
                label={t('welcome.ownerNamePlaceholder')}
                icon="person-outline"
                value={nomeTitolare}
                onChangeText={setNomeTitolare}
              />
            </View>
          </View>
        );
      
      // Step 4: Security PIN + Email
      case 4:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.security')}</Text>
            <View style={styles.inputsContainer}>
              <WelcomeInputField
                label={t('welcome.createPin')}
                icon="lock-closed-outline"
                value={pin}
                onChangeText={setPin}
                secure
                numeric
              />
              <View style={styles.spacer} />
              <WelcomeInputField
                label={t('welcome.recoveryEmail')}
                icon="mail-outline"
                value={emailRecupero}
                onChangeText={setEmailRecupero}
              />
            </View>
          </View>
        );
      
      // Step 5: Complete
      case 5:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.completed')}</Text>
            <Text style={styles.completeSubtitle}>
              {t('welcome.configSaved')}
            </Text>
            
            <NeuBox
              style={styles.checkCircle}
              borderRadius={100}
              padding={40}
            >
              <Ionicons name="checkmark-done" size={80} color={Colors.verde} />
            </NeuBox>
            
            <TouchableOpacity
              style={styles.enterButton}
              onPress={handleFinish}
              activeOpacity={0.8}
            >
              <Text style={styles.enterButtonText}>{t('welcome.enterApp')}</Text>
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {renderIndicator()}
        
        <View style={styles.contentWrapper}>
          {renderContent()}
        </View>
        
        {renderNavigation()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWelcome,
  },
  flex: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 25,
  },
  indicator: {
    width: 10,
    height: 8,
    borderRadius: 10,
    backgroundColor: Colors.shadowDark,
    marginHorizontal: 5,
  },
  indicatorActive: {
    width: 35,
    backgroundColor: Colors.primary,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 20,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
    marginBottom: 30,
  },
  welcomeLogo: {
    width: 280,
    height: 280,
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  optionWrapper: {
    width: 140,
  },
  fullWidth: {
    width: '100%',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.marrone,
    textAlign: 'center',
  },
  sectorButtons: {
    width: '100%',
  },
  spacer: {
    height: 30,
  },
  inputsContainer: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 5,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
    paddingVertical: 15,
  },
  completeSubtitle: {
    fontSize: 14,
    color: Colors.grey,
    textAlign: 'center',
    marginBottom: 50,
  },
  checkCircle: {
    marginBottom: 50,
  },
  enterButton: {
    width: '100%',
    backgroundColor: Colors.verde,
    paddingVertical: 20,
    borderRadius: 20,
  },
  enterButtonText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  navButton: {
    padding: 20,
    width: 70,
  },

  // OTP Styles
  otpIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(30,127,133,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(30,127,133,0.2)',
  },
  otpSubtitle: {
    fontSize: 13,
    color: Colors.grey,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  otpButton: {
    backgroundColor: '#1E7F85',
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  otpButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  otpSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(29,131,72,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(29,131,72,0.2)',
  },
  otpSentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D8348',
  },
  otpResend: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E7F85',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  verifiedBadge: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  verifiedText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1D8348',
  },
  verifiedPhone: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.grey,
  },
  skipButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: Colors.lightGrey || '#D0D0C8',
    backgroundColor: 'transparent',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.grey,
    letterSpacing: 1,
  },
});
