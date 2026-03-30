import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const { width: SW } = Dimensions.get('window');
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/* ─── WEATHER SVG ICONS ─── */
const IconSole = ({ c }: { c: string }) => (
  <Svg width="28" height="28" viewBox="0 0 28 28">
    <Circle cx="14" cy="14" r="5" stroke={c} strokeWidth="2" fill="none" />
    <Line x1="14" y1="2" x2="14" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="14" y1="22" x2="14" y2="26" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="2" y1="14" x2="6" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="22" y1="14" x2="26" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="5.4" y1="5.4" x2="8.2" y2="8.2" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="19.8" y1="19.8" x2="22.6" y2="22.6" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="5.4" y1="22.6" x2="8.2" y2="19.8" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <Line x1="19.8" y1="8.2" x2="22.6" y2="5.4" stroke={c} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);
const IconParziale = ({ c }: { c: string }) => (
  <Svg width="28" height="28" viewBox="0 0 28 28">
    <Circle cx="11" cy="9" r="4" stroke={c} strokeWidth="1.8" fill="none" />
    <Line x1="11" y1="1.5" x2="11" y2="3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="4" y1="5" x2="5.5" y2="6.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="3" y1="9" x2="5" y2="9" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M8 15a5 5 0 0 1 9.8-1.2A3.5 3.5 0 0 1 21 17.5 3.5 3.5 0 0 1 17.5 21H8.5A4 4 0 0 1 8 15z" stroke={c} strokeWidth="1.8" fill="none" />
  </Svg>
);
const IconPioggia = ({ c }: { c: string }) => (
  <Svg width="28" height="28" viewBox="0 0 28 28">
    <Path d="M7 13a5 5 0 0 1 9.8-1.2A3.5 3.5 0 0 1 20 15.5 3.5 3.5 0 0 1 16.5 19H7.5A4 4 0 0 1 7 13z" stroke={c} strokeWidth="1.8" fill="none" />
    <Line x1="10" y1="21" x2="9" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="14" y1="21" x2="13" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="18" y1="21" x2="17" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);
const IconTemporale = ({ c }: { c: string }) => (
  <Svg width="28" height="28" viewBox="0 0 28 28">
    <Path d="M7 11a5 5 0 0 1 9.8-1.2A3.5 3.5 0 0 1 20 13.5 3.5 3.5 0 0 1 16.5 17H7.5A4 4 0 0 1 7 11z" stroke={c} strokeWidth="1.8" fill="none" />
    <Path d="M14 18l-2 4h4l-2 4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const IconNuvola = ({ c }: { c: string }) => (
  <Svg width="28" height="28" viewBox="0 0 28 28">
    <Path d="M7 15a5 5 0 0 1 9.8-1.2A3.5 3.5 0 0 1 20 17.5 3.5 3.5 0 0 1 16.5 21H7.5A4 4 0 0 1 7 15z" stroke={c} strokeWidth="2" fill="none" />
  </Svg>
);
const WEATHER = [
  { Ico: IconSole, label: 'SOLE' },
  { Ico: IconParziale, label: 'VAR' },
  { Ico: IconPioggia, label: 'PIOGGIA' },
  { Ico: IconTemporale, label: 'TEMP' },
  { Ico: IconNuvola, label: 'NUVOLO' },
];

/* ─── Mini charts ─── */
const MiniLine = () => (
  <Svg width="65" height="40" viewBox="0 0 65 40">
    <Path d="M2 32 Q14 28 18 18 T32 22 T46 12 T63 5" stroke="#3A8AB0" strokeWidth="2.2" fill="none" />
    <Path d="M2 36 Q16 34 24 28 T38 30 T52 22 T63 18" stroke="#E89060" strokeWidth="1.8" fill="none" />
  </Svg>
);
const MiniBar = () => (
  <Svg width="60" height="40" viewBox="0 0 60 40">
    <Rect x="2" y="22" width="7" height="18" fill="#5CC0B8" rx="2" />
    <Rect x="12" y="26" width="7" height="14" fill="#E8A060" rx="2" />
    <Rect x="22" y="14" width="7" height="26" fill="#5CC0B8" rx="2" />
    <Rect x="32" y="8" width="7" height="32" fill="#E8A060" rx="2" />
    <Rect x="42" y="4" width="7" height="36" fill="#5CC0B8" rx="2" />
    <Rect x="52" y="14" width="7" height="26" fill="#E8A060" rx="2" />
  </Svg>
);

