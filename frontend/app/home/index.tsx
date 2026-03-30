import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const { width: SW } = Dimensions.get('window');

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const METEO = [
  { icon: 'sunny', label: 'SOLE' },
  { icon: 'partly-sunny', label: 'VAR' },
  { icon: 'rainy', label: 'PIOGGIA' },
  { icon: 'thunderstorm', label: 'TEMP' },
  { icon: 'wind', label: 'VENTO' },
];

// Custom Wind Icon SVG
const WindIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 8h10a3 3 0 1 0-3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 12h14a3 3 0 1 1-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 16h7a3 3 0 1 1-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata } = useAppStore();

  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenze, setPresenze] = useState<Record<string, boolean>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [speseExtra, setSpeseExtra] = useState('');
  const [invenduto, setInvenduto] = useState('');
  const [chiedi, setChiedi] = useState('');

  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? 'Fiera' : (mercatoOggi?.mercato || 'Magenta');
  const giorno = GIORNI[dataCorrente.getDay()];
  const data = `${dataCorrente.getDate()} ${MESI[dataCorrente.getMonth()]}`;

  useEffect(() => {
    const p: Record<string, boolean> = {};
    collaboratori.forEach(c => { p[c.nome] = false; });
    setPresenze(p);
  }, [collaboratori]);

  const speseFisse = (() => {
    const gg = agenda.filter(m => m.lavorativo).length || 6;
    const tot = speseAnnue.reduce((s, x) => s + x.importo, 0) + agenda.reduce((s, m) => s + m.p_annuo, 0);
    return tot / (48 * gg);
  })();

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const speseExtraNum = parseFloat(speseExtra.replace(',', '.')) || 0;
  const invendutoNum = parseFloat(invenduto.replace(',', '.')) || 0;
  const utile = lordoNum - speseFisse - speseExtraNum - invendutoNum;

  const collabNames = collaboratori.length > 0 ? collaboratori.map(c => c.nome) : ['DAVIDE', 'ANTONIO', 'NICOLÒ'];

  // Mock storico
  const incassoTotale = 44130;
  const mediaScontrino = 18.50;
  const deltaPercent = 14;

  // Date navigation
  const changeDate = (offset: number) => {
    const d = new Date(dataCorrente);
    d.setDate(d.getDate() + offset);
    setDataCorrente(d);
  };

  // Save handler
  const handleSalva = () => {
    const giornata = {
      data: dataCorrente,
      mercato: mercatoNome,
      meteo,
      km: mercatoOggi?.km || 0,
      lordo: lordoNum,
      netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraNum,
      dettaglio_staff: presenze,
      dettaglio_invenduto: { totale: invendutoNum },
      dettaglio_fornitori: {},
    };
    salvaGiornata(giornata as any);
  };

  // Mini charts
  const MiniLineChart = () => (
    <Svg width="55" height="32" viewBox="0 0 55 32">
      <Path d="M2 26 Q12 24 16 16 T28 20 T40 12 T53 6" stroke="#4A9AB0" strokeWidth="2" fill="none" />
      <Path d="M2 30 Q14 28 20 24 T34 26 T46 20 T53 16" stroke="#E8A060" strokeWidth="1.5" fill="none" />
    </Svg>
  );

  const MiniBarChart = () => (
    <Svg width="50" height="32" viewBox="0 0 50 32">
      <Rect x="2" y="18" width="6" height="14" fill="#5ABAB5" rx="2" />
      <Rect x="10" y="22" width="6" height="10" fill="#E8A060" rx="2" />
      <Rect x="18" y="14" width="6" height="18" fill="#5ABAB5" rx="2" />
      <Rect x="26" y="10" width="6" height="22" fill="#E8A060" rx="2" />
      <Rect x="34" y="6" width="6" height="26" fill="#5ABAB5" rx="2" />
      <Rect x="42" y="12" width="6" height="20" fill="#E8A060" rx="2" />
    </Svg>
  );

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.headerBadges}>
          <View style={s.aziendaBadge}>
            <Text style={s.aziendaText}>Nome</Text>
            <Text style={s.aziendaText}>Azienda</Text>
          </View>
          <View style={s.bellCircle}>
            <Ionicons name="notifications" size={14} color="#FFF" />
            <View style={s.bellDot} />
          </View>
        </View>
      </View>

      {/* DATE ROW - CLICKABLE */}
      <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
        <View style={s.dateRow}>
          <TouchableOpacity onPress={() => changeDate(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={16} color="#3A6A6A" />
          </TouchableOpacity>
          <View style={s.dateCenter}>
            <Ionicons name="calendar-outline" size={13} color="#3A6A6A" />
            <Text style={s.dateText}>{giorno} {data} - {mercatoNome}</Text>
          </View>
          <TouchableOpacity onPress={() => changeDate(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={16} color="#3A6A6A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazzaBadge, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaText}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* TOGGLE MERCATO / FIERA */}
      <View style={s.toggleRow}>
        <TouchableOpacity style={s.toggleWrap} onPress={() => setIsFiera(false)}>
          <View style={[s.toggleBtn, !isFiera && s.toggleActive]}>
            <Text style={[s.toggleText, !isFiera && s.toggleTextActive]}>Mercato</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.toggleWrap} onPress={() => setIsFiera(true)}>
          <View style={[s.toggleBtn, isFiera && s.toggleActive]}>
            <Text style={[s.toggleText, isFiera && s.toggleTextActive]}>Fiera</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* WEATHER ICONS */}
      <View style={s.meteoRow}>
        {METEO.map((m, i) => (
          <TouchableOpacity key={i} onPress={() => setMeteo(m.label)} activeOpacity={0.7}>
            <View style={[s.meteoSphere, meteo === m.label && s.meteoActive]}>
              <View style={s.meteoShine} />
              {m.icon === 'wind' ? (
                <WindIcon color={meteo === m.label ? '#FFFFFF' : '#2A4A5A'} size={22} />
              ) : (
                <Ionicons name={m.icon as any} size={22} color={meteo === m.label ? '#FFFFFF' : '#2A4A5A'} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* COLLABORATORI */}
      <Text style={s.sectionTitle}>COLLABORATORI</Text>
      <View style={s.collabRow}>
        {collabNames.map((name, i) => (
          <TouchableOpacity key={i} onPress={() => setPresenze(p => ({ ...p, [name]: !p[name] }))}>
            <View style={[s.collabPill, presenze[name] && s.collabPillActive]}>
              <Text style={[s.collabText, presenze[name] && s.collabTextActive]}>{name.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* DATA GRID */}
      <View style={s.dataGrid}>
        <View style={s.dataRow}>
          <View style={s.dataCard}><Text style={s.dataLabelBold}>LORDO</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={lordo} onChangeText={setLordo} /></View>
          <View style={s.dataCard}><Text style={s.dataLabelBold}>UTILE</Text><Text style={[s.dataValueBold, { color: utile >= 0 ? '#3A8A6A' : '#D55' }]}>€{utile.toFixed(2)}</Text></View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}><Text style={s.dataLabel}>CONTANTI</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={contanti} onChangeText={setContanti} /></View>
          <View style={s.dataCard}><Text style={s.dataLabel}>POSS</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={pos} onChangeText={setPos} /></View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}><Text style={s.dataLabel}>SPESE EXTRA</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} /></View>
          <View style={s.dataCard}><Text style={s.dataLabel}>SPESE FISSE</Text><Text style={s.dataValue}>€{speseFisse.toFixed(2)}</Text></View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}><Text style={s.dataLabel}>INVENDUTO</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} /></View>
          <View style={s.dataCard}><Text style={s.dataLabel}>CHIEDI</Text><TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={chiedi} onChangeText={setChiedi} /></View>
        </View>
      </View>

      {/* BOTTOM SECTION */}
      <View>
        {/* GRAFICO CARD - Storico Mercato */}
        <TouchableOpacity activeOpacity={0.85} style={s.graficoCard}>
          <View style={s.graficoLeft}><MiniLineChart /></View>
          <View style={s.graficoCenter}>
            <Text style={s.graficoTitle}>STORICO MERCATO</Text>
            <Text style={s.graficoDayTitle}>del {giorno}</Text>
            <Text style={s.graficoTotal}>€{incassoTotale.toLocaleString('it-IT')} <Text style={s.graficoDelta}>(+{deltaPercent}%)</Text></Text>
            <Text style={s.graficoMedia}>Media scontrino: €{mediaScontrino.toFixed(2)}</Text>
          </View>
          <View style={s.graficoRight}><MiniBarChart /></View>
        </TouchableOpacity>

        {/* SALVA BUTTON */}
        <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salvaBtn}>
          <Ionicons name="save-outline" size={16} color="#FFF" />
          <Text style={s.salvaText}>SALVA GIORNATA</Text>
        </TouchableOpacity>
      </View>

      {/* Simple Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} onPress={() => setShowDatePicker(false)} activeOpacity={1}>
          <View style={s.datePickerCard}>
            <Text style={s.datePickerTitle}>Seleziona Data</Text>
            <View style={s.datePickerGrid}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - 3 + i);
                const isSelected = d.toDateString() === dataCorrente.toDateString();
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setDataCorrente(new Date(d)); setShowDatePicker(false); }}
                    style={[s.datePickerDay, isSelected && s.datePickerDayActive]}
                  >
                    <Text style={[s.datePickerDayName, isSelected && { color: '#FFF' }]}>
                      {GIORNI[d.getDay()].substring(0, 3)}
                    </Text>
                    <Text style={[s.datePickerDayNum, isSelected && { color: '#FFF' }]}>
                      {d.getDate()}
                    </Text>
                    {isToday && <View style={s.todayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={s.datePickerClose}>
              <Text style={s.datePickerCloseText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D5ECE5',
    paddingHorizontal: 14,
    paddingTop: 40,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  marketName: { fontSize: 24, fontWeight: '900', color: '#1A4A4A', letterSpacing: 1.5, flex: 1, textAlign: 'center' },
  headerBadges: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  aziendaBadge: { backgroundColor: '#2A6A6A', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  aziendaText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  bellCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2A6A6A', justifyContent: 'center', alignItems: 'center' },
  bellDot: { position: 'absolute', top: 4, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#E55' },

  // Date row
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 5 },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, fontWeight: '600', color: '#2A5A5A' },
  piazzaBadge: { backgroundColor: '#2A6A6A', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  piazzaText: { color: '#FFF', fontSize: 8, fontWeight: '700' },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  toggleWrap: { flex: 1 },
  toggleBtn: {
    backgroundColor: '#E5DBC8',
    borderRadius: 26,
    paddingVertical: 9,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(170,155,135,0.5), -2px -2px 6px rgba(255,255,255,0.8)',
  },
  toggleActive: {
    backgroundColor: '#1E5A5A',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(20,55,55,0.6), -2px -2px 5px rgba(50,90,90,0.3)',
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#5A4A3A' },
  toggleTextActive: { color: '#FFF' },

  // Weather
  meteoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4, paddingHorizontal: 4 },
  meteoSphere: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#8AAFC0',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(60,95,110,0.5), -3px -3px 8px rgba(180,215,230,0.7)',
  },
  meteoActive: {
    backgroundColor: '#3A7A8A',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(30,60,70,0.6), -2px -2px 5px rgba(70,130,150,0.4)',
  },
  meteoShine: { position: 'absolute', top: 3, left: 5, right: 5, height: 12, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 10 },

  // Section
  sectionTitle: { fontSize: 9, fontWeight: '700', color: '#5A7A7A', textAlign: 'center', marginBottom: 4, letterSpacing: 2 },

  // Collaboratori
  collabRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  collabPill: {
    backgroundColor: '#E5DBC8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7,
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(170,155,135,0.5), -2px -2px 6px rgba(255,255,255,0.8)',
  },
  collabPillActive: {
    backgroundColor: '#1E5A5A',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(20,55,55,0.5)',
  },
  collabText: { fontSize: 10, fontWeight: '700', color: '#4A3A2A' },
  collabTextActive: { color: '#FFF' },

  // Data grid
  dataGrid: { gap: 6, marginBottom: 8 },
  dataRow: { flexDirection: 'row', gap: 6 },
  dataCard: {
    flex: 1,
    backgroundColor: '#F0E8DA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(170,155,135,0.4), -3px -3px 7px rgba(255,255,255,0.85)',
  },
  dataLabel: { fontSize: 10, fontWeight: '600', color: '#4A5A5A' },
  dataLabelBold: { fontSize: 12, fontWeight: '800', color: '#1A3A3A' },
  dataInput: { fontSize: 12, fontWeight: '700', color: '#1A3A3A', textAlign: 'right', minWidth: 60, padding: 0, margin: 0 },
  dataValue: { fontSize: 12, fontWeight: '700', color: '#1A3A3A' },
  dataValueBold: { fontSize: 14, fontWeight: '800' },

  // Grafico
  graficoCard: {
    backgroundColor: '#F0E8DA',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(170,155,135,0.4), -3px -3px 8px rgba(255,255,255,0.85)',
  },
  graficoLeft: { flex: 0.7, alignItems: 'center' },
  graficoCenter: { flex: 1.6, alignItems: 'center' },
  graficoRight: { flex: 0.7, alignItems: 'center' },
  graficoTitle: { fontSize: 12, fontWeight: '800', color: '#1A3A3A' },
  graficoDayTitle: { fontSize: 9, fontWeight: '600', color: '#5A7A7A', marginBottom: 1 },
  graficoTotal: { fontSize: 14, fontWeight: '900', color: '#1A3A3A' },
  graficoDelta: { fontSize: 11, fontWeight: '700', color: '#3AAFA9' },
  graficoMedia: { fontSize: 8, fontWeight: '600', color: '#7A9090', marginTop: 1 },

  // Salva button
  salvaBtn: {
    backgroundColor: '#1E5A5A',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    // @ts-ignore
    boxShadow: '3px 4px 12px rgba(20,55,55,0.5), -2px -2px 6px rgba(50,100,100,0.3)',
  },
  salvaText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  // Date Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCard: {
    backgroundColor: '#F0EDE5',
    borderRadius: 20,
    padding: 20,
    width: SW * 0.85,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '5px 6px 16px rgba(0,0,0,0.3)',
  },
  datePickerTitle: { fontSize: 16, fontWeight: '800', color: '#1A3A3A', marginBottom: 16 },
  datePickerGrid: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  datePickerDay: {
    width: 42,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#E5DBC8',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(170,155,135,0.4), -2px -2px 5px rgba(255,255,255,0.7)',
  },
  datePickerDayActive: {
    backgroundColor: '#1E5A5A',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(20,55,55,0.5)',
  },
  datePickerDayName: { fontSize: 9, fontWeight: '700', color: '#5A4A3A' },
  datePickerDayNum: { fontSize: 16, fontWeight: '900', color: '#1A3A3A', marginTop: 2 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3AAFA9', marginTop: 3 },
  datePickerClose: { backgroundColor: '#2A6A6A', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 24 },
  datePickerCloseText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
