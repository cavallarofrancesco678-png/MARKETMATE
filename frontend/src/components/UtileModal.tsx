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

interface SpesaItem {
  nome: string;
  valore: number;
  attivo: boolean;
  tipo: string; // 'fissa' | 'collab' | 'extra' | 'invenduto'
}

interface Props {
  visible: boolean;
  onClose: () => void;
  speseFisse: number;
  speseFisseItems: { voce: string; importo: number }[];
  speseFisseDisabilitate: Record<string, boolean>;
  toggleSpesaFissa: (voce: string) => void;
  collabCosts: { nome: string; costo: number; attivo: boolean }[];
  toggleCollab: (nome: string) => void;
  speseExtra: number;
  excludeSpeseExtra: boolean;
  toggleExcludeSpeseExtra: () => void;
  invenduto: number;
  excludeInvenduto: boolean;
  toggleExcludeInvenduto: () => void;
  utile: number;
  lordo: number;
  costoCarburante?: number;
}

export const UtileModal: React.FC<Props> = ({
  visible, onClose, speseFisse, speseFisseItems, speseFisseDisabilitate,
  toggleSpesaFissa, collabCosts, toggleCollab, speseExtra,
  excludeSpeseExtra, toggleExcludeSpeseExtra, invenduto,
  excludeInvenduto, toggleExcludeInvenduto, utile, lordo,
  costoCarburante = 0,
}) => {
  const { t } = useTranslation();
  const totDeduzioni = speseFisse +
    collabCosts.filter((c) => c.attivo).reduce((s, c) => s + c.costo, 0) +
    (excludeSpeseExtra ? 0 : speseExtra) +
    (excludeInvenduto ? 0 : invenduto) +
    costoCarburante;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.overlay}>
        <View style={st.container}>
          <View style={st.handle} />
          <View style={st.headerRow}>
            <Text style={st.title}>{t('home.profitDetail')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#5A7575" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{t('home.gross').toUpperCase()}</Text>
              <Text style={st.summaryGreen}>{'\u20AC'}{lordo.toFixed(2)}</Text>
            </View>
            <Text style={st.summaryMinus}>-</Text>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{t('home.deductions').toUpperCase()}</Text>
              <Text style={st.summaryRed}>{'\u20AC'}{totDeduzioni.toFixed(2)}</Text>
            </View>
            <Text style={st.summaryEquals}>=</Text>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>UTILE</Text>
              <Text style={[st.summaryResult, { color: utile >= 0 ? '#1D8348' : '#D44' }]}>{'\u20AC'}{utile.toFixed(2)}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Spese Fisse */}
            <Text style={st.sectionTitle}>SPESE FISSE GIORNALIERE</Text>
            {speseFisseItems.map((sp) => {
              const dailyVal = sp.importo / 365;
              const disabled = speseFisseDisabilitate[sp.voce];
              return (
                <View key={sp.voce} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.rowLabel, disabled && st.rowDisabled]}>{sp.voce}</Text>
                    <Text style={[st.rowVal, disabled && st.rowDisabled]}>{'\u20AC'}{dailyVal.toFixed(2)}/gg</Text>
                  </View>
                  <Switch
                    value={!disabled}
                    onValueChange={() => toggleSpesaFissa(sp.voce)}
                    trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
                    thumbColor={!disabled ? '#1E7F85' : '#999'}
                  />
                </View>
              );
            })}

            {/* Collaboratori */}
            {collabCosts.length > 0 && (
              <>
                <Text style={st.sectionTitle}>COLLABORATORI</Text>
                {collabCosts.map((c) => (
                  <View key={c.nome} style={st.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowLabel, !c.attivo && st.rowDisabled]}>{c.nome}</Text>
                      <Text style={[st.rowVal, !c.attivo && st.rowDisabled]}>{'\u20AC'}{c.costo.toFixed(2)}/gg</Text>
                    </View>
                    <Switch
                      value={c.attivo}
                      onValueChange={() => toggleCollab(c.nome)}
                      trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
                      thumbColor={c.attivo ? '#1E7F85' : '#999'}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Spese Extra */}
            <Text style={st.sectionTitle}>SPESE EXTRA</Text>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={[st.rowLabel, excludeSpeseExtra && st.rowDisabled]}>Spese Extra Giornaliere</Text>
                <Text style={[st.rowVal, excludeSpeseExtra && st.rowDisabled]}>{'\u20AC'}{speseExtra.toFixed(2)}</Text>
              </View>
              <Switch
                value={!excludeSpeseExtra}
                onValueChange={toggleExcludeSpeseExtra}
                trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
                thumbColor={!excludeSpeseExtra ? '#1E7F85' : '#999'}
              />
            </View>

            {/* Invenduto */}
            <Text style={st.sectionTitle}>INVENDUTO</Text>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={[st.rowLabel, excludeInvenduto && st.rowDisabled]}>Totale Invenduto</Text>
                <Text style={[st.rowVal, excludeInvenduto && st.rowDisabled]}>{'\u20AC'}{invenduto.toFixed(2)}</Text>
              </View>
              <Switch
                value={!excludeInvenduto}
                onValueChange={toggleExcludeInvenduto}
                trackColor={{ false: '#D0D0C8', true: '#A5D8D0' }}
                thumbColor={!excludeInvenduto ? '#1E7F85' : '#999'}
              />
            </View>

            {/* Carburante */}
            {costoCarburante > 0 && (
              <>
                <Text style={st.sectionTitle}>{t('stats.fuelCost').toUpperCase()}</Text>
                <View style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowLabel}>{t('stats.fuelCost')}</Text>
                    <Text style={st.rowVal}>{'\u20AC'}{costoCarburante.toFixed(2)}</Text>
                  </View>
                  <Ionicons name="car-outline" size={20} color="#E8A060" />
                </View>
              </>
            )}

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
    letterSpacing: 1.5, marginTop: 16, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 12, padding: 14,
    marginBottom: 8,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.4), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  rowLabel: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
  rowVal: { fontSize: 11, fontWeight: '600', color: '#5A7575', marginTop: 2 },
  rowDisabled: { color: '#B0B0A0', textDecorationLine: 'line-through' },
});
