import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// NOTA: mockData generation è stata rimossa intenzionalmente.
// Ogni nuovo utente che scarica l'app DEVE partire da uno stato completamente
// pulito, senza alcun dato preinstallato (vendite, KM, fornitori, ecc.).

// Storage wrapper che funziona sia su web che su native
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Storage getItem error:', e);
      // Fallback to web storage on error
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
      } catch {}
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage setItem error:', e);
      // Fallback to web storage on error
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch {}
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage removeItem error:', e);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch {}
    }
  }
};

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

// Fiera ricorrente (Opzione A): eventi multi-settimanali (es. food truck)
// giorni: array di 0-6 dove 0=Lun, 1=Mar, ..., 6=Dom
export type TipologiaEvento = 'Fiera' | 'Sagra' | 'Festa Patronale' | 'Evento Speciale';

export interface Fiera {
  id: string;
  nome: string;
  luogo: string;
  giorni: number[];
  dateSpecifiche?: string[]; // date ISO YYYY-MM-DD per eventi one-shot
  orarioInizio?: string;
  orarioFine?: string;
  km: number;
  plateatico: number;
  tipologia?: TipologiaEvento;
  note?: string;
  attiva: boolean;
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
  // Mappa: nomeBase -> 'DAILY' | 'WEEKLY' | 'MONTHLY' (default DAILY se assente)
  // Determina se la spesa fornitore viene detratta dal netto del giorno (DAILY)
  // oppure accantonata e mostrata solo nel riepilogo periodico (WEEKLY/MONTHLY).
  dettaglio_fornitori_deduction?: Record<string, 'DAILY' | 'WEEKLY' | 'MONTHLY'>;
  dettaglio_spese_extra?: Record<string, number>;
  fornitoriInfo?: Record<string, { numeroFattura: string; scadenza: string }>;
}

export interface Carburante {
  data: Date;
  euro: number;
}

export interface Appunto {
  data: Date;
  testo: string;
}

export interface Ordine {
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

// Sistema Collaboratori con codici invito (3 ruoli)
// AMMINISTRATORE = creatore/responsabile legale, controllo totale (gestione abbonamento, creazione/rimozione ruoli, dati finanziari)
// MANAGER       = operatività quotidiana (home/note/carburante in lettura+scrittura ma SOLO inserimento, NO modifica dati già esistenti)
// UTENTE        = inserimento base (può inserire dati home/fuel/note, non vede altro)
export type RuoloUtente = 'AMMINISTRATORE' | 'MANAGER' | 'UTENTE';

export interface CodiceInvito {
  codice: string;
  tipo: RuoloUtente;
  nome: string;
  attivo: boolean;
  dataCreazione: string;
  ultimoAccesso?: string;
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
  speseAnnueDisabilitate: string[];
  codiciInvito: CodiceInvito[];
  // Ruolo dell'utente attualmente attivo su questo dispositivo
  // - AMMINISTRATORE: pieno controllo (default per chi crea l'app)
  // - MANAGER: home/note/carburante in sola scrittura, NO modifica dati passati
  // - UTENTE: input base in home/fuel/note, niente altro visibile
  currentRole: RuoloUtente;
  
  // Data
  collaboratori: Collaboratore[];
  fornitori: Fornitore[];
  agenda: MercatoAgenda[];
  speseAnnue: SpesaAnnua[];
  fiere: Fiera[];
  storicoGiornate: Giornata[];
  storicoCarburante: Carburante[];
  appuntiAgenda: Appunto[];
  ordiniAgenda: Ordine[];
  storicoDiario: DiarioEntry[];
  speseExtraTags: string[];
  storicoScontrini: ScontrinoRecord[];
  // ═══ SESSIONE SPESE EXTRA (persistente fino a 23:59 del giorno successivo) ═══
  speseExtraSession: {
    speseExtraFornitore: Record<string, { importo: string; periodo: string }>;
    vociGeneriche: Array<{ nome: string; importo: string; attivo: boolean; ripMode?: 'oggi' | 'custom'; ripFrom?: string; ripTo?: string; periodo?: string }>;
    fornInfo: Record<string, { numeroFattura: string; scadenza: string }>;
    pagamentoMode: Record<string, 'contanti' | 'fattura' | 'misto'>;
    ripartizione: Record<string, { modo: 'oggi' | 'custom'; from: string; to: string }>;
    createdAt: string; // ISO timestamp della creazione/ultima modifica
  } | null;
  
