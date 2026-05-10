import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClose: () => void;
  speseFisse: number;
  excludeSpeseFisse: boolean;
  toggleExcludeSpeseFisse: () => void;
  collabCosto: number;
  excludeCollaboratori: boolean;
  toggleExcludeCollaboratori: () => void;
  speseExtra: number;
  excludeSpeseExtra: boolean;
  toggleExcludeSpeseExtra: () => void;
  // Fornitori (SOLO DAILY) — riga separata flaggabile. WEEKLY/MONTHLY non compaiono qui.
  fornitoriDaily: number;
  excludeFornitori: boolean;
  toggleExcludeFornitori: () => void;
  // Info extra per hint (totali WEEKLY/MONTHLY accantonati)
  fornitoriWeekly?: number;
  fornitoriMonthly?: number;
  /**
   * Round 41: Totale fatture CUSTOM (periodo personalizzato) inserite oggi.
   * NON detratta da utile di oggi (è distribuita sui prossimi N giorni in
   * Statistiche), ma mostrata come riga informativa così l'utente vede
   * subito che la spesa è stata registrata.
   */
  fornitoriCustom?: number;
  invenduto: number;
  excludeInvenduto: boolean;
  toggleExcludeInvenduto: () => void;
  utile: number;
  lordo: number;
}

interface CategoryRowProps {
  label: string;
  icon: string;
  iconColor: string;
  value: number;
  excluded: boolean;
  onToggle: () => void;
  hint?: string;
}

const CategoryRow: React.FC<CategoryRowProps> = ({ label, icon, iconColor, value, excluded, onToggle, hint }) => (
  <View style={st.row}>
    <View style={st.rowIcon}>
      <Ionicons name={icon as any} size={20} color={excluded ? '#B0B0A0' : iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[st.rowLabel, excluded && st.rowDisabled]}>{label}</Text>
      <Text style={[st.rowVal, excluded && st.rowDisabled]}>
        {excluded ? 'Escluso dal calcolo' : `€${value.toFixed(0)}`}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 10, color: '#8A9595', fontStyle: 'italic', marginTop: 2 }}>{hint}</Text>
      ) : null}
    </View>
    <View style={st.rowRight}>
      <Text style={[st.rowAmount, { color: excluded ? '#B0B0A0' : '#D46A6A' }]}>
        {excluded ? '—' : `-€${value.toFixed(0)}`}
      </Text>
      <Switch
        value={!excluded}
        onValueChange={onToggle}
        trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
        thumbColor={!excluded ? '#1E7F85' : '#999'}
      />
    </View>
  </View>
);

