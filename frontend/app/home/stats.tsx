import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { MeteoStatsModal } from '../../src/components/MeteoStatsModal';
import type { Giornata } from '../../src/store/appStore';

const { width: screenW } = Dimensions.get('window');

type FilterTempo = 'Pers.' | 'Ieri' | 'Oggi' | 'Sett.' | 'Mese' | 'Anno';
type FilterTipo = 'TUTTO' | 'LUN' | 'MAR' | 'MER' | 'GIO' | 'VEN' | 'SAB' | 'DOM' | 'FIERE';

const PALETTE = [
  '#1A5276', '#1D8348', '#BA4A00', '#922B21',
  '#7D3C98', '#117A65', '#2E4053', '#D4AC0D',
];

const METEO_ICONS = [
  { icon: 'weather-sunny', label: 'SOLE', color: '#F5A623' },
  { icon: 'weather-partly-cloudy', label: 'VAR', color: '#C4A035' },
  { icon: 'weather-cloudy', label: 'NUVOLO', color: '#8899AA' },
  { icon: 'weather-rainy', label: 'PIOGGIA', color: '#5A90C0' },
  { icon: 'weather-lightning-rainy', label: 'TEMP', color: '#7A60BB' },
  { icon: 'weather-windy', label: 'VENTO', color: '#60B0A0' },
];