  // Actions
  setConfig: (config: Partial<AppState>) => void;
  addCollaboratore: (c: Collaboratore) => void;
  removeCollaboratore: (nome: string) => void;
  addFornitore: (f: Fornitore) => void;
  removeFornitore: (nome: string) => void;
  updateAgenda: (agenda: MercatoAgenda[]) => void;
  forceFlushSave: () => void;
  addSpesaAnnua: (s: SpesaAnnua) => void;
  removeSpesaAnnua: (voce: string) => void;
  toggleSpesaAnnua: (voce: string) => void;
  addFiera: (f: Fiera) => void;
  removeFiera: (id: string) => void;
  updateFiera: (id: string, patch: Partial<Fiera>) => void;
  toggleFieraAttiva: (id: string) => void;
  salvaGiornata: (g: Giornata) => void;
  addCarburante: (c: Carburante) => void;
  removeCarburante: (index: number) => void;
  addAppunto: (a: Appunto) => void;
  removeAppunto: (data: Date, testo: string) => void;
  addOrdine: (o: Ordine) => void;
  removeOrdine: (data: Date, testo: string) => void;
  addDiario: (d: DiarioEntry) => void;
  removeDiario: (data: Date) => void;
  getDiarioForDate: (data: Date) => DiarioEntry | undefined;
  addSpeseExtraTag: (tag: string) => void;
  removeSpeseExtraTag: (tag: string) => void;
  addScontrino: (s: ScontrinoRecord) => void;
  getScontriniForMercato: (mercato: string) => ScontrinoRecord[];
  // Sessione Spese Extra
  setSpeseExtraSession: (session: AppState['speseExtraSession']) => void;
  clearSpeseExtraSession: () => void;
  // Codici invito collaboratori
  addCodiceInvito: (c: CodiceInvito) => void;
  removeCodiceInvito: (codice: string) => void;
  toggleCodiceInvito: (codice: string) => void;
  generateCodiceInvito: (tipo: RuoloUtente, nome: string) => string;
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
  speseAnnueDisabilitate: [],
  codiciInvito: [],
  currentRole: 'AMMINISTRATORE',
  
  collaboratori: [],
  fornitori: [],
  agenda: defaultAgenda,
  speseAnnue: [],
  fiere: [],
  storicoGiornate: [],
  storicoCarburante: [],
  appuntiAgenda: [],
  ordiniAgenda: [],
  storicoDiario: [],
  speseExtraTags: [],
  storicoScontrini: [],
  speseExtraSession: null,
  
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
    // Debounce the disk write (300ms) but always save the latest
    if ((globalThis as any).__agendaSaveTimer) {
      clearTimeout((globalThis as any).__agendaSaveTimer);
    }
    (globalThis as any).__agendaSaveTimer = setTimeout(() => {
      get().saveToStorage();
    }, 300);
  },
  
