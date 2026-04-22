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
      setDataReady(false);
      const promises: Promise<void>[] = [];

      if (storeData.partenzaDa && storeData.mercatoOggi) {
        promises.push(fetchFuelPrices());
      }
      const weatherCity = storeData.mercatoOggi || storeData.partenzaDa;
      if (weatherCity) {
        promises.push(fetchWeather(weatherCity));
      }

      // Mark data as ready when all fetches complete
      Promise.all(promises).then(() => setDataReady(true)).catch(() => setDataReady(true));
      
      // Timeout: if fetches take too long, proceed anyway
      setTimeout(() => setDataReady(true), 5000);
    }
  }, [visible]);

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

  const fetchWeather = async (citta: string) => {
    try {
      const res = await fetch(`${API_URL}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citta }),
      });
      const data = await res.json();
      if (data.success) {
        setWeatherData(`METEO REALE ${citta}: ${data.descrizione}, ${data.temperatura}°C (min ${data.temperatura_min}°C, max ${data.temperatura_max}°C), Vento ${data.vento_kmh} km/h, Precipitazioni ${data.precipitazioni_mm}mm`);
      } else {
        setWeatherData(`Meteo non disponibile per ${citta}`);
      }
    } catch {
      setWeatherData('Impossibile recuperare il meteo.');
    }
  };

  const contextStr = useMemo(() => {
    const s = storeData;
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

    return `Attivita: ${s.nomeAttivita}
Titolare: ${s.nomeTitolare}
Mercato oggi: ${s.mercatoOggi}
Meteo oggi: ${s.meteoOggi}
Km oggi: ${s.kmOggi}
Partenza da: ${s.partenzaDa || 'Non specificata'}
Tipo carburante: ${s.tipoCarburante || 'benzina'}
Costo/km: €${s.costoKm.toFixed(3)}
Settimana precedente totale: ${settPrec}
Settimana precedente mercato specifico: ${settPrecMerc}
Media scontrino attuale: ${mediaSc}
Carburante: ${carb}
${weatherData ? '\n' + weatherData : 'Nessun dato meteo reale'}
${fuelData ? '\n' + fuelData : 'Nessun dato prezzi carburante in tempo reale'}`;
  }, [storeData, fuelData, weatherData]);

  // Auto-send welcome message AFTER fuel+weather data is ready
  useEffect(() => {
    if (visible && dataReady && messages.length === 0) {
      sendMessage('Buongiorno! Come si presenta la giornata di oggi?');
    }
  }, [visible, dataReady]);

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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={st.container}>
          {/* Header */}
          <View style={st.header}>
            <TouchableOpacity onPress={handleClose} style={st.closeBtn}>
              <Ionicons name="close" size={20} color="#FFF" />
              <Text style={st.closeTxt}>{t('modals.close')}</Text>
            </TouchableOpacity>
            <View style={st.headerCenter}>
              <MaterialCommunityIcons name="robot-happy" size={22} color="#D4AF37" />
              <Text style={st.headerTitle}>{t('modals.goodMorningAI')}</Text>
            </View>
            <View style={{ width: 80 }} />
          </View>

          {/* Tip: più dati = più precisione */}
          {messages.length === 0 && (
            <View style={st.tipBar}>
              <Ionicons name="bulb-outline" size={14} color="#D4AF37" />
              <Text style={st.tipText}>{t('modals.moreDateMorePrecise') || 'Più dati inserisci nella app, più le risposte saranno precise e personalizzate.'}</Text>
            </View>
          )}

          {/* Widget dinamico notifiche (sempre visibile sopra la chat) */}
          {(() => {
            const fiere = storeData.fiereProssime || [];
            const appunti = storeData.appuntiProssimi || [];
            const ordini = storeData.ordiniProssimi || [];
            const nota = storeData.noteOggi || '';
            const pagamentiImminenti = storeData.pagamentiImminenti || [];
            const hasAny = fiere.length > 0 || appunti.length > 0 || ordini.length > 0 || nota.length > 0 || pagamentiImminenti.length > 0;
            if (!hasAny) return null;
            return (
              <View style={st.widget}>
                <View style={st.widgetHeader}>
                  <Ionicons name="notifications" size={14} color="#1E7F85" />
                  <Text style={st.widgetTitle}>RIEPILOGO SETTIMANA</Text>
                </View>

                {/* Pagamenti fornitori imminenti (tono colloquiale) */}
                {pagamentiImminenti.length > 0 && (
                  <View style={[st.widgetSection, { backgroundColor: '#FFF4DC', borderRadius: 8, padding: 8, borderLeftWidth: 2, borderLeftColor: '#E8A060' }]}>
                    <Text style={[st.widgetSubtitle, { color: '#B07030' }]}>💸 Pagamenti in arrivo</Text>
                    {pagamentiImminenti.slice(0, 4).map((p, i) => {
                      const emoji = p.giorniRestanti === 0 ? '🔔' :
                                    p.giorniRestanti === 1 ? '⏰' : '📌';
                      const frase = p.giorniRestanti === 0
                        ? `${emoji} Oggi scade la fattura di ${p.fornitore}${p.numeroFattura ? ` n° ${p.numeroFattura}` : ''}${p.importo ? ` (€${p.importo.toFixed(0)})` : ''}. Non dimenticartene!`
                        : p.giorniRestanti === 1
                        ? `${emoji} Ehilà! Domani scade la fattura di ${p.fornitore}${p.numeroFattura ? ` n° ${p.numeroFattura}` : ''}${p.importo ? ` – €${p.importo.toFixed(0)}` : ''}.`
                        : `${emoji} Ti ricordo che tra ${p.giorniRestanti} giorni scade la fattura di ${p.fornitore}${p.importo ? ` (€${p.importo.toFixed(0)})` : ''}. Segnalo da parte!`;
                      return (
                        <Text key={i} style={[st.widgetLine, { marginBottom: 3 }]}>
                          {frase}
                        </Text>
                      );
                    })}
                  </View>
                )}

                {appunti.length > 0 && (
                  <View style={st.widgetSection}>
                    <Text style={[st.widgetSubtitle, { color: '#1E7F85' }]}>📅 Appuntamenti ({appunti.length})</Text>
                    {appunti.slice(0, 3).map((a, i) => (
                      <Text key={i} style={st.widgetLine} numberOfLines={1}>
                        • {a.data} — {a.titolo || a.testo || a.note || '(senza titolo)'}
                      </Text>
                    ))}
                  </View>
                )}
                {ordini.length > 0 && pagamentiImminenti.length === 0 && (
                  <View style={st.widgetSection}>
                    <Text style={[st.widgetSubtitle, { color: '#E8A060' }]}>📦 Scadenze Ordini ({ordini.length})</Text>
                    {ordini.slice(0, 3).map((o, i) => (
                      <Text key={i} style={st.widgetLine} numberOfLines={1}>
                        • {o.data} — {o.titolo || o.testo || o.note || '(ordine)'}
                      </Text>
                    ))}
                  </View>
                )}
                {fiere.length > 0 && (
                  <View style={st.widgetSection}>
                    <Text style={[st.widgetSubtitle, { color: '#D4AF37' }]}>🎪 Fiere in preventivo ({fiere.length})</Text>
                    {fiere.slice(0, 3).map((f, i) => (
                      <Text key={i} style={st.widgetLine} numberOfLines={1}>
                        • {f.data} — {f.nome}{f.luogo ? ` (${f.luogo})` : ''}
                      </Text>
                    ))}
                  </View>
                )}
                {nota.length > 0 && (
                  <View style={st.widgetSection}>
                    <Text style={[st.widgetSubtitle, { color: '#7A5A1F' }]}>📝 Nota di oggi</Text>
                    <Text style={st.widgetLine} numberOfLines={2}>{nota}</Text>
                  </View>
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
          <View style={st.inputBar}>
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
  closeTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  tipBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F0E0', borderRadius: 12, marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tipText: { fontSize: 11, color: '#7A7050', flex: 1, lineHeight: 15 },

  widget: {
    backgroundColor: '#FFF', borderRadius: 12, marginHorizontal: 16, marginTop: 8,
    padding: 12, borderLeftWidth: 3, borderLeftColor: '#1E7F85',
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  widgetTitle: { fontSize: 11, fontWeight: '900', color: '#1A4040', letterSpacing: 1 },
  widgetSection: { marginTop: 6 },
  widgetSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  widgetLine: { fontSize: 11, color: '#3A5050', lineHeight: 15 },

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
