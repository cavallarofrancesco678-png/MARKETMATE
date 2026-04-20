import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { speseExtraTags, addSpeseExtraTag, removeSpeseExtraTag } = useAppStore();
  const insets = useSafeAreaInsets();

  // Expansion states (fornitori + voci generiche - a pacchetto)
  const [expandedForn, setExpandedForn] = useState<Record<string, boolean>>({});
  const [expandedVoce, setExpandedVoce] = useState<Record<number, boolean>>({});

  const toggleForn = (nome: string) =>
    setExpandedForn(prev => ({ ...prev, [nome]: !prev[nome] }));
  const toggleVoce = (idx: number) =>
    setExpandedVoce(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Local state for input values to prevent re-render losing characters
  const [localImporti, setLocalImporti] = useState<Record<string, string>>({});

  // Sync local state when modal opens
  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      fornitori.forEach(f => {
        initial[f.nome] = speseExtraFornitore[f.nome]?.importo || '';
      });
      setLocalImporti(initial);
    }
  }, [visible]);

  const updateEntry = (key: string, field: 'importo' | 'periodo', value: string) => {
    if (field === 'importo') {
      // Update local state only for typing
      setLocalImporti(prev => ({ ...prev, [key]: value }));
    } else {
      // For periodo changes, update parent directly
      const current = speseExtraFornitore[key] || { importo: localImporti[key] || '', periodo: 'giornaliero' };
      setSpeseExtraFornitore({
        ...speseExtraFornitore,
        [key]: { ...current, [field]: value, importo: localImporti[key] || current.importo },
      });
    }
  };

  const flushImporto = (key: string) => {
    const val = localImporti[key];
    if (val !== undefined) {
      const current = speseExtraFornitore[key] || { importo: '', periodo: 'giornaliero' };
      setSpeseExtraFornitore({
        ...speseExtraFornitore,
        [key]: { ...current, importo: val },
      });
    }
  };

  const handleClose = () => {
    // Flush all local importi to parent state before closing
    const updated = { ...speseExtraFornitore };
    Object.entries(localImporti).forEach(([key, val]) => {
      const current = updated[key] || { importo: '', periodo: 'giornaliero' };
      updated[key] = { ...current, importo: val };
    });
    setSpeseExtraFornitore(updated);
    setLocalImporti({});
    onClose();
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
            <TouchableOpacity onPress={handleClose}>
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
              const libKey = `${f.nome}__libera`;
              const entryLib = speseExtraFornitore[libKey] || { importo: '', periodo: 'giornaliero' };
              const fatturato = parseFloat((localImporti[f.nome] !== undefined ? localImporti[f.nome] : entry.importo || '0').replace(',', '.')) || 0;
              const libera = parseFloat((localImporti[libKey] !== undefined ? localImporti[libKey] : entryLib.importo || '0').replace(',', '.')) || 0;
              const totFornitore = fatturato + libera;
              const isOpen = !!expandedForn[f.nome];
              return (
                <View key={f.nome} style={st.card}>
                  <TouchableOpacity onPress={() => toggleForn(f.nome)} activeOpacity={0.7}>
                    <View style={st.fornHeader}>
                      <Ionicons name="storefront" size={16} color="#1E7F85" />
                      <Text style={st.cardTitle}>{f.nome}</Text>
                      {totFornitore > 0 ? (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, fontWeight: '900', color: '#1E7F85' }}>TOT €{totFornitore.toFixed(2)}</Text>
                      ) : (
                        <View style={{ marginLeft: 'auto' }} />
                      )}
                      {totFornitore > 0 ? (
                        <TouchableOpacity onPress={() => {
                          const updated = { ...speseExtraFornitore };
                          delete updated[f.nome];
                          delete updated[libKey];
                          setSpeseExtraFornitore(updated);
                          setLocalImporti(prev => { const n = { ...prev }; delete n[f.nome]; delete n[libKey]; return n; });
                        }} style={{ marginLeft: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={20} color="#D46A6A" />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#5A7575" style={{ marginLeft: 6 }} />
                    </View>
                  </TouchableOpacity>
                  {isOpen && (
                    <>
                      {/* Riga 1: Fatturata con campo numero fattura */}
                      <View style={{ marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#7A9090' }}>Fatt. n°</Text>
                          <TextInput
                            style={{ fontSize: 10, fontWeight: '600', color: '#1A4040', borderBottomWidth: 1, borderColor: '#D0D5D0', paddingVertical: 2, paddingHorizontal: 4, minWidth: 60, flex: 1 }}
                            placeholder="n° fattura"
                            placeholderTextColor="#C0C0B0"
                            value={localImporti[`${f.nome}__fattn`] !== undefined ? localImporti[`${f.nome}__fattn`] : (speseExtraFornitore[`${f.nome}__fattn`]?.importo || '')}
                            onChangeText={(v) => {
                              setLocalImporti(prev => ({ ...prev, [`${f.nome}__fattn`]: v }));
                            }}
                            onBlur={() => {
                              const val = localImporti[`${f.nome}__fattn`] || '';
                              const current = speseExtraFornitore[`${f.nome}__fattn`] || { importo: '', periodo: 'giornaliero' };
                              setSpeseExtraFornitore({ ...speseExtraFornitore, [`${f.nome}__fattn`]: { ...current, importo: val } });
                            }}
                            returnKeyType="done"
                          />
                        </View>
                        <View style={[st.inputRow, { marginTop: 4 }]}>
                          <TextInput
                            style={st.amountInput}
                            placeholder="0"
                            placeholderTextColor="#B0B0A0"
                            keyboardType="decimal-pad"
                            value={localImporti[f.nome] !== undefined ? localImporti[f.nome] : (entry.importo || '')}
                            onChangeText={(v) => updateEntry(f.nome, 'importo', v)}
                            onBlur={() => flushImporto(f.nome)}
                            onEndEditing={() => flushImporto(f.nome)}
                            returnKeyType="done"
                          />
                          <Text style={st.euro}>{'\u20AC'}</Text>
                        </View>
                      </View>
                      {/* Riga 2: Libera (nome personalizzabile con long-press) */}
                      <View style={{ marginTop: 4 }}>
                        <TouchableOpacity onLongPress={() => {
                          const currentLabel = speseExtraFornitore[`${f.nome}__liberaLabel`]?.importo || 'Libera';
                          Alert.prompt ? Alert.prompt('Rinomina', 'Come vuoi chiamare questa voce?', (text) => {
                            if (text && text.trim()) {
                              setSpeseExtraFornitore(prev => ({ ...prev, [`${f.nome}__liberaLabel`]: { importo: text.trim(), periodo: 'giornaliero' } }));
                            }
                          }, 'plain-text', currentLabel) : (() => {
                            const newLabel = prompt('Come vuoi chiamare questa voce?', currentLabel);
                            if (newLabel && newLabel.trim()) {
                              setSpeseExtraFornitore(prev => ({ ...prev, [`${f.nome}__liberaLabel`]: { importo: newLabel.trim(), periodo: 'giornaliero' } }));
                            }
                          })();
                        }} delayLongPress={500}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#B08050', marginBottom: 2 }}>
                            {speseExtraFornitore[`${f.nome}__liberaLabel`]?.importo || 'Libera'} <Text style={{ fontSize: 8, color: '#C0B0A0' }}>✏️</Text>
                          </Text>
                        </TouchableOpacity>
                        <View style={st.inputRow}>
                          <TextInput
                            style={st.amountInput}
                            placeholder="0"
                            placeholderTextColor="#B0B0A0"
                            keyboardType="decimal-pad"
                            value={localImporti[libKey] !== undefined ? localImporti[libKey] : (entryLib.importo || '')}
                            onChangeText={(v) => updateEntry(libKey, 'importo', v)}
                            onBlur={() => flushImporto(libKey)}
                            onEndEditing={() => flushImporto(libKey)}
                            returnKeyType="done"
                          />
                          <Text style={st.euro}>{'\u20AC'}</Text>
                        </View>
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
                      {/* Mostra equivalente giornaliero per spese settimanali/mensili */}
                      {entry.importo && parseFloat(entry.importo.replace(',', '.')) > 0 && entry.periodo !== 'giornaliero' && (
                        <Text style={{ fontSize: 10, color: '#7A9090', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
                          = €{(entry.periodo === 'settimanale' ? parseFloat(entry.importo.replace(',', '.')) / 6 : parseFloat(entry.importo.replace(',', '.')) / 26).toFixed(2)}/giorno
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ═══ SPESE EXTRA GENERICHE ═══ */}
            <Text style={st.sectionTitle}>SPESE EXTRA GENERICHE</Text>

            {vociGeneriche.map((v, idx) => {
              const isOpen = !!expandedVoce[idx];
              const importNum = parseFloat((v.importo || '0').replace(',', '.')) || 0;
              return (
                <View key={idx} style={st.card}>
                  <TouchableOpacity onPress={() => toggleVoce(idx)} activeOpacity={0.7}>
                    <View style={st.fornHeader}>
                      <Ionicons name="receipt-outline" size={16} color="#1E7F85" />
                      <Text style={st.cardTitle}>{v.nome}</Text>
                      {importNum > 0 ? (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, fontWeight: '900', color: '#1E7F85' }}>€{importNum.toFixed(2)}</Text>
                      ) : (
                        <View style={{ marginLeft: 'auto' }} />
                      )}
                      <TouchableOpacity onPress={() => removeVoce(idx)} style={{ marginLeft: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color="#D46A6A" />
                      </TouchableOpacity>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#5A7575" style={{ marginLeft: 6 }} />
                    </View>
                  </TouchableOpacity>
                  {isOpen && (
                    <>
                      <View style={st.inputRow}>
                        <TextInput
                          style={st.amountInput}
                          placeholder="0"
                          placeholderTextColor="#B0B0A0"
                          keyboardType="decimal-pad"
                          value={v.importo}
                          onChangeText={(val) => updateVoce(idx, 'importo', val)}
                          returnKeyType="done"
                        />
                        <Text style={st.euro}>{'\u20AC'}</Text>
                      </View>
                      {/* Periodo: giorno / settimana / mese */}
                      <View style={st.periodoRow}>
                        {['giornaliero', 'settimanale', 'mensile'].map((per) => {
                          const on = (v as any).periodo === per || (!((v as any).periodo) && per === 'giornaliero');
                          return (
                            <TouchableOpacity key={per} style={[st.periodoBtn, on && st.periodoBtnOn]} onPress={() => updateVoce(idx, 'periodo', per)}>
                              <Text style={[st.periodoTxt, on && { color: '#FFF' }]}>
                                {per === 'giornaliero' ? 'Giorno' : per === 'settimanale' ? 'Sett.' : 'Mese'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {/* Mostra equivalente giornaliero */}
                      {v.importo && parseFloat(v.importo.replace(',', '.')) > 0 && (v as any).periodo && (v as any).periodo !== 'giornaliero' && (
                        <Text style={{ fontSize: 10, color: '#7A9090', textAlign: 'center', marginTop: 2, fontStyle: 'italic' }}>
                          = €{((v as any).periodo === 'settimanale' ? parseFloat(v.importo.replace(',', '.')) / 6 : parseFloat(v.importo.replace(',', '.')) / 26).toFixed(2)}/giorno
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* ═══ TAG SALVATI (quick add + X per rimuovere) ═══ */}
            {speseExtraTags.length > 0 && (
              <View style={st.tagsRow}>
                {speseExtraTags
                  .filter((tag) => !vociGeneriche.some((v) => v.nome === tag))
                  .map((tag) => (
                    <View key={tag} style={st.tagChip}>
                      <TouchableOpacity onPress={() => addVoceFromTag(tag)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="add-circle-outline" size={14} color="#1E7F85" />
                        <Text style={st.tagChipTxt}>{tag}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeSpeseExtraTag(tag)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={{ marginLeft: 6 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#D46A6A" />
                      </TouchableOpacity>
                    </View>
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

          <TouchableOpacity style={[st.confirmBtn, { marginBottom: Math.max(insets.bottom, 8) + 8 }]} onPress={handleClose} activeOpacity={0.8}>
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
