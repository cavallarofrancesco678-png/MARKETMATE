import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

type ViewMode = 'days' | 'months' | 'years';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  initialDate: Date;
  themeColor?: string;
  title?: string;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  onSelect,
  initialDate,
  themeColor = '#1E7F85',
  title,
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMonth, setViewMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor(initialDate.getFullYear() / 12) * 12
  );

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate);
      setViewMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
      setViewMode('days');
      setYearRangeStart(Math.floor(initialDate.getFullYear() / 12) * 12);
    }
  }, [visible]);

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 7 : day;
  };

  const handlePrev = () => {
    if (viewMode === 'days') {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    } else if (viewMode === 'months') {
      setViewMonth(new Date(viewMonth.getFullYear() - 1, viewMonth.getMonth(), 1));
    } else {
      setYearRangeStart(yearRangeStart - 12);
    }
  };

  const handleNext = () => {
    if (viewMode === 'days') {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    } else if (viewMode === 'months') {
      setViewMonth(new Date(viewMonth.getFullYear() + 1, viewMonth.getMonth(), 1));
    } else {
      setYearRangeStart(yearRangeStart + 12);
    }
  };

  const handleHeaderTap = () => {
    if (viewMode === 'days') setViewMode('months');
    else if (viewMode === 'months') setViewMode('years');
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    setSelectedDate(newDate);
    onSelect(newDate);
  };

  const handleSelectMonth = (month: number) => {
    setViewMonth(new Date(viewMonth.getFullYear(), month, 1));
    setViewMode('days');
  };

  const handleSelectYear = (year: number) => {
    setViewMonth(new Date(year, viewMonth.getMonth(), 1));
    setViewMode('months');
  };

  const today = new Date();

  const headerText =
    viewMode === 'days'
      ? `${MESI[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
      : viewMode === 'months'
      ? `${viewMonth.getFullYear()}`
      : `${yearRangeStart} - ${yearRangeStart + 11}`;

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(viewMonth.getFullYear(), viewMonth.getMonth());
    const firstDay = getFirstDayOfMonth(viewMonth.getFullYear(), viewMonth.getMonth());
    const cells = [];

    for (let i = 1; i < firstDay; i++) {
      cells.push(<View key={`e-${i}`} style={cs.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const isSel =
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
      const isT =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      cells.push(
        <TouchableOpacity
          key={day}
          style={[
            cs.dayCell,
            isSel && { backgroundColor: themeColor },
            isT && !isSel && { backgroundColor: `${themeColor}25` },
          ]}
          onPress={() => handleSelectDay(day)}
        >
          <Text
            style={[
              cs.dayText,
              isSel && { color: '#FFF', fontWeight: '800' },
              isT && !isSel && { color: themeColor, fontWeight: '800' },
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }
    return cells;
  };

  const renderMonths = () => (
    <View style={cs.gridWrap}>
      {MESI_SHORT.map((m, i) => {
        const isCurrent = i === viewMonth.getMonth();
        return (
          <TouchableOpacity
            key={i}
            style={[cs.gridCell, isCurrent && { backgroundColor: themeColor }]}
            onPress={() => handleSelectMonth(i)}
          >
            <Text style={[cs.gridCellText, isCurrent && { color: '#FFF' }]}>
              {m}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderYears = () => (
    <View style={cs.gridWrap}>
      {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((y) => {
        const isCurrent = y === viewMonth.getFullYear();
        return (
          <TouchableOpacity
            key={y}
            style={[cs.gridCell, isCurrent && { backgroundColor: themeColor }]}
            onPress={() => handleSelectYear(y)}
          >
            <Text style={[cs.gridCellText, isCurrent && { color: '#FFF' }]}>
              {y}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <View style={cs.container}>
          {title && (
            <Text style={[cs.title, { color: themeColor }]}>{title}</Text>
          )}

          {/* Header with navigation */}
          <View style={cs.header}>
            <TouchableOpacity onPress={handlePrev} style={cs.navBtn}>
              <Ionicons name="chevron-back" size={22} color={themeColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleHeaderTap}>
              <Text style={cs.headerText}>{headerText}</Text>
              <Text style={cs.headerHint}>
                {viewMode === 'days'
                  ? 'Tocca per mesi'
                  : viewMode === 'months'
                  ? 'Tocca per anni'
                  : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={cs.navBtn}>
              <Ionicons name="chevron-forward" size={22} color={themeColor} />
            </TouchableOpacity>
          </View>

          {/* Days view */}
          {viewMode === 'days' && (
            <>
              <View style={cs.weekRow}>
                {GIORNI.map((g, i) => (
                  <Text key={i} style={cs.weekDay}>
                    {g}
                  </Text>
                ))}
              </View>
              <View style={cs.daysGrid}>{renderDays()}</View>
            </>
          )}

          {/* Months view */}
          {viewMode === 'months' && renderMonths()}

          {/* Years view */}
          {viewMode === 'years' && renderYears()}

          {/* Close button */}
          <TouchableOpacity
            style={[cs.closeBtn, { backgroundColor: themeColor }]}
            onPress={onClose}
          >
            <Text style={cs.closeBtnText}>CHIUDI</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const cellSize = Math.min((width - 100) / 7, 42);

const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#F0EDE5',
    borderRadius: 22,
    padding: 20,
    // @ts-ignore
    boxShadow: '0px 8px 30px rgba(0,0,0,0.25)',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A3535',
    textAlign: 'center',
  },
  headerHint: {
    fontSize: 9,
    color: '#7A9090',
    textAlign: 'center',
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A9090',
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
  },
  dayText: {
    fontSize: 13,
    color: '#1A3535',
    fontWeight: '600',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  gridCell: {
    width: '28%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#E0DBC8',
    alignItems: 'center',
    // @ts-ignore
    boxShadow:
      '2px 2px 6px rgba(155,145,125,0.35), -2px -2px 5px rgba(255,255,250,0.7)',
  },
  gridCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3535',
  },
  closeBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
