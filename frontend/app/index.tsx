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
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { NeuBox, NeuInset } from '../src/components/NeuBox';
import { MarketMateLogo } from '../src/components/Logo';
import { Colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const { isConfigured, pin: savedPin, nomeAttivita, loadFromStorage } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await loadFromStorage();
      setIsLoading(false);
    };
    init();
  }, []);

  const handleAccedi = () => {
    if (savedPin && pin !== savedPin) {
      Alert.alert('Errore', 'PIN non corretto');
      return;
    }
    router.replace('/home');
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <MarketMateLogo size={80} color={Colors.marrone} />
            </View>
            <Text style={styles.logoText}>MARKETMATE</Text>
          </View>

          <Text style={styles.title}>BENTORNATO</Text>
          <Text style={styles.subtitle}>
            {isConfigured ? nomeAttivita : 'Gestisci il tuo mercato'}
          </Text>

          <View style={styles.inputContainer}>
            <NeuInset style={styles.pinInput}>
              <TextInput
                style={styles.input}
                placeholder="INSERISCI PIN"
                placeholderTextColor={Colors.grey}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
            </NeuInset>
          </View>

          <TouchableOpacity
            style={styles.accediButton}
            onPress={handleAccedi}
            activeOpacity={0.8}
          >
            <Text style={styles.accediText}>ACCEDI</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={handleConfigura} style={styles.configButton}>
            <Ionicons name="rocket-outline" size={20} color={Colors.terracotta} />
            <Text style={styles.configText}>
              {isConfigured ? 'RICONFIGURA L\'APP' : 'PRIMA VOLTA? CONFIGURA LA APP'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  logoContainer: {
    marginTop: 30,
    marginBottom: 40,
    alignItems: 'center',
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
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.grey,
    marginBottom: 50,
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
    marginVertical: 35,
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
