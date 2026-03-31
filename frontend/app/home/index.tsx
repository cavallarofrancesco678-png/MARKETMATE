import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';
import { CalendarModal } from '../../src/components/CalendarModal';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const WEATHER_ICONS: Array<{ icon: string; label: string }> = [
  { icon: 'weather-sunny', label: 'SOLE' },
  { icon: 'weather-partly-cloudy', label: 'VAR' },
  { icon: 'weather-rainy', label: 'PIOGGIA' },
  { icon: 'weather-lightning', label: 'TEMP' },
  { icon: 'weather-windy', label: 'VENTO' },
];

/* ─── Mini charts ─── */
const MiniLine = () => (
  <Svg width="60" height="36" viewBox="0 0 65 40">
    <Path d="M2 32 Q14 28 18 18 T32 22 T46 12 T63 5" stroke="#3A8AB0" strokeWidth="2.2" fill="none" />
    <Path d="M2 36 Q16 34 24 28 T38 30 T52 22 T63 18" stroke="#E89060" strokeWidth="1.8" fill="none" />
  </Svg>
);
const MiniBar = () => (
  <Svg width="55" height="36" viewBox="0 0 60 40">
    <Path d="M2 22h7v18H2z" fill="#5CC0B8" rx="2" />
    <Path d="M12 26h7v14h-7z" fill="#E8A060" rx="2" />
    <Path d="M22 14h7v26h-7z" fill="#5CC0B8" rx="2" />
    <Path d="M32 8h7v32h-7z" fill="#E8A060" rx="2" />
    <Path d="M42 4h7v36h-7z" fill="#5CC0B8" rx="2" />
    <Path d="M52 14h7v26h-7z" fill="#E8A060" rx="2" />
  </Svg>
);

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata } = useAppStore();
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
  const collabNames = collaboratori.length > 0 ? collaboratori.map((c) => c.nome) : ['DAVIDE', 'ANTONIO', 'NICOLÒ'];

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

  /* ─── VH Proportional Layout ─── */
  const TAB_BAR = 80;
  const contentH = screenH - TAB_BAR;
  const vh = contentH / 100;

  const wSize = Math.min(8 * vh * 0.7, 46); // weather icon size fits in 8vh
  const gridRowH = (30 * vh - 3 * 15) / 4;  // 4 rows, 3 gaps of 15px

  return (
    <View style={s.root}>
      {/* ═══ HEADER — 10vh ═══ */}
      <View style={[s.section, { height: 10 * vh, justifyContent: 'flex-end' }]}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.badgesAbsolute}>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>Nome</Text>
            <Text style={s.badgeTxt}>Azienda</Text>
          </View>
          <View style={s.bell}>
            <Ionicons name="notifications" size={13} color="#FFF" />
            <View style={s.bellDot} />
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <View style={s.dateRow}>
            <Ionicons name="calendar" size={18} color="#1E7F85" />
            <Text style={s.dateTxt}>{giorno.toUpperCase()} {data.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* margin 2vh */}
      <View style={{ height: 2 * vh }} />

      {/* ═══ TOGGLE — 8vh ═══ */}
      <View style={[s.section, { height: 8 * vh, justifyContent: 'center' }]}>
        <View style={s.toggleRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsFiera(false)}>
            <View style={[s.toggle, !isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, !isFiera && { color: '#FFF' }]}>Mercato</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsFiera(true)}>
            <View style={[s.toggle, isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, isFiera && { color: '#FFF' }]}>Fiera</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazzaBtn, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* margin 3vh */}
      <View style={{ height: 3 * vh }} />

      {/* ═══ WEATHER — 8vh ═══ */}
      <View style={[s.section, { height: 8 * vh, justifyContent: 'center' }]}>
        <View style={s.meteoRow}>
          {WEATHER_ICONS.map((w, i) => {
            const sel = meteo === w.label;
            return (
              <TouchableOpacity key={i} onPress={() => setMeteo(w.label)} activeOpacity={0.7}>
                <View style={[s.meteo, { width: wSize, height: wSize, borderRadius: wSize / 2 }, sel && s.meteoOn]}>
                  <MaterialCommunityIcons name={w.icon as any} size={wSize * 0.5} color={sel ? '#FFF' : '#2A4A5A'} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* margin 3vh */}
      <View style={{ height: 3 * vh }} />

      {/* ═══ COLLABORATORI — 7vh ═══ */}
      <View style={[s.section, { height: 7 * vh, justifyContent: 'center' }]}>
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

      {/* margin 4vh — DISTACCO dal centro */}
      <View style={{ height: 4 * vh }} />

      {/* ═══ GRIGLIA DATI — 30vh ═══ */}
      <View style={[s.section, { height: 30 * vh, justifyContent: 'space-between' }]}>
        <View style={s.gridRow}>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardBold}>LORDO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={setLordo} selectTextOnFocus />
          </View>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardBold}>UTILE</Text>
            <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>€{Math.round(utile)}</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardLbl}>CONTANTI</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} selectTextOnFocus />
          </View>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardLbl}>POSS</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} selectTextOnFocus />
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardLbl}>SPESE EXTRA</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} selectTextOnFocus />
          </View>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardLbl}>SPESE FISSE</Text>
            <Text style={s.cardVal}>€{Math.round(speseFisse)}</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          <View style={[s.card, { height: gridRowH }]}>
            <Text style={s.cardLbl}>INVENDUTO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} selectTextOnFocus />
          </View>
          <TouchableOpacity style={[s.card, { height: gridRowH, backgroundColor: '#1E7F85' }]} activeOpacity={0.7} onPress={() => Alert.alert('Buongiorno!', 'Connessione AI in arrivo...')}>
            <Ionicons name="globe-outline" size={14} color="#FFF" />
            <Text style={[s.cardBold, { color: '#FFF', fontSize: 11 }]}>BUONGIORNO</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* margin 3vh */}
      <View style={{ height: 3 * vh }} />

      {/* ═══ GRAFICO AMPLIATO — 15vh ═══ */}
      <View style={[s.section, { height: 15 * vh }]}>
        <TouchableOpacity activeOpacity={0.85} style={[s.storico, { flex: 1, marginBottom: 5 }]}>
          <View style={s.storicoL}><MiniLine /></View>
          <View style={s.storicoC}>
            <Text style={s.storicoT}>STORICO MERCATO</Text>
            <Text style={s.storicoDay}>del {giorno}</Text>
            <Text style={s.storicoVal}>€44.130 <Text style={{ color: '#2AA090', fontSize: 10 }}>(+14%)</Text></Text>
            <Text style={s.storicoSub}>Media scontrino: €18.50</Text>
          </View>
          <View style={s.storicoR}><MiniBar /></View>
        </TouchableOpacity>
        <View style={s.filterRow}>
          {([['mese', 'MESE'], ['anno', 'ANNO', '(12 Mesi)'], ['confronto', 'CONFRONTO', 'Anno Prec.']] as const).map(([k, l, sub]) => {
            const on = chartMode === k;
            return (
              <TouchableOpacity key={k} style={[s.filterBtn, on && s.filterOn]} onPress={() => setChartMode(k as any)}>
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{l}</Text>
                {sub && <Text style={[s.filterSub, on && { color: 'rgba(255,255,255,0.7)' }]}>{sub}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══ SALVA GIORNATA (between chart and navbar) ═══ */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salva}>
        <Ionicons name="save-outline" size={14} color="#FFF" />
        <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
      </TouchableOpacity>

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
    paddingHorizontal: 20,
  },

  section: {
    width: '100%',
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
    gap: 4,
  },
  badge: {
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 7, fontWeight: '700' },
  bell: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E44',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2,
  },
  dateTxt: { fontSize: 12, fontWeight: '700', color: '#2A5050' },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  toggle: {
    backgroundColor: '#E0DBC8',
    borderRadius: 24,
    paddingVertical: 10,
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
    paddingVertical: 8,
  },
  piazzaTxt: { color: '#FFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  /* Weather */
  meteoRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
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

  /* Collaboratori */
  secLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#5A7575',
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: 2,
  },
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
  gridRow: { flexDirection: 'row', gap: 15 },
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
    minWidth: 55,
    padding: 0,
  },
  cardVal: { fontSize: 12, fontWeight: '700', color: '#1A3535' },
  cardValBold: { fontSize: 13, fontWeight: '800' },

  /* Storico */
  storico: {
    backgroundColor: '#EDE8DA',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  storicoL: { flex: 0.8, alignItems: 'center' },
  storicoC: { flex: 1.4, alignItems: 'center' },
  storicoR: { flex: 0.8, alignItems: 'center' },
  storicoT: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 8, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 15, fontWeight: '900', color: '#1A3535' },
  storicoSub: { fontSize: 7, fontWeight: '600', color: '#7A9090', marginTop: 1 },

  /* Filters */
  filterRow: { flexDirection: 'row', gap: 8 },
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
    gap: 7,
    marginTop: 6,
    marginBottom: 4,
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
