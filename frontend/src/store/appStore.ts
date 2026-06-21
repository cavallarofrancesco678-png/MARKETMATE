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
  /**
   * Costo unitario di acquisto dal fornitore (€). Quando impostato insieme
   * al `ricaricoMedio` del Fornitore, il `prezzo` viene calcolato come:
   *   prezzoSuggerito = costo × (1 + ricaricoMedio/100)
   * a meno che `prezzoOverwrite=true` (l'utente ha sovrascritto manualmente).
   * Optional per retrocompatibilità con prodotti già esistenti.
   */
  costo?: number;
  /**
   * Se true, il `prezzo` salvato è stato impostato manualmente dall'utente
   * e NON va più ricalcolato dal `ricaricoMedio`. Default false.
   */
  prezzoOverwrite?: boolean;
}

export interface Fornitore {
  nome: string;
  prodotti: Prodotto[];
  /**
   * Ricarico medio percentuale applicato a tutti i prodotti del fornitore
   * (default 70% se assente). NON entra direttamente nel calcolo del
   * "costo merce giornaliero" che invece usa la distribuzione proporzionale
   * sulla fattura reale (vedi /app/frontend/src/utils/proporzionaleFornitori.ts).
   * Serve solo come driver per i prezzi di vendita suggeriti nel
   * SupplierSettings prodotto-per-prodotto.
   */
  ricaricoMedio?: number;
  /**
   * Modalità di detrazione GLOBALE per questo fornitore:
   *  - 'DAILY' (default): detratta interamente dal netto del giorno corrente
   *  - 'CUSTOM': distribuita proporzionalmente al lordo sui `deductionDays`
   *    giorni successivi alla data di registrazione della fattura.
   *
   * Storage CENTRALIZZATO al livello del fornitore (non della singola
   * giornata): se l'utente cambia il periodo da 7 a 3 giorni, TUTTE le
   * giornate passate e future vengono ricalcolate automaticamente —
   * stats.tsx legge sempre il valore attuale qui dentro, non lo
   * snapshot della singola giornata.
   */
  /**
   * Round 65: aggiunto WEEKLY come modalità di prim'ordine (oltre a DAILY/CUSTOM).
   * Il pulsante "Settimanale" del modal SpeseExtra ora salva qui WEEKLY e
   * resta evidenziato al reload (prima veniva mappato a CUSTOM).
   */
  deductionMode?: 'DAILY' | 'CUSTOM' | 'WEEKLY';
  /** Numero di giorni del periodo personalizzato (CUSTOM=user-set, WEEKLY=7). Default 7. */
  deductionDays?: number;
  /**
   * Data di inizio del periodo CUSTOM ('YYYY-MM-DD').
   * Se NON specificata, la distribuzione parte dalla data di registrazione
   * della fattura (default storico). Se specificata, la fattura viene
   * distribuita su [deductionStartDate, deductionStartDate + deductionDays - 1].
   * Permette all'utente di pianificare un periodo che inizia in data diversa
   * da oggi (es. una fattura ricevuta oggi ma valida da Lunedì prossimo).
   */
  deductionStartDate?: string;
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
  // Mappa: nomeBase -> 'DAILY' | 'CUSTOM' (default DAILY se assente)
  // - DAILY: detratta interamente dal netto del giorno corrente
  // - CUSTOM: distribuita proporzionalmente al lordo dei giorni del periodo
  //   personalizzato (vedi `dettaglio_fornitori_days`). Default 7 giorni se
  //   non specificato.
  // Legacy values 'WEEKLY' e 'MONTHLY' sono ancora accettati per retrocompat
  // e vengono mappati a CUSTOM 7g / 30g rispettivamente al primo load.
  dettaglio_fornitori_deduction?: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'>;
  // Mappa: nomeBase -> numero di giorni del periodo personalizzato (CUSTOM).
  // Esempio: { "Andrea Pane": 14 } → la fattura viene distribuita sui 14
  // giorni a cavallo della data di registrazione, proporzionalmente al lordo.
  dettaglio_fornitori_days?: Record<string, number>;
  /**
   * Round 45: Snapshot della DATA DI INIZIO del periodo CUSTOM per ogni
   * fornitore registrato in questa giornata. Permette al ricalcolo
   * proporzionale di sapere ESATTAMENTE da quando partire la finestra,
   * indipendentemente da modifiche successive al fornitore globale.
   * Formato: 'YYYY-MM-DD'. Se assente, l'algoritmo userà la data della
   * giornata stessa (data di registrazione della fattura) come fallback.
   */
  dettaglio_fornitori_startDate?: Record<string, string>;
  dettaglio_spese_extra?: Record<string, number>;
  fornitoriInfo?: Record<string, { numeroFattura: string; scadenza: string }>;
  // Indica se l'utente è andato a lavoro in quel giorno (toggle 'casa/storefront')
  // Default true (in piazza). Se false → giorno di riposo, le spese fisse non
  // vengono scalate. Mantenuto per ogni giornata così il colore del pulsante
  // resta coerente quando si torna a rivedere quel giorno passato.
  inPiazza?: boolean;
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

/* ═══ Round 72 — FATTURE LOG (append-only, immutabile) ═══
   Collezione PERSISTENTE delle fatture inserite dall'utente. Indipendente
   dalle giornate: una fattura sopravvive sempre, anche se viene modificata
   la giornata di riferimento. Permette:
     • Totale fatture aggiornato in tempo reale nelle Statistiche
     • Vista "NOTE/FATTURE" con TUTTI i record (non solo l'ultimo)
     • Distinzione fra "dataEmissione" (data in fattura) e "dataInserimento"
       (timestamp quando l'utente l'ha registrata nell'app)
     • Periodo di riferimento esplicito (periodoFrom/periodoTo) inserito
       dall'utente quando la fattura copre un range (es. abbonamento mensile)
*/
export interface Fattura {
  id: string;                    // unique
  fornitore: string;             // nome fornitore
  numeroFattura: string;         // numero documento
  importo: number;               // importo totale fattura
  importoFattura?: number;       // quota pagata da fattura (per modo 'misto')
  importoContanti?: number;      // quota pagata in contanti (per modo 'misto')
  modoPagamento: 'contanti' | 'fattura' | 'misto';
  dataEmissione: string;         // ISO YYYY-MM-DD — data della fattura/giornata
  dataInserimento: string;       // ISO datetime — quando l'utente l'ha registrata
  periodoFrom?: string;          // ISO — inizio periodo di riferimento (opzionale)
  periodoTo?: string;            // ISO — fine periodo di riferimento (opzionale)
  scadenza?: string;             // ISO — scadenza pagamento (opzionale)
  note?: string;                 // testo libero
}

/* ═══ Round 61 — SPESE PERIODICHE (Periodic Expenses) ═══
   Collezione SEPARATA da storicoGiornate per gestire spese che vanno
   ripartite su più giorni (settimanale, custom, mensile). Le spese qui
   contenute NON intaccano il netto del singolo giorno, ma sono "trascinate"
   visivamente come promemoria per tutti i giorni in [from..to] e
   contribuiscono al netto SOLO nei filtri di periodo che contengono `to`. */
export interface SpesaPeriodica {
  id: string;                        // UUID univoco per la voce
  nome: string;                      // fornitore o nome voce generica
  importo: number;                   // €
  categoria: 'fornitore' | 'voce';   // tipo di spesa
  from: string;                      // ISO YYYY-MM-DD inizio periodo
  to: string;                        // ISO YYYY-MM-DD fine periodo
  type: 'WEEKLY' | 'CUSTOM' | 'MONTHLY';
  createdAt: string;                 // ISO timestamp creazione
  dayOfPurchase: string;             // ISO YYYY-MM-DD giorno acquisto
  /* Round 61: campi opzionali per fatture / pagamento (ereditati da Fornitore) */
  numeroFattura?: string;
  pagamentoMode?: 'fattura' | 'contanti' | 'misto';
  fatturaTotale?: number;            // se diverso da importo (parziale)
  /* Round 67: split fattura/contanti per classificazione corretta in Stats */
  importoFattura?: number;           // parte pagata con fattura
  importoContanti?: number;          // parte pagata in contanti
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
  // True se questo dispositivo è stato configurato tramite codice invito
  // (collaboratore esterno). Serve a distinguere il primo admin che fa setup
  // completo (per cui mostriamo il tutorial guidato) da chi entra in
  // un'azienda già configurata da altri.
  joinedViaInviteCode?: boolean;
  
