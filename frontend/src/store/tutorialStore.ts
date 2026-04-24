/**
 * Tutorial Store — gestione guida interattiva passo-passo.
 * I passi con `field` scrivono direttamente nello appStore mentre l'utente digita.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from './appStore';

export type TutorialStepType = 'info' | 'input' | 'select' | 'nav';
export type RouteType = '/home/settings' | '/home';

export interface TutorialStep {
  id: string;
  tKey: string; // i18n key base: 'tutorial.steps.{id}'
  type: TutorialStepType;
  icon?: string;
  field?: keyof ReturnType<typeof useAppStore.getState>;
  route?: RouteType;
  inputKeyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'email-address';
  options?: { value: string; label: string }[];
  // If a step targets 'home' sample data, we store in a local 'tutorialSample' field (not persisted as real data)
  sampleField?: 'lordo' | 'scontrini';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', tKey: 'tutorial.steps.welcome', type: 'info', icon: 'rocket-launch', route: '/home/settings' },
  { id: 'nomeAttivita', tKey: 'tutorial.steps.nomeAttivita', type: 'input', icon: 'storefront', field: 'nomeAttivita', route: '/home/settings' },
  { id: 'nomeTitolare', tKey: 'tutorial.steps.nomeTitolare', type: 'input', icon: 'account', field: 'nomeTitolare' as any, route: '/home/settings' },
  { id: 'partenzaDa', tKey: 'tutorial.steps.partenzaDa', type: 'input', icon: 'map-marker', field: 'partenzaDa', route: '/home/settings' },
  { id: 'carburante', tKey: 'tutorial.steps.carburante', type: 'select', icon: 'gas-station', field: 'tipoCarburante',
    options: [
      { value: 'benzina', label: 'Benzina' },
      { value: 'gasolio', label: 'Diesel/Gasolio' },
      { value: 'gpl', label: 'GPL' },
      { value: 'metano', label: 'Metano' },
      { value: 'elettrico', label: 'Elettrico' },
    ], route: '/home/settings' },
  { id: 'agendaMercati', tKey: 'tutorial.steps.agendaMercati', type: 'info', icon: 'calendar-week', route: '/home/settings' },
  { id: 'fornitori', tKey: 'tutorial.steps.fornitori', type: 'info', icon: 'truck-delivery', route: '/home/settings' },
  { id: 'collaboratori', tKey: 'tutorial.steps.collaboratori', type: 'info', icon: 'account-group', route: '/home/settings' },
  { id: 'goHome', tKey: 'tutorial.steps.goHome', type: 'nav', icon: 'home', route: '/home' },
  { id: 'home_meteo', tKey: 'tutorial.steps.home_meteo', type: 'info', icon: 'weather-sunny', route: '/home' },
  { id: 'home_lordo', tKey: 'tutorial.steps.home_lordo', type: 'input', icon: 'cash', sampleField: 'lordo', inputKeyboardType: 'decimal-pad', route: '/home' },
  { id: 'home_scontrini', tKey: 'tutorial.steps.home_scontrini', type: 'input', icon: 'receipt', sampleField: 'scontrini', inputKeyboardType: 'number-pad', route: '/home' },
  { id: 'home_spese', tKey: 'tutorial.steps.home_spese', type: 'info', icon: 'currency-eur', route: '/home' },
  { id: 'home_salva', tKey: 'tutorial.steps.home_salva', type: 'info', icon: 'content-save', route: '/home' },
  { id: 'stats', tKey: 'tutorial.steps.stats', type: 'info', icon: 'chart-bar', route: '/home' },
  { id: 'buongiorno', tKey: 'tutorial.steps.buongiorno', type: 'info', icon: 'robot-happy', route: '/home' },
  { id: 'done', tKey: 'tutorial.steps.done', type: 'info', icon: 'trophy', route: '/home' },
];

const TUTORIAL_DONE_KEY = 'marketmate_tutorial_done_v1';

interface TutorialState {
  active: boolean;
  stepIndex: number;
  sampleLordo: string;
  sampleScontrini: string;
  hasCompletedOnce: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  start: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goTo: (idx: number) => void;
  skip: () => Promise<void>;
  complete: () => Promise<void>;
  setSampleLordo: (v: string) => void;
  setSampleScontrini: (v: string) => void;
  getCurrentStep: () => TutorialStep | null;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  stepIndex: 0,
  sampleLordo: '',
  sampleScontrini: '',
  hasCompletedOnce: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(TUTORIAL_DONE_KEY);
      set({ hasCompletedOnce: !!v, isHydrated: true });
    } catch { set({ isHydrated: true }); }
  },

  start: () => set({ active: true, stepIndex: 0, sampleLordo: '', sampleScontrini: '' }),

  nextStep: () => {
    const { stepIndex } = get();
    if (stepIndex < TUTORIAL_STEPS.length - 1) set({ stepIndex: stepIndex + 1 });
    else get().complete();
  },

  prevStep: () => {
    const { stepIndex } = get();
    if (stepIndex > 0) set({ stepIndex: stepIndex - 1 });
  },

  goTo: (idx) => set({ stepIndex: Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, idx)) }),

  skip: async () => {
    try { await AsyncStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch {}
    set({ active: false, hasCompletedOnce: true });
  },

  complete: async () => {
    try { await AsyncStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch {}
    set({ active: false, hasCompletedOnce: true });
  },

  setSampleLordo: (v) => set({ sampleLordo: v }),
  setSampleScontrini: (v) => set({ sampleScontrini: v }),

  getCurrentStep: () => TUTORIAL_STEPS[get().stepIndex] || null,
}));
