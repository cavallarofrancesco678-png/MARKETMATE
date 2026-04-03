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
import { useTranslation } from 'react-i18next';
import { getShortDayNames, getMonthNames } from '../i18n';

const { width: screenW } = Dimensions.get('window');

type MeteoView = 'Settimana' | 'Mese' | 'Anno';

interface Giornata {
  data: Date;
  meteo: string;
  lordo: number;
  [key: string]: any;
}

const METEO_CFG: Record<string, { icon: string; color: string }> = {
  SOLE: { icon: 'weather-sunny', color: '#F5A623' },
  VAR: { icon: 'weather-partly-cloudy', color: '#C4A035' },
  PIOGGIA: { icon: 'weather-rainy', color: '#5A90C0' },
  TEMP: { icon: 'weather-lightning-rainy', color: '#7A60BB' },
  VENTO: { icon: 'weather-windy', color: '#60B0A0' },
  NUVOLO: { icon: 'weather-cloudy', color: '#8899AA' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  giornate: Giornata[];
}

export const MeteoStatsModal: React.FC<Props> = ({ visible, onClose, giornate }) => {
  const [view, setView] = useState<MeteoView>('Settimana');
  const { t } = useTranslation();
  const now = new Date();
  const shortDays = getShortDayNames();
  const monthNames = getMonthNames();

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
        label: shortDays[i],
      });
    }
    return result;
  }, [giornate, t]);

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
      grid.push({ day: d, meteo: match?.meteo || '' });
    }
    while (grid.length % 7 !== 0) grid.push(null);

    return { grid, monthName: monthNames[month], year };
  }, [giornate, t]);

  /* ═══ YEAR VIEW: Monthly weather stats ═══ */
  const yearStats = useMemo(() => {
    const year = now.getFullYear();
    const meteoKeys = Object.keys(METEO_CFG);
    const months: { month: string; counts: Record<string, number>; total: number }[] = [];
    
    for (let m = 0; m < 12; m++) {
      const counts: Record<string, number> = {};
      meteoKeys.forEach(k => counts[k] = 0);
      const monthGiornate = giornate.filter(g => {
        const d = new Date(g.data);
        return d.getFullYear() === year && d.getMonth() === m;
      });
      monthGiornate.forEach(g => {
        const mt = g.meteo || 'SOLE';
        counts[mt] = (counts[mt] || 0) + 1;
      });
      months.push({ month: monthNames[m], counts, total: monthGiornate.length });
    }

    // Totals
    const totals: Record<string, number> = {};
    meteoKeys.forEach(k => totals[k] = 0);
    months.forEach(m => meteoKeys.forEach(k => totals[k] += m.counts[k]));
    const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

    return { months, totals, grandTotal, year, meteoKeys };
  }, [giornate, t]);

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
          {shortDays.map((g) => (
            <View key={g} style={{ width: cellSize, alignItems: 'center' }}>
              <Text style={ms.calHeader}>{g}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {row.map((cell, ci) => {
              if (!cell) {
                return <View key={ci} style={{ width: cellSize, height: cellSize }} />;
              }
              const cfg = cell.meteo ? METEO_CFG[cell.meteo] : null;
              return (
                <View key={ci} style={[ms.calCell, { width: cellSize, height: cellSize }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1A4040', marginBottom: 1 }}>{cell.day}</Text>
                  {cfg ? (
                    <MaterialCommunityIcons name={cfg.icon as any} size={16} color={cfg.color} />
                  ) : (
                    <View style={{ height: 16 }} />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.container}>
          <View style={ms.header}>
            <Text style={ms.title}>{t('stats.weatherLabel')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#D46A6A" />
            </TouchableOpacity>
          </View>

          <View style={ms.segmentRow}>
            {(['Settimana', 'Mese', 'Anno'] as MeteoView[]).map((v) => {
              const labels: Record<string, string> = { 'Settimana': t('stats.week'), 'Mese': t('stats.month'), 'Anno': t('stats.year') };
              const on = view === v;
              return (
                <TouchableOpacity key={v} style={[ms.segBtn, on && ms.segBtnOn]} onPress={() => setView(v)}>
                  <Text style={[ms.segTxt, on && { color: '#FFF' }]}>{labels[v]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {view === 'Settimana' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>{t('stats.week')}</Text>
                <Text style={ms.cardSub}>{'\u20AC'}{Math.round(weekAvg)}/gg</Text>
                {renderWeekChart()}
              </View>
            )}

            {view === 'Mese' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>{monthData.monthName} {monthData.year}</Text>
                {renderMonthGrid()}
              </View>
            )}

            {view === 'Anno' && (
              <View style={ms.card}>
                <Text style={ms.cardTitle}>{yearStats.year} - {t('stats.weatherLabel')}</Text>
                <Text style={[ms.cardSub, { marginBottom: 10 }]}>{yearStats.grandTotal} {t('stats.workingDays')}</Text>

                {/* Legend icons */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                  {yearStats.meteoKeys.map((k) => {
                    const cfg = METEO_CFG[k];
                    const total = yearStats.totals[k];
                    if (total === 0) return null;
                    return (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name={cfg.icon as any} size={16} color={cfg.color} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#1A4040' }}>{total}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Monthly breakdown table */}
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#D5DDD8', paddingBottom: 6, marginBottom: 6 }}>
                      <Text style={{ width: 60, fontSize: 9, fontWeight: '800', color: '#1A4040' }}>{t('stats.month')}</Text>
                      {yearStats.meteoKeys.map((k) => {
                        const cfg = METEO_CFG[k];
                        return (
                          <View key={k} style={{ width: 36, alignItems: 'center' }}>
                            <MaterialCommunityIcons name={cfg.icon as any} size={14} color={cfg.color} />
                          </View>
                        );
                      })}
                      <Text style={{ width: 36, fontSize: 9, fontWeight: '800', color: '#1A4040', textAlign: 'center' }}>TOT</Text>
                    </View>

                    {/* Month rows */}
                    {yearStats.months.map((m, mi) => {
                      if (m.total === 0) return null;
                      return (
                        <View key={mi} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderColor: '#E0DBC8' }}>
                          <Text style={{ width: 60, fontSize: 10, fontWeight: '700', color: '#1A4040' }}>{m.month.substring(0, 3)}</Text>
                          {yearStats.meteoKeys.map((k) => (
                            <Text key={k} style={{ width: 36, fontSize: 10, fontWeight: '700', color: m.counts[k] > 0 ? METEO_CFG[k].color : '#D5DDD8', textAlign: 'center' }}>
                              {m.counts[k] > 0 ? m.counts[k] : '-'}
                            </Text>
                          ))}
                          <Text style={{ width: 36, fontSize: 10, fontWeight: '800', color: '#1E7F85', textAlign: 'center' }}>{m.total}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
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
