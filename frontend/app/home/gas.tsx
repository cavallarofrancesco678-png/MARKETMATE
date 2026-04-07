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
import { useAppStore, Carburante } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';
import { useTranslation } from 'react-i18next';

type FiltroGas = 'SETT.' | 'MESE' | 'ANNO' | 'CUSTOM';

const LABELS: Record<string, string[]> = {
  'SETT.': ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
  'MESE': ['S1', 'S2', 'S3', 'S4'],
  'ANNO': ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'],
};

export default function GasScreen() {
  const { storicoCarburante, storicoGiornate, agenda, addCarburante, removeCarburante } = useAppStore();
  const { t } = useTranslation();

  const [filtro, setFiltro] = useState<FiltroGas>('SETT.');
  const [euroText, setEuroText] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Custom period
  const [showCustomFrom, setShowCustomFrom] = useState(false);
  const [showCustomTo, setShowCustomTo] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
  });
  const [customTo, setCustomTo] = useState(new Date());

  /* Stats */
  const totaleCarb = storicoCarburante.reduce((s, c) => s + c.euro, 0);
  const totaleKm = storicoGiornate.reduce((s, g) => s + (g.km || 0), 0);
  const costoKm = totaleKm > 0 ? totaleCarb / totaleKm : 0;

  /* Costo carburante per mercato */
  const costoPerMercato = useMemo(() => {
    if (totaleKm === 0 || totaleCarb === 0) return [];
    const costPerKm = totaleCarb / totaleKm;
    const mercatoKm: Record<string, { km: number; giorni: number }> = {};
    storicoGiornate.forEach((g) => {
      const nome = g.mercato || 'Altro';
      if (!mercatoKm[nome]) mercatoKm[nome] = { km: 0, giorni: 0 };
      mercatoKm[nome].km += g.km || 0;
      mercatoKm[nome].giorni += 1;
    });
    return Object.entries(mercatoKm)
      .map(([nome, data]) => ({
        nome,
        kmTotali: data.km,
        costoTotale: Math.round(data.km * costPerKm),
        costoMedio: data.giorni > 0 ? Math.round((data.km * costPerKm) / data.giorni) : 0,
        giorni: data.giorni,
      }))
      .filter((m) => m.kmTotali > 0)
      .sort((a, b) => b.costoTotale - a.costoTotale);
  }, [storicoGiornate, totaleCarb, totaleKm]);

  /* Save */
  const handleSalva = () => {
    const euro = parseFloat(euroText.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.invalidAmount'));
      else Alert.alert(t('common.error'), t('gas.invalidAmount'));
      return;
    }
    addCarburante({ data: selectedDate, euro });
    setEuroText('');
    if (Platform.OS === 'web') window.alert(t('gas.refuelSaved'));
    else Alert.alert(t('common.saved'), t('gas.refuelSaved'));
  };

  /* Delete — uses original store index */
  const handleDelete = (cronologiaIndex: number) => {
    const sorted = [...storicoCarburante].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const item = sorted[cronologiaIndex];
    if (!item) return;
    // Find the original index in the unsorted store array
    const origIndex = storicoCarburante.findIndex((c) =>
      new Date(c.data).toISOString() === new Date(item.data).toISOString() && c.euro === item.euro
    );
    if (origIndex === -1) return;

    const doDelete = () => removeCarburante(origIndex);

    if (Platform.OS === 'web') {
      if (window.confirm(t('gas.deleteRefuel') || 'Eliminare questo rifornimento?')) doDelete();
    } else {
      Alert.alert(t('common.delete') || 'Elimina', t('gas.deleteRefuel') || 'Eliminare questo rifornimento?', [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        { text: t('common.delete') || 'Elimina', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  /* Chart data */
  const calcChartData = (): number[] => {
    if (filtro === 'CUSTOM') {
      // Group by day for custom period
      const days: Record<string, number> = {};
      storicoCarburante.forEach((c) => {
        const d = new Date(c.data);
        if (d >= customFrom && d <= customTo) {
          const key = d.toISOString().split('T')[0];
          days[key] = (days[key] || 0) + c.euro;
        }
      });
      return Object.values(days).slice(-10);
    }
    if (filtro === 'SETT.') {
      const d = Array(7).fill(0);
      storicoCarburante.forEach((c) => { d[new Date(c.data).getDay() === 0 ? 6 : new Date(c.data).getDay() - 1] += c.euro; });
      return d;
    } else if (filtro === 'MESE') {
      const d = Array(4).fill(0);
      storicoCarburante.forEach((c) => { d[Math.min(Math.floor((new Date(c.data).getDate() - 1) / 8), 3)] += c.euro; });
      return d;
    } else {
      const d = Array(12).fill(0);
      storicoCarburante.forEach((c) => { d[new Date(c.data).getMonth()] += c.euro; });
      return d;
    }
  };

  const chartData = calcChartData();
  const chartLabels = filtro === 'CUSTOM'
    ? chartData.map((_, i) => `${i + 1}`)
    : (LABELS[filtro] || []);
  const maxVal = Math.max(...chartData, 1);

  /* History sorted */
  const cronologia = [...storicoCarburante].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

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
              {selectedDate.getDate()} {mesi[selectedDate.getMonth()]} {selectedDate.getFullYear()}
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

        {/* KPI */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.costPerKm')}</Text>
            <Text style={[s.kpiValue, { color: '#1E7F85' }]}>€{costoKm.toFixed(2)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.totalSpent')}</Text>
            <Text style={[s.kpiValue, { color: '#E8A060' }]}>€{totaleCarb.toFixed(0)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>{t('gas.totalKm')}</Text>
            <Text style={[s.kpiValue, { color: '#5A7575' }]}>{totaleKm.toFixed(0)}</Text>
          </View>
        </View>

        {/* Filtro periodo: SETT. MESE ANNO + PERSONALIZZA */}
        <View style={s.filterRow}>
          {(['SETT.', 'MESE', 'ANNO', 'CUSTOM'] as FiltroGas[]).map((f) => {
            const on = filtro === f;
            const label = f === 'CUSTOM' ? '📅' : f;
            return (
              <TouchableOpacity
                key={f}
                style={[s.filterBtn, on && s.filterOn]}
                onPress={() => {
                  setFiltro(f);
                  if (f === 'CUSTOM') setShowCustomFrom(true);
                }}
              >
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtro === 'CUSTOM' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setShowCustomFrom(true)} style={s.customDateBtn}>
              <Text style={s.customDateTxt}>DA: {customFrom.getDate()}/{customFrom.getMonth()+1}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCustomTo(true)} style={s.customDateBtn}>
              <Text style={s.customDateTxt}>A: {customTo.getDate()}/{customTo.getMonth()+1}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ═══ CONTENUTO SCROLLABILE ═══ */}
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Grafico a barre */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>TREND: {filtro === 'CUSTOM' ? 'PERSONALIZZATO' : filtro}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, paddingTop: 10 }}>
            {chartData.map((val, i) => {
              const h = maxVal > 0 ? (val / maxVal) * 100 : 5;
              const barW = chartData.length > 10 ? 14 : 28;
              return (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#5A7575', marginBottom: 3 }}>€{val.toFixed(0)}</Text>
                  <View style={{ height: 100, justifyContent: 'flex-end' }}>
                    <View style={{ width: barW, height: `${Math.max(h, 5)}%`, backgroundColor: '#1E7F85', borderRadius: 4, minHeight: 5 }} />
                  </View>
                  <Text style={{ fontSize: 9, color: '#7A9090', marginTop: 4 }}>{chartLabels[i] || ''}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Costo carburante per mercato */}
        {costoPerMercato.length > 0 && (
          <>
            <Text style={s.sectionTitleOut}>{t('gas.costPerMarket')}</Text>
            <View style={s.card}>
              {costoPerMercato.map((m, i) => (
                <View key={i} style={[s.mercatoRow, i < costoPerMercato.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#D8EDE5' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mercatoName}>{m.nome}</Text>
                    <Text style={s.mercatoInfo}>{m.kmTotali} km · {m.giorni} gg · media €{m.costoMedio}/gg</Text>
                  </View>
                  <Text style={s.mercatoEuro}>€{m.costoTotale}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Cronologia */}
        <Text style={s.sectionTitleOut}>{t('gas.history')}</Text>
        {cronologia.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.kpiLabel, { textAlign: 'center', paddingVertical: 20 }]}>{t('gas.noRefuels')}</Text>
          </View>
        ) : (
          cronologia.map((item, i) => {
            const d = new Date(item.data);
            return (
              <View key={i} style={s.historyCard}>
                <Text style={s.historyDate}>{d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={s.historyEuro}>€{item.euro.toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(i)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="trash" size={20} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
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
        title={t('gas.refuelDate')}
      />
      <CalendarModal
        visible={showCustomFrom}
        onClose={() => setShowCustomFrom(false)}
        onSelect={(date) => { setCustomFrom(date); setShowCustomFrom(false); setShowCustomTo(true); }}
        initialDate={customFrom}
        themeColor="#1E7F85"
        title="DATA INIZIO"
      />
      <CalendarModal
        visible={showCustomTo}
        onClose={() => setShowCustomTo(false)}
        onSelect={(date) => { setCustomTo(date); setShowCustomTo(false); }}
        initialDate={customTo}
        themeColor="#1E7F85"
        title="DATA FINE"
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
  sectionTitleOut: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginBottom: 12 },

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

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  filterBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 12, paddingVertical: 8, alignItems: 'center',
  },
  filterOn: { backgroundColor: '#1E7F85' },
  filterTxt: { fontSize: 11, fontWeight: '800', color: '#4A3A2A' },

  customDateBtn: {
    backgroundColor: '#EDE8DA', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12,
  },
  customDateTxt: { fontSize: 11, fontWeight: '700', color: '#1E7F85' },

  historyCard: {
    backgroundColor: '#EDE8DA', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#1A3535' },
  historyEuro: { fontSize: 18, fontWeight: '800', color: '#1E7F85' },

  mercatoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  mercatoName: { fontSize: 14, fontWeight: '800', color: '#1A3535' },
  mercatoInfo: { fontSize: 10, fontWeight: '600', color: '#7A9090', marginTop: 2 },
  mercatoEuro: { fontSize: 18, fontWeight: '900', color: '#E8A060' },
});
