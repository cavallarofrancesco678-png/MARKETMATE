/**
 * Tutorial Store — gestione guida interattiva passo-passo.
 * I passi con `field` scrivono direttamente nello appStore mentre l'utente digita.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from './appStore';

export type TutorialStepType = 'info' | 'input' | 'select' | 'multi' | 'nav_action';
export type RouteType = '/home/settings' | '/home' | '/home/agenda' | '/home/stats' | '/home/gas';

export interface TutorialField {
  field: string;
  type: 'text' | 'select';
  labelKey?: string;
  placeholderKey?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  options?: { value: string; labelKey?: string; label?: string }[];
}

export interface TutorialStep {
  id: string;
  tKey: string; // i18n key base: 'tutorial.steps.{id}'
  type: TutorialStepType;
  icon?: string;
  field?: keyof ReturnType<typeof useAppStore.getState>;
  route?: RouteType;
  inputKeyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'email-address';
  options?: { value: string; label: string }[];
  fields?: TutorialField[];
  navigateTo?: RouteType;
  // If a step targets 'home' sample data, we store in a local 'tutorialSample' field (not persisted as real data)
  sampleField?: 'lordo' | 'scontrini';
}

const CARBURANTE_OPTS = [
  { value: 'benzina', label: 'Benzina' },
  { value: 'gasolio', label: 'Diesel' },
  { value: 'gpl', label: 'GPL' },
  { value: 'metano', label: 'Metano' },
  { value: 'elettrico', label: 'Elettrico' },
];

export const TUTORIAL_STEPS: TutorialStep[] = [
  // 1. Benvenuto
  { id: 'welcome', tKey: 'tutorial.steps.welcome', type: 'info', icon: 'rocket-launch', route: '/home/settings' },

  // 2. Logistica: partenza + carburante
  { id: 'logistica', tKey: 'tutorial.steps.logistica', type: 'multi', icon: 'map-marker-radius', route: '/home/settings',
    fields: [
      { field: 'partenzaDa', type: 'text', labelKey: 'tutorial.steps.logistica.label1', placeholderKey: 'tutorial.steps.logistica.ph1' },
      { field: 'tipoCarburante', type: 'select', labelKey: 'tutorial.steps.logistica.label2', options: CARBURANTE_OPTS },
    ],
  },

  // 3. Settings intro: "Adesso configuriamo il motore"
  { id: 'settings_intro', tKey: 'tutorial.steps.settings_intro', type: 'info', icon: 'cog', route: '/home/settings' },

  // 4. Collaboratori (compact, scroll alla sezione Collaboratori)
  { id: 'collab_setup', tKey: 'tutorial.steps.collab_setup', type: 'info', icon: 'account-group', route: '/home/settings' },

  // 5. Agenda Mercati (in Settings, scroll a Mercati)
  { id: 'agenda_setup', tKey: 'tutorial.steps.agenda_setup', type: 'info', icon: 'calendar-week', route: '/home/settings' },

  // 6. Fornitori (in Settings, scroll a Fornitori)
  { id: 'fornitori_setup', tKey: 'tutorial.steps.fornitori_setup', type: 'info', icon: 'truck-delivery', route: '/home/settings' },

  // 7. Spese fisse (in Settings, scroll a Spese annue)
  { id: 'spese_fisse_setup', tKey: 'tutorial.steps.spese_fisse_setup', type: 'info', icon: 'cash-multiple', route: '/home/settings' },

  // 8. HOME!
  { id: 'home_calendar', tKey: 'tutorial.steps.home_calendar', type: 'info', icon: 'home', route: '/home' },

  // 9. Meteo del giorno
  { id: 'home_lordo', tKey: 'tutorial.steps.home_lordo', type: 'info', icon: 'weather-sunny', route: '/home' },

  // 10. Quanto hai incassato
  { id: 'home_incasso', tKey: 'tutorial.steps.home_incasso', type: 'info', icon: 'cash', route: '/home' },

  // 11. Spese Extra
  { id: 'spese_extra_voci', tKey: 'tutorial.steps.spese_extra_voci', type: 'info', icon: 'cart-variant', route: '/home' },

  // 12. AI «Buongiorno»
  { id: 'buongiorno', tKey: 'tutorial.steps.buongiorno', type: 'info', icon: 'robot-happy', route: '/home' },

  // 13. Riquadro statistiche in basso
  { id: 'home_stats_box', tKey: 'tutorial.steps.home_stats_box', type: 'info', icon: 'view-dashboard', route: '/home' },

  // 14. Salva la giornata
  { id: 'home_salva', tKey: 'tutorial.steps.home_salva', type: 'info', icon: 'content-save-check', route: '/home' },

  // 15. Pagina Statistiche
  { id: 'stats', tKey: 'tutorial.steps.stats', type: 'info', icon: 'chart-bar', route: '/home/stats' },

  // 16. Carburante (apri pagina gas, inserisci valore)
  { id: 'carburante_setup', tKey: 'tutorial.steps.carburante_setup', type: 'info', icon: 'gas-station', route: '/home/gas' },

  // 17. Notes (apri agenda, fai un appuntamento)
  { id: 'notes_setup', tKey: 'tutorial.steps.notes_setup', type: 'info', icon: 'note-edit', route: '/home/agenda' },

  // 18. Backup
  { id: 'backup_info', tKey: 'tutorial.steps.backup_info', type: 'info', icon: 'cloud-upload', route: '/home/settings' },

  // 19. Done
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
