import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateAllMockData } from '../utils/mockData';

export interface Collaboratore {
  nome: string;
  costo: number;
  costoAnnuo: number;
}

export interface Prodotto {
  nome: string;
  prezzo: number;
}

export interface Fornitore {
  nome: string;
  prodotti: Prodotto[];
}

export interface MercatoAgenda {
  giorno: string;
  mercato: string;
  km: number;
  p_giornaliero: number;
  p_annuo: number;
  is_plat_annuo: boolean;
  lavorativo: boolean;
  mediaScontrino: number;
}

export interface SpesaAnnua {
  voce: string;
  importo: number;
}

export interface Giornata {
  data: Date;
  mercato: string;
  meteo: string;
  km: number;
  lordo: number;
  netto: number;
  contanti: number;
  pos: number;
  spese_extra: number;
  dettaglio_staff: Record<string, number>;
  dettaglio_invenduto: Record<string, number>;
  dettaglio_fornitori: Record<string, number>;
}

export interface Carburante {
  data: Date;
  euro: number;
}

export interface Appunto {
  data: Date;
  testo: string;
}

export interface DiarioEntry {
  data: Date;
  testo: string;
}

export interface ScontrinoRecord {
  data: string;
  mercato: string;
  totale: number;
  numScontrini: number;
  mediaScontrino: number;
}

interface AppState {
  // Config
  isConfigured: boolean;
  lingua: string;
  isAlimentare: boolean;
  nomeAttivita: string;
  nomeTitolare: string;
  pin: string;
  emailRecupero: string;
  themeColor: string;
  partenzaDa: string;
  targetMensile: number;
  settore: string;
  tipoCarburante: string;
  phoneNumber: string;
  otpEnabled: boolean;
  speseFisseDisabilitate: string[];
  
  // Data
  collaboratori: Collaboratore[];
  fornitori: Fornitore[];
  agenda: MercatoAgenda[];
  speseAnnue: SpesaAnnua[];
  storicoGiornate: Giornata[];
  storicoCarburante: Carburante[];
  appuntiAgenda: Appunto[];
  storicoDiario: DiarioEntry[];
  speseExtraTags: string[];
  storicoScontrini: ScontrinoRecord[];
  
  // Actions
  setConfig: (config: Partial<AppState>) => void;
  addCollaboratore: (c: Collaboratore) => void;
  removeCollaboratore: (nome: string) => void;
  addFornitore: (f: Fornitore) => void;
  removeFornitore: (nome: string) => void;
  updateAgenda: (agenda: MercatoAgenda[]) => void;
  addSpesaAnnua: (s: SpesaAnnua) => void;
  removeSpesaAnnua: (voce: string) => void;
  salvaGiornata: (g: Giornata) => void;
  addCarburante: (c: Carburante) => void;
  removeCarburante: (data: Date) => void;
  addAppunto: (a: Appunto) => void;
  removeAppunto: (data: Date, testo: string) => void;
  addDiario: (d: DiarioEntry) => void;
  removeDiario: (data: Date) => void;
  getDiarioForDate: (data: Date) => DiarioEntry | undefined;
  addSpeseExtraTag: (tag: string) => void;
  removeSpeseExtraTag: (tag: string) => void;
  addScontrino: (s: ScontrinoRecord) => void;
  getScontriniForMercato: (mercato: string) => ScontrinoRecord[];
  seedMockData: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  resetAll: () => void;
}