  // Data
  collaboratori: Collaboratore[];
  fornitori: Fornitore[];
  agenda: MercatoAgenda[];
  speseAnnue: SpesaAnnua[];
  fiere: Fiera[];
  storicoGiornate: Giornata[];
  storicoCarburante: Carburante[];
  /* Round 61 — collezione spese periodiche (vedi interface SpesaPeriodica) */
  spesePeriodiche: SpesaPeriodica[];
  appuntiAgenda: Appunto[];
  ordiniAgenda: Ordine[];
  storicoDiario: DiarioEntry[];
  /* Round 72 — Log immutabile delle fatture inserite (NON sostituisce
     fornitoriInfo nelle giornate, lo affianca). */
  fattureLog: Fattura[];
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
  clearCarburanteInRange: (fromIso: string, toIso: string) => void;
  /* Round 61 — actions per SpesaPeriodica */
  addSpesaPeriodica: (s: Omit<SpesaPeriodica, 'id' | 'createdAt'>) => void;
  updateSpesaPeriodica: (id: string, patch: Partial<SpesaPeriodica>) => void;
  removeSpesaPeriodica: (id: string) => void;
  clearSpesePeriodichePerData: (dayIso: string, nome?: string) => void;
  addAppunto: (a: Appunto) => void;
  removeAppunto: (data: Date, testo: string) => void;
  addOrdine: (o: Ordine) => void;
  removeOrdine: (data: Date, testo: string) => void;
  addDiario: (d: DiarioEntry) => void;
  removeDiario: (data: Date) => void;
  /* Round 72 — Actions su fattureLog */
  addFattura: (f: Omit<Fattura, 'id' | 'dataInserimento'>) => Fattura;
  upsertFatturaByKey: (key: { fornitore: string; numeroFattura: string }, patch: Partial<Omit<Fattura, 'id' | 'dataInserimento'>>) => Fattura;
  removeFattura: (id: string) => void;
  updateFattura: (id: string, patch: Partial<Fattura>) => void;
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
  joinedViaInviteCode: false,
  
