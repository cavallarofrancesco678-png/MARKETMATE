import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Month abbreviations in Italian
const MESI_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mai', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// Mock data - Ricavo Netto mensile (will be replaced with real calculated data)
const MOCK_CURRENT = [4500, 2850, 2850, 2850, 2850, 2850, 3320, 4120, 4850, 4850, 4120, 4120];
const MOCK_PREVIOUS = [1800, 1200, 1500, 1300, 1400, 1200, 1300, 1800, 2200, 2100, 2500, 2800];
const MOCK_TREND = [2200, 1800, 1600, 1500, 1400, 1500, 1700, 2000, 2200, 2400, 2800, 3000];

type ViewMode = 'mese' | 'anno' | 'confronto';

interface RevenueChartProps {
  storicoGiornate?: any[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ storicoGiornate = [] }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('anno');
  const [showComparison, setShowComparison] = useState(true);
  const [tooltipData, setTooltipData] = useState<{
    month: string; current: number; previous: number; delta: string;
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Totals
  const totaleCorrente = MOCK_CURRENT.reduce((s, v) => s + v, 0);
  const totalePrecedente = MOCK_PREVIOUS.reduce((s, v) => s + v, 0);
  const deltaPercent = totalePrecedente > 0
    ? Math.round(((totaleCorrente - totalePrecedente) / totalePrecedente) * 100)
    : 0;

  // Chart dimensions
  const chartContainerWidth = SCREEN_WIDTH - 60;
  const barW = 7;
  const gapInGroup = 2;
  const gapBetweenGroups = 8;

  // Build bar data: for each month, 2 bars (teal current + orange previous)
  const barData: any[] = [];
  const lineData: any[] = [];

  MESI_ABBR.forEach((mese, i) => {
    barData.push({
      value: MOCK_CURRENT[i],
      label: mese,
      frontColor: '#3AAFA9',
      spacing: gapInGroup,
      labelTextStyle: { color: '#7A9A9A', fontSize: 6.5, fontWeight: '600' },
      topLabelComponent: () => (
        <Text style={sty.barLabel}>€{(MOCK_CURRENT[i] / 1000).toFixed(1)}k</Text>
      ),
      onPress: () => {
        const d = MOCK_PREVIOUS[i] > 0
          ? Math.round(((MOCK_CURRENT[i] - MOCK_PREVIOUS[i]) / MOCK_PREVIOUS[i]) * 100)
          : 0;
        setTooltipData({
          month: MESI_ABBR[i],
          current: MOCK_CURRENT[i],
          previous: MOCK_PREVIOUS[i],
          delta: `${d >= 0 ? '+' : ''}${d}%`,
        });
        setTimeout(() => setTooltipData(null), 3000);
      },
    });

    barData.push({
      value: MOCK_PREVIOUS[i],
      frontColor: '#E8A060',
      spacing: gapBetweenGroups,
    });

    lineData.push({ value: MOCK_TREND[i] });
  });

  const maxVal = Math.max(...MOCK_CURRENT, ...MOCK_TREND) * 1.25;

  return (
    <View style={sty.outer}>
      {/* HEADER */}
      <View style={sty.headerRow}>
        <Text style={sty.headerTitle}>Andamento Incasso</Text>
      </View>

      {/* SUMMARY WIDGET */}
      <View style={sty.summaryCard}>
        <Text style={sty.summaryLabel}>Incasso Totale Anno {currentYear}:</Text>
        <View style={sty.summaryRow}>
          <Text style={sty.summaryValue}>€{totaleCorrente.toLocaleString('it-IT')}</Text>
          <Text style={[sty.summaryDelta, { color: deltaPercent >= 0 ? '#3AAFA9' : '#D46A6A' }]}>
            ({deltaPercent >= 0 ? '+' : ''}{deltaPercent}% vs {previousYear})
          </Text>
        </View>
      </View>

      {/* TOOLTIP */}
      {tooltipData && (
        <View style={sty.tooltip}>
          <Text style={sty.tooltipTitle}>{tooltipData.month} {currentYear}</Text>
          <Text style={sty.tooltipLine}>Corrente: €{tooltipData.current.toLocaleString('it-IT')}</Text>
          <Text style={sty.tooltipLine}>Prec.: €{tooltipData.previous.toLocaleString('it-IT')}</Text>
          <Text style={[sty.tooltipDelta, { color: tooltipData.delta.startsWith('+') ? '#3AAFA9' : '#D46A6A' }]}>
            {tooltipData.delta}
          </Text>
        </View>
      )}

      {/* CHART */}
      <View style={sty.chartWrap}>
        <BarChart
          data={barData}
          barWidth={barW}
          roundedTop
          roundedBottom={false}
          hideRules={false}
          rulesColor="rgba(180,200,190,0.25)"
          rulesType="dashed"
          xAxisColor="rgba(180,200,190,0.3)"
          yAxisColor="rgba(180,200,190,0.3)"
          yAxisTextStyle={{ color: '#9AB5A5', fontSize: 7 }}
          xAxisLabelTextStyle={{ color: '#7A9A9A', fontSize: 7 }}
          noOfSections={4}
          maxValue={maxVal}
          isAnimated
          animationDuration={600}
          showLine={showComparison}
          lineData={lineData}
          lineConfig={{
            color: '#4A5A5A',
            thickness: 2,
            curved: true,
            dataPointsColor: '#4A5A5A',
            dataPointsRadius: 2,
          }}
          width={chartContainerWidth - 40}
          height={120}
          barBorderRadius={3}
          yAxisLabelPrefix="€"
          formatYLabel={(val: string) => {
            const n = parseFloat(val);
            if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
            return val;
          }}
          initialSpacing={6}
          endSpacing={4}
          yAxisLabelWidth={28}
        />
      </View>

      {/* LEGEND */}
      <View style={sty.legendRow}>
        <View style={sty.legendItem}>
          <View style={[sty.legendBox, { backgroundColor: '#3AAFA9' }]} />
          <Text style={sty.legendText}>Incasso Mese (Corrente)</Text>
        </View>
        <View style={sty.legendItem}>
          <View style={[sty.legendLine, { backgroundColor: '#4A5A5A' }]} />
          <Text style={sty.legendText}>Confronto Mese ({previousYear})</Text>
        </View>
      </View>

      {/* FILTER BUTTONS */}
      <View style={sty.filterRow}>
        <TouchableOpacity
          style={[sty.filterBtn, viewMode === 'mese' && sty.filterBtnPressed]}
          onPress={() => setViewMode('mese')}
          activeOpacity={0.7}
        >
          <Text style={[sty.filterText, viewMode === 'mese' && sty.filterTextActive]}>MESE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sty.filterBtn, viewMode === 'anno' && sty.filterBtnTeal]}
          onPress={() => setViewMode('anno')}
          activeOpacity={0.7}
        >
          <Text style={[sty.filterText, viewMode === 'anno' && sty.filterTextActive]}>ANNO</Text>
          <Text style={[sty.filterSub, viewMode === 'anno' && sty.filterSubActive]}>(Dodici Mesi)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sty.filterBtn, viewMode === 'confronto' && sty.filterBtnPressed]}
          onPress={() => {
            setViewMode('confronto');
            setShowComparison(prev => !prev);
          }}
          activeOpacity={0.7}
        >
          <Text style={[sty.filterText, viewMode === 'confronto' && sty.filterTextActive]}>CONFRONTO</Text>
          <Text style={[sty.filterSub, viewMode === 'confronto' && sty.filterSubActive]}>ANNO PREC.</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const sty = StyleSheet.create({
  outer: {
    backgroundColor: '#FAFCFA',
    borderRadius: 20,
    padding: 14,
    // @ts-ignore
    boxShadow: '5px 6px 14px rgba(150,180,170,0.4), -4px -4px 10px rgba(255,255,255,0.9)',
  },

  headerRow: { marginBottom: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1A4A4A' },

  summaryCard: {
    backgroundColor: '#F0F8F5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(150,180,170,0.25), -2px -2px 5px rgba(255,255,255,0.7)',
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#6A8A8A' },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  summaryValue: { fontSize: 22, fontWeight: '900', color: '#1A4A4A' },
  summaryDelta: { fontSize: 12, fontWeight: '700' },

  tooltip: {
    position: 'absolute',
    top: 50,
    right: 14,
    backgroundColor: '#1A3A3A',
    borderRadius: 10,
    padding: 8,
    zIndex: 100,
    minWidth: 130,
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(0,0,0,0.35)',
  },
  tooltipTitle: { fontSize: 11, fontWeight: '800', color: '#FFF', marginBottom: 3 },
  tooltipLine: { fontSize: 9, color: '#B8D8D0', marginBottom: 1 },
  tooltipDelta: { fontSize: 13, fontWeight: '900', marginTop: 3 },

  chartWrap: {
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },

  barLabel: { fontSize: 5, color: '#3A6A6A', fontWeight: '700', textAlign: 'center' as any },

  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendBox: { width: 8, height: 8, borderRadius: 2 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontSize: 7, fontWeight: '600', color: '#6A8A8A' },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    flex: 1,
    backgroundColor: '#EDE8E0',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(180,160,140,0.4), -2px -2px 6px rgba(255,255,255,0.8)',
  },
  filterBtnPressed: {
    backgroundColor: '#E0D4C4',
    // @ts-ignore
    boxShadow: 'inset 2px 2px 5px rgba(160,140,120,0.4), inset -1px -1px 3px rgba(255,255,255,0.5)',
  },
  filterBtnTeal: {
    backgroundColor: '#3AAFA9',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(40,120,120,0.5), -2px -2px 6px rgba(100,200,200,0.3)',
  },
  filterText: { fontSize: 9, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterTextActive: { color: '#FFF' },
  filterSub: { fontSize: 7, fontWeight: '600', color: '#8A7A6A', textAlign: 'center' },
  filterSubActive: { color: 'rgba(255,255,255,0.8)' },
});

export default RevenueChart;
