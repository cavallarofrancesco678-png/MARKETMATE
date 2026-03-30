import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const { width: SW, height: SH } = Dimensions.get('window');

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const METEO = [
  { icon: 'sunny', label: 'SOLE' },
  { icon: 'partly-sunny', label: 'VAR' },
  { icon: 'rainy', label: 'PIOGGIA' },
  { icon: 'thunderstorm', label: 'TEMP' },
  { icon: 'cloud', label: 'NUVOLO' },
];

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue } = useAppStore();

  const [dataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenze, setPresenze] = useState<Record<string, boolean>>({});

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

  // Mock storico data
  const incassoTotale = 44130;
  const mediaScontrino = 18.50;
  const deltaPercent = 14;
  const currentYear = new Date().getFullYear();

  // Mini chart SVGs
  const MiniLineChart = () => (
    <Svg width="60" height="35" viewBox="0 0 60 35">
      <Path d="M2 28 Q12 26 18 18 T30 22 T42 14 T58 8" stroke="#4A9AB0" strokeWidth="2" fill="none" />
      <Path d="M2 32 Q15 30 22 26 T36 28 T48 22 T58 18" stroke="#E8A060" strokeWidth="1.5" fill="none" />
    </Svg>
  );

  const MiniBarChart = () => (
    <Svg width="55" height="35" viewBox="0 0 55 35">
      <Rect x="2" y="20" width="7" height="15" fill="#5ABAB5" rx="2" />
      <Rect x="11" y="24" width="7" height="11" fill="#E8A060" rx="2" />
      <Rect x="20" y="16" width="7" height="19" fill="#5ABAB5" rx="2" />
      <Rect x="29" y="12" width="7" height="23" fill="#E8A060" rx="2" />
      <Rect x="38" y="8" width="7" height="27" fill="#5ABAB5" rx="2" />
      <Rect x="47" y="14" width="7" height="21" fill="#E8A060" rx="2" />
    </Svg>
  );

  return (
    <View style={s.container}>
      {/* HEADER - Market name + badges */}
      <View style={s.header}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.headerRight}>
          <View style={s.aziendaBadge}>
            <Text style={s.aziendaText}>Nome</Text>
            <Text style={s.aziendaText}>Azienda</Text>
          </View>
          <View style={s.bellCircle}>
            <Ionicons name="notifications" size={16} color="#FFF" />
            <View style={s.bellDot} />
          </View>
        </View>
      </View>

      {/* DATE + IN PIAZZA */}
      <View style={s.dateRow}>
        <Text style={s.dateText}>{giorno} {data} - {mercatoNome}</Text>
        <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
          <View style={[s.piazzaBadge, !isInPiazza && { backgroundColor: '#D55' }]}>
            <Text style={s.piazzaText}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
          </View>
        </TouchableOpacity>
      </View>

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

      {/* WEATHER ICONS - Steel blue 3D spheres */}
      <View style={s.meteoRow}>
        {METEO.map((m, i) => (
          <TouchableOpacity key={i} onPress={() => setMeteo(m.label)} activeOpacity={0.7}>
            <View style={[s.meteoSphere, meteo === m.label && s.meteoActive]}>
              <View style={s.meteoShine} />
              <Ionicons
                name={m.icon as any}
                size={24}
                color={meteo === m.label ? '#FFFFFF' : '#2A4A5A'}
              />
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

      {/* DATA GRID - 4 rows, 2 cols */}
      <View style={s.dataGrid}>
        <View style={s.dataRow}>
          <View style={s.dataCard}>
            <Text style={s.dataLabelBold}>LORDO</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={lordo} onChangeText={setLordo} />
          </View>
          <View style={s.dataCard}>
            <Text style={s.dataLabelBold}>UTILE</Text>
            <Text style={[s.dataValueBold, { color: utile >= 0 ? '#3A8A6A' : '#D55' }]}>€{utile.toFixed(2)}</Text>
          </View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>CONTANTI</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={contanti} onChangeText={setContanti} />
          </View>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>POSS</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={pos} onChangeText={setPos} />
          </View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>SPESE EXTRA</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} />
          </View>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>SPESE FISSE</Text>
            <Text style={s.dataValue}>€{speseFisse.toFixed(2)}</Text>
          </View>
        </View>
        <View style={s.dataRow}>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>INVENDUTO</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} />
          </View>
          <View style={s.dataCard}>
            <Text style={s.dataLabel}>CHIEDI</Text>
            <TextInput style={s.dataInput} placeholder="€0,00" placeholderTextColor="#B0A898" keyboardType="numeric" value={chiedi} onChangeText={setChiedi} />
          </View>
        </View>
      </View>

      {/* GRAFICO CARD - Compact */}
      <TouchableOpacity activeOpacity={0.85}>
        <View style={s.graficoCard}>
          <View style={s.graficoLeft}>
            <MiniLineChart />
          </View>
          <View style={s.graficoCenter}>
            <Text style={s.graficoTitle}>Storico Mercato</Text>
            <Text style={s.graficoDayTitle}>del {giorno}</Text>
            <Text style={s.graficoTotal}>€{incassoTotale.toLocaleString('it-IT')}{' '}
              <Text style={s.graficoDelta}>(+{deltaPercent}%)</Text>
            </Text>
            <Text style={s.graficoMedia}>Media scontrino: €{mediaScontrino.toFixed(2)}</Text>
          </View>
          <View style={s.graficoRight}>
            <MiniBarChart />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D5ECE5',
    paddingHorizontal: 14,
    paddingTop: 42,
    paddingBottom: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  marketName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A4A4A',
    letterSpacing: 1.5,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aziendaBadge: {
    backgroundColor: '#2A6A6A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  aziendaText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  bellCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2A6A6A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E55',
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dateText: { fontSize: 13, fontWeight: '600', color: '#2A5A5A' },
  piazzaBadge: {
    backgroundColor: '#2A6A6A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  piazzaText: { color: '#FFF', fontSize: 9, fontWeight: '700' },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toggleWrap: { flex: 1 },
  toggleBtn: {
    backgroundColor: '#E5DBC8',
    borderRadius: 28,
    paddingVertical: 10,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(170,155,135,0.5), -3px -3px 7px rgba(255,255,255,0.8)',
  },
  toggleActive: {
    backgroundColor: '#1E5A5A',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(20,55,55,0.6), -2px -2px 5px rgba(50,90,90,0.3)',
  },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#5A4A3A' },
  toggleTextActive: { color: '#FFF' },

  // Weather - Steel blue 3D spheres
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  meteoSphere: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8AAFC0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(60,95,110,0.5), -3px -3px 8px rgba(180,215,230,0.7)',
  },
  meteoActive: {
    backgroundColor: '#3A7A8A',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(30,60,70,0.6), -2px -2px 5px rgba(70,130,150,0.4)',
  },
  meteoShine: {
    position: 'absolute',
    top: 3,
    left: 6,
    right: 6,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
  },

  // Section
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5A7A7A',
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: 2,
  },

  // Collaboratori - Cream pills
  collabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  collabPill: {
    backgroundColor: '#E5DBC8',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(170,155,135,0.5), -3px -3px 7px rgba(255,255,255,0.8)',
  },
  collabPillActive: {
    backgroundColor: '#1E5A5A',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(20,55,55,0.5)',
  },
  collabText: { fontSize: 11, fontWeight: '700', color: '#4A3A2A' },
  collabTextActive: { color: '#FFF' },

  // Data grid - CREAM colored cards
  dataGrid: { gap: 7, marginBottom: 10 },
  dataRow: { flexDirection: 'row', gap: 8 },
  dataCard: {
    flex: 1,
    backgroundColor: '#F0E8DA',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(170,155,135,0.4), -3px -3px 7px rgba(255,255,255,0.85)',
  },
  dataLabel: { fontSize: 11, fontWeight: '600', color: '#4A5A5A' },
  dataLabelBold: { fontSize: 13, fontWeight: '800', color: '#1A3A3A' },
  dataInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3A3A',
    textAlign: 'right',
    minWidth: 70,
    padding: 0,
    margin: 0,
  },
  dataValue: { fontSize: 13, fontWeight: '700', color: '#1A3A3A' },
  dataValueBold: { fontSize: 15, fontWeight: '800' },

  // Grafico - Compact card
  graficoCard: {
    backgroundColor: '#F0E8DA',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(170,155,135,0.4), -3px -3px 8px rgba(255,255,255,0.85)',
  },
  graficoLeft: { flex: 0.8, alignItems: 'center' },
  graficoCenter: { flex: 1.4, alignItems: 'center' },
  graficoRight: { flex: 0.8, alignItems: 'center' },
  graficoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A3A3A',
  },
  graficoDayTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5A7A7A',
    marginBottom: 2,
  },
  graficoTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A3A3A',
  },
  graficoDelta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3AAFA9',
  },
  graficoMedia: {
    fontSize: 8,
    fontWeight: '600',
    color: '#7A9090',
    marginTop: 1,
  },
});
