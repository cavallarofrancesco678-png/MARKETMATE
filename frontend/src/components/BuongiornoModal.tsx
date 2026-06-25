import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { buildCalendarContextBlock, resolveRegion } from '../utils/italianCalendar';

const REFERRAL_DISMISS_KEY = 'mm_referral_dismissed_at';
const REFERRAL_COOLDOWN_DAYS = 10;
/* Round 67 — ID dispositivo persistente per il rate-limit AI lato backend
   (10 messaggi/giorno + 100/mese). Generato una sola volta e riusato. */
const DEVICE_ID_KEY = 'mm_device_id';

let _cachedDeviceId: string | null = null;
const getDeviceId = async (): Promise<string> => {
  if (_cachedDeviceId) return _cachedDeviceId;
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    _cachedDeviceId = id;
    return id;
  } catch {
    _cachedDeviceId = `dev_fallback_${Date.now()}`;
    return _cachedDeviceId;
  }
};

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface StoreData {
  nomeAttivita: string;
  nomeTitolare: string;
  /** Settore merceologico dell'attività (es. 'Alimentare') — inviato al
      backend dentro mercato_info per il protocollo di localizzazione AI. */
  settore?: string;
  meteoOggi: string;
  mercatoOggi: string;
  /** Round 69 — Lista di TUTTE le città dei mercati settimanali + fiere
      + partenza, usata dal backend per dedurre provincia/regione SENZA
      richiedere all'utente di configurarla manualmente. */
  mercatiAttivi?: string[];
  settimanaPrec: { lordo: number; netto: number; giorni: number };
  settimanaPrecMercato?: { lordo: number; netto: number; giorni: number; mercato: string };
  // Stats avanzati
  settimanaCorrente?: { lordo: number; netto: number; giorni: number; mercati: string[] };
  confrontoSettimana?: { correnteLordo: number; precedenteLordo: number; differenza: number; variazionePercentuale: number };
  topMercati?: { nome: string; lordo: number; giorni: number }[];
  topFornitori?: { nome: string; totale: number }[];
  ultimoMese?: { lordo: number; netto: number; giorni: number };
  ultimoCarburante: { data: string; euro: number } | null;
  kmOggi: number;
  collaboratori: string[];
  fornitori: string[];
  speseAnnue: { voce: string; importo: number }[];
  partenzaDa: string;
  costoKm: number;
  tipoCarburante: string;
  mediaScontrino: number;
  // Notifiche dinamiche
  fiereProssime?: { data: string; nome: string; luogo: string }[];
  appuntiProssimi?: { data: string; titolo?: string; note?: string; testo?: string }[];
  ordiniProssimi?: { data: string; titolo?: string; note?: string; testo?: string }[];
  pagamentiImminenti?: { fornitore: string; numeroFattura: string; importo: number; scadenza: string; giorniRestanti: number }[];
  noteOggi?: string;
  // Data selezionata in calendario (YYYY-MM-DD) per meteo predittivo
  selectedDate?: string;
  // Invenduto ultima occorrenza dello stesso mercato/giorno (per warning AI)
  invendutoMedesimoMercato?: { data: string; giornoSett: string; mercato: string; invenduto: number; giorniFa: number } | null;
  // ═══ ROUND 46: Bilancio realistico del giorno selezionato ═══
  // Numeri pronti per dare un riepilogo finanziario chiaro nel saluto AI:
  // lordo del giorno - tutte le spese (fisse prorata + collaboratori + extra +
  // fornitori DAILY + fornitori CUSTOM + invenduto) = utile reale stimato.
  bilancioOggi?: {
    lordo: number;
    speseFisseProrata: number;
    costoCollaboratoriOggi: number;
    speseExtraOggi: number;
    fornitoriDailyOggi: number;
    fornitoriCustomOggi: number;
    invendutoOggi: number;
    totSpeseOggi: number;
    utileRealisticoOggi: number;
  };
  // ═══ DUMP COMPLETO DI TUTTI I DATI APP per risposte AI a domande libere ═══
  // Include: storico_giornate, ordini_agenda, appunti_agenda, storico_diario,
  // spese_annue, fiere, storico_carburante, fornitori, collaboratori, ecc.
  fullContextDump?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  storeData: StoreData;
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL
  || process.env.EXPO_PUBLIC_BACKEND_URL
  || '';

export const BuongiornoModal: React.FC<Props> = ({ visible, onClose, storeData }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [fuelData, setFuelData] = useState<string>('');
  const [weatherData, setWeatherData] = useState<string>('');
  const [dataReady, setDataReady] = useState(false);
  // Round 67: limite consumo AI raggiunto (10/giorno o 100/mese)
  const [limitReached, setLimitReached] = useState(false);
  // Round 48: banner Referral con dismiss persistente (10gg cooldown)
  const [showReferralBanner, setShowReferralBanner] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef(`session_${Date.now()}`);
  const { t } = useTranslation();

  // Round 48: controllo cooldown referral banner ad ogni apertura modale.
  // Mostra solo se mai cliccato la X OR sono passati >= 10 giorni dall'ultima X.
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const dismissedAt = await AsyncStorage.getItem(REFERRAL_DISMISS_KEY);
        if (!dismissedAt) {
          setShowReferralBanner(true);
          return;
        }
        const diffMs = Date.now() - Number(dismissedAt);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        setShowReferralBanner(diffDays >= REFERRAL_COOLDOWN_DAYS);
      } catch {
        setShowReferralBanner(true);
      }
    })();
  }, [visible]);

  const handleDismissReferral = async () => {
    setShowReferralBanner(false);
    try {
      await AsyncStorage.setItem(REFERRAL_DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const handleReferralPress = () => {
    onClose();
    // Naviga alla pagina Premi & Inviti (icona pacco)
    setTimeout(() => {
      try { router.push('/home/premi'); } catch {}
    }, 300);
  };

  // Fetch fuel prices and weather when modal opens
  useEffect(() => {
    if (visible) {
      // ═══ RESET sessione e messaggi ad OGNI apertura ═══
      // Questo forza un nuovo saluto AI con il context più recente (giorno selezionato + meteo aggiornato).
      sessionId.current = `session_${Date.now()}`;
      setMessages([]);
      setDataReady(false);
      setLimitReached(false);
      const promises: Promise<void>[] = [];

      if (storeData.partenzaDa && storeData.mercatoOggi) {
        promises.push(fetchFuelPrices());
      }
      const weatherCity = storeData.mercatoOggi || storeData.partenzaDa;
      if (weatherCity) {
        promises.push(fetchWeather(weatherCity, storeData.selectedDate));
      }

      // Mark data as ready when all fetches complete
      Promise.all(promises).then(() => setDataReady(true)).catch(() => setDataReady(true));
      
      // Timeout: if fetches take too long, proceed anyway
      setTimeout(() => setDataReady(true), 5000);
    }
  }, [visible, storeData.selectedDate]);

  const fetchFuelPrices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/fuel/cheapest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partenza: storeData.partenzaDa,
          destinazione: storeData.mercatoOggi,
          tipo_carburante: storeData.tipoCarburante || 'benzina',
        }),
      });
      const data = await res.json();
      if (data.success && data.stations && data.stations.length > 0) {
        // Nuovo formato strutturato: "Comune | Brand | Euro Prezzo | Via" — separatore '|'
        const stationInfo = data.stations.map((s: any, i: number) => {
          const comune = (s.comune || '').trim() || (s.indirizzo || '').split(',').slice(-1)[0]?.trim() || '—';
          const brand = (s.brand || s.nome || '—').trim();
          const prezzo = Number(s.prezzo || 0).toFixed(3);
          // estrai via dalla stringa indirizzo (parte prima della prima virgola)
          const via = (s.indirizzo || '').split(',')[0]?.trim() || '—';
          return `${i + 1}. ${comune} | ${brand} | Euro ${prezzo} | ${via} (${s.distanza_km}km dal tragitto)`;
        }).join('\n');
        setFuelData(`PREZZI CARBURANTE REALI (${storeData.tipoCarburante || 'benzina'}) nel tragitto ${storeData.partenzaDa} → ${storeData.mercatoOggi}:\n${stationInfo}`);
      } else {
        setFuelData(data.message || 'Prezzi carburante in tempo reale non disponibili per questa zona.');
      }
    } catch {
      setFuelData('Impossibile recuperare i prezzi carburante in tempo reale.');
    }
  };

  const fetchWeather = async (citta: string, dataSel?: string) => {
    try {
      const body: any = { citta };
      if (dataSel) body.data = dataSel;
      const res = await fetch(`${API_URL}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const dataLabel = dataSel && data.data ? ` (per ${data.data})` : '';
        // Round 76 — usa il RANGE MATTUTINO (06:00-13:00) invece del valore istantaneo,
        // che dava l'idea di un dato "fotografato" e fuorviante per chi lavora la mattina.
        const tMin = data.temperatura_mattina_min ?? data.temperatura_min;
        const tMax = data.temperatura_mattina_max ?? data.temperatura_max;
        const rangeStr = `${tMin}°C–${tMax}°C nella fascia mattutina (06:00–13:00)`;
        setWeatherData(`METEO REALE ${citta}${dataLabel}: ${data.descrizione}, ${rangeStr}; giornata ${data.temperatura_min}–${data.temperatura_max}°C, Vento ${data.vento_kmh} km/h, Precipitazioni ${data.precipitazioni_mm}mm`);
      } else {
        setWeatherData(`Meteo non disponibile per ${citta}`);
      }
    } catch {
      setWeatherData('Impossibile recuperare il meteo.');
    }
  };

  const contextStr = useMemo(() => {
    const s = storeData;
    // ═══ DATA DI RIFERIMENTO (selectedDate dal calendario Home) ═══
    const todayIso = new Date().toISOString().slice(0, 10);
    const selDate = s.selectedDate || todayIso;
    const isToday = selDate === todayIso;
    const isFuture = selDate > todayIso;
    const isPast = selDate < todayIso;
    let dateLabel = 'OGGI';
    let dateNarrative = `OGGI (${selDate})`;
    try {
      const d = new Date(selDate + 'T12:00:00');
      const giorniIt = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];
      const dayName = giorniIt[d.getDay()];
      const formatted = `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
      if (isToday) {
        dateLabel = 'OGGI';
        dateNarrative = `OGGI ${formatted}`;
      } else if (isFuture) {
        dateLabel = `${dayName} (futuro)`;
        dateNarrative = `${formatted} — ${selDate} — questo è un giorno FUTURO`;
      } else {
        dateLabel = `${dayName} (passato)`;
        dateNarrative = `${formatted} — ${selDate} — questo è un giorno PASSATO`;
      }
    } catch {}

    const settPrec = s.settimanaPrec.giorni > 0
      ? `Lordo: €${s.settimanaPrec.lordo}, Netto: €${s.settimanaPrec.netto}, ${s.settimanaPrec.giorni} giorni lavorati`
      : 'Nessun dato';
    const settPrecMerc = s.settimanaPrecMercato && s.settimanaPrecMercato.giorni > 0
      ? `Mercato ${s.settimanaPrecMercato.mercato}: Lordo: €${s.settimanaPrecMercato.lordo}, ${s.settimanaPrecMercato.giorni} giornate`
      : `Nessun dato specifico per mercato ${s.mercatoOggi}`;
    const carb = s.ultimoCarburante
      ? `Ultimo rifornimento: ${s.ultimoCarburante.data}, €${s.ultimoCarburante.euro}`
      : 'Nessun dato carburante';
    const mediaSc = s.mediaScontrino > 0 ? `€${s.mediaScontrino.toFixed(0)}` : 'Non calcolata';

    // ═══ STATS SETTIMANA/MESE ═══
    const settCorr = s.settimanaCorrente && s.settimanaCorrente.giorni > 0
      ? `Lordo: €${s.settimanaCorrente.lordo}, Netto: €${s.settimanaCorrente.netto}, ${s.settimanaCorrente.giorni} giornate (mercati: ${(s.settimanaCorrente.mercati || []).join(', ') || 'nessuno'})`
      : 'Nessun dato per questa settimana';
    const confr = s.confrontoSettimana
      ? `Sett. corrente €${s.confrontoSettimana.correnteLordo} vs sett. precedente €${s.confrontoSettimana.precedenteLordo} (differenza €${s.confrontoSettimana.differenza}, ${s.confrontoSettimana.variazionePercentuale >= 0 ? '+' : ''}${s.confrontoSettimana.variazionePercentuale}%)`
      : 'Nessun confronto disponibile';
    const topMk = (s.topMercati && s.topMercati.length > 0)
      ? s.topMercati.map((m, i) => `${i + 1}) ${m.nome} €${m.lordo} (${m.giorni} gg)`).join('; ')
      : 'Nessun mercato';
    const topForn = (s.topFornitori && s.topFornitori.length > 0)
      ? s.topFornitori.map((f, i) => `${i + 1}) ${f.nome} €${f.totale}`).join('; ')
      : 'Nessun fornitore';
    const ultMese = s.ultimoMese && s.ultimoMese.giorni > 0
      ? `Lordo: €${s.ultimoMese.lordo}, Netto: €${s.ultimoMese.netto}, ${s.ultimoMese.giorni} giornate`
      : 'Nessun dato ultimo mese';

    // ═══ NOTIFICHE ═══
    const fiereLst = (s.fiereProssime && s.fiereProssime.length > 0)
      ? s.fiereProssime.map((f) => `${f.data}: ${f.nome}${f.luogo ? ` @ ${f.luogo}` : ''}`).join(' | ')
      : 'nessuna';
    const appuntiLst = (s.appuntiProssimi && s.appuntiProssimi.length > 0)
      ? s.appuntiProssimi.map((a) => `${a.data}: ${a.testo || a.titolo || ''}`).join(' | ')
      : 'nessuno';
    const ordiniLst = (s.ordiniProssimi && s.ordiniProssimi.length > 0)
      ? s.ordiniProssimi.map((o) => `${o.data}: ${o.testo || o.titolo || ''}`).join(' | ')
      : 'nessuno';
    const pagLst = (s.pagamentiImminenti && s.pagamentiImminenti.length > 0)
      ? s.pagamentiImminenti.map((p) => `${p.fornitore} fatt.${p.numeroFattura} €${p.importo} (${p.giorniRestanti}gg a ${p.scadenza})`).join(' | ')
      : 'nessuno';

    const collabLst = (s.collaboratori && s.collaboratori.length > 0) ? s.collaboratori.join(', ') : 'nessuno';
    const fornLst = (s.fornitori && s.fornitori.length > 0) ? s.fornitori.join(', ') : 'nessuno';

    // ═══ ROUND 46: BILANCIO REALISTICO DEL GIORNO ═══
    // Quando l'utente ha già inserito dati nella Home (lordo + spese), gli
    // diamo il riepilogo finanziario PRONTO: utile reale stimato includendo
    // TUTTE le voci (fisse prorata, collaboratori, extra, fornitori, invenduto).
    const bil = s.bilancioOggi;
    const bilancioStr = bil && bil.lordo > 0
      ? `Lordo €${bil.lordo} | Spese tot. €${bil.totSpeseOggi} = UTILE REALE €${bil.utileRealisticoOggi}
   Dettaglio spese: Fisse €${bil.speseFisseProrata} · Collaboratori €${bil.costoCollaboratoriOggi} · Spese extra €${bil.speseExtraOggi} · Fornitori giornalieri €${bil.fornitoriDailyOggi} · Fornitori periodo €${bil.fornitoriCustomOggi} · Invenduto €${bil.invendutoOggi}`
      : 'Nessun dato di incasso ancora inserito per il giorno selezionato';

    return `═══ DATA DI RIFERIMENTO ═══
GIORNO SELEZIONATO DALL'UTENTE: ${dateNarrative}
${isFuture ? '⚠️ L\'utente sta consultando un giorno FUTURO. RIFORMULA TUTTE le frasi al FUTURO. NON dire "oggi" — usa il nome del giorno (es: "{giornoSettimana} pioverà a {mercato}, attento!"). Il meteo qui sotto è la PREVISIONE per quel giorno.' : ''}
${isPast ? '⚠️ L\'utente sta consultando un giorno PASSATO. Rispondi al passato (es: "{giornoSettimana} scorso era {descrizioneMeteo} a {mercato}"). Il meteo qui sotto è il dato di archivio.' : ''}

═══ ATTIVITA ═══
Attivita: ${s.nomeAttivita || '—'}
Titolare: ${s.nomeTitolare || '—'}
Mercato del ${dateLabel}: ${s.mercatoOggi || '⚠️ NON SPECIFICATO (lascia vuoto nel saluto, NON inventare città)'}
Meteo (codice scelto in app): ${s.meteoOggi || '—'}
Km: ${s.kmOggi}
Partenza da: ${s.partenzaDa || '⚠️ Non specificata (non inventare partenza)'}
Tipo carburante: ${s.tipoCarburante || 'benzina'}
Costo/km: €${s.costoKm.toFixed(3)}

═══ STATISTICHE STORICHE (da database locale) ═══
Settimana CORRENTE: ${settCorr}
Settimana precedente totale: ${settPrec}
Settimana precedente (mercato specifico): ${settPrecMerc}
Confronto settimane: ${confr}
Top 3 mercati ultimo mese: ${topMk}
Top 3 fornitori ultimo mese: ${topForn}
Ultimo mese totale: ${ultMese}
Media scontrino: ${mediaSc}

═══ 📊 BILANCIO REALISTICO DEL GIORNO SELEZIONATO ═══
${bilancioStr}
⚠️ ISTRUZIONI AI: Se l'utente ha già inserito un lordo > 0 per il giorno selezionato,
INCLUDI sempre un mini-riepilogo "📊 Bilancio di oggi: incassati €X, spese totali €Y, utile reale €Z" nel saluto iniziale.
Sii ONESTO: se utile <= 0 avvisa con preoccupazione ("attento, oggi sei in perdita!").
Se utile è molto basso (< 20% del lordo) suggerisci di rivedere le spese.
Non inventare numeri: usa SOLO quelli qui sopra.

═══ ORGANIZZAZIONE ═══
Collaboratori: ${collabLst}
Fornitori: ${fornLst}
Carburante: ${carb}

═══ NOTIFICHE / PROSSIMI IMPEGNI (SOLO da Notes) ═══
Appuntamenti prossimi (7gg, salvati in Notes): ${appuntiLst}
Ordini prossimi da preparare (7gg, salvati in Notes): ${ordiniLst}
Pagamenti imminenti (fatture in pagamento entro 7gg, da Notes): ${pagLst}
⚠️ NON mostrare fiere o note generiche nel saluto iniziale. Single Source of Truth = Notes.
${s.noteOggi ? `\nNota del giorno: ${s.noteOggi}` : ''}
${s.invendutoMedesimoMercato && s.invendutoMedesimoMercato.invenduto > 0 ? `\n═══ ⚠️ INVENDUTO PRECEDENTE STESSO MERCATO ═══\nLo scorso ${s.invendutoMedesimoMercato.giornoSett} (${s.invendutoMedesimoMercato.giorniFa} giorni fa, mercato ${s.invendutoMedesimoMercato.mercato}) c'erano €${s.invendutoMedesimoMercato.invenduto} di invenduto. AVVISA L'UTENTE con preoccupazione (NON dire "ottimo"!): potrebbe essere merce da scartare. Suggerisci di ridurre quantità e tenerne conto.` : ''}
${weatherData ? '\n═══ METEO ═══\n' + weatherData + (isFuture ? `\n(IMPORTANTE: questo è il meteo PREVISTO per ${dateLabel}, NON di oggi. Usalo nel tuo saluto al FUTURO.)` : '') : 'Nessun dato meteo reale'}
${fuelData ? '\n' + fuelData : 'Nessun dato prezzi carburante in tempo reale'}
${storeData.fullContextDump ? '\n\n═══ DATI COMPLETI APP (per rispondere a domande libere su qualsiasi cosa) ═══\n' + storeData.fullContextDump : ''}`;
  }, [storeData, fuelData, weatherData]);

  // Auto-send welcome message AFTER fuel+weather data is ready (senza mostrare messaggio utente)
  useEffect(() => {
    if (visible && dataReady && messages.length === 0) {
      sendInvisibleGreeting();
    }
  }, [visible, dataReady]);

  const sendInvisibleGreeting = async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const calendarBlock = buildCalendarContextStr();
      const mercatiLista = (storeData.mercatiAttivi || []).filter(Boolean).join('|');
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__INIT_GREETING__',
          session_id: sessionId.current,
          context: contextStr,
          device_id: deviceId,
          mercato_citta: storeData.mercatoOggi || storeData.partenzaDa || '',
          settore: storeData.settore || '',
          calendario_contestuale: calendarBlock,
          mercati_lista: mercatiLista,
        }),
      });
      const data = await res.json();
      if (data.limit_reached) setLimitReached(true);
      if (data.response) {
        setMessages([{ role: 'assistant', text: data.response }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', text: `Ciao ${storeData.nomeTitolare || ''}! 👋` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || limitReached) return;

    const userMsg: ChatMessage = { role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const deviceId = await getDeviceId();
      const calendarBlock = buildCalendarContextStr();
      const mercatiLista = (storeData.mercatiAttivi || []).filter(Boolean).join('|');
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: contextStr,
          session_id: sessionId.current,
          device_id: deviceId,
          mercato_citta: storeData.mercatoOggi || storeData.partenzaDa || '',
          settore: storeData.settore || '',
          calendario_contestuale: calendarBlock,
          mercati_lista: mercatiLista,
        }),
      });
      const data = await res.json();
      if (data.limit_reached) setLimitReached(true);
      const aiMsg: ChatMessage = { role: 'assistant', text: data.response || 'Nessuna risposta.' };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Errore di connessione. Riprova.' }]);
    }
    setLoading(false);
  };

  /* Round 68/69 — Calcola CALENDARIO_CONTESTUALE per i prossimi ~90 giorni
     usando la regione dedotta dalla lista mercati attivi. L'AI cita date
     esatte di feste e chiusure scolastiche senza approssimazioni. */
  const buildCalendarContextStr = (): string => {
    try {
      const now = new Date();
      const fromIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const to = new Date(now); to.setDate(now.getDate() + 90);
      const toIso = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      // Round 69 — Itera in ordine: mercato oggi → mercati attivi → partenzaDa
      // così la regione risolta lato frontend per le scuole è quella dove
      // l'utente opera oggi (o, in mancanza, il pool dei mercati settimanali).
      const candidates: string[] = [];
      if (storeData.mercatoOggi) candidates.push(storeData.mercatoOggi);
      (storeData.mercatiAttivi || []).forEach(m => { if (m && !candidates.includes(m)) candidates.push(m); });
      if (storeData.partenzaDa) candidates.push(storeData.partenzaDa);
      let regione: string | null = null;
      for (const c of candidates) {
        const r = resolveRegion(c);
        if (r) { regione = r; break; }
      }
      return buildCalendarContextBlock(fromIso, toIso, regione);
    } catch {
      return '';
    }
  };

  // Web Speech API for microphone
  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Il microfono non e supportato su questo browser. Usa il campo di testo.' }]);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Microfono disponibile solo nella versione web.' }]);
    }
  };

  const handleClose = () => {
    setMessages([]);
    sessionId.current = `session_${Date.now()}`;
    onClose();
  };

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={st.container}>
          {/* Header — X di chiusura a destra, titolo al centro */}
          <View style={st.header}>
            <View style={{ width: 60 }} />
            <View style={st.headerCenter}>
              <MaterialCommunityIcons name="robot-happy" size={22} color="#D4AF37" />
              <Text style={st.headerTitle}>{t('modals.goodMorningAI')}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={st.closeBtnRight} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Tip: più dati = più precisione */}
          {messages.length === 0 && (
            <View style={st.tipBar}>
              <Ionicons name="bulb-outline" size={14} color="#D4AF37" />
              <Text style={st.tipText}>{t('modals.moreDateMorePrecise') || 'Più dati inserisci nella app, più le risposte saranno precise e personalizzate.'}</Text>
            </View>
          )}

          {/* ═══ ROUND 53: RIEPILOGO RAPIDO RIMOSSO (richiesta utente) ═══
              Il widget duplicava le stesse info che l'AI dà nel saluto iniziale
              (meteo, carburante, agenda). Adesso solo l'AI parla, no clutter. */}

          {/* ═══ ROUND 48: BANNER REFERRAL — dismissable, ricompare ogni 10 giorni ═══ */}
          {showReferralBanner && (
            <View style={st.referralBanner}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                onPress={handleReferralPress}
                activeOpacity={0.7}
              >
                <View style={st.referralIcon}>
                  <Ionicons name="gift" size={20} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.referralTitle}>Invita un amico → Ricevi premi!</Text>
                  <Text style={st.referralSub}>Più amici porti, più vantaggi sblocchi 🎁</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D4AF37" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDismissReferral} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 6 }}>
                <Ionicons name="close" size={18} color="#8A6A1F" />
              </TouchableOpacity>
            </View>
          )}

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={st.chatArea}
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, i) => (
              <View key={i} style={[st.msgRow, msg.role === 'user' && st.msgRowUser]}>
                {msg.role === 'assistant' && (
                  <View style={st.aiAvatar}>
                    <MaterialCommunityIcons name="robot" size={16} color="#FFF" />
                  </View>
                )}
                <View style={[st.msgBubble, msg.role === 'user' ? st.userBubble : st.aiBubble]}>
                  <Text style={[st.msgText, msg.role === 'user' && { color: '#FFF' }]}>{msg.text}</Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={st.msgRow}>
                <View style={st.aiAvatar}>
                  <MaterialCommunityIcons name="robot" size={16} color="#FFF" />
                </View>
                <View style={st.aiBubble}>
                  <ActivityIndicator size="small" color="#1E7F85" />
                  <Text style={st.thinkingTxt}>{t('modals.thinking')}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Round 68 — Quick chip per funzioni dedicate (Bandi / Calendario) */}
          {!loading && (
            <View style={st.quickChipsRow}>
              <TouchableOpacity
                style={[st.quickChip, limitReached && { opacity: 0.4 }]}
                onPress={() => sendMessage('Mostrami bandi e normative attive per la mia zona (Unione Commercianti / ASCO / Camera di Commercio)')}
                disabled={limitReached}
                activeOpacity={0.7}
              >
                <Text style={st.quickChipTxt}>🏛️ Bandi & Normative</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.quickChip, limitReached && { opacity: 0.4 }]}
                onPress={() => sendMessage('Quali sono le prossime festività e chiusure scolastiche della mia regione? Come impattano i mercati?')}
                disabled={limitReached}
                activeOpacity={0.7}
              >
                <Text style={st.quickChipTxt}>📅 Feste & Scuole</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.quickChip, limitReached && { opacity: 0.4 }]}
                onPress={() => sendMessage('Come va il mio mese? Dammi un riepilogo strategico')}
                disabled={limitReached}
                activeOpacity={0.7}
              >
                <Text style={st.quickChipTxt}>📊 Riepilogo mese</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input bar */}
          <View style={[st.inputBar, { paddingBottom: Math.max(insets.bottom + 8, 14) }]}>
            <TouchableOpacity
              style={[st.micBtn, isListening && st.micBtnActive]}
              onPress={toggleMic}
              activeOpacity={0.7}
            >
              <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={22} color={isListening ? '#FFF' : '#1E7F85'} />
            </TouchableOpacity>
            <TextInput
              style={st.textInput}
              placeholder={limitReached ? 'Limite giornaliero AI raggiunto' : t('modals.askSomething')}
              placeholderTextColor="#B0B0A0"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              multiline={false}
              editable={!limitReached}
            />
            <TouchableOpacity
              style={[st.sendBtn, (!input.trim() || limitReached) && { opacity: 0.4 }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading || limitReached}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: {
    flex: 1, backgroundColor: '#D8EDE5', marginTop: 30,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#C0D8D0',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1 },
  closeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D46A6A', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  closeBtnRight: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#D46A6A', alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  tipBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F0E0', borderRadius: 12, marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tipText: { fontSize: 11, color: '#7A7050', flex: 1, lineHeight: 15 },

  // Round 48: banner Referral
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF8E6',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
    // @ts-ignore
    boxShadow: '0 2px 6px rgba(212,175,55,0.25)',
  },
  referralIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#5A4A2A',
    letterSpacing: 0.2,
  },
  referralSub: {
    fontSize: 11,
    color: '#8A6A1F',
    marginTop: 1,
  },

  widget: {
    // Round 50: stile più omogeneo — neutro crema chiaro, no più verdone acceso.
    // Coerente con il resto delle card dell'app (UtileModal, FornitoriPie).
    backgroundColor: '#FFFDF5',
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E0C8',
    shadowColor: '#1A4040',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E8E0C8' },
  widgetTitle: { fontSize: 11, fontWeight: '900', color: '#5A7575', letterSpacing: 1.5 },
  widgetSection: { marginTop: 6 },
  widgetSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  widgetLine: { fontSize: 11, color: '#3A5050', lineHeight: 15 },
  // Round 50: linea più ariosa, font più grande, icona più allineata
  wLine: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5, gap: 10 },
  wIcon: { fontSize: 16, lineHeight: 19, width: 18, textAlign: 'center' },
  wTxt: { flex: 1, fontSize: 13, color: '#1A4040', lineHeight: 18 },
  wLabel: { fontWeight: '900', color: '#1E7F85', fontSize: 13 },

  chatArea: { flex: 1, padding: 16 },

  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },

  aiAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#1E7F85',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },

  msgBubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  aiBubble: {
    backgroundColor: '#EDE8DA',
    borderBottomLeftRadius: 4,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  userBubble: {
    backgroundColor: '#1E7F85',
    borderBottomRightRadius: 4,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.4), -3px -3px 8px rgba(45,120,125,0.3)',
  },

  msgText: { fontSize: 14, lineHeight: 20, color: '#1A3535' },
  thinkingTxt: { fontSize: 12, color: '#7A9090', marginTop: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, paddingBottom: 30, backgroundColor: '#E5EDE8',
    borderTopWidth: 1, borderTopColor: '#C0D8D0',
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE8DA',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  micBtnActive: {
    backgroundColor: '#D44',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(200,50,50,0.4)',
  },
  textInput: {
    flex: 1, fontSize: 14, color: '#1A3535', backgroundColor: '#EDE8DA',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    // @ts-ignore
    boxShadow: 'inset 2px 2px 6px rgba(160,150,130,0.3), inset -2px -2px 6px rgba(255,255,250,0.7)',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E7F85',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5)',
  },
  // Round 68 — Quick chips
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexWrap: 'wrap',
    backgroundColor: '#E5EDE8',
    borderTopWidth: 1,
    borderTopColor: '#C0D8D0',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#1E7F85',
  },
  quickChipTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E7F85',
  },
});
