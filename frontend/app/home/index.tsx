import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Giornata } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';
import { RevenueChart } from '../../src/components/RevenueChart';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const METEO = [
  { icon: 'sunny-outline', label: 'SOLE' },
  { icon: 'partly-sunny-outline', label: 'VAR' },
  { icon: 'rainy-outline', label: 'PIOGGIA' },
  { icon: 'thunderstorm-outline', label: 'TEMP' },
  { icon: 'cloud-outline', label: 'NUVOLO' },
];

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata } = useAppStore();
  
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>MARKETMATE</Text>
          <View style={styles.headerRight}>
            <View style={styles.aziendaBadge}>
              <Text style={styles.aziendaText}>Nome</Text>
              <Text style={styles.aziendaText}>Azienda</Text>
            </View>
            <View style={styles.bellCircle}>
              <Ionicons name="notifications" size={18} color="#FFF" />
              <View style={styles.bellDot} />
            </View>
          </View>
        </View>

        {/* SUBHEADER */}
        <View style={styles.subRow}>
          <Text style={styles.subText}>{giorno} {data} - {mercatoNome}</Text>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[styles.piazzaBadge, !isInPiazza && {backgroundColor: '#D55'}]}>
              <Text style={styles.piazzaText}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* TOGGLE MERCATO / FIERA */}
        <View style={styles.toggleRow}>
          <TouchableOpacity style={styles.toggleWrap} onPress={() => setIsFiera(false)}>
            <View style={[styles.toggleBtn, !isFiera && styles.toggleActive]}>
              <Text style={[styles.toggleText, !isFiera && styles.toggleTextActive]}>Mercato</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleWrap} onPress={() => setIsFiera(true)}>
            <View style={[styles.toggleBtn, isFiera && styles.toggleActive]}>
              <Text style={[styles.toggleText, isFiera && styles.toggleTextActive]}>Fiera</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* WEATHER ICONS - Blue 3D spheres */}
        <View style={styles.meteoRow}>
          {METEO.map((m, i) => (
            <TouchableOpacity key={i} onPress={() => setMeteo(m.label)}>
              <View style={[styles.meteoSphere, meteo === m.label && styles.meteoSphereActive]}>
                <View style={styles.meteoShine} />
                <Ionicons name={m.icon as any} size={26} color={meteo === m.label ? '#FFF' : '#3A8A9A'} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* COLLABORATORI */}
        <Text style={styles.sectionTitle}>COLLABORATORI</Text>
        <View style={styles.collabRow}>
          {collabNames.map((name, i) => (
            <TouchableOpacity key={i} onPress={() => setPresenze(p => ({...p, [name]: !p[name]}))}>
              <View style={[styles.collabPill, presenze[name] && styles.collabPillActive]}>
                <Text style={[styles.collabText, presenze[name] && styles.collabTextActive]}>{name.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* DATA GRID */}
        <View style={styles.dataGrid}>
          {/* Row 1 */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>LORDO</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={lordo} onChangeText={setLordo} />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabelBold}>UTILE</Text>
              <Text style={[styles.dataValueBold, {color: utile >= 0 ? '#3A8' : '#D55'}]}>€{utile.toFixed(2)}</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>CONTANTI</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={contanti} onChangeText={setContanti} />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>POSS</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={pos} onChangeText={setPos} />
            </View>
          </View>
          {/* Row 3 */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>SPESE EXTRA</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>SPESE FISSE</Text>
              <Text style={styles.dataValue}>€{speseFisse.toFixed(2)}</Text>
            </View>
          </View>
          {/* Row 4 */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>INVENDUTO</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>CHIEDI</Text>
              <TextInput style={styles.dataInput} placeholder="€0,00" placeholderTextColor="#AAA" keyboardType="numeric" value={chiedi} onChangeText={setChiedi} />
            </View>
          </View>
        </View>

        {/* GRAFICO - REVENUE CHART */}
        <RevenueChart storicoGiornate={[]} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#D8EDE8' },
  scroll: { padding: 16, paddingBottom: 100 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A4A4A', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aziendaBadge: { backgroundColor: '#2A6A6A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  aziendaText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  bellCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2A6A6A', justifyContent: 'center', alignItems: 'center' },
  bellDot: { position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E55' },
  
  // Subheader
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
  subText: { fontSize: 16, fontWeight: '600', color: '#1A4A4A' },
  piazzaBadge: { backgroundColor: '#2A6A6A', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  piazzaText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  
  // Toggle
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleWrap: { flex: 1 },
  toggleBtn: { backgroundColor: '#E8DCC8', borderRadius: 30, paddingVertical: 14, alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(180,160,140,0.5), -3px -3px 8px rgba(255,255,255,0.8)' },
  toggleActive: { backgroundColor: '#1A5A5A',
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(20,60,60,0.6), -2px -2px 6px rgba(50,90,90,0.3)' },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#5A4A3A' },
  toggleTextActive: { color: '#FFF' },
  
  // Weather spheres - BLUE 3D
  meteoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 },
  meteoSphere: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#B8D8E8', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(80,120,140,0.5), -4px -4px 10px rgba(255,255,255,0.7)' },
  meteoSphereActive: { backgroundColor: '#4A9AB0',
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(40,80,100,0.6), -2px -2px 6px rgba(100,160,180,0.4)' },
  meteoShine: { position: 'absolute', top: 4, left: 8, right: 8, height: 16, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 12 },
  
  // Section title
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#5A7A7A', textAlign: 'center', marginBottom: 10, letterSpacing: 2 },
  
  // Collaboratori pills - CREAM colored
  collabRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 14 },
  collabPill: { backgroundColor: '#E8DCC8', borderRadius: 25, paddingHorizontal: 22, paddingVertical: 12,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(180,160,140,0.5), -3px -3px 8px rgba(255,255,255,0.8)' },
  collabPillActive: { backgroundColor: '#1A5A5A',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(20,60,60,0.5)' },
  collabText: { fontSize: 12, fontWeight: '700', color: '#4A3A2A' },
  collabTextActive: { color: '#FFF' },
  
  // Data grid
  dataGrid: { gap: 10, marginBottom: 16 },
  dataRow: { flexDirection: 'row', gap: 10 },
  dataCard: { flex: 1, backgroundColor: '#FAFCFA', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(150,180,170,0.4), -3px -3px 8px rgba(255,255,255,0.9)' },
  dataLabel: { fontSize: 12, fontWeight: '600', color: '#3A5A5A' },
  dataLabelBold: { fontSize: 14, fontWeight: '800', color: '#1A4A4A' },
  dataInput: { fontSize: 14, fontWeight: '700', color: '#1A4A4A', textAlign: 'right', minWidth: 80 },
  dataValue: { fontSize: 14, fontWeight: '700', color: '#1A4A4A' },
  dataValueBold: { fontSize: 16, fontWeight: '800' },
  
});
