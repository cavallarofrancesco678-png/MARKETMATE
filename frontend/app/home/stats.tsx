import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';

const { width: screenW } = Dimensions.get('window');

type FilterTempo = 'Oggi' | 'Sett.' | 'Mese' | 'Anno';

/* ── helpers ── */
const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const isSameWeek = (d1: Date, d2: Date) => {
  const s1 = new Date(d1); s1.setDate(s1.getDate() - ((s1.getDay() + 6) % 7));
  const s2 = new Date(d2); s2.setDate(s2.getDate() - ((s2.getDay() + 6) % 7));
  return s1.toDateString() === s2.toDateString();
};
const isSameMonth = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
const isSameYear = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear();

const METEO_ICONS: { icon: string; label: string; color: string }[] = [
  { icon: 'weather-sunny', label: 'SOLE', color: '#F5A623' },
  { icon: 'weather-cloudy', label: 'NUVOLO', color: '#8899AA' },
  { icon: 'weather-rainy', label: 'PIOGGIA', color: '#5A90C0' },
  { icon: 'weather-lightning-rainy', label: 'TEMP', color: '#7A60BB' },
  { icon: 'weather-windy', label: 'VENTO', color: '#60B0A0' },
];

export default function StatsScreen() {
  const { storicoGiornate, storicoCarburante, speseAnnue, collaboratori, fornitori, isAlimentare, agenda, targetMensile } = useAppStore();
  const [filtro, setFiltro] = useState<FilterTempo>('Sett.');

  const now = new Date();

  /* ── filter data ── */
  const filteredGiornate = storicoGiornate.filter((g) => {
    const d = new Date(g.data);
    if (filtro === 'Oggi') return isSameDay(d, now);
    if (filtro === 'Sett.') return isSameWeek(d, now);
    if (filtro === 'Mese') return isSameMonth(d, now);
    if (filtro === 'Anno') return isSameYear(d, now);
    return true;
  });

  const filteredCarburante = storicoCarburante.filter((c) => {
    const d = new Date(c.data);
    if (filtro === 'Oggi') return isSameDay(d, now);
    if (filtro === 'Sett.') return isSameWeek(d, now);
    if (filtro === 'Mese') return isSameMonth(d, now);
    if (filtro === 'Anno') return isSameYear(d, now);
    return true;
  });

  /* ── KPIs ── */
  const totLordo = filteredGiornate.reduce((s, g) => s + (g.lordo || 0), 0);
  const totNetto = filteredGiornate.reduce((s, g) => s + (g.netto || 0), 0);
  const totContanti = filteredGiornate.reduce((s, g) => s + (g.contanti || 0), 0);
  const totPos = filteredGiornate.reduce((s, g) => s + (g.pos || 0), 0);
  const totCarburante = filteredCarburante.reduce((s, c) => s + (c.euro || 0), 0);
  const totKm = filteredGiornate.reduce((s, g) => s + (g.km || 0), 0);
  const giorniLav = filteredGiornate.length;
  const mediaGG = giorniLav > 0 ? totLordo / giorniLav : 0;

  /* ── meteo stats ── */
  const meteoCounts = [0, 0, 0, 0, 0];
  filteredGiornate.forEach((g) => {
    const idx = ['SOLE', 'NUVOLO', 'PIOGGIA', 'TEMP', 'VENTO'].indexOf(g.meteo || 'SOLE');
    if (idx >= 0) meteoCounts[idx]++;
  });

  /* ── bar chart data (last 7 items or by period) ── */
  const chartData = filteredGiornate.slice(-7).map((g) => ({
    value: g.lordo || 0,
    label: `${new Date(g.data).getDate()}/${new Date(g.data).getMonth() + 1}`,
  }));
  const maxChart = Math.max(...chartData.map((d) => d.value), 1);

  /* ── target ── */
  const progressoTarget = filtro === 'Mese' && targetMensile > 0 ? Math.min(totLordo / targetMensile, 1) : 0;

  /* ── spese fisse torta ── */
  const fattoreTempo = filtro === 'Oggi' ? 1 / 365 : filtro === 'Sett.' ? 1 / 52 : filtro === 'Mese' ? 1 / 12 : 1;
  const totSpeseFisse = speseAnnue.reduce((s, sp) => s + sp.importo * fattoreTempo, 0) +
    agenda.reduce((s, m) => s + m.p_annuo * fattoreTempo, 0);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={s.pageTitle}>ANALISI</Text>

        {/* Period filter */}
        <View style={s.filterRow}>
          {(['Oggi', 'Sett.', 'Mese', 'Anno'] as FilterTempo[]).map((f) => {
            const on = filtro === f;
            return (
              <TouchableOpacity key={f} style={[s.filterBtn, on && s.filterOn]} onPress={() => setFiltro(f)}>
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Target progress (solo mese) */}
        {filtro === 'Mese' && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={s.labelSm}>OBIETTIVO MENSILE</Text>
              <Text style={s.labelBold}>{Math.round(progressoTarget * 100)}%</Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${progressoTarget * 100}%`, backgroundColor: progressoTarget >= 1 ? '#5AAA6A' : '#1E7F85' }]} />
            </View>
            <Text style={[s.labelSm, { textAlign: 'center', marginTop: 6 }]}>€{totLordo.toFixed(0)} / €{targetMensile}</Text>
          </View>
        )}

        {/* KPI Row */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>LORDO</Text>
            <Text style={[s.kpiValue, { color: '#1E7F85' }]}>€{totLordo.toFixed(0)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>NETTO</Text>
            <Text style={[s.kpiValue, { color: totNetto >= 0 ? '#5AAA6A' : '#D46A6A' }]}>€{totNetto.toFixed(0)}</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>MEDIA/GG</Text>
            <Text style={[s.kpiValue, { color: '#1E7F85' }]}>€{mediaGG.toFixed(0)}</Text>
            <Text style={s.kpiSub}>{giorniLav} giorni</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>CARBURANTE</Text>
            <Text style={[s.kpiValue, { color: '#E8A060' }]}>€{totCarburante.toFixed(0)}</Text>
            <Text style={s.kpiSub}>{totKm.toFixed(0)} km</Text>
          </View>
        </View>

        {/* Cash flow */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>FLUSSI DI CASSA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Ionicons name="cash" size={22} color="#5AAA6A" />
              <Text style={s.labelSm}>Contanti</Text>
              <Text style={[s.kpiValue, { color: '#5AAA6A', fontSize: 20 }]}>€{totContanti.toFixed(0)}</Text>
            </View>
            <View style={{ width: 1, height: 50, backgroundColor: '#C5DDD4' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Ionicons name="card" size={22} color="#1E7F85" />
              <Text style={s.labelSm}>POS</Text>
              <Text style={[s.kpiValue, { color: '#1E7F85', fontSize: 20 }]}>€{totPos.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Bar chart */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>INCASSI LORDI</Text>
          {chartData.length === 0 ? (
            <Text style={[s.labelSm, { textAlign: 'center', paddingVertical: 20 }]}>Nessun dato disponibile</Text>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 }}>
              {chartData.map((d, i) => {
                const h = maxChart > 0 ? (d.value / maxChart) * 100 : 5;
                return (
                  <View key={i} style={{ alignItems: 'center', width: 32 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: '#5A7575', marginBottom: 4 }}>€{d.value.toFixed(0)}</Text>
                    <View style={{ height: 90, justifyContent: 'flex-end' }}>
                      <View style={{ width: 20, height: `${h}%`, backgroundColor: '#1E7F85', borderRadius: 4, minHeight: 5 }} />
                    </View>
                    <Text style={{ fontSize: 8, color: '#7A9090', marginTop: 4 }}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Spese fisse */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.sectionTitle}>SPESE FISSE (PERIODO)</Text>
            <Text style={s.labelBold}>€{totSpeseFisse.toFixed(0)}</Text>
          </View>
          {speseAnnue.length === 0 && agenda.every((m) => m.p_annuo === 0) ? (
            <Text style={[s.labelSm, { fontStyle: 'italic' }]}>Nessuna spesa fissa inserita</Text>
          ) : (
            <>
              {speseAnnue.map((sp, i) => (
                <View key={i} style={s.detailRow}>
                  <Text style={s.detailLabel}>{sp.voce}</Text>
                  <Text style={s.detailValue}>€{(sp.importo * fattoreTempo).toFixed(0)}</Text>
                </View>
              ))}
              {agenda.filter((m) => m.p_annuo > 0).map((m, i) => (
                <View key={`p${i}`} style={s.detailRow}>
                  <Text style={s.detailLabel}>Plat. {m.mercato}</Text>
                  <Text style={s.detailValue}>€{(m.p_annuo * fattoreTempo).toFixed(0)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Meteo stats */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>STATISTICA METEO</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }}>
            {METEO_ICONS.map((w, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: w.color }}>{meteoCounts[i]}</Text>
                <MaterialCommunityIcons name={w.icon as any} size={20} color={w.color} />
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>RIEPILOGO</Text>
          <View style={s.detailRow}><Text style={s.detailLabel}>Giorni lavorati</Text><Text style={s.detailValue}>{giorniLav}</Text></View>
          <View style={s.detailRow}><Text style={s.detailLabel}>Km totali</Text><Text style={s.detailValue}>{totKm.toFixed(0)} km</Text></View>
          <View style={s.detailRow}><Text style={s.detailLabel}>Carburante</Text><Text style={s.detailValue}>€{totCarburante.toFixed(0)}</Text></View>
          <View style={s.detailRow}><Text style={s.detailLabel}>Costo medio/km</Text><Text style={s.detailValue}>€{totKm > 0 ? (totCarburante / totKm).toFixed(2) : '0.00'}</Text></View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  scroll: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#1A4040', textAlign: 'center', letterSpacing: 1.5, marginBottom: 20 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 12, paddingVertical: 10, alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(155,145,125,0.45), -3px -3px 8px rgba(255,255,250,0.85)',
  },
  filterOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5), -3px -3px 8px rgba(45,120,125,0.35)',
  },
  filterTxt: { fontSize: 11, fontWeight: '800', color: '#4A3A2A' },

  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, marginBottom: 14,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },

  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: '#5A7575', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiSub: { fontSize: 9, color: '#7A9090', marginTop: 2 },

  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginBottom: 12 },
  labelSm: { fontSize: 11, fontWeight: '600', color: '#5A7575' },
  labelBold: { fontSize: 13, fontWeight: '800', color: '#1A3535' },

  progressBar: { height: 10, backgroundColor: '#C5DDD4', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#D8EDE5' },
  detailLabel: { fontSize: 13, color: '#5A7575' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
});