  // Force immediate save - call this on onBlur/onEndEditing
  forceFlushSave: () => {
    if ((globalThis as any).__agendaSaveTimer) {
      clearTimeout((globalThis as any).__agendaSaveTimer);
    }
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
  
  toggleSpesaAnnua: (voce) => {
    set((state) => {
      const disabled = state.speseAnnueDisabilitate || [];
      const isDisabled = disabled.includes(voce);
      return {
        speseAnnueDisabilitate: isDisabled
          ? disabled.filter(v => v !== voce)
          : [...disabled, voce]
      };
    });
    get().saveToStorage();
  },

  // ═══ FIERE RICORRENTI ═══
  addFiera: (f) => {
    set((state) => ({ fiere: [...(state.fiere || []), f] }));
    get().saveToStorage();
  },
  removeFiera: (id) => {
    set((state) => ({ fiere: (state.fiere || []).filter((f) => f.id !== id) }));
    get().saveToStorage();
  },
  updateFiera: (id, patch) => {
    set((state) => ({
      fiere: (state.fiere || []).map((f) => f.id === id ? { ...f, ...patch } : f),
    }));
    get().saveToStorage();
  },
  toggleFieraAttiva: (id) => {
    set((state) => ({
      fiere: (state.fiere || []).map((f) => f.id === id ? { ...f, attiva: !f.attiva } : f),
    }));
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
  
  removeCarburante: (index) => {
    set((state) => {
      const newArr = [...state.storicoCarburante];
      newArr.splice(index, 1);
      return { storicoCarburante: newArr };
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

  addOrdine: (o) => {
    set((state) => ({ ordiniAgenda: [...(state.ordiniAgenda || []), o] }));
    get().saveToStorage();
  },

  removeOrdine: (data, testo) => {
    set((state) => {
      let removed = false;
      return {
        ordiniAgenda: (state.ordiniAgenda || []).filter(o => {
          if (!removed && o.testo === testo) {
            const oDate = new Date(o.data).toDateString();
            const targetDate = new Date(data).toDateString();
            if (oDate === targetDate) {
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

  // Codici invito collaboratori
  generateCodiceInvito: (tipo, nome) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Prefisso a 3 lettere per riconoscere il ruolo
    const prefix = tipo === 'AMMINISTRATORE' ? 'ADM-' : tipo === 'MANAGER' ? 'MGR-' : 'USR-';
    let codice = prefix;
    for (let i = 0; i < 6; i++) {
      codice += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const nuovoCodice: CodiceInvito = {
      codice,
      tipo,
      nome,
      attivo: true,
      dataCreazione: new Date().toISOString(),
    };
    
    set((state) => ({
      codiciInvito: [...state.codiciInvito, nuovoCodice]
    }));
    get().saveToStorage();
    
    return codice;
  },

  addCodiceInvito: (c) => {
    set((state) => ({ codiciInvito: [...state.codiciInvito, c] }));
    get().saveToStorage();
  },

  removeCodiceInvito: (codice) => {
    set((state) => ({
      codiciInvito: state.codiciInvito.filter(c => c.codice !== codice)
    }));
    get().saveToStorage();
  },

  toggleCodiceInvito: (codice) => {
    set((state) => ({
      codiciInvito: state.codiciInvito.map(c => 
        c.codice === codice ? { ...c, attivo: !c.attivo } : c
      )
    }));
    get().saveToStorage();
  },
  
  seedMockData: () => {
    // ═══ DISABILITATO INTENZIONALMENTE ═══
    // Nessun dato di esempio viene MAI iniettato.
    // Ogni nuovo utente parte da uno stato completamente pulito.
    if (typeof console !== 'undefined') {
      console.warn('[appStore] seedMockData() is disabled — no demo data will be loaded.');
    }
  },

  setSpeseExtraSession: (session) => {
    set({ speseExtraSession: session });
    get().saveToStorage();
  },

  clearSpeseExtraSession: () => {
    set({ speseExtraSession: null });
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const data = await storage.getItem('marketmate_data');
      if (data) {
        const parsed = JSON.parse(data);
        // ═══ Migrazione codici invito legacy 'A' / 'B' → nuovi ruoli ═══
        if (Array.isArray(parsed.codiciInvito)) {
          parsed.codiciInvito = parsed.codiciInvito.map((c: any) => {
            if (c.tipo === 'A') return { ...c, tipo: 'UTENTE' };
            if (c.tipo === 'B') return { ...c, tipo: 'AMMINISTRATORE' };
            return c;
          });
        }
        if (!parsed.currentRole || (parsed.currentRole !== 'AMMINISTRATORE' && parsed.currentRole !== 'MANAGER' && parsed.currentRole !== 'UTENTE')) {
          parsed.currentRole = 'AMMINISTRATORE';
        }
        set(parsed);
      }
    } catch (e) {
      console.warn('Error loading data:', e);
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
        speseAnnueDisabilitate: state.speseAnnueDisabilitate,
        fiere: state.fiere || [],
        storicoGiornate: state.storicoGiornate,
        storicoCarburante: state.storicoCarburante,
        appuntiAgenda: state.appuntiAgenda,
        ordiniAgenda: state.ordiniAgenda || [],
        storicoDiario: state.storicoDiario,
        speseExtraTags: state.speseExtraTags,
        storicoScontrini: state.storicoScontrini,
        codiciInvito: state.codiciInvito || [],
        currentRole: (state as any).currentRole || 'AMMINISTRATORE',
        speseExtraSession: (state as any).speseExtraSession || null,
      };
      await storage.setItem('marketmate_data', JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Error saving data:', e);
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
  speseAnnueDisabilitate: [],
      partenzaDa: '',
      collaboratori: [],
      fornitori: [],
      agenda: defaultAgenda,
      speseAnnue: [],
      fiere: [],
      storicoGiornate: [],
      storicoCarburante: [],
      appuntiAgenda: [],
      ordiniAgenda: [],
      storicoDiario: [],
      speseExtraTags: [],
      storicoScontrini: [],
      // Pulisci anche la sessione spese in corso (fatture orphane, ripartizioni)
      speseExtraSession: null,
    } as any);
    storage.removeItem('marketmate_data');
  },
}));