  collaboratori: [],
  fornitori: [],
  agenda: defaultAgenda,
  speseAnnue: [],
  fiere: [],
  storicoGiornate: [],
  storicoCarburante: [],
  spesePeriodiche: [],
  appuntiAgenda: [],
  ordiniAgenda: [],
  storicoDiario: [],
  fattureLog: [],
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
    // Round 69 — Difesa: blocchiamo qualunque tentativo di salvare un
    // rifornimento con data > oggi (impossibile dall'UI ma garantiamo
    // l'invariant a livello di store per evitare regressioni).
    try {
      const d = c?.data instanceof Date ? c.data : new Date(c?.data as any);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (!isNaN(d.getTime()) && d.getTime() > todayEnd.getTime()) {
        console.warn('[appStore] addCarburante BLOCCATO: data futura non ammessa.');
        return;
      }
    } catch { /* skip */ }
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

  /* Round 69 — Rimuove TUTTI i rifornimenti in un range [fromIso..toIso].
     Usato dal pulsante "Pulisci mese visualizzato" nella pagina Carburante. */
  clearCarburanteInRange: (fromIso: string, toIso: string) => {
    set((state) => ({
      storicoCarburante: (state.storicoCarburante || []).filter((c: any) => {
        try {
          const d = new Date(c.data);
          if (isNaN(d.getTime())) return true;
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return !(iso >= fromIso && iso <= toIso);
        } catch { return true; }
      }),
    }));
    get().saveToStorage();
  },

