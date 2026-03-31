import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: screenW } = Dimensions.get('window');

type MeteoView = 'Settimana' | 'Mese' | 'Anno';

interface Giornata {
  data: Date;
  meteo: string;
  lordo: number;
  [key: string]: any;
}

const METEO_CFG: Record<string, { icon: string; color: string; label: string }> = {
  SOLE: { icon: 'weather-sunny', color: '#F5A623', label: 'Sole' },
  VAR: { icon: 'weather-partly-cloudy', color: '#C4A035', label: 'Variabile' },
  PIOGGIA: { icon: 'weather-rainy', color: '#5A90C0', label: 'Pioggia' },
  TEMP: { icon: 'weather-lightning-rainy', color: '#7A60BB', label: 'Temporale' },
  VENTO: { icon: 'weather-windy', color: '#60B0A0', label: 'Vento' },
  NUVOLO: { icon: 'weather-cloudy', color: '#8899AA', label: 'Nuvolo' },
};

const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const DONUT_COLORS: Record<string, string> = {
  SOLE: '#E8A040',
  VAR: '#C4A035',
  PIOGGIA: '#5A90C0',
  TEMP: '#7A60BB',
  VENTO: '#60B0A0',
  NUVOLO: '#8899AA',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  giornate: Giornata[];
}

