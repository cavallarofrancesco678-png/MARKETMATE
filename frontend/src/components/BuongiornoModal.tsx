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
  const scrollRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef(`session_${Date.now()}`);
  const { t } = useTranslation();

  const contextStr = useMemo(() => {
    const s = storeData;
    const collabs = s.collaboratori.length > 0 ? s.collaboratori.join(', ') : 'Nessuno';
    const forns = s.fornitori.length > 0 ? s.fornitori.join(', ') : 'Nessuno';
    const spese = s.speseAnnue.map((sp) => `${sp.voce}: €${sp.importo}/anno`).join(', ');
    const settPrec = s.settimanaPrec.giorni > 0
      ? `Lordo: €${s.settimanaPrec.lordo}, Netto: €${s.settimanaPrec.netto}, ${s.settimanaPrec.giorni} giorni lavorati`
      : 'Nessun dato';
    const settPrecMerc = s.settimanaPrecMercato && s.settimanaPrecMercato.giorni > 0
      ? `Mercato ${s.settimanaPrecMercato.mercato}: Lordo: €${s.settimanaPrecMercato.lordo}, Netto: €${s.settimanaPrecMercato.netto}, ${s.settimanaPrecMercato.giorni} giornate`
      : `Nessun dato specifico per mercato ${s.mercatoOggi}`;
    const carb = s.ultimoCarburante
      ? `Ultimo rifornimento: ${s.ultimoCarburante.data}, €${s.ultimoCarburante.euro}`
      : 'Nessun dato carburante';
    const costoViaggio = s.kmOggi > 0 ? `€${(s.kmOggi * s.costoKm).toFixed(2)}` : 'Non calcolabile';

    return `Attivita: ${s.nomeAttivita}
Titolare: ${s.nomeTitolare}
Mercato oggi: ${s.mercatoOggi}
Meteo oggi: ${s.meteoOggi}
Km oggi: ${s.kmOggi}
Partenza da: ${s.partenzaDa || 'Non specificata'}
Costo/km: €${s.costoKm.toFixed(3)}
Costo stimato viaggio: ${costoViaggio}
Collaboratori: ${collabs}
Fornitori: ${forns}
Spese annuali: ${spese}
Settimana precedente totale: ${settPrec}
Settimana precedente mercato specifico: ${settPrecMerc}
Carburante: ${carb}`;
  }, [storeData]);

  // Auto-send welcome message on open
  useEffect(() => {
    if (visible && messages.length === 0) {
      sendMessage('Buongiorno! Come si presenta la giornata di oggi?');
    }
  }, [visible]);

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
