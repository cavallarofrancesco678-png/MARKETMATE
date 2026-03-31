import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useWindowDimensions,
  Modal,
  ScrollView,
  Switch,
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
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata, speseFisseDisabilitate, fornitori, appuntiAgenda, removeAppunto } = useAppStore();
  const store = useAppStore();
  const { height: screenH } = useWindowDimensions();
  const [dataCorrente, setDataCorrente] = useState(new Date());
  const [isFiera, setIsFiera] = useState(false);
  const [isInPiazza, setIsInPiazza] = useState(true);
  const [meteo, setMeteo] = useState('SOLE');
  const [presenze, setPresenze] = useState<Record<string, boolean>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSpeseFisseModal, setShowSpeseFisseModal] = useState(false);
  const [showBellModal, setShowBellModal] = useState(false);
  const [showInvendutoModal, setShowInvendutoModal] = useState(false);
  const [invendutoQty, setInvendutoQty] = useState<Record<string, string>>({});
  const [chartMode, setChartMode] = useState<'mese' | 'anno' | 'confronto'>('anno');
  const [fieraLuogo, setFieraLuogo] = useState('');
  const [fieraKm, setFieraKm] = useState('');
  const [fieraPlat, setFieraPlat] = useState('');

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

  /* ── Appunti di oggi per notifiche campanello ── */
  const appuntiOggi = useMemo(() => {
    const oggi = dataCorrente.toDateString();
    return (appuntiAgenda || []).filter((a) => new Date(a.data).toDateString() === oggi);
  }, [appuntiAgenda, dataCorrente]);

  /* ── All products from all fornitori ── */
  const tuttiProdotti = useMemo(() => {
    const prods: { fornitore: string; nome: string; prezzo: number }[] = [];
    (fornitori || []).forEach((f) => {
      f.prodotti.forEach((p) => {
        prods.push({ fornitore: f.nome, nome: p.nome, prezzo: p.prezzo });
      });
    });
    return prods;
  }, [fornitori]);

  /* ── Invenduto calculated from product quantities ── */
  const invendutoCalcolato = useMemo(() => {
    let tot = 0;
    tuttiProdotti.forEach((p) => {
      const qty = parseFloat((invendutoQty[`${p.fornitore}_${p.nome}`] || '0').replace(',', '.')) || 0;
      tot += qty * p.prezzo;
    });
    return tot;
  }, [tuttiProdotti, invendutoQty]);

  const confermaInvenduto = () => {
    setInvenduto(Math.round(invendutoCalcolato).toString());
    setShowInvendutoModal(false);
  };

  /* ── Build itemized spese fisse list ── */
  const speseFisseItems = useMemo(() => {
    const gg = agenda.filter((m) => m.lavorativo).length || 6;
    const items: { id: string; label: string; importoGG: number }[] = [];

    // Annual expenses → divided by working days (48 weeks × workdays/week)
    speseAnnue.forEach((sp) => {
      items.push({ id: `sp_${sp.voce}`, label: sp.voce, importoGG: sp.importo / (48 * gg) });
    });

    // Plateatico for ALL markets → each divided only by ITS own days (48 weeks)
    agenda.forEach((m) => {
      if (m.p_annuo > 0) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: m.p_annuo / 48 });
      } else if (m.p_giornaliero > 0 && !m.is_plat_annuo) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: m.p_giornaliero });
      }
    });

    return items;
  }, [speseAnnue, agenda]);

  // Filter: only show today's plateatico + all general spese
  const speseFisseOggi = useMemo(() => {
    const mercatoGiornoId = `plat_${mercatoOggi?.giorno}`;
    return speseFisseItems.filter((it) => {
      // Show all non-plateatico items + only today's plateatico
      if (it.id.startsWith('plat_')) return it.id === mercatoGiornoId;
      return true;
    });
  }, [speseFisseItems, mercatoOggi]);

  const speseFisse = speseFisseOggi
    .filter((it) => !(speseFisseDisabilitate || []).includes(it.id))
    .reduce((s, it) => s + it.importoGG, 0);

  const toggleSpesaFissa = (id: string) => {
    const disabled = speseFisseDisabilitate || [];
    const newList = disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id];
    store.setConfig({ speseFisseDisabilitate: newList });
  };

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const speseExtraNum = parseFloat(speseExtra.replace(',', '.')) || 0;
  const invendutoNum = parseFloat(invenduto.replace(',', '.')) || 0;

  // Costo collaboratori attivi (presenti oggi)
  const costoCollabAttivi = collaboratori
    .filter((c) => presenze[c.nome])
    .reduce((s, c) => s + (c.costo || 0), 0);

  const utile = lordoNum - speseFisse - speseExtraNum - invendutoNum - costoCollabAttivi;
  const collabNames = collaboratori.length > 0 ? collaboratori.map((c) => c.nome) : [];

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

  /* ─── UNIFIED PROPORTIONAL LAYOUT ─── */
  const TAB_BAR = 80;
  const contentH = screenH - TAB_BAR;
  const vh = contentH / 100;

  // ★ STANDARD GAP — extracted from grid, used as universal spacer
  const GAP = Math.round(1.5 * vh);

  // Weather icons sized to match tab bar ovals (48×42 in _layout.tsx)
  const WEATHER_SIZE = 44;
  const WEATHER_ICON = 22;

  // Fixed section heights
  const HEADER_H = 9 * vh;
  const TOGGLE_H = 5 * vh;
  const WEATHER_H = Math.max(WEATHER_SIZE + 6, 5 * vh);
  const COLLAB_H = 4.5 * vh;
  const SALVA_H = 5 * vh;

  // 9 uniform gaps between 10 vertical blocks
  const TOTAL_GAPS = 9 * GAP;
  const gridInternalGaps = 3 * GAP;

  // Available space for grid rows + storico
  const fixedH = HEADER_H + TOGGLE_H + WEATHER_H + COLLAB_H + SALVA_H + TOTAL_GAPS + gridInternalGaps;
  const availableH = contentH - fixedH;
  // Weight units: LORDO=1.2, 3×normal=0.8 each, STORICO=2.0 → total 5.6
  const unit = availableH / 5.6;
  const lordoRowH = unit * 1.2;
  const normalRowH = unit * 0.8;
  const STORICO_H = unit * 2.0;

  return (
    <View style={s.root}>
      {/* ═══ HEADER ═══ */}
      <View style={[s.section, { height: HEADER_H, justifyContent: 'flex-end' }]}>
        <Text style={s.marketName}>{mercatoNome.toUpperCase()}</Text>
        <View style={s.badgeLeft}>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{(nomeAttivita || 'LA MIA AZIENDA').toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.bellRight}>
          <TouchableOpacity onPress={() => setShowBellModal(true)} activeOpacity={0.7}>
            <View style={s.bell}>
              <Ionicons name="notifications" size={20} color="#FFF" />
              {appuntiOggi.length > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeTxt}>{appuntiOggi.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <View style={s.dateRow}>
            <Ionicons name="calendar" size={18} color="#1E7F85" />
            <Text style={s.dateTxt}>{giorno.toUpperCase()} {data.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ TOGGLE ═══ */}
      <View style={[s.section, { height: TOGGLE_H, justifyContent: 'center' }]}>
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

      <View style={{ height: GAP }} />

      {/* ═══ WEATHER (icone = dimensione tab bar) ═══ */}
      <View style={[s.section, { height: WEATHER_H, justifyContent: 'center' }]}>
        <View style={s.meteoRow}>
          {WEATHER_ICONS.map((w, i) => {
            const sel = meteo === w.label;
            return (
              <TouchableOpacity key={i} onPress={() => setMeteo(w.label)} activeOpacity={0.7}>
                <View style={[s.meteo, { width: WEATHER_SIZE, height: WEATHER_SIZE, borderRadius: WEATHER_SIZE / 2 }, sel && s.meteoOn]}>
                  <MaterialCommunityIcons name={w.icon as any} size={WEATHER_ICON} color={sel ? '#FFF' : '#2A4A5A'} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ COLLABORATORI (subito sotto meteo, stesso GAP) ═══ */}
      <View style={[s.section, { height: COLLAB_H, justifyContent: 'center' }]}>
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

      <View style={{ height: GAP }} />

      {/* ═══ ROW 1: LORDO / UTILE (+20% altezza) ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: lordoRowH }]}>
          <Text style={s.cardBold}>LORDO</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={setLordo} selectTextOnFocus />
        </View>
        <View style={[s.card, { height: lordoRowH }]}>
          <Text style={s.cardBold}>UTILE</Text>
          <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>€{Math.round(utile)}</Text>
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 2: CONTANTI / POS ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>CONTANTI</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} selectTextOnFocus />
        </View>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>POSS</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} selectTextOnFocus />
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 3: SPESE EXTRA / SPESE FISSE (cliccabile) ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>SPESE EXTRA</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={speseExtra} onChangeText={setSpeseExtra} selectTextOnFocus />
        </View>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowSpeseFisseModal(true)}>
          <Text style={s.cardLbl}>SPESE FISSE</Text>
          <Text style={s.cardVal}>€{Math.round(speseFisse)}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 4: INVENDUTO / BUONGIORNO ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowInvendutoModal(true)}>
          <Text style={s.cardLbl}>INVENDUTO</Text>
          <Text style={s.cardVal}>{invendutoNum > 0 ? `€${invendutoNum}` : '0'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { height: normalRowH, backgroundColor: '#1E7F85' }]} activeOpacity={0.7} onPress={() => Alert.alert('Buongiorno!', 'Connessione AI in arrivo...')}>
          <Ionicons name="globe-outline" size={16} color="#FFF" />
          <Text style={[s.cardBold, { color: '#FFF', fontSize: 12 }]}>BUONGIORNO</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ STORICO MERCATO (tra griglia e Salva, stesso GAP) ═══ */}
      <View style={[s.section, { height: STORICO_H }]}>
        <TouchableOpacity activeOpacity={0.85} style={[s.storico, { flex: 1, marginBottom: Math.round(GAP * 0.4) }]}>
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

      <View style={{ height: GAP }} />

      {/* ═══ SALVA GIORNATA ═══ */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={[s.salva, { height: SALVA_H }]}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>SALVA GIORNATA</Text>
      </TouchableOpacity>

      {/* ═══ MODALE CAMPANELLO / NOTIFICHE ═══ */}
      <Modal visible={showBellModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>APPUNTI DI OGGI</Text>
            <Text style={s.modalSub}>{giorno} {data}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {appuntiOggi.length === 0 ? (
                <Text style={s.modalEmpty}>Nessun appunto per oggi</Text>
              ) : (
                appuntiOggi.map((a, i) => (
                  <View key={i} style={s.modalRow}>
                    <Ionicons name="document-text" size={18} color="#1E7F85" />
                    <Text style={[s.modalLabel, { flex: 1 }]}>{a.testo}</Text>
                    <TouchableOpacity onPress={() => { removeAppunto(a.data, a.testo); }}>
                      <Ionicons name="close-circle" size={22} color="#D46A6A" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowBellModal(false)}>
              <Text style={s.modalCloseTxt}>CHIUDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ MODALE INVENDUTO / PRODOTTI ═══ */}
      <Modal visible={showInvendutoModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>CALCOLO INVENDUTO</Text>
            <Text style={s.modalSub}>Inserisci la quantità invenduta per prodotto</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {tuttiProdotti.length === 0 ? (
                <View>
                  <Text style={s.modalEmpty}>Nessun prodotto registrato. Vai in Impostazioni → Fornitori per aggiungere i prodotti.</Text>
                  <View style={s.modalDivider} />
                  <Text style={[s.modalSub, { marginBottom: 8 }]}>Oppure inserisci manualmente:</Text>
                  <TextInput
                    style={s.manualInput}
                    placeholder="Importo €"
                    placeholderTextColor="#A0B5A8"
                    keyboardType="numeric"
                    value={invenduto}
                    onChangeText={setInvenduto}
                    textAlign="center"
                  />
                </View>
              ) : (
                tuttiProdotti.map((p, i) => {
                  const key = `${p.fornitore}_${p.nome}`;
                  const qty = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
                  const subtot = qty * p.prezzo;
                  return (
                    <View key={i} style={s.invProdRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.invProdName}>{p.nome}</Text>
                        <Text style={s.invProdInfo}>{p.fornitore} · €{p.prezzo}/kg</Text>
                      </View>
                      <TextInput
                        style={s.invQtyInput}
                        placeholder="0"
                        placeholderTextColor="#C0B5A5"
                        keyboardType="numeric"
                        value={invendutoQty[key] || ''}
                        onChangeText={(t) => setInvendutoQty((prev) => ({ ...prev, [key]: t }))}
                        textAlign="center"
                      />
                      <Text style={s.invSubtot}>€{Math.round(subtot)}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            {tuttiProdotti.length > 0 && (
              <>
                <View style={s.modalDivider} />
                <View style={s.modalTotalRow}>
                  <Text style={s.modalTotalLabel}>TOTALE INVENDUTO</Text>
                  <Text style={s.modalTotalVal}>€{Math.round(invendutoCalcolato)}</Text>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.modalClose, { flex: 1, backgroundColor: '#B0A898' }]} onPress={() => setShowInvendutoModal(false)}>
                <Text style={s.modalCloseTxt}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalClose, { flex: 1 }]} onPress={confermaInvenduto}>
                <Text style={s.modalCloseTxt}>CONFERMA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODALE SPESE FISSE ═══ */}
      <Modal visible={showSpeseFisseModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>SPESE FISSE GIORNALIERE</Text>
            <Text style={s.modalSub}>Disabilita le voci da escludere dal calcolo UTILE</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {speseFisseOggi.length === 0 ? (
                <Text style={s.modalEmpty}>Nessuna spesa fissa configurata. Vai in Impostazioni.</Text>
              ) : (
                speseFisseOggi.map((it) => {
                  const disabled = (speseFisseDisabilitate || []).includes(it.id);
                  return (
                    <View key={it.id} style={s.modalRow}>
                      <Switch
                        value={!disabled}
                        onValueChange={() => toggleSpesaFissa(it.id)}
                        trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
                        thumbColor="#FFF"
                      />
                      <Text style={[s.modalLabel, disabled && { color: '#B0B0A5', textDecorationLine: 'line-through' }]}>{it.label}</Text>
                      <Text style={[s.modalVal, disabled && { color: '#B0B0A5' }]}>€{Math.round(it.importoGG)}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View style={s.modalDivider} />
            <View style={s.modalTotalRow}>
              <Text style={s.modalTotalLabel}>TOTALE ATTIVO</Text>
              <Text style={s.modalTotalVal}>€{Math.round(speseFisse)}</Text>
            </View>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowSpeseFisseModal(false)}>
              <Text style={s.modalCloseTxt}>CHIUDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    fontSize: 24,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  badgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  badge: {
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  bellRight: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E44',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2,
  },
  dateTxt: { fontSize: 13, fontWeight: '700', color: '#2A5050' },

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
  toggleTxt: { fontSize: 14, fontWeight: '700', color: '#4A3A2A' },
  piazzaBtn: {
    backgroundColor: '#1E7F85',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  piazzaTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

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
    fontSize: 9,
    fontWeight: '700',
    color: '#5A7575',
    textAlign: 'center',
    marginBottom: 4,
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
  collabTxt: { fontSize: 12, fontWeight: '700', color: '#4A3A2A' },

  /* Grid */
  gridRow: { flexDirection: 'row' },
  card: {
    flex: 1,
    backgroundColor: '#EDE8DA',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  cardLbl: { fontSize: 12, fontWeight: '600', color: '#4A4A40' },
  cardBold: { fontSize: 14, fontWeight: '800', color: '#1A3535' },
  cardInp: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A3535',
    textAlign: 'right',
    minWidth: 55,
    padding: 0,
  },
  cardVal: { fontSize: 14, fontWeight: '700', color: '#1A3535' },
  cardValBold: { fontSize: 17, fontWeight: '800' },

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
  storicoT: { fontSize: 14, fontWeight: '800', color: '#1A3535' },
  storicoDay: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  storicoVal: { fontSize: 16, fontWeight: '900', color: '#1A3535' },
  storicoSub: { fontSize: 8, fontWeight: '600', color: '#7A9090', marginTop: 1 },

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
  filterTxt: { fontSize: 9, fontWeight: '800', color: '#4A3A2A', textAlign: 'center' },
  filterSub: { fontSize: 6, fontWeight: '600', color: '#7A6A5A', textAlign: 'center' },

  /* Salva */
  salva: {
    backgroundColor: '#1E7F85',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  salvaTxt: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* Modal Spese Fisse */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#EDE8DA',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    // @ts-ignore
    boxShadow: '8px 8px 20px rgba(0,0,0,0.3)',
  },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#1A3535', textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 10, color: '#7A9090', textAlign: 'center', marginBottom: 16 },
  modalEmpty: { fontSize: 13, color: '#7A9090', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  modalLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A3535' },
  modalVal: { fontSize: 14, fontWeight: '800', color: '#1E7F85' },
  modalDivider: { height: 1, backgroundColor: '#C5DDD4', marginVertical: 12 },
  modalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTotalLabel: { fontSize: 12, fontWeight: '800', color: '#5A7575', letterSpacing: 1 },
  modalTotalVal: { fontSize: 20, fontWeight: '900', color: '#1E7F85' },
  modalClose: {
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5), -3px -3px 8px rgba(45,120,125,0.35)',
  },
  modalCloseTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  /* Invenduto Modal */
  invProdRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#D8EDE5' },
  invProdName: { fontSize: 14, fontWeight: '700', color: '#1A3535' },
  invProdInfo: { fontSize: 10, color: '#7A9090' },
  invQtyInput: { width: 55, fontSize: 16, fontWeight: '800', color: '#1E7F85', borderWidth: 1.5, borderColor: '#1E7F85', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4 },
  invSubtot: { width: 55, fontSize: 14, fontWeight: '800', color: '#1A3535', textAlign: 'right' },
  manualInput: { fontSize: 24, fontWeight: '900', color: '#1E7F85', borderWidth: 1.5, borderColor: '#1E7F85', borderRadius: 10, paddingVertical: 10, marginTop: 8 },
});
