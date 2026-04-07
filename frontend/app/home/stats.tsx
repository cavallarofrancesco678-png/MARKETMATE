import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  useWindowDimensions,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { MeteoStatsModal } from '../../src/components/MeteoStatsModal';
import { useTranslation } from 'react-i18next';
import { getDayNames, getMonthNames, getShortDayNames } from '../../src/i18n';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

/* ═══ Interactive SVG Line Chart with Data Labels ═══ */
const InteractiveLineChart = ({ labels, lines, height = 140, activeLineIndex, onPointPress }: {
  labels: string[];
  lines: { label: string; color: string; data: number[] }[];
  height?: number;
  activeLineIndex: number | null;
  onPointPress?: (lineIdx: number, pointIdx: number, value: number) => void;
}) => {
  const chartW = screenW - 70;
  const padL = 40;
  const padR = 10;
  const padT = 28;
  const padB = 25;
  const drawW = chartW - padL - padR;
  const drawH = height - padT - padB;

  let maxVal = 1;
  lines.forEach((l) => l.data.forEach((v) => { if (v > maxVal) maxVal = v; }));
  const stepX = labels.length > 1 ? drawW / (labels.length - 1) : drawW;

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderRelease={(evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        // Build all point positions for touch detection
        const allPoints: { x: number; y: number; li: number; pi: number; val: number }[] = [];
        lines.forEach((line2, li2) => {
          line2.data.forEach((v, i) => {
            allPoints.push({
              x: padL + i * stepX,
              y: padT + drawH - (v / maxVal) * drawH,
              li: li2, pi: i, val: v,
            });
          });
        });
        let closest: typeof allPoints[0] | null = null;
        let minDist = 30;
        allPoints.forEach((p) => {
          const dist = Math.sqrt((p.x - locationX) ** 2 + (p.y - locationY) ** 2);
          if (dist < minDist) { minDist = dist; closest = p; }
        });
        if (closest && onPointPress) {
          onPointPress(closest.li, closest.pi, closest.val);
        }
      }}
    >
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
        const isActive = activeLineIndex === null || activeLineIndex === li;
        if (!isActive) return null; // Linee non attive SPARISCONO completamente
        const pts = line.data.map((v, i) => ({
          x: padL + i * stepX,
          y: padT + drawH - (v / maxVal) * drawH,
          v,
        }));
        const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        return (
          <React.Fragment key={li}>
            <Path d={pathD} stroke={line.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <React.Fragment key={i}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={line.color}
                  stroke="#FFF"
                  strokeWidth={1.5}
                />
                {activeLineIndex !== null && p.v > 0 && (
                  <SvgText x={p.x} y={p.y - 10} fill={line.color} fontSize={9} fontWeight="900" textAnchor="middle">
                    €{p.v.toFixed(0)}
                  </SvgText>
                )}
              </React.Fragment>
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
    </View>
  );
};

/* ═══ Pie Chart SVG (filled) with readable percentages ═══ */
const PIE_COLORS = ['#1E7F85', '#E8A060', '#D46A6A', '#6ABFAA', '#B88A44', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];

const PieChart = ({ items, size = 120 }: { items: { label: string; value: number; color: string }[]; size?: number }) => {
  const center = size / 2;
  const radius = size / 2 - 4;
  const total = arrSum(items.map((i) => i.value)) || 1;
  let startAngle = -Math.PI / 2;

  return (
    <Svg width={size} height={size}>
      {items.map((item, idx) => {
        const angle = (item.value / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const largeArc = angle > Math.PI ? 1 : 0;
        const x1 = center + radius * Math.cos(startAngle);
        const y1 = center + radius * Math.sin(startAngle);
        const x2 = center + radius * Math.cos(endAngle);
        const y2 = center + radius * Math.sin(endAngle);
        const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        const midAngle = startAngle + angle / 2;
        const pct = Math.round((item.value / total) * 100);
        const labelR = radius * 0.6;
        const labelX = center + labelR * Math.cos(midAngle);
        const labelY = center + labelR * Math.sin(midAngle);
        startAngle = endAngle;
        return (
          <React.Fragment key={idx}>
            <Path d={path} fill={item.color} stroke="#D8EDE5" strokeWidth={1} />
            {pct >= 5 && (
              <SvgText x={labelX} y={labelY + 4} fill="#FFF" fontSize={11} fontWeight="900" textAnchor="middle">
                {pct}%
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

/* ══════════════════════════════════════════════════════ */
/*  MAIN STATS SCREEN                                     */
/* ══════════════════════════════════════════════════════ */
export default function StatsScreen() {
  const store = useAppStore();
  const { storicoGiornate, speseAnnue, collaboratori, fornitori, seedMockData } = store;
  const { height: screenH } = useWindowDimensions();
  const GAP = Math.round(1.5 * ((screenH - 80) / 100));
  const { t } = useTranslation();

  const [filtroTempo, setFiltroTempo] = useState<FilterTempo>('Sett.');
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('TUTTO');
  const [showMeteo, setShowMeteo] = useState(false);
  const [showFiere, setShowFiere] = useState(false);
  const [pdfMonth, setPdfMonth] = useState(new Date().getMonth());
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());

  const [activeChartLine, setActiveChartLine] = useState<Record<string, number | null>>({});
  const [tooltipInfo, setTooltipInfo] = useState<{ chartKey: string; lineIdx: number; pointIdx: number; value: number } | null>(null);

  const handleLineTap = (chartKey: string, lineIdx: number) => {
    setActiveChartLine((prev) => ({
      ...prev,
      [chartKey]: prev[chartKey] === lineIdx ? null : lineIdx,
    }));
    setTooltipInfo(null);
  };

  const handlePointPress = (chartKey: string, lineIdx: number, pointIdx: number, value: number) => {
    setTooltipInfo((prev) =>
      prev && prev.chartKey === chartKey && prev.lineIdx === lineIdx && prev.pointIdx === pointIdx
        ? null
        : { chartKey, lineIdx, pointIdx, value }
    );
  };

  const tempoLabel = (key: string) => {
    const map: Record<string, string> = {
      'Pers.': t('stats.personal'), 'Ieri': t('stats.yesterday'), 'Oggi': t('common.today'),
      'Sett.': t('stats.week'), 'Mese': t('stats.month'), 'Anno': t('stats.year'),
    };
    return map[key] || key;
  };

  const tipoLabel = (key: string) => {
    const shortDays = getShortDayNames();
    const dayKeys = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
    const dayIdx = dayKeys.indexOf(key);
    if (dayIdx >= 0) return shortDays[dayIdx];
    if (key === 'TUTTO') return t('stats.all');
    if (key === 'FIERE') return t('stats.fairs');
    return key;
  };

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
    const monthNames = getMonthNames();
    const shortMonths = monthNames.map(m => m.substring(0, 3).toUpperCase());
    const shortDays = getShortDayNames();
    if (filtroTempo === 'Anno') return shortMonths;
    if (filtroTempo === 'Mese') return ['S1', 'S2', 'S3', 'S4'];
    return shortDays;
  }, [filtroTempo, t]);

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
    // Use only collaborator names from Settings
    return collaboratori.map((c, i) => ({
      label: c.nome,
      color: PALETTE[(i + 3) % PALETTE.length],
      data: groupData(filteredData, (g) => {
        const val = g.dettaglio_staff?.[c.nome];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? (c.costo || 0) : 0;
        return 0;
      }),
    }));
  }, [filteredData, filtroTempo, collaboratori]);

  const fornitoriLines = useMemo(() => {
    // Use only fornitore names from Settings
    return fornitori.map((f, i) => ({
      label: f.nome,
      color: PALETTE[(i + 1) % PALETTE.length],
      data: groupData(filteredData, (g) => (g.dettaglio_fornitori?.[f.nome] || 0)),
    }));
  }, [filteredData, filtroTempo, fornitori]);

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

  const renderFilterBar = (options: string[], selected: string, onSelect: (v: any) => void, mini = false, labelFn?: (key: string) => string) => (
    <View style={[st.filterRow, { gap: mini ? 4 : 6 }]}>
      {options.map((opt) => {
        const on = selected === opt;
        const displayLabel = labelFn ? labelFn(opt) : opt;
        return (
          <TouchableOpacity key={opt} style={[st.filterBtn, on && st.filterOn, mini && { paddingVertical: 7 }]} onPress={() => onSelect(opt)}>
            <Text style={[st.filterTxt, on && { color: '#FFF' }, mini && { fontSize: 7 }]}>{displayLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderChartBox = (title: string, lines: { label: string; color: string; data: number[] }[], chartKey: string) => {
    const totalSection = arrSum(lines.map((l) => arrSum(l.data)));
    if (lines.length === 0) return null;
    const activeLine = activeChartLine[chartKey] ?? null;
    const currentTooltip = tooltipInfo && tooltipInfo.chartKey === chartKey ? tooltipInfo : null;
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <View style={st.chartHeader}>
          <Text style={st.sectionLabel}>{title}</Text>
          <Text style={st.sectionTotal}>TOTALE: {'\u20AC'}{totalSection.toFixed(0)}</Text>
        </View>
        {currentTooltip && (
          <View style={st.tooltipBanner}>
            <View style={[st.tooltipDot, { backgroundColor: lines[currentTooltip.lineIdx]?.color }]} />
            <Text style={st.tooltipText}>
              {lines[currentTooltip.lineIdx]?.label}: {'\u20AC'}{currentTooltip.value.toFixed(0)} — {chartLabels[currentTooltip.pointIdx]}
            </Text>
          </View>
        )}
        <View style={st.legendRow}>
          {lines.map((l, i) => {
            const isSelected = activeLine === i;
            const isDimmed = activeLine !== null && activeLine !== i;
            return (
              <Pressable
                key={i}
                style={[st.legendItem, isSelected && st.legendItemActive]}
                onPress={() => handleLineTap(chartKey, i)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View style={[st.legendDot, { backgroundColor: l.color, opacity: isDimmed ? 0.25 : 1 }]} />
                <Text style={[st.legendText, { color: l.color, opacity: isDimmed ? 0.3 : 1 }]}>
                  {l.label}: {'\u20AC'}{arrSum(l.data).toFixed(0)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <InteractiveLineChart
            labels={chartLabels}
            lines={lines}
            activeLineIndex={activeLine}
            onPointPress={(li, pi, val) => handlePointPress(chartKey, li, pi, val)}
          />
        </View>
      </View>
    );
  };

  const renderPieBox = (title: string, items: { label: string; value: number; color: string }[]) => {
    const total = arrSum(items.map((i) => i.value));
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <View style={st.chartHeader}>
          <Text style={st.sectionLabel}>{title}</Text>
          <Text style={st.sectionTotal}>TOT: {'\u20AC'}{total}</Text>
        </View>
        {total === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Ionicons name="pie-chart-outline" size={40} color="#C0D0C8" />
            <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 8, fontWeight: '700' }}>
              {t('stats.noData') || 'Nessun dato disponibile'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 }}>
            <PieChart items={items} size={130} />
            <View style={{ flex: 1 }}>
              {items.map((it, i) => {
                const pct = Math.round((it.value / total) * 100);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: it.color, marginRight: 6 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A4040', flex: 1 }}>
                      {it.label}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: it.color }}>
                      {'\u20AC'}{it.value} ({pct}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  /* ═══ PDF Report Generation ═══ */
  const generatePDF = async () => {
    const monthNames = getMonthNames();
    const month = monthNames[pdfMonth];
    const year = pdfYear;
    const giorni = storicoGiornate.filter((g) => {
      const d = new Date(g.data);
      return d.getMonth() === pdfMonth && d.getFullYear() === year;
    }).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    
    const totL = arrSum(giorni.map((g) => g.lordo || 0));
    const totN = arrSum(giorni.map((g) => g.netto || 0));
    const totKm = arrSum(giorni.map((g) => g.km || 0));
    const rows = giorni.map((g) => {
      const d = new Date(g.data);
      return `<tr>
        <td>${d.getDate()}/${d.getMonth() + 1}</td>
        <td>${g.mercato}</td>
        <td style="text-align:right">\u20AC${(g.lordo || 0).toFixed(0)}</td>
        <td style="text-align:right">\u20AC${(g.netto || 0).toFixed(0)}</td>
        <td style="text-align:right">${g.km || 0}</td>
      </tr>`;
    }).join('');

    const html = `<html><head><style>
      body{font-family:sans-serif;padding:20px;font-size:11px}
      h1{color:#1E7F85;font-size:16px;margin-bottom:4px}
      h2{color:#333;font-size:13px;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th{background:#1E7F85;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
      td{padding:5px 8px;border-bottom:1px solid #E0E0E0;font-size:10px}
      tr:nth-child(even){background:#F5F5F0}
      .summary{display:flex;gap:16px;margin:12px 0}
      .box{background:#F0EDE4;padding:10px;border-radius:8px;flex:1;text-align:center}
      .box .val{font-size:16px;font-weight:bold;color:#1E7F85}
      .box .lbl{font-size:9px;color:#666}
    </style></head><body>
      <h1>MarketMate - Report ${month} ${year}</h1>
      <div class="summary">
        <div class="box"><div class="val">\u20AC${totL.toFixed(0)}</div><div class="lbl">${t('stats.gross')}</div></div>
        <div class="box"><div class="val">\u20AC${totN.toFixed(0)}</div><div class="lbl">${t('stats.net')}</div></div>
        <div class="box"><div class="val">${giorni.length}</div><div class="lbl">${t('stats.workingDays')}</div></div>
        <div class="box"><div class="val">${totKm.toFixed(0)} km</div><div class="lbl">${t('stats.totalKm')}</div></div>
      </div>
      <table><thead><tr><th>Data</th><th>Mercato</th><th>${t('stats.gross')}</th><th>${t('stats.net')}</th><th>Km</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:20px">' + t('stats.noFairs') + '</td></tr>'}</tbody>
      </table>
    </body></html>`;

    try {
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      Alert.alert('Error', 'PDF generation failed');
    }
  };

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={[st.scroll, { gap: GAP }]} showsVerticalScrollIndicator={false}>
        <Text style={st.pageTitle}>{t('stats.analysis')}</Text>

        {renderFilterBar(['Pers.', 'Ieri', 'Oggi', 'Sett.', 'Mese', 'Anno'], filtroTempo, setFiltroTempo, false, tempoLabel)}
        {renderFilterBar(['TUTTO', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM', 'FIERE'], filtroTipo, setFiltroTipo, true, tipoLabel)}

        <View style={{ gap: GAP }}>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('stats.gross').toUpperCase()}</Text>
              <Text style={[st.kpiValue, { color: PALETTE[0] }]}>{'\u20AC'}{totLordo.toFixed(0)}</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('stats.net').toUpperCase()}</Text>
              <Text style={[st.kpiValue, { color: totNetto >= 0 ? PALETTE[1] : '#D46A6A' }]}>{'\u20AC'}{totNetto.toFixed(0)}</Text>
            </View>
          </View>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('home.cash')}</Text>
              <Text style={[st.kpiValue, { color: PALETTE[5] }]}>{'\u20AC'}{totCash.toFixed(0)}</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('home.pos')}</Text>
              <Text style={[st.kpiValue, { color: PALETTE[2] }]}>{'\u20AC'}{totPos.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {renderChartBox(t('stats.economic'), economicoLines, 'economico')}
        {renderChartBox(t('stats.income'), incassiLines, 'incassi')}

        {/* ─── AREOGRAMMI ─── */}
        {renderPieBox(t('stats.fixedExpenses'), speseFisseItems)}
        {renderPieBox(t('stats.extraExpenses'), speseExtraItems)}

        {renderChartBox(t('stats.unsold'), invendutoLines, 'invenduto')}
        {renderChartBox(t('stats.collaborators'), collabLines, 'collab')}
        {renderChartBox(t('stats.suppliers'), fornitoriLines, 'fornitori')}

        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => setShowFiere(!showFiere)} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="star" size={16} color="#D4AF37" />
                <Text style={st.sectionLabel}>{t('stats.fairHistory')}</Text>
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
                <Text style={st.emptyText}>{t('stats.noFairs')}</Text>
              ) : (
                fiereDays.map((f, i) => {
                  const d = new Date(f.data);
                  const GG = getDayNames();
                  const MM = getMonthNames();
                  return (
                    <View key={i} style={st.fieraRow}>
                      <Text style={st.fieraText} numberOfLines={1}>
                        {GG[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()} {MM[d.getMonth()]} - {f.mercato}
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
          <Text style={st.sectionLabel}>{t('stats.weatherLabel')}</Text>
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
          <Text style={st.meteoBtnTxt}>{t('stats.detailedWeather')}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginBottom: GAP }}
          onPress={generatePDF}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#D4AF37', '#B8860B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.pdfBtn}
          >
            <Ionicons name="document-text" size={18} color="#FFF" />
            <Text style={st.pdfBtnTxt}>{t('stats.pdfReport')}</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* Selettore mese/anno per PDF */}
        <View style={[st.card, { marginBottom: GAP, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 10 }]}>
          <TouchableOpacity onPress={() => setPdfMonth(m => m === 0 ? 11 : m - 1)}>
            <Ionicons name="chevron-back" size={20} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A4040' }}>
            {getMonthNames()[pdfMonth]} {pdfYear}
          </Text>
          <TouchableOpacity onPress={() => setPdfMonth(m => m === 11 ? 0 : m + 1)}>
            <Ionicons name="chevron-forward" size={20} color="#1E7F85" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPdfYear(y => y - 1)} style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 11, color: '#7A9090' }}>{pdfYear - 1}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPdfYear(y => y + 1)}>
            <Text style={{ fontSize: 11, color: '#7A9090' }}>{pdfYear + 1}</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ CLIENTI SERVITI ═══ */}
        {(() => {
          const clientiData = storicoGiornate
            .filter((g) => g.mercato && (g.lordo || 0) > 0)
            .map((g) => {
              const mkt = store.agenda.find((a) => a.mercato === g.mercato);
              const avgR = mkt?.mediaScontrino || 0;
              return { ...g, persone: avgR > 0 ? Math.round((g.lordo || 0) / avgR) : 0 };
            })
            .filter((g) => g.persone > 0)
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .slice(0, 7);
          
          if (clientiData.length === 0) return null;
          
          return (
            <View style={[st.card, { marginBottom: GAP }]}>
              <Text style={st.sectionLabel}>{t('stats.customersServed')}</Text>
              {clientiData.map((g, i) => {
                const d = new Date(g.data);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < clientiData.length - 1 ? 0.5 : 0, borderColor: '#D5DDD8' }}>
                    <Ionicons name="people" size={16} color="#1E7F85" />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 11, fontWeight: '700', color: '#1A4040' }}>
                      {g.mercato} - {d.getDate()}/{d.getMonth() + 1}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#E8A060' }}>{g.persone}</Text>
                    <Text style={{ fontSize: 9, color: '#7A9090', marginLeft: 4 }}>{t('stats.peopleServed')}</Text>
                  </View>
                );
              })}
            </View>
          );
        })()}

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
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
  legendItemActive: { backgroundColor: 'rgba(30,127,133,0.1)', borderWidth: 1, borderColor: 'rgba(30,127,133,0.25)' },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { fontSize: 9, fontWeight: '700' },

  tooltipBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A3535', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginTop: 8,
    // @ts-ignore
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  tooltipDot: { width: 12, height: 12, borderRadius: 6 },
  tooltipText: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

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