const defaultAgenda: MercatoAgenda[] = [
  { giorno: 'LUNEDÌ', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'MARTEDÌ', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'MERCOLEDÌ', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'GIOVEDÌ', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'VENERDÌ', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'SABATO', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  { giorno: 'DOMENICA', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
];

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isConfigured: false,
  lingua: 'Italiano',
  isAlimentare: true,
  nomeAttivita: 'MarketMate',
  nomeTitolare: '',
  pin: '',
  emailRecupero: '',
  themeColor: '#D2691E',
  partenzaDa: '',
  targetMensile: 3000,
  settore: 'Alimentare',
  tipoCarburante: 'benzina',
  phoneNumber: '',
  otpEnabled: false,
  speseFisseDisabilitate: [],
  
  collaboratori: [],
  fornitori: [],
  agenda: defaultAgenda,
  speseAnnue: [],
  storicoGiornate: [],
  storicoCarburante: [],
  appuntiAgenda: [],
  storicoDiario: [],
  speseExtraTags: [],
  storicoScontrini: [],
  
  // Actions
  setConfig: (config) => {
    set((state) => ({ ...state, ...config }));
    get().saveToStorage();
  },
  
  addCollaboratore: (c) => {
    set((state) => ({ collaboratori: [...state.collaboratori, c] }));
    get().saveToStorage();
  },
  
  removeCollaboratore: (nome) => {
    set((state) => ({ collaboratori: state.collaboratori.filter(c => c.nome !== nome) }));
    get().saveToStorage();
  },
  
  addFornitore: (f) => {
    set((state) => ({ fornitori: [...state.fornitori, f] }));
    get().saveToStorage();
  },
  
  removeFornitore: (nome) => {
    set((state) => ({ fornitori: state.fornitori.filter(f => f.nome !== nome) }));
    get().saveToStorage();
  },
  
  updateAgenda: (agenda) => {
    set({ agenda });
    get().saveToStorage();
  },
  
  addSpesaAnnua: (s) => {
    set((state) => ({ speseAnnue: [...state.speseAnnue, s] }));
    get().saveToStorage();
  },
  
  removeSpesaAnnua: (voce) => {
    set((state) => ({ speseAnnue: state.speseAnnue.filter(s => s.voce !== voce) }));
    get().saveToStorage();
  },
  
  salvaGiornata: (g) => {
    set((state) => {
      const existing = state.storicoGiornate.findIndex(
        (item) => new Date(item.data).toDateString() === new Date(g.data).toDateString()
      );
      if (existing !== -1) {
        const updated = [...state.storicoGiornate];
        updated[existing] = g;
        return { storicoGiornate: updated };
      }
      return { storicoGiornate: [...state.storicoGiornate, g] };
    });
    get().saveToStorage();
  },
  
  addCarburante: (c) => {
    set((state) => ({ storicoCarburante: [...state.storicoCarburante, c] }));
    get().saveToStorage();
  },
  
  removeCarburante: (data) => {
    const targetTime = new Date(data).getTime();
    set((state) => {
      // Remove first matching entry only
      let removed = false;
      return {
        storicoCarburante: state.storicoCarburante.filter(c => {
          if (!removed && new Date(c.data).getTime() === targetTime) {
            removed = true;
            return false;
          }
          return true;
        })
      };
    });
    get().saveToStorage();
  },
  
  addAppunto: (a) => {
    set((state) => ({ appuntiAgenda: [...state.appuntiAgenda, a] }));
    get().saveToStorage();
  },
  
  removeAppunto: (data, testo) => {
    set((state) => {
      let removed = false;
      return {
        appuntiAgenda: state.appuntiAgenda.filter(a => {
          if (!removed && a.testo === testo) {
            const aDate = new Date(a.data).toDateString();
            const targetDate = new Date(data).toDateString();
            if (aDate === targetDate) {
              removed = true;
              return false;
            }
          }
          return true;
        })
      };
    });
    get().saveToStorage();
  },
  
  addDiario: (d) => {
    set((state) => {
      // Replace if same date exists, otherwise add
      const dateStr = new Date(d.data).toDateString();
      const existing = state.storicoDiario.findIndex(
        e => new Date(e.data).toDateString() === dateStr
      );
      if (existing !== -1) {
        const updated = [...state.storicoDiario];
        updated[existing] = d;
        return { storicoDiario: updated };
      }
      return { storicoDiario: [...state.storicoDiario, d] };
    });
    get().saveToStorage();
  },
  
  removeDiario: (data) => {
    set((state) => ({
      storicoDiario: state.storicoDiario.filter(
        d => new Date(d.data).toDateString() !== new Date(data).toDateString()
      )
    }));
    get().saveToStorage();
  },
  
  getDiarioForDate: (data) => {
    return get().storicoDiario.find(
      d => new Date(d.data).toDateString() === new Date(data).toDateString()
    );
  },

  addSpeseExtraTag: (tag) => {
    set((state) => {
      if (state.speseExtraTags.includes(tag)) return state;
      return { speseExtraTags: [...state.speseExtraTags, tag] };
    });
    get().saveToStorage();
  },

  removeSpeseExtraTag: (tag) => {
    set((state) => ({ speseExtraTags: state.speseExtraTags.filter(t => t !== tag) }));
    get().saveToStorage();
  },

  addScontrino: (s) => {
    set((state) => ({ storicoScontrini: [...state.storicoScontrini, s] }));
    get().saveToStorage();
  },

  getScontriniForMercato: (mercato) => {
    return get().storicoScontrini.filter(s => s.mercato === mercato);
  },
  
  seedMockData: () => {
    const mock = generateAllMockData();
    set((state) => ({ ...state, ...mock }));
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const data = await AsyncStorage.getItem('marketmate_data');
      if (data) {
        const parsed = JSON.parse(data);
        set(parsed);
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
  },
  
  saveToStorage: async () => {
    try {
      const state = get();
      const dataToSave = {
        isConfigured: state.isConfigured,
        lingua: state.lingua,
        isAlimentare: state.isAlimentare,
        nomeAttivita: state.nomeAttivita,
        nomeTitolare: state.nomeTitolare,
        pin: state.pin,
        emailRecupero: state.emailRecupero,
        themeColor: state.themeColor,
        targetMensile: state.targetMensile,
        settore: state.settore,
        tipoCarburante: state.tipoCarburante,
        phoneNumber: state.phoneNumber,
        otpEnabled: state.otpEnabled,
        speseFisseDisabilitate: state.speseFisseDisabilitate,
        partenzaDa: state.partenzaDa,
        collaboratori: state.collaboratori,
        fornitori: state.fornitori,
        agenda: state.agenda,
        speseAnnue: state.speseAnnue,
        storicoGiornate: state.storicoGiornate,
        storicoCarburante: state.storicoCarburante,
        appuntiAgenda: state.appuntiAgenda,
        storicoDiario: state.storicoDiario,
        speseExtraTags: state.speseExtraTags,
        storicoScontrini: state.storicoScontrini,
      };
      await AsyncStorage.setItem('marketmate_data', JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Error saving data:', e);
    }
  },
  
  resetAll: () => {
    set({
      isConfigured: false,
      lingua: 'Italiano',
      isAlimentare: true,
      nomeAttivita: 'MarketMate',
      nomeTitolare: '',
      pin: '',
      emailRecupero: '',
      themeColor: '#D2691E',
      targetMensile: 3000,
      settore: 'Alimentare',
      tipoCarburante: 'benzina',
      speseFisseDisabilitate: [],
      partenzaDa: '',
      collaboratori: [],
      fornitori: [],
      agenda: defaultAgenda,
      speseAnnue: [],
      storicoGiornate: [],
      storicoCarburante: [],
      appuntiAgenda: [],
      storicoDiario: [],
      speseExtraTags: [],
      storicoScontrini: [],
    });
    AsyncStorage.removeItem('marketmate_data');
  },
}));
