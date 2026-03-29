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
import { useAppStore, Appunto } from '../../src/store/appStore';
import { NeuBox, NeuInset } from '../../src/components/NeuBox';
import { CalendarModal } from '../../src/components/CalendarModal';
import { Colors } from '../../src/theme/colors';
import { formattaDataIta, formattaDataBreve, isToday, isTomorrow, isSameDay } from '../../src/utils/dateUtils';

const GIORNI_SETTIMANA = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

export default function AgendaScreen() {
  const {
    themeColor,
    agenda,
    appuntiAgenda,
    addAppunto,
    removeAppunto,
  } = useAppStore();

  const activeColor = themeColor || Colors.primary;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAppuntoDate, setNewAppuntoDate] = useState(new Date());
  const [newAppuntoText, setNewAppuntoText] = useState('');
  const [showAppuntoCalendar, setShowAppuntoCalendar] = useState(false);

  // Get current week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Get market for selected day
  const getMarketForDate = (date: Date) => {
    const dayIndex = date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return agenda[adjustedIndex];
  };

  // Get appunti for date
  const getAppuntiForDate = (date: Date) => {
    return appuntiAgenda.filter((a) => isSameDay(new Date(a.data), date));
  };

  const selectedMarket = getMarketForDate(selectedDate);
  const selectedAppunti = getAppuntiForDate(selectedDate);

  // Upcoming appunti
  const upcomingAppunti = appuntiAgenda
    .filter((a) => new Date(a.data) >= new Date())
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 5);

  const handleAddAppunto = () => {
    if (!newAppuntoText.trim()) {
      Alert.alert('Errore', 'Inserisci un testo per l\'appunto');
      return;
    }

    addAppunto({
      data: newAppuntoDate,
      testo: newAppuntoText,
    });

    setNewAppuntoText('');
    setShowAddModal(false);
    Alert.alert('Salvato!', 'Appunto aggiunto con successo');
  };

  const handleDeleteAppunto = (appunto: Appunto) => {
    Alert.alert(
      'Elimina',
      'Sei sicuro di voler eliminare questo appunto?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => removeAppunto(appunto.data, appunto.testo),
        },
      ]
    );
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction * 7);
    setSelectedDate(newDate);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>AGENDA</Text>

        {/* Week Navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => navigateWeek(-1)}>
            <Ionicons name="chevron-back" size={24} color={activeColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCalendar(true)}>
            <Text style={styles.monthText}>
              {selectedDate.toLocaleDateString('it-IT', {
                month: 'long',
                year: 'numeric',
              }).toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateWeek(1)}>
            <Ionicons name="chevron-forward" size={24} color={activeColor} />
          </TouchableOpacity>
        </View>

        {/* Week Days */}
        <NeuBox style={styles.weekContainer}>
          {weekDates.map((date, index) => {
            const market = getMarketForDate(date);
            const isSelected = isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const hasAppunti = getAppuntiForDate(date).length > 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayColumn,
                  isSelected && { backgroundColor: `${activeColor}20` },
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dayName,
                    market?.lavorativo && { color: activeColor },
                  ]}
                >
                  {GIORNI_SETTIMANA[index]}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    isTodayDate && { backgroundColor: activeColor },
                    isSelected && !isTodayDate && styles.dayCircleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isTodayDate && { color: Colors.white },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {hasAppunti && (
                  <View style={[styles.appuntoDot, { backgroundColor: Colors.rosso }]} />
                )}
                {market?.lavorativo && (
                  <View style={[styles.marketDot, { backgroundColor: activeColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </NeuBox>

        {/* Selected Day Details */}
        <NeuBox style={styles.dayDetails}>
          <Text style={[styles.dayDetailsDate, { color: activeColor }]}>
            {formattaDataIta(selectedDate).toUpperCase()}
          </Text>

          {selectedMarket?.lavorativo ? (
            <View style={styles.marketInfo}>
              <Ionicons name="storefront" size={20} color={activeColor} />
              <View style={styles.marketText}>
                <Text style={styles.marketName}>
                  {selectedMarket.mercato || 'Mercato'}
                </Text>
                <Text style={styles.marketDetails}>
                  {selectedMarket.km} km | Plat: €{selectedMarket.p_giornaliero}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.offDay}>
              <Ionicons name="moon" size={20} color={Colors.grey} />
              <Text style={styles.offDayText}>Giorno di riposo</Text>
            </View>
          )}

          {/* Appunti for selected day */}
          {selectedAppunti.length > 0 && (
            <View style={styles.appuntiSection}>
              <Text style={styles.appuntiTitle}>APPUNTI</Text>
              {selectedAppunti.map((a, i) => (
                <View key={i} style={styles.appuntoItem}>
                  <Ionicons name="document-text" size={16} color={activeColor} />
                  <Text style={styles.appuntoText}>{a.testo}</Text>
                  <TouchableOpacity onPress={() => handleDeleteAppunto(a)}>
                    <Ionicons name="close-circle" size={18} color={Colors.rosso} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </NeuBox>

        {/* Add Appunto Button */}
        <TouchableOpacity onPress={() => {
          setNewAppuntoDate(selectedDate);
          setShowAddModal(true);
        }}>
          <NeuBox style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color={activeColor} />
            <Text style={[styles.addButtonText, { color: activeColor }]}>
              NUOVO APPUNTO
            </Text>
          </NeuBox>
        </TouchableOpacity>

        {/* Upcoming */}
        <Text style={styles.sectionTitle}>PROSSIMI APPUNTAMENTI</Text>
        {upcomingAppunti.length === 0 ? (
          <NeuBox style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={40} color={Colors.grey} />
            <Text style={styles.emptyText}>Nessun appuntamento in programma</Text>
          </NeuBox>
        ) : (
          upcomingAppunti.map((a, i) => {
            const appDate = new Date(a.data);
            const label = isToday(appDate) ? 'OGGI' : isTomorrow(appDate) ? 'DOMANI' : null;

            return (
              <NeuBox key={i} style={styles.upcomingItem}>
                <View style={styles.upcomingLeft}>
                  {label ? (
                    <View style={[styles.labelBadge, { backgroundColor: activeColor }]}>
                      <Text style={styles.labelText}>{label}</Text>
                    </View>
                  ) : (
                    <Text style={styles.upcomingDate}>
                      {formattaDataBreve(appDate)}
                    </Text>
                  )}
                </View>
                <Text style={styles.upcomingText}>{a.testo}</Text>
              </NeuBox>
            );
          })
        )}

        {/* Weekly Overview */}
        <Text style={styles.sectionTitle}>SETTIMANA TIPO</Text>
        <NeuBox style={styles.weeklyOverview}>
          {agenda.map((m, i) => (
            <View key={i} style={styles.weeklyRow}>
              <Text style={[
                styles.weeklyDay,
                m.lavorativo && { color: activeColor, fontWeight: 'bold' },
              ]}>
                {m.giorno}
              </Text>
              <Text style={styles.weeklyMarket}>
                {m.lavorativo ? m.mercato || 'Mercato' : '-'}
              </Text>
              {m.lavorativo && (
                <Ionicons name="checkmark-circle" size={16} color={Colors.verde} />
              )}
            </View>
          ))}
        </NeuBox>
      </ScrollView>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => {
          setSelectedDate(date);
          setShowCalendar(false);
        }}
        initialDate={selectedDate}
        themeColor={activeColor}
      />

      {/* Add Appunto Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuovo Appunto</Text>

            <TouchableOpacity onPress={() => setShowAppuntoCalendar(true)}>
              <NeuInset style={styles.dateButton}>
                <Ionicons name="calendar" size={20} color={activeColor} />
                <Text style={styles.dateText}>
                  {formattaDataBreve(newAppuntoDate)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.grey} />
              </NeuInset>
            </TouchableOpacity>

            <NeuInset style={styles.textInputContainer}>
              <TextInput
                placeholder="Descrizione appunto..."
                placeholderTextColor={Colors.grey}
                value={newAppuntoText}
                onChangeText={setNewAppuntoText}
                style={styles.textInput}
                multiline
                numberOfLines={3}
              />
            </NeuInset>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setNewAppuntoText('');
                }}
              >
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: activeColor }]}
                onPress={handleAddAppunto}
              >
                <Text style={styles.saveButtonText}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>

      {/* Appunto Date Calendar */}
      <CalendarModal
        visible={showAppuntoCalendar}
        onClose={() => setShowAppuntoCalendar(false)}
        onSelect={(date) => {
          setNewAppuntoDate(date);
          setShowAppuntoCalendar(false);
        }}
        initialDate={newAppuntoDate}
        themeColor={activeColor}
        title="Data Appunto"
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
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  monthText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  weekContainer: {
    flexDirection: 'row',
    padding: 5,
    marginBottom: 20,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  dayName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 5,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: Colors.marrone,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  appuntoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  marketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  dayDetails: {
    marginBottom: 20,
  },
  dayDetailsDate: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  marketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketText: {
    flex: 1,
  },
  marketName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  marketDetails: {
    fontSize: 12,
    color: Colors.grey,
  },
  offDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offDayText: {
    fontSize: 14,
    color: Colors.grey,
  },
  appuntiSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.bgDark,
  },
  appuntiTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 10,
  },
  appuntoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  appuntoText: {
    flex: 1,
    fontSize: 14,
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
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.grey,
    marginTop: 10,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 10,
  },
  upcomingLeft: {
    width: 70,
  },
  labelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  upcomingDate: {
    fontSize: 12,
    color: Colors.grey,
  },
  upcomingText: {
    flex: 1,
    fontSize: 14,
    color: Colors.marrone,
  },
  weeklyOverview: {
    marginBottom: 20,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgDark,
  },
  weeklyDay: {
    width: 90,
    fontSize: 12,
    color: Colors.grey,
  },
  weeklyMarket: {
    flex: 1,
    fontSize: 14,
    color: Colors.marrone,
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
  textInputContainer: {
    marginBottom: 20,
  },
  textInput: {
    fontSize: 16,
    color: Colors.marrone,
    padding: 5,
    minHeight: 80,
    textAlignVertical: 'top',
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
