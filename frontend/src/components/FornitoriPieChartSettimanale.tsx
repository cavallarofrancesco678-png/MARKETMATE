/**
 * FornitoriPieChartSettimanale.tsx — Pie chart SETTIMANALE delle SOLE
 * spese fornitori (Lun→Dom della dataRiferimento).
 *
 * Round 55 (richiesta utente):
 *  - ❌ Rimosso lo spicchio "Incasso Settimana": il grafico mostra SOLO
 *    spese fornitori, non altre spese né l'incasso netto.
 *  - Nomi fornitori chiari e leggibili.
 *  - Fornitori sotto il 5% del totale spese → accorpati in spicchio "Varie".
 *  - Tap su uno spicchio → tooltip con NOME COMPLETO + TOTALE €.
 *  - Box riepilogo: Totale Incasso | Totale Spese Fornitori | Differenza (Netto).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface Giornata {
  data: string | Date;
  lordo?: number;
  dettaglio_fornitori?: Record<string, number>;
  dettaglio_fornitori_deduction?: Record<string, string>;
}

interface Props {
  giornate: Giornata[];
  /**
   * Data di riferimento per il calcolo della settimana. Se assente, usa oggi.
   * Permette di mostrare il grafico relativo a una settimana passata quando
   * l'utente naviga indietro nello storico (Round 50).
   */
  dataRiferimento?: Date;
}

// Palette MarketMate — uniforme con stats.tsx 'Statistiche > Fornitori'
const MM_PALETTE = ['#1A5276', '#1D8348', '#BA4A00', '#922B21', '#7D3C98', '#117A65', '#2E4053', '#D4AC0D'];
const NETTO_COLOR = '#1E7F85'; // teal MarketMate per la voce netto (solo nel box riepilogo)
const STROKE_COLOR = '#D8EDE5'; // verde menta — identico ai pie chart di stats.tsx
const VARIE_COLOR = '#7F8C8D'; // grigio neutro per la voce "Varie"

const SCREEN_W = Dimensions.get('window').width;
// Round 55: soglia per accorpare i fornitori piccoli in "Varie"
const SOGLIA_VARIE_PCT = 5; // sotto il 5% del totale spese → finiscono in Varie

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Slice {
  label: string;
  value: number;
  color: string;
  /**
   * Solo per lo spicchio "Varie": lista dei fornitori che lo compongono,
   * mostrata nel tooltip al tap.
   */
  componenti?: { nome: string; val: number }[];
}

