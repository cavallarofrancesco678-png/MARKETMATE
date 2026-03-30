import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';

const { width: SW } = Dimensions.get('window');

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Custom Weather SVG Icons for reliable rendering
const SunSvg = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M16.95 16.95l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M16.95 7.05l1.42-1.42" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke={color} strokeWidth="2" fill="none" />
  </Svg>
);
const PartlySunnySvg = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M10 2v1.5M3.64 5.64l1.06 1.06M2 12h1.5M5.64 18.36l1.06-1.06" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <Path d="M10 5.5a4.5 4.5 0 0 1 4 2.2" stroke={color} strokeWidth="1.8" fill="none" />
    <Path d="M9 11a4 4 0 0 0-3.5 5.8A3 3 0 0 0 6 22h12a3 3 0 0 0 .5-5.95A4 4 0 0 0 9 11z" stroke={color} strokeWidth="2" fill="none" />
  </Svg>
);
const CloudSvg = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 20a4 4 0 0 1-.87-7.9A5.5 5.5 0 0 1 16.9 10 3.5 3.5 0 1 1 18 17H6z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
  </Svg>
);
const ThunderstormSvg = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 16a4 4 0 0 1-.87-7.9A5.5 5.5 0 0 1 16.9 6 3.5 3.5 0 1 1 18 13H6z" stroke={color} strokeWidth="2" fill="none" />
    <Path d="M13 13l-2 5h3l-2 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const WindSvg = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 8h10a3 3 0 1 0-3-3" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M3 12h14a3 3 0 1 1-3 3" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M3 16h7a3 3 0 1 1-3 3" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </Svg>
);

const WEATHER_ITEMS = [
  { Comp: SunSvg, label: 'SOLE' },
  { Comp: PartlySunnySvg, label: 'VAR' },
  { Comp: CloudSvg, label: 'NUVOLO' },
  { Comp: ThunderstormSvg, label: 'TEMP' },
  { Comp: WindSvg, label: 'VENTO' },
];

// Mini charts for STORICO card
const MiniLine = () => (
  <Svg width="65" height="38" viewBox="0 0 65 38">
    <Path d="M2 30 Q14 28 18 18 T32 22 T46 14 T63 6" stroke="#3A8AB0" strokeWidth="2.5" fill="none" />
    <Path d="M2 34 Q16 32 24 28 T38 30 T52 22 T63 18" stroke="#E89060" strokeWidth="2" fill="none" />
  </Svg>
);
const MiniBar = () => (
  <Svg width="60" height="38" viewBox="0 0 60 38">
    <Rect x="2" y="20" width="7" height="18" fill="#5CC0B8" rx="2" />
    <Rect x="12" y="24" width="7" height="14" fill="#E8A060" rx="2" />
    <Rect x="22" y="14" width="7" height="24" fill="#5CC0B8" rx="2" />
    <Rect x="32" y="8" width="7" height="30" fill="#E8A060" rx="2" />
    <Rect x="42" y="4" width="7" height="34" fill="#5CC0B8" rx="2" />
    <Rect x="52" y="12" width="7" height="26" fill="#E8A060" rx="2" />
  </Svg>
);

