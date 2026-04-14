import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width: W } = Dimensions.get('window');

// ── Types ──
export interface TutorialStep {
  key: string;
  descKey: string;
  icon?: string;
  position?: 'top' | 'center' | 'bottom';
}

interface TutorialContextType {
  startTutorial: (screenKey: string, force?: boolean) => void;
  registerSteps: (screenKey: string, steps: TutorialStep[]) => void;
  isTutorialActive: boolean;
}

const TutorialContext = createContext<TutorialContextType>({
  startTutorial: () => {},
  registerSteps: () => {},
  isTutorialActive: false,
});

export const useTutorial = () => useContext(TutorialContext);

const STORAGE_KEY = 'marketmate_tutorial_completed';

// ── Provider with NON-BLOCKING floating banner ──
export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [screenKey, setScreenKey] = useState('');
  const allSteps = useRef<Record<string, TutorialStep[]>>({});
  const slideAnim = useRef(new Animated.Value(120)).current;
  const { t } = useTranslation();

  const registerSteps = useCallback((key: string, stepList: TutorialStep[]) => {
    allSteps.current[key] = stepList;
  }, []);

  const startTutorial = useCallback(async (key: string, force = false) => {
    if (!force) {
      try {
        const completed = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = completed ? JSON.parse(completed) : {};
        if (parsed[key]) return;
      } catch {}
    }

    const stepList = allSteps.current[key];
    if (!stepList || stepList.length === 0) return;

    setScreenKey(key);
    setSteps(stepList);
    setCurrentStep(0);
    setVisible(true);
    slideAnim.setValue(120);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      // Slide out and back in
      Animated.timing(slideAnim, { toValue: 120, duration: 150, useNativeDriver: true }).start(() => {
        setCurrentStep(prev => prev + 1);
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }).start();
      });
    } else {
      handleClose();
    }
  }, [currentStep, steps.length, slideAnim]);

  const handleClose = useCallback(async () => {
    Animated.timing(slideAnim, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
      setSteps([]);
      setCurrentStep(0);
    });
    try {
      const completed = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = completed ? JSON.parse(completed) : {};
      parsed[screenKey] = true;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }, [slideAnim, screenKey]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <TutorialContext.Provider value={{ startTutorial, registerSteps, isTutorialActive: visible }}>
      {children}
      {visible && step && (
        <Animated.View
          style={[st.banner, { transform: [{ translateY: slideAnim }] }]}
          pointerEvents="box-none"
        >
          <View style={st.bannerInner}>
            {/* Progress dots */}
            <View style={st.progressRow}>
              {steps.map((_, i) => (
                <View key={i} style={[st.dot, i === currentStep && st.dotActive, i < currentStep && st.dotDone]} />
              ))}
            </View>

            <View style={st.contentRow}>
              {/* Icon */}
              {step.icon && (
                <View style={st.iconCircle}>
                  <Ionicons name={step.icon as any} size={24} color="#FFF" />
                </View>
              )}

              {/* Text - short! */}
              <View style={st.textCol}>
                <Text style={st.title} numberOfLines={1}>{t(step.key)}</Text>
                <Text style={st.desc} numberOfLines={2}>{t(step.descKey)}</Text>
              </View>

              {/* Next / Close */}
              <TouchableOpacity style={st.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                <Ionicons
                  name={isLast ? 'checkmark' : 'chevron-forward'}
                  size={20}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>

            {/* Close X */}
            <TouchableOpacity style={st.closeBtn} onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={16} color="#7A9A90" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </TutorialContext.Provider>
  );
};

// ── FAB "?" Button ──
export const TutorialFAB: React.FC<{ screenKey: string }> = ({ screenKey }) => {
  const { startTutorial } = useTutorial();

  return (
    <TouchableOpacity
      testID="tutorial-fab"
      style={st.fab}
      onPress={() => startTutorial(screenKey, true)}
      activeOpacity={0.8}
    >
      <Ionicons name="help" size={20} color="#FFF" />
    </TouchableOpacity>
  );
};

// ── Tutorial Steps — SHORT text, action-oriented ──
export const TUTORIAL_STEPS: Record<string, TutorialStep[]> = {
  home: [
    { key: 'tutorial.home.welcome', descKey: 'tutorial.home.welcomeDesc', icon: 'sunny-outline' },
    { key: 'tutorial.home.lordo', descKey: 'tutorial.home.lordoDesc', icon: 'cash-outline' },
    { key: 'tutorial.home.spese', descKey: 'tutorial.home.speseDesc', icon: 'wallet-outline' },
    { key: 'tutorial.home.salva', descKey: 'tutorial.home.salvaDesc', icon: 'save-outline' },
  ],
  agenda: [
    { key: 'tutorial.agenda.calendar', descKey: 'tutorial.agenda.calendarDesc', icon: 'calendar-outline' },
  ],
  gas: [
    { key: 'tutorial.gas.search', descKey: 'tutorial.gas.searchDesc', icon: 'car-outline' },
  ],
  stats: [
    { key: 'tutorial.stats.charts', descKey: 'tutorial.stats.chartsDesc', icon: 'bar-chart-outline' },
  ],
  settings: [
    { key: 'tutorial.settings.agenda', descKey: 'tutorial.settings.agendaDesc', icon: 'calendar-outline' },
    { key: 'tutorial.settings.collab', descKey: 'tutorial.settings.collabDesc', icon: 'people-outline' },
    { key: 'tutorial.settings.spese', descKey: 'tutorial.settings.speseDesc', icon: 'receipt-outline' },
    { key: 'tutorial.settings.fuel', descKey: 'tutorial.settings.fuelDesc', icon: 'car-outline' },
  ],
};

export const resetTutorial = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

const st = StyleSheet.create({
  // Non-blocking floating banner at bottom
  banner: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  bannerInner: {
    backgroundColor: '#1A3535',
    borderRadius: 16,
    padding: 14,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A5555',
  },
  dotActive: {
    backgroundColor: '#5DCCB5',
    width: 18,
  },
  dotDone: {
    backgroundColor: '#5AAA6A',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E0F2EE',
    letterSpacing: 0.3,
  },
  desc: {
    fontSize: 12,
    color: '#A0C0B8',
    lineHeight: 16,
    marginTop: 2,
  },
  nextBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 998,
  },
});
