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
  Switch,
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
import { RoleGuard } from '../../src/components/RoleGuard';
// Round 64+66 — utility condivisa per i calcoli finanziari (Home e Stats
// devono usare LO STESSO algoritmo per evitare drift Utile vs Netto).
import {
  getWorkingDaysPerWeek,
  getMercatoDelGiorno,
  getPeriodBoundaries,
  isSpesaInPeriodo,
  isSpesaDeducibile,
  type FiltroTempo,
} from '../../src/utils/calcoli';
// Round 46: import rimosso — `proporzionaleFornitori` ora deprecato. La
// logica è "deduzione fissa di periodo" calcolata in linea (vedi
// `costoMerceProporzionaleMap` e `costoMerceProporzionalePerFornMap`).

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
const InteractiveLineChart = ({ labels, lines, height = 170, activeLineIndex, onPointPress }: {
  labels: string[];
  lines: { label: string; color: string; data: number[] }[];
  height?: number;
  activeLineIndex: number | null;
  onPointPress?: (lineIdx: number, pointIdx: number, value: number) => void;
}) => {
  const chartW = screenW - 70;
  const padL = 78;
  const padR = 14;
  const padT = 48;
  const padB = 30;
  const drawW = chartW - padL - padR;
  const drawH = height - padT - padB;

  // Compact number format: 1234 → '1.2k', 12345 → '12k', sub-1000 unchanged
  const fmtCompact = (n: number): string => {
    const abs = Math.abs(n);
    if (abs >= 1000) {
      const k = n / 1000;
      return `€${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    return `€${Math.round(n)}`;
  };

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
            <SvgText x={padL - 8} y={y + 5} fill="#1A4040" fontSize={13} textAnchor="end" fontWeight="800">
              {fmtCompact(val)}
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
                {activeLineIndex !== null && p.v > 0 && (() => {
                  // ═══ POSIZIONAMENTO ETICHETTA INTELLIGENTE ═══
                  // 1. Anchor X dinamico — primo punto: text a destra; ultimo: a sinistra; medi: centrato
                  const isFirst = i === 0;
                  const isLast = i === pts.length - 1;
                  const anchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : (isLast ? 'end' : 'middle');
                  const xOff = isFirst ? 8 : (isLast ? -8 : 0);

                  // 2. Anchor Y adattivo — se il punto è nella metà superiore, label sotto.
                  //    Se è nella metà inferiore, label sopra. Garantisce sempre 14dp dal punto.
                  const drawHeight = drawH;
                  const distFromTop = p.y - padT;
                  const labelAbove = distFromTop > drawHeight * 0.35; // soglia 35% dall'alto
                  // 14dp di margine garantito (collision detection rispetto al punto)
                  const yOff = labelAbove ? -16 : 22;

                  // 3. Font ridotto a 11 (era 13) per evitare sovrapposizioni con la griglia.
                  //    Stroke bianco a 5dp = pillola di sfondo che separa il testo dalla linea della griglia.
                  return (
                    <>
                      <SvgText x={p.x + xOff} y={p.y + yOff} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={5} fontSize={12} fontWeight="900" textAnchor={anchor}>
                        {`€${p.v.toFixed(0)}`}
                      </SvgText>
                      <SvgText x={p.x + xOff} y={p.y + yOff} fill={line.color} fontSize={12} fontWeight="900" textAnchor={anchor}>
                        {`€${p.v.toFixed(0)}`}
                      </SvgText>
                    </>
                  );
                })()}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
      {labels.map((l, i) => (
        <SvgText key={i} x={padL + i * stepX} y={height - 6} fill="#3A5050" fontSize={10} textAnchor="middle" fontWeight="800">
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
  return (
    <RoleGuard
      allow={(p) => p.canSeeStats}
      message={'Le statistiche sono accessibili solo all\u2019amministratore e al manager.'}
    >
      <StatsScreenInner />
    </RoleGuard>
  );
}

function StatsScreenInner() {
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
  const [showFattureLog, setShowFattureLog] = useState(true);
  const [expandedFornitore, setExpandedFornitore] = useState<string | null>(null);
  // Filtro click-to-isolate per il grafico ANDAMENTO NEL TEMPO dei fornitori
  // null = tutti visibili, numero = solo quel fornitore (gli altri spariscono)
  const [activeFornIdx, setActiveFornIdx] = useState<number | null>(null);
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
    vociExtra: false,
  });
  const toggleCollapsed = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  // Date range per filtro personalizzato
  const [persDateFrom, setPersDateFrom] = useState<Date | null>(null);
  const [persDateTo, setPersDateTo] = useState<Date | null>(null);
  const [showPersCalendar, setShowPersCalendar] = useState(false);
  const [persPickingFrom, setPersPickingFrom] = useState(true); // true = picking FROM, false = picking TO
  const [showPersDayCal, setShowPersDayCal] = useState(false); // calendario vero e proprio
  // Round 52: data di riferimento per filtri Sett./Mese/Anno.
  // Permette all'utente di navigare avanti/indietro nel tempo cliccando le
  // frecce sul box periodo (o tappando il box per aprire un calendar picker).
  // Default: oggi. Quando si cambia filtroTempo viene resettata via useEffect.
  const [dataRiferimento, setDataRiferimento] = useState<Date>(new Date());
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  // Reset dataRiferimento ad oggi quando l'utente cambia filtro tempo
  useEffect(() => {
    setDataRiferimento(new Date());
    setShowPeriodPicker(false);
  }, [filtroTempo]);
  const [pdfMonth, setPdfMonth] = useState(new Date().getMonth());
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());
  const [showPdfPicker, setShowPdfPicker] = useState(false);

  const [activeChartLine, setActiveChartLine] = useState<Record<string, number | null>>({});
  const [tooltipInfo, setTooltipInfo] = useState<{ chartKey: string; lineIdx: number; pointIdx: number; value: number } | null>(null);
  const [showNettoModal, setShowNettoModal] = useState(false);
  // Netto deduction flags
  const [excludeSpeseFisse, setExcludeSpeseFisse] = useState(false);
  const [excludeCollaboratori, setExcludeCollaboratori] = useState(false);
  const [excludeSpeseExtra, setExcludeSpeseExtra] = useState(false);
  const [excludeFornitori, setExcludeFornitori] = useState(false);
  const [excludeInvenduto, setExcludeInvenduto] = useState(false);
  const [excludeCarburante, setExcludeCarburante] = useState(false);

  /* ═══ Round 60 — FLAG PER-FORNITORE (CUSTOM/WEEKLY/MONTHLY) ═══
     Mappa: chiave `${nome}__${ISOacquisto}__${ISOstorno}` ⇒ true=escluso.
     Se la chiave manca, si usa il default: ESCLUSO se dataStorno è fuori
     dal periodo visualizzato (così la statistica giornaliera/settimanale/
     mensile non sottrae per default fornitori che hanno scadenza altrove). */
  const [excludeFornitoreScad, setExcludeFornitoreScad] = useState<Record<string, boolean>>({});

  // Round 66 — Stato del dropdown "FORN. SPESA RIPART." (collassato di default)
  const [showFornRipart, setShowFornRipart] = useState(false);

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

  // ═══ NON inietta dati di mock automaticamente. Lo storico è vuoto al primo
  //     avvio e si popola solo quando l'utente salva le proprie giornate. ═══

  const now = new Date();

  const filteredByTime = useMemo(() => {
    return storicoGiornate.filter((g) => {
      const d = new Date(g.data);
      if (filtroTempo === 'Oggi') return isSameDay(d, now);
      if (filtroTempo === 'Ieri') {
        const ieri = new Date(now); ieri.setDate(ieri.getDate() - 1);
        return isSameDay(d, ieri);
      }
      // Round 52: settimana/mese/anno relativi alla dataRiferimento navigabile
      if (filtroTempo === 'Sett.') return isSameWeek(d, dataRiferimento);
      if (filtroTempo === 'Mese') return isSameMonth(d, dataRiferimento);
      if (filtroTempo === 'Anno') return isSameYear(d, dataRiferimento);
      if (filtroTempo === 'Pers.' && persDateFrom && persDateTo) {
        const from = new Date(persDateFrom); from.setHours(0,0,0,0);
        const to = new Date(persDateTo); to.setHours(23,59,59,999);
        return d >= from && d <= to;
      }
      return true;
    });
  }, [storicoGiornate, filtroTempo, persDateFrom, persDateTo, dataRiferimento]);

  /* ── Carburante filtrato per il PERIODO selezionato ───────────────────
     Bug fix: nel modal "Calcolo Netto" mostravamo `arrSum(storicoCarburante)`
     che è il TOTALE storico (intera vita app), invece del solo periodo
     filtrato. Ora calcoliamo separatamente la spesa carburante nel periodo
     applicando lo STESSO criterio di `filteredByTime` ai dati carburante.
     Tipologia (FIERE/TUTTO) non si applica al carburante (è agnostico). */
  const carburantePeriodoTotale = useMemo(() => {
    const list = (storicoCarburante || []) as Array<{ data: Date | string; euro: number }>;
    return list.filter((c) => {
      try {
        const d = new Date(c.data);
        if (filtroTempo === 'Oggi') return isSameDay(d, now);
        if (filtroTempo === 'Ieri') {
          const ieri = new Date(now); ieri.setDate(ieri.getDate() - 1);
          return isSameDay(d, ieri);
        }
        // Round 52: stesso criterio del filteredByTime — dataRiferimento navigabile
        if (filtroTempo === 'Sett.') return isSameWeek(d, dataRiferimento);
        if (filtroTempo === 'Mese') return isSameMonth(d, dataRiferimento);
        if (filtroTempo === 'Anno') return isSameYear(d, dataRiferimento);
        if (filtroTempo === 'Pers.' && persDateFrom && persDateTo) {
          const from = new Date(persDateFrom); from.setHours(0, 0, 0, 0);
          const to = new Date(persDateTo); to.setHours(23, 59, 59, 999);
          return d >= from && d <= to;
        }
        return true;
      } catch { return false; }
    }).reduce((acc, c) => acc + (Number(c.euro) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storicoCarburante, filtroTempo, persDateFrom, persDateTo, dataRiferimento]);

  /* ═══ Round 72 — TOTALE FATTURE nel periodo (da fattureLog immutabile) ═══
     Somma esatta di TUTTE le fatture inserite con dataEmissione nel periodo.
     Risolve il bug "appare solo l'importo dell'ultima fattura segnata":
     ora ogni fattura è un record separato e il totale è sempre aggiornato. */
  const fattureLog = (store as any).fattureLog || [];
  const fatturePeriodoStats = useMemo(() => {
    const inRange = (iso: string) => {
      try {
        const d = new Date((iso || '') + 'T12:00:00');
        if (isNaN(d.getTime())) return false;
        if (filtroTempo === 'Oggi') return isSameDay(d, now);
        if (filtroTempo === 'Ieri') {
          const ieri = new Date(now); ieri.setDate(ieri.getDate() - 1);
          return isSameDay(d, ieri);
        }
        if (filtroTempo === 'Sett.') return isSameWeek(d, dataRiferimento);
        if (filtroTempo === 'Mese') return isSameMonth(d, dataRiferimento);
        if (filtroTempo === 'Anno') return isSameYear(d, dataRiferimento);
        if (filtroTempo === 'Pers.' && persDateFrom && persDateTo) {
          const from = new Date(persDateFrom); from.setHours(0, 0, 0, 0);
          const to = new Date(persDateTo); to.setHours(23, 59, 59, 999);
          return d >= from && d <= to;
        }
        return true;
      } catch { return false; }
    };
    const items: any[] = (fattureLog || []).filter((f: any) => inRange(f.dataEmissione));
    const totale = items.reduce((acc, f) => acc + (Number(f.importo) || 0), 0);
    // Aggregato per fornitore
    const perFornitore: Record<string, { count: number; totale: number }> = {};
    items.forEach((f: any) => {
      const nome = f.fornitore || '(senza nome)';
      if (!perFornitore[nome]) perFornitore[nome] = { count: 0, totale: 0 };
      perFornitore[nome].count++;
      perFornitore[nome].totale += Number(f.importo) || 0;
    });
    return { count: items.length, totale, perFornitore, items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fattureLog, filtroTempo, persDateFrom, persDateTo, dataRiferimento]);

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

  /* ═══════════════════════════════════════════════════════════════════
     ALGORITMO PONDERATO COSTI FORNITORI CUSTOM (Round 37)
     ─────────────────────────────────────────────────────────────────
     Specifica utente: "L'app ripartisce il totale dei costi
     settimanali/mensili sui giorni di lavoro in modo proporzionale al
     volume d'affari giornaliero, mantenendo il bilancio perfetto a
     fine periodo."

     Formula:  CG_d = (LG_d / W_rt) * C_ct
       CG_d   = costo giornaliero ponderato per il giorno d
       LG_d   = lordo del giorno d
       W_rt   = somma dei lordi nel periodo
       C_ct   = totale fatture fornitori CUSTOM nel periodo

     Garantisce:
       Σ CG_d = C_ct   → totale esatto delle fatture caricate
       Giorni alto incasso → più costo merce (più realistico)
       Single source of truth: usa `Fornitore.deductionMode/Days` come
       riferimento, così cambi retroattivi si propagano automaticamente.

     Implementazione (Round 46): semplificata. Per ogni giornata,
     somma TUTTI gli importi CUSTOM in dettaglio_fornitori → mappa 'YYYY-MM-DD' → totale.
     ───────────────────────────────────────────────────────────────── */
  const costoMerceProporzionaleMap = useMemo(() => {
    // Round 46 NUOVA LOGICA: importo INTERO per giornata di registrazione,
    // no distribuzione matematica.
    const out: Record<string, number> = {};
    (storicoGiornate || []).forEach((g: any) => {
      const det = g.dettaglio_fornitori || {};
      const ded = g.dettaglio_fornitori_deduction || {};
      let dayTot = 0;
      Object.entries(det).forEach(([nomeForn, importo]) => {
        const imp = Number(importo) || 0;
        if (imp <= 0) return;
        if (nomeForn.endsWith('__fattn') || nomeForn.endsWith('__liberaLabel')) return;
        const nomeBase = nomeForn.replace(/__libera$/, '');
        const mode = (ded[nomeBase] || 'DAILY') as string;
        if (mode === 'DAILY') return; // già in g.netto
        dayTot += imp;
      });
      if (dayTot > 0) {
        try {
          const day = new Date(g.data).toISOString().slice(0, 10);
          out[day] = (out[day] || 0) + dayTot;
        } catch {}
      }
    });
    return out;
  }, [storicoGiornate]);

  /* ── Costo merce CUSTOM TOTALE nel periodo filtrato ──
     Σ degli importi CUSTOM per i soli giorni in `filteredData`. */
  const totCostoMerceProp = useMemo(() => {
    return filteredData.reduce((acc, g) => {
      try {
        const k = new Date(g.data).toISOString().slice(0, 10);
        return acc + (costoMerceProporzionaleMap[k] || 0);
      } catch {
        return acc;
      }
    }, 0);
  }, [filteredData, costoMerceProporzionaleMap]);

  /* ═══════════════════════════════════════════════════════════════════
     ROUND 46 — NUOVA LOGICA "DETRAZIONE FISSA DI PERIODO":
     L'utente ha cambiato la logica: la fattura CUSTOM non si distribuisce
     più matematicamente sui giorni del periodo, ma viene trattata come
     una DETRAZIONE FISSA sull'incasso lordo del periodo specificato.
     L'algoritmo proporzionale è mantenuto come backup ma queste mappe
     ora calcolano direttamente dalla giornata di registrazione.

     Per ogni giornata in filteredData:
       - Se ha entries CUSTOM in dettaglio_fornitori → conta INTERAMENTE
         l'importo per quel fornitore (no distribuzione)
       - Se DAILY → già in g.netto, skipped
     ─────────────────────────────────────────────────────────────────── */
  const costoMerceProporzionalePerFornMap = useMemo(() => {
    // ⚠️ Compatibilità back: questa variabile viene ancora usata dal
    // grafico di distribuzione giornaliera dentro l'espansione fornitore.
    // Per la NUOVA LOGICA, popoliamo SOLO il giorno di registrazione di
    // ogni fattura (no distribuzione). Visivamente si vedrà una singola
    // barra alta nel giorno di registrazione.
    const out: Record<string, Record<string, number>> = {};
    (storicoGiornate || []).forEach((g: any) => {
      const det = g.dettaglio_fornitori || {};
      const ded = g.dettaglio_fornitori_deduction || {};
      Object.entries(det).forEach(([nomeForn, importo]) => {
        const imp = Number(importo) || 0;
        if (imp <= 0) return;
        if (nomeForn.endsWith('__fattn') || nomeForn.endsWith('__liberaLabel')) return;
        const nomeBase = nomeForn.replace(/__libera$/, '');
        const mode = (ded[nomeBase] || 'DAILY') as string;
        if (mode === 'DAILY') return; // DAILY già detratto in g.netto
        // Round 46: importo INTERO sul giorno di registrazione
        try {
          const iso = new Date(g.data).toISOString().slice(0, 10);
          if (!out[nomeBase]) out[nomeBase] = {};
          out[nomeBase][iso] = (out[nomeBase][iso] || 0) + imp;
        } catch {}
      });
    });
    return out;
  }, [storicoGiornate]);

  /** Round 46: per ogni fornitore CUSTOM, totale REALE delle fatture
   *  registrate dentro il periodo selezionato (NO distribuzione). */
  const costoMerceProporzPerFornPeriodo = useMemo(() => {
    const out: Record<string, number> = {};
    filteredData.forEach((g: any) => {
      const det = g.dettaglio_fornitori || {};
      const ded = g.dettaglio_fornitori_deduction || {};
      Object.entries(det).forEach(([nomeForn, importo]) => {
        const imp = Number(importo) || 0;
        if (imp <= 0) return;
        if (nomeForn.endsWith('__fattn') || nomeForn.endsWith('__liberaLabel')) return;
        const nomeBase = nomeForn.replace(/__libera$/, '');
        const mode = (ded[nomeBase] || 'DAILY') as string;
        if (mode === 'DAILY') return;
        out[nomeBase] = (out[nomeBase] || 0) + imp;
      });
    });
    // Arrotonda
    Object.keys(out).forEach((k) => { out[k] = Math.round(out[k] * 100) / 100; });
    return out;
  }, [filteredData]);

  const totLordo = arrSum(filteredData.map((g) => g.lordo || 0));
  /* Netto baseline: prima `g.netto` (in home con solo DAILY). Il vero `totNetto`
     usato in UI è ora un useMemo più sotto (Round 56) che applica i flag
     exclude* del modal "Calcolo Netto" — vedi sotto la dichiarazione di
     `vociExtraPeriod`. */
  const totNettoBaseline = arrSum(filteredData.map((g) => g.netto || 0));
  const totCash = arrSum(filteredData.map((g) => g.contanti || 0));
  const totPos = arrSum(filteredData.map((g) => g.pos || 0));
  const giorniLav = filteredData.length;

  const chartLabels = useMemo(() => {
    const monthNames = getMonthNames();
    // Solo INIZIALE per il filtro Anno (G,F,M,A,...) → mesi non si sovrappongono nel grafico
    const shortMonths = monthNames.map(m => m.substring(0, 1).toUpperCase());
    const shortDays = getShortDayNames();
    if (filtroTempo === 'Anno') return shortMonths;
    if (filtroTempo === 'Mese') {
      // Supporto per mesi a 5 settimane — Round 67: usa dataRiferimento
      // (mese navigato) e NON la data odierna, così navigando ai mesi
      // passati le settimane sono quelle del mese mostrato.
      const ref = dataRiferimento;
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      const numWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
      const weeksCount = Math.min(numWeeks, 5);
      return Array.from({ length: weeksCount }, (_, i) => `S${i + 1}`);
    }
    return shortDays;
  }, [filtroTempo, t, dataRiferimento]);

  const groupData = (data: Giornata[], field: (g: Giornata) => number): number[] => {
    if (filtroTempo === 'Anno') {
      const months = Array(12).fill(0);
      data.forEach((g) => { months[new Date(g.data).getMonth()] += field(g); });
      return months;
    }
    if (filtroTempo === 'Mese') {
      // Supporto per mesi a 5 settimane — Round 67: usa dataRiferimento
      // (mese navigato) per calcolare il numero di settimane corretto.
      const ref = dataRiferimento;
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
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
    // FIX: come per fornitoriLines, i nomi nei dettaglio_staff possono avere
    // spazi/case differenti rispetto a c.nome (es. "Antonella " vs "Antonella").
    // Confrontiamo dopo trim() + lowercase.
    const norm = (s: string) => (s || '').trim().toLowerCase();
    return collaboratori.map((c, i) => {
      const target = norm(c.nome);
      return {
        label: c.nome,
        color: PALETTE[(i + 3) % PALETTE.length],
        data: groupData(filteredData, (g) => {
          if (!g.dettaglio_staff) return 0;
          let total = 0;
          Object.entries(g.dettaglio_staff).forEach(([k, v]) => {
            if (norm(k) !== target) return;
            if (typeof v === 'number') total += v;
            else if (typeof v === 'boolean') total += v ? (c.costo || 0) : 0;
          });
          return total;
        }),
      };
    });
  }, [filteredData, filtroTempo, collaboratori]);

  const fornitoriLines = useMemo(() => {
    // Per ogni fornitore della rubrica, somma Fatturata + Libera da ogni giornata.
    // Round 66: INCLUDE ANCHE le spese ripartite (categoria='fornitore') del
    //           fornitore quando il dayOfPurchase cade nella giornata `g`.
    //           Prima un fornitore con SOLO ripartite mostrava 0 — non è
    //           più così, ora il totale per periodo è completo.
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const spList = Array.isArray(store.spesePeriodiche) ? store.spesePeriodiche : [];
    return fornitori.map((f, i) => {
      const targetNome = norm(f.nome);
      // Indicizza le ripartite di QUESTO fornitore per dayOfPurchase
      const ripByDay: Record<string, number> = {};
      spList.forEach((sp: any) => {
        if (norm(sp.nome) !== targetNome) return;
        if (sp.categoria && sp.categoria !== 'fornitore') return;
        const dp = sp.dayOfPurchase || sp.from;
        if (!dp) return;
        ripByDay[dp] = (ripByDay[dp] || 0) + (Number(sp.importo) || 0);
      });
      return {
        label: f.nome,
        color: PALETTE[(i + 1) % PALETTE.length],
        data: groupData(filteredData, (g) => {
          let total = 0;
          // Fornitori DAILY tracciati in dettaglio_fornitori
          if (g.dettaglio_fornitori) {
            Object.entries(g.dettaglio_fornitori).forEach(([k, v]) => {
              const isLibera = k.includes('__libera') && !k.includes('__liberaLabel');
              const isFatturata = !k.includes('__');
              if (!isLibera && !isFatturata) return;
              const baseName = k.replace(/__libera$/, '').replace(/__liberaLabel$/, '');
              if (norm(baseName) === targetNome) {
                total += (v as number) || 0;
              }
            });
          }
          // Round 66: aggiunge le ripartite acquistate proprio in questa giornata.
          try {
            const dIso = `${new Date(g.data).getFullYear()}-${String(new Date(g.data).getMonth() + 1).padStart(2, '0')}-${String(new Date(g.data).getDate()).padStart(2, '0')}`;
            if (ripByDay[dIso]) total += ripByDay[dIso];
          } catch { /* skip */ }
          return total;
        }),
      };
    });
  }, [filteredData, filtroTempo, fornitori, store.spesePeriodiche]);

  const speseFisseItems = useMemo(() => {
    /* ═══ Round 64 — ALLINEAMENTO HOME/STATS ═══
       L'utente segnalava drift fra Home Utile e Stats Netto sulle SPESE FISSE
       (es. €21 vs €16). Causa: stats usava `daysInPeriod/365` mentre Home usa
       `annual/(48 × workdaysPerWeek)` per giornata lavorata. Ora stats usa
       LA STESSA formula di Home e somma per ogni giornata lavorata del
       periodo. In questo modo: NETTO(periodo) == Σ UTILE(giornata) — sempre. */
    const workdays = getWorkingDaysPerWeek(agenda);
    // Giornate "in piazza" (lavorate) del periodo filtrato. inPiazza !== false
    // include sia gli storici nuovi (con il flag) sia i legacy (senza flag, considerati true).
    const giornateLavorate = filteredData.filter((g: any) => g.inPiazza !== false);
    const nGiornateLav = giornateLavorate.length;

    const items: { label: string; value: number; color: string }[] = [];

    // 1) Voci annue (assicurazione, bollo, commercialista, ecc.)
    //    quotaGG = importo / (48 × workdays). Tot = quotaGG × nGiornateLav.
    (speseAnnue || []).forEach((sp) => {
      if (!sp || (Number(sp.importo) || 0) <= 0) return;
      const quotaGG = (Number(sp.importo) || 0) / (48 * workdays);
      const valore = Math.max(Math.round(quotaGG * nGiornateLav), nGiornateLav > 0 ? 1 : 0);
      if (valore > 0) {
        items.push({
          label: sp.voce,
          value: valore,
          color: PALETTE[items.length % PALETTE.length],
        });
      }
    });

    // 2) Plateatico per ogni mercato — sommato per ogni giornata effettivamente lavorata
    //    su quel mercato (stessa logica di Home: p_giornaliero se >0, altrimenti
    //    p_annuo/(48×workdays)).
    const targetDayIdx = (() => {
      if (filtroTipo === 'TUTTO' || filtroTipo === 'FIERE') return -1;
      const jsDay = GIORNO_MAP[filtroTipo];
      if (jsDay === undefined || jsDay < 0) return -1;
      return jsDay === 0 ? 6 : jsDay - 1; // LUN=0..DOM=6
    })();
    const platByMercato: Record<string, number> = {};
    giornateLavorate.forEach((g: any) => {
      try {
        const d = new Date(g.data);
        const merc = getMercatoDelGiorno(d, agenda);
        if (!merc) return;
        if (targetDayIdx >= 0) {
          const mercatoIdx = (d.getDay() + 6) % 7;
          if (mercatoIdx !== targetDayIdx) return;
        }
        let plat = 0;
        if ((merc as any).p_giornaliero && (merc as any).p_giornaliero > 0) {
          plat = Number((merc as any).p_giornaliero) || 0;
        } else if ((merc as any).p_annuo && (merc as any).p_annuo > 0) {
          plat = (Number((merc as any).p_annuo) || 0) / (48 * workdays);
        }
        if (plat > 0) {
          const label = `Plat. ${merc.mercato || merc.giorno}`;
          platByMercato[label] = (platByMercato[label] || 0) + plat;
        }
      } catch { /* skip */ }
    });
    Object.entries(platByMercato).forEach(([label, totale]) => {
      const valore = Math.max(Math.round(totale), 1);
      items.push({
        label,
        value: valore,
        color: PALETTE[items.length % PALETTE.length],
      });
    });

    // 3) Carburante: NON viene incluso qui per evitare double-count con
    //    `carburantePeriodoTotale` (riga "GESTIONE CARBURANTE" del modal Netto,
    //    che mostra il dato REALE dai distributori). La stima km × 0.20€
    //    presente in Home/Utile è invece estimata; nelle Statistiche prevale
    //    il dato reale. Se l'utente vuole un singolo importo allineato a Home,
    //    può sempre escludere "GESTIONE CARBURANTE" dal calcolo Netto col flag.
    return items;
  }, [speseAnnue, agenda, filteredData, filtroTipo]);

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
    // ═══ COSTO MERCE RIPARTITO PER FORNITORE (Round 38) ═══
    // Per ogni fornitore con modalità CUSTOM, mostra la quota proporzionata
    // distribuita nel periodo come voce di "Spese Extra" → l'utente la vede
    // come una spesa giornaliera del singolo fornitore.
    Object.entries(costoMerceProporzPerFornPeriodo).forEach(([forn, importo]) => {
      const rounded = Math.round(importo);
      if (rounded <= 0) return;
      items.push({
        label: `Forn. ${forn}`,
        value: rounded,
        color: PALETTE[(items.length + 2) % PALETTE.length],
      });
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
  }, [filteredData, t, costoMerceProporzPerFornPeriodo]);

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

    /* ═══ Round 66 — INCLUDE LE SPESE RIPARTITE DI FORNITORE ═══
       L'utente segnalava: "FORNITORI TOT" mostra 0 quando un fornitore
       ha solo ripartite. Fix: somma anche le spese ripartite
       (categoria='fornitore') comprate nelle giornate del periodo
       filtrato.
       Round 67 — BUG FIX FATTURE DISPERSE: prima TUTTE le ripartite
       finivano sotto "libera" (contanti) anche se pagate a fattura.
       Ora classifichiamo usando importoFattura/importoContanti (split
       salvato al momento dell'acquisto) oppure, per i dati legacy,
       pagamentoMode/numeroFattura. */
    try {
      const spList = Array.isArray(store.spesePeriodiche) ? store.spesePeriodiche : [];
      // Set di ISO date delle giornate visibili (per evitare doppi conteggi)
      const daysIso = new Set<string>();
      filteredData.forEach((g: any) => {
        try {
          const d = new Date(g.data);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          daysIso.add(iso);
        } catch { /* skip */ }
      });
      spList.forEach((sp: any) => {
        if (sp.categoria && sp.categoria !== 'fornitore') return;
        const dp = sp.dayOfPurchase || sp.from;
        if (!dp || !daysIso.has(dp)) return;
        const imp = Number(sp.importo) || 0;
        if (imp <= 0) return;
        let f = 0;
        let l = 0;
        if (typeof sp.importoFattura === 'number' || typeof sp.importoContanti === 'number') {
          // Nuovo formato (Round 67): split esplicito fattura/contanti
          f = Number(sp.importoFattura) || 0;
          l = Number(sp.importoContanti) || 0;
          const resto = imp - f - l;
          if (resto > 0.005) l += resto; // safety: nessun importo disperso
        } else if (sp.pagamentoMode === 'fattura' || sp.pagamentoMode === 'misto'
          || (sp.numeroFattura && String(sp.numeroFattura).trim() !== '')) {
          // Legacy con indizio di fattura → classifica come fatturata
          f = imp;
        } else {
          l = imp;
        }
        fatturata += f;
        libera += l;
        if (!perForn[sp.nome]) perForn[sp.nome] = { fatturata: 0, libera: 0 };
        perForn[sp.nome].fatturata += f;
        perForn[sp.nome].libera += l;
      });
    } catch { /* skip */ }
    
    return {
      fatturata: Math.round(fatturata),
      libera: Math.round(libera),
      totale: Math.round(fatturata + libera),
      perFornitore: Object.entries(perForn).map(([nome, vals]) => ({
        nome, fatturata: Math.round(vals.fatturata), libera: Math.round(vals.libera),
      })).sort((a, b) => (b.fatturata + b.libera) - (a.fatturata + a.libera)),
    };
  }, [filteredData, store.spesePeriodiche]);

  /* ═══ VOCI EXTRA PERIODO (fornitori marcati WEEKLY/MONTHLY) ═══
     Queste voci NON vengono detratte dal netto del giorno; vengono
     accantonate e mostrate solo nel riepilogo del periodo. */
  const vociExtraPeriod = useMemo(() => {
    const items: Array<{ nome: string; importo: number; type: 'WEEKLY' | 'MONTHLY'; data: Date }> = [];
    let totWeekly = 0;
    let totMonthly = 0;
    let totDailyDeducted = 0;
    filteredData.forEach((g: any) => {
      const ded = g.dettaglio_fornitori_deduction || {};
      const det = g.dettaglio_fornitori || {};
      // Aggrega per nomeBase (somma fattura + contanti per ciascun fornitore)
      const sumByBase: Record<string, number> = {};
      Object.entries(det).forEach(([k, v]) => {
        const val = parseFloat(String(v)) || 0;
        if (val <= 0) return;
        const nomeBase = k.endsWith('__libera') ? k.slice(0, -'__libera'.length) : k;
        if (k.includes('__fattn') || k.includes('__liberaLabel')) return;
        sumByBase[nomeBase] = (sumByBase[nomeBase] || 0) + val;
      });
      Object.entries(sumByBase).forEach(([nomeBase, importo]) => {
        const dt = ded[nomeBase] || 'DAILY';
        if (dt === 'DAILY') {
          totDailyDeducted += importo;
        } else if (dt === 'WEEKLY') {
          totWeekly += importo;
          items.push({ nome: nomeBase, importo, type: 'WEEKLY', data: new Date(g.data) });
        } else if (dt === 'MONTHLY') {
          totMonthly += importo;
          items.push({ nome: nomeBase, importo, type: 'MONTHLY', data: new Date(g.data) });
        }
      });
    });
    // Quale parte degli "accantoni" è effettivamente da scalare per il periodo selezionato:
    //  - Sett./Oggi/Ieri: solo WEEKLY (le MONTHLY vengono detratte solo a livello mese)
    //  - Mese/Anno/Pers.: WEEKLY + MONTHLY
    const isWeekishView = filtroTempo === 'Sett.' || filtroTempo === 'Oggi' || filtroTempo === 'Ieri';
    const totExtraInPeriod = isWeekishView ? totWeekly : (totWeekly + totMonthly);
    return {
      items: items.sort((a, b) => b.data.getTime() - a.data.getTime()),
      totWeekly: Math.round(totWeekly),
      totMonthly: Math.round(totMonthly),
      totDailyDeducted: Math.round(totDailyDeducted),
      totExtraInPeriod: Math.round(totExtraInPeriod),
    };
  }, [filteredData, filtroTempo]);

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

  /* ═══ ROUND 60 — FORNITORI A SCADENZA INDIVIDUALI ═══
     Estrae da filteredData ogni fornitore CUSTOM/WEEKLY/MONTHLY con la sua
     data di acquisto e calcola la data di storno effettiva. Per ogni voce
     l'utente potrà flaggare individualmente l'esclusione dal netto.

     Output:
       items: { key, nome, importo, dataAcquisto, dataStorno, type, inPeriod }
       totSelezionato: somma degli importi NON esclusi (rispetta excludeFornitoreScad)

     Calcolo dataStorno:
       • DAILY → coincide con dataAcquisto (non rilevante qui)
       • WEEKLY → domenica della settimana di dataAcquisto (Lun→Dom)
       • CUSTOM / MONTHLY → dataAcquisto + (days - 1)

     `inPeriod` = true se dataStorno ∈ [filtroFrom..filtroTo].
     Default flag: voce ESCLUSA se !inPeriod (l'utente la vede ma non
     viene sottratta dal netto del periodo visualizzato). */
  const fornitoriScadenze = useMemo(() => {
    type Item = {
      key: string; nome: string; importo: number;
      dataAcquisto: string; dataStorno: string;
      type: 'WEEKLY' | 'CUSTOM' | 'MONTHLY';
      categoria: 'fornitore' | 'voce';
      inPeriod: boolean;
    };
    const items: Item[] = [];

    // Round 66 — period boundaries CALENDAR-BASED (non più derivati da filteredByTime).
    // Per "Sett." prende Lun-Dom della settimana corrente (anche se non ci sono giornate
    // salvate in quei giorni). Per "Pers." usa le date scelte dall'utente.
    // Round 67 — passa dataRiferimento così navigando i periodi passati i
    // confini seguono il periodo mostrato (e non sempre oggi).
    const { from: periodFrom, to: periodTo } = getPeriodBoundaries(
      filtroTempo as FiltroTempo,
      persDateFrom,
      persDateTo,
      dataRiferimento,
    );

    /* ═══ Round 61 — sorgente UNICA: store.spesePeriodiche ═══
       Round 66 — APPLICATA REGOLA B: filtra strettamente per periodo
       (dayOfPurchase ∈ periodo OPPURE to ∈ periodo). Spese di settimane
       precedenti o successive non rilevanti vengono escluse. */
    const spList = Array.isArray(store.spesePeriodiche) ? store.spesePeriodiche : [];
    spList.forEach((sp: any) => {
      const visible = isSpesaInPeriodo(sp, periodFrom, periodTo);
      if (!visible) return;
      // Deducibile dal netto (toggle ON default) se `to` cade nel periodo.
      const inPeriod = isSpesaDeducibile(sp, periodFrom, periodTo);
      items.push({
        key: sp.id || `${sp.nome}__${sp.dayOfPurchase}__${sp.to}`,
        nome: sp.nome,
        importo: Number(sp.importo) || 0,
        dataAcquisto: sp.dayOfPurchase,
        dataStorno: sp.to,
        type: (sp.type as 'WEEKLY' | 'CUSTOM' | 'MONTHLY') || 'CUSTOM',
        categoria: (sp.categoria as 'fornitore' | 'voce') || 'fornitore',
        inPeriod,
      });
    });

    const totSelezionato = items.reduce((s, it) => {
      const userExcluded = excludeFornitoreScad[it.key];
      const isExcluded = userExcluded !== undefined ? userExcluded : !it.inPeriod;
      return s + (isExcluded ? 0 : it.importo);
    }, 0);

    // Calcolo del totale "promemoria" (le voci visibili ma NON ancora scalate)
    const totPromemoria = items
      .filter((it) => !it.inPeriod)
      .reduce((s, it) => s + it.importo, 0);

    return {
      items: items.sort((a, b) => b.dataStorno.localeCompare(a.dataStorno)),
      totSelezionato: Math.round(totSelezionato),
      totPromemoria: Math.round(totPromemoria),
    };
  }, [store.spesePeriodiche, filtroTempo, persDateFrom, persDateTo, excludeFornitoreScad, dataRiferimento]);

  /* ═══ ROUND 56 — TOT NETTO RICALCOLATO IN BASE AI FLAG ═══
     L'utente segnalava: nel modal "Calcolo Netto" le voci si flaggano
     visualmente ma il NETTO non si aggiorna. Era perché il vecchio
     `totNetto` era una costante fissa (totNettoBaseline − totCostoMerceProp)
     che non considerava i flag exclude*.
     Ora `totNetto` è un useMemo che parte dal lordo e sottrae SOLO le
     categorie NON escluse, esattamente come UtileModal in Home. */
  const totNetto = useMemo(() => {
    const totSpeseFisse = arrSum(speseFisseItems.map((i) => i.value));
    const totCollab = arrSum(collabLines.map((l) => arrSum(l.data)));
    const totSpeseExtra = arrSum(filteredData.map((g) => g.spese_extra || 0));
    // Round 62: separiamo strettamente DAILY (sottraibili dal netto giornaliero)
    // dai periodici (gestiti da `fornitoriScadenze`, vedi sotto).
    // `totCostoMerceProp` (LEGACY) NON viene più applicato qui per evitare
    // doppio conteggio dopo la migrazione Round 61 in spesePeriodiche.
    const totFornitoriDaily = vociExtraPeriod.totDailyDeducted;
    const totInvenduto = arrSum(invendutoLines.map((l) => arrSum(l.data)));
    const totCarb = carburantePeriodoTotale;

    let netto = totLordo;
    if (!excludeSpeseFisse) netto -= totSpeseFisse;
    if (!excludeCollaboratori) netto -= totCollab;
    if (!excludeSpeseExtra) netto -= totSpeseExtra;
    if (!excludeFornitori) netto -= totFornitoriDaily;
    if (!excludeInvenduto) netto -= totInvenduto;
    if (!excludeCarburante) netto -= totCarb;
    // Round 62: RIMOSSO `netto -= totCostoMerceProp;` — sostituito da
    // fornitoriScadenze.totSelezionato che usa la collezione spesePeriodiche.
    // Spese Ripartite (CUSTOM/WEEKLY/MONTHLY) — flag per-voce.
    netto -= fornitoriScadenze.totSelezionato;
    return netto;
  }, [
    totLordo, speseFisseItems, collabLines, filteredData, vociExtraPeriod, invendutoLines, carburantePeriodoTotale,
    excludeSpeseFisse, excludeCollaboratori, excludeSpeseExtra, excludeFornitori, excludeInvenduto, excludeCarburante,
    fornitoriScadenze,
  ]);

  /* ── Giorni lavorati vs non lavorati (per grafico) ──
     IMPORTANTE: 'lavorati' conta SOLO le giornate con inPiazza !== false.
     Le giornate dove l'utente ha cliccato il pulsante 'casa' (icona rossa
     = NON sono andato a lavoro) sono escluse dal conteggio dei giorni
     lavorati e contate come non-lavorati. */
  const giorniLavoroData = useMemo(() => {
    const allDates = store.storicoGiornate.map(g => new Date(g.data).getTime());
    const firstDataDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : null;

    if (!firstDataDate) {
      return { lavorati: 0, nonLavorati: 0, totale: 0 };
    }

    // Quante giornate del filtro hanno inPiazza !== false (= sono andato a lavoro).
    // Per backward compat: i record senza il campo (precedenti al fix) sono
    // considerati lavorati di default.
    const lavoratiCount = filteredData.filter((g: any) => (g as any).inPiazza !== false).length;

    const oggi = new Date();
    oggi.setHours(23, 59, 59, 999);

    /* Round 67 — i confini del periodo usano dataRiferimento (navigabile),
       e il conteggio dei giorni si ferma alla FINE del periodo mostrato
       (non a oggi) quando si naviga su periodi passati. */
    const ref = dataRiferimento;
    const endOf = (periodEnd: Date) => (periodEnd < oggi ? periodEnd : oggi);

    if (filtroTempo === 'Sett.') {
      const weekStart = new Date(ref);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
      const startDate = firstDataDate > weekStart ? firstDataDate : weekStart;
      const daysPassed = Math.max(0, Math.floor((endOf(weekEnd).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return { lavorati: lavoratiCount, nonLavorati: Math.max(0, daysPassed - lavoratiCount), totale: daysPassed };
    } else if (filtroTempo === 'Mese') {
      const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); monthEnd.setHours(23,59,59,999);
      const startDate = firstDataDate > monthStart ? firstDataDate : monthStart;
      const daysPassed = Math.max(0, Math.floor((endOf(monthEnd).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return { lavorati: lavoratiCount, nonLavorati: Math.max(0, daysPassed - lavoratiCount), totale: daysPassed };
    } else {
      // Anno o Personalizzato: dal primo dato inserito
      const yearStart = new Date(ref.getFullYear(), 0, 1);
      const yearEnd = new Date(ref.getFullYear(), 11, 31); yearEnd.setHours(23,59,59,999);
      const startDate = firstDataDate > yearStart ? firstDataDate : yearStart;
      const daysPassed = Math.max(0, Math.floor((endOf(yearEnd).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return { lavorati: lavoratiCount, nonLavorati: Math.max(0, daysPassed - lavoratiCount), totale: daysPassed };
    }
  }, [filteredData, filtroTempo, store.storicoGiornate, dataRiferimento]);

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
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: it.color, marginRight: 7 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A4040', flex: 1 }} numberOfLines={1}>
                      {it.label}
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '900', color: it.color }}>
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
        {/* ═══ BARRA PERIODO INTERATTIVA — frecce + tap-to-pick (Round 52) ═══
            Mostra range del periodo selezionato. Per Sett./Mese/Anno l'utente
            può navigare avanti/indietro con le frecce o tappare il box centrale
            per aprire un MiniMonthCalendar (Sett.) / MonthYearPicker (Mese/Anno). */}
        {(() => {
          const MESI_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
          const fmtFull = (d: Date) => `${d.getDate()} ${MESI_IT[d.getMonth()]} ${d.getFullYear()}`;
          const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
          const today = new Date();
          let periodLabel = '';
          // Round 52: navigabili = Sett./Mese/Anno (no Oggi/Ieri/Pers.)
          const isNavigable = filtroTempo === 'Sett.' || filtroTempo === 'Mese' || filtroTempo === 'Anno';

          if (filtroTempo === 'Oggi') {
            periodLabel = fmtFull(today);
          } else if (filtroTempo === 'Ieri') {
            const y = new Date(today); y.setDate(y.getDate() - 1);
            periodLabel = fmtFull(y);
          } else if (filtroTempo === 'Sett.') {
            const dow = (dataRiferimento.getDay() + 6) % 7;
            const lun = new Date(dataRiferimento); lun.setDate(dataRiferimento.getDate() - dow);
            const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
            periodLabel = `${fmtShort(lun)} → ${fmtShort(dom)}`;
          } else if (filtroTempo === 'Mese') {
            periodLabel = `${MESI_IT[dataRiferimento.getMonth()].toUpperCase()} ${dataRiferimento.getFullYear()}`;
          } else if (filtroTempo === 'Anno') {
            periodLabel = String(dataRiferimento.getFullYear());
          } else if (filtroTempo === 'Pers.') {
            if (persDateFrom && persDateTo) {
              periodLabel = `${fmtShort(persDateFrom)} → ${fmtShort(persDateTo)}`;
            } else {
              periodLabel = 'Seleziona un range personalizzato';
            }
          }

          // Funzione di shift per i 3 filtri navigabili
          const shiftPeriod = (delta: number) => {
            const newDate = new Date(dataRiferimento);
            if (filtroTempo === 'Sett.') newDate.setDate(newDate.getDate() + 7 * delta);
            else if (filtroTempo === 'Mese') newDate.setMonth(newDate.getMonth() + delta);
            else if (filtroTempo === 'Anno') newDate.setFullYear(newDate.getFullYear() + delta);
            setDataRiferimento(newDate);
          };

          if (!isNavigable) {
            // Oggi/Ieri/Pers.: solo info (non navigabile)
            return (
              <View style={st.periodBar}>
                <Ionicons name="calendar" size={14} color="#1E7F85" style={{ marginRight: 6 }} />
                <Text style={st.periodTxt} numberOfLines={1}>{periodLabel}</Text>
              </View>
            );
          }

          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 6 }}>
              <TouchableOpacity
                onPress={() => shiftPeriod(-1)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={18} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPeriodPicker(true)}
                activeOpacity={0.7}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 12, paddingVertical: 9,
                  backgroundColor: '#FFF', borderRadius: 12, gap: 6,
                  borderWidth: 1.5, borderColor: '#1E7F85',
                }}
              >
                <Ionicons name="calendar" size={14} color="#1E7F85" />
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#1A4040' }} numberOfLines={1}>
                  {periodLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftPeriod(+1)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          );
        })()}
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
              <Text style={[st.kpiValue, { color: '#1A4040', fontSize: 24 }]}>{'\u20AC'}{totLordo.toFixed(0)}</Text>
            </View>
            <TouchableOpacity style={st.kpiCard} onPress={() => setShowNettoModal(true)} activeOpacity={0.7}>
              <Text style={st.kpiLabel}>{t('stats.net').toUpperCase()} ▼</Text>
              <Text style={[st.kpiValue, { color: totNetto >= 0 ? '#1A4040' : '#D46A6A', fontSize: 24 }]}>{'\u20AC'}{totNetto.toFixed(0)}</Text>
            </TouchableOpacity>
          </View>
          <View style={st.kpiRow}>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('home.cash')}</Text>
              <Text style={[st.kpiValue, { color: '#1A4040', fontSize: 24 }]}>{'\u20AC'}{totCash.toFixed(0)}</Text>
            </View>
            <View style={st.kpiCard}>
              <Text style={st.kpiLabel}>{t('home.pos')}</Text>
              <Text style={[st.kpiValue, { color: '#1A4040', fontSize: 24 }]}>{'\u20AC'}{totPos.toFixed(0)}</Text>
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

        {/* ═══ Round 72 — TOTALE FATTURE nel periodo (immutabile) ═══ */}
        {fatturePeriodoStats.count > 0 && (
          <View style={[st.card, { marginBottom: GAP, borderLeftWidth: 4, borderLeftColor: '#E89B4A' }]}>
            <TouchableOpacity onPress={() => setShowFattureLog(!showFattureLog)} activeOpacity={0.7}>
              <View style={st.chartHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="document-text" size={16} color="#E89B4A" />
                  <Text style={st.sectionLabel}>FATTURE</Text>
                  <View style={{ backgroundColor: '#FBEEDB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#A56A1F' }}>{fatturePeriodoStats.count}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[st.sectionTotal, { color: '#E89B4A' }]}>TOT: €{fatturePeriodoStats.totale.toFixed(0)}</Text>
                  <Ionicons name={showFattureLog ? 'chevron-up' : 'chevron-down'} size={18} color="#E89B4A" />
                </View>
              </View>
            </TouchableOpacity>
            {showFattureLog && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {Object.entries(fatturePeriodoStats.perFornitore).sort((a: any, b: any) => b[1].totale - a[1].totale).map(([nome, info]: any) => (
                  <View key={nome} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FDFAF3', borderRadius: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A4040' }}>{nome}</Text>
                      <Text style={{ fontSize: 10, color: '#7A8585', fontWeight: '600' }}>{info.count} {info.count === 1 ? 'fattura' : 'fatture'}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#A56A1F' }}>€{info.totale.toFixed(0)}</Text>
                  </View>
                ))}
                <Text style={{ fontSize: 10, color: '#9AAAAA', fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
                  💡 Conteggio sempre aggiornato — ogni fattura inserita è permanente.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── FORNITORI: card unico con tutti i dati (Fatturata/Contanti, ripartizione, andamento, voci settimanali/mensili) ─── */}
        <View style={[st.card, { marginBottom: GAP }]}>
          <TouchableOpacity onPress={() => setShowFornitori(!showFornitori)} activeOpacity={0.7}>
            <View style={st.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="storefront" size={16} color="#1E7F85" />
                <Text style={st.sectionLabel}>{t('stats.suppliers') || 'FORNITORI'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.sectionTotal}>TOT: €{fornitoriTotals.totale.toFixed(0)}</Text>
                <Ionicons name={showFornitori ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
              </View>
            </View>
          </TouchableOpacity>
          {showFornitori && (
            <View style={{ marginTop: 12 }}>

              {/* ═══ RIEPILOGO RAPIDO: 3 BADGE GIORN/SETT/MENS ═══ */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: '#F4F8F5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E0E8E2' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#5A7575', letterSpacing: 0.5 }}>GIORNALIERA</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', marginTop: 2 }}>€{vociExtraPeriod.totDailyDeducted.toFixed(0)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F4F8F5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E0E8E2' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#5A7575', letterSpacing: 0.5 }}>SETTIMANALE</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', marginTop: 2 }}>€{vociExtraPeriod.totWeekly.toFixed(0)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F4F8F5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E0E8E2' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#5A7575', letterSpacing: 0.5 }}>MENSILE</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', marginTop: 2 }}>€{vociExtraPeriod.totMonthly.toFixed(0)}</Text>
                </View>
              </View>

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
                    <Text style={{ marginLeft: 'auto', fontSize: 14, fontWeight: '900', color: '#1A4040' }}>€{fornitoriTotals.fatturata.toFixed(0)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8A060', marginRight: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A4040' }}>Contanti</Text>
                    <Text style={{ marginLeft: 'auto', fontSize: 14, fontWeight: '900', color: '#1A4040' }}>€{fornitoriTotals.libera.toFixed(0)}</Text>
                  </View>
                  {fornitoriTotals.totale > 0 && (
                    <Text style={{ fontSize: 10, color: '#7A9090', fontWeight: '700', marginTop: 4 }}>
                      Fatturata: {Math.round((fornitoriTotals.fatturata / fornitoriTotals.totale) * 100)}% | Contanti: {Math.round((fornitoriTotals.libera / fornitoriTotals.totale) * 100)}%
                    </Text>
                  )}
                </View>
              </View>

              {/* ═══ AREOGRAMMA PER FORNITORE — quota di ognuno sul totale ═══ */}
              {fornitoriTotals.perFornitore.length > 0 && fornitoriTotals.totale > 0 && (
                <View style={{ marginBottom: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 1, marginBottom: 8 }}>
                    RIPARTIZIONE PER FORNITORE
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
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040', flex: 1 }} numberOfLines={1}>{f.nome}</Text>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#1A4040' }}>{pct}%</Text>
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

                // ═══ CALCOLO SETTIMANALE: divide il mese in 4 settimane (1-7, 8-14, 15-21, 22-fine)
                // Per ogni settimana somma Fatturata + Libera di questo fornitore.
                const weeklyData = (() => {
                  const w = [0, 0, 0, 0];
                  filteredData.forEach((g: any) => {
                    const d = new Date(g.data);
                    const day = d.getDate();
                    let idx = 0;
                    if (day >= 1 && day <= 7) idx = 0;
                    else if (day >= 8 && day <= 14) idx = 1;
                    else if (day >= 15 && day <= 21) idx = 2;
                    else idx = 3;
                    const fatt = g.dettaglio_fornitori?.[f.nome] || 0;
                    const libera = g.dettaglio_fornitori?.[`${f.nome}__libera`] || 0;
                    w[idx] += fatt + libera;
                  });
                  return w;
                })();
                const weeklyMax = Math.max(...weeklyData, 1);

                return (
                  <View key={i} style={{ borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                    <TouchableOpacity onPress={() => setExpandedFornitore(isExp ? null : f.nome)} activeOpacity={0.7}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name="cube-outline" size={14} color="#7A9090" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A4040', flex: 1, marginLeft: 6 }}>{f.nome}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#1A4040', marginRight: 10 }}>€{totF.toFixed(0)}</Text>
                        <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color="#5A7575" />
                      </View>
                    </TouchableOpacity>
                    {isExp && totF > 0 && (
                      <View style={{ marginBottom: 10 }}>
                        {/* Riga Pie Fatturata/Contanti + leggenda */}
                        <View style={{ backgroundColor: '#F4FAF7', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <PieChart items={[
                            { label: 'Fatturata', value: f.fatturata, color: '#1E7F85' },
                            { label: 'Contanti', value: f.libera, color: '#E8A060' },
                          ]} size={100} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#1A4040', marginBottom: 6 }}>{f.nome}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E7F85', marginRight: 6 }} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040', flex: 1 }}>Fatturata</Text>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1A4040' }}>€{f.fatturata.toFixed(0)} ({Math.round((f.fatturata / totF) * 100)}%)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8A060', marginRight: 6 }} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040', flex: 1 }}>Contanti</Text>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1A4040' }}>€{f.libera.toFixed(0)} ({Math.round((f.libera / totF) * 100)}%)</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: '#5A7575', fontWeight: '700', marginTop: 4 }}>TOT: €{totF.toFixed(0)}</Text>
                          </View>
                        </View>

                        {/* ═══ GRAFICO SETTIMANALE — stile Home (neomorfico) ═══ */}
                        <View style={{
                          backgroundColor: '#F5EFDC',
                          borderRadius: 16,
                          padding: 14,
                          shadowColor: '#000',
                          shadowOffset: { width: 2, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
                          elevation: 2,
                        }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#5A7575', letterSpacing: 1.2 }}>
                              ANDAMENTO SETTIMANALE
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: '#1E7F85' }}>
                              €{totF.toFixed(0)}
                            </Text>
                          </View>

                          {/* 4 barre settimanali */}
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120, paddingHorizontal: 4 }}>
                            {weeklyData.map((val, idx) => {
                              const h = val > 0 ? Math.max(6, (val / weeklyMax) * 100) : 4;
                              const color = val > 0 ? '#1E7F85' : '#D8E4E0';
                              return (
                                <View key={idx} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 3 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#1A4040', marginBottom: 4 }}>
                                    €{val.toFixed(0)}
                                  </Text>
                                  <View
                                    style={{
                                      width: '100%',
                                      height: h,
                                      backgroundColor: color,
                                      borderTopLeftRadius: 6,
                                      borderTopRightRadius: 6,
                                      // ombreggiatura neomorfica
                                      shadowColor: '#000',
                                      shadowOffset: { width: 1, height: 2 },
                                      shadowOpacity: 0.15,
                                      shadowRadius: 3,
                                      elevation: 2,
                                    }}
                                  />
                                </View>
                              );
                            })}
                          </View>

                          {/* Label giorni settimana */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6, paddingHorizontal: 4 }}>
                            {['S1', 'S2', 'S3', 'S4'].map((lab) => (
                              <View key={lab} style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 0.5 }}>{lab}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Dettaglio giorni periodo (solo se filtroTempo === 'mese') */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 2, paddingHorizontal: 4 }}>
                            {['1-7', '8-14', '15-21', '22+'].map((lab) => (
                              <View key={lab} style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 8.5, color: '#8A9595', fontStyle: 'italic' }}>{lab}</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        {/* ═══ COSTO MERCE GIORNALIERO PROPORZIONALE (Round 38) ═══
                            "Il costo della merce ripartita va messo giornalmente nelle
                             spese extra del fornitore di riferimento."
                            Mostriamo per ogni giornata del periodo selezionato
                            la quota ponderata di costo merce attribuita a
                            QUESTO fornitore (algoritmo proporzionale al lordo
                            giornaliero). Σ = importo fattura del periodo. */}
                        {(() => {
                          const dailyMap = costoMerceProporzionalePerFornMap[f.nome] || {};
                          // Solo i giorni del periodo filtrato
                          const rows: { day: string; importo: number; lordo: number; iso: string }[] = [];
                          filteredData
                            .slice()
                            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                            .forEach((g) => {
                              try {
                                const iso = new Date(g.data).toISOString().slice(0, 10);
                                const imp = dailyMap[iso] || 0;
                                if (imp <= 0.5) return;
                                const d = new Date(g.data);
                                rows.push({
                                  iso,
                                  day: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
                                  importo: imp,
                                  lordo: g.lordo || 0,
                                });
                              } catch {}
                            });
                          if (rows.length === 0) return null;
                          const totRipartito = rows.reduce((s, r) => s + r.importo, 0);
                          const maxImp = Math.max(...rows.map((r) => r.importo), 1);
                          return (
                            <View style={{
                              marginTop: 10,
                              backgroundColor: '#FFF7E8',
                              borderRadius: 14,
                              padding: 12,
                              borderLeftWidth: 3,
                              borderLeftColor: '#E8A060',
                            }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="trending-up" size={14} color="#B86A1F" />
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '900', color: '#8A6A1F', letterSpacing: 0.8 }}>
                                  COSTO MERCE GIORNALIERO RIPARTITO
                                </Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#B86A1F' }}>
                                  €{totRipartito.toFixed(0)}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 9, color: '#8A6A1F', fontStyle: 'italic', marginBottom: 8 }}>
                                Quota della fattura distribuita proporzionalmente al lordo di ciascun giorno
                                (detratta dall'utile).
                              </Text>
                              {/* Lista compatta: data — barra — importo */}
                              <View style={{ gap: 5 }}>
                                {rows.slice(0, 10).map((r) => {
                                  const pctW = Math.max(8, (r.importo / maxImp) * 100);
                                  return (
                                    <View key={r.iso} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <Text style={{ width: 38, fontSize: 9.5, fontWeight: '800', color: '#5A4A2A' }}>{r.day}</Text>
                                      <View style={{ flex: 1, height: 10, backgroundColor: '#F5E8C8', borderRadius: 5, overflow: 'hidden' }}>
                                        <View style={{ width: `${pctW}%`, height: '100%', backgroundColor: '#E8A060', borderRadius: 5 }} />
                                      </View>
                                      <Text style={{ width: 50, textAlign: 'right', fontSize: 10, fontWeight: '900', color: '#B86A1F' }}>
                                        €{r.importo.toFixed(2)}
                                      </Text>
                                    </View>
                                  );
                                })}
                                {rows.length > 10 && (
                                  <Text style={{ fontSize: 9, color: '#8A6A1F', fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
                                    +{rows.length - 10} giornate non mostrate
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                );
              })}
              {fornitoriTotals.perFornitore.length === 0 && (
                <Text style={{ fontSize: 11, color: '#7A9090', textAlign: 'center', paddingVertical: 10 }}>Nessun dato fornitori nel periodo</Text>
              )}

              {/* ═══ ANDAMENTO NEL TEMPO (era FORNITORI 2) ═══ */}
              {fornitoriLines.length > 0 && fornitoriLines.some(l => l.data.some(v => v > 0)) && (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 1 }}>
                      ANDAMENTO NEL TEMPO
                    </Text>
                    {activeFornIdx !== null && (
                      <TouchableOpacity onPress={() => setActiveFornIdx(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 10, color: '#1E7F85', fontWeight: '800' }}>MOSTRA TUTTI</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Legenda CLICCABILE: tap su un fornitore → isola la sua linea, gli altri spariscono.
                      Nuovo tap su stesso fornitore o su "MOSTRA TUTTI" → torna a vista completa. */}
                  <View style={st.legendRow}>
                    {fornitoriLines.map((l, i) => {
                      const isActive = activeFornIdx === i;
                      const isDimmed = activeFornIdx !== null && activeFornIdx !== i;
                      return (
                        <TouchableOpacity
                          key={i}
                          activeOpacity={0.7}
                          onPress={() => setActiveFornIdx(isActive ? null : i)}
                          style={[
                            st.legendItem,
                            {
                              backgroundColor: isActive ? l.color + '20' : 'transparent',
                              borderRadius: 8,
                              paddingHorizontal: 6,
                              paddingVertical: 4,
                              opacity: isDimmed ? 0.35 : 1,
                            },
                          ]}
                        >
                          <View style={[st.legendDot, { backgroundColor: l.color }]} />
                          <Text style={[st.legendText, { color: l.color, fontWeight: isActive ? '900' : '700' }]}>
                            {l.label}: €{arrSum(l.data).toFixed(0)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 8 }}>
                    <InteractiveLineChart
                      labels={chartLabels}
                      lines={fornitoriLines}
                      activeLineIndex={activeFornIdx}
                      onPointPress={() => {}}
                    />
                  </View>
                </View>
              )}

              {/* ═══ VOCI SETTIMANALI / MENSILI accantonate ═══ */}
              {(vociExtraPeriod.totWeekly > 0 || vociExtraPeriod.totMonthly > 0) && (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#E8EDE8' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 1, marginBottom: 4 }}>
                    VOCI ACCANTONATE
                  </Text>
                  <Text style={{ fontSize: 10, color: '#7A9090', fontStyle: 'italic', marginBottom: 8 }}>
                    Fatture/spese NON detratte giornalmente, scalate solo dal periodo.
                  </Text>
                  {vociExtraPeriod.totWeekly > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#5A7575', letterSpacing: 0.5 }}>SETTIMANALI</Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#1A4040' }}>€{vociExtraPeriod.totWeekly.toFixed(0)}</Text>
                      </View>
                      {vociExtraPeriod.items.filter(i => i.type === 'WEEKLY').map((it, i) => (
                        <View key={`w-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#EEE8DA' }}>
                          <Text style={{ fontSize: 10, color: '#7A8585', fontWeight: '700', width: 56 }}>
                            {it.data.getDate()}/{(it.data.getMonth() + 1).toString().padStart(2, '0')}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '700', flex: 1 }}>{it.nome}</Text>
                          <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '900' }}>€{it.importo.toFixed(0)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {vociExtraPeriod.totMonthly > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#5A7575', letterSpacing: 0.5 }}>MENSILI</Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#1A4040' }}>€{vociExtraPeriod.totMonthly.toFixed(0)}</Text>
                      </View>
                      {vociExtraPeriod.items.filter(i => i.type === 'MONTHLY').map((it, i) => (
                        <View key={`m-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#EEE8DA' }}>
                          <Text style={{ fontSize: 10, color: '#7A8585', fontWeight: '700', width: 56 }}>
                            {it.data.getDate()}/{(it.data.getMonth() + 1).toString().padStart(2, '0')}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '700', flex: 1 }}>{it.nome}</Text>
                          <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '900' }}>€{it.importo.toFixed(0)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* ═══ TOTALE FINALE ═══ */}
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F5EFDC', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#1E7F85' }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#5A7575', letterSpacing: 0.6, marginBottom: 4 }}>TOTALE FORNITORI PERIODO</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A3535' }}>
                  €{(vociExtraPeriod.totDailyDeducted + vociExtraPeriod.totWeekly + vociExtraPeriod.totMonthly).toFixed(0)}
                </Text>
              </View>
            </View>
          )}
        </View>

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
          onPress={() => {
            // Apre il picker del mese per il Report Mensile PDF
            setPdfMonth(new Date().getMonth());
            setPdfYear(new Date().getFullYear());
            setShowPdfPicker(true);
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#D4AF37', '#B8860B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.pdfBtn}
          >
            <Ionicons name="document-text" size={18} color="#FFF" />
            <Text style={st.pdfBtnTxt}>{t('stats.monthlyReport') || 'REPORT MENSILE'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      <MeteoStatsModal
        visible={showMeteo}
        onClose={() => setShowMeteo(false)}
        giornate={storicoGiornate}
      />

      {/* ═══ PICKER MESE per REPORT PDF ═══ */}
      <Modal visible={showPdfPicker} transparent animationType="fade" onRequestClose={() => setShowPdfPicker(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setShowPdfPicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#F5F0E6', borderRadius: 22, padding: 22, width: '88%', maxWidth: 380 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 4, letterSpacing: 1 }}>
              {t('stats.monthlyReport') || 'REPORT MENSILE'}
            </Text>
            <Text style={{ fontSize: 12, color: '#7A9090', textAlign: 'center', marginBottom: 16 }}>
              {t('stats.pickMonthYear') || 'Seleziona mese e anno'}
            </Text>

            {/* Selettore Anno */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => setPdfYear((y) => y - 1)} style={{ padding: 10, backgroundColor: '#FFF', borderRadius: 14, width: 44, alignItems: 'center' }}>
                <Ionicons name="chevron-back" size={22} color="#1E7F85" />
              </TouchableOpacity>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A4040', minWidth: 80, textAlign: 'center' }}>{pdfYear}</Text>
              <TouchableOpacity onPress={() => setPdfYear((y) => y + 1)} style={{ padding: 10, backgroundColor: '#FFF', borderRadius: 14, width: 44, alignItems: 'center' }}>
                <Ionicons name="chevron-forward" size={22} color="#1E7F85" />
              </TouchableOpacity>
            </View>

            {/* Griglia Mesi 3x4 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
              {getMonthNames().map((name, idx) => {
                const active = idx === pdfMonth;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setPdfMonth(idx)}
                    activeOpacity={0.7}
                    style={{
                      width: '30%',
                      paddingVertical: 12,
                      backgroundColor: active ? '#1E7F85' : '#FFF',
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '900',
                      color: active ? '#FFF' : '#1A4040',
                      letterSpacing: 0.6,
                    }}>{name.substring(0, 3).toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Azioni */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowPdfPicker(false)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: '#E8E8E0', borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#7A9090', letterSpacing: 1 }}>
                  {t('common.cancel') || 'ANNULLA'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowPdfPicker(false);
                  await new Promise((r) => setTimeout(r, 300));
                  generatePDF();
                }}
                style={{ flex: 1.4, paddingVertical: 14, backgroundColor: '#1E7F85', borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="document-text" size={16} color="#FFF" />
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>
                  {t('stats.generatePdf') || 'GENERA PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

      {/* ═══ ROUND 52: PICKER PERIODO per Sett./Mese/Anno ═══
          - Sett.: MiniMonthCalendar — tap su qualsiasi giorno → settimana Lun→Dom
          - Mese: grid di 12 mesi cliccabili + navigatori anno ← →
          - Anno: lista di anni navigabile */}
      <Modal visible={showPeriodPicker} transparent animationType="fade" onRequestClose={() => setShowPeriodPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPeriodPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#F5F0E6', borderRadius: 20, padding: 18, width: '88%', maxWidth: 380 }} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 14 }}>
              {filtroTempo === 'Sett.' && '📅 Scegli la settimana'}
              {filtroTempo === 'Mese' && '📅 Scegli il mese'}
              {filtroTempo === 'Anno' && '📅 Scegli l\'anno'}
            </Text>

            {filtroTempo === 'Sett.' && (() => {
              // Pre-calcola i 7 ISO della settimana corrente per evidenziarli
              const dow = (dataRiferimento.getDay() + 6) % 7;
              const lun = new Date(dataRiferimento); lun.setDate(dataRiferimento.getDate() - dow);
              const settIso: string[] = [];
              for (let i = 0; i < 7; i++) {
                const d = new Date(lun); d.setDate(lun.getDate() + i);
                settIso.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
              }
              return (
                <View>
                  <Text style={{ fontSize: 11, color: '#7A9090', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' }}>
                    Tocca un giorno qualsiasi: useremo la settimana Lun→Dom corrispondente
                  </Text>
                  <MiniMonthCalendar
                    selectedDates={[]}
                    onToggleDate={(iso) => {
                      const d = new Date(iso + 'T00:00:00');
                      setDataRiferimento(d);
                      setShowPeriodPicker(false);
                    }}
                    highlightedDates={settIso}
                    themeColor="#1E7F85"
                  />
                </View>
              );
            })()}

            {filtroTempo === 'Mese' && (() => {
              const MESI_BREVI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              const year = dataRiferimento.getFullYear();
              const curMonth = dataRiferimento.getMonth();
              return (
                <View>
                  {/* Navigatore anno */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => { const d = new Date(dataRiferimento); d.setFullYear(year - 1); setDataRiferimento(d); }}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="chevron-back" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#1A4040', minWidth: 80, textAlign: 'center' }}>{year}</Text>
                    <TouchableOpacity
                      onPress={() => { const d = new Date(dataRiferimento); d.setFullYear(year + 1); setDataRiferimento(d); }}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="chevron-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  {/* Grid 4x3 mesi */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {MESI_BREVI.map((m, i) => {
                      const sel = i === curMonth;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => {
                            const d = new Date(dataRiferimento); d.setMonth(i);
                            setDataRiferimento(d);
                            setShowPeriodPicker(false);
                          }}
                          style={{
                            width: '23%', paddingVertical: 12, borderRadius: 10,
                            backgroundColor: sel ? '#1E7F85' : '#FFF',
                            borderWidth: 1.5, borderColor: sel ? '#1E7F85' : '#E0D8C0',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '900', color: sel ? '#FFF' : '#1A4040' }}>{m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {filtroTempo === 'Anno' && (() => {
              const curYear = dataRiferimento.getFullYear();
              const thisYear = new Date().getFullYear();
              // Lista anni da -10 a +1 rispetto a quest'anno
              const years: number[] = [];
              for (let y = thisYear + 1; y >= thisYear - 10; y--) years.push(y);
              return (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {years.map((y) => {
                    const sel = y === curYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        onPress={() => {
                          const d = new Date(dataRiferimento); d.setFullYear(y);
                          setDataRiferimento(d);
                          setShowPeriodPicker(false);
                        }}
                        style={{
                          paddingVertical: 14, marginBottom: 6, borderRadius: 10,
                          backgroundColor: sel ? '#1E7F85' : '#FFF',
                          borderWidth: 1.5, borderColor: sel ? '#1E7F85' : '#E0D8C0',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 18, fontWeight: '900', color: sel ? '#FFF' : '#1A4040' }}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })()}

            <TouchableOpacity
              onPress={() => setShowPeriodPicker(false)}
              style={{ marginTop: 14, backgroundColor: '#1A4040', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>CHIUDI</Text>
            </TouchableOpacity>
          </TouchableOpacity>
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

      {/* ═══ MODAL NETTO - Selezione voci da escludere ═══
          Round 57 FIX: il nesting Pressable → Pressable (con
          stopPropagation) → TouchableOpacity faceva sì che il responder
          touch venisse "rubato" dal Pressable intermedio: il
          TouchableOpacity interno NON riceveva mai l'onPress, e quindi
          checkbox + netto NON si aggiornavano.
          Pattern fix: backdrop TouchableOpacity assoluto + contenuto in
          View normale → i TouchableOpacity figli ricevono correttamente
          il press. */}
      <Modal
        visible={showNettoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNettoModal(false)}
      >
        <View style={st.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowNettoModal(false)}
          />
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>CALCOLO NETTO</Text>
              <TouchableOpacity onPress={() => setShowNettoModal(false)}>
                <Ionicons name="close" size={24} color="#5A7575" />
              </TouchableOpacity>
            </View>
            <Text style={st.modalSubtitle}>Tocca per escludere una voce dal calcolo del netto</Text>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* ═══ Round 60 — STILE CONSISTENTE CON UTILEMODAL ═══
                  Switch iOS + label + valore. Default: tutte le voci sono
                  INCLUSE nel netto (excluded=false). L'utente fa swipe ON
                  per escludere la voce → il netto aumenta. */}
              {(() => {
                const NettoRow = (props: {
                  label: string;
                  value: number;
                  excluded: boolean;
                  onToggle: () => void;
                  icon: keyof typeof Ionicons.glyphMap;
                  iconColor: string;
                  hint?: string;
                }) => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={props.onToggle}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 11, paddingHorizontal: 10,
                      borderBottomWidth: 1, borderBottomColor: '#EDE7D4',
                    }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: props.iconColor + '22',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={props.icon} size={18} color={props.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 13, fontWeight: '800',
                        color: props.excluded ? '#9A9A8A' : '#1A4040',
                        textDecorationLine: props.excluded ? 'line-through' : 'none',
                      }}>{props.label}</Text>
                      {!!props.hint && (
                        <Text style={{ fontSize: 10, color: '#7A9090', marginTop: 2, fontStyle: 'italic' }}>
                          {props.hint}
                        </Text>
                      )}
                    </View>
                    <Text style={{
                      fontSize: 14, fontWeight: '900',
                      color: props.excluded ? '#B0B0A0' : '#1E7F85',
                      marginRight: 6,
                    }}>
                      €{props.value.toFixed(0)}
                    </Text>
                    <Switch
                      value={!props.excluded}
                      onValueChange={props.onToggle}
                      trackColor={{ false: '#D8D2C0', true: '#1E7F85' }}
                      thumbColor="#FFF"
                      ios_backgroundColor="#D8D2C0"
                    />
                  </TouchableOpacity>
                );

                const speseFisseSum = arrSum(speseFisseItems.map(i => i.value));
                const collabSum = arrSum(collabLines.map(l => arrSum(l.data)));
                const speseExtraSum = arrSum(filteredData.map(g => g.spese_extra || 0));
                const invendutoSum = arrSum(invendutoLines.map(l => arrSum(l.data)));

                return (
                  <>
                    <NettoRow
                      label="SPESE FISSE" value={speseFisseSum}
                      excluded={excludeSpeseFisse} onToggle={() => setExcludeSpeseFisse(!excludeSpeseFisse)}
                      icon="home-outline" iconColor="#8B6914"
                    />
                    <NettoRow
                      label="COLLABORATORI" value={collabSum}
                      excluded={excludeCollaboratori} onToggle={() => setExcludeCollaboratori(!excludeCollaboratori)}
                      icon="people-outline" iconColor="#1E7F85"
                    />
                    <NettoRow
                      label="SPESE EXTRA" value={speseExtraSum}
                      excluded={excludeSpeseExtra} onToggle={() => setExcludeSpeseExtra(!excludeSpeseExtra)}
                      icon="receipt-outline" iconColor="#D46A6A"
                    />
                    {/* Round 60+62+63: label allineata a UtileModal "FORNITORI GIORN." */}
                    <NettoRow
                      label="FORNITORI GIORN." value={vociExtraPeriod.totDailyDeducted}
                      excluded={excludeFornitori} onToggle={() => setExcludeFornitori(!excludeFornitori)}
                      icon="storefront-outline" iconColor="#1A4040"
                    />

                    {/* ═══ Round 66 — FORN. SPESA RIPART. (collassabile) ═══
                        Mostra SOLO le ripartite categoria='fornitore' del periodo.
                        Click sulla riga → toggle del dropdown con i singoli items.
                        I checkbox dei singoli items rispettano excludeFornitoreScad. */}
                    {(() => {
                      const fornItems = fornitoriScadenze.items.filter((it) => it.categoria === 'fornitore');
                      if (fornItems.length === 0) return null;
                      const totFornRip = fornItems.reduce((s, it) => {
                        const ex = excludeFornitoreScad[it.key];
                        const isEx = ex !== undefined ? ex : !it.inPeriod;
                        return s + (isEx ? 0 : it.importo);
                      }, 0);
                      const fmt = (iso: string) => {
                        if (!iso) return '—';
                        const [, m, d] = iso.split('-');
                        return `${d}/${m}`;
                      };
                      return (
                        <View>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowFornRipart((p) => !p)}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 12, paddingHorizontal: 12,
                              backgroundColor: '#F5F1E8', borderRadius: 12,
                              marginVertical: 4,
                              borderLeftWidth: 3, borderLeftColor: '#1E7F85',
                            }}
                          >
                            <Ionicons name="layers-outline" size={18} color="#1E7F85" />
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A3535', marginLeft: 10, flex: 1 }}>
                              FORN. SPESA RIPART.
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#1A3535', marginRight: 8 }}>
                              €{Math.round(totFornRip)}
                            </Text>
                            <Ionicons name={showFornRipart ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
                          </TouchableOpacity>
                          {showFornRipart && (
                            <View style={{ marginLeft: 12 }}>
                              {fornItems.map((it) => {
                                const userExcluded = excludeFornitoreScad[it.key];
                                const isExcluded = userExcluded !== undefined ? userExcluded : !it.inPeriod;
                                return (
                                  <NettoRow
                                    key={it.key}
                                    label={it.nome}
                                    value={Math.round(it.importo)}
                                    excluded={isExcluded}
                                    onToggle={() => setExcludeFornitoreScad({
                                      ...excludeFornitoreScad,
                                      [it.key]: !isExcluded,
                                    })}
                                    icon="calendar-outline"
                                    iconColor={it.type === 'WEEKLY' ? '#1E7F85' : '#8B6914'}
                                    hint={`📅 Comprata il ${fmt(it.dataAcquisto)} — scalata il ${fmt(it.dataStorno)}${!it.inPeriod ? ' (fuori periodo)' : ''}`}
                                  />
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <NettoRow
                      label="INVENDUTO" value={invendutoSum}
                      excluded={excludeInvenduto} onToggle={() => setExcludeInvenduto(!excludeInvenduto)}
                      icon="cube-outline" iconColor="#8B5CF6"
                    />
                    <NettoRow
                      label="GESTIONE CARBURANTE" value={Math.round(carburantePeriodoTotale)}
                      excluded={excludeCarburante} onToggle={() => setExcludeCarburante(!excludeCarburante)}
                      icon="car-outline" iconColor="#5A7575"
                    />

                    {/* ═══ Round 60+61+66 — SPESE RIPARTITE (solo voci, non fornitori) ═══
                        Le ripartite di tipo `categoria='fornitore'` sono già nel
                        dropdown "FORN. SPESA RIPART." sopra. Qui mostriamo solo
                        le voci generiche (es. "Dolci Palermo", "Caffè bar"). */}
                    {(() => {
                      const vociItems = fornitoriScadenze.items.filter((it) => it.categoria !== 'fornitore');
                      if (vociItems.length === 0) return null;
                      const totPromemoriaVoci = vociItems.filter((it) => !it.inPeriod).reduce((s, it) => s + it.importo, 0);
                      return (
                        <>
                          <View style={{ marginTop: 14, marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#7A9090', letterSpacing: 0.6 }}>
                              SPESE RIPARTITE
                            </Text>
                          </View>
                          {totPromemoriaVoci > 0 && (
                            <View style={{
                              backgroundColor: '#FFF8E6', borderRadius: 10,
                              borderLeftWidth: 3, borderLeftColor: '#D4AF37',
                              padding: 10, marginBottom: 8,
                            }}>
                              <Text style={{ fontSize: 11, color: '#5A4A1F', lineHeight: 16 }}>
                                ⚠️ È presente una spesa di <Text style={{ fontWeight: '900' }}>€{Math.round(totPromemoriaVoci)}</Text> che verrà decurtata dall'incasso del periodo stabilito (settimanale o altro), non rimossa dall'incasso giornaliero.
                              </Text>
                            </View>
                          )}
                          {vociItems.map((it) => {
                            const userExcluded = excludeFornitoreScad[it.key];
                            const isExcluded = userExcluded !== undefined ? userExcluded : !it.inPeriod;
                            const fmt = (iso: string) => {
                              if (!iso) return '—';
                              const [, m, d] = iso.split('-');
                              return `${d}/${m}`;
                            };
                            return (
                              <NettoRow
                                key={it.key}
                                label={it.nome}
                                value={Math.round(it.importo)}
                                excluded={isExcluded}
                                onToggle={() => setExcludeFornitoreScad({
                                  ...excludeFornitoreScad,
                                  [it.key]: !isExcluded,
                                })}
                                icon="calendar-outline"
                                iconColor={it.type === 'WEEKLY' ? '#1E7F85' : '#8B6914'}
                                hint={`📅 Comprata il ${fmt(it.dataAcquisto)} — scalata il ${fmt(it.dataStorno)}${!it.inPeriod ? ' (fuori periodo)' : ''}`}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </>
                );
              })()}
            </ScrollView>
            
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E6' },
  stickyHeader: { paddingHorizontal: 20, paddingTop: 8, backgroundColor: '#F5F0E6', zIndex: 10, gap: 8 },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(155,145,125,0.35)',
  },
  periodTxt: { fontSize: 13, fontWeight: '900', color: '#1E7F85', letterSpacing: 0.5 },
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
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 8 },
  legendItemActive: { backgroundColor: 'rgba(30,127,133,0.1)', borderWidth: 1, borderColor: 'rgba(30,127,133,0.25)' },
  legendDot: { width: 11, height: 11, borderRadius: 6 },
  legendText: { fontSize: 11.5, fontWeight: '800' },

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
