import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';
import { CalendarModal } from '../../src/components/CalendarModal';

const GIORNI = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];
const MESI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/* ─── WEATHER ICONS (MaterialCommunityIcons) ─── */
const WEATHER_ICONS: Array<{ icon: string; label: string }> = [
  { icon: 'weather-sunny', label: 'SOLE' },
  { icon: 'weather-partly-cloudy', label: 'VAR' },
  { icon: 'weather-rainy', label: 'PIOGGIA' },
  { icon: 'weather-lightning', label: 'TEMP' },
  { icon: 'weather-windy', label: 'VENTO' },
];

/* ─── Mini charts ─── */
const MiniLine = () => (
  <Svg width="60" height="35" viewBox="0 0 65 40">
    <Path d="M2 32 Q14 28 18 18 T32 22 T46 12 T63 5" stroke="#3A8AB0" strokeWidth="2.2" fill="none" />
    <Path d="M2 36 Q16 34 24 28 T38 30 T52 22 T63 18" stroke="#E89060" strokeWidth="1.8" fill="none" />
  </Svg>
);
const MiniBar = () => (
  <Svg width="55" height="35" viewBox="0 0 60 40">
    <Path d="M2 22h7v18H2z" fill="#5CC0B8" rx="2" />
    <Path d="M12 26h7v14h-7z" fill="#E8A060" rx="2" />
    <Path d="M22 14h7v26h-7z" fill="#5CC0B8" rx="2" />
    <Path d="M32 8h7v32h-7z" fill="#E8A060" rx="2" />
    <Path d="M42 4h7v36h-7z" fill="#5CC0B8" rx="2" />
    <Path d="M52 14h7v26h-7z" fill="#E8A060" rx="2" />
  </Svg>
);

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata } =
    useAppStore();
  const { height: screenH } = useWindowDimensions();
  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenze, setPresenze] = useState<Record<string, boolean>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [chartMode, setChartMode] = useState<'mese' | 'anno' | 'confronto'>('anno');

  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [speseExtra, setSpeseExtra] = useState('');
  const [invenduto, setInvenduto] = useState('');

  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? 'Fiera' : mercatoOggi?.mercato || 'Magenta';
  const giorno = GIORNI[dataCorrente.getDay()];
  const data = `${dataCorrente.getDate()} ${MESI[dataCorrente.getMonth()]}`;

  useEffect(() => {
    const p: Record<string, boolean> = {};
    collaboratori.forEach((c) => { p[c.nome] = false; });
    setPresenze(p);
  }, [collaboratori]);

  const speseFisse = (() => {
    const gg = agenda.filter((m) => m.lavorativo).length || 6;
    const tot = speseAnnue.reduce((s, x) => s + x.importo, 0) + agenda.reduce((s, m) => s + m.p_annuo, 0);
    return tot / (48 * gg);
  })();

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const speseExtraNum = parseFloat(speseExtra.replace(',', '.')) || 0;
  const invendutoNum = parseFloat(invenduto.replace(',', '.')) || 0;
  const utile = lordoNum - speseFisse - speseExtraNum - invendutoNum;
  const collabNames = collaboratori.length > 0
    ? collaboratori.map((c) => c.nome)
    : ['DAVIDE', 'ANTONIO', 'NICOLÒ'];

  const handleContanti = (val: string) => {
    setContanti(val);
    const c = parseFloat(val.replace(',', '.')) || 0;
    if (lordoNum > 0) setPos(Math.max(0, Math.round(lordoNum - c)).toString());
  };
  const handlePos = (val: string) => {
    setPos(val);
    const p = parseFloat(val.replace(',', '.')) || 0;
    if (lordoNum > 0) setContanti(Math.max(0, Math.round(lordoNum - p)).toString());
  };

  const handleSalva = () => {
    salvaGiornata({
      data: dataCorrente, mercato: mercatoNome, meteo,
      km: mercatoOggi?.km || 0, lordo: lordoNum, netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraNum,
      dettaglio_staff: presenze,
      dettaglio_invenduto: { totale: invendutoNum },
      dettaglio_fornitori: {},
    } as any);
    Alert.alert('Salvato!', 'Giornata salvata con successo.');
  };

  /* ─── Dynamic sizing based on screen height ─── */
  const compact = screenH < 750;
  const weatherSize = compact ? 42 : 48;
  const cardPadV = compact ? 7 : 9;
  const togglePadV = compact ? 8 : 10;

  return (
    <View style={s.root}>
      {/* ═══════ BLOCK 1: HEADER ═══════ */}
      <View>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.badgesAbsolute}>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>Nome</Text>
            <Text style={s.badgeTxt}>Azienda</Text>
          </View>
          <View style={s.bell}>
            <Ionicons name="notifications" size={14} color="#FFF" />
            <View style={s.bellDot} />
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <View style={s.dateRow}>
            <Ionicons name="calendar" size={20} color="#1E7F85" />
            <Text style={s.dateTxt}>{giorno.toUpperCase()} {data.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ═══════ BLOCK 2: TOGGLE + WEATHER ═══════ */}
      <View>
        <View style={s.toggleRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsFiera(false)}>
            <View style={[s.toggle, { paddingVertical: togglePadV }, !isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, !isFiera && { color: '#FFF' }]}>Mercato</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsFiera(true)}>
            <View style={[s.toggle, { paddingVertical: togglePadV }, isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, isFiera && { color: '#FFF' }]}>Fiera</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazzaBtn, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={s.meteoRow}>
          {WEATHER_ICONS.map((w, i) => {
            const sel = meteo === w.label;
            return (
              <TouchableOpacity key={i} onPress={() => setMeteo(w.label)} activeOpacity={0.7}>
                <View style={[s.meteo, { width: weatherSize, height: weatherSize, borderRadius: weatherSize / 2 }, sel && s.meteoOn]}>
                  <MaterialCommunityIcons name={w.icon as any} size={compact ? 22 : 24} color={sel ? '#FFF' : '#2A4A5A'} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══════ BLOCK 3: COLLABORATORI ═══════ */}
      <View>
        <Text style={s.secLabel}>COLLABORATORI</Text>
        <View style={s.collabRow}>
          {collabNames.map((n, i) => {
            const on = presenze[n];
            return (
              <TouchableOpacity key={i} onPress={() => setPresenze((p) => ({ ...p, [n]: !p[n] }))}>
                <View style={[s.collab, on && s.collabOn]}>
                  <Text style={[s.collabTxt, on && { color: '#FFF' }]}>{n.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══════ BLOCK 4: DATA GRID ═══════ */}
      <View style={s.grid}>
        <View style={s.gridRow}>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardBold}>LORDO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={setLordo} selectTextOnFocus />
          </View>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardBold}>UTILE</Text>
            <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>€{Math.round(utile)}</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardLbl}>CONTANTI</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} selectTextOnFocus />
          </View>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardLbl}>POSS</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} selectTextOnFocus />
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardLbl}>SPESE EXTRA</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} selectTextOnFocus />
          </View>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardLbl}>SPESE FISSE</Text>
            <Text style={s.cardVal}>€{Math.round(speseFisse)}</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { paddingVertical: cardPadV }]}>
            <Text style={s.cardLbl}>INVENDUTO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} selectTextOnFocus />
          </View>
          <TouchableOpacity style={[s.card, { paddingVertical: cardPadV, backgroundColor: '#1E7F85' }]} activeOpacity={0.7} onPress={() => Alert.alert('Buongiorno!', 'Connessione AI in arrivo...')}>
            <Ionicons name="globe-outline" size={15} color="#FFF" />
            <Text style={[s.cardBold, { color: '#FFF', fontSize: 12 }]}>BUONGIORNO</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══════ BLOCK 5: STORICO + FILTERS + SALVA ═══════ */}
      <View>
        <TouchableOpacity activeOpacity={0.85} style={s.storico}>
          <View style={s.storicoL}>
            <MiniLine />
          </View>
          <View style={s.storicoC}>
            <Text style={s.storicoT}>STORICO MERCATO</Text>
            <Text style={s.storicoDay}>del {giorno}</Text>
            <Text style={s.storicoVal}>€44.130 <Text style={{ color: '#2AA090', fontSize: 11 }}>(+14%)</Text></Text>
            <Text style={s.storicoSub}>Media scontrino: €18.50</Text>
          </View>
          <View style={s.storicoR}>
            <MiniBar />
          </View>
        </TouchableOpacity>
        <View style={s.filterRow}>
          {([
            ['mese', 'MESE'],
            ['anno', 'ANNO', '(12 Mesi)'],
            ['confronto', 'CONFRONTO', 'Anno Prec.'],
          ] as const).map(([k, l, sub]) => {
            const on = chartMode === k;
            return (
              <TouchableOpacity key={k} style={[s.filterBtn, on && s.filterOn]} onPress={() => setChartMode(k as any)}>
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{l}</Text>
                {sub && <Text style={[s.filterSub, on && { color: 'rgba(255,255,255,0.7)' }]}>{sub}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salva}>
          <Ionicons name="save-outline" size={15} color="#FFF" />
          <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(date) => { setDataCorrente(date); setShowCalendar(false); }}
        initialDate={dataCorrente}
        themeColor="#1E7F85"
        title="SELEZIONA DATA"
      />
    </View>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#D8EDE5',
    paddingHorizontal: 14,
    paddingTop: 34,
    paddingBottom: 4,
    justifyContent: 'space-between',
  },

  /* Header */
  marketName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  badgesAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badge: {
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 7, fontWeight: '700' },
  bell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E44',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  dateTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2A5050',
  },

  /* Toggle row */
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  toggle: {
    backgroundColor: '#E0DBC8',
    borderRadius: 26,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(155,145,125,0.55), -5px -5px 12px rgba(255,255,250,0.9)',
  },
  toggleOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(15,55,60,0.6), -4px -4px 10px rgba(45,120,125,0.35)',
  },
  toggleTxt: { fontSize: 13, fontWeight: '700', color: '#4A3A2A' },
  piazzaBtn: {
    backgroundColor: '#1E7F85',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  piazzaTxt: { color: '#FFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  /* Weather */
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  meteo: {
    backgroundColor: '#A0BED0',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '7px 7px 16px rgba(55,85,105,0.55), -6px -6px 14px rgba(200,230,245,0.85)',
  },
  meteoOn: {
    backgroundColor: '#5A8EA0',
    // @ts-ignore
    boxShadow: 'inset 3px 3px 8px rgba(30,50,65,0.45), inset -3px -3px 7px rgba(80,140,160,0.35)',
  },

  /* Section label */
  secLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#5A7575',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 2,
  },

  /* Collaboratori */
  collabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  collab: {
    backgroundColor: '#E0DBC8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(155,145,125,0.55), -5px -5px 12px rgba(255,255,250,0.9)',
  },
  collabOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: 'inset 3px 3px 7px rgba(10,40,45,0.4), inset -3px -3px 6px rgba(45,120,125,0.3)',
  },
  collabTxt: { fontSize: 11, fontWeight: '700', color: '#4A3A2A' },

  /* Grid */
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#EDE8DA',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  cardLbl: { fontSize: 10, fontWeight: '600', color: '#4A4A40' },
  cardBold: { fontSize: 12, fontWeight: '800', color: '#1A3535' },
  cardInp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3535',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  cardVal: { fontSize: 12, fontWeight: '700', color: '#1A3535' },
  cardValBold: { fontSize: 13, fontWeight: '800' },

  /* Storico */
  storico: {
    backgroundColor: '#EDE8DA',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  storicoL: { flex: 0.8, alignItems: 'center' },
  storicoC: { flex: 1.4, alignItems: 'center' },
  storicoR: { flex: 0.8, alignItems: 'center' },
  storicoT: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 15, fontWeight: '900', color: '#1A3535' },
  storicoSub: { fontSize: 8, fontWeight: '600', color: '#7A9090', marginTop: 1 },

  /* Filter buttons */
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  filterBtn: {
    flex: 1,
    backgroundColor: '#E0DBC8',
    borderRadius: 10,
    paddingVertical: 5,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(155,145,125,0.45), -5px -5px 12px rgba(255,255,250,0.85)',
  },
  filterOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(15,55,60,0.5), -4px -4px 10px rgba(45,120,125,0.35)',
  },
  filterTxt: { fontSize: 8, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterSub: { fontSize: 5, fontWeight: '600', color: '#7A6A5A', textAlign: 'center' },

  /* Salva */
  salva: {
    backgroundColor: '#1E7F85',
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  salvaTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
