import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { NeuBox } from './NeuBox';

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];
const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  initialDate: Date;
  themeColor: string;
  title?: string;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  onSelect,
  initialDate,
  themeColor,
  title,
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMonth, setViewMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
  };

  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    setSelectedDate(newDate);
    onSelect(newDate);
    onClose();
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(viewMonth.getFullYear(), viewMonth.getMonth());
    const firstDay = getFirstDayOfMonth(viewMonth.getFullYear(), viewMonth.getMonth());
    const today = new Date();
    
    const cells = [];
    
    // Empty cells before first day
    for (let i = 1; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const isSelected = 
        cellDate.getDate() === selectedDate.getDate() &&
        cellDate.getMonth() === selectedDate.getMonth() &&
        cellDate.getFullYear() === selectedDate.getFullYear();
      const isToday = 
        cellDate.getDate() === today.getDate() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear();
      
      cells.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isSelected && { backgroundColor: themeColor },
            isToday && !isSelected && { backgroundColor: `${themeColor}30` },
          ]}
          onPress={() => handleSelectDay(day)}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && { color: Colors.white, fontWeight: 'bold' },
              isToday && !isSelected && { color: themeColor, fontWeight: 'bold' },
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }
    
    return cells;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <NeuBox style={styles.container} borderRadius={20} padding={20}>
          {title && (
            <Text style={[styles.title, { color: themeColor }]}>{title}</Text>
          )}
          
          <View style={styles.header}>
            <TouchableOpacity onPress={handlePrevMonth}>
              <Ionicons name="chevron-back" size={24} color={themeColor} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MESI[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={handleNextMonth}>
              <Ionicons name="chevron-forward" size={24} color={themeColor} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.weekDays}>
            {GIORNI.map((g, i) => (
              <Text key={i} style={styles.weekDayText}>{g}</Text>
            ))}
          </View>
          
          <View style={styles.daysGrid}>
            {renderCalendarDays()}
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, { color: themeColor }]}>CHIUDI</Text>
          </TouchableOpacity>
        </NeuBox>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const cellSize = (width - 100) / 7;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 350,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  monthText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    width: cellSize,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: cellSize,
    height: cellSize,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: cellSize / 2,
    margin: 1,
  },
  dayText: {
    fontSize: 13,
    color: Colors.marrone,
  },
  closeButton: {
    marginTop: 15,
    alignSelf: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
