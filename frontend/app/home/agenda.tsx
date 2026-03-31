import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Appunto } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';

const GIORNI_SETTIMANA = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI_ITA = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const formattaData = (d: Date) => `${GIORNI_ITA[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const isToday = (d: Date) => isSameDay(d, new Date());
const isTomorrow = (d: Date) => { const t = new Date(); t.setDate(t.getDate() + 1); return isSameDay(d, t); };

export default function AgendaScreen() {
  const { agenda, appuntiAgenda, addAppunto, removeAppunto } = useAppStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [diarioText, setDiarioText] = useState('');
  const [appuntoText, setAppuntoText] = useState('');
  const [appuntoDate, setAppuntoDate] = useState(new Date());
  const [showAppuntoCalendar, setShowAppuntoCalendar] = useState(false);

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
    : 'Nessun mercato in programma';

  /* ── Appunti for date ── */
  const appuntiOggi = appuntiAgenda.filter((a) => isSameDay(new Date(a.data), selectedDate));

  /* ── Upcoming ── */
  const prossimi = appuntiAgenda
    .filter((a) => new Date(a.data) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 10);

  /* ── Save appunto ── */
  const handleSalvaAppunto = () => {
    if (!appuntoText.trim()) { Alert.alert('Errore', 'Inserisci un testo'); return; }
    addAppunto({ data: appuntoDate, testo: appuntoText });
    setAppuntoText('');
    Alert.alert('Salvato!', 'Appunto aggiunto');
  };

  /* ── Delete appunto ── */
  const handleElimina = (a: Appunto) => {
    Alert.alert('Elimina', 'Eliminare questo appunto?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => removeAppunto(a.data, a.testo) },
    ]);
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>DIARIO E APPUNTAMENTI</Text>

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
            <Text style={s.labelSm}>Sede:</Text>
            <Text style={s.sedeValue}>{mercatoGiorno}</Text>
          </View>

          {/* Diario giornata */}
          <Text style={[s.sectionTitle, { marginTop: 14 }]}>APPUNTI DELLA GIORNATA</Text>
          <View style={s.inset}>
            <TextInput
              style={s.diarioInput}
              placeholder="Com'è andata oggi? Scrivi qui i tuoi appunti..."
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
              <Text style={s.sectionTitle}>ORDINI DEL GIORNO</Text>
              {appuntiOggi.map((a, i) => (
                <View key={i} style={s.appuntoRow}>
                  <Ionicons name="document-text" size={16} color="#1E7F85" />
                  <Text style={s.appuntoTxt}>{a.testo}</Text>
                  <TouchableOpacity onPress={() => handleElimina(a)}>
                    <Ionicons name="checkmark-circle" size={20} color="#5AAA6A" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Aggiungi appunto */}
        <Text style={s.sectionTitleOut}>AGGIUNGI ORDINE / APPUNTAMENTO</Text>
        <View style={s.card}>
          <View style={s.inset}>
            <TextInput
              style={s.appuntoInput}
              placeholder="Es: Portare 3kg pane alla signora Maria"
              placeholderTextColor="#A0B5A8"
              value={appuntoText}
              onChangeText={setAppuntoText}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity style={s.datePick} onPress={() => setShowAppuntoCalendar(true)}>
              <Text style={s.datePickTxt}>PER IL: {formattaData(appuntoDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSalvaAppunto}>
              <Text style={s.saveTxt}>SALVA</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prossimi impegni */}
        <Text style={s.sectionTitleOut}>PROSSIMI IMPEGNI SALVATI</Text>
        {prossimi.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.labelSm, { textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' }]}>
              Nessun ordine o appuntamento in programma.
            </Text>
          </View>
        ) : (
          prossimi.map((a, i) => {
            const d = new Date(a.data);
            const label = isToday(d) ? 'OGGI' : isTomorrow(d) ? 'DOMANI' : null;
            const isScaduto = d < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <View key={i} style={s.upcomingCard}>
                <View style={[s.dateBadge, { backgroundColor: isScaduto ? '#999' : '#D46A6A' }]}>
                  <Text style={s.dateBadgeDay}>{d.getDate()}</Text>
                  <Text style={s.dateBadgeMonth}>{MESI_BREVI[d.getMonth()].toUpperCase()}</Text>
                </View>
                {label && (
                  <View style={[s.labelBadge, { backgroundColor: '#1E7F85' }]}>
                    <Text style={s.labelBadgeTxt}>{label}</Text>
                  </View>
                )}
                <Text style={s.upcomingTxt}>{a.testo}</Text>
                <TouchableOpacity onPress={() => handleElimina(a)}>
                  <Ionicons name="checkmark-circle" size={22} color="#5AAA6A" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Settimana tipo */}
        <Text style={s.sectionTitleOut}>SETTIMANA TIPO</Text>
        <View style={s.card}>
          {agenda.map((m, i) => (
            <View key={i} style={s.weekRow}>
              <Text style={[s.weekDay, m.lavorativo && { color: '#1E7F85', fontWeight: '800' }]}>
                {m.giorno}
              </Text>
              <Text style={s.weekMarket}>{m.lavorativo ? m.mercato || 'Mercato' : '-'}</Text>
              {m.lavorativo && <Ionicons name="checkmark-circle" size={16} color="#5AAA6A" />}
            </View>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => { setSelectedDate(date); setShowCalendar(false); }}
        initialDate={selectedDate}
        themeColor="#1E7F85"
        title="VAI ALLA DATA"
      />

      <CalendarModal
        visible={showAppuntoCalendar}
        onClose={() => setShowAppuntoCalendar(false)}
        onSelect={(date) => { setAppuntoDate(date); setShowAppuntoCalendar(false); }}
        initialDate={appuntoDate}
        themeColor="#1E7F85"
        title="DATA APPUNTAMENTO"
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

  weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#D8EDE5' },
  weekDay: { width: 90, fontSize: 12, color: '#7A9090' },
  weekMarket: { flex: 1, fontSize: 14, color: '#1A3535' },
});
