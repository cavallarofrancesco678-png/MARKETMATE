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
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { MeteoStatsModal } from '../../src/components/MeteoStatsModal';
import { CalendarModal } from '../../src/components/CalendarModal';
import { MiniMonthCalendar } from '../../src/components/MiniMonthCalendar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDayNames, getMonthNames, getShortDayNames } from '../../src/i18n';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { playSuccess } from '../../src/utils/feedback';
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
  const padT = 38; // più spazio sopra per i valori delle etichette
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
                  <>
                    {/* Halo bianco per leggibilità */}
                    <SvgText x={p.x} y={p.y - 14} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={3} fontSize={11} fontWeight="900" textAnchor="middle">
                      €{p.v.toFixed(0)}
                    </SvgText>
                    <SvgText x={p.x} y={p.y - 14} fill={line.color} fontSize={11} fontWeight="900" textAnchor="middle">
                      €{p.v.toFixed(0)}
                    </SvgText>
                  </>
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
  const { storicoGiornate, storicoCarburante, speseAnnue, collaboratori, fornitori, agenda, seedMockData } = store;
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : insets.top + 16;
  const GAP = Math.round(1.5 * ((screenH - 80) / 100));
  const { t } = useTranslation();

  const [filtroTempo, setFiltroTempo] = useState<FilterTempo>('Sett.');
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('TUTTO');
  const [showMeteo, setShowMeteo] = useState(false);
  const [showFiere, setShowFiere] = useState(false);
  const [showFornitori, setShowFornitori] = useState(false);
  const [expandedFornitore, setExpandedFornitore] = useState<string | null>(null);
  // Collapse state per ogni sezione (default: tutte chiuse "a pacchetto")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    economico: true,
    incassi: true,
    workingDays: true,
    fixedExpenses: true,
    extraExpenses: true,
    invenduto: true,
    collab: true,
    fornLines: true,
    fiere: true,
    meteo: true,
    eventClassifica: true,
    eventGiornate: true,
    eventCalendario: true,
  });
  const toggleCollapsed = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  // Date range per filtro personalizzato
  const [persDateFrom, setPersDateFrom] = useState<Date | null>(null);
  const [persDateTo, setPersDateTo] = useState<Date | null>(null);
  const [showPersCalendar, setShowPersCalendar] = useState(false);
  const [persPickingFrom, setPersPickingFrom] = useState(true); // true = picking FROM, false = picking TO
  const [showPersDayCal, setShowPersDayCal] = useState(false); // calendario vero e proprio
  const [pdfMonth, setPdfMonth] = useState(new Date().getMonth());
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());

  const [activeChartLine, setActiveChartLine] = useState<Record<string, number | null>>({});
  const [tooltipInfo, setTooltipInfo] = useState<{ chartKey: string; lineIdx: number; pointIdx: number; value: number } | null>(null);
  const [showNettoModal, setShowNettoModal] = useState(false);
  // Netto deduction flags
  const [excludeSpeseFisse, setExcludeSpeseFisse] = useState(false);
  const [excludeCollaboratori, setExcludeCollaboratori] = useState(false);
  const [excludeSpeseExtra, setExcludeSpeseExtra] = useState(false);
  const [excludeInvenduto, setExcludeInvenduto] = useState(false);
  const [excludeCarburante, setExcludeCarburante] = useState(false);

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
      if (filtroTempo === 'Pers.' && persDateFrom && persDateTo) {
        const from = new Date(persDateFrom); from.setHours(0,0,0,0);
        const to = new Date(persDateTo); to.setHours(23,59,59,999);
        return d >= from && d <= to;
      }
      return true;
    });
  }, [storicoGiornate, filtroTempo, persDateFrom, persDateTo]);

  const filteredData = useMemo(() => {
    if (filtroTipo === 'TUTTO') return filteredByTime;
    if (filtroTipo === 'FIERE') {
      // Matcha su parole chiave + nomi delle fiere ricorrenti configurate
      const fiereNomi = (store.fiere || []).map((f: any) => f.nome.toLowerCase());
      return filteredByTime.filter((g) => {
        const m = g.mercato.toLowerCase();
        return m.includes('fiera') || m.includes('sagra') || m.includes('festa') || m.includes('evento') ||
          fiereNomi.some((n: string) => n && m.includes(n));
      });
    }
    const targetDay = GIORNO_MAP[filtroTipo];
    return filteredByTime.filter((g) => new Date(g.data).getDay() === targetDay);
  }, [filteredByTime, filtroTipo, store.fiere]);

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
    if (filtroTempo === 'Mese') {
      // Supporto per mesi a 5 settimane
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const numWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
      const weeksCount = Math.min(numWeeks, 5);
      return Array.from({ length: weeksCount }, (_, i) => `S${i + 1}`);
    }
    return shortDays;
  }, [filtroTempo, t]);

  const groupData = (data: Giornata[], field: (g: Giornata) => number): number[] => {
    if (filtroTempo === 'Anno') {
      const months = Array(12).fill(0);
      data.forEach((g) => { months[new Date(g.data).getMonth()] += field(g); });
      return months;
    }
    if (filtroTempo === 'Mese') {
      // Supporto per mesi a 5 settimane
      // Calcola il numero di settimane nel mese corrente
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const numWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
      const weeksCount = Math.min(numWeeks, 5); // Max 5 settimane
      
      const weeks = Array(weeksCount).fill(0);
      data.forEach((g) => {
        const date = new Date(g.data);
        const dayOfMonth = date.getDate();
        const weekIdx = Math.min(Math.floor((dayOfMonth - 1) / 7), weeksCount - 1);
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
    const productLines = Array.from(productNames).slice(0, 7).map((name, i) => ({
      label: name,
      color: PALETTE[i % PALETTE.length],
      data: groupData(filteredData, (g) => (g.dettaglio_invenduto?.[name] || 0)),
    }));
    // Se non ci sono prodotti specifici, usa SEMPRE il totale come singola linea (anche se 0)
    if (productLines.length === 0) {
      return [{
        label: t('stats.unsold') || 'Invenduto',
        color: '#D46A6A',
        data: groupData(filteredData, (g) => {
          const det = g.dettaglio_invenduto || {};
          // Somma tutti i valori numerici dell'oggetto
          return Object.values(det).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0);
        }),
      }];
    }
    return productLines;
  }, [filteredData, filtroTempo, t]);

  /* ═══ BREAKDOWN INVENDUTO PER PRODOTTO (con giorni coinvolti) ═══ */
  const invendutoBreakdown = useMemo(() => {
    const perProd: Record<string, { totale: number; giorni: number }> = {};
    filteredData.forEach((g) => {
      if (!g.dettaglio_invenduto) return;
      Object.entries(g.dettaglio_invenduto).forEach(([k, v]) => {
        if (k === 'totale') return;
        const val = typeof v === 'number' ? v : 0;
        if (val <= 0) return;
        if (!perProd[k]) perProd[k] = { totale: 0, giorni: 0 };
        perProd[k].totale += val;
        perProd[k].giorni += 1;
      });
    });
    const arr = Object.entries(perProd)
      .map(([nome, d]) => ({ nome, totale: Math.round(d.totale), giorni: d.giorni }))
      .sort((a, b) => b.totale - a.totale);
    const totale = arr.reduce((s, x) => s + x.totale, 0);
    return { items: arr, totale };
  }, [filteredData]);

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
    // Per ogni fornitore, somma Fatturata + Libera da ogni giornata
    return fornitori.map((f, i) => ({
      label: f.nome,
      color: PALETTE[(i + 1) % PALETTE.length],
      data: groupData(filteredData, (g) => {
        const fatt = g.dettaglio_fornitori?.[f.nome] || 0;
        const libera = g.dettaglio_fornitori?.[`${f.nome}__libera`] || 0;
        return fatt + libera;
      }),
    }));
  }, [filteredData, filtroTempo, fornitori]);

  const speseFisseItems = useMemo(() => {
    // Calcola il numero di giorni del periodo selezionato per proration corretta
    let daysInPeriod = 365;
    if (filtroTempo === 'Oggi' || filtroTempo === 'Ieri') daysInPeriod = 1;
    else if (filtroTempo === 'Sett.') daysInPeriod = 7;
    else if (filtroTempo === 'Mese') daysInPeriod = 30;
    else if (filtroTempo === 'Anno') daysInPeriod = 365;
    else if (filtroTempo === 'Pers.' && persDateFrom && persDateTo) {
      const diff = Math.max(1, Math.ceil((persDateTo.getTime() - persDateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      daysInPeriod = diff;
    }
    const fattore = daysInPeriod / 365;
    const items: { label: string; value: number; color: string }[] = [];
    // 1. Voci di spese annue (assicurazione, bollo, commercialista, ecc.)
    (speseAnnue || []).forEach((sp) => {
      items.push({
        label: sp.voce,
        value: Math.max(Math.round((sp.importo || 0) * fattore), 1),
        color: PALETTE[items.length % PALETTE.length],
      });
    });
    // 2. Plateatico annuo per ogni mercato (p_annuo)
    // FILTRO: se filtroTipo è un giorno specifico (LUN..DOM), mostra solo quel mercato.
    const targetDayIdx = (() => {
      if (filtroTipo === 'TUTTO' || filtroTipo === 'FIERE') return -1;
      // GIORNO_MAP ha valori per Date.getDay() (0=DOM..6=SAB).
      // Agenda è indicizzata 0=LUN..6=DOM ⇒ converti.
      const jsDay = GIORNO_MAP[filtroTipo];
      if (jsDay === undefined || jsDay < 0) return -1;
      return jsDay === 0 ? 6 : jsDay - 1; // LUN=0, DOM=6
    })();
    (agenda || []).forEach((m, idx) => {
      if ((m as any).p_annuo && (m as any).p_annuo > 0) {
        // Se filtraggio per giorno specifico, salta gli altri mercati
        if (targetDayIdx >= 0 && idx !== targetDayIdx) return;
        items.push({
          label: `Plat. ${m.mercato}`,
          value: Math.max(Math.round((m as any).p_annuo * fattore), 1),
          color: PALETTE[items.length % PALETTE.length],
        });
      }
    });
    // 3. Carburante - calcolato come MEDIA €/km applicata ai km del periodo
    // Media storica: totale € spesi in carburante / totale km percorsi
    const totEuroCarbStorico = arrSum((storicoCarburante || []).map((c) => c.euro || 0));
    const totKmStorico = arrSum((storicoGiornate || []).map((g) => g.km || 0));
    const mediaEuroKm = totKmStorico > 0 ? totEuroCarbStorico / totKmStorico : 0;
    // Km percorsi nel periodo filtrato
    const kmPeriodo = arrSum(filteredData.map((g) => g.km || 0));
    const carburantePeriodo = Math.round(kmPeriodo * mediaEuroKm);
    if (carburantePeriodo > 0 || kmPeriodo > 0 || totEuroCarbStorico > 0) {
      items.push({
        label: `Carburante (€${mediaEuroKm.toFixed(3)}/km × ${kmPeriodo}km)`,
        value: Math.max(carburantePeriodo, 1),
        color: '#E8A060',
      });
    }
    return items;
  }, [speseAnnue, agenda, storicoCarburante, storicoGiornate, filteredData, filtroTempo, filtroTipo, persDateFrom, persDateTo]);

  const speseExtraItems = useMemo(() => {
    // Aggrega per nome voce dalle dettaglio_spese_extra di ogni giornata
    const perVoce: Record<string, number> = {};
    filteredData.forEach((g) => {
      if (g.dettaglio_spese_extra) {
        Object.entries(g.dettaglio_spese_extra).forEach(([k, v]) => {
          perVoce[k] = (perVoce[k] || 0) + (v as number);
        });
      }
    });
    // Invenduto come voce a sé
    const totInvenduto = arrSum(filteredData.map((g) => {
      if (!g.dettaglio_invenduto) return 0;
      return Object.values(g.dettaglio_invenduto).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    }));
    const items: { label: string; value: number; color: string }[] = [];
    Object.entries(perVoce).forEach(([nome, val], i) => {
      items.push({ label: nome, value: Math.round(val), color: PALETTE[i % PALETTE.length] });
    });
    if (totInvenduto > 0) {
      items.push({ label: t('stats.unsold'), value: totInvenduto, color: '#D46A6A' });
    }
    // Fallback: se nessun dettaglio extra, mostra totale aggregato
    if (items.length === 0) {
      const totSpeseExtra = arrSum(filteredData.map((g) => g.spese_extra || 0));
      if (totSpeseExtra > 0) items.push({ label: t('stats.extraExpenses'), value: totSpeseExtra, color: PALETTE[1] });
    }
    return items.filter((i) => i.value > 0);
  }, [filteredData, t]);

  // Calcolo totali fornitori: fatturata vs libera
  const fornitoriTotals = useMemo(() => {
    let fatturata = 0;
    let libera = 0;
    const perForn: Record<string, { fatturata: number; libera: number }> = {};
    
    filteredData.forEach((g) => {
      if (g.dettaglio_fornitori) {
        Object.entries(g.dettaglio_fornitori).forEach(([k, v]) => {
          if (k.includes('__libera') && !k.includes('__liberaLabel') && !k.includes('__fattn')) {
            const fornName = k.replace('__libera', '');
            libera += (v as number);
            if (!perForn[fornName]) perForn[fornName] = { fatturata: 0, libera: 0 };
            perForn[fornName].libera += (v as number);
          } else if (!k.includes('__')) {
            fatturata += (v as number);
            if (!perForn[k]) perForn[k] = { fatturata: 0, libera: 0 };
            perForn[k].fatturata += (v as number);
          }
        });
      }
    });
    
    return {
      fatturata: Math.round(fatturata),
      libera: Math.round(libera),
      totale: Math.round(fatturata + libera),
      perFornitore: Object.entries(perForn).map(([nome, vals]) => ({
        nome, fatturata: Math.round(vals.fatturata), libera: Math.round(vals.libera),
      })).sort((a, b) => (b.fatturata + b.libera) - (a.fatturata + a.libera)),
    };
  }, [filteredData]);

  const meteoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    METEO_ICONS.forEach((m) => (counts[m.label] = 0));
    // Normalizza valori storici salvati con label tradotte (bug pre-fix: erano salvati come "Nuvolo", "SOLE", etc.)
    const normalizeMeteo = (raw: string): string => {
      if (!raw) return 'SOLE';
      const up = raw.toUpperCase();
      if (up.includes('SOL') || up.includes('SUN')) return 'SOLE';
      if (up.includes('NUV') || up.includes('CLOUD') || up.includes('NUB') || up.includes('NUAG')) return 'NUVOLO';
      if (up.includes('PIOG') || up.includes('RAIN') || up.includes('LLUV') || up.includes('PLUI') || up.includes('CHUV')) return 'PIOGGIA';
      if (up.includes('NEV') || up.includes('SNOW') || up.includes('NIE') || up.includes('NEIG')) return 'NEVE';
      if (up.includes('VENT') || up.includes('WIND') || up.includes('VIEN')) return 'VENTO';
      return 'SOLE';
    };
    filteredData.forEach((g) => {
      const m = normalizeMeteo(g.meteo || '');
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

  /* ── Giorni lavorati vs non lavorati (per grafico) ── */
  const giorniLavoroData = useMemo(() => {
    const allDates = store.storicoGiornate.map(g => new Date(g.data).getTime());
    const firstDataDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : null;
    
    if (!firstDataDate) {
      return { lavorati: 0, nonLavorati: 0, totale: 0 };
    }

    // Conta i giorni dal primo inserimento dati fino ad oggi
    const oggi = new Date();
    oggi.setHours(23, 59, 59, 999);
    
    if (filtroTempo === 'Sett.') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0,0,0,0);
      // Conta solo i giorni dalla partenza effettiva (o inizio settimana se dopo)
      const startDate = firstDataDate > weekStart ? firstDataDate : weekStart;
      const daysPassed = Math.floor((oggi.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const lavorati = filteredData.length;
      return { lavorati, nonLavorati: Math.max(0, daysPassed - lavorati), totale: daysPassed };
    } else if (filtroTempo === 'Mese') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = firstDataDate > monthStart ? firstDataDate : monthStart;
      const daysPassed = Math.floor((oggi.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const lavorati = filteredData.length;
      return { lavorati, nonLavorati: Math.max(0, daysPassed - lavorati), totale: daysPassed };
    } else {
      // Anno o Personalizzato: dal primo dato inserito
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const startDate = firstDataDate > yearStart ? firstDataDate : yearStart;
      const daysPassed = Math.floor((oggi.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const lavorati = filteredData.length;
      return { lavorati, nonLavorati: Math.max(0, daysPassed - lavorati), totale: daysPassed };
    }
  }, [filteredData, filtroTempo, store.storicoGiornate]);

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
    // Per 'economico' (LORDO + NETTO) mostra come totale solo il LORDO
    const totalSection = chartKey === 'economico'
      ? arrSum((lines.find(l => l.label.toUpperCase() === 'LORDO') || lines[0])?.data || [])
      : arrSum(lines.map((l) => arrSum(l.data)));
    const activeLine = activeChartLine[chartKey] ?? null;
    const currentTooltip = tooltipInfo && tooltipInfo.chartKey === chartKey ? tooltipInfo : null;
    const hasActiveFilter = activeLine !== null;
    const isCollapsed = collapsed[chartKey] ?? false;
    // Se non ci sono righe, mostra un card placeholder (utile per "Fornitori 2" quando non hai ancora fornitori o dati)
    if (lines.length === 0) {
      return (
        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => toggleCollapsed(chartKey)} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <Text style={st.sectionLabel}>{title}</Text>
              <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#5A7575" />
            </View>
          </TouchableOpacity>
          {!isCollapsed && (
            <Text style={{ fontSize: 11, color: '#7A9090', fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 }}>
              Nessun fornitore configurato. Aggiungili in Impostazioni → Fornitori.
            </Text>
          )}
        </View>
      );
    }
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <TouchableOpacity onPress={() => toggleCollapsed(chartKey)} activeOpacity={0.7}>
          <View style={st.chartHeader}>
            <Text style={[st.sectionLabel, hasActiveFilter && { textDecorationLine: 'underline', color: '#E8A060' }]}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={st.sectionTotal}>TOT: {'\u20AC'}{totalSection.toFixed(0)}</Text>
              <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#5A7575" />
            </View>
          </View>
        </TouchableOpacity>
        {!isCollapsed && (
        <>
        {hasActiveFilter && (
          <TouchableOpacity 
            style={{ alignSelf: 'flex-start', marginBottom: 6, backgroundColor: '#E8A060', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
            onPress={() => {
              setActiveChartLine((prev) => ({ ...prev, [chartKey]: null }));
              setTooltipInfo(null);
            }}
          >
            <Text style={{ fontSize: 9, color: '#FFF', fontWeight: '800' }}>← MOSTRA TUTTO</Text>
          </TouchableOpacity>
        )}
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
        </>
        )}
      </View>
    );
  };

  const renderPieBox = (title: string, items: { label: string; value: number; color: string }[], collapseKey?: string) => {
    const total = arrSum(items.map((i) => i.value));
    // Mostra sempre il grafico, anche vuoto
    const displayItems = total > 0 ? items : [{ label: 'Nessun dato', value: 1, color: '#D8E4E0' }];
    const displayTotal = total;
    const isCollapsed = collapseKey ? (collapsed[collapseKey] ?? false) : false;
    return (
      <View style={[st.card, { marginBottom: GAP }]}>
        <TouchableOpacity onPress={() => collapseKey && toggleCollapsed(collapseKey)} activeOpacity={collapseKey ? 0.7 : 1} disabled={!collapseKey}>
          <View style={st.chartHeader}>
            <Text style={st.sectionLabel}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={st.sectionTotal}>TOT: {'\u20AC'}{displayTotal.toFixed(0)}</Text>
              {collapseKey && <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#5A7575" />}
            </View>
          </View>
        </TouchableOpacity>
        {!isCollapsed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 }}>
          <PieChart items={displayItems} size={130} />
          <View style={{ flex: 1 }}>
            {total === 0 ? (
              <Text style={{ fontSize: 11, color: '#7A9090', fontWeight: '700', textAlign: 'center' }}>
                {t('stats.noData') || 'Nessun dato'}
              </Text>
            ) : (
              items.map((it, i) => {
                const pct = Math.round((it.value / total) * 100);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: it.color, marginRight: 6 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A4040', flex: 1 }}>
                      {it.label}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: it.color }}>
                      {'\u20AC'}{it.value.toFixed(0)} ({pct}%)
                    </Text>
                  </View>
                );
              })
            )}
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
    const totCash = arrSum(giorni.map((g) => g.contanti || 0));
    const totPos = arrSum(giorni.map((g) => g.pos || 0));
    const totSpFisse = arrSum(giorni.map((g) => g.speseFisse || 0));
    const totSpExtra = arrSum(giorni.map((g) => g.speseExtra || 0));
    const totCarb = arrSum(storicoCarburante.filter((c) => {
      const d = new Date(c.data);
      return d.getMonth() === pdfMonth && d.getFullYear() === year;
    }).map(c => c.euro));
    
    const rows = giorni.map((g) => {
      const d = new Date(g.data);
      return `<tr>
        <td>${d.getDate()}/${d.getMonth() + 1}</td>
        <td>${g.mercato}</td>
        <td style="text-align:right">\u20AC${(g.lordo || 0).toFixed(0)}</td>
        <td style="text-align:right">\u20AC${(g.netto || 0).toFixed(0)}</td>
        <td style="text-align:right">\u20AC${(g.contanti || 0).toFixed(0)}</td>
        <td style="text-align:right">\u20AC${(g.pos || 0).toFixed(0)}</td>
        <td style="text-align:right">${g.km || 0}</td>
      </tr>`;
    }).join('');

    const html = `<html><head><meta charset="utf-8"><style>
      @page{size:A4;margin:15mm}
      body{font-family:Helvetica,Arial,sans-serif;padding:0;font-size:11px;color:#333}
      h1{color:#1E7F85;font-size:20px;margin:0 0 2px 0;border-bottom:3px solid #1E7F85;padding-bottom:6px}
      h3{color:#1E7F85;font-size:12px;margin:14px 0 6px 0;text-transform:uppercase;letter-spacing:1px}
      .subtitle{color:#666;font-size:11px;margin-bottom:12px}
      .grid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 16px 0}
      .box{background:#F0EDE4;padding:12px 10px;border-radius:10px;flex:1;min-width:100px;text-align:center}
      .box .val{font-size:18px;font-weight:bold;color:#1E7F85}
      .box .lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
      .box.warn .val{color:#E8A060}
      table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}
      th{background:#1E7F85;color:#fff;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px}
      td{padding:6px 8px;border-bottom:1px solid #E8E8E0}
      tr:nth-child(even){background:#FAFAF5}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#AAA;border-top:1px solid #E0E0E0;padding-top:8px}
    </style></head><body>
      <h1>MarketMate</h1>
      <div class="subtitle">${t('stats.pdfReport')} — ${month} ${year}</div>
      
      <h3>${t('stats.overview') || 'Riepilogo'}</h3>
      <div class="grid">
        <div class="box"><div class="val">\u20AC${totL.toFixed(0)}</div><div class="lbl">${t('stats.gross')}</div></div>
        <div class="box"><div class="val">\u20AC${totN.toFixed(0)}</div><div class="lbl">${t('stats.net')}</div></div>
        <div class="box"><div class="val">\u20AC${totCash.toFixed(0)}</div><div class="lbl">${t('stats.cash')}</div></div>
        <div class="box"><div class="val">\u20AC${totPos.toFixed(0)}</div><div class="lbl">POS</div></div>
      </div>
      <div class="grid">
        <div class="box warn"><div class="val">\u20AC${totSpFisse.toFixed(0)}</div><div class="lbl">${t('stats.fixedExpenses')}</div></div>
        <div class="box warn"><div class="val">\u20AC${totSpExtra.toFixed(0)}</div><div class="lbl">${t('stats.extraExpenses')}</div></div>
        <div class="box warn"><div class="val">\u20AC${totCarb.toFixed(0)}</div><div class="lbl">${t('stats.fuel') || 'Carburante'}</div></div>
        <div class="box"><div class="val">${totKm.toFixed(0)} km</div><div class="lbl">${t('stats.totalKm')}</div></div>
      </div>
      <div class="grid">
        <div class="box"><div class="val">${giorni.length}</div><div class="lbl">${t('stats.workingDays')}</div></div>
        <div class="box"><div class="val">\u20AC${giorni.length > 0 ? (totL / giorni.length).toFixed(0) : 0}</div><div class="lbl">${t('stats.dailyAvg') || 'Media/gg'}</div></div>
      </div>

      <h3>${t('stats.dailyDetail') || 'Dettaglio Giornaliero'}</h3>
      <table><thead><tr><th>Data</th><th>Mercato</th><th>${t('stats.gross')}</th><th>${t('stats.net')}</th><th>${t('stats.cash')}</th><th>POS</th><th>Km</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">' + t('stats.noFairs') + '</td></tr>'}</tbody>
      </table>
      
      <div class="footer">MarketMate \u00A9 ${year} — ${t('stats.generatedOn') || 'Generato il'} ${new Date().toLocaleDateString()}</div>
    </body></html>`;

    try {
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('stats.shareReport') || 'Condividi Report' });
      }
    } catch (e) {
      playSuccess();
    }
  };

  return (
    <View style={st.root}>
      {/* ═══ HEADER FISSO ═══ */}
      <View style={[st.stickyHeader, { paddingTop: topPad }]}>
        <Text style={st.pageTitle}>{t('stats.analysis')}</Text>
        {renderFilterBar(['Pers.', 'Ieri', 'Oggi', 'Sett.', 'Mese', 'Anno'], filtroTempo, (v: FilterTempo) => {
          setFiltroTempo(v);
          if (v === 'Pers.') setShowPersCalendar(true);
        }, false, tempoLabel)}
        {renderFilterBar(['TUTTO', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM', 'FIERE'], filtroTipo, setFiltroTipo, true, tipoLabel)}
      </View>

      {/* ═══ CONTENUTO SCROLLABILE ═══ */}
      <ScrollView contentContainerStyle={[st.scroll, { gap: GAP }]} showsVerticalScrollIndicator={false}>

        {/* ═══ EVENTI & FIERE — PANNELLO DEDICATO (solo quando filtro = FIERE) ═══ */}
        {filtroTipo === 'FIERE' && (() => {
          // Calcola statistiche per evento
          const eventsMap: Record<string, { nome: string; tipologia: string; giornate: number; lordo: number; netto: number; km: number; plateatico: number }> = {};
          const dateEventiIso = new Set<string>();
          filteredData.forEach((g) => {
            const key = g.mercato || 'Sconosciuto';
            const fiera = (store.fiere || []).find((f: any) => 
              g.mercato.toLowerCase().includes(f.nome.toLowerCase()) ||
              (f.luogo && g.mercato.toLowerCase().includes(f.luogo.toLowerCase()))
            );
            if (!eventsMap[key]) {
              eventsMap[key] = {
                nome: fiera?.nome || g.mercato,
                tipologia: fiera?.tipologia || 'Fiera',
                giornate: 0, lordo: 0, netto: 0, km: 0, plateatico: 0,
              };
            }
            eventsMap[key].giornate += 1;
            eventsMap[key].lordo += (g.lordo || 0);
            eventsMap[key].netto += (g.netto || 0);
            eventsMap[key].km += (g.km || 0);
            eventsMap[key].plateatico += ((fiera?.plateatico || 0));
            // Data ISO YYYY-MM-DD della giornata
            const gd = new Date(g.data);
            const iso = `${gd.getFullYear()}-${String(gd.getMonth() + 1).padStart(2, '0')}-${String(gd.getDate()).padStart(2, '0')}`;
            dateEventiIso.add(iso);
          });
          // Anche date specifiche configurate nelle fiere (eventi futuri programmati)
          const dateProgrammate = new Set<string>();
          (store.fiere || []).forEach((f: any) => {
            if (!f.attiva) return;
            (f.dateSpecifiche || []).forEach((d: string) => dateProgrammate.add(d));
          });
          const events = Object.values(eventsMap).sort((a, b) => b.netto - a.netto);
          const totaleEventi = events.reduce((s, e) => s + e.giornate, 0);
          const totaleGuadagno = events.reduce((s, e) => s + e.netto, 0);
          // Lista cronologica
          const listaCronologica = filteredData
            .slice()
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .slice(0, 30);
          return (
            <View style={[st.card, { marginBottom: GAP, backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: '#D4AF37' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons name="star" size={18} color="#D4AF37" />
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#8A6A1F', letterSpacing: 1 }}>EVENTI & FIERE</Text>
              </View>

              {/* ─── CALENDARIO MENSILE CON EVENTI ─── */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 10, color: '#8A6A1F', fontWeight: '700', marginBottom: 6 }}>
                  🗓️ Calendario eventi (giornate effettuate + programmate)
                </Text>
                <MiniMonthCalendar
                  selectedDates={Array.from(dateEventiIso)}
                  highlightedDates={Array.from(dateProgrammate)}
                  onToggleDate={() => {}}
                  themeColor="#D4AF37"
                  mode="view"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#D4AF37', borderRadius: 5 }} />
                    <Text style={{ fontSize: 9, color: '#8A6A1F' }}>Effettuato</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#F5E8A0', borderRadius: 5, borderWidth: 1, borderColor: '#D4AF37' }} />
                    <Text style={{ fontSize: 9, color: '#8A6A1F' }}>Programmato</Text>
                  </View>
                </View>
              </View>

              {/* Riepilogo */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderColor: '#F0E0B0' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#D4AF37' }}>{totaleEventi}</Text>
                  <Text style={{ fontSize: 10, color: '#8A6A1F', fontWeight: '700' }}>EVENTI</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: totaleGuadagno >= 0 ? '#2A7A5A' : '#D46A6A' }}>€{totaleGuadagno.toFixed(0)}</Text>
                  <Text style={{ fontSize: 10, color: '#8A6A1F', fontWeight: '700' }}>NETTO</Text>
                </View>
              </View>

              {events.length === 0 && (
                <Text style={{ fontSize: 11, color: '#7A9090', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 }}>
                  Nessun evento nel periodo selezionato.
                </Text>
              )}

              {events.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <TouchableOpacity onPress={() => toggleCollapsed('eventClassifica')} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '900', color: '#8A6A1F', letterSpacing: 0.5 }}>🏆 CLASSIFICA</Text>
                      <Ionicons name={collapsed.eventClassifica ? 'chevron-down' : 'chevron-up'} size={16} color="#8A6A1F" />
                    </View>
                  </TouchableOpacity>
                  {!collapsed.eventClassifica && events.slice(0, 5).map((e, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderColor: '#F0E0B0' }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#D4AF37', width: 22 }}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#1A4040' }} numberOfLines={1}>{e.nome}</Text>
                        <Text style={{ fontSize: 9, color: '#7A9090' }}>{e.tipologia} · {e.giornate}gg · {e.km}km</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: e.netto >= 0 ? '#2A7A5A' : '#D46A6A' }}>€{e.netto.toFixed(0)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ─── LISTA CRONOLOGICA GIORNATE ─── */}
              {listaCronologica.length > 0 && (
                <View>
                  <TouchableOpacity onPress={() => toggleCollapsed('eventGiornate')} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '900', color: '#8A6A1F', letterSpacing: 0.5 }}>
                        📅 GIORNATE EVENTO ({listaCronologica.length})
                      </Text>
                      <Ionicons name={collapsed.eventGiornate ? 'chevron-down' : 'chevron-up'} size={16} color="#8A6A1F" />
                    </View>
                  </TouchableOpacity>
                  {!collapsed.eventGiornate && listaCronologica.map((g, i) => {
                    const d = new Date(g.data);
                    const label = `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
                    return (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: i > 0 ? 1 : 0, borderColor: '#F0E0B0' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A6A1F', width: 55 }}>{label}</Text>
                        <Text style={{ flex: 1, fontSize: 10, color: '#1A4040' }} numberOfLines={1}>{g.mercato}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E7F85' }}>L:€{(g.lordo || 0).toFixed(0)}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: (g.netto || 0) >= 0 ? '#2A7A5A' : '#D46A6A', marginLeft: 8 }}>€{(g.netto || 0).toFixed(0)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        <View style={{ gap: GAP }}>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('stats.gross').toUpperCase()}</Text>
              <Text style={[st.kpiValue, { color: PALETTE[0] }]}>{'\u20AC'}{totLordo.toFixed(0)}</Text>
            </View>
            <TouchableOpacity style={st.kpiCard} onPress={() => setShowNettoModal(true)} activeOpacity={0.7}>
              <Text style={st.kpiLabel}>{t('stats.net').toUpperCase()} ▼</Text>
              <Text style={[st.kpiValue, { color: totNetto >= 0 ? PALETTE[1] : '#D46A6A' }]}>{'\u20AC'}{totNetto.toFixed(0)}</Text>
            </TouchableOpacity>
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

        {renderChartBox('LORDO / NETTO', economicoLines, 'economico')}
        {renderChartBox('CASH / POS', incassiLines, 'incassi')}

        {/* ─── GIORNI LAVORATI VS NON LAVORATI ─── */}
        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => toggleCollapsed('workingDays')} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar-outline" size={16} color="#1E7F85" />
                <Text style={st.sectionLabel}>{t('stats.workingDays')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={st.sectionTotal}>{giorniLavoroData.lavorati}/{giorniLavoroData.totale}</Text>
                <Ionicons name={collapsed.workingDays ? 'chevron-down' : 'chevron-up'} size={18} color="#5A7575" />
              </View>
            </View>
          </TouchableOpacity>
          {!collapsed.workingDays && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, marginTop: 10, gap: 12, paddingHorizontal: 10 }}>
            {/* Barra giorni lavorati */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E7F85' }}>{giorniLavoroData.lavorati}</Text>
              <View style={{
                width: '100%',
                height: Math.max(giorniLavoroData.totale > 0 ? (giorniLavoroData.lavorati / giorniLavoroData.totale) * 50 : 4, 4),
                backgroundColor: '#1E7F85',
                borderRadius: 6,
                marginTop: 4,
              }} />
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#7A9090', marginTop: 4 }}>LAVORATI</Text>
            </View>
            {/* Barra giorni non lavorati */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#CC3333' }}>{giorniLavoroData.nonLavorati}</Text>
              <View style={{
                width: '100%',
                height: Math.max(giorniLavoroData.totale > 0 ? (giorniLavoroData.nonLavorati / giorniLavoroData.totale) * 50 : 4, 4),
                backgroundColor: '#CC3333',
                borderRadius: 6,
                marginTop: 4,
              }} />
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#7A9090', marginTop: 4 }}>NON LAVORATI</Text>
            </View>
            {/* Percentuale */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#1A4040' }}>
                {giorniLavoroData.totale > 0 ? Math.round((giorniLavoroData.lavorati / giorniLavoroData.totale) * 100) : 0}%
              </Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#7A9090' }}>PRESENZA</Text>
            </View>
          </View>
          )}
        </View>

        {/* ─── AREOGRAMMI ─── */}
        {renderPieBox(t('stats.fixedExpenses'), speseFisseItems, 'fixedExpenses')}
        {renderPieBox(t('stats.extraExpenses'), speseExtraItems, 'extraExpenses')}

        {/* ─── FORNITORI: Fatturata vs Libera (espandibile) ─── */}
        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => setShowFornitori(!showFornitori)} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="storefront" size={16} color="#1E7F85" />
                <Text style={st.sectionLabel}>{(t('stats.suppliers') || 'FORNITORI') + ' 1'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.sectionTotal}>TOT: €{fornitoriTotals.totale.toFixed(0)}</Text>
                <Ionicons name={showFornitori ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
              </View>
            </View>
          </TouchableOpacity>
          {showFornitori && (
            <View style={{ marginTop: 12 }}>
              {/* PieChart Fatturata vs Libera */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <PieChart items={fornitoriTotals.totale > 0 ? [
                  { label: 'Fatturata', value: fornitoriTotals.fatturata, color: '#1E7F85' },
                  { label: 'Contanti', value: fornitoriTotals.libera, color: '#E8A060' },
                ] : [{ label: 'Nessun dato', value: 1, color: '#D8E4E0' }]} size={110} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#1E7F85', marginRight: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A4040' }}>Fatturata</Text>
                    <Text style={{ marginLeft: 'auto', fontSize: 13, fontWeight: '900', color: '#1E7F85' }}>€{fornitoriTotals.fatturata.toFixed(0)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8A060', marginRight: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A4040' }}>Contanti</Text>
                    <Text style={{ marginLeft: 'auto', fontSize: 13, fontWeight: '900', color: '#E8A060' }}>€{fornitoriTotals.libera.toFixed(0)}</Text>
                  </View>
                  {fornitoriTotals.totale > 0 && (
                    <Text style={{ fontSize: 10, color: '#7A9090', fontWeight: '700', marginTop: 4 }}>
                      Fatturata: {Math.round((fornitoriTotals.fatturata / fornitoriTotals.totale) * 100)}%| Contanti: {Math.round((fornitoriTotals.libera / fornitoriTotals.totale) * 100)}%
                    </Text>
                  )}
                </View>
              </View>

              {/* ═══ AREOGRAMMA PER FORNITORE — quota di ognuno sul totale ═══ */}
              {fornitoriTotals.perFornitore.length > 0 && fornitoriTotals.totale > 0 && (
                <View style={{ marginBottom: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 1, marginBottom: 8 }}>
                    📊 RIPARTIZIONE PER FORNITORE
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <PieChart
                      items={fornitoriTotals.perFornitore.map((f, i) => ({
                        label: f.nome,
                        value: f.fatturata + f.libera,
                        color: PALETTE[i % PALETTE.length],
                      })).filter(x => x.value > 0)}
                      size={120}
                    />
                    <View style={{ flex: 1 }}>
                      {fornitoriTotals.perFornitore.slice(0, 6).map((f, i) => {
                        const totF = f.fatturata + f.libera;
                        const pct = fornitoriTotals.totale > 0 ? Math.round((totF / fornitoriTotals.totale) * 100) : 0;
                        return (
                          <View key={f.nome} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE[i % PALETTE.length], marginRight: 6 }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A4040', flex: 1 }} numberOfLines={1}>{f.nome}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575' }}>{pct}%</Text>
                          </View>
                        );
                      })}
                      {fornitoriTotals.perFornitore.length > 6 && (
                        <Text style={{ fontSize: 9, color: '#7A9090', fontStyle: 'italic', marginTop: 2 }}>
                          +{fornitoriTotals.perFornitore.length - 6} altri fornitori
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Dettaglio per fornitore - click per espandere personale */}
              {fornitoriTotals.perFornitore.map((f, i) => {
                const isExp = expandedFornitore === f.nome;
                const totF = f.fatturata + f.libera;
                return (
                  <View key={i} style={{ borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                    <TouchableOpacity onPress={() => setExpandedFornitore(isExp ? null : f.nome)} activeOpacity={0.7}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name="cube-outline" size={14} color="#7A9090" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040', flex: 1, marginLeft: 6 }}>{f.nome}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E7F85', marginRight: 8 }}>F: €{f.fatturata.toFixed(0)}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#E8A060', marginRight: 6 }}>C: €{f.libera.toFixed(0)}</Text>
                        <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color="#5A7575" />
                      </View>
                    </TouchableOpacity>
                    {isExp && totF > 0 && (
                      <View style={{ backgroundColor: '#F4FAF7', borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <PieChart items={[
                          { label: 'Fatturata', value: f.fatturata, color: '#1E7F85' },
                          { label: 'Contanti', value: f.libera, color: '#E8A060' },
                        ]} size={100} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: '#1A4040', marginBottom: 6 }}>{f.nome}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E7F85', marginRight: 6 }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A4040', flex: 1 }}>Fatturata</Text>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E7F85' }}>€{f.fatturata.toFixed(0)} ({Math.round((f.fatturata / totF) * 100)}%)</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8A060', marginRight: 6 }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A4040', flex: 1 }}>Contanti</Text>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#E8A060' }}>€{f.libera.toFixed(0)} ({Math.round((f.libera / totF) * 100)}%)</Text>
                          </View>
                          <Text style={{ fontSize: 10, color: '#5A7575', fontWeight: '700', marginTop: 4 }}>TOT: €{totF.toFixed(0)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              {fornitoriTotals.perFornitore.length === 0 && (
                <Text style={{ fontSize: 11, color: '#7A9090', textAlign: 'center', paddingVertical: 10 }}>Nessun dato fornitori nel periodo</Text>
              )}
            </View>
          )}
        </View>

        {renderChartBox('FORNITORI 2', fornitoriLines, 'fornitori')}

        {renderChartBox(t('stats.unsold'), invendutoLines, 'invenduto')}

        {/* ═══ DETTAGLIO INVENDUTO PER PRODOTTO ═══ */}
        {invendutoBreakdown.items.length > 0 && !collapsed['invenduto'] && (
          <View style={[st.card, { marginBottom: GAP, marginTop: -GAP + 2, backgroundColor: '#FFF5F3', borderLeftWidth: 3, borderLeftColor: '#D46A6A' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="cube-outline" size={14} color="#D46A6A" />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#8A3A3A', letterSpacing: 0.5, marginLeft: 6, flex: 1 }}>
                DETTAGLIO PER PRODOTTO ({invendutoBreakdown.items.length})
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#D46A6A' }}>
                €{invendutoBreakdown.totale.toFixed(0)}
              </Text>
            </View>
            {invendutoBreakdown.items.map((item, i) => {
              const pct = invendutoBreakdown.totale > 0 ? Math.round((item.totale / invendutoBreakdown.totale) * 100) : 0;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i === invendutoBreakdown.items.length - 1 ? 0 : 1, borderColor: '#FCE4E0' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE[i % PALETTE.length], marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A4040' }} numberOfLines={1}>
                      {item.nome}
                    </Text>
                    <Text style={{ fontSize: 9, color: '#8A7070' }}>
                      {item.giorni} {item.giorni === 1 ? 'giorno' : 'giorni'} · {pct}%
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#D46A6A' }}>
                    €{item.totale.toFixed(0)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {renderChartBox(t('stats.collaborators'), collabLines, 'collab')}

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

        <View style={{ height: 20 }} />
      </ScrollView>

      <MeteoStatsModal
        visible={showMeteo}
        onClose={() => setShowMeteo(false)}
        giornate={storicoGiornate}
      />

      {/* ═══ CALENDARIO PERSONALIZZATO ═══ */}
      <Modal visible={showPersCalendar} transparent animationType="fade" onRequestClose={() => setShowPersCalendar(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPersCalendar(false)}>
          <View style={{ backgroundColor: '#F5F0E6', borderRadius: 20, padding: 20, width: '85%' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 12 }}>
              Scegli il periodo
            </Text>

            {/* Date selezionate - tap per aprire calendario */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => { setPersPickingFrom(true); setShowPersDayCal(true); }} style={{ padding: 12, backgroundColor: '#1E7F85', borderRadius: 10, flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>DA</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>
                  {persDateFrom ? persDateFrom.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '---'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setPersPickingFrom(false); setShowPersDayCal(true); }} style={{ padding: 12, backgroundColor: '#E8A060', borderRadius: 10, flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>A</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>
                  {persDateTo ? persDateTo.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '---'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowPersCalendar(false)}
              style={{ backgroundColor: '#1A4040', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>INVIO</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendario giornaliero per selezionare DA/A */}
      <CalendarModal
        visible={showPersDayCal}
        onClose={() => setShowPersDayCal(false)}
        initialDate={persPickingFrom ? (persDateFrom || new Date()) : (persDateTo || new Date())}
        themeColor={persPickingFrom ? '#1E7F85' : '#E8A060'}
        title={persPickingFrom ? (t('stats.selectFrom') || 'Seleziona data INIZIO') : (t('stats.selectTo') || 'Seleziona data FINE')}
        onSelect={(d) => {
          if (persPickingFrom) {
            setPersDateFrom(d);
            // Se non c'è ancora il to, passa automaticamente a scegliere TO
            if (!persDateTo) {
              setPersPickingFrom(false);
              setShowPersDayCal(false);
              setTimeout(() => setShowPersDayCal(true), 250);
              return;
            }
          } else {
            setPersDateTo(d);
          }
          setShowPersDayCal(false);
        }}
      />

      {/* ═══ MODAL NETTO - Selezione voci da escludere ═══ */}
      <Modal
        visible={showNettoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNettoModal(false)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setShowNettoModal(false)}>
          <Pressable style={st.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>CALCOLO NETTO</Text>
              <TouchableOpacity onPress={() => setShowNettoModal(false)}>
                <Ionicons name="close" size={24} color="#5A7575" />
              </TouchableOpacity>
            </View>
            
            <Text style={st.modalSubtitle}>Seleziona le voci da escludere dal calcolo:</Text>
            
            <View style={st.checkboxList}>
              <TouchableOpacity 
                style={st.checkboxRow} 
                onPress={() => setExcludeSpeseFisse(!excludeSpeseFisse)}
              >
                <View style={[st.checkbox, excludeSpeseFisse && st.checkboxChecked]}>
                  {excludeSpeseFisse && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={st.checkboxLabel}>Spese Fisse</Text>
                <Text style={st.checkboxValue}>€{arrSum(speseFisseItems.map(i => i.value))}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={st.checkboxRow} 
                onPress={() => setExcludeCollaboratori(!excludeCollaboratori)}
              >
                <View style={[st.checkbox, excludeCollaboratori && st.checkboxChecked]}>
                  {excludeCollaboratori && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={st.checkboxLabel}>Collaboratori</Text>
                <Text style={st.checkboxValue}>€{arrSum(collabLines.map(l => arrSum(l.data)))}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={st.checkboxRow} 
                onPress={() => setExcludeSpeseExtra(!excludeSpeseExtra)}
              >
                <View style={[st.checkbox, excludeSpeseExtra && st.checkboxChecked]}>
                  {excludeSpeseExtra && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={st.checkboxLabel}>Spese Straordinarie</Text>
                <Text style={st.checkboxValue}>€{arrSum(filteredData.map(g => g.spese_extra || 0))}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={st.checkboxRow} 
                onPress={() => setExcludeInvenduto(!excludeInvenduto)}
              >
                <View style={[st.checkbox, excludeInvenduto && st.checkboxChecked]}>
                  {excludeInvenduto && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={st.checkboxLabel}>Invenduto</Text>
                <Text style={st.checkboxValue}>€{arrSum(invendutoLines.map(l => arrSum(l.data)))}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={st.checkboxRow} 
                onPress={() => setExcludeCarburante(!excludeCarburante)}
              >
                <View style={[st.checkbox, excludeCarburante && st.checkboxChecked]}>
                  {excludeCarburante && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={st.checkboxLabel}>Gestione Carburante</Text>
                <Text style={st.checkboxValue}>€{arrSum(store.storicoCarburante.map(c => c.euro))}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={st.modalDivider} />
            
            <View style={st.modalTotalRow}>
              <Text style={st.modalTotalLabel}>NETTO:</Text>
              <Text style={[st.modalTotalValue, { color: totNetto >= 0 ? PALETTE[1] : '#D46A6A' }]}>
                €{totNetto.toFixed(0)}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={st.modalCloseBtn} 
              onPress={() => setShowNettoModal(false)}
            >
              <Text style={st.modalCloseBtnTxt}>CHIUDI</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E6' },
  stickyHeader: { paddingHorizontal: 20, paddingTop: 8, backgroundColor: '#F5F0E6', zIndex: 10, gap: 8 },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 40 },
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#EDE8DA',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    // @ts-ignore
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#5A7575',
    marginBottom: 16,
    fontWeight: '600',
  },
  checkboxList: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E8E3D5',
    borderRadius: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#1E7F85',
    borderColor: '#1E7F85',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1A4040',
  },
  checkboxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E8A060',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#C0D0C8',
    marginVertical: 16,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A4040',
  },
  modalTotalValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  modalCloseBtn: {
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