const WEATHER_ITEMS_LIST = WEATHER_ITEMS;

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

  const incassoTotale = 44130;
  const mediaScontrino = 18.50;
  const deltaPercent = 14;

  const changeDate = (offset: number) => {
    const d = new Date(dataCorrente);
    d.setDate(d.getDate() + offset);
    setDataCorrente(d);
  };

  const handleSalva = () => {
    salvaGiornata({
      data: dataCorrente, mercato: mercatoNome, meteo, km: mercatoOggi?.km || 0,
      lordo: lordoNum, netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraNum, dettaglio_staff: presenze,
      dettaglio_invenduto: { totale: invendutoNum }, dettaglio_fornitori: {},
    } as any);
  };

  return (
    <View style={s.root}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.badges}>
          <View style={s.aziendaBadge}><Text style={s.badgeTxt}>Nome</Text><Text style={s.badgeTxt}>Azienda</Text></View>
          <View style={s.bellCircle}><Ionicons name="notifications" size={15} color="#FFF" /><View style={s.bellDot} /></View>
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
            <View style={[s.piazzaBadge, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? 'IN PIAZZA' : 'ASSENTE'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* TOGGLE */}
      <View style={s.toggleRow}>
        {['Mercato', 'Fiera'].map((t, i) => {
          const active = i === 0 ? !isFiera : isFiera;
          return (
            <TouchableOpacity key={t} style={s.toggleWrap} onPress={() => setIsFiera(i === 1)}>
              <View style={[s.toggleBtn, active && s.toggleActive]}>
                {active && <View style={s.btnShine} />}
                <Text style={[s.toggleTxt, active && s.toggleTxtActive]}>{t}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* WEATHER - Custom SVG icons for reliable rendering */}
      <View style={s.meteoRow}>
        {WEATHER_ITEMS.map((m, i) => {
          const sel = meteo === m.label;
          const IconComp = m.Comp;
          return (
            <TouchableOpacity key={i} onPress={() => setMeteo(m.label)} activeOpacity={0.7}>
              <View style={[s.meteoCircle, sel && s.meteoSel]}>
                <IconComp size={28} color={sel ? '#FFFFFF' : '#1A3040'} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* COLLABORATORI */}
      <Text style={s.secTitle}>COLLABORATORI</Text>
      <View style={s.collabRow}>
        {collabNames.map((n, i) => {
          const on = presenze[n];
          return (
            <TouchableOpacity key={i} onPress={() => setPresenze(p => ({ ...p, [n]: !p[n] }))}>
              <View style={[s.collabPill, on && s.collabOn]}>
                {!on && <View style={s.btnShine} />}
                <Text style={[s.collabTxt, on && { color: '#FFF' }]}>{n.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DATA GRID - warm cream cards with 3D effect */}
      <View style={s.grid}>
        {[
          [{ l: 'LORDO', bold: true, input: true, val: lordo, set: setLordo },
           { l: 'UTILE', bold: true, input: false, computed: `€${utile.toFixed(2)}`, color: utile >= 0 ? '#2A7A5A' : '#D44' }],
          [{ l: 'CONTANTI', input: true, val: contanti, set: setContanti },
           { l: 'POSS', input: true, val: pos, set: setPos }],
          [{ l: 'SPESE EXTRA', input: true, val: speseExtra, set: setSpeseExtra },
           { l: 'SPESE FISSE', input: false, computed: `€${speseFisse.toFixed(2)}` }],
          [{ l: 'INVENDUTO', input: true, val: invenduto, set: setInvenduto },
           { l: 'CHIEDI', input: true, val: chiedi, set: setChiedi }],
        ].map((row, ri) => (
          <View key={ri} style={s.gridRow}>
            {row.map((c: any, ci: number) => (
              <View key={ci} style={s.card}>
                <View style={s.cardShine} />
                <Text style={c.bold ? s.cardLabelBold : s.cardLabel}>{c.l}</Text>
                {c.input ? (
                  <TextInput style={s.cardInput} placeholder="€0,00" placeholderTextColor="#B5A090" keyboardType="numeric" value={c.val} onChangeText={c.set} />
                ) : (
                  <Text style={[s.cardVal, c.bold && s.cardValBold, c.color && { color: c.color }]}>{c.computed}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* STORICO MERCATO - bigger with 3 filter buttons */}
      <View style={s.storicoSection}>
        <TouchableOpacity activeOpacity={0.85} style={s.storicoCard}>
          <View style={s.cardShine} />
          <View style={s.storicoLeft}><MiniLine /></View>
          <View style={s.storicoCtr}>
            <Text style={s.storicoTitle}>STORICO MERCATO</Text>
            <Text style={s.storicoDay}>del {giorno}</Text>
            <Text style={s.storicoVal}>€{incassoTotale.toLocaleString('it-IT')} <Text style={{ color: '#2AA090', fontSize: 11 }}>(+{deltaPercent}%)</Text></Text>
            <Text style={s.storicoMedia}>Media scontrino: €{mediaScontrino.toFixed(2)}</Text>
          </View>
          <View style={s.storicoRight}><MiniBar /></View>
        </TouchableOpacity>

        {/* 3 Filter buttons */}
        <View style={s.filterRow}>
          {[
            { key: 'mese', label: 'MESE' },
            { key: 'anno', label: 'ANNO', sub: '(Dodici Mesi)' },
            { key: 'confronto', label: 'CONFRONTO', sub: 'ANNO PREC.' },
          ].map((f) => {
            const active = chartMode === f.key;
            return (
              <TouchableOpacity key={f.key} style={[s.filterBtn, active && s.filterActive]}
                onPress={() => setChartMode(f.key as any)} activeOpacity={0.7}>
                {!active && <View style={s.btnShine} />}
                <Text style={[s.filterTxt, active && { color: '#FFF' }]}>{f.label}</Text>
                {f.sub && <Text style={[s.filterSub, active && { color: 'rgba(255,255,255,0.75)' }]}>{f.sub}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SALVA */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={s.salvaBtn}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} onPress={() => setShowDatePicker(false)} activeOpacity={1}>
          <View style={s.pickerCard}>
            <Text style={s.pickerTitle}>Seleziona Data</Text>
            <View style={s.pickerGrid}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 3 + i);
                const sel = d.toDateString() === dataCorrente.toDateString();
                return (
                  <TouchableOpacity key={i} onPress={() => { setDataCorrente(new Date(d)); setShowDatePicker(false); }}
                    style={[s.pickerDay, sel && s.pickerDaySel]}>
                    <Text style={[s.pickerDayName, sel && { color: '#FFF' }]}>{GIORNI[d.getDay()].substring(0, 3)}</Text>
                    <Text style={[s.pickerDayNum, sel && { color: '#FFF' }]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={s.pickerClose}><Text style={{ color: '#FFF', fontWeight: '700' }}>Chiudi</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D2EBE4', paddingHorizontal: 12, paddingTop: 38 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  marketName: { fontSize: 22, fontWeight: '900', color: '#1A4040', letterSpacing: 1, flex: 1, textAlign: 'center' },
  badges: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  aziendaBadge: { backgroundColor: '#2A6565', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, alignItems: 'center' },
  badgeTxt: { color: '#FFF', fontSize: 8, fontWeight: '700' },
  bellCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2A6565', justifyContent: 'center', alignItems: 'center' },
  bellDot: { position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#E44' },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 },
  dateTxt: { fontSize: 11, fontWeight: '600', color: '#2A5555' },
  piazzaBadge: { backgroundColor: '#2A6565', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  piazzaTxt: { color: '#FFF', fontSize: 7, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toggleWrap: { flex: 1 },
  toggleBtn: {
    backgroundColor: '#E8DFC8',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,145,120,0.5), -3px -3px 8px rgba(255,255,255,0.85)',
  },
  toggleActive: {
    backgroundColor: '#1E5555',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,45,45,0.6), -2px -2px 6px rgba(50,90,90,0.35)',
  },
  toggleTxt: { fontSize: 13, fontWeight: '700', color: '#4A3A2A' },
  toggleTxtActive: { color: '#FFF' },

  btnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(255,255,255,0.25)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },

  meteoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6, paddingHorizontal: 2 },
  meteoCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#9AB8C8',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(55,90,105,0.55), -3px -3px 8px rgba(190,220,235,0.7)',
  },
  meteoSel: {
    backgroundColor: '#3A7585',
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(25,55,65,0.6), -2px -2px 6px rgba(70,130,145,0.4)',
  },
  meteoShine: {
    position: 'absolute', top: 2, left: 6, right: 6, height: 16,
    backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 10,
  },

  secTitle: { fontSize: 9, fontWeight: '700', color: '#5A7575', textAlign: 'center', marginBottom: 5, letterSpacing: 2 },

  collabRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  collabPill: {
    backgroundColor: '#E8DFC8', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, overflow: 'hidden',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(160,145,120,0.5), -3px -3px 8px rgba(255,255,255,0.85)',
  },
  collabOn: {
    backgroundColor: '#1E5555',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(15,45,45,0.5)',
  },
  collabTxt: { fontSize: 10, fontWeight: '700', color: '#4A3A2A' },

  grid: { gap: 9, marginBottom: 8 },
  gridRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#F2EAD8',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(170,150,125,0.45), -3px -3px 8px rgba(255,255,255,0.9)',
  },
  cardShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.22)', borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#4A5555' },
  cardLabelBold: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  cardInput: { fontSize: 13, fontWeight: '700', color: '#1A3535', textAlign: 'right', minWidth: 65, padding: 0, margin: 0 },
  cardVal: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
  cardValBold: { fontSize: 14, fontWeight: '800' },

  storicoSection: { marginBottom: 8 },
  storicoCard: {
    backgroundColor: '#F2EAD8', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8, overflow: 'hidden',
    // @ts-ignore
    boxShadow: '4px 5px 12px rgba(170,150,125,0.45), -3px -3px 8px rgba(255,255,255,0.9)',
  },
  storicoLeft: { flex: 0.8, alignItems: 'center' },
  storicoCtr: { flex: 1.4, alignItems: 'center' },
  storicoRight: { flex: 0.8, alignItems: 'center' },
  storicoTitle: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 15, fontWeight: '900', color: '#1A3535' },
  storicoMedia: { fontSize: 8, fontWeight: '600', color: '#7A9090', marginTop: 1 },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    flex: 1, backgroundColor: '#E8DFC8', borderRadius: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(160,145,120,0.45), -2px -2px 6px rgba(255,255,255,0.85)',
  },
  filterActive: {
    backgroundColor: '#2A8A85',
    // @ts-ignore
    boxShadow: '3px 4px 10px rgba(25,70,70,0.5), -2px -2px 5px rgba(60,140,140,0.3)',
  },
  filterTxt: { fontSize: 8, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterSub: { fontSize: 6, fontWeight: '600', color: '#7A6A5A', textAlign: 'center' },

  salvaBtn: {
    backgroundColor: '#1E5555', borderRadius: 16, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(15,45,45,0.5), -2px -2px 6px rgba(50,100,100,0.3)',
  },
  salvaTxt: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: { backgroundColor: '#F0EDE5', borderRadius: 20, padding: 20, width: SW * 0.85, alignItems: 'center' },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#1A3535', marginBottom: 16 },
  pickerGrid: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  pickerDay: {
    width: 42, height: 56, borderRadius: 12, backgroundColor: '#E5DBC8', justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 6px rgba(160,145,120,0.4), -2px -2px 5px rgba(255,255,255,0.7)',
  },
  pickerDaySel: { backgroundColor: '#1E5555' },
  pickerDayName: { fontSize: 9, fontWeight: '700', color: '#4A3A2A' },
  pickerDayNum: { fontSize: 15, fontWeight: '900', color: '#1A3535', marginTop: 2 },
  pickerClose: { backgroundColor: '#2A6565', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 24 },
});
