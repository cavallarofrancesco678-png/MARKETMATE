/**
 * FornitoriBarChart.tsx — Grafico a barre neomorfico per le spese fornitori.
 * Round 46: richiesta utente di vedere visivamente le spese fornitori nel
 * tempo. Layout coerente con gli altri grafici dell'app (Incassi in Home).
 *
 * 3 modalità:
 *   - GIORNO  → mostra ogni giorno della settimana corrente (Lun-Dom)
 *   - SETTIMANA → mostra le ultime 4 settimane (W1-W4)
 *   - PERIODO → range di date selezionabile dall'utente (calendario inline)
 *
 * Per ogni barra:
 *   - Altezza proporzionale al totale spese fornitori (DAILY + CUSTOM)
 *   - Colore: viola scuro per >0, grigio se 0
 *   - Tooltip al tap (placeholder)
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MiniMonthCalendar } from './MiniMonthCalendar';

interface Giornata {
  data: string;
  lordo?: number;
  netto?: number;
  dettaglio_fornitori?: Record<string, number>;
  dettaglio_fornitori_deduction?: Record<string, string>;
  dettaglio_fornitori_days?: Record<string, number>;
}

interface Props {
  giornate: Giornata[];
  themeColor?: string;
}

type Mode = 'GIORNO' | 'SETTIMANA' | 'PERIODO';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function computeForntotPerDay(giornate: Giornata[]): Record<string, number> {
  const out: Record<string, number> = {};
  giornate.forEach((g) => {
    const det = g.dettaglio_fornitori || {};
    let tot = 0;
    Object.entries(det).forEach(([nomeForn, importo]) => {
      const imp = Number(importo) || 0;
      if (imp <= 0) return;
      if (nomeForn.endsWith('__fattn') || nomeForn.endsWith('__liberaLabel')) return;
      tot += imp;
    });
    if (tot > 0) {
      try {
        const iso = new Date(g.data).toISOString().slice(0, 10);
        out[iso] = (out[iso] || 0) + tot;
      } catch {}
    }
  });
  return out;
}

export const FornitoriBarChart: React.FC<Props> = ({ giornate, themeColor = '#7A5E9B' }) => {
  const [mode, setMode] = useState<Mode>('GIORNO');
  const [showCal, setShowCal] = useState(false);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Default range: ultimi 14 giorni
  const defaultFrom = new Date(today);
  defaultFrom.setDate(today.getDate() - 13);
  const defFromIso = `${defaultFrom.getFullYear()}-${String(defaultFrom.getMonth() + 1).padStart(2, '0')}-${String(defaultFrom.getDate()).padStart(2, '0')}`;
  const [rangeFrom, setRangeFrom] = useState<string>(defFromIso);
  const [rangeTo, setRangeTo] = useState<string>(todayIso);

  const totPerDay = useMemo(() => computeForntotPerDay(giornate), [giornate]);

  // Build bars based on current mode
  const bars = useMemo(() => {
    if (mode === 'GIORNO') {
      // Settimana corrente (Lun → Dom)
      const monday = new Date(today);
      const dow = (today.getDay() + 6) % 7; // 0=Lun, 6=Dom
      monday.setDate(today.getDate() - dow);
      const result: { label: string; value: number; date: Date }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        result.push({ label: WEEKDAYS[i], value: totPerDay[iso] || 0, date: d });
      }
      return result;
    }
    if (mode === 'SETTIMANA') {
      // Ultime 4 settimane
      const monday = new Date(today);
      const dow = (today.getDay() + 6) % 7;
      monday.setDate(today.getDate() - dow);
      const result: { label: string; value: number; date: Date }[] = [];
      for (let w = 3; w >= 0; w--) {
        const start = new Date(monday);
        start.setDate(monday.getDate() - 7 * w);
        let tot = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          tot += totPerDay[iso] || 0;
        }
        const lbl = w === 0 ? 'Questa' : `-${w}sett`;
        result.push({ label: lbl, value: tot, date: start });
      }
      return result;
    }
    // PERIODO: barre per ogni giorno del range, raggruppate a max 14 (sample)
    const fromDate = new Date(rangeFrom + 'T00:00:00');
    const toDate = new Date(rangeTo + 'T00:00:00');
    const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (dayCount <= 0) return [];
    if (dayCount <= 14) {
      const result: { label: string; value: number; date: Date }[] = [];
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(fromDate);
        d.setDate(fromDate.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        result.push({
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          value: totPerDay[iso] || 0,
          date: d,
        });
      }
      return result;
    }
    // Più di 14 giorni → raggruppa per settimana
    const result: { label: string; value: number; date: Date }[] = [];
    const numWeeks = Math.ceil(dayCount / 7);
    for (let w = 0; w < numWeeks; w++) {
      const start = new Date(fromDate);
      start.setDate(fromDate.getDate() + 7 * w);
      let tot = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d > toDate) break;
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        tot += totPerDay[iso] || 0;
      }
      result.push({
        label: `S${w + 1}`,
        value: tot,
        date: start,
      });
    }
    return result;
  }, [mode, totPerDay, rangeFrom, rangeTo, today]);

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const totalAll = bars.reduce((s, b) => s + b.value, 0);

  const formatRangeLabel = () => {
    try {
      const f = new Date(rangeFrom + 'T00:00:00');
      const t = new Date(rangeTo + 'T00:00:00');
      const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `${fmt(f)} → ${fmt(t)}`;
    } catch {
      return '';
    }
  };

  return (
    <View style={s.container}>
      {/* Header: title + total */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="storefront" size={16} color={themeColor} />
          <Text style={s.title}>SPESE FORNITORI</Text>
        </View>
        <Text style={[s.totalVal, { color: themeColor }]}>€{totalAll.toFixed(0)}</Text>
      </View>

      {/* Mode tabs */}
      <View style={s.tabs}>
        {(['GIORNO', 'SETTIMANA', 'PERIODO'] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => { setMode(m); if (m === 'PERIODO') setShowCal(false); }}
              activeOpacity={0.7}
              style={[s.tab, active && { backgroundColor: themeColor, borderColor: themeColor }]}
            >
              <Text style={[s.tabTxt, active && { color: '#FFF' }]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Periodo: range selector */}
      {mode === 'PERIODO' && (
        <View>
          <TouchableOpacity
            onPress={() => setShowCal(!showCal)}
            activeOpacity={0.7}
            style={s.rangeBtn}
          >
            <Ionicons name="calendar-outline" size={14} color="#1A4040" />
            <Text style={s.rangeBtnTxt}>{formatRangeLabel()}</Text>
            <Ionicons name={showCal ? 'chevron-up' : 'chevron-down'} size={14} color="#1A4040" />
          </TouchableOpacity>
          {showCal && (
            <View style={{ marginTop: 8, marginBottom: 6, backgroundColor: '#F9F3E0', padding: 6, borderRadius: 10 }}>
              <MiniMonthCalendar
                selectedDates={[]}
                onToggleDate={() => {}}
                rangeMode={true}
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                onRangeChange={(from, to) => {
                  if (from && !to) setRangeFrom(from);
                  else if (from && to) {
                    setRangeFrom(from);
                    setRangeTo(to);
                    setShowCal(false);
                  }
                }}
                themeColor={themeColor}
              />
            </View>
          )}
        </View>
      )}

      {/* Bars (neomorphic) */}
      <View style={s.chartArea}>
        {bars.length === 0 && (
          <Text style={s.emptyTxt}>Nessun dato nel periodo selezionato</Text>
        )}
        <View style={s.barsRow}>
          {bars.map((b, i) => {
            const hPct = b.value > 0 ? Math.max(0.08, b.value / maxVal) : 0;
            return (
              <View key={i} style={s.barCol}>
                <View style={s.barTrack}>
                  {b.value > 0 && (
                    <View
                      style={[
                        s.barFill,
                        {
                          height: `${hPct * 100}%`,
                          backgroundColor: themeColor,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text style={s.barLabel} numberOfLines={1}>{b.label}</Text>
                {b.value > 0 && (
                  <Text style={s.barVal}>€{b.value.toFixed(0)}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const SCREEN_W = Dimensions.get('window').width;

const s = StyleSheet.create({
  container: {
    backgroundColor: '#D8EDE5',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    // Neomorphic shadow
    shadowColor: '#1A4040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: '#5A7575',
    letterSpacing: 1,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#F5EFDC',
    borderWidth: 1,
    borderColor: '#E5DECF',
    alignItems: 'center',
  },
  tabTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5A7575',
    letterSpacing: 0.6,
  },
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#C0D0C8',
    marginBottom: 4,
  },
  rangeBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A4040',
    flex: 1,
    textAlign: 'center',
  },
  chartArea: {
    marginTop: 4,
    minHeight: 130,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 18,
  },
  barTrack: {
    width: '90%',
    maxWidth: 28,
    height: 80,
    backgroundColor: 'rgba(122,94,155,0.10)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A9090',
    marginTop: 4,
    textAlign: 'center',
  },
  barVal: {
    fontSize: 9,
    fontWeight: '900',
    color: '#5A4A2A',
    marginTop: 1,
  },
  emptyTxt: {
    fontSize: 11,
    color: '#7A9090',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
