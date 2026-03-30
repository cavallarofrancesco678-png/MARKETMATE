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
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore, Giornata } from '../../src/store/appStore';
import { Colors } from '../../src/theme/colors';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

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

  // 3D Weather Icon with glass effect
  const WeatherIcon = ({ icon, isActive, onPress }: { icon: string; isActive: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.meteoOuter, isActive && styles.meteoOuterActive]}>
        <LinearGradient
          colors={isActive ? ['#4A9A9A', '#1E5A5A', '#153838'] : ['#E8F4F0', '#C5DDD4', '#9ABFB5']}
          style={styles.meteoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.meteoHighlight} />
          <Ionicons 
            name={icon as any} 
            size={26} 
            color={isActive ? '#FFFFFF' : '#1E5A5A'} 
          />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  // 3D Embossed Chip
  const CollabChip = ({ name, isActive, onPress }: { name: string; isActive: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.chipOuter, isActive && styles.chipOuterActive]}>
        <View style={[styles.chipInner, isActive && styles.chipInnerActive]}>
          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{name}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // 3D Data Card with shadow
  const DataCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.dataCardOuter}>
      <View style={styles.dataCardShadow} />
      <View style={styles.dataCardInner}>
        <Text style={styles.dataLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>MARKETMATE</Text>
          <View style={styles.headerRight}>
            <View style={styles.nomeAziendaBadge}>
              <Text style={styles.nomeAziendaText}>Nome</Text>
              <Text style={styles.nomeAziendaText}>Azienda</Text>
            </View>
            <View style={styles.bellOuter}>
              <LinearGradient
                colors={['#2A6A6A', '#1E4A4A', '#153838']}
                style={styles.bellGradient}
              >
                <Ionicons name="notifications" size={22} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* SUBHEADER */}
        <View style={styles.subheader}>
          <Text style={styles.subheaderText}>{giorno} {data} - {mercatoNome}</Text>
          <TouchableOpacity 
            style={[styles.inPiazzaBadge, !isInPiazza && styles.assenteBadge]}
            onPress={() => setIsInPiazza(!isInPiazza)}
          >
            <Text style={styles.inPiazzaText}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
          </TouchableOpacity>
        </View>

        {/* MERCATO / FIERA with 3D effect */}
        <View style={styles.switchRow}>
          <TouchableOpacity style={styles.switchBtnWrapper} onPress={() => setIsFiera(false)} activeOpacity={0.8}>
            {!isFiera ? (
              <LinearGradient colors={['#2A6A6A', '#1E4A4A', '#153838']} style={styles.switchBtnActive}>
                <Text style={styles.switchTextActive}>Mercato</Text>
              </LinearGradient>
            ) : (
              <View style={styles.switchBtnInactive}>
                <View style={styles.switchBtnInnerShadow} />
                <Text style={styles.switchTextInactive}>Mercato</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.switchBtnWrapper} onPress={() => setIsFiera(true)} activeOpacity={0.8}>
            {isFiera ? (
              <LinearGradient colors={['#2A6A6A', '#1E4A4A', '#153838']} style={styles.switchBtnActive}>
                <Text style={styles.switchTextActive}>Fiera</Text>
              </LinearGradient>
            ) : (
              <View style={styles.switchBtnInactive}>
                <View style={styles.switchBtnInnerShadow} />
                <Text style={styles.switchTextInactive}>Fiera</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* WEATHER ICONS with 3D glass effect */}
        <View style={styles.meteoRow}>
          {METEO_OPTIONS.map((m) => (
            <WeatherIcon 
              key={m.label} 
              icon={m.icon} 
              isActive={meteo === m.label} 
              onPress={() => setMeteo(m.label)} 
            />
          ))}
        </View>

        {/* COLLABORATORI */}
        <Text style={styles.sectionLabel}>COLLABORATORI</Text>
        <View style={styles.collabRow}>
          {collaboratori.length > 0 ? collaboratori.map((c) => (
            <CollabChip
              key={c.nome}
              name={c.nome.toUpperCase()}
              isActive={presenzaSquadra[c.nome]}
              onPress={() => setPresenzaSquadra(prev => ({ ...prev, [c.nome]: !prev[c.nome] }))}
            />
          )) : (
            <>
              <CollabChip name="DAVIDE" isActive={false} onPress={() => {}} />
              <CollabChip name="ANTONIO" isActive={false} onPress={() => {}} />
              <CollabChip name="NICOLÒ" isActive={false} onPress={() => {}} />
            </>
          )}
        </View>

        {/* DATA GRID with 3D shadows */}
        <View style={styles.dataGrid}>
          <View style={styles.dataRow}>
            <DataCard label="LORDO">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={lordo}
                onChangeText={setLordo}
              />
            </DataCard>
            <DataCard label="UTILE">
              <Text style={[styles.dataValue, { color: utile >= 0 ? '#4A9A6A' : '#D46A6A' }]}>
                €{utile.toFixed(2)}
              </Text>
            </DataCard>
          </View>

          <View style={styles.dataRow}>
            <DataCard label="CONTANTI">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={contanti}
                onChangeText={setContanti}
              />
            </DataCard>
            <DataCard label="POS">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={pos}
                onChangeText={setPos}
              />
            </DataCard>
          </View>

          <View style={styles.dataRow}>
            <DataCard label="SPESE EXTRA">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={speseExtra}
                onChangeText={setSpeseExtra}
              />
            </DataCard>
            <DataCard label="SPESE FISSE">
              <Text style={styles.dataValue}>€{speseFisse.toFixed(2)}</Text>
            </DataCard>
          </View>

          <View style={styles.dataRow}>
            <DataCard label="INVENDUTO">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={invenduto}
                onChangeText={setInvenduto}
              />
            </DataCard>
            <DataCard label="CHIEDI">
              <TextInput
                style={styles.dataInput}
                placeholder="€0,00"
                placeholderTextColor="#9ABFB5"
                keyboardType="numeric"
                value={chiedi}
                onChangeText={setChiedi}
              />
            </DataCard>
          </View>
        </View>

        {/* GRAFICO with shadow */}
        <View style={styles.graficoOuter}>
          <View style={styles.graficoShadow} />
          <View style={styles.graficoCard}>
            <View style={styles.graficoLeft}>
              <View style={styles.miniChartLine}>
                <View style={[styles.chartWave, { backgroundColor: '#5ABABA' }]} />
                <View style={[styles.chartWave, { backgroundColor: '#E8A060', marginTop: 5 }]} />
              </View>
            </View>
            <View style={styles.graficoCenter}>
              <Text style={styles.graficoTitle}>GRAFICO</Text>
              <View style={styles.graficoIconWrapper}>
                <Ionicons name="settings-outline" size={24} color="#5ABABA" />
              </View>
              <Text style={styles.graficoSubtext}>Clicca per configurare statistiche</Text>
            </View>
            <View style={styles.graficoBars}>
              <View style={[styles.bar, { height: 20, backgroundColor: '#5ABABA' }]} />
              <View style={[styles.bar, { height: 30, backgroundColor: '#E8A060' }]} />
              <View style={[styles.bar, { height: 45, backgroundColor: '#1E5A5A' }]} />
              <View style={[styles.bar, { height: 35, backgroundColor: '#E8A060' }]} />
            </View>
          </View>
        </View>

        {/* SALVA Button */}
        <TouchableOpacity style={styles.salvaOuter} onPress={handleSalva} activeOpacity={0.8}>
          <View style={styles.salvaShadow} />
          <LinearGradient
            colors={['#2A6A6A', '#1E4A4A', '#153838']}
            style={styles.salvaGradient}
          >
            <Ionicons name="save" size={18} color="#FFFFFF" />
            <Text style={styles.salvaBtnText}>SALVA GIORNATA</Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D4E8E0',
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
    marginBottom: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E4A4A',
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nomeAziendaBadge: {
    backgroundColor: '#1E5A5A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    // @ts-ignore - web shadow
    boxShadow: '3px 4px 8px rgba(10, 32, 32, 0.4)',
  },
  nomeAziendaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bellOuter: {
    // @ts-ignore
    boxShadow: '3px 4px 8px rgba(10, 32, 32, 0.4)',
  },
  bellGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  subheaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E4A4A',
  },
  inPiazzaBadge: {
    backgroundColor: '#40C4AA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    // @ts-ignore
    boxShadow: '2px 3px 4px rgba(26, 106, 90, 0.3)',
  },
  assenteBadge: {
    backgroundColor: '#D46A6A',
  },
  inPiazzaText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Switch buttons
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  switchBtnWrapper: {
    flex: 1,
  },
  switchBtnActive: {
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 5px 10px rgba(10, 32, 32, 0.45)',
  },
  switchBtnInactive: {
    backgroundColor: '#E8DCC8',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4C4A8',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: 'inset 0px 3px 6px rgba(0,0,0,0.15)',
  },
  switchBtnInnerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  switchTextActive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  switchTextInactive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6A5A4A',
  },
  // Weather icons
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  meteoOuter: {
    // @ts-ignore
    boxShadow: '4px 5px 10px rgba(10, 58, 58, 0.4)',
  },
  meteoOuterActive: {
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(10, 32, 32, 0.55)',
  },
  meteoGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  meteoHighlight: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
  },
  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4A6A6A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  // Collaboratori chips
  collabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chipOuter: {
    // @ts-ignore
    boxShadow: '4px 5px 8px rgba(138, 122, 106, 0.4)',
  },
  chipOuterActive: {
    // @ts-ignore
    boxShadow: '4px 5px 10px rgba(10, 32, 32, 0.5)',
  },
  chipInner: {
    backgroundColor: '#E8DCC8',
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F5EEE0',
    borderBottomColor: '#C5B5A0',
    borderRightColor: '#C5B5A0',
  },
  chipInnerActive: {
    backgroundColor: '#1E5A5A',
    borderColor: '#2A6A6A',
    borderBottomColor: '#153838',
    borderRightColor: '#153838',
  },
  chipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#5A4A3A',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  // Data cards
  dataGrid: {
    gap: 8,
    marginBottom: 10,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dataCardOuter: {
    flex: 1,
    position: 'relative',
  },
  dataCardShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: '#8ABAB0',
    borderRadius: 12,
  },
  dataCardInner: {
    backgroundColor: '#FAFFF8',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F4F0',
    borderBottomColor: '#B5CCC4',
    borderRightColor: '#B5CCC4',
    // @ts-ignore
    boxShadow: '3px 4px 0px #8ABAB0',
  },
  dataLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E4A4A',
  },
  dataInput: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E4A4A',
    textAlign: 'right',
    minWidth: 70,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E4A4A',
  },
  // Grafico
  graficoOuter: {
    position: 'relative',
    marginBottom: 12,
  },
  graficoShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: '#8ABAB0',
    borderRadius: 15,
  },
  graficoCard: {
    backgroundColor: '#FAFFF8',
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F4F0',
    borderBottomColor: '#B5CCC4',
    borderRightColor: '#B5CCC4',
    // @ts-ignore
    boxShadow: '4px 5px 0px #8ABAB0',
  },
  graficoLeft: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  miniChartLine: {
    gap: 3,
  },
  chartWave: {
    height: 3,
    width: 50,
    borderRadius: 2,
  },
  graficoCenter: {
    flex: 2,
    alignItems: 'center',
  },
  graficoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E4A4A',
    marginBottom: 2,
  },
  graficoIconWrapper: {
    marginVertical: 2,
  },
  graficoSubtext: {
    fontSize: 8,
    color: '#7A9A9A',
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
    width: 10,
    borderRadius: 3,
  },
  // Salva button
  salvaOuter: {
    position: 'relative',
  },
  salvaShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: '#0A3030',
    borderRadius: 25,
  },
  salvaGradient: {
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    // @ts-ignore
    boxShadow: '4px 5px 0px #0A3030',
  },
  salvaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
