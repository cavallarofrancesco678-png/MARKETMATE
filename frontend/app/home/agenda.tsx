import React, { useState } from 'react';
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
import { CalendarModal } from '../../src/components/CalendarModal';
import { useTranslation } from 'react-i18next';
import { getMonthNames, getShortDayNames } from '../../src/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

export default function AgendaScreen() {
  const { agenda, appuntiAgenda, addAppunto, removeAppunto, storicoDiario, addDiario, getDiarioForDate } = useAppStore();
  const { t } = useTranslation();
  const monthNames = getMonthNames();
  const shortDayNames = getShortDayNames();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [diarioText, setDiarioText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAppuntoText, setNewAppuntoText] = useState('');
  const [newAppuntoDate, setNewAppuntoDate] = useState(new Date());
  const [showAppuntoCalendar, setShowAppuntoCalendar] = useState(false);
  const [editingAppunto, setEditingAppunto] = useState<Appunto | null>(null);

  // Altezza disponibile
  const contentH = height - insets.bottom - 70;

  // Load diary on date change
  React.useEffect(() => {
    const existing = getDiarioForDate(selectedDate);
    setDiarioText(existing ? existing.testo : '');
  }, [selectedDate]);

  const formattaData = (d: Date) => {
    const dayIdx = (d.getDay() + 6) % 7;
    return `${shortDayNames[dayIdx]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  };

  const handleSalvaDiario = () => {
    if (diarioText.trim()) {
      addDiario({ data: selectedDate, testo: diarioText.trim() });
    }
  };

  const handleSalvaAppunto = () => {
    if (!newAppuntoText.trim()) {
      if (Platform.OS === 'web') window.alert(t('agenda.enterText') || 'Inserisci il testo');
      else Alert.alert(t('common.error'), t('agenda.enterText'));
      return;
    }
    addAppunto({ data: newAppuntoDate, testo: newAppuntoText.trim() });
    setNewAppuntoText('');
    setShowAddModal(false);
    if (Platform.OS === 'web') window.alert(t('agenda.noteSaved') || 'Appuntamento salvato');
    else Alert.alert(t('common.saved'), t('agenda.noteSaved'));
  };

  const handleElimina = (a: Appunto) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('agenda.deleteNote') || 'Eliminare questo appuntamento?')) {
        removeAppunto(a.data, a.testo);
      }
    } else {
      Alert.alert(t('common.delete'), t('agenda.deleteNote'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeAppunto(a.data, a.testo) },
      ]);
    }
  };

  // Appunti per data selezionata
  const appuntiOggi = appuntiAgenda.filter((a) => isSameDay(new Date(a.data), selectedDate));

  // Calendario mini - genera griglia
  const renderMiniCalendar = () => {
    const now = new Date();
    const displayMonth = selectedDate;
    const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const lastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }

    // Trova appuntamenti del mese
    const appuntiMese: { [day: number]: number } = {};
    appuntiAgenda.forEach(a => {
      const d = new Date(a.data);
      if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
        appuntiMese[d.getDate()] = (appuntiMese[d.getDate()] || 0) + 1;
      }
    });

    return (
      <View style={s.miniCal}>
        {/* Header mese */}
        <View style={s.calMonthHeader}>
          <TouchableOpacity onPress={() => {
            const prev = new Date(displayMonth);
            prev.setMonth(prev.getMonth() - 1);
            setSelectedDate(prev);
          }}>
            <Ionicons name="chevron-back" size={20} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{monthNames[displayMonth.getMonth()].toUpperCase()} {displayMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => {
            const next = new Date(displayMonth);
            next.setMonth(next.getMonth() + 1);
            setSelectedDate(next);
          }}>
            <Ionicons name="chevron-forward" size={20} color="#1E7F85" />
          </TouchableOpacity>
        </View>
        
        {/* Header giorni */}
        <View style={s.calRow}>
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
            <Text key={i} style={s.calDayHeader}>{d}</Text>
          ))}
        </View>
        
        {/* Griglia */}
        {rows.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const isSelected = day === selectedDate.getDate() && displayMonth.getMonth() === selectedDate.getMonth();
              const isToday = day === now.getDate() && displayMonth.getMonth() === now.getMonth() && displayMonth.getFullYear() === now.getFullYear();
              const hasAppunti = day && appuntiMese[day];
              
              return (
                <TouchableOpacity
                  key={di}
                  style={[s.calDay, isSelected && s.calDaySelected, isToday && !isSelected && s.calDayToday]}
                  disabled={!day}
                  onPress={() => {
                    if (day) {
                      const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
                      setSelectedDate(newDate);
                      // Se ci sono appunti, mostra popup
                      if (hasAppunti) {
                        const appuntiDay = appuntiAgenda.filter(a => {
                          const d = new Date(a.data);
                          return d.getDate() === day && d.getMonth() === displayMonth.getMonth();
                        });
                        if (appuntiDay.length > 0) {
                          setEditingAppunto(appuntiDay[0]);
                        }
                      }
                    }
                  }}
                >
                  <Text style={[s.calDayTxt, isSelected && { color: '#FFF' }, isToday && !isSelected && { color: '#1E7F85', fontWeight: '900' }]}>
                    {day || ''}
                  </Text>
                  {hasAppunti && <View style={[s.calDot, isSelected && { backgroundColor: '#FFF' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[s.root, { height: contentH }]}>
      {/* ═══ SEZIONE 1: NOTE RAPIDE DEL GIORNO ═══ */}
      <View style={s.notesSection}>
        <View style={s.notesHeader}>
          <Ionicons name="document-text" size={18} color="#1E7F85" />
          <Text style={s.sectionTitle}>{t('agenda.dayNotes') || 'NOTE DEL GIORNO'}</Text>
          <Text style={s.dateLabel}>{formattaData(selectedDate).toUpperCase()}</Text>
        </View>
        <TextInput
          style={s.notesInput}
          placeholder={t('agenda.dayNotesPlaceholder') || 'Scrivi le note della giornata...'}
          placeholderTextColor="#A0B5A8"
          value={diarioText}
          onChangeText={setDiarioText}
          onBlur={handleSalvaDiario}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* ═══ SEZIONE 2: AGGIUNGI ORDINE/APPUNTAMENTO ═══ */}
      <TouchableOpacity style={s.addBtn} onPress={() => {
        setNewAppuntoDate(selectedDate);
        setShowAddModal(true);
      }} activeOpacity={0.8}>
        <Ionicons name="add-circle" size={24} color="#FFF" />
        <Text style={s.addBtnTxt}>{t('agenda.addNote') || 'AGGIUNGI ORDINE / APPUNTAMENTO'}</Text>
      </TouchableOpacity>

      {/* Lista appunti del giorno selezionato */}
      {appuntiOggi.length > 0 && (
        <View style={s.appuntiList}>
          {appuntiOggi.slice(0, 3).map((a, i) => (
            <View key={i} style={s.appuntoRow}>
              <Ionicons name="calendar" size={14} color="#E8A060" />
              <Text style={s.appuntoTxt} numberOfLines={1}>{a.testo}</Text>
              <TouchableOpacity onPress={() => handleElimina(a)}>
                <Ionicons name="close-circle" size={18} color="#D46A6A" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ═══ SEZIONE 3: CALENDARIO INTERATTIVO ═══ */}
      <View style={s.calendarSection}>
        {renderMiniCalendar()}
      </View>

      {/* ═══ MODAL AGGIUNGI APPUNTAMENTO ═══ */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowAddModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>{t('agenda.addNote') || 'NUOVO APPUNTAMENTO'}</Text>
            
            <TouchableOpacity onPress={() => setShowAppuntoCalendar(true)} style={s.dateBtn}>
              <Ionicons name="calendar" size={18} color="#1E7F85" />
              <Text style={s.dateTxt}>{formattaData(newAppuntoDate).toUpperCase()}</Text>
            </TouchableOpacity>
            
            <TextInput
              style={s.modalInput}
              placeholder="Descrizione appuntamento..."
              placeholderTextColor="#A0B5A8"
              value={newAppuntoText}
              onChangeText={setNewAppuntoText}
              multiline
              numberOfLines={3}
            />
            
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#B0A898' }]} onPress={() => setShowAddModal(false)}>
                <Text style={s.modalBtnTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#1E7F85' }]} onPress={handleSalvaAppunto}>
                <Ionicons name="save-outline" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ═══ MODAL MODIFICA/ELIMINA APPUNTAMENTO ═══ */}
      <Modal visible={!!editingAppunto} transparent animationType="fade" onRequestClose={() => setEditingAppunto(null)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setEditingAppunto(null)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>GESTISCI APPUNTAMENTO</Text>
            
            {editingAppunto && (
              <>
                <View style={s.editAppuntoBox}>
                  <Ionicons name="calendar" size={20} color="#1E7F85" />
                  <Text style={s.editAppuntoTxt}>{editingAppunto.testo}</Text>
                </View>
                
                <View style={s.modalBtns}>
                  <TouchableOpacity 
                    style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} 
                    onPress={() => {
                      handleElimina(editingAppunto);
                      setEditingAppunto(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FFF" />
                    <Text style={s.modalBtnTxt}>ELIMINA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#1E7F85' }]} onPress={() => setEditingAppunto(null)}>
                    <Text style={s.modalBtnTxt}>CHIUDI</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modals */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => { setSelectedDate(date); setShowCalendar(false); }}
        initialDate={selectedDate}
      />
      <CalendarModal
        visible={showAppuntoCalendar}
        onClose={() => setShowAppuntoCalendar(false)}
        onSelect={(date) => { setNewAppuntoDate(date); setShowAppuntoCalendar(false); }}
        initialDate={newAppuntoDate}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Sezione 1: Note rapide
  notesSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 0.5,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E8A060',
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
  // Sezione 2: Aggiungi
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8A060',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 10,
  },
  addBtnTxt: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appuntiList: {
    marginTop: 8,
    gap: 6,
  },
  appuntoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  appuntoTxt: {
    flex: 1,
    fontSize: 12,
    color: '#1A4040',
    fontWeight: '600',
  },
  // Sezione 3: Calendario
  calendarSection: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  miniCal: {},
  calMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  calMonthTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 1,
  },
  calRow: {
    flexDirection: 'row',
  },
  calDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9090',
    paddingVertical: 4,
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  calDaySelected: {
    backgroundColor: '#1E7F85',
  },
  calDayToday: {
    backgroundColor: '#E8F5F5',
  },
  calDayTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E8A060',
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
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A4040',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5F5',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E7F85',
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A4040',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editAppuntoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  editAppuntoTxt: {
    flex: 1,
    fontSize: 14,
    color: '#1A4040',
    fontWeight: '600',
  },
});
