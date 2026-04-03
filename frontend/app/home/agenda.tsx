import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Appunto } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';
import { useTranslation } from 'react-i18next';
import { getMonthNames, getShortDayNames } from '../../src/i18n';

const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const isToday = (d: Date) => isSameDay(d, new Date());
const isTomorrow = (d: Date) => { const t = new Date(); t.setDate(t.getDate() + 1); return isSameDay(d, t); };

export default function AgendaScreen() {
  const { agenda, appuntiAgenda, addAppunto, removeAppunto, storicoDiario, addDiario, removeDiario, getDiarioForDate } = useAppStore();
  const { t } = useTranslation();
  const monthNames = getMonthNames();
  const shortDayNames = getShortDayNames();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [diarioText, setDiarioText] = useState('');
  const [appuntoText, setAppuntoText] = useState('');
  const [appuntoDate, setAppuntoDate] = useState(new Date());
  const [showAppuntoCalendar, setShowAppuntoCalendar] = useState(false);

  // Load existing diary entry when date changes
  React.useEffect(() => {
    const existing = getDiarioForDate(selectedDate);
    setDiarioText(existing ? existing.testo : '');
  }, [selectedDate]);

  /* ── Translated date formatter ── */
  const formattaData = (d: Date) => {
    const dayIdx = (d.getDay() + 6) % 7; // 0=Mon ... 6=Sun
    return `${shortDayNames[dayIdx]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  };

  /* ── Short month for badge ── */
  const shortMonth = (d: Date) => monthNames[d.getMonth()].substring(0, 3).toUpperCase();

  /* ── Navigate date ── */
  const cambiaData = (dir: number) => {
    const nd = new Date(selectedDate);
    nd.setDate(nd.getDate() + dir);
    setSelectedDate(nd);
  };

  /* ── Market for selected day ── */
  const dayIdx = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1;
  const mercatoGiorno = dayIdx < agenda.length && agenda[dayIdx].lavorativo && agenda[dayIdx].mercato
    ? agenda[dayIdx].mercato
    : t('agenda.noMarketPlanned');

  /* ── Appunti for date ── */
  const appuntiOggi = appuntiAgenda.filter((a) => isSameDay(new Date(a.data), selectedDate));

  /* ── Upcoming ── */
  const prossimi = appuntiAgenda
    .filter((a) => new Date(a.data) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 10);

  /* ── Save diary entry ── */
  const handleSalvaDiario = () => {
    if (!diarioText.trim()) {
      if (Platform.OS === 'web') window.alert(t('agenda.enterText'));
      else Alert.alert(t('common.error'), t('agenda.enterText'));
      return;
    }
    addDiario({ data: selectedDate, testo: diarioText.trim() });
    if (Platform.OS === 'web') window.alert(t('common.saved'));
    else Alert.alert(t('common.saved'), t('agenda.diarySaved'));
  };

  /* ── Delete diary entry ── */
  const handleEliminaDiario = (data: Date) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('agenda.deleteDiary'))) {
        removeDiario(data);
        // Clear text if deleting current date
        if (new Date(data).toDateString() === selectedDate.toDateString()) {
          setDiarioText('');
        }
      }
    } else {
      Alert.alert(t('common.delete'), t('agenda.deleteDiary'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => {
          removeDiario(data);
          if (new Date(data).toDateString() === selectedDate.toDateString()) {
            setDiarioText('');
          }
        }},
      ]);
    }
  };

  /* ── Recent diary entries (latest 10) ── */
  const recentDiario = [...storicoDiario]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 10);

  /* ── Save appunto (works on web and native) ── */
  const handleSalvaAppunto = () => {
    if (!appuntoText.trim()) {
      if (Platform.OS === 'web') {
        window.alert(t('agenda.enterText'));
      } else {
        Alert.alert(t('common.error'), t('agenda.enterText'));
      }
      return;
    }
    addAppunto({ data: appuntoDate, testo: appuntoText.trim() });
    setAppuntoText('');
    if (Platform.OS === 'web') {
      window.alert(t('agenda.noteSaved'));
    } else {
      Alert.alert(t('common.saved'), t('agenda.noteSaved'));
    }
  };

  /* ── Delete appunto (works on web and native) ── */
  const handleElimina = (a: Appunto) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('agenda.deleteNote'))) {
        removeAppunto(a.data, a.testo);
      }
    } else {
      Alert.alert(t('common.delete'), t('agenda.deleteNote'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeAppunto(a.data, a.testo) },
      ]);
    }
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>{t('agenda.title')}</Text>

        {/* Date navigator */}
        <View style={s.card}>
          <View style={s.dateNav}>
            <TouchableOpacity onPress={() => cambiaData(-1)}>
              <Ionicons name="chevron-back" size={22} color="#1E7F85" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCalendar(true)}>
              <Text style={s.dateNavTxt}>{formattaData(selectedDate).toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => cambiaData(1)}>
              <Ionicons name="chevron-forward" size={22} color="#1E7F85" />
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Sede mercato */}
          <View style={s.sedeRow}>
            <Text style={s.labelSm}>{t('agenda.location')}:</Text>
            <Text style={s.sedeValue}>{mercatoGiorno}</Text>
          </View>

          {/* Diario giornata */}
          <Text style={[s.sectionTitle, { marginTop: 14 }]}>{t('agenda.dayNotes')}</Text>
          <View style={s.inset}>
            <TextInput
              style={s.diarioInput}
              placeholder={t('agenda.dayNotesPlaceholder')}
              placeholderTextColor="#A0B5A8"
              value={diarioText}
              onChangeText={setDiarioText}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Appunti del giorno selezionato */}
          {appuntiOggi.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.sectionTitle}>{t('agenda.dayOrders')}</Text>
              {appuntiOggi.map((a, i) => (
                <View key={i} style={s.appuntoRow}>
                  <Ionicons name="document-text" size={16} color="#1E7F85" />
                  <Text style={s.appuntoTxt}>{a.testo}</Text>
                  <TouchableOpacity onPress={() => handleElimina(a)}>
                    <Ionicons name="trash-outline" size={18} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Salva diario in fondo */}
          <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }]} onPress={handleSalvaDiario}>
            <Ionicons name="save-outline" size={16} color="#FFF" />
            <Text style={s.saveTxt}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Aggiungi appunto */}
        <Text style={s.sectionTitleOut}>{t('agenda.addOrder')}</Text>
        <View style={s.card}>
          <View style={s.inset}>
            <TextInput
              style={s.appuntoInput}
              placeholder={t('agenda.orderPlaceholder')}
              placeholderTextColor="#A0B5A8"
              value={appuntoText}
              onChangeText={setAppuntoText}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity style={s.datePick} onPress={() => setShowAppuntoCalendar(true)}>
              <Text style={s.datePickTxt}>{t('agenda.forDate')}: {formattaData(appuntoDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSalvaAppunto}>
              <Text style={s.saveTxt}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prossimi impegni */}
        <Text style={s.sectionTitleOut}>{t('agenda.upcoming')}</Text>
        {prossimi.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.labelSm, { textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' }]}>
              {t('agenda.noAppointments')}
            </Text>
          </View>
        ) : (
          prossimi.map((a, i) => {
            const d = new Date(a.data);
            const label = isToday(d) ? t('common.today') : isTomorrow(d) ? t('common.tomorrow') : null;

            return (
              <View key={i} style={s.upcomingCard}>
                <View style={[s.dateBadge, { backgroundColor: '#D46A6A' }]}>
                  <Text style={s.dateBadgeDay}>{d.getDate()}</Text>
                  <Text style={s.dateBadgeMonth}>{shortMonth(d)}</Text>
                </View>
                {label && (
                  <View style={[s.labelBadge, { backgroundColor: '#1E7F85' }]}>
                    <Text style={s.labelBadgeTxt}>{label}</Text>
                  </View>
                )}
                <Text style={s.upcomingTxt}>{a.testo}</Text>
                <TouchableOpacity onPress={() => handleElimina(a)}>
                  <Ionicons name="trash-outline" size={20} color="#D46A6A" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Tutte le annotazioni salvate */}
        <Text style={s.sectionTitleOut}>{t('agenda.allNotes')}</Text>
        {appuntiAgenda.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.labelSm, { textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' }]}>
              {t('agenda.noNotes')}
            </Text>
          </View>
        ) : (
          [...appuntiAgenda]
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .map((a, i) => {
              const d = new Date(a.data);
              const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <View key={i} style={s.upcomingCard}>
                  <View style={[s.dateBadge, { backgroundColor: isPast ? '#999' : isToday(d) ? '#1E7F85' : isTomorrow(d) ? '#E8A060' : '#D46A6A' }]}>
                    <Text style={s.dateBadgeDay}>{d.getDate()}</Text>
                    <Text style={s.dateBadgeMonth}>{shortMonth(d)}</Text>
                  </View>
                  {isToday(d) && (
                    <View style={[s.labelBadge, { backgroundColor: '#1E7F85' }]}>
                      <Text style={s.labelBadgeTxt}>{t('common.today')}</Text>
                    </View>
                  )}
                  {isTomorrow(d) && (
                    <View style={[s.labelBadge, { backgroundColor: '#E8A060' }]}>
                      <Text style={s.labelBadgeTxt}>{t('common.tomorrow')}</Text>
                    </View>
                  )}
                  <Text style={[s.upcomingTxt, isPast && { color: '#999', textDecorationLine: 'line-through' }]}>{a.testo}</Text>
                  <TouchableOpacity onPress={() => handleElimina(a)}>
                    <Ionicons name="trash-outline" size={20} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
              );
            })
        )}

        {/* Storico Diario */}
        <Text style={s.sectionTitleOut}>{t('agenda.diaryHistory')}</Text>
        {recentDiario.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.labelSm, { textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' }]}>
              {t('agenda.noDiary')}
            </Text>
          </View>
        ) : (
          recentDiario.map((d, i) => {
            const dt = new Date(d.data);
            return (
              <View key={i} style={[s.card, { marginBottom: 10, padding: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="book-outline" size={16} color="#1E7F85" />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, fontWeight: '800', color: '#1A4040' }}>
                    {formattaData(dt).toUpperCase()}
                  </Text>
                  <TouchableOpacity onPress={() => handleEliminaDiario(d.data)}>
                    <Ionicons name="trash-outline" size={18} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, color: '#1A4040', lineHeight: 18 }}>{d.testo}</Text>
              </View>
            );
          })
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => { setSelectedDate(date); setShowCalendar(false); }}
        initialDate={selectedDate}
        themeColor="#1E7F85"
        title={t('agenda.goToDate')}
      />

      <CalendarModal
        visible={showAppuntoCalendar}
        onClose={() => setShowAppuntoCalendar(false)}
        onSelect={(date) => { setAppuntoDate(date); setShowAppuntoCalendar(false); }}
        initialDate={appuntoDate}
        themeColor="#1E7F85"
        title={t('agenda.appointmentDate')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  scroll: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#1A4040', textAlign: 'center', letterSpacing: 1.5, marginBottom: 20 },

  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, marginBottom: 14,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },

  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginBottom: 8 },
  sectionTitleOut: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginBottom: 12 },
  labelSm: { fontSize: 11, fontWeight: '600', color: '#5A7575' },

  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateNavTxt: { fontSize: 13, fontWeight: '900', color: '#1A3535', textAlign: 'center' },

  divider: { height: 1, backgroundColor: '#C5DDD4', marginVertical: 12 },

  sedeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sedeValue: { fontSize: 14, fontWeight: '800', color: '#1E7F85' },

  inset: {
    backgroundColor: '#D8EDE5', borderRadius: 12, padding: 12,
    // @ts-ignore
    boxShadow: 'inset 2px 2px 6px rgba(130,150,140,0.3), inset -2px -2px 5px rgba(255,255,250,0.5)',
  },
  diarioInput: { fontSize: 14, color: '#1A3535', minHeight: 60, textAlignVertical: 'top', padding: 0 },
  appuntoInput: { fontSize: 14, color: '#1A3535', padding: 0 },

  appuntoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  appuntoTxt: { flex: 1, fontSize: 14, color: '#1A3535' },

  datePick: {
    flex: 1, borderWidth: 1.5, borderColor: '#1E7F85', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  datePickTxt: { fontSize: 11, fontWeight: '700', color: '#1E7F85' },

  saveBtn: {
    backgroundColor: '#1E7F85', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5), -3px -3px 8px rgba(45,120,125,0.35)',
  },
  saveTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  upcomingCard: {
    backgroundColor: '#EDE8DA', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  dateBadge: { borderRadius: 8, padding: 6, alignItems: 'center', minWidth: 40 },
  dateBadgeDay: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  dateBadgeMonth: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  labelBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  labelBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  upcomingTxt: { flex: 1, fontSize: 14, color: '#1A3535' },
});
