import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Giornata } from '../../src/store/appStore';
import { NeuBox, NeuInset } from '../../src/components/NeuBox';
import { CalendarModal } from '../../src/components/CalendarModal';
import { Colors } from '../../src/theme/colors';
import { formattaDataIta, getGiornoIndex, isToday, isTomorrow } from '../../src/utils/dateUtils';

const METEO_OPTIONS = [
  { icon: 'sunny', label: 'SOLE', color: '#FFB347' },
  { icon: 'cloud', label: 'NUVOLO', color: '#B8B8B8' },
  { icon: 'rainy', label: 'PIOGGIA', color: '#6B8DD6' },
  { icon: 'thunderstorm', label: 'TEMPORALE', color: '#8B4513' },
];

export default function HomeScreen() {
  const {
    nomeAttivita,
    nomeTitolare,
    isAlimentare,
    targetMensile,
    themeColor,
    agenda,
    collaboratori,
    fornitori,
    speseAnnue,
    appuntiAgenda,
    storicoGiornate,
    storicoCarburante,
    salvaGiornata,
  } = useAppStore();

  const activeColor = themeColor || Colors.primary;

  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showInvenduto, setShowInvenduto] = useState(false);

  // Form fields
  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [fieraNome, setFieraNome] = useState('');
  const [fieraKm, setFieraKm] = useState('');
  const [fieraPlat, setFieraPlat] = useState('');
  const [speseExtra, setSpeseExtra] = useState<{ voce: string; importo: number }[]>([]);
  const [presenzaSquadra, setPresenzaSquadra] = useState<Record<string, boolean>>({});

  // Get market for current day
  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];

  // Initialize staff presence
  useEffect(() => {
    const presence: Record<string, boolean> = {};
    collaboratori.forEach((c) => {
      presence[c.nome] = true;
    });
    setPresenzaSquadra(presence);
  }, [collaboratori]);

  // Calculate costs
  const consumoKmDinamico = (() => {
    const totFuel = storicoCarburante.reduce((sum, item) => sum + item.euro, 0);
    const totKm = storicoGiornate.reduce((sum, item) => sum + (item.km || 0), 0);
    if (totKm <= 0 || totFuel <= 0) return 0.30;
    return totFuel / totKm;
  })();

  const getCostoStaff = () => {
    return collaboratori
      .filter((c) => presenzaSquadra[c.nome])
      .reduce((sum, c) => sum + c.costo, 0);
  };

  const getQuotaFissaGiornaliera = () => {
    const ggLavorativi = agenda.filter((m) => m.lavorativo).length;
    const baseGiorni = ggLavorativi > 0 ? ggLavorativi : 6;
    const divisore = 48 * baseGiorni;
    
    const totSpeseAnnue = speseAnnue.reduce((sum, s) => sum + s.importo, 0);
    const totPlateaticiAnnui = agenda.reduce((sum, m) => sum + m.p_annuo, 0);
    
    return (totSpeseAnnue + totPlateaticiAnnui) / divisore;
  };

  const getTotaleFisseOpe = () => {
    let costi = getQuotaFissaGiornaliera();
    
    if (isInPiazza) {
      if (isFiera) {
        const km = parseFloat(fieraKm.replace(',', '.')) || 0;
        const plat = parseFloat(fieraPlat.replace(',', '.')) || 0;
        costi += km * consumoKmDinamico + plat;
      } else if (mercatoOggi) {
        costi += mercatoOggi.km * consumoKmDinamico + mercatoOggi.p_giornaliero;
      }
    }
    
    costi += getCostoStaff();
    return costi;
  };

  const getTotaleExtra = () => {
    return speseExtra.reduce((sum, s) => sum + s.importo, 0);
  };

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const nettoReale = lordoNum - getTotaleFisseOpe() - getTotaleExtra();

  // Check notifications
  const hasNotifiche = appuntiAgenda.some(
    (n) => isToday(new Date(n.data)) || isTomorrow(new Date(n.data))
  );

  const syncConti = (origin: string, value: string) => {
    const l = parseFloat(lordo.replace(',', '.')) || 0;
    const c = parseFloat(contanti.replace(',', '.')) || 0;
    const p = parseFloat(pos.replace(',', '.')) || 0;

    if (origin === 'lordo') {
      const newLordo = parseFloat(value.replace(',', '.')) || 0;
      if (newLordo - p > 0) setContanti((newLordo - p).toFixed(2));
    } else if (origin === 'contanti') {
      const newContanti = parseFloat(value.replace(',', '.')) || 0;
      if (l - newContanti > 0) setPos((l - newContanti).toFixed(2));
    } else if (origin === 'pos') {
      const newPos = parseFloat(value.replace(',', '.')) || 0;
      if (l - newPos > 0) setContanti((l - newPos).toFixed(2));
    }
  };

  const handleSalvaGiornata = () => {
    const kmOggi = isInPiazza
      ? isFiera
        ? parseFloat(fieraKm.replace(',', '.')) || 0
        : mercatoOggi?.km || 0
      : 0;

    const giornata: Giornata = {
      data: dataCorrente,
      mercato: mercatoOggi?.mercato || (isFiera ? 'Fiera' : 'Nessuno'),
      meteo,
      km: kmOggi,
      lordo: lordoNum,
      netto: nettoReale,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: getTotaleExtra(),
      dettaglio_staff: {},
      dettaglio_invenduto: {},
      dettaglio_fornitori: {},
    };

    salvaGiornata(giornata);
    Alert.alert('Salvato!', 'Giornata salvata con successo!');
  };

  const mercatoNome = isFiera
    ? fieraNome || 'FIERA'
    : mercatoOggi?.mercato
    ? mercatoOggi.mercato.toUpperCase()
    : 'GIORNO OFF';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{nomeAttivita.toUpperCase()}</Text>
            <Text style={styles.headerSubtitle}>
              {formattaDataIta(dataCorrente).toUpperCase()} - {mercatoNome}
            </Text>
          </View>

          {/* Search/Calendar Bar */}
          <TouchableOpacity onPress={() => setShowCalendar(true)}>
            <NeuBox style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Colors.grey} />
              <Text style={styles.searchText}>Cerca...</Text>
            </NeuBox>
          </TouchableOpacity>

          {/* Meteo Icons */}
          <View style={styles.meteoContainer}>
            {METEO_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m.label}
                style={styles.meteoItem}
                onPress={() => setMeteo(m.label)}
              >
                <View
                  style={[
                    styles.meteoCircle,
                    meteo === m.label && { backgroundColor: m.color },
                    meteo !== m.label && styles.meteoCircleInactive,
                  ]}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={28}
                    color={meteo === m.label ? Colors.white : Colors.grey}
                  />
                </View>
                <Text style={[
                  styles.meteoLabel,
                  meteo === m.label && { color: Colors.marrone, fontWeight: 'bold' }
                ]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Incasso Section */}
          <View style={styles.incassoRow}>
            <NeuBox style={styles.incassoCard}>
              <Text style={styles.incassoLabel}>INCASSO LORDO</Text>
              <View style={styles.incassoValueRow}>
                <TextInput
                  style={styles.incassoInput}
                  placeholder="0,00"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={lordo}
                  onChangeText={(v) => {
                    setLordo(v);
                    syncConti('lordo', v);
                  }}
                />
                <Text style={styles.euroSign}>€</Text>
              </View>
              <Text style={styles.incassoSubtext}>
                POS {pos || '0'} € | CONTANTI {contanti || '0'} €
              </Text>
            </NeuBox>

            <View style={styles.inputColumn}>
              <NeuInset style={styles.smallInput}>
                <Ionicons name="pencil" size={16} color={Colors.arancio} />
                <TextInput
                  style={styles.smallInputText}
                  placeholder="CONTANTI €"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={contanti}
                  onChangeText={(v) => {
                    setContanti(v);
                    syncConti('contanti', v);
                  }}
                />
              </NeuInset>
              <NeuInset style={styles.smallInput}>
                <Ionicons name="pencil" size={16} color={Colors.arancio} />
                <TextInput
                  style={styles.smallInputText}
                  placeholder="POS €"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={pos}
                  onChangeText={(v) => {
                    setPos(v);
                    syncConti('pos', v);
                  }}
                />
              </NeuInset>
            </View>
          </View>

          {/* Collaboratori */}
          {collaboratori.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>COLLABORATORI</Text>
              <View style={styles.collabRow}>
                {collaboratori.map((c) => (
                  <TouchableOpacity
                    key={c.nome}
                    onPress={() => {
                      setPresenzaSquadra((prev) => ({
                        ...prev,
                        [c.nome]: !prev[c.nome],
                      }));
                    }}
                  >
                    <View
                      style={[
                        styles.collabChip,
                        presenzaSquadra[c.nome]
                          ? { backgroundColor: Colors.caramello }
                          : { backgroundColor: Colors.lightGrey },
                      ]}
                    >
                      <Text
                        style={[
                          styles.collabText,
                          presenzaSquadra[c.nome] && { color: Colors.white },
                        ]}
                      >
                        {c.nome.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Invenduto Section */}
          <TouchableOpacity onPress={() => setShowInvenduto(!showInvenduto)}>
            <NeuBox style={styles.expandSection}>
              <Text style={styles.expandTitle}>INVENDUTO</Text>
              <Ionicons
                name={showInvenduto ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={Colors.marrone}
              />
            </NeuBox>
          </TouchableOpacity>

          {showInvenduto && isAlimentare && fornitori.length > 0 && (
            <NeuBox style={styles.invendutoContent}>
              {fornitori.flatMap((f) =>
                (f.prodotti || []).map((p) => (
                  <View key={`${f.nome}-${p.nome}`} style={styles.invendutoRow}>
                    <Text style={styles.invendutoLabel}>{p.nome.toUpperCase()}</Text>
                    <View style={styles.kgInput}>
                      <TextInput
                        style={styles.kgInputText}
                        placeholder="0"
                        keyboardType="numeric"
                      />
                      <Text style={styles.kgLabel}>KG</Text>
                      <View style={styles.kgButtons}>
                        <TouchableOpacity style={styles.kgBtn}>
                          <Text style={styles.kgBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.kgBtn}>
                          <Text style={styles.kgBtnText}>-</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
              {fornitori.length === 0 || fornitori.every(f => !f.prodotti?.length) && (
                <Text style={styles.emptyText}>Aggiungi prodotti nelle impostazioni</Text>
              )}
            </NeuBox>
          )}

          {/* Salva Dati Button */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSalvaGiornata}>
            <Text style={styles.saveButtonText}>SALVA DATI</Text>
          </TouchableOpacity>

          {/* Spese Giornaliere */}
          <TouchableOpacity>
            <NeuBox style={styles.speseCard}>
              <View style={styles.speseLeft}>
                <Ionicons name="car" size={24} color={Colors.terracotta} />
                <Text style={styles.speseTitle}>SPESE GIORNALIERE</Text>
              </View>
              <View style={styles.speseRight}>
                <Text style={styles.speseValue}>€ {getTotaleExtra().toFixed(2)}</Text>
                <Text style={styles.speseTocca}>Tocca per gestire</Text>
              </View>
            </NeuBox>
          </TouchableOpacity>

          {/* Spese Fisse */}
          <TouchableOpacity>
            <NeuBox style={styles.speseCard}>
              <View style={styles.speseLeft}>
                <Ionicons name="settings" size={24} color={Colors.terracotta} />
                <Text style={styles.speseTitle}>SPESE FISSE</Text>
              </View>
              <View style={styles.speseRight}>
                <Text style={styles.speseValue}>€ {getTotaleFisseOpe().toFixed(2)}</Text>
                <Text style={styles.speseTocca}>Tocca per gestire</Text>
              </View>
            </NeuBox>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => setDataCorrente(date)}
        initialDate={dataCorrente}
        themeColor={activeColor}
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
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.marroneChiaro,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  searchText: {
    fontSize: 14,
    color: Colors.grey,
  },
  meteoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  meteoItem: {
    alignItems: 'center',
  },
  meteoCircle: {
    width: 55,
    height: 55,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  meteoCircleInactive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  meteoLabel: {
    fontSize: 10,
    color: Colors.grey,
    fontWeight: '500',
  },
  incassoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  incassoCard: {
    flex: 1,
    backgroundColor: Colors.arancioChiaro,
    borderWidth: 2,
    borderColor: Colors.caramello,
  },
  incassoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginBottom: 5,
  },
  incassoValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  incassoInput: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.marrone,
    flex: 1,
  },
  euroSign: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  incassoSubtext: {
    fontSize: 10,
    color: Colors.marroneChiaro,
    marginTop: 5,
  },
  inputColumn: {
    width: 140,
    gap: 10,
  },
  smallInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  smallInputText: {
    flex: 1,
    fontSize: 14,
    color: Colors.marrone,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginBottom: 12,
  },
  collabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  collabChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  collabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  expandSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expandTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  invendutoContent: {
    marginBottom: 15,
  },
  invendutoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGrey,
  },
  invendutoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.marrone,
  },
  kgInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kgInputText: {
    width: 30,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
    textAlign: 'center',
  },
  kgLabel: {
    fontSize: 12,
    color: Colors.grey,
    marginLeft: 5,
  },
  kgButtons: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  kgBtn: {
    width: 24,
    height: 24,
    backgroundColor: Colors.caramello,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kgBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.grey,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  saveButton: {
    backgroundColor: Colors.caramello,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 15,
    borderWidth: 2,
    borderColor: Colors.terracotta,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  speseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speseTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  speseRight: {
    alignItems: 'flex-end',
  },
  speseValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.terracotta,
  },
  speseTocca: {
    fontSize: 10,
    color: Colors.grey,
  },
});
