/**
 * Round 73 — Modal "Aggiungi/Modifica Fattura" — INPUT DEDICATO
 *
 * Risolve il bug dove il form della giornata sovrascriveva l'importo
 * di una fattura precedente (1 solo input per fornitore per giorno).
 *
 * Apertura:
 *   - Da Stats (card FATTURE → pulsante "+ Aggiungi")
 *   - Da Agenda → Fatture tab (pulsante "+ Aggiungi")
 *   - Click su una fattura esistente → modifica
 *
 * Crea un record IMMUTABILE in `fattureLog` via addFattura/updateFattura.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, type Fattura } from '../store/appStore';
import { playSuccess, hapticTap } from '../utils/feedback';

interface Props {
  visible: boolean;
  fattura?: Fattura | null;  // se valorizzato → modalità modifica
  defaultFornitore?: string;  // pre-compila fornitore (es. da Agenda)
  onClose: () => void;
}

export const AddFatturaModal: React.FC<Props> = ({ visible, fattura, defaultFornitore, onClose }) => {
  const store = useAppStore();
  const fornitori = store.fornitori || [];
  const isEdit = !!fattura;

  const [fornitore, setFornitore] = useState('');
  const [showFornDrop, setShowFornDrop] = useState(false);
  const [numeroFattura, setNumeroFattura] = useState('');
  const [importo, setImporto] = useState('');
  const [dataEmissione, setDataEmissione] = useState('');  // YYYY-MM-DD
  const [periodoFrom, setPeriodoFrom] = useState('');
  const [periodoTo, setPeriodoTo] = useState('');
  const [scadenza, setScadenza] = useState('');
  const [modo, setModo] = useState<'fattura' | 'contanti' | 'misto'>('fattura');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (fattura) {
      setFornitore(fattura.fornitore || '');
      setNumeroFattura(fattura.numeroFattura.startsWith('_auto_') ? '' : fattura.numeroFattura);
      setImporto(String(fattura.importo || ''));
      setDataEmissione(fattura.dataEmissione || todayIso());
      setPeriodoFrom(fattura.periodoFrom || '');
      setPeriodoTo(fattura.periodoTo || '');
      setScadenza(fattura.scadenza || '');
      setModo(fattura.modoPagamento || 'fattura');
      setNote(fattura.note || '');
    } else {
      setFornitore(defaultFornitore || '');
      setNumeroFattura('');
      setImporto('');
      setDataEmissione(todayIso());
      setPeriodoFrom('');
      setPeriodoTo('');
      setScadenza('');
      setModo('fattura');
      setNote('');
    }
  }, [visible, fattura, defaultFornitore]);

  const handleSave = () => {
    const impNum = parseFloat(importo.replace(',', '.'));
    if (!fornitore.trim()) {
      showAlert('Inserisci il nome del fornitore');
      return;
    }
    if (!Number.isFinite(impNum) || impNum <= 0) {
      showAlert("L'importo deve essere maggiore di 0");
      return;
    }
    if (!dataEmissione || !/^\d{4}-\d{2}-\d{2}$/.test(dataEmissione)) {
      showAlert('Data emissione non valida (GG/MM/AAAA)');
      return;
    }
    try {
      if (isEdit && fattura) {
        (store as any).updateFattura?.(fattura.id, {
          fornitore: fornitore.trim(),
          numeroFattura: numeroFattura.trim() || `_auto_${dataEmissione}`,
          importo: impNum,
          modoPagamento: modo,
          dataEmissione,
          periodoFrom: periodoFrom || undefined,
          periodoTo: periodoTo || undefined,
          scadenza: scadenza || undefined,
          note: note || undefined,
        });
      } else {
        (store as any).addFattura?.({
          fornitore: fornitore.trim(),
          numeroFattura: numeroFattura.trim() || `_auto_${dataEmissione}_${Date.now()}`,
          importo: impNum,
          modoPagamento: modo,
          dataEmissione,
          periodoFrom: periodoFrom || undefined,
          periodoTo: periodoTo || undefined,
          scadenza: scadenza || undefined,
          note: note || undefined,
        });
      }
      try { playSuccess(); } catch { /* skip */ }
      onClose();
    } catch (e) {
      showAlert(`Errore: ${String(e).slice(0, 200)}`);
    }
  };

  const handleDelete = () => {
    if (!isEdit || !fattura) return;
    const doDelete = () => {
      (store as any).removeFattura?.(fattura.id);
      onClose();
    };
    const msg = `Vuoi davvero cancellare la fattura ${fattura.numeroFattura} di ${fattura.fornitore}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Conferma', msg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Cancella', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{isEdit ? '✏️ Modifica Fattura' : '📄 Aggiungi Fattura'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={24} color="#1A4040" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {/* Fornitore con dropdown */}
            <Text style={s.label}>Fornitore *</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={s.input}
                value={fornitore}
                onChangeText={(t) => { setFornitore(t); setShowFornDrop(t.length > 0); }}
                placeholder="es. Macelleria Rossi"
                placeholderTextColor="#9AAAAA"
                onFocus={() => setShowFornDrop(true)}
              />
              {showFornDrop && fornitori.length > 0 && (
                <View style={s.dropdown}>
                  {fornitori
                    .filter(f => !fornitore || f.nome.toLowerCase().includes(fornitore.toLowerCase()))
                    .slice(0, 6)
                    .map((f) => (
                      <TouchableOpacity
                        key={f.nome}
                        style={s.dropdownItem}
                        onPress={() => { setFornitore(f.nome); setShowFornDrop(false); }}
                      >
                        <Text style={s.dropdownText}>{f.nome}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>

            {/* Numero fattura */}
            <Text style={s.label}>Numero fattura</Text>
            <TextInput
              style={s.input}
              value={numeroFattura}
              onChangeText={setNumeroFattura}
              placeholder="es. 2026/0123 (lascia vuoto se senza numero)"
              placeholderTextColor="#9AAAAA"
              autoCapitalize="characters"
            />

            {/* Importo */}
            <Text style={s.label}>Importo (€) *</Text>
            <TextInput
              style={s.input}
              value={importo}
              onChangeText={setImporto}
              placeholder="es. 150,50"
              placeholderTextColor="#9AAAAA"
              keyboardType="decimal-pad"
            />

            {/* Data emissione */}
            <Text style={s.label}>Data emissione *</Text>
            <DateInput value={dataEmissione} onChange={setDataEmissione} />

            {/* Periodo riferimento (opzionale) */}
            <Text style={[s.label, { marginTop: 4 }]}>Periodo riferimento <Text style={{ color: '#9AAAAA', fontWeight: '500' }}>(opzionale)</Text></Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.miniLabel}>Dal</Text>
                <DateInput value={periodoFrom} onChange={setPeriodoFrom} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.miniLabel}>Al</Text>
                <DateInput value={periodoTo} onChange={setPeriodoTo} />
              </View>
            </View>

            {/* Scadenza pagamento */}
            <Text style={s.label}>Scadenza pagamento <Text style={{ color: '#9AAAAA', fontWeight: '500' }}>(opzionale)</Text></Text>
            <DateInput value={scadenza} onChange={setScadenza} />

            {/* Modo pagamento */}
            <Text style={s.label}>Modo pagamento</Text>
            <View style={s.modeRow}>
              {(['fattura', 'contanti', 'misto'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.modeBtn, modo === m && s.modeBtnActive]}
                  onPress={() => { setModo(m); hapticTap(); }}
                >
                  <Text style={[s.modeTxt, modo === m && s.modeTxtActive]}>{labelModo(m)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note */}
            <Text style={s.label}>Note <Text style={{ color: '#9AAAAA', fontWeight: '500' }}>(opzionale)</Text></Text>
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={note}
              onChangeText={setNote}
              placeholder="es. fornitura merce settimanale"
              placeholderTextColor="#9AAAAA"
              multiline
            />
          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            {isEdit && (
              <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash" size={16} color="#FFF" />
                <Text style={s.deleteTxt}>Cancella</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, isEdit && { flex: 1 }]} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={s.saveTxt}>{isEdit ? 'Salva modifiche' : 'Salva fattura'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Sub-component: DateInput (compatibile web + native) ───
const DateInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore — input HTML su web
      <input
        type="date"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        style={{
          padding: 10, borderRadius: 8, border: '1px solid #C5CFCF',
          fontSize: 14, color: '#1A4040', backgroundColor: '#FBF8F0',
          marginBottom: 10, fontFamily: 'inherit',
        }}
      />
    );
  }
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChange}
      placeholder="AAAA-MM-GG"
      placeholderTextColor="#9AAAAA"
    />
  );
};

// ─── Helpers ───
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const labelModo = (m: 'fattura' | 'contanti' | 'misto') => {
  if (m === 'fattura') return '📄 Fattura';
  if (m === 'contanti') return '💵 Contanti';
  return '🔀 Misto';
};

const showAlert = (msg: string) => {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('Attenzione', msg);
};

// ─── Styles ───
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FBF8F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE2D0',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A4040',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3F5A5A',
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7A8585',
    marginBottom: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#C5CFCF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 9,
    fontSize: 14,
    color: '#1A4040',
    backgroundColor: '#FFF',
    marginBottom: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C5CFCF',
    borderRadius: 8,
    zIndex: 999,
    maxHeight: 160,
    // @ts-ignore
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE2D0',
  },
  dropdownText: {
    fontSize: 13,
    color: '#1A4040',
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#C5CFCF',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: '#E89B4A',
    backgroundColor: '#FBEEDB',
  },
  modeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A8585',
  },
  modeTxtActive: {
    color: '#A56A1F',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAE2D0',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E7F85',
  },
  saveTxt: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#D46A6A',
  },
  deleteTxt: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
