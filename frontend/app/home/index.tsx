import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const { width: SW } = Dimensions.get('window');
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/* ─── WEATHER SVG ICONS (more detailed, matching photo) ─── */
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
  <Svg width="62" height="36" viewBox="0 0 62 36">
    <Path d="M2 28 Q14 25 18 17 T32 21 T46 12 T60 5" stroke="#3A8AB0" strokeWidth="2.2" fill="none" />
    <Path d="M2 32 Q16 30 24 26 T38 28 T52 20 T60 16" stroke="#E89060" strokeWidth="1.8" fill="none" />
  </Svg>
);
const MiniBar = () => (
  <Svg width="58" height="36" viewBox="0 0 58 36">
    <Rect x="2" y="20" width="7" height="16" fill="#5CC0B8" rx="2" />
    <Rect x="12" y="24" width="7" height="12" fill="#E8A060" rx="2" />
    <Rect x="22" y="14" width="7" height="22" fill="#5CC0B8" rx="2" />
    <Rect x="32" y="8" width="7" height="28" fill="#E8A060" rx="2" />
    <Rect x="42" y="4" width="7" height="32" fill="#5CC0B8" rx="2" />
    <Rect x="52" y="12" width="7" height="24" fill="#E8A060" rx="2" />
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

  const changeDate = (off: number) => { const d = new Date(dataCorrente); d.setDate(d.getDate() + off); setDataCorrente(d); };
  const handleSalva = () => {
    salvaGiornata({ data: dataCorrente, mercato: mercatoNome, meteo, km: mercatoOggi?.km || 0,
      lordo: lordoNum, netto: utile, contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0, spese_extra: speseExtraNum,
      dettaglio_staff: presenze, dettaglio_invenduto: { totale: invendutoNum }, dettaglio_fornitori: {},
    } as any);
  };

  return (
    <View style={s.root}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.badges}>
          <View style={s.badge}><Text style={s.badgeTxt}>Nome</Text><Text style={s.badgeTxt}>Azienda</Text></View>
          <View style={s.bell}><Ionicons name="notifications" size={15} color="#FFF" /><View style={s.bellDot} /></View>
        </View>
      </View>

      {/* DATE */}
      <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
        <View style={s.dateRow}>
          <TouchableOpacity onPress={() => changeDate(-1)}><Ionicons name="chevron-back" size={16} color="#3A6A6A" /></TouchableOpacity>
          <Ionicons name="calendar-outline" size={13} color="#3A6A6A" />
          <Text style={s.dateTxt}>{giorno} {data} - {mercatoNome}</Text>
          <TouchableOpacity onPress={() => changeDate(1)}><Ionicons name="chevron-forward" size={16} color="#3A6A6A" /></TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazza, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* TOGGLE */}
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

      {/* WEATHER */}
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

      {/* COLLABORATORI */}
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

      {/* DATA GRID */}
      <View style={s.grid}>
        {[
          [{ l: 'LORDO', bold: true, inp: true, v: lordo, fn: setLordo },
           { l: 'UTILE', bold: true, comp: `€${utile.toFixed(2)}`, clr: utile >= 0 ? '#2A7A5A' : '#D44' }],
          [{ l: 'CONTANTI', inp: true, v: contanti, fn: setContanti },
           { l: 'POSS', inp: true, v: pos, fn: setPos }],
          [{ l: 'SPESE EXTRA', inp: true, v: speseExtra, fn: setSpeseExtra },
           { l: 'SPESE FISSE', comp: `€${speseFisse.toFixed(2)}` }],
          [{ l: 'INVENDUTO', inp: true, v: invenduto, fn: setInvenduto },
           { l: 'CHIEDI', inp: true, v: chiedi, fn: setChiedi }],
        ].map((row, ri) => (
          <View key={ri} style={s.gridRow}>
            {row.map((c: any, ci: number) => (
              <View key={ci} style={s.card}>
                <Text style={c.bold ? s.cardBold : s.cardLbl}>{c.l}</Text>
                {c.inp ? (
                  <TextInput style={s.cardInp} placeholder="€0,00" placeholderTextColor="#B5A898" keyboardType="numeric" value={c.v} onChangeText={c.fn} />
                ) : (
                  <Text style={[s.cardVal, c.bold && { fontWeight: '800', fontSize: 14 }, c.clr && { color: c.clr }]}>{c.comp}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* STORICO MERCATO */}
      <View style={s.storicoWrap}>
        <TouchableOpacity activeOpacity={0.85} style={s.storico}>
          <View style={s.storicoL}><MiniLine /></View>
          <View style={s.storicoC}>
            <Text style={s.storicoT}>STORICO MERCATO</Text>
            <Text style={s.storicoDay}>del {giorno}</Text>
            <Text style={s.storicoVal}>€44.130 <Text style={{ color: '#2AA090', fontSize: 11 }}>(+14%)</Text></Text>
            <Text style={s.storicoSub}>Media scontrino: €18.50</Text>
          </View>
          <View style={s.storicoR}><MiniBar /></View>
        </TouchableOpacity>
        <View style={s.filterRow}>
          {([['mese','MESE'],['anno','ANNO','(Dodici Mesi)'],['confronto','CONFRONTO','ANNO PREC.']] as const).map(([k,l,sub]) => {
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

      {/* SALVA */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salva}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
      </TouchableOpacity>

      {/* Date Picker */}
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

/* ─── STYLES (exact colors from photo analysis) ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E2F0E8', paddingHorizontal: 14, paddingTop: 42 },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  marketName: { fontSize: 22, fontWeight: '900', color: '#1A4040', letterSpacing: 1, flex: 1, textAlign: 'center' },
  badges: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  badge: { backgroundColor: '#1E7F85', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  badgeTxt: { color: '#FFF', fontSize: 8, fontWeight: '700' },
  bell: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1E7F85', justifyContent: 'center', alignItems: 'center' },
  bellDot: { position: 'absolute', top: 3, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#E44' },

  /* Date */
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 },
  dateTxt: { fontSize: 11, fontWeight: '600', color: '#2A5050' },
  piazza: { backgroundColor: '#1E7F85', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  piazzaTxt: { color: '#FFF', fontSize: 7, fontWeight: '700' },

  /* Toggle - Photo: active #1E7F85, inactive #D9E5E2 */
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toggle: {
    backgroundColor: '#D9E5E2', borderRadius: 26, paddingVertical: 11, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 4px 8px rgba(160,175,165,0.5), -3px -3px 6px rgba(255,255,255,0.85)',
  },
  toggleOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(15,60,65,0.55), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  toggleTxt: { fontSize: 14, fontWeight: '700', color: '#4A5555' },

  /* Weather - Photo: circle color #A2C2DA */
  meteoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6, paddingHorizontal: 4 },
  meteo: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#A2C2DA',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(60,100,120,0.5), -3px -3px 8px rgba(200,225,240,0.7)',
  },
  meteoOn: {
    backgroundColor: '#5A8EA0',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(30,60,70,0.55), -2px -2px 6px rgba(80,140,160,0.4)',
  },

  /* Section label */
  secLabel: { fontSize: 9, fontWeight: '700', color: '#5A7575', textAlign: 'center', marginBottom: 4, letterSpacing: 2 },

  /* Collaboratori - Photo: pill color #E5D7B8 */
  collabRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  collab: {
    backgroundColor: '#E5D7B8', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 9,
    // @ts-ignore
    boxShadow: '3px 4px 8px rgba(170,150,120,0.45), -3px -3px 7px rgba(255,255,255,0.85)',
  },
  collabOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 4px 8px rgba(15,60,65,0.45)',
  },
  collabTxt: { fontSize: 11, fontWeight: '700', color: '#4A3A2A' },

  /* Grid - Photo: card color #F8F8F4 */
  grid: { gap: 8, marginBottom: 8 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1, backgroundColor: '#F8F8F4', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 4px 8px rgba(170,175,165,0.4), -3px -3px 7px rgba(255,255,255,0.9)',
  },
  cardLbl: { fontSize: 11, fontWeight: '600', color: '#4A5555' },
  cardBold: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  cardInp: { fontSize: 13, fontWeight: '700', color: '#1A3535', textAlign: 'right', minWidth: 65, padding: 0 },
  cardVal: { fontSize: 13, fontWeight: '700', color: '#1A3535' },

  /* Storico */
  storicoWrap: { marginBottom: 10 },
  storico: {
    backgroundColor: '#F8F8F4', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 7,
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(170,175,165,0.4), -3px -3px 8px rgba(255,255,255,0.9)',
  },
  storicoL: { flex: 0.8, alignItems: 'center' },
  storicoC: { flex: 1.4, alignItems: 'center' },
  storicoR: { flex: 0.8, alignItems: 'center' },
  storicoT: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 15, fontWeight: '900', color: '#1A3535' },
  storicoSub: { fontSize: 8, fontWeight: '600', color: '#7A9090', marginTop: 1 },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    flex: 1, backgroundColor: '#E5D7B8', borderRadius: 14, paddingVertical: 9, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(170,150,120,0.4), -2px -2px 6px rgba(255,255,255,0.8)',
  },
  filterOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(15,60,65,0.5), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  filterTxt: { fontSize: 9, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterSub: { fontSize: 6, fontWeight: '600', color: '#7A6A5A', textAlign: 'center' },

  /* Salva */
  salva: {
    backgroundColor: '#1E7F85', borderRadius: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    // @ts-ignore
    boxShadow: '3px 4px 12px rgba(15,60,65,0.5), -2px -2px 6px rgba(45,120,125,0.3)',
  },
  salvaTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  /* Modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  picker: { backgroundColor: '#F0EDE5', borderRadius: 20, padding: 20, width: SW * 0.85, alignItems: 'center' },
  pickDay: {
    width: 42, height: 56, borderRadius: 12, backgroundColor: '#E5D7B8',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(160,145,120,0.4), -2px -2px 5px rgba(255,255,255,0.7)',
  },
});
