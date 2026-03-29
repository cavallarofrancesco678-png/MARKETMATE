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
  { icon: 'sunny', label: 'SOLE' },
  { icon: 'cloud', label: 'NUVOLO' },
  { icon: 'umbrella', label: 'PIOGGIA' },
  { icon: 'thunderstorm', label: 'TEMP' },
  { icon: 'leaf', label: 'VENTO' },
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
  const targetG = targetMensile / 26;
  const progresso = targetG > 0 ? Math.min(lordoNum / targetG, 1) : 0;

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

  const titoloGiorno = isFiera
    ? 'FIERA EVENTO'
    : mercatoOggi?.mercato
    ? mercatoOggi.mercato
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
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{nomeAttivita.toUpperCase()}</Text>
              <Text style={styles.headerSubtitle}>Titolare: {nomeTitolare}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="share-outline" size={24} color={Colors.grey} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  if (hasNotifiche) {
                    Alert.alert('Appuntamenti', 'Hai appuntamenti oggi o domani!');
                  }
                }}
              >
                <Ionicons
                  name={hasNotifiche ? 'notifications' : 'notifications-outline'}
                  size={24}
                  color={hasNotifiche ? Colors.rosso : Colors.grey}
                />
                {hasNotifiche && <View style={[styles.notificationDot, { backgroundColor: activeColor }]} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Mercato/Fiera Switch */}
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[
                styles.switchButton,
                !isFiera && { backgroundColor: activeColor },
              ]}
              onPress={() => setIsFiera(false)}
            >
              <Text style={[styles.switchText, !isFiera && styles.switchTextActive]}>
                MERCATO
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.switchButton,
                isFiera && { backgroundColor: activeColor },
              ]}
              onPress={() => setIsFiera(true)}
            >
              <Text style={[styles.switchText, isFiera && styles.switchTextActive]}>
                FIERA
              </Text>
            </TouchableOpacity>
          </View>

          {/* Day Card */}
          <NeuBox style={styles.dayCard}>
            <View style={styles.dayCardHeader}>
              <View>
                <Text style={[styles.dayDate, { color: activeColor }]}>
                  {formattaDataIta(dataCorrente).toUpperCase()}
                </Text>
                <Text style={styles.dayTitle}>{titoloGiorno.toUpperCase()}</Text>
              </View>
              {!isFiera && (
                <TouchableOpacity
                  onPress={() => setIsInPiazza(!isInPiazza)}
                >
                  <NeuBox padding={8} borderRadius={10}>
                    <View style={styles.statusBadge}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isInPiazza ? Colors.verde : Colors.rosso },
                        ]}
                      />
                      <Text style={styles.statusText}>
                        {isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}
                      </Text>
                    </View>
                  </NeuBox>
                </TouchableOpacity>
              )}
            </View>

            {/* Calendar Button */}
            <TouchableOpacity onPress={() => setShowCalendar(true)}>
              <NeuInset style={styles.calendarButton}>
                <Ionicons name="calendar" size={20} color={activeColor} />
                <Text style={styles.calendarText}>Vai al giorno...</Text>
                <Ionicons name="search" size={20} color={Colors.grey} />
              </NeuInset>
            </TouchableOpacity>

            {isFiera && (
              <View style={styles.fieraInputs}>
                <NeuInset>
                  <TextInput
                    style={styles.fieraInput}
                    placeholder="Nome Evento"
                    placeholderTextColor={Colors.grey}
                    value={fieraNome}
                    onChangeText={setFieraNome}
                  />
                </NeuInset>
                <View style={styles.fieraRow}>
                  <View style={styles.fieraField}>
                    <Text style={styles.fieldLabel}>KM A/R</Text>
                    <NeuInset>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="0"
                        keyboardType="numeric"
                        value={fieraKm}
                        onChangeText={setFieraKm}
                      />
                    </NeuInset>
                  </View>
                  <View style={styles.fieraField}>
                    <Text style={styles.fieldLabel}>SUOLO €</Text>
                    <NeuInset>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="0"
                        keyboardType="numeric"
                        value={fieraPlat}
                        onChangeText={setFieraPlat}
                      />
                    </NeuInset>
                  </View>
                </View>
              </View>
            )}
          </NeuBox>

          {/* Target Bar */}
          <View style={styles.targetSection}>
            <View style={styles.targetHeader}>
              <Text style={[styles.targetLabel, { color: progresso >= 1 ? Colors.verde : Colors.arancio }]}>
                {progresso >= 1 ? 'OBIETTIVO RAGGIUNTO' : 'COPERTURA COSTI'}
              </Text>
              <Text style={styles.targetPercent}>{Math.round(progresso * 100)}%</Text>
            </View>
            <View style={styles.targetBar}>
              <View
                style={[
                  styles.targetProgress,
                  {
                    width: `${Math.min(progresso * 100, 100)}%`,
                    backgroundColor: progresso >= 1 ? Colors.verde : Colors.arancio,
                  },
                ]}
              />
            </View>
          </View>

          {/* Meteo */}
          <NeuBox style={styles.meteoContainer}>
            <View style={styles.meteoRow}>
              {METEO_OPTIONS.map((m) => (
                <TouchableOpacity key={m.label} onPress={() => setMeteo(m.label)}>
                  <NeuBox
                    pressed={meteo === m.label}
                    borderRadius={50}
                    padding={12}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={24}
                      color={meteo === m.label ? activeColor : Colors.grey}
                    />
                  </NeuBox>
                </TouchableOpacity>
              ))}
            </View>
          </NeuBox>

          {/* Incassi Grid */}
          <View style={styles.incassiGrid}>
            <View style={styles.incassiRow}>
              <View style={styles.incassiField}>
                <Text style={styles.fieldLabel}>LORDO TOT.</Text>
                <NeuInset>
                  <TextInput
                    style={[styles.incassoInput, { color: activeColor }]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={lordo}
                    onChangeText={(v) => {
                      setLordo(v);
                      syncConti('lordo', v);
                    }}
                  />
                </NeuInset>
              </View>
              <View style={styles.incassiField}>
                <Text style={styles.fieldLabel}>UTILE</Text>
                <NeuInset>
                  <View style={styles.staticField}>
                    <Text
                      style={[
                        styles.incassoValue,
                        { color: nettoReale >= 0 ? Colors.verde : Colors.rosso },
                      ]}
                    >
                      {nettoReale.toFixed(2)}€
                    </Text>
                  </View>
                </NeuInset>
              </View>
            </View>
            <View style={styles.incassiRow}>
              <View style={styles.incassiField}>
                <Text style={styles.fieldLabel}>CONTANTI</Text>
                <NeuInset>
                  <TextInput
                    style={[styles.incassoInput, { color: activeColor }]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={contanti}
                    onChangeText={(v) => {
                      setContanti(v);
                      syncConti('contanti', v);
                    }}
                  />
                </NeuInset>
              </View>
              <View style={styles.incassiField}>
                <Text style={styles.fieldLabel}>POS</Text>
                <NeuInset>
                  <TextInput
                    style={[styles.incassoInput, { color: activeColor }]}
                    placeholder="0.00"
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
          </View>

          {/* Spese Section */}
          <NeuBox style={styles.speseSection}>
            <View style={styles.speseHeader}>
              <Text style={styles.speseTitle}>SPESE FISSE E OPERATIVE</Text>
              <Text style={styles.speseTotal}>€ {getTotaleFisseOpe().toFixed(2)}</Text>
            </View>
          </NeuBox>

          {/* Staff */}
          {collaboratori.length > 0 && (
            <View style={styles.staffSection}>
              <Text style={styles.staffTitle}>SQUADRA OGGI</Text>
              <View style={styles.staffGrid}>
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
                    <NeuBox
                      pressed={presenzaSquadra[c.nome]}
                      borderRadius={50}
                      padding={12}
                      style={styles.staffChip}
                    >
                      <Text
                        style={[
                          styles.staffName,
                          presenzaSquadra[c.nome] && { color: activeColor },
                        ]}
                      >
                        {c.nome}
                      </Text>
                    </NeuBox>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Report Button */}
          <TouchableOpacity onPress={() => Alert.alert('Report AI', 'Funzionalità AI in arrivo!')}>
            <NeuBox style={styles.reportButton}>
              <Ionicons name="bar-chart" size={22} color={activeColor} />
              <Text style={[styles.reportText, { color: activeColor }]}>GENERA REPORT</Text>
            </NeuBox>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: activeColor }]} onPress={handleSalvaGiornata}>
            <Text style={styles.saveText}>SALVA GIORNATA</Text>
          </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    marginTop: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.grey,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bgDark,
    borderRadius: 20,
    padding: 4,
    marginBottom: 20,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  switchTextActive: {
    color: Colors.white,
  },
  dayCard: {
    marginBottom: 20,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.marrone,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarText: {
    flex: 1,
    fontSize: 13,
    color: Colors.grey,
  },
  fieraInputs: {
    marginTop: 15,
    gap: 10,
  },
  fieraInput: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.marrone,
    padding: 5,
  },
  fieraRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieraField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 4,
  },
  smallInput: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
    padding: 5,
  },
  targetSection: {
    marginBottom: 20,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  targetPercent: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  targetBar: {
    height: 10,
    backgroundColor: Colors.bgDark,
    borderRadius: 5,
    overflow: 'hidden',
  },
  targetProgress: {
    height: '100%',
    borderRadius: 5,
  },
  meteoContainer: {
    marginBottom: 20,
  },
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  incassiGrid: {
    gap: 15,
    marginBottom: 20,
  },
  incassiRow: {
    flexDirection: 'row',
    gap: 15,
  },
  incassiField: {
    flex: 1,
  },
  incassoInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
    padding: 5,
  },
  staticField: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  incassoValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  speseSection: {
    marginBottom: 20,
  },
  speseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speseTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.marrone,
  },
  speseTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.rosso,
  },
  staffSection: {
    marginBottom: 30,
  },
  staffTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    textAlign: 'center',
    marginBottom: 10,
  },
  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  staffChip: {
    paddingHorizontal: 18,
  },
  staffName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  reportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  reportText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  saveText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
