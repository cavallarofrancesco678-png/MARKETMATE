import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
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
  mercato?: string;
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

  /* ═══ Round 74-ter ═══
     L'asse Y del grafico settimanale prima mostrava il LORDO in € (errore
     riportato dall'utente: "in statistiche meteo cè un valore in euro").
     Ora mostra la TEMPERATURA MEDIA mattutina (06:00-13:00) recuperata
     dal backend per il mercato del giorno. */
  const [weekTemps, setWeekTemps] = useState<Record<string, number | null>>({}); // ISO date → °C
  const [loadingTemps, setLoadingTemps] = useState(false);

  const weekData = useMemo(() => {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const result: { lordo: number; meteo: string; label: string; mercato: string; dateIso: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const match = giornate.find(
        (g) => new Date(g.data).toDateString() === d.toDateString()
      );
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({
        lordo: match?.lordo || 0,
        meteo: match?.meteo || 'SOLE',
        label: shortDays[i],
        mercato: (match as any)?.mercato || '',
        dateIso: iso,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giornate, t]);

  /* Fetch temperature settimanali dal backend (Open-Meteo Archive via /api/weather/historical-markets).
     Aggrega per mercato e fa UNA chiamata batch. Salva risultato in `weekTemps` (ISO date → °C). */
  useEffect(() => {
    if (!visible || view !== 'Settimana') return;
    // Aggrega le date per ogni mercato
    const byMercato: Record<string, string[]> = {};
    weekData.forEach((d) => {
      if (!d.mercato) return;
      if (!byMercato[d.mercato]) byMercato[d.mercato] = [];
      byMercato[d.mercato].push(d.dateIso);
    });
    const items = Object.entries(byMercato).map(([mercato, dates]) => ({ mercato, dates }));
    if (items.length === 0) {
      setWeekTemps({});
      return;
    }
    setLoadingTemps(true);
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    fetch(`${backendUrl}/api/weather/historical-markets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const map: Record<string, number | null> = {};
        (data.items || []).forEach((it: any) => {
          (it.days || []).forEach((d: any) => {
            map[d.date] = d.temp;
          });
        });
        setWeekTemps(map);
      })
      .catch(() => setWeekTemps({}))
      .finally(() => setLoadingTemps(false));
  }, [visible, view, weekData]);

  const weekAvg = useMemo(() => {
    // Round 74-ter: media TEMPERATURE (°C) — non più lordo €.
    const temps = weekData
      .map((d) => weekTemps[d.dateIso])
      .filter((t): t is number => typeof t === 'number');
    return temps.length > 0 ? temps.reduce((s, v) => s + v, 0) / temps.length : 0;
  }, [weekData, weekTemps]);

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

    // Round 74-ter: l'asse Y mostra la TEMPERATURA (°C), non più il lordo €.
    const values = weekData.map((d) => weekTemps[d.dateIso]);
    const numericValues = values.filter((v): v is number => typeof v === 'number');
    const hasData = numericValues.length > 0;
    const maxVal = hasData ? Math.max(...numericValues, 1) : 30;
    const minVal = hasData ? Math.min(...numericValues, maxVal - 5) : 0;
    const range = (maxVal - minVal) || 1;

    const points = values.map((v, i) => {
      const x = padL + (i / 6) * drawW;
      if (typeof v !== 'number') {
        return { x, y: padT + drawH, v: null as number | null, hasVal: false };
      }
      const y = padT + drawH - ((v - minVal) / range) * drawH;
      return { x, y, v, hasVal: true };
    });

    // Connetto i punti SOLO quando entrambi hanno valori reali (no segmenti su placeholder)
    const segments: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (p1.hasVal && p2.hasVal) {
        segments.push(`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
      }
    }
    const linePath = segments.join(' ');

    const yLabels = [0, 1, 2, 3, 4].map((i) => {
      const val = Math.round(minVal + (range * i) / 4);
      const y = padT + drawH - (drawH * i) / 4;
      return { val, y };
    });

    return (
      <View style={{ alignItems: 'center' }}>
        {loadingTemps && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <ActivityIndicator size="small" color="#1E7F85" />
            <Text style={{ fontSize: 10, color: '#5A7575' }}>Caricamento temperature…</Text>
          </View>
        )}
        <Svg width={chartW} height={chartH}>
          {yLabels.map((l, i) => (
            <React.Fragment key={i}>
              <Line x1={padL} y1={l.y} x2={chartW - padR} y2={l.y} stroke="#D0D8D4" strokeWidth={0.5} />
              <SvgText x={padL - 5} y={l.y + 3} fill="#7A9090" fontSize={8} textAnchor="end">
                {`${l.val}\u00b0C`}
              </SvgText>
            </React.Fragment>
          ))}
          <Path d={linePath} stroke="#1E7F85" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {points.map((p, i) => (
            p.hasVal ? (
              <React.Fragment key={i}>
                <Circle cx={p.x} cy={p.y} r={4} fill="#1E7F85" stroke="#FFF" strokeWidth={2} />
                <SvgText x={p.x} y={p.y - 7} fill="#1A4040" fontSize={8} fontWeight="700" textAnchor="middle">
                  {`${(p.v as number).toFixed(1)}\u00b0`}
                </SvgText>
              </React.Fragment>
            ) : null
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
        {!loadingTemps && !hasData && (
          <Text style={{ fontSize: 10, color: '#8A8A85', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
            Nessuna temperatura disponibile per questa settimana.{'\n'}
            Aggiungi mercati nelle giornate per recuperarle automaticamente.
          </Text>
        )}
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
        <View style={{ flexDirection: 'row', marginBottom: 6, justifyContent: 'center' }}>
          {shortDays.map((g) => (
            <View key={g} style={{ width: cellSize, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={ms.calHeader}>{g}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', justifyContent: 'center' }}>
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
                <Text style={ms.cardSub}>
                  {weekAvg > 0
                    ? `Media settimanale: ${weekAvg.toFixed(1)}\u00b0C (06:00–13:00)`
                    : 'Nessun mercato registrato in questa settimana'}
                </Text>
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
