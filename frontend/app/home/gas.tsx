import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Carburante } from '../../src/store/appStore';
import { NeuBox, NeuInset } from '../../src/components/NeuBox';
import { CalendarModal } from '../../src/components/CalendarModal';
import { Colors } from '../../src/theme/colors';
import { formattaDataBreve } from '../../src/utils/dateUtils';

export default function GasScreen() {
  const {
    themeColor,
    storicoCarburante,
    storicoGiornate,
    addCarburante,
    removeCarburante,
  } = useAppStore();

  const activeColor = themeColor || Colors.primary;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [newDate, setNewDate] = useState(new Date());
  const [newEuro, setNewEuro] = useState('');

  // Calculate stats
  const totaleCarburante = storicoCarburante.reduce((sum, c) => sum + c.euro, 0);
  const totaleKm = storicoGiornate.reduce((sum, g) => sum + (g.km || 0), 0);
  const costoMedioKm = totaleKm > 0 ? totaleCarburante / totaleKm : 0;
  const numRifornimenti = storicoCarburante.length;

  const handleAddRifornimento = () => {
    const euro = parseFloat(newEuro.replace(',', '.'));
    if (!euro || euro <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }

    addCarburante({
      data: newDate,
      euro,
    });

    setNewEuro('');
    setShowAddModal(false);
    Alert.alert('Salvato!', 'Rifornimento registrato con successo');
  };

  const handleDelete = (item: Carburante) => {
    Alert.alert(
      'Elimina',
      'Sei sicuro di voler eliminare questo rifornimento?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => removeCarburante(item.data),
        },
      ]
    );
  };

  // Sort by date descending
  const sortedCarburante = [...storicoCarburante].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>CARBURANTE</Text>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <NeuBox style={styles.statCard}>
            <Ionicons name="speedometer" size={24} color={activeColor} />
            <Text style={[styles.statValue, { color: activeColor }]}>
              €{costoMedioKm.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>COSTO/KM</Text>
          </NeuBox>
          <NeuBox style={styles.statCard}>
            <Ionicons name="car" size={24} color={Colors.arancio} />
            <Text style={[styles.statValue, { color: Colors.arancio }]}>
              {totaleKm.toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>KM TOTALI</Text>
          </NeuBox>
        </View>

        {/* Total Summary */}
        <NeuBox style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>TOTALE SPESO</Text>
              <Text style={[styles.summaryValue, { color: activeColor }]}>
                €{totaleCarburante.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryCount}>{numRifornimenti}</Text>
              <Text style={styles.summaryLabel}>rifornimenti</Text>
            </View>
          </View>
        </NeuBox>

        {/* Add Button */}
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <NeuBox style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color={activeColor} />
            <Text style={[styles.addButtonText, { color: activeColor }]}>
              NUOVO RIFORNIMENTO
            </Text>
          </NeuBox>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.sectionTitle}>STORICO RIFORNIMENTI</Text>
        {sortedCarburante.length === 0 ? (
          <NeuBox style={styles.emptyCard}>
            <Ionicons name="car-outline" size={40} color={Colors.grey} />
            <Text style={styles.emptyText}>Nessun rifornimento registrato</Text>
            <Text style={styles.emptySubtext}>
              Aggiungi il tuo primo rifornimento
            </Text>
          </NeuBox>
        ) : (
          sortedCarburante.map((item, index) => (
            <NeuBox key={index} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <Ionicons name="calendar" size={20} color={activeColor} />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyDate}>
                    {formattaDataBreve(new Date(item.data))}
                  </Text>
                </View>
              </View>
              <View style={styles.historyRight}>
                <Text style={[styles.historyEuro, { color: activeColor }]}>
                  €{item.euro.toFixed(2)}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="trash" size={20} color={Colors.rosso} />
                </TouchableOpacity>
              </View>
            </NeuBox>
          ))
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuovo Rifornimento</Text>

            <TouchableOpacity onPress={() => setShowCalendar(true)}>
              <NeuInset style={styles.dateButton}>
                <Ionicons name="calendar" size={20} color={activeColor} />
                <Text style={styles.dateText}>
                  {formattaDataBreve(newDate)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.grey} />
              </NeuInset>
            </TouchableOpacity>

            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Importo €"
                placeholderTextColor={Colors.grey}
                value={newEuro}
                onChangeText={setNewEuro}
                keyboardType="numeric"
                style={styles.inputText}
              />
            </NeuInset>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setNewEuro('');
                }}
              >
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: activeColor }]}
                onPress={handleAddRifornimento}
              >
                <Text style={styles.saveButtonText}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => {
          setNewDate(date);
          setShowCalendar(false);
        }}
        initialDate={newDate}
        themeColor={activeColor}
        title="Data Rifornimento"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
    letterSpacing: 1.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
    marginTop: 5,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  summaryRight: {
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 15,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.grey,
    marginTop: 5,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyInfo: {
    gap: 2,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.marrone,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  historyEuro: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.marrone,
    textAlign: 'center',
    marginBottom: 20,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.marrone,
  },
  modalInput: {
    marginBottom: 20,
  },
  inputText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.marrone,
    padding: 5,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.grey,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
