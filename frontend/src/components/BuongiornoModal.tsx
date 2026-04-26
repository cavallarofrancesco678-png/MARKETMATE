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

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface StoreData {
  nomeAttivita: string;
  nomeTitolare: string;
  meteoOggi: string;
  mercatoOggi: string;
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
  const scrollRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef(`session_${Date.now()}`);
  const { t } = useTranslation();

  // Fetch fuel prices and weather when modal opens
  useEffect(() => {
    if (visible) {
      // ═══ RESET sessione e messaggi ad OGNI apertura ═══
      // Questo forza un nuovo saluto AI con il context più recente (giorno selezionato + meteo aggiornato).
      sessionId.current = `session_${Date.now()}`;
      setMessages([]);
      setDataReady(false);
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
        const stationInfo = data.stations.map((s: any, i: number) =>
          `${i + 1}. ${s.nome} - ${s.indirizzo} - €${s.prezzo}/L (${s.distanza_km}km dal tragitto)`
        ).join('\n');
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
        setWeatherData(`METEO REALE ${citta}${dataLabel}: ${data.descrizione}, ${data.temperatura}°C (min ${data.temperatura_min}°C, max ${data.temperatura_max}°C), Vento ${data.vento_kmh} km/h, Precipitazioni ${data.precipitazioni_mm}mm`);
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

    return `═══ DATA DI RIFERIMENTO ═══
GIORNO SELEZIONATO DALL'UTENTE: ${dateNarrative}
${isFuture ? '⚠️ L\'utente sta consultando un giorno FUTURO. RIFORMULA TUTTE le frasi al FUTURO. NON dire "oggi" — usa il nome del giorno (es: "Lunedì pioverà a Roma, attento al mercato!"). Il meteo qui sotto è la PREVISIONE per quel giorno.' : ''}
${isPast ? '⚠️ L\'utente sta consultando un giorno PASSATO. Rispondi al passato (es: "Lunedì scorso era nuvoloso"). Il meteo qui sotto è il dato di archivio.' : ''}

═══ ATTIVITA ═══
Attivita: ${s.nomeAttivita}
Titolare: ${s.nomeTitolare}
Mercato del ${dateLabel}: ${s.mercatoOggi}
Meteo (codice scelto in app): ${s.meteoOggi}
Km: ${s.kmOggi}
Partenza da: ${s.partenzaDa || 'Non specificata'}
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

═══ ORGANIZZAZIONE ═══
Collaboratori: ${collabLst}
Fornitori: ${fornLst}
Carburante: ${carb}

═══ NOTIFICHE / PROSSIMI IMPEGNI ═══
Fiere prossime (7gg): ${fiereLst}
Appuntamenti prossimi (7gg): ${appuntiLst}
Ordini prossimi (7gg): ${ordiniLst}
Pagamenti imminenti: ${pagLst}
${s.noteOggi ? `\nNota del giorno: ${s.noteOggi}` : ''}
${s.invendutoMedesimoMercato && s.invendutoMedesimoMercato.invenduto > 0 ? `\n═══ ⚠️ INVENDUTO PRECEDENTE STESSO MERCATO ═══\nLo scorso ${s.invendutoMedesimoMercato.giornoSett} (${s.invendutoMedesimoMercato.giorniFa} giorni fa, mercato ${s.invendutoMedesimoMercato.mercato}) c'erano €${s.invendutoMedesimoMercato.invenduto} di invenduto. AVVISA L'UTENTE con preoccupazione (NON dire "ottimo"!): potrebbe essere merce da scartare. Suggerisci di ridurre quantità e tenerne conto.` : ''}
${weatherData ? '\n═══ METEO ═══\n' + weatherData + (isFuture ? `\n(IMPORTANTE: questo è il meteo PREVISTO per ${dateLabel}, NON di oggi. Usalo nel tuo saluto al FUTURO.)` : '') : 'Nessun dato meteo reale'}
${fuelData ? '\n' + fuelData : 'Nessun dato prezzi carburante in tempo reale'}`;
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
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__INIT_GREETING__',
          session_id: sessionId.current,
          context: contextStr,
        }),
      });
      const data = await res.json();
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
    if (!text.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: contextStr,
          session_id: sessionId.current,
        }),
      });
      const data = await res.json();
      const aiMsg: ChatMessage = { role: 'assistant', text: data.response || 'Nessuna risposta.' };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Errore di connessione. Riprova.' }]);
    }
    setLoading(false);
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

          {/* Widget compatto: priorità PAGAMENTI > APPUNTI > ORDINI > METEO > RIFORNIMENTO */}
          {(() => {
            const fiere = storeData.fiereProssime || [];
            const appunti = storeData.appuntiProssimi || [];
            const ordini = storeData.ordiniProssimi || [];
            const pagamenti = storeData.pagamentiImminenti || [];
            const noteOggi = (storeData as any).noteOggi as string | undefined;
            // Mostra SEMPRE il widget se è aperto: meteo, fuel e agenda sono dati core
            const hasAny = true;
            if (!hasAny) return null;

            // Parse meteo in forma compatta
            const meteoSummary = (() => {
              if (!weatherData) return '';
              const m = weatherData.match(/METEO REALE ([^:]+): ([^,]+), (\-?\d+)°C/);
              if (m) return `${m[2].trim()} ${m[3]}° · ${m[1].trim()}`;
              return weatherData.length > 50 ? weatherData.slice(0, 50) + '…' : weatherData;
            })();

            // Parse rifornimento migliore (prima stazione "1. NOME - INDIRIZZO - €PREZZO/L")
            const fuelSummary = (() => {
              if (!fuelData) return '';
              // formato: "1. NOME - INDIRIZZO - €PREZZO/L (DISTkm dal tragitto)"
              const m = fuelData.match(/1\.\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*€?(\d+[\.,]\d+)\/L\s*\(([\d\.,]+)\s*km/);
              if (m) {
                const nome = m[1].trim();
                const indir = m[2].trim();
                const prezzo = m[3].replace(',', '.');
                const dist = m[4].replace(',', '.');
                return `${nome} (${indir}) · €${prezzo}/L · ${dist}km`;
              }
              // formato alternativo (no distance/no /L)
              const m2 = fuelData.match(/1\.\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*€?(\d+[\.,]\d+)/);
              if (m2) return `${m2[1].trim()} (${m2[2].trim()}) · €${m2[3].replace(',', '.')}/L`;
              return '';
            })();
            const fuelEmpty = !fuelSummary && fuelData && /non disponibili|Impossibile|Nessun/i.test(fuelData);

            return (
              <View style={st.widget}>
                <View style={st.widgetHeader}>
                  <Ionicons name="flash" size={14} color="#1E7F85" />
                  <Text style={st.widgetTitle}>RIEPILOGO RAPIDO</Text>
                </View>

                {/* 1. METEO — sempre primo */}
                <View style={st.wLine}>
                  <Text style={st.wIcon}>🌤️</Text>
                  <Text style={st.wTxt} numberOfLines={2}>
                    <Text style={st.wLabel}>Meteo: </Text>{meteoSummary || 'in caricamento…'}
                  </Text>
                </View>

                {/* 2. RIFORNIMENTO MIGLIORE — sempre secondo */}
                <View style={st.wLine}>
                  <Text style={st.wIcon}>⛽</Text>
                  <Text style={st.wTxt} numberOfLines={2}>
                    <Text style={st.wLabel}>Miglior rifornim.: </Text>
                    {fuelSummary || (fuelEmpty ? 'non disponibile per questa zona' : 'in caricamento…')}
                  </Text>
                </View>

                {/* 3. AGENDA / NOTE — sempre terzo (anche se vuoto) */}
                {(appunti.length === 0 && ordini.length === 0 && fiere.length === 0 && pagamenti.length === 0 && !noteOggi) ? (
                  <View style={st.wLine}>
                    <Text style={st.wIcon}>📋</Text>
                    <Text style={st.wTxt} numberOfLines={1}>
                      <Text style={st.wLabel}>Agenda: </Text>nessun appuntamento o nota
                    </Text>
                  </View>
                ) : (
                  <>
                    {pagamenti.length > 0 && (
                      <View style={st.wLine}>
                        <Text style={st.wIcon}>💸</Text>
                        <Text style={st.wTxt} numberOfLines={2}>
                          <Text style={st.wLabel}>Pagam.: </Text>
                          {pagamenti.slice(0, 2).map((p, i) => {
                            const quando = p.giorniRestanti === 0 ? 'oggi' : p.giorniRestanti === 1 ? 'domani' : `${p.giorniRestanti}g`;
                            return `${p.fornitore} (${quando})${i < Math.min(1, pagamenti.length - 1) ? ', ' : ''}`;
                          }).join('')}
                          {pagamenti.length > 2 ? ` +${pagamenti.length - 2}` : ''}
                        </Text>
                      </View>
                    )}
                    {appunti.length > 0 && (
                      <View style={st.wLine}>
                        <Text style={st.wIcon}>📅</Text>
                        <Text style={st.wTxt} numberOfLines={2}>
                          <Text style={st.wLabel}>Appunt.: </Text>
                          {appunti.slice(0, 2).map((a: any) => `${a.testo || a.titolo || ''}${a.luogo ? ' @ ' + a.luogo : ''}`).join(', ')}
                          {appunti.length > 2 ? ` +${appunti.length - 2}` : ''}
                        </Text>
                      </View>
                    )}
                    {ordini.length > 0 && (
                      <View style={st.wLine}>
                        <Text style={st.wIcon}>📦</Text>
                        <Text style={st.wTxt} numberOfLines={2}>
                          <Text style={st.wLabel}>Ordini: </Text>
                          {ordini.slice(0, 2).map((o: any) => `${o.testo || o.titolo || ''}${o.luogo ? ' @ ' + o.luogo : ''}`).join(', ')}
                          {ordini.length > 2 ? ` +${ordini.length - 2}` : ''}
                        </Text>
                      </View>
                    )}
                    {fiere.length > 0 && (
                      <View style={st.wLine}>
                        <Text style={st.wIcon}>🎪</Text>
                        <Text style={st.wTxt} numberOfLines={2}>
                          <Text style={st.wLabel}>Fiere: </Text>
                          {fiere.slice(0, 2).map((f) => `${f.nome}${f.luogo ? ' @ ' + f.luogo : ''}`).join(', ')}
                          {fiere.length > 2 ? ` +${fiere.length - 2}` : ''}
                        </Text>
                      </View>
                    )}
                    {noteOggi ? (
                      <View style={st.wLine}>
                        <Text style={st.wIcon}>📝</Text>
                        <Text style={st.wTxt} numberOfLines={2}>
                          <Text style={st.wLabel}>Nota: </Text>{noteOggi}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            );
          })()}

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
              placeholder={t('modals.askSomething')}
              placeholderTextColor="#B0B0A0"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[st.sendBtn, !input.trim() && { opacity: 0.4 }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
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

  widget: {
    backgroundColor: '#FFF8E7', borderRadius: 14, marginHorizontal: 12, marginTop: 10,
    padding: 12, borderWidth: 2, borderColor: '#1E7F85',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E0D8C0' },
  widgetTitle: { fontSize: 12, fontWeight: '900', color: '#1A4040', letterSpacing: 1.2 },
  widgetSection: { marginTop: 6 },
  widgetSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  widgetLine: { fontSize: 11, color: '#3A5050', lineHeight: 15 },
  wLine: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, gap: 8 },
  wIcon: { fontSize: 15, lineHeight: 18 },
  wTxt: { flex: 1, fontSize: 12.5, color: '#1A4040', lineHeight: 17 },
  wLabel: { fontWeight: '900', color: '#1E7F85', fontSize: 12.5 },

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
});
