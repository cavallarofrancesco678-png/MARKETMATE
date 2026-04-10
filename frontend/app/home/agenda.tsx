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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Appunto, Ordine } from '../../src/store/appStore';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/* ═══════════════════════════════════════════════════════
   MINI CALENDARIO RIUTILIZZABILE
   ═══════════════════════════════════════════════════════ */
interface MiniCalendarProps {
  title: string;
  titleIcon: string;
  titleColor: string;
  dotColor: string;
  displayMonth: Date;
  setDisplayMonth: (d: Date) => void;
  markedDays: { [day: number]: any[] };
  onDayPress: (day: number) => void;
}

const MiniCalendar = ({ title, titleIcon, titleColor, dotColor, displayMonth, setDisplayMonth, markedDays, onDayPress }: MiniCalendarProps) => {
  const today = new Date();
  const isCurrentMonth = displayMonth.getMonth() === today.getMonth() && displayMonth.getFullYear() === today.getFullYear();

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

  return (
    <View style={s.calSection}>
      {/* Header con titolo e navigazione mese */}
      <View style={s.calSectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={titleIcon as any} size={15} color={titleColor} />
          <Text style={[s.calSectionTitle, { color: titleColor }]}>{title}</Text>
        </View>
      </View>
      <View style={s.calHeader}>
        <TouchableOpacity onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={18} color={titleColor} />
        </TouchableOpacity>
        <Text style={s.calMonthTxt}>{MESI[displayMonth.getMonth()].toUpperCase()} {displayMonth.getFullYear()}</Text>
        <TouchableOpacity onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-forward" size={18} color={titleColor} />
        </TouchableOpacity>
      </View>

      {/* Giorni settimana */}
      <View style={s.calWeekRow}>
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={s.calWeekDay}>{d}</Text>)}
      </View>

      {/* Griglia */}
      {calendarGrid.map((row, ri) => (
        <View key={ri} style={s.calRow}>
          {row.map((day, di) => {
            const hasItem = day ? markedDays[day] && markedDays[day].length > 0 : false;
            const isToday = isCurrentMonth && day === today.getDate();
            return (
              <TouchableOpacity
                key={di}
                style={[s.calDay, hasItem && { backgroundColor: dotColor }, isToday && !hasItem && s.calDayToday]}
                disabled={!day}
                onPress={() => day && onDayPress(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  s.calDayTxt,
                  hasItem && { color: '#FFF', fontWeight: '800' },
                  isToday && !hasItem && { color: '#1E7F85', fontWeight: '800' },
                ]}>
                  {day || ''}
                </Text>
                {hasItem && <View style={[s.calDot, { backgroundColor: '#FFF' }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════
   SCHERMATA AGENDA
   ═══════════════════════════════════════════════════════ */
export default function AgendaScreen() {
  const {
    appuntiAgenda, addAppunto, removeAppunto,
    ordiniAgenda, addOrdine, removeOrdine,
    storicoDiario, addDiario, getDiarioForDate,
  } = useAppStore();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Note giornaliere
  const [diarioText, setDiarioText] = useState('');

  // Calendari separati
  const [appMonth, setAppMonth] = useState(new Date());
  const [ordMonth, setOrdMonth] = useState(new Date());

  // Modal
  const [modalType, setModalType] = useState<'appuntamento' | 'ordine' | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modalMonth, setModalMonth] = useState(new Date());
  const [modalText, setModalText] = useState('');

  // Carica diario di oggi
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

  /* ═══ APPUNTAMENTI DEL MESE ═══ */
  const appuntiMese = useMemo(() => {
    const map: { [day: number]: Appunto[] } = {};
    (appuntiAgenda || []).forEach(a => {
      const d = new Date(a.data);
      if (d.getMonth() === appMonth.getMonth() && d.getFullYear() === appMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(a);
      }
    });
    return map;
  }, [appuntiAgenda, appMonth]);

  /* ═══ ORDINI DEL MESE ═══ */
  const ordiniMese = useMemo(() => {
    const map: { [day: number]: Ordine[] } = {};
    (ordiniAgenda || []).forEach(o => {
      const d = new Date(o.data);
      if (d.getMonth() === ordMonth.getMonth() && d.getFullYear() === ordMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(o);
      }
    });
    return map;
  }, [ordiniAgenda, ordMonth]);

  /* ═══ APRI MODAL ═══ */
  const openAppModal = (day: number) => {
    setModalType('appuntamento');
    setSelectedDay(day);
    setModalMonth(appMonth);
    const existing = appuntiMese[day];
    setModalText(existing && existing.length > 0 ? existing[0].testo : '');
  };

  const openOrdModal = (day: number) => {
    setModalType('ordine');
    setSelectedDay(day);
    setModalMonth(ordMonth);
    const existing = ordiniMese[day];
    setModalText(existing && existing.length > 0 ? existing[0].testo : '');
  };

  /* ═══ SALVA ═══ */
  const handleSaveModal = () => {
    if (!selectedDay || !modalText.trim()) {
      if (Platform.OS === 'web') window.alert('Inserisci un testo');
      else Alert.alert('Errore', 'Inserisci un testo');
      return;
    }
    const newDate = new Date(modalMonth.getFullYear(), modalMonth.getMonth(), selectedDay, 12, 0, 0);

    if (modalType === 'appuntamento') {
      // Rimuovi esistente
      const existing = appuntiMese[selectedDay];
      if (existing && existing.length > 0) {
        removeAppunto(new Date(existing[0].data), existing[0].testo);
      }
      addAppunto({ data: newDate, testo: modalText.trim() });
    } else {
      // Ordine
      const existing = ordiniMese[selectedDay];
      if (existing && existing.length > 0) {
        removeOrdine(new Date(existing[0].data), existing[0].testo);
      }
      addOrdine({ data: newDate, testo: modalText.trim() });
    }

    setModalType(null);
    if (Platform.OS === 'web') window.alert('Salvato!');
    else Alert.alert('Salvato', modalType === 'appuntamento' ? 'Appuntamento aggiornato' : 'Ordine aggiornato');
  };

  /* ═══ ELIMINA ═══ */
  const handleDeleteModal = () => {
    if (!selectedDay) return;

    const doDelete = () => {
      if (modalType === 'appuntamento') {
        const existing = appuntiMese[selectedDay];
        if (existing && existing.length > 0) {
          removeAppunto(new Date(existing[0].data), existing[0].testo);
        }
      } else {
        const existing = ordiniMese[selectedDay];
        if (existing && existing.length > 0) {
          removeOrdine(new Date(existing[0].data), existing[0].testo);
        }
      }
      setModalType(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Eliminare?')) doDelete();
    } else {
      Alert.alert('Conferma', 'Eliminare?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const hasExistingItem = () => {
    if (!selectedDay) return false;
    if (modalType === 'appuntamento') return appuntiMese[selectedDay] && appuntiMese[selectedDay].length > 0;
    return ordiniMese[selectedDay] && ordiniMese[selectedDay].length > 0;
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.rootContent} showsVerticalScrollIndicator={false}>
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>APPUNTI E ORDINI</Text>

      {/* ═══ SEZIONE 1: NOTE DEL GIORNO ═══ */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="document-text" size={16} color="#1E7F85" />
          <Text style={s.sectionTitle}>NOTE DEL GIORNO</Text>
        </View>
        <TextInput
          style={s.notesInput}
          placeholder="Scrivi le tue note..."
          placeholderTextColor="#A0B5A8"
          value={diarioText}
          onChangeText={setDiarioText}
          onBlur={handleSaveDiario}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* ═══ SEZIONE 2: CALENDARIO APPUNTAMENTI ═══ */}
      <MiniCalendar
        title="APPUNTAMENTI"
        titleIcon="calendar"
        titleColor="#1E7F85"
        dotColor="#1E7F85"
        displayMonth={appMonth}
        setDisplayMonth={setAppMonth}
        markedDays={appuntiMese}
        onDayPress={openAppModal}
      />

      {/* Lista appuntamenti recenti */}
      {(appuntiAgenda || []).length > 0 && (
        <View style={s.recentList}>
          {(appuntiAgenda || []).slice(-3).reverse().map((a, i) => (
            <View key={`app-${i}`} style={s.recentItem}>
              <View style={[s.recentDot, { backgroundColor: '#1E7F85' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.recentDate}>{new Date(a.data).getDate()} {MESI[new Date(a.data).getMonth()]}</Text>
                <Text style={s.recentTxt} numberOfLines={1}>{a.testo}</Text>
              </View>
              <TouchableOpacity onPress={() => removeAppunto(new Date(a.data), a.testo)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#D46A6A" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ═══ SEZIONE 3: CALENDARIO ORDINI ═══ */}
      <MiniCalendar
        title="CONSEGNE ORDINI"
        titleIcon="cube"
        titleColor="#E8A060"
        dotColor="#E8A060"
        displayMonth={ordMonth}
        setDisplayMonth={setOrdMonth}
        markedDays={ordiniMese}
        onDayPress={openOrdModal}
      />

      {/* Lista ordini recenti */}
      {(ordiniAgenda || []).length > 0 && (
        <View style={s.recentList}>
          {(ordiniAgenda || []).slice(-3).reverse().map((o, i) => (
            <View key={`ord-${i}`} style={s.recentItem}>
              <View style={[s.recentDot, { backgroundColor: '#E8A060' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.recentDate}>{new Date(o.data).getDate()} {MESI[new Date(o.data).getMonth()]}</Text>
                <Text style={s.recentTxt} numberOfLines={1}>{o.testo}</Text>
              </View>
              <TouchableOpacity onPress={() => removeOrdine(new Date(o.data), o.testo)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#D46A6A" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />

      {/* ═══ MODAL GIORNO ═══ */}
      <Modal visible={modalType !== null} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setModalType(null)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <View style={s.modalTitleRow}>
              <Ionicons
                name={modalType === 'appuntamento' ? 'calendar' : 'cube'}
                size={20}
                color={modalType === 'appuntamento' ? '#1E7F85' : '#E8A060'}
              />
              <Text style={s.modalTitle}>
                {selectedDay} {MESI[modalMonth.getMonth()]}
              </Text>
            </View>
            <Text style={s.modalSubtitle}>
              {modalType === 'appuntamento' ? 'APPUNTAMENTO' : 'CONSEGNA ORDINE'}
            </Text>

            <TextInput
              style={[s.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder={modalType === 'appuntamento' ? 'Descrizione appuntamento...' : 'Descrizione ordine/consegna...'}
              placeholderTextColor="#A0B5A8"
              multiline
              value={modalText}
              onChangeText={setModalText}
            />

            <View style={s.modalBtns}>
              {hasExistingItem() && (
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} onPress={handleDeleteModal}>
                  <Ionicons name="trash" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#B0A898', flex: 1 }]} onPress={() => setModalType(null)}>
                <Text style={s.modalBtnTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: modalType === 'appuntamento' ? '#1E7F85' : '#E8A060', flex: 1 }]}
                onPress={handleSaveModal}
              >
                <Ionicons name="save" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 16,
  },
  rootContent: {
    paddingTop: 10,
    paddingBottom: 30,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Sezione note
  section: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
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
    minHeight: 60,
    textAlignVertical: 'top',
  },
  // Mini calendari
  calSection: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  calSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calMonthTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 0.5,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
  },
  calRow: {
    flexDirection: 'row',
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
    minHeight: 32,
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  calDayTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  // Lista recenti
  recentList: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3D5',
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recentDate: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
  },
  recentTxt: {
    fontSize: 12,
    color: '#1A4040',
    fontWeight: '600',
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
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    // @ts-ignore
    boxShadow: '0px 10px 30px rgba(0,0,0,0.25)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A4040',
  },
  modalSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A9090',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A4040',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
