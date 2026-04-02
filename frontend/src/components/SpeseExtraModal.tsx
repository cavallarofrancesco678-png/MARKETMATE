import React from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Fornitore {
  nome: string;
  prodotti: { nome: string; prezzo: number }[];
}

interface SpeseExtraEntry {
  importo: string;
  periodo: string; // 'giornaliero' | 'settimanale' | 'mensile'
}

interface Props {
  visible: boolean;
  onClose: () => void;
  fornitori: Fornitore[];
  speseExtra: string;
  setSpeseExtra: (v: string) => void;
  speseExtraFornitore: Record<string, SpeseExtraEntry>;
  setSpeseExtraFornitore: (v: Record<string, SpeseExtraEntry>) => void;
}

const PERIODI = ['giornaliero', 'settimanale', 'mensile'] as const;
const PERIODI_LABELS: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Sett.',
  mensile: 'Mese',
};

export const SpeseExtraModal: React.FC<Props> = ({
  visible, onClose, fornitori, speseExtra, setSpeseExtra,
  speseExtraFornitore, setSpeseExtraFornitore,
}) => {
  const updateEntry = (key: string, field: 'importo' | 'periodo', value: string) => {
    const current = speseExtraFornitore[key] || { importo: '', periodo: 'giornaliero' };
    setSpeseExtraFornitore({
      ...speseExtraFornitore,
      [key]: { ...current, [field]: value },
    });
  };

  const getTotale = () => {
    let tot = parseFloat(speseExtra.replace(',', '.')) || 0;
    Object.values(speseExtraFornitore).forEach((v) => {
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (v.periodo === 'settimanale') tot += imp / 6;
      else if (v.periodo === 'mensile') tot += imp / 26;
      else tot += imp;
    });
    return tot;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={st.container}>
          <View style={st.handle} />
          <View style={st.headerRow}>
            <Text style={st.title}>SPESE EXTRA</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#5A7575" />
            </TouchableOpacity>
          </View>

          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Totale giornaliero equivalente:</Text>
            <Text style={st.totalVal}>{'\u20AC'}{getTotale().toFixed(2)}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Spesa extra generica */}
            <View style={st.card}>
              <Text style={st.cardTitle}>Spesa Extra Generica</Text>
              <TextInput
                style={st.cardInput}
                placeholder="0"
                placeholderTextColor="#B0B0A0"
                keyboardType="numeric"
                value={speseExtra}
                onChangeText={setSpeseExtra}
                selectTextOnFocus
              />
            </View>

            {/* Fornitori */}
            {fornitori.map((f) => {
              const entry = speseExtraFornitore[f.nome] || { importo: '', periodo: 'giornaliero' };
              return (
                <View key={f.nome} style={st.card}>
                  <View style={st.fornHeaderRow}>
                    <Ionicons name="storefront" size={16} color="#1E7F85" />
                    <Text style={st.cardTitle}>{f.nome}</Text>
                  </View>

                  {/* Prodotti */}
                  <View style={st.prodottiRow}>
                    {f.prodotti.map((p) => (
                      <View key={p.nome} style={st.prodottoChip}>
                        <Text style={st.prodottoTxt}>{p.nome} ({'\u20AC'}{p.prezzo})</Text>
                      </View>
                    ))}
                  </View>

                  {/* Importo */}
                  <View style={st.inputRow}>
                    <Text style={st.inputLabel}>Importo:</Text>
                    <TextInput
                      style={st.amountInput}
                      placeholder="0"
                      placeholderTextColor="#B0B0A0"
                      keyboardType="numeric"
                      value={entry.importo}
                      onChangeText={(v) => updateEntry(f.nome, 'importo', v)}
                      selectTextOnFocus
                    />
                    <Text style={st.euroSign}>{'\u20AC'}</Text>
                  </View>

                  {/* Periodo */}
                  <View style={st.periodoRow}>
                    {PERIODI.map((per) => {
                      const on = entry.periodo === per;
                      return (
                        <TouchableOpacity
                          key={per}
                          style={[st.periodoBtn, on && st.periodoBtnOn]}
                          onPress={() => updateEntry(f.nome, 'periodo', per)}
                        >
                          <Text style={[st.periodoTxt, on && { color: '#FFF' }]}>
                            {PERIODI_LABELS[per]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={{ height: 40 }} />
          </ScrollView>

          <TouchableOpacity style={st.confirmBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={st.confirmTxt}>CONFERMA</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: {
    flex: 1, backgroundColor: '#D8EDE5', marginTop: 60,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#B0C4BC',
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1.5 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 16,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#5A7575' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#1A3535' },

  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16,
    marginBottom: 12,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  fornHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  cardInput: {
    fontSize: 20, fontWeight: '900', color: '#1A3535',
    textAlign: 'center', padding: 8, marginTop: 8,
    backgroundColor: '#E0DBC8', borderRadius: 10,
  },

  prodottiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  prodottoChip: {
    backgroundColor: '#D8EDE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  prodottoTxt: { fontSize: 9, fontWeight: '600', color: '#5A7575' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10,
  },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#5A7575' },
  amountInput: {
    flex: 1, fontSize: 16, fontWeight: '800', color: '#1A3535',
    backgroundColor: '#E0DBC8', borderRadius: 10, padding: 8, textAlign: 'right',
  },
  euroSign: { fontSize: 16, fontWeight: '800', color: '#5A7575' },

  periodoRow: { flexDirection: 'row', gap: 8 },
  periodoBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 10, paddingVertical: 8,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.85)',
  },
  periodoBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(15,55,60,0.5), -2px -2px 5px rgba(45,120,125,0.35)',
  },
  periodoTxt: { fontSize: 10, fontWeight: '800', color: '#4A3A2A' },

  confirmBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  confirmTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
