import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Appunto } from '../../src/store/appStore';
import { useTranslation } from 'react-i18next';
import { getMonthNames } from '../../src/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function AgendaScreen() {
  const { appuntiAgenda, addAppunto, removeAppunto, storicoDiario, addDiario, getDiarioForDate } = useAppStore();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [diarioText, setDiarioText] = useState('');
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [newAppuntoText, setNewAppuntoText] = useState('');
  const [orderText, setOrderText] = useState('');

  const contentH = height - insets.bottom - 70;

  // Load diary per oggi
  React.useEffect(() => {
    const today = new Date();
    const existing = getDiarioForDate(today);
    setDiarioText(existing ? existing.testo : '');
  }, []);

  const handleSaveDiario = () => {
    if (diarioText.trim()) {
      addDiario({ data: new Date(), testo: diarioText.trim() });
    }
  };

  const handleAddOrder = () => {
    if (!orderText.trim()) {
      if (Platform.OS === 'web') window.alert('Inserisci un testo');
      else Alert.alert('Errore', 'Inserisci un testo');
      return;
    }
    addAppunto({ data: new Date(), testo: orderText.trim() });
    setOrderText('');
    if (Platform.OS === 'web') window.alert('Appuntamento salvato!');
    else Alert.alert('Salvato', 'Appuntamento aggiunto');
  };

  /* ═══ APPUNTAMENTI DEL MESE ═══ */
  const appuntiMese = useMemo(() => {
    const map: { [day: number]: Appunto[] } = {};
    appuntiAgenda.forEach(a => {
      const d = new Date(a.data);
      if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(a);
      }
    });
    return map;
  }, [appuntiAgenda, displayMonth]);

  const handleDayPress = (day: number) => {
    setSelectedDay(day);
    const apps = appuntiMese[day];
    if (apps && apps.length > 0) {
      setNewAppuntoText(apps[0].testo);
    } else {
      setNewAppuntoText('');
    }
    setShowDayModal(true);
  };

  const handleSaveAppunto = () => {
    if (!selectedDay) return;
    if (!newAppuntoText.trim()) {
      if (Platform.OS === 'web') window.alert('Inserisci un testo');
      else Alert.alert('Errore', 'Inserisci un testo');
      return;
    }
    // Rimuovi esistente se c'è
    const existing = appuntiMese[selectedDay];
    if (existing && existing.length > 0) {
      removeAppunto(new Date(existing[0].data), existing[0].testo);
    }
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), selectedDay);
    addAppunto({ data: newDate, testo: newAppuntoText.trim() });
    setShowDayModal(false);
    if (Platform.OS === 'web') window.alert('Salvato!');
    else Alert.alert('Salvato', 'Appuntamento aggiornato');
  };

  const handleDeleteAppunto = () => {
    if (!selectedDay) return;
    const existing = appuntiMese[selectedDay];
    if (existing && existing.length > 0) {
      if (Platform.OS === 'web') {
        if (window.confirm('Eliminare questo appuntamento?')) {
          removeAppunto(new Date(existing[0].data), existing[0].testo);
          setShowDayModal(false);
        }
      } else {
        Alert.alert('Conferma', 'Eliminare questo appuntamento?', [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina', style: 'destructive', onPress: () => {
            removeAppunto(new Date(existing[0].data), existing[0].testo);
            setShowDayModal(false);
          }}
        ]);
      }
    } else {
      setShowDayModal(false);
    }
  };

  /* ═══ GRIGLIA CALENDARIO ═══ */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const lastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [displayMonth]);

  const today = new Date();
  const isCurrentMonth = displayMonth.getMonth() === today.getMonth() && displayMonth.getFullYear() === today.getFullYear();

  return (
    <View style={[s.root, { height: contentH }]}>
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>APPUNTI E ORDINI</Text>

      {/* ═══ SEZIONE 1: APPUNTI DEL GIORNO ═══ */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="document-text" size={16} color="#1E7F85" />
          <Text style={s.sectionTitle}>APPUNTI DEL GIORNO</Text>
        </View>
        <TextInput
          style={s.notesInput}
          placeholder="Scrivi gli appunti della giornata..."
          placeholderTextColor="#A0B5A8"
          value={diarioText}
          onChangeText={setDiarioText}
          onBlur={handleSaveDiario}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* ═══ SEZIONE 2: ORDINI/APPUNTAMENTI ═══ */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="clipboard" size={16} color="#E8A060" />
          <Text style={s.sectionTitle}>ORDINI / APPUNTAMENTI</Text>
        </View>
        <View style={s.orderRow}>
          <TextInput
            style={s.orderInput}
            placeholder="Nuovo ordine o appuntamento..."
            placeholderTextColor="#A0B5A8"
            value={orderText}
            onChangeText={setOrderText}
          />
          <TouchableOpacity style={s.addOrderBtn} onPress={handleAddOrder}>
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        {/* Lista ultimi appuntamenti */}
        {appuntiAgenda.slice(-3).reverse().map((a, i) => (
          <View key={i} style={s.orderItem}>
            <Ionicons name="ellipse" size={8} color="#E8A060" />
            <Text style={s.orderItemTxt} numberOfLines={1}>{a.testo}</Text>
            <TouchableOpacity onPress={() => removeAppunto(new Date(a.data), a.testo)}>
              <Ionicons name="close-circle" size={16} color="#D46A6A" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* ═══ SEZIONE 3: CALENDARIO ═══ */}
      <View style={[s.section, { flex: 1 }]}>
        <View style={s.calHeader}>
          <TouchableOpacity onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))}>
            <Ionicons name="chevron-back" size={20} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{MESI[displayMonth.getMonth()].toUpperCase()} {displayMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))}>
            <Ionicons name="chevron-forward" size={20} color="#1E7F85" />
          </TouchableOpacity>
        </View>
        
        <View style={s.calWeekRow}>
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={s.calWeekDay}>{d}</Text>)}
        </View>
        
        <View style={{ flex: 1 }}>
          {calendarGrid.map((row, ri) => (
            <View key={ri} style={s.calRow}>
              {row.map((day, di) => {
                const hasApp = day && appuntiMese[day];
                const isToday = isCurrentMonth && day === today.getDate();
                return (
                  <TouchableOpacity
                    key={di}
                    style={[s.calDay, hasApp && s.calDayActive, isToday && s.calDayToday]}
                    disabled={!day}
                    onPress={() => day && handleDayPress(day)}
                  >
                    <Text style={[s.calDayTxt, hasApp && { color: '#FFF', fontWeight: '800' }, isToday && !hasApp && { color: '#1E7F85' }]}>
                      {day || ''}
                    </Text>
                    {hasApp && <View style={s.calDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* ═══ MODAL GIORNO ═══ */}
      <Modal visible={showDayModal} transparent animationType="fade" onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowDayModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>{selectedDay} {MESI[displayMonth.getMonth()]}</Text>
            
            <View style={s.modalField}>
              <Text style={s.modalLabel}>APPUNTAMENTO / NOTA</Text>
              <TextInput
                style={[s.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Descrizione..."
                placeholderTextColor="#A0B5A8"
                multiline
                value={newAppuntoText}
                onChangeText={setNewAppuntoText}
              />
            </View>
            
            <View style={s.modalBtns}>
              {appuntiMese[selectedDay!] && (
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} onPress={handleDeleteAppunto}>
                  <Ionicons name="trash" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#B0A898', flex: 1 }]} onPress={() => setShowDayModal(false)}>
                <Text style={s.modalBtnTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#1E7F85', flex: 1 }]} onPress={handleSaveAppunto}>
                <Ionicons name="save" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 0.5,
  },
  notesInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#1A4040',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  // Ordini
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderInput: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A4040',
  },
  addOrderBtn: {
    backgroundColor: '#E8A060',
    borderRadius: 10,
    padding: 10,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE0',
  },
  orderItemTxt: {
    flex: 1,
    fontSize: 12,
    color: '#5A7575',
  },
  // Calendario
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  calMonthTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 0.5,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9090',
  },
  calRow: {
    flexDirection: 'row',
    flex: 1,
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
    minHeight: 32,
  },
  calDayActive: {
    backgroundColor: '#E8A060',
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  calDayTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A4040',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9090',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A4040',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
