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
const TIPOLOGIE_UI: Array<{ value: TipologiaEvento; label: string; color: string }> = [
  { value: 'Fiera', label: 'FIERA', color: '#D4AF37' },
  { value: 'Sagra', label: 'SAGRA', color: '#9B59B6' },
  { value: 'Evento Speciale', label: 'EVENTO', color: '#16A085' },
];

function genId() {
  return `f_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export const FiereRicorrentiSection: React.FC = () => {
  const store = useAppStore();
  const fiere = store.fiere || [];
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const [expanded, setExpanded] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<Fiera | null>(null);
  const [calculatingKm, setCalculatingKm] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const TIPOLOGIA_COLOR: Record<string, string> = {
    'Fiera': '#D4AF37',
    'Sagra': '#9B59B6',
    'Festa Patronale': '#C0392B',
    'Evento Speciale': '#16A085',
  };
  const getTipCol = (t?: string) => TIPOLOGIA_COLOR[t || 'Fiera'] || '#D4AF37';

  // Compute fiere dates for CURRENT SOLAR MONTH (indipendente da viewMonth del calendario)
  const fiereDelMeseList = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const list: { giorno: number; iso: string; fiera: Fiera }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(y, m, d);
      const dow = (date.getDay() + 6) % 7;
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      fiere.forEach((f) => {
        if (!f.attiva) return;
        const match = f.giorni?.includes(dow) || (f.dateSpecifiche || []).includes(iso);
        if (match) list.push({ giorno: d, iso, fiera: f });
      });
    }
    return list.sort((a, b) => a.giorno - b.giorno);
  }, [fiere]);

  const highlightedIsos = React.useMemo(() => fiereDelMeseList.map((x) => x.iso), [fiereDelMeseList]);

  // Auto-calcola km A/R usando l'API distance (come i mercati)
  const autoCalcKm = async (luogo: string) => {
    const partenza = store.partenzaDa;
    if (!partenza || !luogo || luogo.trim().length < 2) return;
    setCalculatingKm(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/distance/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partenza, destinazione: luogo }),
      });
      const data = await res.json();
      if (data.success && data.km_andata_ritorno > 0) {
        setEditing((prev) => prev ? { ...prev, km: data.km_andata_ritorno } : prev);
      }
    } catch {}
    setCalculatingKm(false);
  };

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
      dateSpecifiche: [],
    });
    setEditVisible(true);
  };

  const startNewForDate = (iso: string) => {
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
      dateSpecifiche: [iso],
    });
    setEditVisible(true);
  };

  const startEdit = (f: Fiera) => {
    // Migrazione: mappa "Festa Patronale" su "Evento Speciale"
    const migrated = f.tipologia === 'Festa Patronale' ? { ...f, tipologia: 'Evento Speciale' as TipologiaEvento } : { ...f };
    setEditing(migrated);
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
        <Text style={s.title}>EVENTI E FIERE</Text>
        <Text style={s.count}>{fiere.filter(f => f.attiva).length}/{fiere.length}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
      </TouchableOpacity>

      {expanded && (
        <View style={s.body}>
          {/* CALENDARIO INLINE — click data per registrare */}
          <MiniMonthCalendar
            selectedDates={[]}
            highlightedDates={highlightedIsos}
            onToggleDate={(iso) => {
              // Se la data ha già una fiera, apri la prima per modifica
              const existing = fiereDelMeseList.find((x) => x.iso === iso);
              if (existing) {
                startEdit(existing.fiera);
              } else {
                startNewForDate(iso);
              }
            }}
            themeColor="#D4AF37"
          />
          <Text style={{ fontSize: 10, color: '#7A9090', textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
            Tocca una data per aggiungere/modificare una fiera
          </Text>

          {/* LISTA FIERE DEL MESE VISUALIZZATO */}
          <View style={{ marginTop: 12, backgroundColor: '#F8F2E0', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#8A6A1F', letterSpacing: 1, marginBottom: 6 }}>
              FIERE DI QUESTO MESE ({fiereDelMeseList.length})
            </Text>
            {fiereDelMeseList.length === 0 ? (
              <Text style={{ fontSize: 10, color: '#7A9090', fontStyle: 'italic' }}>
                Nessuna fiera registrata per questo mese
              </Text>
            ) : (
              fiereDelMeseList.map((x, i) => (
                <TouchableOpacity
                  key={`${x.iso}_${x.fiera.id}_${i}`}
                  onPress={() => startEdit(x.fiera)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: i === fiereDelMeseList.length - 1 ? 0 : 1, borderColor: '#EFE4C8' }}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: getTipCol(x.fiera.tipologia) }}>{x.giorno}</Text>
                  </View>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getTipCol(x.fiera.tipologia), marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A4040' }}>{x.fiera.nome}</Text>
                    {(x.fiera.luogo || x.fiera.tipologia) ? (
                      <Text style={{ fontSize: 10, color: '#7A9090' }}>
                        {x.fiera.tipologia || 'Fiera'}{x.fiera.luogo ? ` · ${x.fiera.luogo}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* GESTIONE COMPLETA (lista totale fiere attivabili) */}
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#5A7575', marginTop: 12, marginBottom: 6, letterSpacing: 0.5 }}>
            TUTTE LE FIERE ({fiere.length})
          </Text>
          {fiere.length === 0 && (
            <Text style={s.emptyTxt}>
              Nessuna fiera. Tocca il calendario sopra o usa il pulsante + per aggiungerne.
            </Text>
          )}
          {fiere.map((f) => (
            <View key={f.id} style={s.row}>
              <Switch
                value={f.attiva}
                onValueChange={() => store.toggleFieraAttiva(f.id)}
                trackColor={{ false: '#D0C8C0', true: getTipCol(f.tipologia) }}
                thumbColor="#FFF"
                style={{ transform: [{ scale: 0.7 }] }}
              />
              <TouchableOpacity style={{ flex: 1, paddingHorizontal: 6 }} onPress={() => startEdit(f)}>
                <Text style={[s.rowNome, !f.attiva && { textDecorationLine: 'line-through', color: '#B0A898' }]}>
                  {f.nome}
                </Text>
                <Text style={s.rowSub}>
                  {f.tipologia ? `${f.tipologia} · ` : ''}{f.luogo ? `${f.luogo} · ` : ''}{(f.dateSpecifiche || []).length} date
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

      {/* ═══ MODALE INFO FIERA ═══ */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <TouchableOpacity style={s.close} onPress={() => setEditVisible(false)}>
              <Ionicons name="close" size={22} color="#1A4040" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>INFO FIERA</Text>
            {editing && (
              <View style={{ paddingBottom: 8 }}>
                {/* Nome */}
                <TextInput
                  style={[s.input, { fontWeight: '800', fontSize: 14 }]}
                  placeholder="Nome fiera *"
                  placeholderTextColor="#B0A898"
                  value={editing.nome}
                  onChangeText={(v) => setEditing({ ...editing, nome: v })}
                />

                {/* 3 Tag tipologia (senza label) */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {TIPOLOGIE_UI.map((tip) => {
                    // Migrazione: se la fiera era "Festa Patronale", mappala su "Evento Speciale"
                    const currentTip = editing.tipologia === 'Festa Patronale' ? 'Evento Speciale' : (editing.tipologia || 'Fiera');
                    const on = currentTip === tip.value;
                    return (
                      <TouchableOpacity
                        key={tip.value}
                        onPress={() => setEditing({ ...editing, tipologia: tip.value })}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: 10,
                          backgroundColor: on ? tip.color : '#FFF',
                          borderWidth: 1.5,
                          borderColor: on ? tip.color : '#E0D8CC',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '900', color: on ? '#FFF' : tip.color, letterSpacing: 0.8 }}>
                          {tip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Luogo */}
                <TextInput
                  style={[s.input, { marginTop: 8 }]}
                  placeholder="Luogo / Città"
                  placeholderTextColor="#B0A898"
                  value={editing.luogo}
                  onChangeText={(v) => setEditing({ ...editing, luogo: v })}
                  onBlur={() => autoCalcKm(editing.luogo)}
                  returnKeyType="done"
                />

                {/* Data Evento con DatePicker (MiniMonthCalendar) */}
                <Text style={[s.label, { marginTop: 8 }]}>Data evento</Text>
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
                  themeColor={TIPOLOGIE_UI.find(t => t.value === (editing.tipologia === 'Festa Patronale' ? 'Evento Speciale' : (editing.tipologia || 'Fiera')))?.color || '#D4AF37'}
                />

                {/* Riga inline: Dalle | Alle | Km A/R | Plateatico */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Dalle</Text>
                    <TextInput
                      style={s.miniInput}
                      placeholder="18:00"
                      placeholderTextColor="#B0A898"
                      value={editing.orarioInizio || ''}
                      onChangeText={(v) => setEditing({ ...editing, orarioInizio: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Alle</Text>
                    <TextInput
                      style={s.miniInput}
                      placeholder="23:30"
                      placeholderTextColor="#B0A898"
                      value={editing.orarioFine || ''}
                      onChangeText={(v) => setEditing({ ...editing, orarioFine: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Km A/R</Text>
                    <TextInput
                      style={s.miniInput}
                      placeholder="0"
                      placeholderTextColor="#B0A898"
                      keyboardType="numeric"
                      value={editing.km > 0 ? String(editing.km) : ''}
                      onChangeText={(v) => setEditing({ ...editing, km: parseFloat(v.replace(',', '.')) || 0 })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Plat. €</Text>
                    <TextInput
                      style={s.miniInput}
                      placeholder="0"
                      placeholderTextColor="#B0A898"
                      keyboardType="decimal-pad"
                      value={editing.plateatico > 0 ? String(editing.plateatico) : ''}
                      onChangeText={(v) => setEditing({ ...editing, plateatico: parseFloat(v.replace(',', '.')) || 0 })}
                    />
                  </View>
                </View>

                {/* Note */}
                <TextInput
                  style={[s.input, { height: 48, textAlignVertical: 'top', marginTop: 8, fontSize: 12 }]}
                  placeholder="Note (contatto, referente, ecc.)"
                  placeholderTextColor="#B0A898"
                  multiline
                  value={editing.note || ''}
                  onChangeText={(v) => setEditing({ ...editing, note: v })}
                />

                {/* Grafico storico ultimi 4 anni */}
                <FieraHistoryChart
                  fieraNome={editing.nome}
                  storicoGiornate={store.storicoGiornate || []}
                  themeColor={TIPOLOGIE_UI.find(t => t.value === (editing.tipologia === 'Festa Patronale' ? 'Evento Speciale' : (editing.tipologia || 'Fiera')))?.color || '#D4AF37'}
                />

                <TouchableOpacity style={s.saveBtn} onPress={save}>
                  <Ionicons name="save" size={18} color="#FFF" />
                  <Text style={s.saveBtnTxt}>SALVA</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

/* ═══ GRAFICO STORICO 4 ANNI ═══ */
const FieraHistoryChart: React.FC<{ fieraNome: string; storicoGiornate: any[]; themeColor: string }> = ({ fieraNome, storicoGiornate, themeColor }) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  const data = React.useMemo(() => {
    return years.map((y) => {
      const lordo = (storicoGiornate || [])
        .filter((g) => {
          if (!g.mercato || !fieraNome) return false;
          const d = new Date(g.data);
          if (d.getFullYear() !== y) return false;
          return (g.mercato || '').toLowerCase().includes(fieraNome.toLowerCase());
        })
        .reduce((s: number, g: any) => s + (g.lordo || 0), 0);
      return { anno: y, lordo: Math.round(lordo) };
    });
  }, [fieraNome, storicoGiornate]);

  const max = Math.max(1, ...data.map((d) => d.lordo));
  const hasAnyData = data.some((d) => d.lordo > 0);

  return (
    <View style={{ marginTop: 10, backgroundColor: '#FFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E8EDE8' }}>
      <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 0.8, marginBottom: 6 }}>
        STORICO ULTIMI 4 ANNI
      </Text>
      {!hasAnyData ? (
        <Text style={{ fontSize: 10, color: '#7A9090', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' }}>
          Nessun dato storico disponibile
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 8, paddingHorizontal: 4 }}>
          {data.map((d, i) => {
            const h = d.lordo > 0 ? Math.max(3, (d.lordo / max) * 54) : 2;
            const isCurrent = d.anno === currentYear;
            const col = isCurrent ? '#E8A060' : themeColor;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, fontWeight: '800', color: '#1A4040', marginBottom: 2 }}>
                  €{d.lordo}
                </Text>
                <View style={{
                  width: '70%',
                  height: h,
                  backgroundColor: col,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  opacity: d.lordo > 0 ? 1 : 0.3,
                }} />
                <Text style={{ fontSize: 9, fontWeight: isCurrent ? '900' : '700', color: isCurrent ? '#E8A060' : '#5A7575', marginTop: 3 }}>
                  {d.anno}
                </Text>
              </View>
            );
          })}
        </View>
      )}
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
  miniLabel: { fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2, letterSpacing: 0.3, textAlign: 'center' },
  miniInput: { backgroundColor: '#FFF', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 4, fontSize: 12, color: '#1A4040', borderWidth: 1, borderColor: '#E8EDE8', textAlign: 'center' },
  row2: { flexDirection: 'row', gap: 10 },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dayChip: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8EDE8' },
  dayChipOn: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  dayChipTxt: { fontSize: 11, fontWeight: '900', color: '#5A7575' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  saveBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
