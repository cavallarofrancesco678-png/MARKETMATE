import React, { useState } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';

interface Fornitore {
  nome: string;
  prodotti: { nome: string; prezzo: number }[];
}

interface SpeseExtraEntry {
  importo: string;
  periodo: string;
}

interface VoceGenerica {
  nome: string;
  importo: string;
  attivo: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  fornitori: Fornitore[];
  speseExtraFornitore: Record<string, SpeseExtraEntry>;
  setSpeseExtraFornitore: (v: Record<string, SpeseExtraEntry>) => void;
  vociGeneriche: VoceGenerica[];
  setVociGeneriche: (v: VoceGenerica[]) => void;
}

const PERIODI_LABELS: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Sett.',
  mensile: 'Mese',
};

export const SpeseExtraModal: React.FC<Props> = ({
  visible, onClose, fornitori, speseExtraFornitore, setSpeseExtraFornitore,
  vociGeneriche, setVociGeneriche,
}) => {
  const [nuovaVoce, setNuovaVoce] = useState('');
  const { speseExtraTags, addSpeseExtraTag } = useAppStore();

  const updateEntry = (key: string, field: 'importo' | 'periodo', value: string) => {
    const current = speseExtraFornitore[key] || { importo: '', periodo: 'giornaliero' };
    setSpeseExtraFornitore({
      ...speseExtraFornitore,
      [key]: { ...current, [field]: value },
    });
  };

  const addVoceGenerica = () => {
    if (!nuovaVoce.trim()) return;
    const tagName = nuovaVoce.trim();
    setVociGeneriche([...vociGeneriche, { nome: tagName, importo: '', attivo: true }]);
    addSpeseExtraTag(tagName);
    setNuovaVoce('');
  };

  const addVoceFromTag = (tag: string) => {
    const alreadyExists = vociGeneriche.some((v) => v.nome === tag);
    if (!alreadyExists) {
      setVociGeneriche([...vociGeneriche, { nome: tag, importo: '', attivo: true }]);
    }
  };

  const updateVoce = (idx: number, field: string, value: any) => {
    const updated = [...vociGeneriche];
    (updated[idx] as any)[field] = value;
    setVociGeneriche(updated);
  };

  const removeVoce = (idx: number) => {
    setVociGeneriche(vociGeneriche.filter((_, i) => i !== idx));
  };

  const getTotale = () => {
    let tot = 0;
    Object.values(speseExtraFornitore).forEach((v) => {
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (v.periodo === 'settimanale') tot += imp / 6;
      else if (v.periodo === 'mensile') tot += imp / 26;
      else tot += imp;
    });
    vociGeneriche.forEach((v) => {
      if (v.attivo) tot += parseFloat((v.importo || '0').replace(',', '.')) || 0;
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
            <Text style={st.totalLabel}>Totale giornaliero:</Text>
            <Text style={st.totalVal}>{'\u20AC'}{getTotale().toFixed(2)}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* ═══ FORNITORI ═══ */}
            {fornitori.length > 0 && (
              <Text style={st.sectionTitle}>FORNITORI</Text>
            )}
            {fornitori.map((f) => {
              const entry = speseExtraFornitore[f.nome] || { importo: '', periodo: 'giornaliero' };
              return (
                <View key={f.nome} style={st.card}>
                  <View style={st.fornHeader}>
                    <Ionicons name="storefront" size={16} color="#1E7F85" />
                    <Text style={st.cardTitle}>{f.nome}</Text>
                  </View>
                  <View style={st.prodottiRow}>
                    {f.prodotti.map((p) => (
                      <View key={p.nome} style={st.chip}>
                        <Text style={st.chipTxt}>{p.nome} ({'\u20AC'}{p.prezzo})</Text>
                      </View>
                    ))}
                  </View>
                  <View style={st.inputRow}>
                    <TextInput
                      style={st.amountInput}
                      placeholder="0"
                      placeholderTextColor="#B0B0A0"
                      keyboardType="numeric"
                      value={entry.importo}
                      onChangeText={(v) => updateEntry(f.nome, 'importo', v)}
                      selectTextOnFocus
                    />
                    <Text style={st.euro}>{'\u20AC'}</Text>
                  </View>
                  <View style={st.periodoRow}>
                    {['giornaliero', 'settimanale', 'mensile'].map((per) => {
                      const on = entry.periodo === per;
                      return (
                        <TouchableOpacity key={per} style={[st.periodoBtn, on && st.periodoBtnOn]} onPress={() => updateEntry(f.nome, 'periodo', per)}>
                          <Text style={[st.periodoTxt, on && { color: '#FFF' }]}>{PERIODI_LABELS[per]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* ═══ SPESE EXTRA GENERICHE ═══ */}
            <Text style={st.sectionTitle}>SPESE EXTRA GENERICHE</Text>

            {vociGeneriche.map((v, idx) => (
              <View key={idx} style={st.card}>
                <View style={st.voceRow}>
                  <Switch
                    value={v.attivo}
                    onValueChange={(val) => updateVoce(idx, 'attivo', val)}
                    trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
                    thumbColor={v.attivo ? '#1E7F85' : '#999'}
                  />
                  <Text style={[st.voceName, !v.attivo && { color: '#B0B0A0', textDecorationLine: 'line-through' }]}>{v.nome}</Text>
                  <TextInput
                    style={st.voceInput}
                    placeholder="0"
                    placeholderTextColor="#B0B0A0"
                    keyboardType="numeric"
                    value={v.importo}
                    onChangeText={(val) => updateVoce(idx, 'importo', val)}
                    selectTextOnFocus
                  />
                  <Text style={st.euro}>{'\u20AC'}</Text>
                  <TouchableOpacity onPress={() => removeVoce(idx)} style={st.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* ═══ TAG SALVATI (quick add) ═══ */}
            {speseExtraTags.length > 0 && (
              <View style={st.tagsRow}>
                {speseExtraTags
                  .filter((tag) => !vociGeneriche.some((v) => v.nome === tag))
                  .map((tag) => (
                    <TouchableOpacity key={tag} style={st.tagChip} onPress={() => addVoceFromTag(tag)}>
                      <Ionicons name="add-circle-outline" size={14} color="#1E7F85" />
                      <Text style={st.tagChipTxt}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {/* Aggiungi nuova voce */}
            <View style={st.addRow}>
              <TextInput
                style={st.addInput}
                placeholder="Nuova voce (es: Colazione)"
                placeholderTextColor="#B0B0A0"
                value={nuovaVoce}
                onChangeText={setNuovaVoce}
                onSubmitEditing={addVoceGenerica}
              />
              <TouchableOpacity style={st.addBtn} onPress={addVoceGenerica}>
                <Ionicons name="add" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

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
  handle: { width: 40, height: 4, backgroundColor: '#B0C4BC', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1.5 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 16,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#5A7575' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#1A3535' },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginTop: 12, marginBottom: 8 },
  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 10,
    // @ts-ignore
    boxShadow: '5px 5px 12px rgba(160,150,130,0.45), -4px -4px 10px rgba(255,255,250,0.9)',
  },
  fornHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  prodottiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#D8EDE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  amountInput: {
    flex: 1, fontSize: 18, fontWeight: '800', color: '#1A3535',
    backgroundColor: '#E0DBC8', borderRadius: 10, padding: 8, textAlign: 'center',
  },
  euro: { fontSize: 16, fontWeight: '800', color: '#5A7575' },
  periodoRow: { flexDirection: 'row', gap: 6 },
  periodoBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 10, paddingVertical: 7, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.85)',
  },
  periodoBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(15,55,60,0.5), -2px -2px 5px rgba(45,120,125,0.35)',
  },
  periodoTxt: { fontSize: 10, fontWeight: '800', color: '#4A3A2A' },
  voceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voceName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1A3535' },
  voceInput: {
    width: 70, fontSize: 16, fontWeight: '800', color: '#1A3535',
    backgroundColor: '#E0DBC8', borderRadius: 8, padding: 6, textAlign: 'right',
  },
  deleteBtn: { padding: 4 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D8EDE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#A5D8D0',
  },
  tagChipTxt: { fontSize: 11, fontWeight: '700', color: '#1E7F85' },
  addInput: {
    flex: 1, fontSize: 14, color: '#1A3535', backgroundColor: '#EDE8DA',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    // @ts-ignore
    boxShadow: 'inset 2px 2px 5px rgba(160,150,130,0.3), inset -2px -2px 5px rgba(255,255,250,0.7)',
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#1E7F85',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5)',
  },
  confirmBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  confirmTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
