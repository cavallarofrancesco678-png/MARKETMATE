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
            <NeuBox
              color={Colors.primary}
              borderRadius={30}
              padding={35}
            >
              <MarketMateLogo size={100} color={Colors.marrone} />
            </NeuBox>
          </View>

          <Text style={styles.title}>BENTORNATO</Text>
          <Text style={styles.subtitle}>
            {isConfigured ? nomeAttivita : 'Gestisci il tuo mercato'}
          </Text>

          <View style={styles.inputContainer}>
            <NeuBox pressed borderRadius={50} padding={0}>
              <TextInput
                style={styles.input}
                placeholder="INSERISCI PIN"
                placeholderTextColor={`${Colors.marrone}80`}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
            </NeuBox>
          </View>

          <TouchableOpacity
            style={styles.accediButton}
            onPress={handleAccedi}
            activeOpacity={0.8}
          >
            <Text style={styles.accediText}>ACCEDI</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={handleConfigura}>
            <View style={styles.configRow}>
              <Ionicons name="rocket-outline" size={20} color={Colors.primary} />
              <Text style={styles.configText}>
                {isConfigured ? 'Riconfigura l\'app' : 'Prima volta? Configura l\'app'}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWelcome,
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
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.grey,
    marginBottom: 60,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  input: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  accediButton: {
    width: '100%',
    backgroundColor: Colors.verde,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  accediText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.shadowDark,
    marginVertical: 40,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configText: {
    color: `${Colors.marrone}99`,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
