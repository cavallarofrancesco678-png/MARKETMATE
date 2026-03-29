import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { NeuBox } from '../../src/components/NeuBox';
import { Colors } from '../../src/theme/colors';

const { width } = Dimensions.get('window');

type Period = 'settimana' | 'mese' | 'anno';

export default function StatsScreen() {
  const {
    themeColor,
    storicoGiornate,
    storicoCarburante,
    targetMensile,
  } = useAppStore();

  const activeColor = themeColor || Colors.primary;
  const [period, setPeriod] = useState<Period>('mese');

  // Filter data by period
  const filterByPeriod = (data: any[], dateKey: string) => {
    const now = new Date();
    return data.filter((item) => {
      const itemDate = new Date(item[dateKey]);
      switch (period) {
        case 'settimana':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return itemDate >= weekAgo;
        case 'mese':
          return itemDate.getMonth() === now.getMonth() &&
            itemDate.getFullYear() === now.getFullYear();
        case 'anno':
          return itemDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  };

  const giornate = filterByPeriod(storicoGiornate, 'data');
  const carburante = filterByPeriod(storicoCarburante, 'data');

  // Calculate stats
  const totaleLordo = giornate.reduce((sum, g) => sum + (g.lordo || 0), 0);
  const totaleNetto = giornate.reduce((sum, g) => sum + (g.netto || 0), 0);
  const totaleContanti = giornate.reduce((sum, g) => sum + (g.contanti || 0), 0);
  const totalePos = giornate.reduce((sum, g) => sum + (g.pos || 0), 0);
  const totaleCarburante = carburante.reduce((sum, c) => sum + (c.euro || 0), 0);
  const totaleKm = giornate.reduce((sum, g) => sum + (g.km || 0), 0);
  const giorniLavorati = giornate.length;
  const mediaGiornaliera = giorniLavorati > 0 ? totaleLordo / giorniLavorati : 0;

  // Progress to target
  const progressoTarget = period === 'mese' && targetMensile > 0
    ? Math.min(totaleLordo / targetMensile, 1)
    : 0;

  const StatCard = ({ title, value, subtitle, icon, color }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: string;
    color?: string;
  }) => (
    <NeuBox style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={20} color={color || activeColor} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color: color || activeColor }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </NeuBox>
  );

  const BarChart = () => {
    const maxValue = Math.max(...giornate.map((g) => g.lordo || 0), 1);
    const last7 = giornate.slice(-7);
    
    return (
      <NeuBox style={styles.chartContainer}>
        <Text style={styles.chartTitle}>INCASSI ULTIMI GIORNI</Text>
        <View style={styles.chartBars}>
          {last7.length === 0 ? (
            <Text style={styles.noData}>Nessun dato disponibile</Text>
          ) : (
            last7.map((g, i) => {
              const height = maxValue > 0 ? (g.lordo / maxValue) * 100 : 0;
              const date = new Date(g.data);
              return (
                <View key={i} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${height}%`, backgroundColor: activeColor },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {date.getDate()}/{date.getMonth() + 1}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </NeuBox>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>STATISTICHE</Text>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['settimana', 'mese', 'anno'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodButton,
                period === p && { backgroundColor: activeColor },
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p && styles.periodTextActive,
                ]}
              >
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Target Progress */}
        {period === 'mese' && (
          <NeuBox style={styles.targetCard}>
            <View style={styles.targetHeader}>
              <Text style={styles.targetTitle}>OBIETTIVO MENSILE</Text>
              <Text style={styles.targetPercent}>
                {Math.round(progressoTarget * 100)}%
              </Text>
            </View>
            <View style={styles.targetBar}>
              <View
                style={[
                  styles.targetProgress,
                  {
                    width: `${progressoTarget * 100}%`,
                    backgroundColor: progressoTarget >= 1 ? Colors.verde : activeColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.targetDetails}>
              €{totaleLordo.toFixed(0)} / €{targetMensile}
            </Text>
          </NeuBox>
        )}

        {/* Main Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            title="INCASSO LORDO"
            value={`€${totaleLordo.toFixed(0)}`}
            subtitle={`${giorniLavorati} giorni lavorati`}
            icon="cash"
          />
          <StatCard
            title="UTILE NETTO"
            value={`€${totaleNetto.toFixed(0)}`}
            color={totaleNetto >= 0 ? Colors.verde : Colors.rosso}
            icon="trending-up"
          />
          <StatCard
            title="MEDIA GIORNALIERA"
            value={`€${mediaGiornaliera.toFixed(0)}`}
            icon="analytics"
          />
          <StatCard
            title="CARBURANTE"
            value={`€${totaleCarburante.toFixed(0)}`}
            subtitle={`${totaleKm.toFixed(0)} km percorsi`}
            icon="car"
            color={Colors.arancio}
          />
        </View>

        {/* Payment Split */}
        <NeuBox style={styles.paymentCard}>
          <Text style={styles.cardTitle}>METODI DI PAGAMENTO</Text>
          <View style={styles.paymentRow}>
            <View style={styles.paymentItem}>
              <Ionicons name="cash" size={24} color={Colors.verde} />
              <Text style={styles.paymentLabel}>Contanti</Text>
              <Text style={[styles.paymentValue, { color: Colors.verde }]}>
                €{totaleContanti.toFixed(0)}
              </Text>
            </View>
            <View style={styles.paymentDivider} />
            <View style={styles.paymentItem}>
              <Ionicons name="card" size={24} color={Colors.primary} />
              <Text style={styles.paymentLabel}>POS</Text>
              <Text style={[styles.paymentValue, { color: Colors.primary }]}>
                €{totalePos.toFixed(0)}
              </Text>
            </View>
          </View>
        </NeuBox>

        {/* Chart */}
        <BarChart />

        {/* Summary */}
        <NeuBox style={styles.summaryCard}>
          <Text style={styles.cardTitle}>RIEPILOGO PERIODO</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giorni lavorati</Text>
            <Text style={styles.summaryValue}>{giorniLavorati}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Km totali</Text>
            <Text style={styles.summaryValue}>{totaleKm.toFixed(0)} km</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Spese carburante</Text>
            <Text style={styles.summaryValue}>€{totaleCarburante.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Costo medio/km</Text>
            <Text style={styles.summaryValue}>
              €{totaleKm > 0 ? (totaleCarburante / totaleKm).toFixed(2) : '0.00'}
            </Text>
          </View>
        </NeuBox>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.marrone,
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 1.5,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.marrone,
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 1.5,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 5,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  periodTextActive: {
    color: Colors.white,
  },
  targetCard: {
    marginBottom: 20,
    backgroundColor: Colors.arancioChiaro,
    borderWidth: 2,
    borderColor: Colors.caramello,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  targetPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  targetBar: {
    height: 12,
    backgroundColor: Colors.bgDark,
    borderRadius: 6,
    overflow: 'hidden',
  },
  targetProgress: {
    height: '100%',
    borderRadius: 6,
  },
  targetDetails: {
    fontSize: 12,
    color: Colors.grey,
    textAlign: 'center',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 55) / 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statSubtitle: {
    fontSize: 10,
    color: Colors.grey,
    marginTop: 4,
  },
  paymentCard: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 15,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 12,
    color: Colors.grey,
    marginTop: 5,
  },
  paymentValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  paymentDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.shadowDark,
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 15,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  barContainer: {
    alignItems: 'center',
    width: 35,
  },
  barWrapper: {
    height: 100,
    width: 20,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 5,
    minHeight: 5,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.grey,
    marginTop: 5,
  },
  noData: {
    fontSize: 14,
    color: Colors.grey,
    fontStyle: 'italic',
    textAlign: 'center',
    flex: 1,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgDark,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.grey,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
});
