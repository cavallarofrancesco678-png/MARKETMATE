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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { NeuBox } from '../src/components/NeuBox';
import { Colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES } from '../src/i18n';

export default function WelcomeScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  
  const [lingua, setLingua] = useState('Italiano');
  const [isAlimentare, setIsAlimentare] = useState(true);
  const [nomeAttivita, setNomeAttivita] = useState('');
  const [nomeTitolare, setNomeTitolare] = useState('');
  const [pin, setPin] = useState('');
  const [emailRecupero, setEmailRecupero] = useState('');
  
  const { setConfig } = useAppStore();
  const { t } = useTranslation();

  // Map display name to language code
  const LINGUA_MAP: Record<string, string> = {
    'Italiano': 'it', 'English': 'en', 'Français': 'fr',
    'Deutsch': 'de', 'Español': 'es', 'Português': 'pt',
  };

  const handleLinguaChange = (l: string) => {
    setLingua(l);
    const code = LINGUA_MAP[l] || 'it';
    changeLanguage(code);
  };

  const handleFinish = () => {
    setConfig({
      isConfigured: true,
      lingua,
      isAlimentare,
      nomeAttivita: nomeAttivita || 'MarketMate',
      nomeTitolare: nomeTitolare || 'Titolare',
      pin,
      emailRecupero,
    });
    router.replace('/home');
  };

  const renderIndicator = () => (
    <View style={styles.indicatorContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.indicator,
            currentPage === i && styles.indicatorActive,
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
      
      {currentPage < 4 ? (
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentPage(currentPage + 1)}
        >
          <Ionicons name="arrow-forward" size={32} color={Colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.navButton} />
      )}
    </View>
  );

  const OptionButton = ({ label, selected, onPress }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} style={styles.optionWrapper}>
      <NeuBox
        pressed={selected}
        padding={20}
        borderRadius={24}
      >
        <Text style={[
          styles.optionText,
          selected && { color: Colors.primary },
        ]}>
          {label}
        </Text>
      </NeuBox>
    </TouchableOpacity>
  );

  const InputField = ({ label, icon, value, onChangeText, secure, numeric }: {
    label: string;
    icon: string;
    value: string;
    onChangeText: (text: string) => void;
    secure?: boolean;
    numeric?: boolean;
  }) => (
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
          keyboardType={numeric ? 'number-pad' : 'default'}
        />
      </View>
    </NeuBox>
  );

  const renderContent = () => {
    switch (currentPage) {
      case 0:
        return (
          <View style={styles.pageContent}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_fato-status-1/artifacts/mccpqau2_logo%20marketmate.svg' }}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
            <Text style={styles.stepTitle}>{t('settings.language').toUpperCase()}</Text>
            <View style={styles.optionsGrid}>
              {LANGUAGES.map((l) => (
                <OptionButton
                  key={l.label}
                  label={l.label}
                  selected={lingua === l.label}
                  onPress={() => handleLinguaChange(l.label)}
                />
              ))}
            </View>
          </View>
        );
      
      case 1:
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
      
      case 2:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.identity')}</Text>
            <View style={styles.inputsContainer}>
              <InputField
                label={t('welcome.businessNamePlaceholder')}
                icon="storefront-outline"
                value={nomeAttivita}
                onChangeText={setNomeAttivita}
              />
              <View style={styles.spacer} />
              <InputField
                label={t('welcome.ownerNamePlaceholder')}
                icon="person-outline"
                value={nomeTitolare}
                onChangeText={setNomeTitolare}
              />
            </View>
          </View>
        );
      
      case 3:
        return (
          <View style={styles.pageContent}>
            <Text style={styles.stepTitle}>{t('welcome.security')}</Text>
            <View style={styles.inputsContainer}>
              <InputField
                label={t('welcome.createPin')}
                icon="lock-closed-outline"
                value={pin}
                onChangeText={setPin}
                secure
                numeric
              />
              <View style={styles.spacer} />
              <InputField
                label={t('welcome.recoveryEmail')}
                icon="mail-outline"
                value={emailRecupero}
                onChangeText={setEmailRecupero}
              />
            </View>
          </View>
        );
      
      case 4:
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
  scrollContent: {
    flexGrow: 1,
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
    width: 160,
    height: 160,
    marginBottom: 15,
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
});
