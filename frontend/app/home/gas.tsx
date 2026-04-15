import React, { useState, useMemo, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { useTranslation } from 'react-i18next';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Filtro = 'SETT.' | 'MESE' | 'ANNO' | 'PERS.';
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function GasScreen() {
  const store = useAppStore();
  const { storicoCarburante, storicoGiornate, addCarburante, removeCarburante } = store;
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [filtro, setFiltro] = useState<Filtro>('MESE');
  const [euroText, setEuroText] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayNote, setDayNote] = useState('');
  const [dayAmount, setDayAmount] = useState('');
  const [displayMonth, setDisplayMonth] = useState(new Date());

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : insets.top + 16;
  const contentH = height - insets.bottom - 70 - topPad;

  /* ═══ SALVA RIFORNIMENTO OGGI ═══ */
  const handleSalvaRifornimento = () => {
    const euro = parseFloat(euroText.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.enterValidAmount') || 'Inserisci un importo valido');
      else Alert.alert(t('common.error') || 'Errore', t('gas.enterValidAmount') || 'Inserisci un importo valido');
      return;
    }
    addCarburante({ data: new Date(), euro, nota: '' });
    setEuroText('');
    playSuccess(); // Conferma sonora + aptica, nessun popup
  };

  /* ═══ STATISTICHE FILTRATE ═══ */
  const stats = useMemo(() => {
    const now = new Date();
    let filtered = [...storicoCarburante];
    let filteredGiornate = [...storicoGiornate];

    if (filtro === 'SETT.') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = storicoCarburante.filter(c => new Date(c.data).getTime() >= weekAgo.getTime());
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data).getTime() >= weekAgo.getTime());
    } else if (filtro === 'MESE') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filtered = storicoCarburante.filter(c => new Date(c.data).getTime() >= monthAgo.getTime());
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data).getTime() >= monthAgo.getTime());
    } else if (filtro === 'ANNO') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      filtered = storicoCarburante.filter(c => new Date(c.data).getTime() >= yearStart.getTime());
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data).getTime() >= yearStart.getTime());
    }

    const totale = filtered.reduce((s, c) => s + (c.euro || 0), 0);
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
          months[d.getMonth()] += c.euro || 0;
        }
      });
      const translatedShort = t('gas.monthsShort', { returnObjects: true }) as string[];
      return { values: months, labels: Array.isArray(translatedShort) ? translatedShort : MESI_SHORT };
    } else if (filtro === 'MESE') {
      const weeks = [0, 0, 0, 0];
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d.getTime() >= monthAgo.getTime()) {
          const weekNum = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (weekNum >= 0 && weekNum < 4) {
            weeks[3 - weekNum] += c.euro || 0;
          }
        }
      });
      return { values: weeks, labels: ['S1', 'S2', 'S3', 'S4'] };
    } else {
      const days = [0, 0, 0, 0, 0, 0, 0];
      const dayLabels = [t('gas.mon'), t('gas.tue'), t('gas.wed'), t('gas.thu'), t('gas.fri'), t('gas.sat'), t('gas.sun')];
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
        if (diff >= 0 && diff < 7) {
          const dayOfWeek = (d.getDay() + 6) % 7; // Lun=0, Dom=6
          days[dayOfWeek] += c.euro || 0;
        }
      });
      return { values: days, labels: dayLabels };
    }
  }, [storicoCarburante, filtro, t]);

  const maxChart = Math.max(...chartData.values, 1);

  /* ═══ RIFORNIMENTI DEL MESE ═══ */
  const rifornimentiMese = useMemo(() => {
    const map: { [day: number]: { euro: number; nota?: string; data: Date }[] } = {};
    storicoCarburante.forEach(c => {
      const d = new Date(c.data);
      if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ euro: c.euro, nota: (c as any).nota, data: d });
      }
    });
    return map;
  }, [storicoCarburante, displayMonth]);

  const handleDayPress = (day: number) => {
    setSelectedDay(day);
    const rifs = rifornimentiMese[day];
    if (rifs && rifs.length > 0) {
      setDayAmount(rifs[0].euro.toFixed(2));
      setDayNote(rifs[0].nota || '');
    } else {
      setDayAmount('');
      setDayNote('');
    }
    setShowDayModal(true);
  };

  /* Trova indice reale in storicoCarburante dato un rifornimento */
  const findCarburanteIndex = (data: Date, euro: number): number => {
    return storicoCarburante.findIndex(c =>
      new Date(c.data).toDateString() === new Date(data).toDateString() && c.euro === euro
    );
  };

  const handleSaveDayRifornimento = () => {
    if (!selectedDay) return;
    const euro = parseFloat(dayAmount.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.invalidAmount') || 'Importo non valido');
      else Alert.alert(t('common.error') || 'Errore', t('gas.invalidAmount') || 'Importo non valido');
      return;
    }
    // Rimuovi esistente
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      const idx = findCarburanteIndex(existing[0].data, existing[0].euro);
      if (idx !== -1) removeCarburante(idx);
    }
    // Aggiungi nuovo
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), selectedDay, 12, 0, 0);
    addCarburante({ data: newDate, euro, nota: dayNote });
    setShowDayModal(false);
  };

  const handleDeleteDayRifornimento = () => {
    if (!selectedDay) return;
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      const idx = findCarburanteIndex(existing[0].data, existing[0].euro);
      if (idx !== -1) removeCarburante(idx);
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
    <View style={[s.root, { height: contentH, paddingTop: topPad }]}>
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>{t('gas.title')}</Text>

      {/* ═══ INPUT GRANDE + SALVA ═══ */}
      <View style={s.inputCard}>
        <TextInput
          style={s.bigInput}
          placeholder="€ 0.00"
          placeholderTextColor="#B0A898"
          keyboardType="numeric"
          value={euroText}
          onChangeText={setEuroText}
          selectTextOnFocus
        />
        <TouchableOpacity style={s.saveBtn} onPress={handleSalvaRifornimento}>
          <Ionicons name="save" size={20} color="#FFF" />
          <Text style={s.saveBtnTxt}>{t('gas.save')}</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ FILTRI ═══ */}
      <View style={s.filterRow}>
        {([
          { key: 'SETT.' as Filtro, label: t('gas.weekFilter') },
          { key: 'MESE' as Filtro, label: t('gas.monthFilter') },
          { key: 'ANNO' as Filtro, label: t('gas.yearFilter') },
          { key: 'PERS.' as Filtro, label: t('gas.customFilter') },
        ]).map(f => (
          <TouchableOpacity key={f.key} style={[s.filterBtn, filtro === f.key && s.filterOn]} onPress={() => setFiltro(f.key)}>
            <Text style={[s.filterTxt, filtro === f.key && { color: '#FFF' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══ KPI ═══ */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="speedometer-outline" size={16} color="#1E7F85" />
          <Text style={s.kpiLabel}>KM</Text>
          <Text style={s.kpiValue}>{stats.km.toFixed(0)}</Text>
        </View>
        <View style={[s.kpiCard, s.kpiCardMain]}>
          <Ionicons name="wallet-outline" size={16} color="#FFF" />
          <Text style={[s.kpiLabel, { color: '#FFF' }]}>{t('gas.total')}</Text>
          <Text style={[s.kpiValue, { color: '#FFF' }]}>€{stats.totale.toFixed(0)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="calculator-outline" size={16} color="#1E7F85" />
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
              <TouchableOpacity key={i} style={s.barCol} onPress={() => {
                hapticTap();
              }}>
                <Text style={s.barValue}>{val > 0 ? `€${Math.round(val)}` : ''}</Text>
                <View style={s.barWrap}>
                  <View style={[s.bar, { height: `${Math.max(h, 8)}%`, backgroundColor: val > 0 ? '#1E7F85' : '#D8D0C0' }]} />
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
            <Ionicons name="chevron-back" size={18} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{(t('gas.months', { returnObjects: true }) as string[])?.[displayMonth.getMonth()]?.toUpperCase() || MESI[displayMonth.getMonth()].toUpperCase()} {displayMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))}>
            <Ionicons name="chevron-forward" size={18} color="#1E7F85" />
          </TouchableOpacity>
        </View>
        <View style={s.calWeekRow}>
          {[t('gas.mon'), t('gas.tue'), t('gas.wed'), t('gas.thu'), t('gas.fri'), t('gas.sat'), t('gas.sun')].map((d, i) => <Text key={i} style={s.calWeekDay}>{d}</Text>)}
        </View>
        {calendarGrid.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const rif = day ? rifornimentiMese[day] : null;
              const hasRif = rif && rif.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              return (
                <TouchableOpacity
                  key={di}
                  style={[s.calDay, hasRif && s.calDayActive, isToday && !hasRif && s.calDayToday]}
                  disabled={!day}
                  onPress={() => day && handleDayPress(day)}
                >
                  <Text style={[s.calDayTxt, hasRif && { color: '#FFF', fontWeight: '900' }, isToday && !hasRif && { color: '#1E7F85', fontWeight: '900' }]}>
                    {day || ''}
                  </Text>
                  {hasRif && <Text style={s.calDayAmount}>€{Math.round(rif[0].euro)}</Text>}
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
            <Text style={s.modalTitle}>{selectedDay} {(t('gas.months', { returnObjects: true }) as string[])?.[displayMonth.getMonth()] || MESI[displayMonth.getMonth()]}</Text>
            
            <Text style={s.modalLabel}>{t('gas.refuelAmount')}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="€ 0.00"
              placeholderTextColor="#B0A898"
              keyboardType="numeric"
              value={dayAmount}
              onChangeText={setDayAmount}
            />
            
            <Text style={s.modalLabel}>{t('gas.noteLabel')}</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMulti]}
              placeholder={t('gas.notePlaceholder')}
              placeholderTextColor="#B0A898"
              multiline
              value={dayNote}
              onChangeText={setDayNote}
            />
            
            <View style={s.modalBtns}>
              {rifornimentiMese[selectedDay!] && rifornimentiMese[selectedDay!].length > 0 && (
                <TouchableOpacity style={s.modalBtnDelete} onPress={handleDeleteDayRifornimento}>
                  <Ionicons name="trash" size={18} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowDayModal(false)}>
                <Text style={s.modalBtnTxt}>{t('gas.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={handleSaveDayRifornimento}>
                <Ionicons name="save" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>{t('gas.save')}</Text>
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
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  // Input grande
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(0,0,0,0.12)',
  },
  bigInput: {
    width: '65%',
    fontSize: 28,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    textAlign: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginLeft: 10,
    justifyContent: 'center',
  },
  saveBtnTxt: {
    color: '#FFF',
    fontSize: 13,
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
    borderRadius: 10,
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
    letterSpacing: 0.5,
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
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  kpiCardMain: {
    backgroundColor: '#E8A060',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7A9090',
    marginTop: 2,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A4040',
  },
  // Grafico
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    flex: 1,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 7,
    fontWeight: '800',
    color: '#1E7F85',
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
    width: 18,
    borderRadius: 5,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: '#7A9090',
    marginTop: 3,
    fontWeight: '700',
  },
  // Calendario
  calCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    flex: 1.5,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calMonthTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1,
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
    paddingVertical: 4,
    borderRadius: 8,
    margin: 1,
    minHeight: 36,
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
  calDayAmount: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 1,
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    // @ts-ignore
    boxShadow: '0px 10px 30px rgba(0,0,0,0.25)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A4040',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9090',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A4040',
  },
  modalInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalBtnDelete: {
    backgroundColor: '#D46A6A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: '#B0A898',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalBtnSave: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