const GIORNO_MAP: Record<string, number> = {
  'TUTTO': -1, 'LUN': 1, 'MAR': 2, 'MER': 3, 'GIO': 4, 'VEN': 5, 'SAB': 6, 'DOM': 0, 'FIERE': -2,
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const isSameWeek = (d1: Date, d2: Date) => {
  const s1 = new Date(d1); s1.setDate(s1.getDate() - ((s1.getDay() + 6) % 7));
  const s2 = new Date(d2); s2.setDate(s2.getDate() - ((s2.getDay() + 6) % 7));
  return s1.toDateString() === s2.toDateString();
};

const isSameMonth = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
const isSameYear = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear();
const arrSum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

/* ═══ Interactive SVG Line Chart ═══ */
const InteractiveLineChart = ({ labels, lines, height = 140 }: {
  labels: string[];
  lines: { label: string; color: string; data: number[] }[];
  height?: number;
}) => {
  const chartW = screenW - 70;
  const padL = 40;
  const padR = 10;
  const padT = 15;
  const padB = 25;
  const drawW = chartW - padL - padR;
  const drawH = height - padT - padB;

  let maxVal = 1;
  lines.forEach((l) => l.data.forEach((v) => { if (v > maxVal) maxVal = v; }));
  const stepX = labels.length > 1 ? drawW / (labels.length - 1) : drawW;

  return (
    <Svg width={chartW} height={height}>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = padT + drawH - (drawH * i) / 4;
        const val = Math.round((maxVal * i) / 4);
        return (
          <React.Fragment key={i}>
            <Line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#D5DDD8" strokeWidth={0.5} />
            <SvgText x={padL - 5} y={y + 3} fill="#7A9090" fontSize={7} textAnchor="end">
              {'\u20AC'}{val}
            </SvgText>
          </React.Fragment>
        );
      })}
      {lines.map((line, li) => {
        const pts = line.data.map((v, i) => ({
          x: padL + i * stepX,
          y: padT + drawH - (v / maxVal) * drawH,
        }));
        const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        return (
          <React.Fragment key={li}>
            <Path d={pathD} stroke={line.color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={line.color} stroke="#FFF" strokeWidth={1.5} />
            ))}
          </React.Fragment>
        );
      })}
      {labels.map((l, i) => (
        <SvgText key={i} x={padL + i * stepX} y={height - 5} fill="#7A9090" fontSize={7} textAnchor="middle" fontWeight="bold">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
};

/* ═══ Donut Chart SVG ═══ */
const DonutChart = ({ items, size = 70 }: { items: { label: string; value: number; color: string }[]; size?: number }) => {
  const center = size / 2;
  const radius = size / 2 - 6;
  const strokeW = 12;
  const total = arrSum(items.map((i) => i.value)) || 1;
  let startAngle = -Math.PI / 2;

  const arcs = items.map((item, idx) => {
    const angle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return <Path key={idx} d={path} stroke={item.color} strokeWidth={strokeW} fill="none" strokeLinecap="butt" />;
  });

  return <Svg width={size} height={size}>{arcs}</Svg>;
};

/* ══════════════════════════════════════════════════════ */
/*  MAIN STATS SCREEN                                     */
/* ══════════════════════════════════════════════════════ */
export default function StatsScreen() {
  const store = useAppStore();
  const { storicoGiornate, speseAnnue, collaboratori, fornitori, seedMockData } = store;
  const { height: screenH } = useWindowDimensions();
  const GAP = Math.round(1.5 * ((screenH - 80) / 100));

  const [filtroTempo, setFiltroTempo] = useState<FilterTempo>('Sett.');
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('TUTTO');
  const [showMeteo, setShowMeteo] = useState(false);
  const [showFiere, setShowFiere] = useState(false);

  useEffect(() => {
    if (storicoGiornate.length === 0) {
      seedMockData();
    }
  }, []);

  const now = new Date();

  const filteredByTime = useMemo(() => {
    return storicoGiornate.filter((g) => {
      const d = new Date(g.data);
      if (filtroTempo === 'Oggi') return isSameDay(d, now);
      if (filtroTempo === 'Ieri') {
        const ieri = new Date(now); ieri.setDate(ieri.getDate() - 1);
        return isSameDay(d, ieri);
      }
      if (filtroTempo === 'Sett.') return isSameWeek(d, now);
      if (filtroTempo === 'Mese') return isSameMonth(d, now);
      if (filtroTempo === 'Anno') return isSameYear(d, now);
      return true;
    });
  }, [storicoGiornate, filtroTempo]);

  const filteredData = useMemo(() => {
    if (filtroTipo === 'TUTTO') return filteredByTime;
    if (filtroTipo === 'FIERE') return filteredByTime.filter((g) =>
      g.mercato.toLowerCase().includes('fiera') || g.mercato.toLowerCase().includes('sagra'));
    const targetDay = GIORNO_MAP[filtroTipo];
    return filteredByTime.filter((g) => new Date(g.data).getDay() === targetDay);
  }, [filteredByTime, filtroTipo]);

  const totLordo = arrSum(filteredData.map((g) => g.lordo || 0));
  const totNetto = arrSum(filteredData.map((g) => g.netto || 0));
  const totCash = arrSum(filteredData.map((g) => g.contanti || 0));
  const totPos = arrSum(filteredData.map((g) => g.pos || 0));
  const giorniLav = filteredData.length;

  const chartLabels = useMemo(() => {
    if (filtroTempo === 'Anno') return ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
    if (filtroTempo === 'Mese') return ['S1', 'S2', 'S3', 'S4'];
    return ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
  }, [filtroTempo]);

  const groupData = (data: Giornata[], field: (g: Giornata) => number): number[] => {
    if (filtroTempo === 'Anno') {
      const months = Array(12).fill(0);
      data.forEach((g) => { months[new Date(g.data).getMonth()] += field(g); });
      return months;
    }
    if (filtroTempo === 'Mese') {
      const weeks = Array(4).fill(0);
      data.forEach((g) => {
        const weekIdx = Math.min(Math.floor((new Date(g.data).getDate() - 1) / 7), 3);
        weeks[weekIdx] += field(g);
      });
      return weeks;
    }
    const days = Array(7).fill(0);
    data.forEach((g) => {
      const d = new Date(g.data).getDay();
      const idx = d === 0 ? 6 : d - 1;
      days[idx] += field(g);
    });
    return days;
  };

  const economicoLines = [
    { label: 'LORDO', color: PALETTE[0], data: groupData(filteredData, (g) => g.lordo || 0) },
    { label: 'NETTO', color: PALETTE[1], data: groupData(filteredData, (g) => g.netto || 0) },
  ];

  const incassiLines = [
    { label: 'CASH', color: PALETTE[5], data: groupData(filteredData, (g) => g.contanti || 0) },
    { label: 'POS', color: PALETTE[2], data: groupData(filteredData, (g) => g.pos || 0) },
  ];

  const invendutoLines = useMemo(() => {
    const productNames = new Set<string>();
    filteredData.forEach((g) => {
      if (g.dettaglio_invenduto) {
        Object.keys(g.dettaglio_invenduto).forEach((k) => { if (k !== 'totale') productNames.add(k); });
      }
    });
    return Array.from(productNames).slice(0, 7).map((name, i) => ({
      label: name,
      color: PALETTE[i % PALETTE.length],
      data: groupData(filteredData, (g) => (g.dettaglio_invenduto?.[name] || 0)),
    }));
  }, [filteredData, filtroTempo]);

  const collabLines = useMemo(() => {
    const names = new Set<string>();
    filteredData.forEach((g) => {
      if (g.dettaglio_staff) Object.keys(g.dettaglio_staff).forEach((k) => names.add(k));
    });
    return Array.from(names).map((name, i) => ({
      label: name,
      color: PALETTE[(i + 3) % PALETTE.length],
      data: groupData(filteredData, (g) => {
        const val = g.dettaglio_staff?.[name];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? (collaboratori.find((c) => c.nome === name)?.costo || 0) : 0;
        return 0;
      }),
    }));
  }, [filteredData, filtroTempo, collaboratori]);

  const fornitoriLines = useMemo(() => {
    const names = new Set<string>();
    filteredData.forEach((g) => {
      if (g.dettaglio_fornitori) Object.keys(g.dettaglio_fornitori).forEach((k) => names.add(k));
    });
    return Array.from(names).map((name, i) => ({
      label: name,
      color: PALETTE[(i + 1) % PALETTE.length],
      data: groupData(filteredData, (g) => (g.dettaglio_fornitori?.[name] || 0)),
    }));
  }, [filteredData, filtroTempo]);

  const speseFisseItems = useMemo(() => {
    const fattore = filtroTempo === 'Oggi' || filtroTempo === 'Ieri' ? 1 / 365
      : filtroTempo === 'Sett.' ? 1 / 52
      : filtroTempo === 'Mese' ? 1 / 12 : 1;
    return speseAnnue.map((sp, i) => ({
      label: sp.voce,
      value: Math.round(sp.importo * fattore),
      color: [PALETTE[6], '#8899AA', PALETTE[2], PALETTE[7]][i % 4],
    }));
  }, [speseAnnue, filtroTempo]);

  const speseExtraItems = useMemo(() => {
    const totSpeseExtra = arrSum(filteredData.map((g) => g.spese_extra || 0));
    const totInvenduto = arrSum(filteredData.map((g) => {
      if (!g.dettaglio_invenduto) return 0;
      return Object.values(g.dettaglio_invenduto).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    }));
    return [
      { label: 'SPESE EXTRA', value: totSpeseExtra, color: PALETTE[1] },
      { label: 'INVENDUTO', value: totInvenduto, color: PALETTE[3] },
    ].filter((i) => i.value > 0);
  }, [filteredData]);

  const meteoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    METEO_ICONS.forEach((m) => (counts[m.label] = 0));
    filteredData.forEach((g) => {
      const m = g.meteo || 'SOLE';
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [filteredData]);

  const fiereDays = useMemo(() => {
    return filteredByTime
      .filter((g) => g.mercato.toLowerCase().includes('fiera') || g.mercato.toLowerCase().includes('sagra') || g.mercato.toLowerCase().includes('europeo'))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [filteredByTime]);
  const totFiere = arrSum(fiereDays.map((g) => g.lordo || 0));

  const renderFilterBar = (options: string[], selected: string, onSelect: (v: any) => void, mini = false) => (
    <View style={[st.filterRow, { gap: mini ? 4 : 6 }]}>
      {options.map((opt) => {
        const on = selected === opt;
        return (
          <TouchableOpacity key={opt} style={[st.filterBtn, on && st.filterOn, mini && { paddingVertical: 7 }]} onPress={() => onSelect(opt)}>
            <Text style={[st.filterTxt, on && { color: '#FFF' }, mini && { fontSize: 7 }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderChartBox = (title: string, lines: { label: string; color: string; data: number[] }[]) => {
    const totalSection = arrSum(lines.map((l) => arrSum(l.data)));
    if (lines.length === 0) return null;
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <View style={st.chartHeader}>
          <Text style={st.sectionLabel}>{title}</Text>
          <Text style={st.sectionTotal}>TOTALE: {'\u20AC'}{totalSection.toFixed(0)}</Text>
        </View>
        <View style={st.legendRow}>
          {lines.map((l, i) => (
            <View key={i} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: l.color }]} />
              <Text style={[st.legendText, { color: l.color }]}>{l.label}: {'\u20AC'}{arrSum(l.data).toFixed(0)}</Text>
            </View>
          ))}
        </View>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <InteractiveLineChart labels={chartLabels} lines={lines} />
        </View>
      </View>
    );
  };

  const renderDonutBox = (title: string, items: { label: string; value: number; color: string }[]) => {
    const total = arrSum(items.map((i) => i.value));
    if (total === 0) return null;
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <View style={st.chartHeader}>
          <Text style={st.sectionLabel}>{title}</Text>
          <Text style={st.sectionTotal}>TOT: {'\u20AC'}{total}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 16 }}>
          <DonutChart items={items} />
          <View style={{ flex: 1 }}>
            {items.map((it, i) => (
              <Text key={i} style={{ fontSize: 10, fontWeight: '700', color: it.color, marginBottom: 3 }}>
                {it.label}: {'\u20AC'}{it.value}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={[st.scroll, { gap: GAP }]} showsVerticalScrollIndicator={false}>
        <Text style={st.pageTitle}>ANALISI GESTIONALE</Text>

        {renderFilterBar(['Pers.', 'Ieri', 'Oggi', 'Sett.', 'Mese', 'Anno'], filtroTempo, setFiltroTempo)}
        {renderFilterBar(['TUTTO', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM', 'FIERE'], filtroTipo, setFiltroTipo, true)}

        <View style={{ gap: GAP }}>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>LORDO</Text>
              <Text style={[st.kpiValue, { color: PALETTE[0] }]}>{'\u20AC'}{totLordo.toFixed(0)}</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>NETTO</Text>
              <Text style={[st.kpiValue, { color: totNetto >= 0 ? PALETTE[1] : '#D46A6A' }]}>{'\u20AC'}{totNetto.toFixed(0)}</Text>
            </View>
          </View>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>CASH</Text>
              <Text style={[st.kpiValue, { color: PALETTE[5] }]}>{'\u20AC'}{totCash.toFixed(0)}</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>POS</Text>
              <Text style={[st.kpiValue, { color: PALETTE[2] }]}>{'\u20AC'}{totPos.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {renderChartBox('ECONOMICO', economicoLines)}
        {renderChartBox('INCASSI', incassiLines)}
        {renderChartBox('INVENDUTO', invendutoLines)}
        {renderChartBox('COLLABORATORI', collabLines)}
        {renderChartBox('FORNITORI', fornitoriLines)}

        {renderDonutBox('SPESE FISSE', speseFisseItems)}
        {renderDonutBox('SPESE STRAORDINARIE', speseExtraItems)}

        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => setShowFiere(!showFiere)} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="star" size={16} color="#D4AF37" />
                <Text style={st.sectionLabel}>STORICO FIERE</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.sectionTotal}>TOT: {'\u20AC'}{totFiere.toFixed(0)}</Text>
                <Ionicons name={showFiere ? 'chevron-up' : 'chevron-down'} size={16} color="#5A7575" />
              </View>
            </View>
          </TouchableOpacity>
          {showFiere && (
            <View style={{ marginTop: 8 }}>
              {fiereDays.length === 0 ? (
                <Text style={st.emptyText}>Nessuna fiera registrata</Text>
              ) : (
                fiereDays.map((f, i) => {
                  const d = new Date(f.data);
                  const GG = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];
                  const MM = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
                  return (
                    <View key={i} style={st.fieraRow}>
                      <Text style={st.fieraText} numberOfLines={1}>
                        {GG[d.getDay()]} {d.getDate()} {MM[d.getMonth()]} - {f.mercato}
                      </Text>
                      <Text style={st.fieraValue}>{'\u20AC'}{f.lordo.toFixed(0)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={[st.card, { marginBottom: GAP }]}>
          <Text style={st.sectionLabel}>STATISTICA METEO</Text>
          <View style={st.meteoRow}>
            {METEO_ICONS.map((w) => (
              <View key={w.label} style={st.meteoItem}>
                <Text style={[st.meteoCount, { color: w.color }]}>{meteoCounts[w.label] || 0}</Text>
                <MaterialCommunityIcons name={w.icon as any} size={20} color={w.color} />
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[st.meteoBtn, { marginBottom: GAP }]}
          onPress={() => setShowMeteo(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color="#FFF" />
          <Text style={st.meteoBtnTxt}>METEO DETTAGLIATO</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginBottom: GAP }}
          onPress={() => Alert.alert('Report', 'Export PDF in arrivo!')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#D4AF37', '#B8860B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.pdfBtn}
          >
            <Ionicons name="document-text" size={18} color="#FFF" />
            <Text style={st.pdfBtnTxt}>REPORT PDF COMPLETO</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[st.card, { marginBottom: GAP }]}>
          <Text style={st.sectionLabel}>RIEPILOGO</Text>
          {[
            ['Giorni lavorati', `${giorniLav}`],
            ['Media giornaliera', `\u20AC${giorniLav > 0 ? (totLordo / giorniLav).toFixed(0) : '0'}`],
            ['Km totali', `${arrSum(filteredData.map((g) => g.km || 0)).toFixed(0)} km`],
            ['Costo collaboratori', `\u20AC${arrSum(filteredData.map((g) => {
              if (!g.dettaglio_staff) return 0;
              return Object.values(g.dettaglio_staff).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
            })).toFixed(0)}`],
          ].map(([label, value], i) => (
            <View key={i} style={st.riepilogoRow}>
              <Text style={st.riepilogoLabel}>{label}</Text>
              <Text style={st.riepilogoValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <MeteoStatsModal
        visible={showMeteo}
        onClose={() => setShowMeteo(false)}
        giornate={storicoGiornate}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  scroll: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  pageTitle: { fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', letterSpacing: 1.5 },

  filterRow: { flexDirection: 'row' },
  filterBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 10, paddingVertical: 9, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(155,145,125,0.45), -2px -2px 6px rgba(255,255,250,0.85)',
  },
  filterOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(15,55,60,0.5), -2px -2px 6px rgba(45,120,125,0.35)',
  },
  filterTxt: { fontSize: 9, fontWeight: '800', color: '#4A3A2A' },

  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  kpiLabel: { fontSize: 9, fontWeight: '700', color: '#5A7575', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '900' },

  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },

  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5 },
  sectionTotal: { fontSize: 10, fontWeight: '900', color: '#1A3535' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 9, fontWeight: '700' },

  meteoRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  meteoItem: { alignItems: 'center' },
  meteoCount: { fontSize: 14, fontWeight: '900', marginBottom: 2 },

  meteoBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  meteoBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  pdfBtn: {
    borderRadius: 30, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    // @ts-ignore
    boxShadow: '0px 6px 12px rgba(212,175,55,0.4)',
  },
  pdfBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },

  fieraRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#D8EDE5',
  },
  fieraText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#1A3535' },
  fieraValue: { fontSize: 12, fontWeight: '900', color: PALETTE[1], marginLeft: 10 },

  riepilogoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#D8EDE5',
  },
  riepilogoLabel: { fontSize: 12, color: '#5A7575' },
  riepilogoValue: { fontSize: 12, fontWeight: '700', color: '#1A3535' },

  emptyText: { fontSize: 12, color: '#7A9090', fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
});
