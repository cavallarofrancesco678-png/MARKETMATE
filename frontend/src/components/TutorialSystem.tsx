import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width: W, height: H } = Dimensions.get('window');

// ── Types ──
export interface TutorialStep {
  key: string; // i18n key for title
  descKey: string; // i18n key for description
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

// ── Storage Keys ──
const STORAGE_KEY = 'marketmate_tutorial_completed';

// ── Provider ──
export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [screenKey, setScreenKey] = useState('');
  const allSteps = useRef<Record<string, TutorialStep[]>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();

  const registerSteps = useCallback((key: string, stepList: TutorialStep[]) => {
    allSteps.current[key] = stepList;
  }, []);

  const startTutorial = useCallback(async (key: string, force = false) => {
    if (!force) {
      try {
        const completed = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = completed ? JSON.parse(completed) : {};
        if (parsed[key]) return; // Already completed
      } catch {}
    }

    const stepList = allSteps.current[key];
    if (!stepList || stepList.length === 0) return;

    setScreenKey(key);
    setSteps(stepList);
    setCurrentStep(0);
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleClose = useCallback(async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setSteps([]);
      setCurrentStep(0);
    });

    // Mark as completed
    try {
      const completed = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = completed ? JSON.parse(completed) : {};
      parsed[screenKey] = true;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }, [fadeAnim, screenKey]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const posStyle = step?.position === 'top' ? { top: 80 } : step?.position === 'bottom' ? { bottom: 100 } : { top: H * 0.25 };

  return (
    <TutorialContext.Provider value={{ startTutorial, registerSteps, isTutorialActive: visible }}>
      {children}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={st.overlayBg} activeOpacity={1} onPress={handleClose} />
          
          <Animated.View style={[st.card, posStyle]}>
            {/* Progress bar */}
            <View style={st.progressRow}>
              {steps.map((_, i) => (
                <View key={i} style={[st.dot, i === currentStep && st.dotActive, i < currentStep && st.dotDone]} />
              ))}
            </View>

            {/* Step counter */}
            <Text style={st.stepCount}>{currentStep + 1} / {steps.length}</Text>

            {/* Icon */}
            {step?.icon && (
              <View style={st.iconWrap}>
                <Ionicons name={step.icon as any} size={36} color="#1E7F85" />
              </View>
            )}

            {/* Title */}
            <Text style={st.title}>{t(step?.key || '')}</Text>

            {/* Description */}
            <Text style={st.desc}>{t(step?.descKey || '')}</Text>

            {/* Navigation */}
            <View style={st.navRow}>
              {!isFirst ? (
                <TouchableOpacity style={st.prevBtn} onPress={handlePrev}>
                  <Ionicons name="chevron-back" size={18} color="#1E7F85" />
                  <Text style={st.prevTxt}>{t('tutorial.prev') || 'Indietro'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={st.skipBtn} onPress={handleClose}>
                  <Text style={st.skipTxt}>{t('tutorial.skip') || 'Salta'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={st.nextBtn} onPress={handleNext} activeOpacity={0.8}>
                <Text style={st.nextTxt}>
                  {isLast ? (t('tutorial.done') || 'Ho capito!') : (t('tutorial.next') || 'Avanti')}
                </Text>
                {!isLast && <Ionicons name="chevron-forward" size={16} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
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
      <Ionicons name="help" size={22} color="#FFF" />
    </TouchableOpacity>
  );
};

// ── Tutorial Step Configs per Screen ──
export const TUTORIAL_STEPS: Record<string, TutorialStep[]> = {
  home: [
    { key: 'tutorial.home.welcome', descKey: 'tutorial.home.welcomeDesc', icon: 'sunny-outline', position: 'center' },
    { key: 'tutorial.home.lordo', descKey: 'tutorial.home.lordoDesc', icon: 'cash-outline', position: 'center' },
    { key: 'tutorial.home.meteo', descKey: 'tutorial.home.meteoDesc', icon: 'partly-sunny-outline', position: 'top' },
    { key: 'tutorial.home.collaboratori', descKey: 'tutorial.home.collaboratoriDesc', icon: 'people-outline', position: 'center' },
    { key: 'tutorial.home.spese', descKey: 'tutorial.home.speseDesc', icon: 'wallet-outline', position: 'center' },
    { key: 'tutorial.home.buongiorno', descKey: 'tutorial.home.buongiornoDesc', icon: 'chatbubble-ellipses-outline', position: 'bottom' },
    { key: 'tutorial.home.salva', descKey: 'tutorial.home.salvaDesc', icon: 'save-outline', position: 'bottom' },
  ],
  agenda: [
    { key: 'tutorial.agenda.calendar', descKey: 'tutorial.agenda.calendarDesc', icon: 'calendar-outline', position: 'top' },
    { key: 'tutorial.agenda.colors', descKey: 'tutorial.agenda.colorsDesc', icon: 'color-palette-outline', position: 'center' },
    { key: 'tutorial.agenda.notes', descKey: 'tutorial.agenda.notesDesc', icon: 'document-text-outline', position: 'bottom' },
  ],
  gas: [
    { key: 'tutorial.gas.search', descKey: 'tutorial.gas.searchDesc', icon: 'car-outline', position: 'top' },
    { key: 'tutorial.gas.prices', descKey: 'tutorial.gas.pricesDesc', icon: 'pricetag-outline', position: 'center' },
    { key: 'tutorial.gas.history', descKey: 'tutorial.gas.historyDesc', icon: 'time-outline', position: 'bottom' },
  ],
  stats: [
    { key: 'tutorial.stats.charts', descKey: 'tutorial.stats.chartsDesc', icon: 'bar-chart-outline', position: 'top' },
    { key: 'tutorial.stats.filters', descKey: 'tutorial.stats.filtersDesc', icon: 'funnel-outline', position: 'center' },
    { key: 'tutorial.stats.days', descKey: 'tutorial.stats.daysDesc', icon: 'calendar-number-outline', position: 'bottom' },
  ],
  settings: [
    { key: 'tutorial.settings.agenda', descKey: 'tutorial.settings.agendaDesc', icon: 'calendar-outline', position: 'top' },
    { key: 'tutorial.settings.collab', descKey: 'tutorial.settings.collabDesc', icon: 'people-outline', position: 'center' },
    { key: 'tutorial.settings.spese', descKey: 'tutorial.settings.speseDesc', icon: 'receipt-outline', position: 'center' },
    { key: 'tutorial.settings.fuel', descKey: 'tutorial.settings.fuelDesc', icon: 'car-outline', position: 'bottom' },
  ],
};

// ── Reset tutorial (for testing) ──
export const resetTutorial = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 30, 30, 0.75)',
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: '#F5FAF8',
    borderRadius: 20,
    padding: 24,
    position: 'absolute',
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0DDD8',
  },
  dotActive: {
    backgroundColor: '#1E7F85',
    width: 24,
  },
  dotDone: {
    backgroundColor: '#5AAA6A',
  },
  stepCount: {
    textAlign: 'center',
    fontSize: 11,
    color: '#7A9A90',
    fontWeight: '600',
    marginBottom: 8,
  },
  iconWrap: {
    alignSelf: 'center',
    backgroundColor: '#E0F2EE',
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A3535',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  desc: {
    fontSize: 14,
    color: '#4A6A65',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  prevTxt: {
    fontSize: 14,
    color: '#1E7F85',
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  skipTxt: {
    fontSize: 14,
    color: '#9AB0A8',
    fontWeight: '600',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E7F85',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 4,
  },
  nextTxt: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
});
