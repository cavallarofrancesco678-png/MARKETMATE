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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FiltroGas = 'SETT.' | 'MESE' | 'ANNO';

const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function GasScreen() {
  const { storicoCarburante, storicoGiornate, addCarburante, removeCarburante } = useAppStore();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [filtro, setFiltro] = useState<FiltroGas>('MESE');
  const [euroText, setEuroText] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<number | null>(null);

  // Altezza disponibile (escludendo bottom tab e safe area)
  const contentH = height - insets.bottom - 70;

  /* ═══ STATISTICHE FILTRATE PER PERIODO ═══ */
  const statsFiltrate = useMemo(() => {
    const now = new Date();
    let filteredCarb = [...storicoCarburante];
    let filteredGiornate = [...storicoGiornate];

    if (filtro === 'SETT.') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredCarb = storicoCarburante.filter(c => new Date(c.data) >= weekAgo);
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data) >= weekAgo);
    } else if (filtro === 'MESE') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredCarb = storicoCarburante.filter(c => new Date(c.data) >= monthAgo);
      filteredGiornate = storicoGiornate.filter(g => new Date(g.data) >= monthAgo);
    }

    const totaleCarb = filteredCarb.reduce((s, c) => s + c.euro, 0);
    const totaleKm = filteredGiornate.reduce((s, g) => s + (g.km || 0), 0);
    const costoKm = totaleKm > 0 ? totaleCarb / totaleKm : 0;

    return { totaleCarb, totaleKm, costoKm, filteredCarb };
  }, [storicoCarburante, storicoGiornate, filtro]);

  /* ═══ DATI GRAFICO ═══ */
  const chartData = useMemo(() => {
    if (filtro === 'ANNO') {
      const monthlyTotals = Array(12).fill(0);
      const currentYear = new Date().getFullYear();
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d.getFullYear() === currentYear) {
          monthlyTotals[d.getMonth()] += c.euro;
        }
      });
      return { values: monthlyTotals, labels: MESI_SHORT, type: 'anno' };
    } else if (filtro === 'MESE') {
      const weeks = Array(4).fill(0);
      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d >= monthAgo) {
          const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          const weekIdx = Math.min(Math.floor(daysDiff / 7), 3);
          weeks[3 - weekIdx] += c.euro;
        }
      });
      return { values: weeks, labels: ['S4', 'S3', 'S2', 'S1'], type: 'mese' };
    } else {
      const days = Array(7).fill(0);
      const dayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
      const now = new Date();
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
          days[6 - daysDiff] += c.euro;
        }
      });
      return { values: days, labels: dayLabels, type: 'sett' };
    }
  }, [storicoCarburante, filtro]);

  /* ═══ SALVA RIFORNIMENTO ═══ */
  const handleSalva = () => {
    const euro = parseFloat(euroText.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.invalidAmount') || 'Inserisci un importo valido');
      else Alert.alert(t('common.error'), t('gas.invalidAmount'));
      return;
    }
    addCarburante({ data: selectedDate, euro });
    setEuroText('');
    setShowAddModal(false);
    if (Platform.OS === 'web') window.alert(t('gas.refuelSaved') || 'Rifornimento salvato');
    else Alert.alert(t('common.saved'), t('gas.refuelSaved'));
  };

  const maxChartVal = Math.max(...chartData.values, 1);

  return (
    <View style={[s.root, { height: contentH }]}>
      {/* ═══ BARRA RIFORNIMENTO COMPATTA ═══ */}
      <TouchableOpacity style={s.addBar} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
        <Ionicons name="add-circle" size={24} color="#FFF" />
        <Text style={s.addBarTxt}>{t('gas.addRefuel') || 'AGGIUNGI RIFORNIMENTO'}</Text>
        <Text style={s.addBarEuro}>€{statsFiltrate.totaleCarb.toFixed(0)}</Text>
      </TouchableOpacity>

      {/* ═══ FILTRI PERIODO ═══ */}
      <View style={s.filterRow}>
        {(['SETT.', 'MESE', 'ANNO'] as FiltroGas[]).map((f) => {
          const on = filtro === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, on && s.filterOn]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ═══ KPI COMPATTI ═══ */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>€/KM</Text>
          <Text style={[s.kpiValue, { color: '#1E7F85' }]}>€{statsFiltrate.costoKm.toFixed(2)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>TOTALE</Text>
          <Text style={[s.kpiValue, { color: '#E8A060' }]}>€{statsFiltrate.totaleCarb.toFixed(0)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>KM</Text>
          <Text style={[s.kpiValue, { color: '#5A7575' }]}>{statsFiltrate.totaleKm.toFixed(0)}</Text>
        </View>
      </View>

      {/* ═══ GRAFICO CON TOOLTIP ═══ */}
      <View style={s.chartCard}>
        <Text style={s.chartTitle}>
          {filtro === 'ANNO' ? 'SPESA MENSILE' : `TREND ${filtro}`}
        </Text>
        <View style={s.chartArea}>
          {chartData.values.map((val, i) => {
            const h = maxChartVal > 0 ? (val / maxChartVal) * 100 : 5;
            const barW = chartData.values.length > 8 ? 20 : 36;
            return (
              <TouchableOpacity
                key={i}
                style={s.barCol}
                activeOpacity={0.7}
                onPress={() => {
                  if (val > 0) {
                    const label = chartData.labels[i];
                    if (Platform.OS === 'web') {
                      window.alert(`${label}: €${val.toFixed(0)}`);
                    } else {
                      Alert.alert(label, `Totale: €${val.toFixed(0)}`);
                    }
                  }
                }}
              >
                <Text style={s.barValue}>{val > 0 ? `€${Math.round(val)}` : ''}</Text>
                <View style={s.barContainer}>
                  <View style={[s.bar, { 
                    width: barW, 
                    height: `${Math.max(h, 5)}%`, 
                    backgroundColor: val > 0 ? '#1E7F85' : '#D0D0D0' 
                  }]} />
                </View>
                <Text style={s.barLabel}>{chartData.labels[i]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══ CALENDARIO INTERATTIVO ═══ */}
      <View style={s.calendarCard}>
        <Text style={s.chartTitle}>CALENDARIO RIFORNIMENTI</Text>
        <View style={s.miniCalendar}>
          {/* Header giorni */}
          <View style={s.calRow}>
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <Text key={i} style={s.calDayHeader}>{d}</Text>
            ))}
          </View>
          {/* Griglia giorni del mese */}
          {(() => {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const startOffset = (firstDay.getDay() + 6) % 7; // Lun=0
            const days: (number | null)[] = [];
            
            for (let i = 0; i < startOffset; i++) days.push(null);
            for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
            while (days.length % 7 !== 0) days.push(null);
            
            const rows: (number | null)[][] = [];
            for (let i = 0; i < days.length; i += 7) {
              rows.push(days.slice(i, i + 7));
            }
            
            // Trova rifornimenti del mese
            const rifornimentiMese: { [day: number]: number } = {};
            storicoCarburante.forEach(c => {
              const d = new Date(c.data);
              if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                const day = d.getDate();
                rifornimentiMese[day] = (rifornimentiMese[day] || 0) + c.euro;
              }
            });
            
            return rows.map((row, ri) => (
              <View key={ri} style={s.calRow}>
                {row.map((day, di) => {
                  const hasRif = day && rifornimentiMese[day];
                  const isToday = day === now.getDate();
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[s.calDay, isToday && s.calDayToday]}
                      disabled={!hasRif}
                      onPress={() => {
                        if (hasRif) {
                          const msg = `${day} ${MESI_SHORT[now.getMonth()]}: €${rifornimentiMese[day!].toFixed(0)}`;
                          if (Platform.OS === 'web') window.alert(msg);
                          else Alert.alert('Rifornimento', msg);
                        }
                      }}
                    >
                      <Text style={[s.calDayTxt, isToday && { color: '#FFF' }]}>{day || ''}</Text>
                      {hasRif && <View style={s.calDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ));
          })()}
        </View>
      </View>

      {/* ═══ MODAL AGGIUNGI RIFORNIMENTO ═══ */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowAddModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>{t('gas.addRefuel') || 'NUOVO RIFORNIMENTO'}</Text>
            
            <TouchableOpacity onPress={() => setShowCalendar(true)} style={s.dateBtn}>
              <Ionicons name="calendar" size={18} color="#1E7F85" />
              <Text style={s.dateTxt}>
                {selectedDate.getDate()} {MESI_SHORT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </Text>
            </TouchableOpacity>
            
            <View style={s.inputWrap}>
              <TextInput
                style={s.bigInput}
                placeholder="0.00"
                placeholderTextColor="#C0B5A5"
                keyboardType="numeric"
                value={euroText}
                onChangeText={setEuroText}
                textAlign="center"
                selectTextOnFocus
              />
              <Text style={s.eurSign}>€</Text>
            </View>
            
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#B0A898' }]} onPress={() => setShowAddModal(false)}>
                <Text style={s.modalBtnTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#1E7F85' }]} onPress={handleSalva}>
                <Ionicons name="save-outline" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => {
          setSelectedDate(date);
          setShowCalendar(false);
        }}
        initialDate={selectedDate}
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
  // Barra rifornimento
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  addBarTxt: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addBarEuro: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  // Filtri
  filterRow: {
    flexDirection: 'row',
    gap: 8,
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
    fontSize: 11,
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
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(0,0,0,0.08)',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  // Grafico
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    flex: 1,
    minHeight: 140,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValue: {
    fontSize: 8,
    fontWeight: '700',
    color: '#5A7575',
    marginBottom: 2,
  },
  barContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 60,
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#7A9090',
    marginTop: 4,
    fontWeight: '600',
  },
  // Calendario mini
  calendarCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  miniCalendar: {
    marginTop: 4,
  },
  calRow: {
    flexDirection: 'row',
  },
  calDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
    paddingVertical: 4,
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  calDayToday: {
    backgroundColor: '#1E7F85',
    borderRadius: 12,
  },
  calDayTxt: {
    fontSize: 11,
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  bigInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 16,
  },
  eurSign: {
    fontSize: 24,
    fontWeight: '700',
    color: '#7A9090',
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
});
