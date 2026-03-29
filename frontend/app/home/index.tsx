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

// 5 Weather icons with soft colors like the reference
const METEO_OPTIONS = [
  { icon: 'sunny', label: 'SOLE', color: '#FFB347', bgColor: '#FFF3E0' },
  { icon: 'cloud', label: 'NUVOLO', color: '#90A4AE', bgColor: '#ECEFF1' },
  { icon: 'rainy', label: 'PIOGGIA', color: '#64B5F6', bgColor: '#E3F2FD' },
  { icon: 'thunderstorm', label: 'TEMPORALE', color: '#7E57C2', bgColor: '#EDE7F6' },
  { icon: 'leaf', label: 'VENTO', color: '#81C784', bgColor: '#E8F5E9' },
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
  const [showSpeseExtra, setShowSpeseExtra] = useState(false);

  // Form fields
  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [fieraNome, setFieraNome] = useState('');
  const [fieraKm, setFieraKm] = useState('');
  const [fieraPlat, setFieraPlat] = useState('');
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

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const contantiNum = parseFloat(contanti.replace(',', '.')) || 0;
  const posNum = parseFloat(pos.replace(',', '.')) || 0;
  const nettoReale = lordoNum - getTotaleFisseOpe();

  // Progress calculation
  const targetG = targetMensile / 26;
  const progresso = targetG > 0 ? Math.min(lordoNum / targetG, 1) : 0;

  // Check notifications
  const hasNotifiche = appuntiAgenda.some(
    (n) => isToday(new Date(n.data)) || isTomorrow(new Date(n.data))
  );

  const syncConti = (origin: string, value: string) => {
    const l = parseFloat(lordo.replace(',', '.')) || 0;
    if (origin === 'lordo') {
      const newLordo = parseFloat(value.replace(',', '.')) || 0;
      const p = parseFloat(pos.replace(',', '.')) || 0;
      if (newLordo - p >= 0) setContanti((newLordo - p).toFixed(2));
    } else if (origin === 'contanti') {
      const newContanti = parseFloat(value.replace(',', '.')) || 0;
      if (l - newContanti >= 0) setPos((l - newContanti).toFixed(2));
    } else if (origin === 'pos') {
      const newPos = parseFloat(value.replace(',', '.')) || 0;
      if (l - newPos >= 0) setContanti((l - newPos).toFixed(2));
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
      mercato: isFiera ? fieraNome || 'Fiera' : mercatoOggi?.mercato || 'Nessuno',
      meteo,
      km: kmOggi,
      lordo: lordoNum,
      netto: nettoReale,
      contanti: contantiNum,
      pos: posNum,
      spese_extra: 0,
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

  const statusText = isInPiazza ? 'IN PIAZZA' : 'ASSENTE';

  // Pressed button component
  const PressedButton = ({ 
    children, 
    onPress, 
    pressed = false, 
    style = {} 
  }: { 
    children: React.ReactNode; 
    onPress: () => void; 
    pressed?: boolean;
    style?: any;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[
        styles.pressedButton,
        pressed && styles.pressedButtonActive,
        style
      ]}>
        {children}
      </View>
    </TouchableOpacity>
  );

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
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>{nomeAttivita.toUpperCase()}</Text>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => hasNotifiche && Alert.alert('Notifiche', 'Hai appuntamenti!')}
              >
                <Ionicons
                  name={hasNotifiche ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={hasNotifiche ? Colors.rosso : Colors.marrone}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              {formattaDataIta(dataCorrente).toUpperCase()} - {mercatoNome}
            </Text>
            <Text style={styles.headerOwner}>di {nomeTitolare}</Text>
          </View>

          {/* Status Badge */}
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isInPiazza ? '#E8F5E9' : '#FFEBEE' }
            ]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: isInPiazza ? Colors.verde : Colors.rosso }
              ]} />
              <Text style={[
                styles.statusText,
                { color: isInPiazza ? '#2E7D32' : '#C62828' }
              ]}>
                {statusText}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Riepilogo Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>RIEPILOGO GIORNALIERO</Text>

            {/* 5 Weather Icons - NO LABELS */}
            <View style={styles.meteoContainer}>
              {METEO_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  onPress={() => setMeteo(m.label)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.meteoCircle,
                      meteo === m.label ? styles.meteoCirclePressed : styles.meteoCircleNormal,
                      { backgroundColor: meteo === m.label ? m.color : m.bgColor }
                    ]}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={26}
                      color={meteo === m.label ? Colors.white : m.color}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* MERCATO / FIERA Switch */}
            <View style={styles.switchRow}>
              <PressedButton
                onPress={() => setIsFiera(false)}
                pressed={!isFiera}
                style={styles.switchBtn}
              >
                <Text style={[
                  styles.switchText,
                  !isFiera && styles.switchTextActive
                ]}>MERCATO</Text>
                {!isFiera && <View style={styles.switchIndicator} />}
              </PressedButton>
              <PressedButton
                onPress={() => setIsFiera(true)}
                pressed={isFiera}
                style={styles.switchBtn}
              >
                <Text style={[
                  styles.switchText,
                  isFiera && styles.switchTextActive
                ]}>FIERA</Text>
                {isFiera && <View style={styles.switchIndicator} />}
              </PressedButton>
            </View>

            {/* FIERA inputs if needed */}
            {isFiera && (
              <View style={styles.fieraInputs}>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>NOME FIERA</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Es: Fiera di Settembre"
                    placeholderTextColor={Colors.grey}
                    value={fieraNome}
                    onChangeText={setFieraNome}
                  />
                </View>
                <View style={styles.fieraRow}>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>KM A/R</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={fieraKm}
                      onChangeText={setFieraKm}
                    />
                  </View>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>PLATEATICO €</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={fieraPlat}
                      onChangeText={setFieraPlat}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Main 2x2 Grid: LORDO, UTILE, CONTANTI, POS */}
            <View style={styles.moneyGrid}>
              <View style={styles.moneyRow}>
                <View style={styles.moneyCard}>
                  <Text style={styles.moneyLabel}>LORDO</Text>
                  <View style={styles.moneyInputRow}>
                    <Text style={styles.euroPre}>€</Text>
                    <TextInput
                      style={styles.moneyInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.grey}
                      keyboardType="numeric"
                      value={lordo}
                      onChangeText={(v) => {
                        setLordo(v);
                        syncConti('lordo', v);
                      }}
                    />
                  </View>
                </View>
                <View style={styles.moneyCard}>
                  <Text style={styles.moneyLabel}>UTILE</Text>
                  <Text style={[
                    styles.moneyValue,
                    { color: nettoReale >= 0 ? Colors.verde : Colors.rosso }
                  ]}>
                    €{nettoReale.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.moneyRow}>
                <View style={styles.moneyCard}>
                  <Text style={styles.moneyLabel}>CONTANTI</Text>
                  <View style={styles.moneyInputRow}>
                    <Text style={styles.euroPre}>€</Text>
                    <TextInput
                      style={styles.moneyInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.grey}
                      keyboardType="numeric"
                      value={contanti}
                      onChangeText={(v) => {
                        setContanti(v);
                        syncConti('contanti', v);
                      }}
                    />
                  </View>
                </View>
                <View style={styles.moneyCard}>
                  <Text style={styles.moneyLabel}>POS</Text>
                  <View style={styles.moneyInputRow}>
                    <Text style={styles.euroPre}>€</Text>
                    <TextInput
                      style={styles.moneyInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.grey}
                      keyboardType="numeric"
                      value={pos}
                      onChangeText={(v) => {
                        setPos(v);
                        syncConti('pos', v);
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* SPESE Section */}
          <Text style={styles.sectionHeader}>SPESE</Text>
          
          <View style={styles.speseRow}>
            <PressedButton
              onPress={() => setShowSpeseExtra(!showSpeseExtra)}
              pressed={showSpeseExtra}
              style={styles.speseBtn}
            >
              <Text style={styles.speseBtnText}>SPESE EXTRA</Text>
              <Ionicons name="chevron-down" size={18} color={Colors.marrone} />
            </PressedButton>
            
            <TouchableOpacity style={styles.speseBtn} activeOpacity={0.8}>
              <View style={styles.pressedButton}>
                <Text style={styles.speseBtnText}>SPESE FISSE</Text>
                <Text style={styles.speseValue}>€{getTotaleFisseOpe().toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* INVENDUTO / RESI */}
          <PressedButton
            onPress={() => setShowInvenduto(!showInvenduto)}
            pressed={showInvenduto}
            style={styles.invendutoBtn}
          >
            <Text style={styles.invendutoBtnText}>INVENDUTO / RESI</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.marrone} />
          </PressedButton>

          {showInvenduto && isAlimentare && (
            <View style={styles.invendutoContent}>
              {fornitori.length > 0 ? (
                fornitori.flatMap((f) =>
                  (f.prodotti || []).map((p) => (
                    <View key={`${f.nome}-${p.nome}`} style={styles.invendutoRow}>
                      <Text style={styles.invendutoLabel}>{p.nome}</Text>
                      <View style={styles.kgControls}>
                        <TouchableOpacity style={styles.kgBtn}>
                          <Text style={styles.kgBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.kgValue}>0 KG</Text>
                        <TouchableOpacity style={styles.kgBtn}>
                          <Text style={styles.kgBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )
              ) : (
                <Text style={styles.emptyText}>Configura prodotti nelle impostazioni</Text>
              )}
            </View>
          )}

          {/* Collaboratori */}
          {collaboratori.length > 0 && (
            <View style={styles.collabSection}>
              <Text style={styles.sectionHeader}>COLLABORATORI OGGI</Text>
              <View style={styles.collabRow}>
                {collaboratori.map((c) => (
                  <PressedButton
                    key={c.nome}
                    onPress={() => {
                      setPresenzaSquadra((prev) => ({
                        ...prev,
                        [c.nome]: !prev[c.nome],
                      }));
                    }}
                    pressed={presenzaSquadra[c.nome]}
                    style={styles.collabChip}
                  >
                    <Text style={[
                      styles.collabText,
                      presenzaSquadra[c.nome] && styles.collabTextActive
                    ]}>
                      {c.nome.toUpperCase()}
                    </Text>
                  </PressedButton>
                ))}
              </View>
            </View>
          )}

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {progresso >= 1 ? 'OBIETTIVO RAGGIUNTO!' : 'COPERTURA COSTI'}
              </Text>
              <Text style={styles.progressPercent}>{Math.round(progresso * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(progresso * 100, 100)}%`,
                  backgroundColor: progresso >= 1 ? Colors.verde : Colors.caramello
                }
              ]} />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <View style={styles.actionBtnInner}>
                <Ionicons name="receipt" size={18} color={Colors.white} />
                <Text style={styles.actionBtnText}>SCONTRINO</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSalvaGiornata} activeOpacity={0.7}>
              <View style={styles.actionBtnInner}>
                <Ionicons name="save" size={18} color={Colors.white} />
                <Text style={styles.actionBtnText}>SALVA</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Report Button */}
          <TouchableOpacity 
            style={styles.reportBtn}
            onPress={() => Alert.alert('Report AI', 'Funzionalità in arrivo!')}
            activeOpacity={0.7}
          >
            <View style={styles.reportBtnInner}>
              <Ionicons name="globe" size={22} color={Colors.marrone} />
              <Text style={styles.reportBtnText}>GENERA REPORT</Text>
            </View>
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
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 2,
  },
  notificationBtn: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.marroneChiaro,
    marginTop: 4,
  },
  headerOwner: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.caramello,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginBottom: 15,
    textAlign: 'center',
  },
  meteoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  meteoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meteoCircleNormal: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  meteoCirclePressed: {
    shadowColor: '#000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    transform: [{ scale: 0.95 }],
  },
  switchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  switchText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  switchTextActive: {
    color: Colors.marrone,
  },
  switchIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.verde,
  },
  fieraInputs: {
    marginBottom: 15,
    gap: 10,
  },
  fieraRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputField: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 4,
  },
  textInput: {
    fontSize: 14,
    color: Colors.marrone,
    fontWeight: '600',
  },
  moneyGrid: {
    gap: 10,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moneyCard: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moneyLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 5,
  },
  moneyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  euroPre: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginRight: 4,
  },
  moneyInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: Colors.marrone,
  },
  moneyValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginBottom: 10,
    marginTop: 5,
  },
  speseRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  speseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speseBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  speseValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.terracotta,
  },
  pressedButton: {
    backgroundColor: Colors.bgCard,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  pressedButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    backgroundColor: Colors.bg,
    transform: [{ scale: 0.98 }],
  },
  invendutoBtn: {
    marginBottom: 10,
  },
  invendutoBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  invendutoContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: 15,
    padding: 12,
    marginBottom: 15,
  },
  invendutoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGrey,
  },
  invendutoLabel: {
    fontSize: 14,
    color: Colors.marrone,
  },
  kgControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kgBtn: {
    width: 28,
    height: 28,
    backgroundColor: Colors.caramello,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  kgBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  kgValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
    minWidth: 50,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.grey,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 15,
  },
  collabSection: {
    marginTop: 10,
    marginBottom: 15,
  },
  collabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  collabChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  collabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  collabTextActive: {
    color: Colors.marrone,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.caramello,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  progressBar: {
    height: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
  },
  actionBtn: {
    flex: 1,
  },
  actionBtnInner: {
    backgroundColor: Colors.caramello,
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 2,
    borderColor: Colors.terracotta,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  reportBtn: {
    marginBottom: 10,
  },
  reportBtnInner: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  reportBtnText: {
    color: Colors.marrone,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