export default function HomeScreen() {
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata } = useAppStore();
  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenze, setPresenze] = useState<Record<string, boolean>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartMode, setChartMode] = useState<'mese' | 'anno' | 'confronto'>('anno');

  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [speseExtra, setSpeseExtra] = useState('');
  const [invenduto, setInvenduto] = useState('');

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

  // ── Auto-calc CONTANTI ↔ POSS ──
  const handleContanti = (val: string) => {
    setContanti(val);
    const c = parseFloat(val.replace(',', '.')) || 0;
    if (lordoNum > 0) {
      const diff = lordoNum - c;
      setPos(diff > 0 ? diff.toFixed(2) : '0');
    }
  };
  const handlePos = (val: string) => {
    setPos(val);
    const p = parseFloat(val.replace(',', '.')) || 0;
    if (lordoNum > 0) {
      const diff = lordoNum - p;
      setContanti(diff > 0 ? diff.toFixed(2) : '0');
    }
  };

  const changeDate = (off: number) => { const d = new Date(dataCorrente); d.setDate(d.getDate() + off); setDataCorrente(d); };
  const handleSalva = () => {
    salvaGiornata({ data: dataCorrente, mercato: mercatoNome, meteo, km: mercatoOggi?.km || 0,
      lordo: lordoNum, netto: utile, contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0, spese_extra: speseExtraNum,
      dettaglio_staff: presenze, dettaglio_invenduto: { totale: invendutoNum }, dettaglio_fornitori: {},
    } as any);
    Alert.alert('Salvato!', 'Giornata salvata con successo.');
  };

  return (
    <View style={s.root}>
      {/* ── HEADER ── */}
      <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
      <View style={s.badgesAbsolute}>
        <View style={s.badge}><Text style={s.badgeTxt}>Nome</Text><Text style={s.badgeTxt}>Azienda</Text></View>
        <View style={s.bell}><Ionicons name="notifications" size={15} color="#FFF" /><View style={s.bellDot} /></View>
      </View>

      {/* ── DATE (no market name, bigger text) ── */}
      <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
        <View style={s.dateRow}>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); changeDate(-1); }}>
            <Ionicons name="chevron-back" size={18} color="#3A6A6A" />
          </TouchableOpacity>
          <Ionicons name="calendar-outline" size={15} color="#3A6A6A" />
          <Text style={s.dateTxt}>{giorno} {data}</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); changeDate(1); }}>
            <Ionicons name="chevron-forward" size={18} color="#3A6A6A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazza, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* ── TOGGLE ── */}
      <View style={s.toggleRow}>
        {['Mercato', 'Fiera'].map((t, i) => {
          const on = i === 0 ? !isFiera : isFiera;
          return (
            <TouchableOpacity key={t} style={{ flex: 1 }} onPress={() => setIsFiera(i === 1)}>
              <View style={[s.toggle, on && s.toggleOn]}>
                <Text style={[s.toggleTxt, on && { color: '#FFF' }]}>{t}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── WEATHER ── */}
      <View style={s.meteoRow}>
        {WEATHER.map((w, i) => {
          const sel = meteo === w.label;
          return (
            <TouchableOpacity key={i} onPress={() => setMeteo(w.label)} activeOpacity={0.7}>
              <View style={[s.meteo, sel && s.meteoOn]}>
                <w.Ico c={sel ? '#FFF' : '#2A4A5A'} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── COLLABORATORI ── */}
      <Text style={s.secLabel}>COLLABORATORI</Text>
      <View style={s.collabRow}>
        {collabNames.map((n, i) => {
          const on = presenze[n];
          return (
            <TouchableOpacity key={i} onPress={() => setPresenze(p => ({ ...p, [n]: !p[n] }))}>
              <View style={[s.collab, on && s.collabOn]}>
                <Text style={[s.collabTxt, on && { color: '#FFF' }]}>{n.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── DATA GRID ── */}
      <View style={s.grid}>
        {/* ROW 1: LORDO | UTILE */}
        <View style={s.gridRow}>
          <View style={s.card}>
            <Text style={s.cardBold}>LORDO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={setLordo} selectTextOnFocus />
          </View>
          <View style={s.card}>
            <Text style={s.cardBold}>UTILE</Text>
            <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>€{utile.toFixed(2)}</Text>
          </View>
        </View>
        {/* ROW 2: CONTANTI | POSS (auto-calc) */}
        <View style={s.gridRow}>
          <View style={s.card}>
            <Text style={s.cardLbl}>CONTANTI</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} selectTextOnFocus />
          </View>
          <View style={s.card}>
            <Text style={s.cardLbl}>POSS</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} selectTextOnFocus />
          </View>
        </View>
        {/* ROW 3: SPESE EXTRA | SPESE FISSE */}
        <View style={s.gridRow}>
          <View style={s.card}>
            <Text style={s.cardLbl}>SPESE EXTRA</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} selectTextOnFocus />
          </View>
          <View style={s.card}>
            <Text style={s.cardLbl}>SPESE FISSE</Text>
            <Text style={s.cardVal}>€{speseFisse.toFixed(2)}</Text>
          </View>
        </View>
        {/* ROW 4: INVENDUTO | CHIEDI (AI Button) */}
        <View style={s.gridRow}>
          <View style={s.card}>
            <Text style={s.cardLbl}>INVENDUTO</Text>
            <TextInput style={s.cardInp} placeholder="0.00" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={invenduto} onChangeText={setInvenduto} selectTextOnFocus />
          </View>
          <TouchableOpacity style={s.chiediBtn} activeOpacity={0.7} onPress={() => Alert.alert('AI', 'Funzionalità AI in arrivo...')}>
            <Ionicons name="globe-outline" size={18} color="#1A3535" />
            <Text style={s.chiediTxt}>CHIEDI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── STORICO MERCATO (bigger card, smaller filters) ── */}
      <View style={s.storicoWrap}>
        <TouchableOpacity activeOpacity={0.85} style={s.storico}>
          <View style={s.storicoL}><MiniLine /></View>
          <View style={s.storicoC}>
            <Text style={s.storicoT}>STORICO MERCATO</Text>
            <Text style={s.storicoDay}>del {giorno}</Text>
            <Text style={s.storicoVal}>€44.130 <Text style={{ color: '#2AA090', fontSize: 12 }}>(+14%)</Text></Text>
            <Text style={s.storicoSub}>Media scontrino: €18.50</Text>
          </View>
          <View style={s.storicoR}><MiniBar /></View>
        </TouchableOpacity>
        <View style={s.filterRow}>
          {([['mese','MESE'],['anno','ANNO','(12 Mesi)'],['confronto','CONFRONTO','Anno Prec.']] as const).map(([k,l,sub]) => {
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

      {/* ── SALVA ── */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salva}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
      </TouchableOpacity>

      {/* ── Date Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} onPress={() => setShowDatePicker(false)} activeOpacity={1}>
          <View style={s.picker}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3535', marginBottom: 16 }}>Seleziona Data</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 3 + i);
                const sel = d.toDateString() === dataCorrente.toDateString();
                return (
                  <TouchableOpacity key={i} onPress={() => { setDataCorrente(new Date(d)); setShowDatePicker(false); }}
                    style={[s.pickDay, sel && { backgroundColor: '#1E7F85' }]}>
                    <Text style={[{ fontSize: 9, fontWeight: '700', color: '#4A3A2A' }, sel && { color: '#FFF' }]}>{GIORNI[d.getDay()].substring(0, 3)}</Text>
                    <Text style={[{ fontSize: 15, fontWeight: '900', color: '#1A3535' }, sel && { color: '#FFF' }]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ backgroundColor: '#1E7F85', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 24 }}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5', paddingHorizontal: 14, paddingTop: 48 },

  /* Header - MAGENTA higher */
  marketName: { fontSize: 24, fontWeight: '900', color: '#1A4040', letterSpacing: 1.5, textAlign: 'center', marginBottom: 2 },
  badgesAbsolute: { position: 'absolute', top: 48, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  badge: { backgroundColor: '#1E7F85', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  badgeTxt: { color: '#FFF', fontSize: 8, fontWeight: '700' },
  bell: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1E7F85', justifyContent: 'center', alignItems: 'center' },
  bellDot: { position: 'absolute', top: 3, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#E44' },

  /* Date - bigger text, no market name */
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 7 },
  dateTxt: { fontSize: 14, fontWeight: '700', color: '#2A5050' },
  piazza: { backgroundColor: '#1E7F85', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  piazzaTxt: { color: '#FFF', fontSize: 8, fontWeight: '700' },

  /* Toggle */
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toggle: {
    backgroundColor: '#E0DBC8', borderRadius: 26, paddingVertical: 11, alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(155,145,125,0.5), -3px -3px 8px rgba(255,255,250,0.85)',
  },
  toggleOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,60,65,0.55), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  toggleTxt: { fontSize: 14, fontWeight: '700', color: '#4A3A2A' },

  /* Weather */
  meteoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6, paddingHorizontal: 4 },
  meteo: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#A0BED0',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(60,95,115,0.5), -3px -3px 8px rgba(195,220,238,0.7)',
  },
  meteoOn: {
    backgroundColor: '#5A8EA0',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(30,55,65,0.55), -2px -2px 6px rgba(80,140,160,0.4)',
  },

  /* Section label */
  secLabel: { fontSize: 9, fontWeight: '700', color: '#5A7575', textAlign: 'center', marginBottom: 4, letterSpacing: 2 },

  /* Collaboratori */
  collabRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  collab: {
    backgroundColor: '#E0DBC8', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 9,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(155,145,125,0.5), -3px -3px 8px rgba(255,255,250,0.85)',
  },
  collabOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '4px 4px 8px rgba(15,60,65,0.45)',
  },
  collabTxt: { fontSize: 11, fontWeight: '700', color: '#4A3A2A' },

  /* Grid */
  grid: { gap: 8, marginBottom: 8 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1, backgroundColor: '#EDE8DA', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  cardLbl: { fontSize: 11, fontWeight: '600', color: '#4A4A40' },
  cardBold: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  cardInp: { fontSize: 14, fontWeight: '700', color: '#1A3535', textAlign: 'right', minWidth: 70, padding: 0 },
  cardVal: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
  cardValBold: { fontSize: 14, fontWeight: '800' },

  /* CHIEDI - AI Button */
  chiediBtn: {
    flex: 1, backgroundColor: '#EDE8DA', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  chiediTxt: { fontSize: 12, fontWeight: '700', color: '#1A3535' },

  /* Storico - bigger card */
  storicoWrap: { marginBottom: 10 },
  storico: {
    backgroundColor: '#EDE8DA', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },
  storicoL: { flex: 0.8, alignItems: 'center' },
  storicoC: { flex: 1.4, alignItems: 'center' },
  storicoR: { flex: 0.8, alignItems: 'center' },
  storicoT: { fontSize: 14, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 10, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 16, fontWeight: '900', color: '#1A3535' },
  storicoSub: { fontSize: 9, fontWeight: '600', color: '#7A9090', marginTop: 2 },

  /* Filter buttons - smaller */
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 12, paddingVertical: 6, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 7px rgba(155,145,125,0.4), -2px -2px 6px rgba(255,255,250,0.8)',
  },
  filterOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(15,60,65,0.45), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  filterTxt: { fontSize: 8, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterSub: { fontSize: 5.5, fontWeight: '600', color: '#7A6A5A', textAlign: 'center' },

  /* Salva */
  salva: {
    backgroundColor: '#1E7F85', borderRadius: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(15,60,65,0.5), -2px -2px 6px rgba(45,120,125,0.3)',
  },
  salvaTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  /* Modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  picker: { backgroundColor: '#F0EDE5', borderRadius: 20, padding: 20, width: SW * 0.85, alignItems: 'center' },
  pickDay: {
    width: 42, height: 56, borderRadius: 12, backgroundColor: '#E0DBC8',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.7)',
  },
});
