import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, CarburanteRecord } from '../../src/store/appStore';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Filtro = 'SETT.' | 'MESE' | 'ANNO' | 'PERS.';
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function GasScreen() {
  const { storicoCarburante, storicoGiornate, addCarburante, removeCarburante, updateCarburante } = useAppStore();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [filtro, setFiltro] = useState<Filtro>('MESE');
  const [euroText, setEuroText] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayNote, setDayNote] = useState('');
  const [dayAmount, setDayAmount] = useState('');
  
  // Mese visualizzato nel calendario
  const [displayMonth, setDisplayMonth] = useState(new Date());

  const contentH = height - insets.bottom - 70;

  /* ═══ SALVA RIFORNIMENTO ═══ */
  const handleSalvaRifornimento = () => {
    const euro = parseFloat(euroText.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert('Inserisci un importo valido');
      else Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }
    addCarburante({ data: new Date(), euro, nota: '' });
    setEuroText('');
    if (Platform.OS === 'web') window.alert('Rifornimento salvato!');
    else Alert.alert('Salvato', 'Rifornimento registrato');
  };

  /* ═══ STATISTICHE FILTRATE ═══ */
  const stats = useMemo(() => {
    const now = new Date();
    let filtered = [...storicoCarburante];
    let filteredGiornate = [...storicoGiornate];

    if (filtro === 'SETT.') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = storicoCarburante.filter(c => new Date(c.data) >= weekAgo);
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data) >= weekAgo);
    } else if (filtro === 'MESE') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = storicoCarburante.filter(c => new Date(c.data) >= monthAgo);
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data) >= monthAgo);
    } else if (filtro === 'ANNO') {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      filtered = storicoCarburante.filter(c => new Date(c.data) >= yearAgo);
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data) >= yearAgo);
    }

    const totale = filtered.reduce((s, c) => s + c.euro, 0);
    const km = filteredGiornate.reduce((s, g) => s + (g.km || 0), 0);
    const euroKm = km > 0 ? totale / km : 0;

    return { totale, km, euroKm, filtered };
  }, [storicoCarburante, storicoGiornate, filtro]);

  /* ═══ DATI GRAFICO ═══ */
  const chartData = useMemo(() => {
    const now = new Date();
    if (filtro === 'ANNO') {
      const months = Array(12).fill(0);
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d.getFullYear() === now.getFullYear()) {
          months[d.getMonth()] += c.euro;
        }
      });
      return { values: months, labels: MESI_SHORT };
    } else if (filtro === 'MESE') {
      const weeks = Array(4).fill(0);
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d >= monthAgo) {
          const diff = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
          weeks[Math.min(3, diff)] += c.euro;
        }
      });
      return { values: weeks.reverse(), labels: ['S1', 'S2', 'S3', 'S4'] };
    } else {
      const days = Array(7).fill(0);
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
        if (diff >= 0 && diff < 7) {
          days[6 - diff] += c.euro;
        }
      });
      return { values: days, labels: ['L', 'M', 'M', 'G', 'V', 'S', 'D'] };
    }
  }, [storicoCarburante, filtro]);

  const maxChart = Math.max(...chartData.values, 1);

  /* ═══ CALENDARIO - RIFORNIMENTI DEL MESE ═══ */
  const rifornimentiMese = useMemo(() => {
    const map: { [day: number]: CarburanteRecord[] } = {};
    storicoCarburante.forEach(c => {
      const d = new Date(c.data);
      if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(c);
      }
    });
    return map;
  }, [storicoCarburante, displayMonth]);

  const handleDayPress = (day: number) => {
    setSelectedDay(day);
    const rifs = rifornimentiMese[day];
    if (rifs && rifs.length > 0) {
      const r = rifs[0];
      setDayAmount(r.euro.toString());
      setDayNote((r as any).nota || '');
    } else {
      setDayAmount('');
      setDayNote('');
    }
    setShowDayModal(true);
  };

  const handleSaveDayRifornimento = () => {
    if (!selectedDay) return;
    const euro = parseFloat(dayAmount.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert('Importo non valido');
      else Alert.alert('Errore', 'Importo non valido');
      return;
    }
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      // Rimuovi il vecchio e aggiungi il nuovo
      removeCarburante(new Date(existing[0].data), existing[0].euro);
    }
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), selectedDay);
    addCarburante({ data: newDate, euro, nota: dayNote });
    setShowDayModal(false);
    if (Platform.OS === 'web') window.alert('Salvato!');
    else Alert.alert('Salvato', 'Rifornimento aggiornato');
  };

  const handleDeleteDayRifornimento = () => {
    if (!selectedDay) return;
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      if (Platform.OS === 'web') {
        if (window.confirm('Eliminare questo rifornimento?')) {
          removeCarburante(new Date(existing[0].data), existing[0].euro);
          setShowDayModal(false);
        }
      } else {
        Alert.alert('Conferma', 'Eliminare questo rifornimento?', [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina', style: 'destructive', onPress: () => {
            removeCarburante(new Date(existing[0].data), existing[0].euro);
            setShowDayModal(false);
          }}
        ]);
      }
    }
  };

  /* ═══ GENERA GRIGLIA CALENDARIO ═══ */
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
      {/* ═══ TITOLO + INPUT RIFORNIMENTO ═══ */}
      <View style={s.inputSection}>
        <Text style={s.title}>CARBURANTE</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.euroInput}
            placeholder="€ 0.00"
            placeholderTextColor="#A0B5A8"
            keyboardType="numeric"
            value={euroText}
            onChangeText={setEuroText}
            selectTextOnFocus
          />
          <TouchableOpacity style={s.saveBtn} onPress={handleSalvaRifornimento}>
            <Ionicons name="add-circle" size={22} color="#FFF" />
            <Text style={s.saveBtnTxt}>SEGNA</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ FILTRI ═══ */}
      <View style={s.filterRow}>
        {(['SETT.', 'MESE', 'ANNO', 'PERS.'] as Filtro[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, filtro === f && s.filterOn]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filterTxt, filtro === f && { color: '#FFF' }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══ KPI ═══ */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="speedometer" size={18} color="#1E7F85" />
          <Text style={s.kpiLabel}>KM</Text>
          <Text style={s.kpiValue}>{stats.km.toFixed(0)}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: '#E8A060' }]}>
          <Ionicons name="wallet" size={18} color="#FFF" />
          <Text style={[s.kpiLabel, { color: '#FFF' }]}>TOTALE</Text>
          <Text style={[s.kpiValue, { color: '#FFF' }]}>€{stats.totale.toFixed(0)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="analytics" size={18} color="#1E7F85" />
          <Text style={s.kpiLabel}>€/KM</Text>
          <Text style={s.kpiValue}>€{stats.euroKm.toFixed(2)}</Text>
        </View>
      </View>

      {/* ═══ GRAFICO ═══ */}
      <View style={s.chartCard}>
        <View style={s.chartArea}>
          {chartData.values.map((val, i) => {
            const h = maxChart > 0 ? (val / maxChart) * 100 : 5;
            return (
              <TouchableOpacity
                key={i}
                style={s.barCol}
                onPress={() => {
                  if (val > 0) {
                    if (Platform.OS === 'web') window.alert(`${chartData.labels[i]}: €${Math.round(val)}`);
                    else Alert.alert(chartData.labels[i], `Totale: €${Math.round(val)}`);
                  }
                }}
              >
                <Text style={s.barValue}>{val > 0 ? `€${Math.round(val)}` : ''}</Text>
                <View style={s.barWrap}>
                  <View style={[s.bar, { height: `${Math.max(h, 8)}%`, backgroundColor: val > 0 ? '#1E7F85' : '#D0D0D0' }]} />
                </View>
                <Text style={s.barLabel}>{chartData.labels[i]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══ CALENDARIO ═══ */}
      <View style={s.calCard}>
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
        {calendarGrid.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const hasRif = day && rifornimentiMese[day];
              const isToday = isCurrentMonth && day === today.getDate();
              return (
                <TouchableOpacity
                  key={di}
                  style={[s.calDay, hasRif && s.calDayActive, isToday && s.calDayToday]}
                  disabled={!day}
                  onPress={() => day && handleDayPress(day)}
                >
                  <Text style={[s.calDayTxt, hasRif && { color: '#FFF', fontWeight: '800' }, isToday && !hasRif && { color: '#1E7F85' }]}>
                    {day || ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* ═══ MODAL GIORNO ═══ */}
      <Modal visible={showDayModal} transparent animationType="fade" onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowDayModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>{selectedDay} {MESI[displayMonth.getMonth()]}</Text>
            
            <View style={s.modalField}>
              <Text style={s.modalLabel}>IMPORTO</Text>
              <TextInput
                style={s.modalInput}
                placeholder="€ 0.00"
                placeholderTextColor="#A0B5A8"
                keyboardType="numeric"
                value={dayAmount}
                onChangeText={setDayAmount}
              />
            </View>
            
            <View style={s.modalField}>
              <Text style={s.modalLabel}>NOTA (es. distributore)</Text>
              <TextInput
                style={[s.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="Distributore, luogo..."
                placeholderTextColor="#A0B5A8"
                multiline
                value={dayNote}
                onChangeText={setDayNote}
              />
            </View>
            
            <View style={s.modalBtns}>
              {rifornimentiMese[selectedDay!] && (
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} onPress={handleDeleteDayRifornimento}>
                  <Ionicons name="trash" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#B0A898', flex: 1 }]} onPress={() => setShowDayModal(false)}>
                <Text style={s.modalBtnTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#1E7F85', flex: 1 }]} onPress={handleSaveDayRifornimento}>
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
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 1,
    marginBottom: 8,
  },
  // Input
  inputSection: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  euroInput: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A4040',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveBtnTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // Filtri
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8E3D5',
    alignItems: 'center',
  },
  filterOn: {
    backgroundColor: '#E8A060',
  },
  filterTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A7575',
  },
  // KPI
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(0,0,0,0.08)',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7A9090',
    marginTop: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
  },
  // Grafico
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    flex: 0.5,
    minHeight: 100,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 7,
    fontWeight: '700',
    color: '#5A7575',
    marginBottom: 2,
  },
  barWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 40,
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: '#7A9090',
    marginTop: 3,
    fontWeight: '600',
  },
  // Calendario
  calCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    flex: 0.8,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
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
    paddingVertical: 6,
    borderRadius: 6,
    margin: 1,
  },
  calDayActive: {
    backgroundColor: '#E8A060',
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
