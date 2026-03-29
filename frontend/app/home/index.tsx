import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Giornata } from '../../src/store/appStore';
import { CalendarModal } from '../../src/components/CalendarModal';
import { Colors } from '../../src/theme/colors';
import { getGiornoIndex, isToday, isTomorrow } from '../../src/utils/dateUtils';

const { height } = Dimensions.get('window');

// 5 Weather icons with soft colors
const METEO_OPTIONS = [
  { icon: 'sunny', label: 'SOLE', color: '#FFB347', bgColor: '#FFF3E0' },
  { icon: 'cloud', label: 'NUVOLO', color: '#90A4AE', bgColor: '#ECEFF1' },
  { icon: 'rainy', label: 'PIOGGIA', color: '#64B5F6', bgColor: '#E3F2FD' },
  { icon: 'thunderstorm', label: 'TEMPORALE', color: '#7E57C2', bgColor: '#EDE7F6' },
  { icon: 'leaf', label: 'VENTO', color: '#81C784', bgColor: '#E8F5E9' },
];

const GIORNI = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];
const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];

export default function HomeScreen() {
  const {
    nomeTitolare,
    targetMensile,
    themeColor,
    agenda,
    collaboratori,
    speseAnnue,
    appuntiAgenda,
    storicoGiornate,
    storicoCarburante,
    salvaGiornata,
  } = useAppStore();

  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [showCalendar, setShowCalendar] = useState(false);

  // Form fields
  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [presenzaSquadra, setPresenzaSquadra] = useState<Record<string, boolean>>({});

  // Get market for current day
  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? 'FIERA' : (mercatoOggi?.mercato?.toUpperCase() || 'GIORNO OFF');

  // Format date
  const giorno = GIORNI[dataCorrente.getDay()];
  const data = `${dataCorrente.getDate()} ${MESI[dataCorrente.getMonth()]}`;

  // Initialize staff presence
  useEffect(() => {
    const presence: Record<string, boolean> = {};
    collaboratori.forEach((c) => { presence[c.nome] = true; });
    setPresenzaSquadra(presence);
  }, [collaboratori]);

  // Calculations
  const consumoKmDinamico = (() => {
    const totFuel = storicoCarburante.reduce((sum, item) => sum + item.euro, 0);
    const totKm = storicoGiornate.reduce((sum, item) => sum + (item.km || 0), 0);
    return (totKm <= 0 || totFuel <= 0) ? 0.30 : totFuel / totKm;
  })();

  const getCostoStaff = () => collaboratori.filter((c) => presenzaSquadra[c.nome]).reduce((sum, c) => sum + c.costo, 0);

  const getQuotaFissaGiornaliera = () => {
    const ggLavorativi = agenda.filter((m) => m.lavorativo).length || 6;
    const divisore = 48 * ggLavorativi;
    const totSpeseAnnue = speseAnnue.reduce((sum, s) => sum + s.importo, 0);
    const totPlateaticiAnnui = agenda.reduce((sum, m) => sum + m.p_annuo, 0);
    return (totSpeseAnnue + totPlateaticiAnnui) / divisore;
  };

  const getTotaleFisseOpe = () => {
    let costi = getQuotaFissaGiornaliera();
    if (isInPiazza && mercatoOggi) {
      costi += mercatoOggi.km * consumoKmDinamico + mercatoOggi.p_giornaliero;
    }
    return costi + getCostoStaff();
  };

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const nettoReale = lordoNum - getTotaleFisseOpe();
  const hasNotifiche = appuntiAgenda.some((n) => isToday(new Date(n.data)) || isTomorrow(new Date(n.data)));

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

  const handleSalva = () => {
    const giornata: Giornata = {
      data: dataCorrente,
      mercato: mercatoNome,
      meteo,
      km: mercatoOggi?.km || 0,
      lordo: lordoNum,
      netto: nettoReale,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: 0,
      dettaglio_staff: {},
      dettaglio_invenduto: {},
      dettaglio_fornitori: {},
    };
    salvaGiornata(giornata);
    Alert.alert('Salvato!', 'Giornata salvata!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* HEADER: Giorno + Mercato + Campanella + Status */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.headerLeft}>
            <Text style={styles.headerDay}>{giorno} {data}</Text>
            <Text style={styles.headerMarket}>{mercatoNome}</Text>
            <Text style={styles.headerOwner}>di {nomeTitolare}</Text>
          </TouchableOpacity>
          
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => hasNotifiche && Alert.alert('Notifiche', 'Hai appuntamenti!')}
            >
              <Ionicons
                name={hasNotifiche ? 'notifications' : 'notifications-outline'}
                size={22}
                color={hasNotifiche ? Colors.rosso : Colors.marrone}
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: isInPiazza ? '#E8F5E9' : '#FFEBEE' }]}
              onPress={() => setIsInPiazza(!isInPiazza)}
            >
              <View style={[styles.statusDot, { backgroundColor: isInPiazza ? Colors.verde : Colors.rosso }]} />
              <Text style={[styles.statusText, { color: isInPiazza ? '#2E7D32' : '#C62828' }]}>
                {isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* MERCATO / FIERA Switch */}
        <View style={styles.switchRow}>
          <TouchableOpacity
            style={[styles.switchBtn, !isFiera && styles.switchBtnActive]}
            onPress={() => setIsFiera(false)}
          >
            <Text style={[styles.switchText, !isFiera && styles.switchTextActive]}>MERCATO</Text>
            {!isFiera && <View style={styles.switchDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchBtn, isFiera && styles.switchBtnActive]}
            onPress={() => setIsFiera(true)}
          >
            <Text style={[styles.switchText, isFiera && styles.switchTextActive]}>FIERA</Text>
            {isFiera && <View style={styles.switchDot} />}
          </TouchableOpacity>
        </View>

        {/* 5 Weather Icons */}
        <View style={styles.meteoRow}>
          {METEO_OPTIONS.map((m) => (
            <TouchableOpacity key={m.label} onPress={() => setMeteo(m.label)} activeOpacity={0.7}>
              <View style={[
                styles.meteoCircle,
                meteo === m.label ? styles.meteoPressed : styles.meteoNormal,
                { backgroundColor: meteo === m.label ? m.color : m.bgColor }
              ]}>
                <Ionicons name={m.icon as any} size={24} color={meteo === m.label ? '#FFF' : m.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Money Grid 2x2 */}
        <View style={styles.moneyGrid}>
          <View style={styles.moneyRow}>
            <View style={styles.moneyCard}>
              <Text style={styles.moneyLabel}>LORDO</Text>
              <View style={styles.moneyInputRow}>
                <Text style={styles.euro}>€</Text>
                <TextInput
                  style={styles.moneyInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={lordo}
                  onChangeText={(v) => { setLordo(v); syncConti('lordo', v); }}
                />
              </View>
            </View>
            <View style={styles.moneyCard}>
              <Text style={styles.moneyLabel}>UTILE</Text>
              <Text style={[styles.moneyValue, { color: nettoReale >= 0 ? Colors.verde : Colors.rosso }]}>
                €{nettoReale.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.moneyRow}>
            <View style={styles.moneyCard}>
              <Text style={styles.moneyLabel}>CONTANTI</Text>
              <View style={styles.moneyInputRow}>
                <Text style={styles.euro}>€</Text>
                <TextInput
                  style={styles.moneyInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={contanti}
                  onChangeText={(v) => { setContanti(v); syncConti('contanti', v); }}
                />
              </View>
            </View>
            <View style={styles.moneyCard}>
              <Text style={styles.moneyLabel}>POS</Text>
              <View style={styles.moneyInputRow}>
                <Text style={styles.euro}>€</Text>
                <TextInput
                  style={styles.moneyInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.grey}
                  keyboardType="numeric"
                  value={pos}
                  onChangeText={(v) => { setPos(v); syncConti('pos', v); }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Buttons Row */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn}>
            <Text style={styles.quickBtnText}>SPESE</Text>
            <Text style={styles.quickBtnValue}>€{getTotaleFisseOpe().toFixed(0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn}>
            <Text style={styles.quickBtnText}>INVENDUTO</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.marrone} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="receipt" size={18} color="#FFF" />
            <Text style={styles.actionText}>SCONTRINO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={handleSalva}>
            <Ionicons name="save" size={18} color="#FFF" />
            <Text style={styles.actionText}>SALVA</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => setDataCorrente(date)}
        initialDate={dataCorrente}
        themeColor={themeColor || Colors.primary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerDay: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.marroneChiaro,
  },
  headerMarket: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.marrone,
    letterSpacing: 1,
  },
  headerOwner: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.caramello,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    padding: 8,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: Colors.bgCard,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  switchBtnActive: {
    backgroundColor: Colors.bg,
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.1,
    transform: [{ scale: 0.98 }],
  },
  switchText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  switchTextActive: {
    color: Colors.marrone,
  },
  switchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.verde,
  },
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginTop: 8,
  },
  meteoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meteoNormal: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  meteoPressed: {
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.1,
    transform: [{ scale: 0.95 }],
  },
  moneyGrid: {
    gap: 8,
    marginTop: 8,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moneyCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  moneyLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.grey,
    marginBottom: 2,
  },
  moneyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  euro: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  moneyInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: Colors.marrone,
  },
  moneyValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  quickBtnValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.terracotta,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.caramello,
    paddingVertical: 14,
    borderRadius: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.terracotta,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveBtn: {
    backgroundColor: Colors.verde,
    borderColor: '#6B8E6B',
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
