import React, { useState, useMemo } from 'react';
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
import { useAppStore } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';
import { useTranslation } from 'react-i18next';

type FiltroGas = 'SETT.' | 'MESE' | 'ANNO';

const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function GasScreen() {
  const { storicoCarburante, storicoGiornate, addCarburante, removeCarburante } = useAppStore();
  const { t } = useTranslation();

  const [filtro, setFiltro] = useState<FiltroGas>('MESE');
  const [euroText, setEuroText] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCronologia, setShowCronologia] = useState(false);

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
    // ANNO = tutto

    const totaleCarb = filteredCarb.reduce((s, c) => s + c.euro, 0);
    const totaleKm = filteredGiornate.reduce((s, g) => s + (g.km || 0), 0);
    const costoKm = totaleKm > 0 ? totaleCarb / totaleKm : 0;

    return { totaleCarb, totaleKm, costoKm, filteredCarb };
  }, [storicoCarburante, storicoGiornate, filtro]);

  /* ═══ DATI GRAFICO ═══ */
  const chartData = useMemo(() => {
    if (filtro === 'ANNO') {
      // Mostra totale per ogni mese dell'anno corrente
      const monthlyTotals = Array(12).fill(0);
      const currentYear = new Date().getFullYear();
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d.getFullYear() === currentYear) {
          monthlyTotals[d.getMonth()] += c.euro;
        }
      });
      return {
        values: monthlyTotals,
        labels: MESI_SHORT,
        type: 'anno'
      };
    } else if (filtro === 'MESE') {
      // Ultime 4 settimane
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
      return {
        values: weeks,
        labels: ['Sett.4', 'Sett.3', 'Sett.2', 'Sett.1'],
        type: 'mese'
      };
    } else {
      // Settimana - ultimi 7 giorni
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
      return {
        values: days,
        labels: dayLabels,
        type: 'sett'
      };
    }
  }, [storicoCarburante, filtro]);

  /* ═══ CRONOLOGIA - ultimi 10 rifornimenti ═══ */
  const cronologiaFiltrata = useMemo(() => {
    if (filtro === 'ANNO') {
      // Per ANNO mostra riepilogo mensile
      const monthlyData: { mese: string; totale: number; count: number }[] = [];
      const currentYear = new Date().getFullYear();
      const monthlyTotals: { [key: number]: { totale: number; count: number } } = {};
      
      storicoCarburante.forEach(c => {
        const d = new Date(c.data);
        if (d.getFullYear() === currentYear) {
          const m = d.getMonth();
          if (!monthlyTotals[m]) monthlyTotals[m] = { totale: 0, count: 0 };
          monthlyTotals[m].totale += c.euro;
          monthlyTotals[m].count += 1;
        }
      });
      
      Object.keys(monthlyTotals).forEach(mIdx => {
        const m = parseInt(mIdx);
        monthlyData.push({
          mese: MESI_SHORT[m],
          totale: monthlyTotals[m].totale,
          count: monthlyTotals[m].count
        });
      });
      
      return { type: 'mensile' as const, data: monthlyData.sort((a, b) => MESI_SHORT.indexOf(b.mese) - MESI_SHORT.indexOf(a.mese)) };
    } else {
      // Per SETT e MESE mostra ultimi 10 rifornimenti
      const sorted = [...statsFiltrate.filteredCarb]
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .slice(0, 10);
      return { type: 'dettaglio' as const, data: sorted };
    }
  }, [statsFiltrate.filteredCarb, storicoCarburante, filtro]);

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
    if (Platform.OS === 'web') window.alert(t('gas.refuelSaved') || 'Rifornimento salvato');
    else Alert.alert(t('common.saved'), t('gas.refuelSaved'));
  };

  /* ═══ CANCELLA RIFORNIMENTO ═══ */
  const handleDelete = (itemData: Date, itemEuro: number) => {
    const itemDateTime = new Date(itemData).getTime();
    
    // Trova l'indice nell'array originale
    let origIndex = -1;
    for (let i = 0; i < storicoCarburante.length; i++) {
      const c = storicoCarburante[i];
      if (new Date(c.data).getTime() === itemDateTime && c.euro === itemEuro) {
        origIndex = i;
        break;
      }
    }
    
    if (origIndex === -1) {
      console.error('Rifornimento non trovato');
      return;
    }

    const doDelete = () => {
      removeCarburante(origIndex);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Eliminare questo rifornimento?')) {
        doDelete();
      }
    } else {
      Alert.alert('Elimina', 'Eliminare questo rifornimento?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const maxChartVal = Math.max(...chartData.values, 1);

  return (
    <View style={s.root}>
      {/* ═══ HEADER FISSO ═══ */}
      <View style={s.stickyHeader}>
        <Text style={s.pageTitle}>{t('gas.title')}</Text>

        {/* Input rifornimento */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('gas.addRefuel')}</Text>
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
          <TouchableOpacity onPress={handleSalva} style={s.saveBtn} activeOpacity={0.8}>
            <Ionicons name="save-outline" size={16} color="#FFF" />
            <Text style={s.saveTxt}>{t('gas.saveRefuel')}</Text>
          </TouchableOpacity>
        </View>

        {/* Filtro periodo */}
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

        {/* KPI filtrate */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.costPerKm')}</Text>
            <Text style={[s.kpiValue, { color: '#1E7F85' }]}>€{statsFiltrate.costoKm.toFixed(2)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.totalSpent')}</Text>
            <Text style={[s.kpiValue, { color: '#E8A060' }]}>€{statsFiltrate.totaleCarb.toFixed(0)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.totalKm')}</Text>
            <Text style={[s.kpiValue, { color: '#5A7575' }]}>{statsFiltrate.totaleKm.toFixed(0)}</Text>
          </View>
        </View>
      </View>

      {/* ═══ CONTENUTO SCROLLABILE ═══ */}
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Grafico a barre */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>
            {filtro === 'ANNO' ? 'SPESA MENSILE' : `TREND: ${filtro}`}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, paddingTop: 10 }}>
            {chartData.values.map((val, i) => {
              const h = maxChartVal > 0 ? (val / maxChartVal) * 100 : 5;
              const barW = chartData.values.length > 8 ? 18 : 32;
              return (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#5A7575', marginBottom: 3 }}>
                    {val > 0 ? `€${val.toFixed(0)}` : ''}
                  </Text>
                  <View style={{ height: 100, justifyContent: 'flex-end' }}>
                    <View style={{ 
                      width: barW, 
                      height: `${Math.max(h, 5)}%`, 
                      backgroundColor: val > 0 ? '#1E7F85' : '#C0D0C8', 
                      borderRadius: 4, 
                      minHeight: 5 
                    }} />
                  </View>
                  <Text style={{ fontSize: 9, color: '#7A9090', marginTop: 4, fontWeight: '600' }}>
                    {chartData.labels[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Cronologia - a tendina */}
        <TouchableOpacity 
          style={s.cronologiaHeader} 
          onPress={() => setShowCronologia(!showCronologia)}
          activeOpacity={0.7}
        >
          <Text style={s.sectionTitleOut}>
            {filtro === 'ANNO' ? 'RIEPILOGO MENSILE' : 'CRONOLOGIA (ultimi 10)'}
          </Text>
          <Ionicons 
            name={showCronologia ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#5A7575" 
          />
        </TouchableOpacity>

        {showCronologia && (
          <View style={s.cronologiaContent}>
            {cronologiaFiltrata.type === 'mensile' ? (
              // Vista ANNO - riepilogo mensile
              cronologiaFiltrata.data.length === 0 ? (
                <View style={s.card}>
                  <Text style={[s.kpiLabel, { textAlign: 'center', paddingVertical: 20 }]}>
                    Nessun rifornimento quest'anno
                  </Text>
                </View>
              ) : (
                cronologiaFiltrata.data.map((item, i) => (
                  <View key={i} style={s.monthCard}>
                    <View style={s.monthBadge}>
                      <Text style={s.monthBadgeTxt}>{item.mese.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.monthCount}>{item.count} riforniment{item.count === 1 ? 'o' : 'i'}</Text>
                    </View>
                    <Text style={s.monthTotal}>€{item.totale.toFixed(0)}</Text>
                  </View>
                ))
              )
            ) : (
              // Vista SETT/MESE - dettaglio ultimi 10
              cronologiaFiltrata.data.length === 0 ? (
                <View style={s.card}>
                  <Text style={[s.kpiLabel, { textAlign: 'center', paddingVertical: 20 }]}>
                    {t('gas.noRefuels')}
                  </Text>
                </View>
              ) : (
                cronologiaFiltrata.data.map((item, i) => {
                  const d = new Date(item.data);
                  return (
                    <View key={i} style={s.historyCard}>
                      <Text style={s.historyDate}>
                        {d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={s.historyEuro}>€{item.euro.toFixed(2)}</Text>
                        <TouchableOpacity 
                          onPress={() => handleDelete(item.data, item.euro)} 
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                          style={s.trashBtn}
                        >
                          <Ionicons name="trash" size={22} color="#D46A6A" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => { setSelectedDate(date); setShowCalendar(false); }}
        initialDate={selectedDate}
        themeColor="#1E7F85"
        title={t('gas.refuelDate')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  stickyHeader: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#D8EDE5', zIndex: 10 },
  scrollContent: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: '#1A4040', textAlign: 'center', letterSpacing: 1.5, marginBottom: 14 },

  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, marginBottom: 14,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },

  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' },
  sectionTitleOut: { fontSize: 12, fontWeight: '800', color: '#5A7575', letterSpacing: 1 },

  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  dateTxt: { fontSize: 14, fontWeight: '700', color: '#1A3535' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bigInput: { fontSize: 32, fontWeight: '900', color: '#1E7F85', minWidth: 120, textAlign: 'center', padding: 0 },
  eurSign: { fontSize: 24, fontWeight: '700', color: '#1E7F85', marginLeft: 4 },

  saveBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  saveTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1, backgroundColor: '#EDE8DA', borderRadius: 14, padding: 10, alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  kpiLabel: { fontSize: 9, fontWeight: '700', color: '#5A7575', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '900' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 12, paddingVertical: 10, alignItems: 'center',
  },
  filterOn: { backgroundColor: '#1E7F85' },
  filterTxt: { fontSize: 12, fontWeight: '800', color: '#4A3A2A' },

  cronologiaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  cronologiaContent: {
    marginBottom: 10,
  },

  historyCard: {
    backgroundColor: '#EDE8DA', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#1A3535' },
  historyEuro: { fontSize: 18, fontWeight: '800', color: '#1E7F85' },
  trashBtn: {
    padding: 8,
    backgroundColor: 'rgba(212,106,106,0.1)',
    borderRadius: 8,
  },

  monthCard: {
    backgroundColor: '#EDE8DA', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  monthBadge: {
    backgroundColor: '#1E7F85',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  monthCount: { fontSize: 12, fontWeight: '600', color: '#5A7575' },
  monthTotal: { fontSize: 20, fontWeight: '900', color: '#E8A060' },
});
