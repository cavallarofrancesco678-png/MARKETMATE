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
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI_SETT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export default function AgendaScreen() {
  const { t } = useTranslation();
  const {
    appuntiAgenda, addAppunto, removeAppunto,
    ordiniAgenda, addOrdine, removeOrdine,
    storicoDiario, addDiario, getDiarioForDate,
  } = useAppStore();
  const store = useAppStore();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const TAB_BAR = 70 + Math.max(insets.bottom, 10);
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : insets.top + 16;
  const contentH = screenH - TAB_BAR - topPad;

  // ═══ ORDINI E APPUNTAMENTI ═══
  const [orderText, setOrderText] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  
  // ═══ MODAL GIORNO (edit/delete) ═══
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalText, setDayModalText] = useState('');
  const [dayModalType, setDayModalType] = useState<'new' | 'edit'>('new');

  // ═══ NOTE DEL GIORNO ═══
  const [noteText, setNoteText] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  // Carica nota di oggi
  React.useEffect(() => {
    const today = new Date();
    const existing = getDiarioForDate(today);
    setNoteText(existing ? existing.testo : '');
  }, []);

  /* ═══ ORDINI + APPUNTAMENTI DEL MESE ═══ */
  const impegniMese = useMemo(() => {
    const map: { [day: number]: { testo: string; tipo: string }[] } = {};
    (appuntiAgenda || []).forEach(a => {
      const d = new Date(a.data);
      if (d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ testo: a.testo, tipo: 'appuntamento' });
      }
    });
    (ordiniAgenda || []).forEach(o => {
      const d = new Date(o.data);
      if (d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ testo: o.testo, tipo: 'ordine' });
      }
    });
    return map;
  }, [appuntiAgenda, ordiniAgenda, calMonth]);

  /* ═══ CALENDARIO GRID ═══ */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [calMonth]);

  /* ═══ ARCHIVIO NOTE ═══ */
  const noteArchive = useMemo(() => {
    return (storicoDiario || [])
      .map(d => ({ ...d, data: new Date(d.data) }))
      .sort((a, b) => b.data.getTime() - a.data.getTime())
      .slice(0, 15);
  }, [storicoDiario]);

  const today = new Date();
  const isCurrentMonth = calMonth.getMonth() === today.getMonth() && calMonth.getFullYear() === today.getFullYear();

  /* ═══ SALVA ORDINE SU GIORNO ═══ */
  const handleSaveOrder = (day: number) => {
    const text = dayModalType === 'new' ? orderText.trim() : dayModalText.trim();
    if (!text) {
      if (Platform.OS === 'web') window.alert(t('agenda.enterDetail') || 'Inserisci il dettaglio');
      else Alert.alert(t('common.error') || 'Errore', t('agenda.enterDetail') || 'Inserisci il dettaglio');
      return;
    }
    const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), day, 12, 0, 0);
    addAppunto({ data: newDate, testo: text });
    if (dayModalType === 'new') {
      setOrderText('');
      setShowCalendar(false);
    } else {
      setShowDayModal(false);
    }
  };

  /* ═══ CLICK SU GIORNO CALENDARIO ═══ */
  const handleDayPress = (day: number) => {
    const existing = impegniMese[day];
    if (existing && existing.length > 0) {
      // Giorno con impegno → apri modal per modificare/cancellare
      setSelectedDay(day);
      setDayModalText(existing[0].testo);
      setDayModalType('edit');
      setShowDayModal(true);
    } else if (showCalendar && orderText.trim()) {
      // Salva nuovo ordine su questo giorno
      handleSaveOrder(day);
    } else {
      // Apri il giorno per un nuovo impegno
      setSelectedDay(day);
      setDayModalText('');
      setDayModalType('new');
      setShowDayModal(true);
    }
  };

  /* ═══ ELIMINA IMPEGNO ═══ */
  const handleDeleteImpegno = () => {
    if (!selectedDay) return;
    const existing = impegniMese[selectedDay];
    if (existing && existing.length > 0) {
      const item = existing[0];
      const dDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay, 12, 0, 0);
      if (item.tipo === 'appuntamento') {
        removeAppunto(dDate, item.testo);
      } else {
        removeOrdine(dDate, item.testo);
      }
      setShowDayModal(false);
    }
  };

  /* ═══ MODIFICA IMPEGNO ═══ */
  const handleEditImpegno = () => {
    if (!selectedDay || !dayModalText.trim()) return;
    const existing = impegniMese[selectedDay];
    const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay, 12, 0, 0);
    // Rimuovi esistente
    if (existing && existing.length > 0) {
      if (existing[0].tipo === 'appuntamento') {
        removeAppunto(newDate, existing[0].testo);
      } else {
        removeOrdine(newDate, existing[0].testo);
      }
    }
    // Aggiungi nuovo
    addAppunto({ data: newDate, testo: dayModalText.trim() });
    setShowDayModal(false);
  };

  /* ═══ SALVA NOTA ═══ */
  const handleSaveNote = () => {
    if (noteText.trim()) {
      addDiario({ data: new Date(), testo: noteText.trim() });
      if (Platform.OS === 'web') window.alert(t('agenda.noteSaved') || 'Nota salvata!');
      else playSuccess(); // Conferma sonora, nessun popup
    }
  };

  return (
    <View style={[s.root, { height: contentH, paddingTop: topPad }]}>
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>{t('agenda.ordersAndAppointments') || 'ORDINI E APPUNTAMENTI'}</Text>

      {/* ═══ SEZIONE ORDINI ═══ */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="calendar-outline" size={15} color="#1E7F85" />
          <Text style={s.cardHeaderTxt}>{t('agenda.commitmentDetails') || 'DETTAGLI IMPEGNO'}</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#7A9090', fontWeight: '700', marginTop: 4 }}>
          Appunto per il giorno:
        </Text>
      </View>

      {/* ═══ CALENDARIO (sempre visibile) ═══ */}
      <View style={s.calCard}>
        {/* Nav mese */}
        <View style={s.calNav}>
          <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={18} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{MESI[calMonth.getMonth()].toUpperCase()} {calMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={18} color="#1E7F85" />
          </TouchableOpacity>
        </View>

        {/* Giorni settimana */}
        <View style={s.calWeekRow}>
          {GIORNI_SETT.map((g, i) => <Text key={i} style={s.calWeekTxt}>{g}</Text>)}
        </View>

        {/* Griglia */}
        {calendarGrid.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const hasItem = day ? impegniMese[day] && impegniMese[day].length > 0 : false;
              const isToday = isCurrentMonth && day === today.getDate();
              const itemTypes = day && impegniMese[day] ? impegniMese[day].map(x => x.tipo) : [];
              const hasApp = itemTypes.includes('appuntamento');
              const hasOrd = itemTypes.includes('ordine');
              const bgColor = hasApp && hasOrd ? '#1A4040' : hasOrd ? '#E8A060' : hasApp ? '#1E7F85' : 'transparent';
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    s.calDay,
                    hasItem && { backgroundColor: bgColor },
                    isToday && !hasItem && s.calDayToday,
                  ]}
                  disabled={!day}
                  onPress={() => day && handleDayPress(day)}
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

      {/* ═══ NOTE DEL GIORNO ═══ */}
      <View style={[s.card, { flex: 1 }]}>
        <View style={s.cardHeader}>
          <Ionicons name="document-text" size={15} color="#E8A060" />
          <Text style={[s.cardHeaderTxt, { color: '#E8A060' }]}>NOTE DEL GIORNO</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleSaveNote} style={s.noteSaveBtn}>
            <Ionicons name="save" size={14} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>SALVA</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={s.noteInput}
          placeholder="Scrivi le tue note del giorno..."
          placeholderTextColor="#B0A898"
          value={noteText}
          onChangeText={setNoteText}
          multiline
        />
        {/* Archivio a tendina */}
        <TouchableOpacity
          style={s.archiveToggle}
          onPress={() => setShowArchive(!showArchive)}
          activeOpacity={0.8}
        >
          <Ionicons name="archive" size={14} color="#7A9090" />
          <Text style={s.archiveToggleTxt}>{t('agenda.noteArchive') || 'ARCHIVIO NOTE'}</Text>
          <Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={14} color="#7A9090" />
        </TouchableOpacity>
        {showArchive && (
          <View style={s.archiveList}>
            {noteArchive.length === 0 ? (
              <Text style={s.archiveEmpty}>Nessuna nota salvata</Text>
            ) : (
              noteArchive.map((n, i) => (
                <View key={i} style={s.archiveItem}>
                  <Text style={s.archiveDate}>
                    {n.data.getDate()} {MESI[n.data.getMonth()].substring(0, 3)}
                  </Text>
                  <Text style={s.archiveTxt} numberOfLines={2}>{n.testo}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* ═══ MODAL GIORNO (Modifica/Cancella) ═══ */}
      <Modal visible={showDayModal} transparent animationType="fade" onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowDayModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <View style={s.modalTitleRow}>
              <Ionicons name="calendar" size={20} color="#1E7F85" />
              <Text style={s.modalTitle}>
                {selectedDay} {MESI[calMonth.getMonth()]}
              </Text>
            </View>

            {dayModalType === 'edit' && impegniMese[selectedDay!] ? (
              <Text style={s.modalSubtitle}>
                {impegniMese[selectedDay!][0].tipo === 'appuntamento' ? 'APPUNTAMENTO' : 'ORDINE'}
              </Text>
            ) : (
              <Text style={s.modalSubtitle}>NUOVO IMPEGNO</Text>
            )}

            <TextInput
              style={s.modalInput}
              placeholder="Descrizione..."
              placeholderTextColor="#B0A898"
              value={dayModalText}
              onChangeText={setDayModalText}
              multiline
            />

            <View style={s.modalBtns}>
              {dayModalType === 'edit' && (
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} onPress={handleDeleteImpegno}>
                  <Ionicons name="trash" size={16} color="#FFF" />
                  <Text style={s.modalBtnTxt}>CANCELLA</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[s.modalBtn, { backgroundColor: '#1E7F85', flex: 1 }]} 
                onPress={() => {
                  if (dayModalType === 'edit') {
                    handleEditImpegno();
                  } else {
                    if (!dayModalText.trim()) return;
                    const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay!, 12, 0, 0);
                    addAppunto({ data: newDate, testo: dayModalText.trim() });
                    setShowDayModal(false);
                  }
                }}
              >
                <Ionicons name={dayModalType === 'edit' ? 'create' : 'save'} size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>{dayModalType === 'edit' ? (t('common.edit') || 'MODIFICA') : (t('agenda.save') || 'SALVA')}</Text>
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
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Card generica
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardHeaderTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E7F85',
    letterSpacing: 1,
  },
  // Ordini
  orderInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#1A4040',
    minHeight: 36,
    textAlignVertical: 'top',
  },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  orderBtnTxt: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Calendario
  calCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 8,
    marginBottom: 6,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  calNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calMonthTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 1,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calWeekTxt: {
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
    borderRadius: 7,
    margin: 1,
    minHeight: 28,
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  calDayTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginTop: 1,
  },
  // Note
  noteInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#1A4040',
    minHeight: 32,
    textAlignVertical: 'top',
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8A060',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // Archivio a tendina
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E8E3D5',
  },
  archiveToggleTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A9090',
    letterSpacing: 1,
  },
  archiveList: {
    paddingTop: 4,
  },
  archiveEmpty: {
    fontSize: 11,
    color: '#B0A898',
    textAlign: 'center',
    paddingVertical: 8,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE1',
  },
  archiveDate: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A9090',
    backgroundColor: '#F5F0E6',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  archiveTxt: {
    fontSize: 11,
    color: '#1A4040',
    fontWeight: '600',
    flex: 1,
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
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A4040',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