  /* ═══ Round 61 — SPESE PERIODICHE: actions ═══
     Round 63 — DEDUP CRITICO: addSpesaPeriodica adesso CHIAVE su
     (nome, categoria, from, to). Se esiste già una voce con la stessa
     chiave la SOVRASCRIVE (update importo + dayOfPurchase). Questo
     elimina i duplicati causati da save multipli dello stesso fornitore
     periodico su giorni diversi all'interno del proprio range. */
  addSpesaPeriodica: (s) => {
    set((state) => {
      const matchKey = (x: SpesaPeriodica) =>
        x.nome === s.nome && x.categoria === s.categoria && x.from === s.from && x.to === s.to;
      const existingIdx = state.spesePeriodiche.findIndex(matchKey);
      const now = new Date().toISOString();
      if (existingIdx >= 0) {
        // UPDATE
        const next = [...state.spesePeriodiche];
        next[existingIdx] = { ...next[existingIdx], ...s, importo: s.importo };
        return { spesePeriodiche: next };
      }
      // INSERT
      const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item: SpesaPeriodica = { ...s, id, createdAt: now };
      return { spesePeriodiche: [...state.spesePeriodiche, item] };
    });
    get().saveToStorage();
  },

  updateSpesaPeriodica: (id, patch) => {
    set((state) => ({
      spesePeriodiche: state.spesePeriodiche.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    get().saveToStorage();
  },

  removeSpesaPeriodica: (id) => {
    set((state) => ({ spesePeriodiche: state.spesePeriodiche.filter((x) => x.id !== id) }));
    get().saveToStorage();
  },

  /* Rimuove tutte le SpesaPeriodica con dayOfPurchase==dayIso (ed eventualmente
     filtrate per `nome`). Usata quando l'utente apre un giorno già salvato e
     ri-conferma il modal: prima azzeriamo i periodici precedenti per quella
     data, poi aggiungiamo quelli nuovi (sovrascrivi → soluzione "a" scelta
     dall'utente). */
  clearSpesePeriodichePerData: (dayIso, nome) => {
    set((state) => ({
      spesePeriodiche: state.spesePeriodiche.filter((x) => {
        if (x.dayOfPurchase !== dayIso) return true;
        if (nome && x.nome !== nome) return true;
        return false;
      }),
    }));
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

  /* ═══ Round 72 — FATTURE LOG (append-only) ═══
     Ogni inserimento crea un record IMMUTABILE. La dedup è su
     (fornitore + numeroFattura) per evitare doppioni quando l'utente
     salva la stessa giornata più volte. */
  addFattura: (f) => {
    const now = new Date().toISOString();
    const id = `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item: Fattura = { ...f, id, dataInserimento: now } as Fattura;
    set((state) => ({ fattureLog: [...(state.fattureLog || []), item] }));
    get().saveToStorage();
    return item;
  },

  upsertFatturaByKey: (key, patch) => {
    let saved: Fattura | null = null;
    const now = new Date().toISOString();
    set((state) => {
      const log = Array.isArray(state.fattureLog) ? state.fattureLog : [];
      const normFor = (s: string) => (s || '').trim().toLowerCase();
      const normNum = (s: string) => (s || '').trim().toLowerCase();
      const idx = log.findIndex(
        (x) =>
          normFor(x.fornitore) === normFor(key.fornitore) &&
          normNum(x.numeroFattura) === normNum(key.numeroFattura)
      );
      if (idx >= 0) {
        // UPDATE — preserva dataInserimento originale
        const next = [...log];
        next[idx] = { ...next[idx], ...patch, fornitore: key.fornitore, numeroFattura: key.numeroFattura } as Fattura;
        saved = next[idx];
        return { fattureLog: next };
      }
      // INSERT
      const id = `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const importo = (patch as any)?.importo ?? 0;
      const modoPagamento = (patch as any)?.modoPagamento ?? 'fattura';
      const dataEmissione = (patch as any)?.dataEmissione ?? now.slice(0, 10);
      const item: Fattura = {
        id,
        dataInserimento: now,
        fornitore: key.fornitore,
        numeroFattura: key.numeroFattura,
        importo,
        modoPagamento,
        dataEmissione,
        ...patch,
      } as Fattura;
      saved = item;
      return { fattureLog: [...log, item] };
    });
    get().saveToStorage();
    return saved as Fattura;
  },

  removeFattura: (id) => {
    set((state) => ({ fattureLog: (state.fattureLog || []).filter((x) => x.id !== id) }));
    get().saveToStorage();
  },

  updateFattura: (id, patch) => {
    set((state) => ({
      fattureLog: (state.fattureLog || []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    get().saveToStorage();
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
        // Salva una flag per capire se serve riscrivere su disk dopo migrazione
        const originalShape = {
          sd: Array.isArray(parsed.storicoDiario),
          ss: Array.isArray(parsed.storicoScontrini),
          sg: Array.isArray(parsed.storicoGiornate),
          sc: Array.isArray(parsed.storicoCarburante),
          fi: Array.isArray(parsed.fiere),
          aa: Array.isArray(parsed.appuntiAgenda),
          oa: Array.isArray(parsed.ordiniAgenda),
          fr: Array.isArray(parsed.fornitori),
          co: Array.isArray(parsed.collaboratori),
          ci: Array.isArray(parsed.codiciInvito),
        };

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

        // ═══ MIGRAZIONE DEFENSIVE: recupera dati corrotti dal vecchio merge bug ═══
        // Il vecchio merge sync convertiva storicoDiario / storicoScontrini da
        // Array a Object con chiavi numeriche. Se troviamo un object qui, lo
        // riconvertiamo in array per evitare crash di .map() / .find() / .filter().
        const fixArr = (val: any): any[] => {
          if (Array.isArray(val)) return val;
          if (val && typeof val === 'object') {
            try { return Object.values(val).filter(Boolean); } catch { return []; }
          }
          return [];
        };
        parsed.storicoDiario = fixArr(parsed.storicoDiario);
        parsed.fattureLog = fixArr(parsed.fattureLog);
        parsed.storicoScontrini = fixArr(parsed.storicoScontrini);
        parsed.storicoGiornate = fixArr(parsed.storicoGiornate);
        parsed.storicoCarburante = fixArr(parsed.storicoCarburante);
        parsed.spesePeriodiche = fixArr(parsed.spesePeriodiche);
        parsed.fiere = fixArr(parsed.fiere);
        parsed.appuntiAgenda = fixArr(parsed.appuntiAgenda);
        parsed.ordiniAgenda = fixArr(parsed.ordiniAgenda);
        parsed.fornitori = fixArr(parsed.fornitori);
        parsed.collaboratori = fixArr(parsed.collaboratori);
        parsed.codiciInvito = fixArr(parsed.codiciInvito);

        // ═══ Round 69 — PULIZIA AUTOMATICA RIFORNIMENTI FUTURI ═══
        // L'utente segnalava rifornimenti "fatti" nei prossimi giorni che non
        // aveva inserito: residui di un bug precedente (era possibile tappare
        // su giorni futuri). Difesa: a ogni avvio rimuoviamo dalla storia
        // qualsiasi rifornimento con data > oggi (mezzanotte).
        let futureRemovedCount = 0;
        if (Array.isArray(parsed.storicoCarburante) && parsed.storicoCarburante.length > 0) {
          const todayMidnight = new Date();
          todayMidnight.setHours(23, 59, 59, 999);
          const before = parsed.storicoCarburante.length;
          parsed.storicoCarburante = parsed.storicoCarburante.filter((c: any) => {
            try {
              const d = new Date(c.data);
              if (isNaN(d.getTime())) return true;
              return d.getTime() <= todayMidnight.getTime();
            } catch { return true; }
          });
          futureRemovedCount = before - parsed.storicoCarburante.length;
          if (futureRemovedCount > 0 && typeof console !== 'undefined') {
            console.warn(`[appStore] Rimossi ${futureRemovedCount} rifornimenti con data futura (cleanup automatico).`);
          }
        }

        // ═══ Round 61 — MIGRAZIONE LEGACY: fornitori CUSTOM/WEEKLY/MONTHLY → spesePeriodiche ═══
        // Cerchiamo tutte le storicoGiornate con dettaglio_fornitori_deduction
        // che contengono valori diversi da 'DAILY' e li trasferiamo nella nuova
        // collezione spesePeriodiche. Marchiamo la giornata con
        // migrated_periodic_v1=true così non viene riprocessata.
        if (Array.isArray(parsed.storicoGiornate) && parsed.storicoGiornate.length > 0) {
          const migrationsToAdd: any[] = [];
          parsed.storicoGiornate = parsed.storicoGiornate.map((g: any) => {
            if (g.migrated_periodic_v1) return g; // già migrata
            const ded = g.dettaglio_fornitori_deduction || {};
            const det = g.dettaglio_fornitori || {};
            const days = g.dettaglio_fornitori_days || {};
            const startDates = g.dettaglio_fornitori_startDate || {};
            const periodicKeys = Object.keys(ded).filter((k) => ded[k] && ded[k] !== 'DAILY');
            if (periodicKeys.length === 0) return { ...g, migrated_periodic_v1: true };

            const dataIso = (() => {
              try {
                const d = new Date(g.data);
                if (isNaN(d.getTime())) return '';
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              } catch { return ''; }
            })();

            const newDet = { ...det };
            const newDed = { ...ded };
            periodicKeys.forEach((nomeBase) => {
              // Somma tutte le voci che iniziano per nomeBase (incluse __libera)
              let importo = 0;
              Object.keys(det).forEach((k) => {
                if (k === nomeBase || k.startsWith(nomeBase + '__libera')) {
                  importo += parseFloat(String(det[k])) || 0;
                }
              });
              if (importo <= 0) return;
              const type = ded[nomeBase] as 'WEEKLY' | 'CUSTOM' | 'MONTHLY';
              const periodDays = days[nomeBase] || (type === 'WEEKLY' ? 7 : type === 'MONTHLY' ? 30 : 7);
              const startIso = startDates[nomeBase] || dataIso;
              if (!startIso) return;
              const startD = new Date(startIso + 'T00:00:00');
              const endD = new Date(startD); endD.setDate(startD.getDate() + periodDays - 1);
              const endIso = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;

              migrationsToAdd.push({
                id: `sp_migrated_${dataIso}_${nomeBase}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                nome: nomeBase,
                importo,
                categoria: 'fornitore',
                from: startIso,
                to: endIso,
                type,
                createdAt: new Date().toISOString(),
                dayOfPurchase: dataIso,
              });

              // Rimuoviamo i campi da det/ded per evitare doppio conteggio
              Object.keys(det).forEach((k) => {
                if (k === nomeBase || k.startsWith(nomeBase + '__libera') || k.startsWith(nomeBase + '__fattn')) {
                  delete newDet[k];
                }
              });
              delete newDed[nomeBase];
            });

            return {
              ...g,
              dettaglio_fornitori: newDet,
              dettaglio_fornitori_deduction: newDed,
              migrated_periodic_v1: true,
            };
          });

          if (migrationsToAdd.length > 0) {
            const existing = Array.isArray(parsed.spesePeriodiche) ? parsed.spesePeriodiche : [];
            parsed.spesePeriodiche = [...existing, ...migrationsToAdd];
            console.log(`[Round 61] Migrate ${migrationsToAdd.length} legacy periodic expenses to spesePeriodiche`);
          }
        }

        // ═══ Round 63 — DEDUP automatico spesePeriodiche ═══
        // Rimuove duplicati creati dal bug pre-R63 (save multipli dello
        // stesso fornitore periodico). Chiave: (nome, categoria, from, to).
        // Tiene l'entry più recente (createdAt più alto).
        let dedupRemovedCount = 0;
        if (Array.isArray(parsed.spesePeriodiche) && parsed.spesePeriodiche.length > 0) {
          const sorted = [...parsed.spesePeriodiche].sort((a: any, b: any) => {
            const ca = a.createdAt || ''; const cb = b.createdAt || '';
            return cb.localeCompare(ca);
          });
          const seen = new Set<string>();
          const deduped: any[] = [];
          sorted.forEach((sp: any) => {
            const key = `${sp.nome}__${sp.categoria}__${sp.from}__${sp.to}`;
            if (seen.has(key)) return;
            seen.add(key);
            deduped.push(sp);
          });
          dedupRemovedCount = parsed.spesePeriodiche.length - deduped.length;
          if (dedupRemovedCount > 0) {
            console.log(`[Round 63] Rimossi ${dedupRemovedCount} duplicati da spesePeriodiche`);
          }
          parsed.spesePeriodiche = deduped;
        }

        // ═══ Round 73 — BACKFILL FATTURE LOG da storico esistente ═══
        // Per utenti con dati pre-R72: scansiona storicoGiornate +
        // spesePeriodiche e popola fattureLog con tutti i pagamenti
        // mai inseriti, così la card "FATTURE" in stats mostra subito
        // lo storico. Esegui SOLO se fattureLog è vuoto o non esiste,
        // così non ricrea duplicati ad ogni avvio.
        let backfilledCount = 0;
        if (!Array.isArray(parsed.fattureLog) || parsed.fattureLog.length === 0) {
          const backfilled: any[] = [];
          const dedupKeys = new Set<string>();

          // 1) Da storicoGiornate.dettaglio_fornitori + fornitoriInfo
          (parsed.storicoGiornate || []).forEach((g: any) => {
            try {
              const dataEm = new Date(g.data);
              if (isNaN(dataEm.getTime())) return;
              const dataIso = `${dataEm.getFullYear()}-${String(dataEm.getMonth() + 1).padStart(2, '0')}-${String(dataEm.getDate()).padStart(2, '0')}`;
              const det = g.dettaglio_fornitori || {};
              const info = g.fornitoriInfo || {};
              const baseNames = new Set<string>();
              Object.keys(det).forEach((k) => {
                if (k.endsWith('__liberaLabel') || k.includes('__fattn')) return;
                if (k.endsWith('__libera')) baseNames.add(k.slice(0, -'__libera'.length));
                else baseNames.add(k);
              });
              baseNames.forEach((nomeFornitore) => {
                const impFatt = Number(det[nomeFornitore]) || 0;
                const impCash = Number(det[`${nomeFornitore}__libera`]) || 0;
                const impTot = Math.abs(impFatt) + Math.abs(impCash);
                if (impTot <= 0) return;
                const fInfo = info[nomeFornitore] || {};
                const numF = String(fInfo.numeroFattura || '').trim();
                const dedupNum = numF || `_auto_${dataIso}`;
                const dedupKey = `${nomeFornitore.toLowerCase()}|${dedupNum.toLowerCase()}`;
                if (dedupKeys.has(dedupKey)) return;
                dedupKeys.add(dedupKey);
                const mode = impFatt > 0 && impCash > 0 ? 'misto' : (impFatt > 0 ? 'fattura' : 'contanti');
                backfilled.push({
                  id: `ft_bf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  fornitore: nomeFornitore,
                  numeroFattura: dedupNum,
                  importo: impTot,
                  importoFattura: Math.abs(impFatt) || undefined,
                  importoContanti: Math.abs(impCash) || undefined,
                  modoPagamento: mode,
                  dataEmissione: dataIso,
                  dataInserimento: g.savedAt || dataEm.toISOString(),
                  scadenza: fInfo.scadenza || undefined,
                  note: numF ? undefined : '(backfill — pagamento senza fattura)',
                });
              });
            } catch { /* skip */ }
          });

          // 2) Da spesePeriodiche
          (parsed.spesePeriodiche || []).forEach((sp: any) => {
            try {
              const importo = Number(sp.importo) || 0;
              if (importo <= 0) return;
              const dataIso = sp.dayOfPurchase || sp.from;
              if (!dataIso) return;
              const numF = String(sp.numeroFattura || '').trim();
              const dedupNum = numF || `_auto_${dataIso}`;
              const dedupKey = `${(sp.nome || '').toLowerCase()}|${dedupNum.toLowerCase()}`;
              if (dedupKeys.has(dedupKey)) return;
              dedupKeys.add(dedupKey);
              backfilled.push({
                id: `ft_bf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                fornitore: sp.nome,
                numeroFattura: dedupNum,
                importo,
                modoPagamento: sp.pagamentoMode || 'fattura',
                dataEmissione: dataIso,
                dataInserimento: sp.createdAt || new Date(dataIso + 'T12:00:00').toISOString(),
                periodoFrom: sp.from,
                periodoTo: sp.to,
                scadenza: sp.scadenza || undefined,
                note: numF ? undefined : '(backfill da spesa periodica)',
              });
            } catch { /* skip */ }
          });

          if (backfilled.length > 0) {
            parsed.fattureLog = backfilled;
            backfilledCount = backfilled.length;
            console.log(`[Round 73] Backfill fatture: ${backfilledCount} record creati dallo storico esistente.`);
          }
        }

        set(parsed);

        // Se almeno un campo è stato sanitizzato (non era un array originariamente),
        // salviamo subito su disk il dato corretto così la corruzione viene
        // riparata definitivamente senza dover fare la migrazione ad ogni avvio.
        // Round 64: includiamo anche dedupRemovedCount > 0 così la
        // deduplica auto-pulisce il localStorage permanentemente.
        const wasMigrated = !originalShape.sd || !originalShape.ss || !originalShape.sg
          || !originalShape.sc || !originalShape.fi || !originalShape.aa
          || !originalShape.oa || !originalShape.fr || !originalShape.co || !originalShape.ci
          || dedupRemovedCount > 0
          || futureRemovedCount > 0
          || backfilledCount > 0;
        if (wasMigrated) {
          try { await storage.setItem('marketmate_data', JSON.stringify(parsed)); } catch {}
        }
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
        spesePeriodiche: state.spesePeriodiche || [],
        appuntiAgenda: state.appuntiAgenda,
        ordiniAgenda: state.ordiniAgenda || [],
        storicoDiario: state.storicoDiario,
        fattureLog: state.fattureLog || [],
        speseExtraTags: state.speseExtraTags,
        storicoScontrini: state.storicoScontrini,
        codiciInvito: state.codiciInvito || [],
        currentRole: (state as any).currentRole || 'AMMINISTRATORE',
        joinedViaInviteCode: (state as any).joinedViaInviteCode || false,
        speseExtraSession: (state as any).speseExtraSession || null,
      };
      await storage.setItem('marketmate_data', JSON.stringify(dataToSave));

      // ═══ Sync cloud (debounced 5s) ═══
      // Se l'utente è autenticato sul cloud (admin o collab), pianifica un push
      // dei dati. La logica di debounce è in teamSyncStore.scheduleTeamSyncPush.
      // Importazione dinamica per evitare cicli e per non rompere se il modulo
      // non è ancora caricato (es. all'avvio prima della hydration).
      try {
        const m = await import('./teamSyncStore');
        if (m && typeof m.scheduleTeamSyncPush === 'function') {
          m.scheduleTeamSyncPush(() => dataToSave);
        }
      } catch {}
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
      spesePeriodiche: [],
      appuntiAgenda: [],
      ordiniAgenda: [],
      storicoDiario: [],
      fattureLog: [],
      speseExtraTags: [],
      storicoScontrini: [],
      // Pulisci anche la sessione spese in corso (fatture orphane, ripartizioni)
      speseExtraSession: null,
    } as any);
    storage.removeItem('marketmate_data');
  },
}));
