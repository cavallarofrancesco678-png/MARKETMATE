/**
 * FornitoriPieChartSettimanale.tsx — Pie chart settimanale (Lun→Dom della
 * settimana corrente) che mostra "Spese Fornitori vs Incasso Netto".
 *
 * Round 47: sostituisce il vecchio bar chart. Specifica utente:
 *   - Spicchio principale "Incasso Netto" con explode (staccato)
 *   - Uno spicchio per ogni fornitore con spesa nella settimana
 *   - Box riepilogo: Totale Incasso | Totale Spese Fornitori | Differenza (Netto)
 *   - Palette MarketMate (teal/arancione/viola/rosso/oro)
 *   - Stile neomorfico coerente col resto dell'app.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
}

// Palette MarketMate ─ allineata a stats.tsx ('Statistiche > Fornitori')
const MM_PALETTE = ['#1A5276', '#1D8348', '#BA4A00', '#922B21', '#7D3C98', '#117A65', '#2E4053', '#D4AC0D'];
const NETTO_COLOR = '#1E7F85'; // teal MarketMate per Incasso Netto (coerente con Fatturata in stats)
const STROKE_COLOR = '#D8EDE5'; // verde menta — identico ai pie chart di stats.tsx

const SCREEN_W = Dimensions.get('window').width;

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const FornitoriPieChartSettimanale: React.FC<Props> = ({ giornate }) => {
  const { lordoSett, fornitoriSett, totaleSpese, netto } = useMemo(() => {
    const today = new Date();
    // Lun = 0 ... Dom = 6
    const dow = (today.getDay() + 6) % 7;
    const lun = new Date(today); lun.setDate(today.getDate() - dow); lun.setHours(0, 0, 0, 0);
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

    return {
      lordoSett: Math.round(lordo),
      fornitoriSett: fornArr,
      totaleSpese: tot,
      netto: nettoCalc,
    };
  }, [giornate]);

  // Settimana corrente label
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const lun = new Date(today); lun.setDate(today.getDate() - dow);
  const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
  const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const weekLabel = `${fmtShort(lun)} → ${fmtShort(dom)}`;

  // Costruisci dati per il pie chart
  // Spicchi: Incasso Netto (explode) + ogni fornitore
  const slices: { label: string; value: number; color: string; explode: boolean }[] = [];
  // Aggiungiamo prima i fornitori (per colore stabile)
  fornitoriSett.forEach((f, i) => {
    slices.push({
      label: f.nome,
      value: f.val,
      color: MM_PALETTE[i % MM_PALETTE.length],
      explode: false,
    });
  });
  // Aggiungiamo l'Incasso Netto come ultimo spicchio (con explode)
  if (netto > 0) {
    slices.push({
      label: 'Incasso Netto',
      value: netto,
      color: NETTO_COLOR,
      explode: true,
    });
  }

  const totalPie = slices.reduce((s, x) => s + x.value, 0);

  // Empty state
  if (totalPie === 0 || lordoSett === 0) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pie-chart" size={14} color="#7A5E9B" />
            <Text style={s.title}>SPESE FORNITORI · SETTIMANA</Text>
          </View>
          <Text style={s.weekTxt}>{weekLabel}</Text>
        </View>
        <Text style={s.emptyTxt}>Nessun dato per la settimana corrente</Text>
      </View>
    );
  }

  // Dimensioni grafico
  const size = Math.min(SCREEN_W - 80, 220);
  const center = size / 2;
  const radius = size / 2 - 16; // spazio per explode
  const explodeOffset = 8;

  // Generatore arc path
  const arcPath = (cx: number, cy: number, r: number, startA: number, endA: number) => {
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy + r * Math.sin(endA);
    const largeArc = endA - startA > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  let startAngle = -Math.PI / 2;

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
        <Svg width={size} height={size}>
          {slices.map((sl, i) => {
            const angle = (sl.value / totalPie) * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const midAngle = startAngle + angle / 2;
            // Explode: traslazione del centro lungo la bisettrice
            const cx = sl.explode ? center + explodeOffset * Math.cos(midAngle) : center;
            const cy = sl.explode ? center + explodeOffset * Math.sin(midAngle) : center;
            const d = arcPath(cx, cy, radius, startAngle, endAngle);
            const pct = Math.round((sl.value / totalPie) * 100);
            // Label position (centro dell'arco)
            const labelR = radius * 0.6;
            const lx = cx + labelR * Math.cos(midAngle);
            const ly = cy + labelR * Math.sin(midAngle);
            const out = (
              <G key={i}>
                {/* Stile uniforme stats.tsx: stroke verde menta D8EDE5, strokeWidth 1.5 (un filo più spesso per leggibilità) */}
                <Path d={d} fill={sl.color} stroke={STROKE_COLOR} strokeWidth={1.5} />
                {pct >= 5 && (
                  <SvgText x={lx} y={ly + 5} fill="#FFFFFF" fontSize={15} fontWeight="900" textAnchor="middle">
                    {pct}%
                  </SvgText>
                )}
              </G>
            );
            startAngle = endAngle;
            return out;
          })}
        </Svg>

        {/* Legenda — font aumentato per leggibilità (Round 48) */}
        <View style={s.legend}>
          {slices.map((sl, i) => (
            <View key={i} style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: sl.color }]} />
              <Text style={s.legendLabel} numberOfLines={1}>{sl.label}</Text>
              <Text style={[s.legendVal, { color: sl.color }]}>€{sl.value}</Text>
            </View>
          ))}
        </View>
      </View>

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
    backgroundColor: '#FFFDD0', // crema chiarissimo come da specifica utente
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
    gap: 6,
    paddingLeft: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingVertical: 30,
  },
});
