import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Giornata } from '../../src/store/appStore';
import { Colors } from '../../src/theme/colors';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// 5 Weather icons - metallic style
const METEO_OPTIONS = [
  { icon: 'sunny-outline', label: 'SOLE' },
  { icon: 'partly-sunny', label: 'VARIABILE' },
  { icon: 'rainy', label: 'PIOGGIA' },
  { icon: 'thunderstorm', label: 'TEMPORALE' },
  { icon: 'cloud', label: 'NUVOLO' },
];

export default function HomeScreen() {
  const {
    nomeAttivita,
    nomeTitolare,
    agenda,
    collaboratori,
    speseAnnue,
    storicoCarburante,
    storicoGiornate,
    salvaGiornata,
  } = useAppStore();

  const [dataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenzaSquadra, setPresenzaSquadra] = useState<Record<string, boolean>>({});

  // Form fields
  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [speseExtra, setSpeseExtra] = useState('');
  const [invenduto, setInvenduto] = useState('');
  const [chiedi, setChiedi] = useState('');

  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? 'Fiera' : (mercatoOggi?.mercato || 'Giorno Off');
  const giorno = GIORNI[dataCorrente.getDay()];
  const data = `${dataCorrente.getDate()} ${MESI[dataCorrente.getMonth()]}`;

  useEffect(() => {
    const presence: Record<string, boolean> = {};
    collaboratori.forEach((c) => { presence[c.nome] = false; });
    setPresenzaSquadra(presence);
  }, [collaboratori]);

  // Calculate spese fisse
  const getSpeseFisse = () => {
    const ggLavorativi = agenda.filter((m) => m.lavorativo).length || 6;
    const totSpeseAnnue = speseAnnue.reduce((sum, s) => sum + s.importo, 0);
    const totPlateatici = agenda.reduce((sum, m) => sum + m.p_annuo, 0);
    return ((totSpeseAnnue + totPlateatici) / (48 * ggLavorativi));
  };

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const speseExtraNum = parseFloat(speseExtra.replace(',', '.')) || 0;
  const invendutoNum = parseFloat(invenduto.replace(',', '.')) || 0;
  const speseFisse = getSpeseFisse();
  const utile = lordoNum - speseFisse - speseExtraNum - invendutoNum;

  const handleSalva = () => {
    const giornata: Giornata = {
      data: dataCorrente,
      mercato: mercatoNome,
      meteo,
      km: mercatoOggi?.km || 0,
      lordo: lordoNum,
      netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraNum,
      dettaglio_staff: {},
      dettaglio_invenduto: {},
      dettaglio_fornitori: {},
    };
    salvaGiornata(giornata);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>MARKETMATE</Text>
          <View style={styles.headerRight}>
            <View style={styles.nomeAziendaBadge}>
              <Text style={styles.nomeAziendaText}>{nomeAttivita || 'Nome'}</Text>
              <Text style={styles.nomeAziendaText}>Azienda</Text>
            </View>
            <TouchableOpacity style={styles.bellBtn}>
              <Ionicons name="notifications" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SUBHEADER: Data + Mercato + IN PIAZZA */}
        <View style={styles.subheader}>
          <Text style={styles.subheaderText}>{giorno} {data} - {mercatoNome}</Text>
          <TouchableOpacity 
            style={[styles.inPiazzaBadge, !isInPiazza && styles.assenteBadge]}
            onPress={() => setIsInPiazza(!isInPiazza)}
          >
            <Text style={styles.inPiazzaText}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
          </TouchableOpacity>
        </View>

        {/* MERCATO / FIERA */}
        <View style={styles.switchRow}>
          <TouchableOpacity
            style={[styles.switchBtn, !isFiera && styles.switchBtnActive]}
            onPress={() => setIsFiera(false)}
          >
            <Text style={[styles.switchText, !isFiera && styles.switchTextActive]}>Mercato</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchBtn, isFiera && styles.switchBtnActive]}
            onPress={() => setIsFiera(true)}
          >
            <Text style={[styles.switchText, isFiera && styles.switchTextActive]}>Fiera</Text>
          </TouchableOpacity>
        </View>

        {/* WEATHER ICONS */}
        <View style={styles.meteoRow}>
          {METEO_OPTIONS.map((m) => (
            <TouchableOpacity key={m.label} onPress={() => setMeteo(m.label)}>
              <View style={[styles.meteoCircle, meteo === m.label && styles.meteoActive]}>
                <Ionicons 
                  name={m.icon as any} 
                  size={28} 
                  color={meteo === m.label ? Colors.white : Colors.teal} 
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* COLLABORATORI */}
        <Text style={styles.sectionLabel}>COLLABORATORI</Text>
        <View style={styles.collabRow}>
          {collaboratori.length > 0 ? collaboratori.map((c) => (
            <TouchableOpacity
              key={c.nome}
              style={[styles.collabChip, presenzaSquadra[c.nome] && styles.collabChipActive]}
              onPress={() => setPresenzaSquadra(prev => ({ ...prev, [c.nome]: !prev[c.nome] }))}
            >
              <Text style={[styles.collabText, presenzaSquadra[c.nome] && styles.collabTextActive]}>
                {c.nome.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )) : (
            <>
              <View style={styles.collabChip}><Text style={styles.collabText}>DAVIDE</Text></View>
              <View style={styles.collabChip}><Text style={styles.collabText}>ANTONIO</Text></View>
              <View style={styles.collabChip}><Text style={styles.collabText}>NICOLÒ</Text></View>
            </>
          )}
        </View>

        {/* DATA GRID 4x2 */}
        <View style={styles.dataGrid}>
          {/* Row 1: LORDO | UTILE */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>LORDO</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={lordo}
                onChangeText={setLordo}
              />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>UTILE</Text>
              <Text style={[styles.dataValue, { color: utile >= 0 ? Colors.verde : Colors.rosso }]}>
                €{utile.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Row 2: CONTANTI | POS */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>CONTANTI</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={contanti}
                onChangeText={setContanti}
              />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>POS</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={pos}
                onChangeText={setPos}
              />
            </View>
          </View>

          {/* Row 3: SPESE EXTRA | SPESE FISSE */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>SPESE EXTRA</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={speseExtra}
                onChangeText={setSpeseExtra}
              />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>SPESE FISSE</Text>
              <Text style={styles.dataValue}>€{speseFisse.toFixed(2)}</Text>
            </View>
          </View>

          {/* Row 4: INVENDUTO | CHIEDI */}
          <View style={styles.dataRow}>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>INVENDUTO</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={invenduto}
                onChangeText={setInvenduto}
              />
            </View>
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>CHIEDI</Text>
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={chiedi}
                onChangeText={setChiedi}
              />
            </View>
          </View>
        </View>

        {/* GRAFICO Section */}
        <View style={styles.graficoCard}>
          <View style={styles.graficoLeft}>
            <View style={styles.miniChart}>
              <View style={[styles.chartLine, { height: 20 }]} />
              <View style={[styles.chartLine, { height: 30, backgroundColor: Colors.arancio }]} />
            </View>
          </View>
          <View style={styles.graficoCenter}>
            <Text style={styles.graficoTitle}>GRAFICO</Text>
            <Ionicons name="settings-outline" size={24} color={Colors.teal} />
            <Text style={styles.graficoSubtext}>Clicca per configurare statistiche</Text>
          </View>
          <View style={styles.graficoBars}>
            <View style={[styles.bar, { height: 25, backgroundColor: Colors.inPiazza }]} />
            <View style={[styles.bar, { height: 35, backgroundColor: Colors.arancio }]} />
            <View style={[styles.bar, { height: 45, backgroundColor: Colors.teal }]} />
            <View style={[styles.bar, { height: 30, backgroundColor: Colors.arancio }]} />
          </View>
        </View>

        {/* SALVA Button */}
        <TouchableOpacity style={styles.salvaBtn} onPress={handleSalva}>
          <Ionicons name="save" size={20} color={Colors.white} />
          <Text style={styles.salvaBtnText}>SALVA GIORNATA</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.teal,
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nomeAziendaBadge: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  nomeAziendaText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  bellBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 20,
    padding: 8,
  },
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  subheaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },
  inPiazzaBadge: {
    backgroundColor: Colors.inPiazza,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assenteBadge: {
    backgroundColor: Colors.rosso,
  },
  inPiazzaText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  switchBtn: {
    flex: 1,
    backgroundColor: Colors.beige,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: Colors.teal,
  },
  switchText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  switchTextActive: {
    color: Colors.white,
  },
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  meteoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.teal,
  },
  meteoActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.tealDark,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textMedium,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  collabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  collabChip: {
    backgroundColor: Colors.beige,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.beigeDark,
  },
  collabChipActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.tealDark,
  },
  collabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  collabTextActive: {
    color: Colors.white,
  },
  dataGrid: {
    gap: 8,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dataCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bgDark,
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  dataInput: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'right',
    minWidth: 80,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  graficoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.bgDark,
  },
  graficoLeft: {
    flex: 1,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  chartLine: {
    width: 20,
    backgroundColor: Colors.inPiazza,
    borderRadius: 3,
  },
  graficoCenter: {
    flex: 2,
    alignItems: 'center',
  },
  graficoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: 4,
  },
  graficoSubtext: {
    fontSize: 9,
    color: Colors.textLight,
    marginTop: 4,
  },
  graficoBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 4,
    height: 50,
  },
  bar: {
    width: 12,
    borderRadius: 3,
  },
  salvaBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.tealDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  salvaBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