export const UtileModal: React.FC<Props> = ({
  visible, onClose, speseFisse, excludeSpeseFisse, toggleExcludeSpeseFisse,
  collabCosto, excludeCollaboratori, toggleExcludeCollaboratori,
  speseExtra, excludeSpeseExtra, toggleExcludeSpeseExtra,
  fornitoriDaily, excludeFornitori, toggleExcludeFornitori,
  fornitoriWeekly = 0, fornitoriMonthly = 0, fornitoriCustom = 0,
  invenduto, excludeInvenduto, toggleExcludeInvenduto,
  utile, lordo,
}) => {
  const { t } = useTranslation();

  const totDeduzioni =
    (excludeSpeseFisse ? 0 : speseFisse) +
    (excludeCollaboratori ? 0 : collabCosto) +
    (excludeSpeseExtra ? 0 : speseExtra) +
    (excludeFornitori ? 0 : fornitoriDaily) +
    (excludeInvenduto ? 0 : invenduto);

  const categories = [
    {
      label: 'SPESE FISSE',
      icon: 'business-outline',
      iconColor: '#1E7F85',
      value: speseFisse,
      excluded: excludeSpeseFisse,
      onToggle: toggleExcludeSpeseFisse,
    },
    {
      label: 'COLLABORATORI',
      icon: 'people-outline',
      iconColor: '#E8A060',
      value: collabCosto,
      excluded: excludeCollaboratori,
      onToggle: toggleExcludeCollaboratori,
    },
    {
      label: 'FORNITORI',
      icon: 'storefront-outline',
      iconColor: '#7A5E9B',
      value: fornitoriDaily,
      excluded: excludeFornitori,
      onToggle: toggleExcludeFornitori,
      hint: (() => {
        const parts: string[] = [];
        if (fornitoriCustom > 0) {
          parts.push(`+ €${fornitoriCustom.toFixed(0)} accantonati (distribuiti su più giorni)`);
        }
        const wm = fornitoriWeekly + fornitoriMonthly;
        if (wm > 0 && fornitoriCustom === 0) {
          parts.push(`+ €${fornitoriWeekly} settim. + €${fornitoriMonthly} mens. scalati in Statistiche`);
        }
        return parts.length > 0 ? parts.join(' · ') : undefined;
      })(),
    },
    {
      label: 'SPESE EXTRA',
      icon: 'receipt-outline',
      iconColor: '#D46A6A',
      value: speseExtra,
      excluded: excludeSpeseExtra,
      onToggle: toggleExcludeSpeseExtra,
    },
    {
      label: 'INVENDUTO',
      icon: 'cube-outline',
      iconColor: '#8B5CF6',
      value: invenduto,
      excluded: excludeInvenduto,
      onToggle: toggleExcludeInvenduto,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.overlay}>
        <View style={st.container}>
          <View style={st.handle} />
          <View style={st.headerRow}>
            <Text style={st.title}>{t('home.profitDetail') || 'DETTAGLIO UTILE'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close-circle" size={28} color="#5A7575" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{(t('home.gross') || 'LORDO').toUpperCase()}</Text>
              <Text style={st.summaryGreen}>{'\u20AC'}{lordo.toFixed(0)}</Text>
            </View>
            <Text style={st.summaryMinus}>-</Text>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{(t('home.deductions') || 'DEDUZIONI').toUpperCase()}</Text>
              <Text style={st.summaryRed}>{'\u20AC'}{totDeduzioni.toFixed(0)}</Text>
            </View>
            <Text style={st.summaryEquals}>=</Text>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>UTILE</Text>
              <Text style={[st.summaryResult, { color: utile >= 0 ? '#1D8348' : '#D44' }]}>
                {'\u20AC'}{utile.toFixed(0)}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={st.sectionTitle}>CATEGORIE DI SPESA</Text>
            <Text style={st.sectionSub}>
              Attiva/disattiva intere categorie dal calcolo dell'utile
            </Text>

            {categories.map((cat: any) => (
              <CategoryRow
                key={cat.label}
                label={cat.label}
                icon={cat.icon}
                iconColor={cat.iconColor}
                value={cat.value}
                excluded={cat.excluded}
                onToggle={cat.onToggle}
                hint={cat.hint}
              />
            ))}

            {/* Riepilogo Deduzioni */}
            <View style={st.riepilogo}>
              <Text style={st.riepilogoTitle}>RIEPILOGO DEDUZIONI</Text>
              {categories.map((cat) => (
                <View key={cat.label} style={st.riepilogoRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[st.riepilogoDot, { backgroundColor: cat.excluded ? '#D0D0C8' : cat.iconColor }]} />
                    <Text style={[st.riepilogoLabel, cat.excluded && st.rowDisabled]}>
                      {cat.label}
                    </Text>
                  </View>
                  <Text style={[st.riepilogoVal, cat.excluded && st.rowDisabled]}>
                    {cat.excluded ? '€0.00' : `€${cat.value.toFixed(0)}`}
                  </Text>
                </View>
              ))}
              <View style={st.riepilogoDivider} />
              <View style={st.riepilogoRow}>
                <Text style={st.riepilogoTotalLabel}>TOTALE DEDUZIONI</Text>
                <Text style={st.riepilogoTotalVal}>{'\u20AC'}{totDeduzioni.toFixed(0)}</Text>
              </View>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: {
    flex: 1, backgroundColor: '#D8EDE5', marginTop: 80,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#B0C4BC',
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1.5 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 16,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 8, fontWeight: '700', color: '#7A9090', marginBottom: 2 },
  summaryGreen: { fontSize: 14, fontWeight: '900', color: '#1D8348' },
  summaryRed: { fontSize: 14, fontWeight: '900', color: '#D46A6A' },
  summaryResult: { fontSize: 16, fontWeight: '900' },
  summaryMinus: { fontSize: 20, fontWeight: '900', color: '#D46A6A', marginHorizontal: 6 },
  summaryEquals: { fontSize: 20, fontWeight: '900', color: '#5A7575', marginHorizontal: 6 },

  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: '#5A7575',
    letterSpacing: 1.5, marginTop: 8, marginBottom: 2,
  },
  sectionSub: {
    fontSize: 10, color: '#7A9090', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14,
    marginBottom: 10,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#D8EDE5', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: { fontSize: 12, fontWeight: '800', color: '#1A3535', letterSpacing: 0.8 },
  rowVal: { fontSize: 10, fontWeight: '600', color: '#5A7575', marginTop: 2 },
  rowDisabled: { color: '#B0B0A0', textDecorationLine: 'line-through' },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontSize: 13, fontWeight: '900' },

  riepilogo: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 16, marginTop: 12,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  riepilogoTitle: {
    fontSize: 10, fontWeight: '800', color: '#5A7575',
    letterSpacing: 1.5, marginBottom: 10,
  },
  riepilogoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  riepilogoDot: { width: 8, height: 8, borderRadius: 4 },
  riepilogoLabel: { fontSize: 11, fontWeight: '700', color: '#1A3535' },
  riepilogoVal: { fontSize: 11, fontWeight: '800', color: '#D46A6A' },
  riepilogoDivider: { height: 1, backgroundColor: '#C5DDD4', marginVertical: 8 },
  riepilogoTotalLabel: { fontSize: 12, fontWeight: '800', color: '#5A7575', letterSpacing: 1 },
  riepilogoTotalVal: { fontSize: 16, fontWeight: '900', color: '#1E7F85' },
});