export const FornitoriPieChartSettimanale: React.FC<Props> = ({ giornate, dataRiferimento }) => {
  // Round 55: indice dello spicchio attualmente selezionato (tap)
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);

  const { lordoSett, fornitoriSett, totaleSpese, netto, weekLabel } = useMemo(() => {
    const ref = dataRiferimento ? new Date(dataRiferimento) : new Date();
    // Lun = 0 ... Dom = 6
    const dow = (ref.getDay() + 6) % 7;
    const lun = new Date(ref); lun.setDate(ref.getDate() - dow); lun.setHours(0, 0, 0, 0);
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6); dom.setHours(23, 59, 59, 999);

    let lordo = 0;
    const perForn: Record<string, number> = {};

    (giornate || []).forEach((g) => {
      try {
        const dt = new Date(g.data);
        if (dt < lun || dt > dom) return;
        lordo += g.lordo || 0;
        const det = g.dettaglio_fornitori || {};
        Object.entries(det).forEach(([k, v]) => {
          if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
          const nomeBase = k.replace(/__libera$/, '');
          const imp = Number(v) || 0;
          if (imp <= 0) return;
          perForn[nomeBase] = (perForn[nomeBase] || 0) + imp;
        });
      } catch {}
    });

    const fornArr = Object.entries(perForn)
      .map(([nome, val]) => ({ nome, val: Math.round(val) }))
      .filter((x) => x.val > 0)
      .sort((a, b) => b.val - a.val);
    const tot = fornArr.reduce((s, x) => s + x.val, 0);
    const nettoCalc = Math.round(lordo - tot);

    const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const weekLbl = `${fmtShort(lun)} → ${fmtShort(dom)}`;

    return {
      lordoSett: Math.round(lordo),
      fornitoriSett: fornArr,
      totaleSpese: tot,
      netto: nettoCalc,
      weekLabel: weekLbl,
    };
  }, [giornate, dataRiferimento]);

  // Round 55: costruisci gli spicchi del pie chart.
  // SOLO fornitori (no Incasso Netto). Fornitori sotto SOGLIA_VARIE_PCT
  // del totale spese vengono accorpati in uno spicchio "Varie".
  const slices: Slice[] = useMemo(() => {
    if (totaleSpese === 0) return [];
    const result: Slice[] = [];
    const varieComponenti: { nome: string; val: number }[] = [];

    fornitoriSett.forEach((f, i) => {
      const pct = (f.val / totaleSpese) * 100;
      if (pct < SOGLIA_VARIE_PCT) {
        varieComponenti.push({ nome: f.nome, val: f.val });
      } else {
        result.push({
          label: f.nome,
          value: f.val,
          color: MM_PALETTE[result.length % MM_PALETTE.length],
        });
      }
    });

    if (varieComponenti.length > 0) {
      const varieTot = varieComponenti.reduce((s, x) => s + x.val, 0);
      result.push({
        label: 'Varie',
        value: varieTot,
        color: VARIE_COLOR,
        componenti: varieComponenti.sort((a, b) => b.val - a.val),
      });
    }

    return result;
  }, [fornitoriSett, totaleSpese]);

  // Empty state
  if (totaleSpese === 0) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pie-chart" size={14} color="#7A5E9B" />
            <Text style={s.title}>SPESE FORNITORI · SETTIMANA</Text>
          </View>
          <Text style={s.weekTxt}>{weekLabel}</Text>
        </View>
        <Text style={s.emptyTxt}>Nessuna spesa fornitori per questa settimana</Text>
        {lordoSett > 0 && (
          <View style={s.summaryBox}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Totale Incasso</Text>
              <Text style={[s.summaryVal, { color: '#1A4040' }]}>€{lordoSett}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Totale Spese Fornitori</Text>
              <Text style={[s.summaryVal, { color: '#D46A6A' }]}>€0</Text>
            </View>
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { fontWeight: '900', color: '#1A4040' }]}>Differenza (Netto)</Text>
              <Text style={[s.summaryVal, { color: NETTO_COLOR, fontSize: 16 }]}>€{lordoSett}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Dimensioni grafico
  const size = Math.min(SCREEN_W - 80, 220);
  const center = size / 2;
  const radius = size / 2 - 8;

  // Generatore arc path
  const arcPath = (cx: number, cy: number, r: number, startA: number, endA: number) => {
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy + r * Math.sin(endA);
    const largeArc = endA - startA > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // Pre-calcola le angolazioni di ogni slice per il tap detection
  let cursor = -Math.PI / 2;
  const sliceAngles = slices.map((sl) => {
    const angle = (sl.value / totaleSpese) * 2 * Math.PI;
    const startA = cursor;
    const endA = cursor + angle;
    cursor = endA;
    return { startA, endA };
  });

  // Tap detection: converte (x,y) del tap in indice slice
  const handlePiePress = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - center;
    const dy = locationY - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      setSelectedSlice(null);
      return;
    }
    // Angolo in [-π, π], normalizzato in modo che -π/2 = "12 in punto" (inizio)
    let ang = Math.atan2(dy, dx);
    // Trova lo slice corrispondente
    const idx = sliceAngles.findIndex(({ startA, endA }) => {
      // Normalizza angoli in modo che siano confrontabili.
      // startA può andare da -π/2 in poi (cresce con angle).
      let a = ang;
      // Se startA > π, ang potrebbe essere ancora negativo: aggiungiamo 2π ad ang
      while (a < startA) a += 2 * Math.PI;
      return a >= startA && a < endA;
    });
    setSelectedSlice(idx >= 0 ? idx : null);
  };

  // Slice attualmente selezionato per il tooltip
  const selected = selectedSlice !== null ? slices[selectedSlice] : null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="pie-chart" size={14} color="#7A5E9B" />
          <Text style={s.title}>SPESE FORNITORI · SETTIMANA</Text>
        </View>
        <Text style={s.weekTxt}>{weekLabel}</Text>
      </View>

      {/* Pie chart SVG + legenda affiancata */}
      <View style={s.pieRow}>
        <TouchableWithoutFeedback onPress={handlePiePress}>
          <View>
            <Svg width={size} height={size}>
              {slices.map((sl, i) => {
                const { startA, endA } = sliceAngles[i];
                const midA = (startA + endA) / 2;
                const isSelected = selectedSlice === i;
                // Quando selezionato: aumento leggermente il raggio per evidenziare
                const r = isSelected ? radius : radius - 1;
                const d = arcPath(center, center, r, startA, endA);
                const pct = Math.round((sl.value / totaleSpese) * 100);
                // Label position (centro dell'arco)
                const labelR = r * 0.6;
                const lx = center + labelR * Math.cos(midA);
                const ly = center + labelR * Math.sin(midA);
                return (
                  <G key={i}>
                    <Path
                      d={d}
                      fill={sl.color}
                      stroke={isSelected ? '#FFD86F' : STROKE_COLOR}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    {/* Round 55: nomi più chiari — sui spicchi grandi (>= 12%):
                        nome (max 10 char) sopra + % sotto. Sui medi (5-11%): solo %.
                        Spicchi < 5% non esistono (accorpati in Varie). */}
                    {pct >= 12 ? (
                      <>
                        <SvgText x={lx} y={ly - 5} fill="#FFFFFF" fontSize={11} fontWeight="900" textAnchor="middle">
                          {sl.label.length > 11 ? sl.label.slice(0, 10) + '…' : sl.label}
                        </SvgText>
                        <SvgText x={lx} y={ly + 9} fill="#FFFFFF" fontSize={13} fontWeight="900" textAnchor="middle">
                          {pct}%
                        </SvgText>
                      </>
                    ) : (
                      <SvgText x={lx} y={ly + 5} fill="#FFFFFF" fontSize={14} fontWeight="900" textAnchor="middle">
                        {pct}%
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </Svg>
          </View>
        </TouchableWithoutFeedback>

        {/* Legenda — sempre visibile, font grandi per leggibilità */}
        <View style={s.legend}>
          {slices.map((sl, i) => (
            <TouchableWithoutFeedback key={i} onPress={() => setSelectedSlice(selectedSlice === i ? null : i)}>
              <View style={[s.legendRow, selectedSlice === i && { backgroundColor: 'rgba(255,216,111,0.25)', borderRadius: 6, paddingHorizontal: 4 }]}>
                <View style={[s.legendDot, { backgroundColor: sl.color }]} />
                <Text style={s.legendLabel} numberOfLines={1}>{sl.label}</Text>
                <Text style={[s.legendVal, { color: sl.color }]}>€{sl.value}</Text>
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>
      </View>

      {/* Tooltip Round 55: appare al tap sullo spicchio o legenda */}
      {selected && (
        <View style={s.tooltip}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: selected.componenti ? 6 : 0 }}>
            <View style={[s.legendDot, { backgroundColor: selected.color, width: 14, height: 14, borderRadius: 7 }]} />
            <Text style={s.tooltipTitle}>{selected.label}</Text>
            <Text style={s.tooltipVal}>€{selected.value}</Text>
          </View>
          {selected.componenti && selected.componenti.length > 0 && (
            <View style={{ paddingLeft: 22 }}>
              {selected.componenti.map((c) => (
                <View key={c.nome} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 }}>
                  <Text style={s.tooltipItemName}>• {c.nome}</Text>
                  <Text style={s.tooltipItemVal}>€{c.val}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Box riepilogo sotto il grafico */}
      <View style={s.summaryBox}>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Totale Incasso</Text>
          <Text style={[s.summaryVal, { color: '#1A4040' }]}>€{lordoSett}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Totale Spese Fornitori</Text>
          <Text style={[s.summaryVal, { color: '#D46A6A' }]}>€{totaleSpese}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { fontWeight: '900', color: '#1A4040' }]}>Differenza (Netto)</Text>
          <Text style={[s.summaryVal, { color: netto >= 0 ? NETTO_COLOR : '#D46A6A', fontSize: 16 }]}>€{netto}</Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: '#FFFDD0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#1A4040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 5,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: '#5A4A2A',
    letterSpacing: 0.8,
  },
  weekTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A5E9B',
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  legend: {
    flex: 1,
    gap: 5,
    paddingLeft: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#1A4040',
  },
  legendVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  // Round 55: tooltip al tap sullo spicchio
  tooltip: {
    backgroundColor: '#1A4040',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tooltipTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
  },
  tooltipVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFD86F',
  },
  tooltipItemName: {
    fontSize: 12,
    color: '#E8E0C8',
    fontWeight: '600',
    flex: 1,
  },
  tooltipItemVal: {
    fontSize: 12,
    color: '#FFD86F',
    fontWeight: '800',
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E8E0C8',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5A7575',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E0C8',
    marginVertical: 5,
  },
  emptyTxt: {
    fontSize: 12,
    color: '#7A9090',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
});
