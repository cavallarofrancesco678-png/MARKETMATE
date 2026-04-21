import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  selectedDates: string[]; // YYYY-MM-DD
  onToggleDate: (dateIso: string) => void;
  highlightedDates?: string[]; // altre date da evidenziare (es. oggi, eventi configurati)
  themeColor?: string;
  mode?: 'toggle' | 'view'; // toggle = click per selezionare; view = solo visualizzazione
};

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Lun
  const totalDays = lastDay.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export const MiniMonthCalendar: React.FC<Props> = ({
  selectedDates, onToggleDate, highlightedDates = [], themeColor = '#D4AF37', mode = 'toggle',
}) => {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const grid = buildGrid(viewMonth.getFullYear(), viewMonth.getMonth());
  const selSet = new Set(selectedDates);
  const hlSet = new Set(highlightedDates);

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={18} color={themeColor} />
        </TouchableOpacity>
        <Text style={[s.title, { color: themeColor }]}>
          {MESI[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={18} color={themeColor} />
        </TouchableOpacity>
      </View>

      <View style={s.dowRow}>
        {GIORNI.map((g, i) => (
          <Text key={i} style={s.dowTxt}>{g}</Text>
        ))}
      </View>

      {grid.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={s.cell} />;
            const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
            const iso = toIso(date);
            const isSelected = selSet.has(iso);
            const isHighlighted = hlSet.has(iso);
            const isToday = date.toDateString() === today.toDateString();
            return (
              <TouchableOpacity
                key={di}
                style={[
                  s.cell,
                  isSelected && { backgroundColor: themeColor },
                  !isSelected && isHighlighted && { backgroundColor: `${themeColor}33`, borderWidth: 1, borderColor: themeColor },
                  !isSelected && !isHighlighted && isToday && { borderWidth: 1, borderColor: themeColor },
                ]}
                disabled={mode === 'view'}
                onPress={() => onToggleDate(iso)}
                activeOpacity={0.6}
              >
                <Text style={[
                  s.dayTxt,
                  isSelected && { color: '#FFF', fontWeight: '900' },
                  !isSelected && isHighlighted && { color: themeColor, fontWeight: '800' },
                  isToday && !isSelected && { color: themeColor, fontWeight: '800' },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  root: { backgroundColor: '#FFF', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#E8EDE8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  title: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  dowRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4, borderBottomWidth: 1, borderColor: '#F0F4F0' },
  dowTxt: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '900', color: '#7A9090', letterSpacing: 0.5 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, margin: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  dayTxt: { fontSize: 11, color: '#1A4040' },
});
