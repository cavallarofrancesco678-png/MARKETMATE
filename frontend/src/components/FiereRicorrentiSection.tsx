import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Fiera, TipologiaEvento } from '../store/appStore';
import { MiniMonthCalendar } from './MiniMonthCalendar';

const GIORNI_LABEL = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const GIORNI_FULL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const TIPOLOGIE: TipologiaEvento[] = ['Fiera', 'Sagra', 'Festa Patronale', 'Evento Speciale'];

function genId() {
  return `f_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export const FiereRicorrentiSection: React.FC = () => {
  const store = useAppStore();
  const fiere = store.fiere || [];

  const [expanded, setExpanded] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<Fiera | null>(null);

  const startNew = () => {
    setEditing({
      id: genId(),
      nome: '',
      luogo: '',
      giorni: [],
      orarioInizio: '',
      orarioFine: '',
      km: 0,
      plateatico: 0,
      tipologia: 'Fiera',
      note: '',
      attiva: true,
    });
    setEditVisible(true);
  };

  const startEdit = (f: Fiera) => {
    setEditing({ ...f });
    setEditVisible(true);
  };

  const confirmDelete = (f: Fiera) => {
    const doDelete = () => store.removeFiera(f.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Eliminare "${f.nome}"?`)) doDelete();
    } else {
      Alert.alert('Elimina Fiera', `Eliminare "${f.nome}"?`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const save = () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      if (Platform.OS === 'web') window.alert('Inserisci il nome della fiera');
      else Alert.alert('Errore', 'Inserisci il nome della fiera');
      return;
    }
    const exists = fiere.some((f) => f.id === editing.id);
    if (exists) {
      store.updateFiera(editing.id, editing);
    } else {
      store.addFiera(editing);
    }
    setEditVisible(false);
    setEditing(null);
  };

  const toggleGiorno = (i: number) => {
    if (!editing) return;
    const has = editing.giorni.includes(i);
    setEditing({
      ...editing,
      giorni: has ? editing.giorni.filter((x) => x !== i) : [...editing.giorni, i].sort(),
    });
  };

  const formatGiorni = (giorni: number[]) => {
    if (giorni.length === 7) return 'Ogni giorno';
    if (giorni.length === 0) return 'Nessun giorno';
    return giorni.map((i) => GIORNI_LABEL[i]).join(' · ');
  };

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Ionicons name="star" size={18} color="#D4AF37" />
        <Text style={s.title}>FIERE RICORRENTI</Text>
        <Text style={s.count}>{fiere.filter(f => f.attiva).length}/{fiere.length}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
      </TouchableOpacity>

      {expanded && (
        <View style={s.body}>
          {fiere.length === 0 && (
            <Text style={s.emptyTxt}>
              Nessuna fiera ricorrente. Aggiungine una per Food Truck, Sagre, Festival.
            </Text>
          )}
          {fiere.map((f) => (
            <View key={f.id} style={s.row}>
              <Switch
                value={f.attiva}
                onValueChange={() => store.toggleFieraAttiva(f.id)}
                trackColor={{ false: '#D0C8C0', true: '#D4AF37' }}
                thumbColor="#FFF"
                style={{ transform: [{ scale: 0.7 }] }}
              />
              <TouchableOpacity style={{ flex: 1, paddingHorizontal: 6 }} onPress={() => startEdit(f)}>
                <Text style={[s.rowNome, !f.attiva && { textDecorationLine: 'line-through', color: '#B0A898' }]}>
                  {f.nome}
                </Text>
                <Text style={s.rowSub}>
                  {f.tipologia ? `${f.tipologia} · ` : ''}{f.luogo ? `${f.luogo} · ` : ''}{formatGiorni(f.giorni)}
                  {f.plateatico > 0 ? ` · €${f.plateatico}/g` : ''}
                  {f.km > 0 ? ` · ${f.km}km` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(f)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#D46A6A" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addBtn} onPress={startNew}>
            <Ionicons name="add" size={16} color="#1E7F85" />
            <Text style={s.addTxt}>Aggiungi Fiera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ MODALE EDIT ═══ */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <TouchableOpacity style={s.close} onPress={() => setEditVisible(false)}>
              <Ionicons name="close" size={22} color="#1A4040" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editing && fiere.some(f => f.id === editing.id) ? 'MODIFICA FIERA' : 'NUOVA FIERA'}</Text>
            {editing && (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <Text style={s.label}>Nome fiera *</Text>
                <TextInput
                  style={s.input}
                  placeholder="es. Festa del Pesce"
                  placeholderTextColor="#B0A898"
                  value={editing.nome}
                  onChangeText={(v) => setEditing({ ...editing, nome: v })}
                />

                <Text style={s.label}>Tipologia</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {TIPOLOGIE.map((tip) => {
                    const on = (editing.tipologia || 'Fiera') === tip;
                    return (
                      <TouchableOpacity
                        key={tip}
                        onPress={() => setEditing({ ...editing, tipologia: tip })}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 18,
                          backgroundColor: on ? '#D4AF37' : '#FFF',
                          borderWidth: 1,
                          borderColor: on ? '#D4AF37' : '#E8EDE8',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: on ? '#FFF' : '#5A7575' }}>{tip}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.label}>Luogo / Città</Text>
                <TextInput
                  style={s.input}
                  placeholder="es. Piazza Centrale, Roma"
                  placeholderTextColor="#B0A898"
                  value={editing.luogo}
                  onChangeText={(v) => setEditing({ ...editing, luogo: v })}
                />
                <Text style={s.label}>Giorni della settimana (ricorrente)</Text>
                <View style={s.daysRow}>
                  {GIORNI_LABEL.map((g, i) => {
                    const on = editing.giorni.includes(i);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.dayChip, on && s.dayChipOn]}
                        onPress={() => toggleGiorno(i)}
                      >
                        <Text style={[s.dayChipTxt, on && { color: '#FFF' }]}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.labelHint}>Oppure aggiungi date specifiche qui sotto ↓</Text>

                <Text style={s.label}>Date specifiche (one-shot)</Text>
                <MiniMonthCalendar
                  selectedDates={editing.dateSpecifiche || []}
                  onToggleDate={(iso) => {
                    const list = editing.dateSpecifiche || [];
                    const exists = list.includes(iso);
                    setEditing({
                      ...editing,
                      dateSpecifiche: exists ? list.filter((x) => x !== iso) : [...list, iso].sort(),
                    });
                  }}
                  themeColor="#D4AF37"
                />
                {(editing.dateSpecifiche || []).length > 0 && (
                  <Text style={{ fontSize: 10, color: '#8A6A1F', marginTop: 4 }}>
                    {(editing.dateSpecifiche || []).length} date selezionate
                  </Text>
                )}

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Dalle</Text>
                    <TextInput
                      style={s.input}
                      placeholder="18:00"
                      placeholderTextColor="#B0A898"
                      value={editing.orarioInizio || ''}
                      onChangeText={(v) => setEditing({ ...editing, orarioInizio: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Alle</Text>
                    <TextInput
                      style={s.input}
                      placeholder="23:30"
                      placeholderTextColor="#B0A898"
                      value={editing.orarioFine || ''}
                      onChangeText={(v) => setEditing({ ...editing, orarioFine: v })}
                    />
                  </View>
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Km andata/ritorno</Text>
                    <TextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor="#B0A898"
                      keyboardType="numeric"
                      value={editing.km > 0 ? String(editing.km) : ''}
                      onChangeText={(v) => setEditing({ ...editing, km: parseFloat(v.replace(',', '.')) || 0 })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Plateatico €/giorno</Text>
                    <TextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor="#B0A898"
                      keyboardType="decimal-pad"
                      value={editing.plateatico > 0 ? String(editing.plateatico) : ''}
                      onChangeText={(v) => setEditing({ ...editing, plateatico: parseFloat(v.replace(',', '.')) || 0 })}
                    />
                  </View>
                </View>

                <Text style={s.label}>Note (contatto, referente, ecc.)</Text>
                <TextInput
                  style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="es. Marco 333-123456 - pagamento fine serata"
                  placeholderTextColor="#B0A898"
                  multiline
                  value={editing.note || ''}
                  onChangeText={(v) => setEditing({ ...editing, note: v })}
                />

                <TouchableOpacity style={s.saveBtn} onPress={save}>
                  <Ionicons name="save" size={18} color="#FFF" />
                  <Text style={s.saveBtnTxt}>SALVA FIERA</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 12, fontWeight: '900', color: '#1A4040', letterSpacing: 1 },
  count: { fontSize: 11, fontWeight: '800', color: '#D4AF37', marginRight: 6 },
  body: { marginTop: 10, borderTopWidth: 1, borderColor: '#E8EDE8', paddingTop: 10 },
  emptyTxt: { fontSize: 11, color: '#7A9090', textAlign: 'center', fontStyle: 'italic', paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F0F4F0' },
  rowNome: { fontSize: 12, fontWeight: '800', color: '#1A4040' },
  rowSub: { fontSize: 10, color: '#7A9090', marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 10, backgroundColor: '#F5F0E6' },
  addTxt: { fontSize: 12, fontWeight: '700', color: '#1E7F85' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#F5F0E6', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  close: { position: 'absolute', top: 14, right: 14, padding: 4, zIndex: 10 },
  modalTitle: { fontSize: 15, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#5A7575', marginTop: 10, marginBottom: 4, letterSpacing: 0.5 },
  labelHint: { fontSize: 10, color: '#7A9090', fontStyle: 'italic', marginTop: 2, marginBottom: 4 },
  input: { backgroundColor: '#FFF', borderRadius: 10, padding: 10, fontSize: 13, color: '#1A4040', borderWidth: 1, borderColor: '#E8EDE8' },
  row2: { flexDirection: 'row', gap: 10 },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dayChip: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8EDE8' },
  dayChipOn: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  dayChipTxt: { fontSize: 11, fontWeight: '900', color: '#5A7575' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  saveBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