export const MeteoStatsModal: React.FC<Props> = ({ visible, onClose, giornate }) => {
  const [view, setView] = useState<MeteoView>('Settimana');
  const now = new Date();

  const weekData = useMemo(() => {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const result: { lordo: number; meteo: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const match = giornate.find(
        (g) => new Date(g.data).toDateString() === d.toDateString()
      );
      result.push({
        lordo: match?.lordo || 0,
        meteo: match?.meteo || 'SOLE',
        label: GIORNI_SHORT[i],
      });
    }
    return result;
  }, [giornate]);

  const weekAvg = useMemo(() => {
    const working = weekData.filter((d) => d.lordo > 0);
    return working.length > 0 ? working.reduce((s, d) => s + d.lordo, 0) / working.length : 0;
  }, [weekData]);

  const monthData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const grid: ({ day: number; meteo: string } | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const match = giornate.find(
        (g) => new Date(g.data).toDateString() === date.toDateString()
      );
      grid.push({ day: d, meteo: match?.meteo || (date.getDay() === 0 ? '' : 'SOLE') });
    }
    while (grid.length % 7 !== 0) grid.push(null);

    const pioggiaDays = giornate.filter((g) => {
      const d = new Date(g.data);
      return d.getMonth() === month && d.getFullYear() === year && (g.meteo === 'PIOGGIA' || g.meteo === 'TEMP');
    }).length;

    return { grid, pioggiaDays, monthName: MESI_FULL[month], year };
  }, [giornate]);

  const yearData = useMemo(() => {
    const year = now.getFullYear();
    const yearGiornate = giornate.filter((g) => new Date(g.data).getFullYear() === year);
    const counts: Record<string, number> = {};
    Object.keys(METEO_CFG).forEach((k) => (counts[k] = 0));
    yearGiornate.forEach((g) => {
      const m = g.meteo || 'SOLE';
      counts[m] = (counts[m] || 0) + 1;
    });
    const total = yearGiornate.length || 1;
    return { counts, total, year };
  }, [giornate]);

  const renderDonut = () => {
    const size = Math.min(screenW - 80, 200);
    const center = size / 2;
    const radius = size / 2 - 15;
    const strokeWidth = 28;

    const entries = Object.entries(yearData.counts).filter(([, v]) => v > 0);
    const total = yearData.total;
    let startAngle = -Math.PI / 2;

    const arcs = entries.map(([key, count]) => {
      const angle = (count / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      startAngle = endAngle;
      return (
        <Path key={key} d={path} stroke={DONUT_COLORS[key] || '#999'} strokeWidth={strokeWidth} fill="none" strokeLinecap="butt" />
      );
    });

    return (
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <View>
          <Svg width={size} height={size}>{arcs}</Svg>
          <View style={[ms.donutCenter, { width: size, height: size }]}>
            <Text style={ms.donutTotal}>TOTALE</Text>
            <Text style={ms.donutDays}>{yearData.total} GIORNI</Text>
          </View>
        </View>
        <View style={ms.legendGrid}>
          {entries.map(([key, count]) => {
            const pct = Math.round((count / total) * 100);
            const cfg = METEO_CFG[key];
            return (
              <View key={key} style={ms.legendItem}>
                <MaterialCommunityIcons name={cfg?.icon as any || 'weather-sunny'} size={16} color={DONUT_COLORS[key]} />
                <Text style={ms.legendLabel}>{cfg?.label || key}</Text>
                <Text style={ms.legendPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeekChart = () => {
    const chartW = screenW - 100;
    const chartH = 160;
    const padL = 35;
    const padR = 15;
    const padT = 20;
    const padB = 50;
    const drawW = chartW - padL - padR;
    const drawH = chartH - padT - padB;

    const values = weekData.map((d) => d.lordo);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values.filter((v) => v > 0), maxVal * 0.5);
    const range = maxVal - minVal * 0.8 || 1;

    const points = values.map((v, i) => {
      const x = padL + (i / 6) * drawW;
      const y = v > 0 ? padT + drawH - ((v - minVal * 0.8) / range) * drawH : padT + drawH;
      return { x, y, v };
    });

    const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaPath = linePath + ` L ${points[points.length - 1].x} ${padT + drawH} L ${points[0].x} ${padT + drawH} Z`;

    const yLabels = [0, 1, 2, 3, 4].map((i) => {
      const val = Math.round(minVal * 0.8 + (range * i) / 4);
      const y = padT + drawH - (drawH * i) / 4;
      return { val, y };
    });

    return (
      <View style={{ alignItems: 'center' }}>
        <Svg width={chartW} height={chartH}>
          {yLabels.map((l, i) => (
            <React.Fragment key={i}>
              <Line x1={padL} y1={l.y} x2={chartW - padR} y2={l.y} stroke="#D0D8D4" strokeWidth={0.5} />
              <SvgText x={padL - 5} y={l.y + 3} fill="#7A9090" fontSize={8} textAnchor="end">
                {l.val > 0 ? `\u20AC${l.val}` : ''}
              </SvgText>
            </React.Fragment>
          ))}
          <Path d={areaPath} fill="rgba(212,175,55,0.15)" />
          <Path d={linePath} stroke="#D4AF37" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#D4AF37" stroke="#FFF" strokeWidth={2} />
          ))}
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: drawW, marginLeft: padL }}>
          {weekData.map((d, i) => {
            const cfg = METEO_CFG[d.meteo] || METEO_CFG.SOLE;
            return (
              <View key={i} style={{ alignItems: 'center', width: drawW / 7 }}>
                <MaterialCommunityIcons name={cfg.icon as any} size={18} color={cfg.color} />
                <Text style={ms.chartDayLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonthGrid = () => {
    const cellSize = Math.floor((screenW - 80) / 7);
    const rows: ({ day: number; meteo: string } | null)[][] = [];
    const { grid } = monthData;

    for (let i = 0; i < grid.length; i += 7) {
      rows.push(grid.slice(i, i + 7));
    }

    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {GIORNI_SHORT.map((g) => (
            <View key={g} style={{ width: cellSize, alignItems: 'center' }}>
              <Text style={ms.calHeader}>{g}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {row.map((cell, ci) => {
              if (!cell) {
                return <View key={ci} style={{ width: cellSize, height: cellSize * 0.85 }} />;
              }
              const cfg = cell.meteo ? METEO_CFG[cell.meteo] : null;
              return (
                <View key={ci} style={[ms.calCell, { width: cellSize, height: cellSize * 0.85 }]}>
                  {cfg ? (
                    <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
                  ) : (
                    <Text style={ms.calDayOff}>{cell.day}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        <View style={ms.calSummary}>
          <Text style={ms.calSummaryTxt}>{monthData.pioggiaDays} Giorni Pioggia</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.container}>
          <View style={ms.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color="#1A3535" />
            </TouchableOpacity>
            <Text style={ms.title}>STATISTICHE METEO</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={ms.segmentRow}>
            {(['Settimana', 'Mese', 'Anno'] as MeteoView[]).map((v) => {
              const on = view === v;
              return (
                <TouchableOpacity key={v} style={[ms.segBtn, on && ms.segBtnOn]} onPress={() => setView(v)}>
                  <Text style={[ms.segTxt, on && { color: '#FFF' }]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {view === 'Settimana' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>Settimana Attuale</Text>
                <Text style={ms.cardSub}>Vendite vs Media ({'\u20AC'}{Math.round(weekAvg)}/gg)</Text>
                {renderWeekChart()}
              </View>
            )}

            {view === 'Mese' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>{monthData.monthName} {monthData.year} - Panoramica</Text>
                {renderMonthGrid()}
              </View>
            )}

            {view === 'Anno' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>Distribuzione Annua {yearData.year}</Text>
                {renderDonut()}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: {
    flex: 1, backgroundColor: '#D8EDE5', marginTop: 40,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 12, paddingVertical: 10, alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(155,145,125,0.45), -3px -3px 8px rgba(255,255,250,0.85)',
  },
  segBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5), -3px -3px 8px rgba(45,120,125,0.35)',
  },
  segTxt: { fontSize: 12, fontWeight: '800', color: '#4A3A2A' },
  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, marginBottom: 12,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1A3535', marginBottom: 4 },
  cardSub: { fontSize: 10, color: '#7A9090', marginBottom: 14 },
  chartDayLabel: { fontSize: 9, fontWeight: '700', color: '#5A7575', marginTop: 2 },
  calHeader: { fontSize: 10, fontWeight: '800', color: '#5A7575' },
  calCell: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(237,232,218,0.5)', borderRadius: 6, margin: 1,
  },
  calDayOff: { fontSize: 10, color: '#B0B0A5', fontWeight: '600' },
  calSummary: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  calSummaryTxt: { fontSize: 11, fontWeight: '700', color: '#5A7575' },
  donutCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  donutTotal: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1 },
  donutDays: { fontSize: 16, fontWeight: '900', color: '#1A3535' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 120 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: '#5A7575' },
  legendPct: { fontSize: 11, fontWeight: '800', color: '#1A3535' },
});
