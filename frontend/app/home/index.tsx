import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { getGiornoIndex } from '../../src/utils/dateUtils';
import { CalendarModal } from '../../src/components/CalendarModal';
import { FieraModal } from '../../src/components/FieraModal';
import { UtileModal } from '../../src/components/UtileModal';
import { SpeseExtraModal } from '../../src/components/SpeseExtraModal';
import { BuongiornoModal } from '../../src/components/BuongiornoModal';
import { useTranslation } from 'react-i18next';
import { getDayNames, getMonthNames } from '../../src/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';

// Day/Month names now come from i18n via getDayNames/getMonthNames

const WEATHER_ICONS: Array<{ icon: string; labelKey: string; color: string; bg: string }> = [
  { icon: 'weather-sunny', labelKey: 'home.sun', color: '#FF8C00', bg: '#FFF3E0' },
  { icon: 'weather-partly-cloudy', labelKey: 'home.cloud', color: '#7A8A9A', bg: '#ECEFF1' },
  { icon: 'weather-rainy', labelKey: 'home.rain', color: '#4A90D9', bg: '#E3F2FD' },
  { icon: 'weather-lightning', labelKey: 'home.snow', color: '#FFB300', bg: '#FFF8E1' },
  { icon: 'weather-windy', labelKey: 'home.wind', color: '#26A69A', bg: '#E0F2F1' },
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
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata, speseFisseDisabilitate, fornitori, appuntiAgenda, removeAppunto, ordiniAgenda, removeOrdine } = useAppStore();
  const store = useAppStore();
  const { t } = useTranslation();
  const dayNames = getDayNames();
  const monthNames = getMonthNames();
  const { height: screenH } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  const isAlimentare = store.isAlimentare;
  const perditaLabel = isAlimentare ? (t('home.unsold') || 'INVENDUTO') : 'PERDITA';
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
  const [chartMode, setChartMode] = useState<'mese' | 'anno' | 'annoprec'>('anno');
  const [fieraLuogo, setFieraLuogo] = useState('');
  const [fieraKm, setFieraKm] = useState('');
  const [fieraPlat, setFieraPlat] = useState('');
  const [showFieraModal, setShowFieraModal] = useState(false);
  const [showUtileModal, setShowUtileModal] = useState(false);
  const [showSpeseExtraModal, setShowSpeseExtraModal] = useState(false);
  const [excludeSpeseExtra, setExcludeSpeseExtra] = useState(false);
  const [excludeInvenduto, setExcludeInvenduto] = useState(false);
  const [excludeSpeseFisse, setExcludeSpeseFisse] = useState(false);
  const [excludeCollaboratori, setExcludeCollaboratori] = useState(false);
  const [speseExtraFornitore, setSpeseExtraFornitore] = useState<Record<string, { importo: string; periodo: string }>>({});
  const [showBuongiorno, setShowBuongiorno] = useState(false);
  const [vociGeneriche, setVociGeneriche] = useState<Array<{nome: string; importo: string; attivo: boolean}>>([]);
  
  // Tooltip elegante per il grafico
  const [chartTooltip, setChartTooltip] = useState<{visible: boolean; label: string; value: number} | null>(null);

  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [invenduto, setInvenduto] = useState('');

  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? 'Fiera' : (mercatoOggi?.mercato || '');
  const giorno = dayNames[(dataCorrente.getDay() + 6) % 7]; // dayNames is Mon-Sun, getDay() is Sun=0
  const data = `${dataCorrente.getDate()} ${monthNames[dataCorrente.getMonth()]}`;

  useEffect(() => {
    const p: Record<string, boolean> = {};
    collaboratori.forEach((c) => { p[c.nome] = false; });
    setPresenze(p);
  }, [collaboratori]);

  /* ── Appunti prossimi 2 giorni per notifiche campanello ── */
  const appuntiProssimi = useMemo(() => {
    const oggi = new Date(dataCorrente);
    oggi.setHours(0, 0, 0, 0);
    const fra2gg = new Date(oggi);
    fra2gg.setDate(fra2gg.getDate() + 2);
    fra2gg.setHours(23, 59, 59, 999);
    return (appuntiAgenda || []).filter((a) => {
      const d = new Date(a.data);
      return d >= oggi && d <= fra2gg;
    });
  }, [appuntiAgenda, dataCorrente]);

  /* ── Ordini prossimi 2 giorni per notifiche campanello ── */
  const ordiniProssimi = useMemo(() => {
    const oggi = new Date(dataCorrente);
    oggi.setHours(0, 0, 0, 0);
    const fra2gg = new Date(oggi);
    fra2gg.setDate(fra2gg.getDate() + 2);
    fra2gg.setHours(23, 59, 59, 999);
    return (ordiniAgenda || []).filter((o) => {
      const d = new Date(o.data);
      return d >= oggi && d <= fra2gg;
    });
  }, [ordiniAgenda, dataCorrente]);

  /* ── Conteggio notifiche totale (appuntamenti + ordini, NO diario) ── */
  const notificheCount = appuntiProssimi.length + ordiniProssimi.length;

  /* ── Animazione barre grafico ── */
  const chartAnimRef = useRef(new Animated.Value(0)).current;
  const [chartReady, setChartReady] = useState(false);
  
  useEffect(() => {
    chartAnimRef.setValue(0);
    setChartReady(false);
    Animated.timing(chartAnimRef, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start(() => setChartReady(true));
  }, [chartMode, mercatoNome]);

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

  /* ── Invenduto/Perdita calculated from product quantities ── */
  const invendutoCalcolato = useMemo(() => {
    let tot = 0;
    tuttiProdotti.forEach((p) => {
      const key = `${p.fornitore}_${p.nome}`;
      if (isAlimentare) {
        // Alimentare: qty × prezzo/kg
        const qty = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
        tot += qty * p.prezzo;
      } else {
        // Non-alimentare: direttamente il prezzo perdita
        const price = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
        tot += price;
      }
    });
    return tot;
  }, [tuttiProdotti, invendutoQty, isAlimentare]);

  const confermaInvenduto = () => {
    setInvenduto(parseFloat(invendutoCalcolato.toFixed(2)).toString());
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

    // Plateatico for ALL markets → use p_giornaliero directly when available
    agenda.forEach((m) => {
      if (m.p_giornaliero > 0) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: m.p_giornaliero });
      } else if (m.p_annuo > 0) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: Math.round(m.p_annuo / 48 * 100) / 100 });
      }
    });

    return items;
  }, [speseAnnue, agenda]);

  // Add fuel cost as daily fixed expense
  const costoCarburanteSpeso = store.storicoCarburante.reduce((s: number, c: any) => s + (c.euro || 0), 0);
  const kmTotPercorsi = store.storicoGiornate.reduce((s: number, g: any) => s + (g.km || 0), 0);
  const costoPerKm = kmTotPercorsi > 0 ? costoCarburanteSpeso / kmTotPercorsi : 0.18;

  const speseFisseConCarburante = useMemo(() => {
    const items = [...speseFisseItems];
    const kmMercato = mercatoOggi?.km || 0;
    if (kmMercato > 0) {
      const costoCarb = Math.round(kmMercato * costoPerKm * 100) / 100;
      items.push({ id: 'carburante_gg', label: t('home.fuelCost') || 'Carburante', importoGG: costoCarb });
    }
    return items;
  }, [speseFisseItems, mercatoOggi, costoPerKm]);

  // Filter: only show today's plateatico + all general spese + fuel
  const speseFisseOggi = useMemo(() => {
    const mercatoGiornoId = `plat_${mercatoOggi?.giorno}`;
    return speseFisseConCarburante.filter((it) => {
      if (it.id === 'carburante_gg') return true;
      if (it.id.startsWith('plat_')) return it.id === mercatoGiornoId;
      return true;
    });
  }, [speseFisseConCarburante, mercatoOggi]);

  const speseFisse = speseFisseOggi
    .filter((it) => !(speseFisseDisabilitate || []).includes(it.id))
    .reduce((s, it) => s + it.importoGG, 0);

  const toggleSpesaFissa = (id: string) => {
    const disabled = speseFisseDisabilitate || [];
    const newList = disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id];
    store.setConfig({ speseFisseDisabilitate: newList });
  };

  /* ── Spese Extra fornitori totale ── */
  const speseExtraFornTotale = useMemo(() => {
    let tot = 0;
    Object.values(speseExtraFornitore).forEach((v) => {
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (v.periodo === 'settimanale') tot += imp / 6;
      else if (v.periodo === 'mensile') tot += imp / 26;
      else tot += imp; // giornaliero
    });
    return tot;
  }, [speseExtraFornitore]);

  /* ── Spese Extra generiche totale ── */
  const speseExtraGenTotale = useMemo(() => {
    let tot = 0;
    vociGeneriche.forEach((v) => {
      if (v.attivo) tot += parseFloat((v.importo || '0').replace(',', '.')) || 0;
    });
    return tot;
  }, [vociGeneriche]);

  /* ── Plateatico Fiera → aggiungere a spese fisse ── */
  const fieraPlatNum = parseFloat((fieraPlat || '0').replace(',', '.')) || 0;

  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const speseExtraTotNum = excludeSpeseExtra ? 0 : speseExtraFornTotale + speseExtraGenTotale;
  const invendutoNum = excludeInvenduto ? 0 : (parseFloat(invenduto.replace(',', '.')) || 0);

  // Costo collaboratori attivi (presenti oggi)
  const costoCollabAttivi = collaboratori
    .filter((c) => presenze[c.nome])
    .reduce((s, c) => s + (c.costo || 0), 0);

  // Spese fisse totali = spese fisse annuali + plateatico fiera (se attivo)
  const speseFisseTotali = speseFisse + (isFiera ? fieraPlatNum : 0);

  // UTILE: calcolo con flag macro-categorie
  const utile = lordoNum
    - (excludeSpeseFisse ? 0 : speseFisseTotali)
    - (excludeSpeseExtra ? 0 : speseExtraTotNum)
    - (excludeInvenduto ? 0 : invendutoNum)
    - (excludeCollaboratori ? 0 : costoCollabAttivi);
  /* ── Storico mercato dati reali ── */
  const storicoMercato = useMemo(() => {
    const gg = store.storicoGiornate || [];
    const now = dataCorrente;
    const mNome = mercatoNome.toLowerCase();
    const filtered = gg.filter((g) => g.mercato.toLowerCase() === mNome);

    const meseData = filtered.filter((g) => {
      const d = new Date(g.data);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const annoData = filtered.filter((g) => new Date(g.data).getFullYear() === now.getFullYear());
    const annoPrecData = filtered.filter((g) => new Date(g.data).getFullYear() === now.getFullYear() - 1);

    const calcTot = (arr: typeof gg) => arr.reduce((s, g) => s + (g.lordo || 0), 0);
    const calcMedia = (arr: typeof gg) => arr.length > 0 ? calcTot(arr) / arr.length : 0;

    const meseTot = calcTot(meseData);
    const annoTot = calcTot(annoData);
    const annoPrecTot = calcTot(annoPrecData);

    if (chartMode === 'mese') return { totale: meseTot, media: calcMedia(meseData), giorni: meseData.length, label: 'questo mese' };
    if (chartMode === 'annoprec') return { totale: annoPrecTot, media: calcMedia(annoPrecData), giorni: annoPrecData.length, label: 'anno prec.' };
    return { totale: annoTot, media: calcMedia(annoData), giorni: annoData.length, label: 'quest\'anno' };
  }, [store.storicoGiornate, mercatoNome, chartMode, dataCorrente]);

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
    // Build dettaglio_fornitori from speseExtraFornitore
    const dettaglioForn: Record<string, number> = {};
    Object.entries(speseExtraFornitore).forEach(([nome, v]) => {
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (imp > 0) {
        if (v.periodo === 'settimanale') dettaglioForn[nome] = imp / 6;
        else if (v.periodo === 'mensile') dettaglioForn[nome] = imp / 26;
        else dettaglioForn[nome] = imp;
      }
    });

    salvaGiornata({
      data: dataCorrente, mercato: mercatoNome, meteo,
      km: mercatoOggi?.km || 0, lordo: lordoNum, netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraTotNum,
      dettaglio_staff: presenze,
      dettaglio_invenduto: { totale: invendutoNum },
      dettaglio_fornitori: dettaglioForn,
    } as any);
    playSuccess(); // Conferma sonora + aptica, nessun popup
  };

  /* ─── UNIFIED PROPORTIONAL LAYOUT ─── */
  // Use real safe area insets for accurate layout on all devices
  const TAB_BAR = 70 + Math.max(safeInsets.bottom, 10);
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : safeInsets.top + 16;
  const contentH = screenH - TAB_BAR - topPad;
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
  const SALVA_H = 4.5 * vh;  // Ridotto per avvicinare al bottom

  // 9 uniform gaps between 10 vertical blocks
  const TOTAL_GAPS = 8 * GAP;  // Ridotto da 9 a 8 per meno spazio
  const gridInternalGaps = 3 * GAP;

  // Available space for grid rows + storico
  const fixedH = HEADER_H + TOGGLE_H + WEATHER_H + COLLAB_H + SALVA_H + TOTAL_GAPS + gridInternalGaps;
  const availableH = contentH - fixedH;
  // Weight units: LORDO=1.2, 3×normal=0.8 each, STORICO=3.2 → total 6.8
  const unit = availableH / 6.8;
  const lordoRowH = unit * 1.2;
  const normalRowH = unit * 0.8;
  const STORICO_H = unit * 3.2;  // Grafico grande e leggibile

  // Altezza area barre in pixel (sottraendo filtri, padding, label sopra/sotto)
  // STORICO_H = card storico + filter row; filter row ≈ 30px
  // Card padding: 8*2=16; Values header: 16; Labels footer: 17
  const BAR_AREA_H = Math.max(STORICO_H - 30 - Math.round(GAP * 0.4) - 16 - 16 - 17, 30);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      {/* ═══ HEADER ═══ */}
      <View style={[s.section, { height: HEADER_H, justifyContent: 'flex-end', paddingTop: 4, alignItems: 'center' }]}>
        {/* Nome attività piccolo sopra il mercato */}
        {nomeAttivita ? (
          <Text style={s.activityNameSmall} numberOfLines={1}>{nomeAttivita.toUpperCase()}</Text>
        ) : null}
        {/* Bell a destra - ZONA SEPARATA con area di tocco grande */}
        <TouchableOpacity 
          onPress={() => { hapticTap(); setShowBellModal(true); }} 
          activeOpacity={0.7}
          style={s.bellTouchArea}
          hitSlop={{ top: 10, bottom: 10, left: 15, right: 15 }}
        >
          <View style={[s.bell, notificheCount > 0 && { backgroundColor: '#E44' }]}>
            <Ionicons name="notifications" size={20} color="#FFF" />
            {notificheCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeTxt}>{notificheCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Text style={s.marketName} numberOfLines={1}>{mercatoNome.toUpperCase() || t('home.noMarketToday')}</Text>
        <TouchableOpacity onPress={() => { hapticTap(); setShowCalendar(true); }} activeOpacity={0.7}>
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
              <Text style={[s.toggleTxt, !isFiera && { color: '#FFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('home.market')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setIsFiera(true); setShowFieraModal(true); }}>
            <View style={[s.toggle, isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, isFiera && { color: '#FFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('stats.fairs') || 'FIERE'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazzaBtn, !isInPiazza && { backgroundColor: '#D55' }]}>
              <Text style={s.piazzaTxt}>{isInPiazza ? t('home.market') : '---'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ WEATHER (icone = dimensione tab bar) ═══ */}
      <View style={[s.section, { height: WEATHER_H, justifyContent: 'center' }]}>
        <View style={s.meteoRow}>
          {WEATHER_ICONS.map((w, i) => {
            const wLabel = t(w.labelKey);
            const sel = meteo === wLabel;
            return (
              <TouchableOpacity key={i} onPress={() => { hapticTap(); setMeteo(wLabel); }} activeOpacity={0.7}>
                <View style={[s.meteo, { width: WEATHER_SIZE, height: WEATHER_SIZE, borderRadius: WEATHER_SIZE / 2, backgroundColor: sel ? w.color : w.bg }, sel && { borderWidth: 2, borderColor: w.color }]}>
                  <MaterialCommunityIcons name={w.icon as any} size={WEATHER_ICON} color={sel ? '#FFF' : w.color} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ COLLABORATORI (subito sotto meteo, stesso GAP) ═══ */}
      <View style={[s.section, { height: COLLAB_H, justifyContent: 'center' }]}>
        <Text style={s.secLabel}>{t('home.collaborators')}</Text>
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

      <View style={{ height: GAP * 2 }} />

      {/* ═══ ROW 1: LORDO / UTILE (+20% altezza) ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: lordoRowH }]}>
          <Text style={s.cardBold}>{t('home.gross')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={setLordo} selectTextOnFocus />
        </View>
        <TouchableOpacity style={[s.card, { height: lordoRowH }]} activeOpacity={0.7} onPress={() => setShowUtileModal(true)}>
          <Text style={s.cardBold}>{t('home.profit')}</Text>
          <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>{'\u20AC'}{Math.round(utile)}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 2: CONTANTI / POS ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>{t('home.cash')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} selectTextOnFocus />
        </View>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>{t('home.pos')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} selectTextOnFocus />
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 3: SPESE EXTRA (cliccabile → fornitori) / SPESE FISSE ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowSpeseExtraModal(true)}>
          <Text style={s.cardLbl}>{t('home.extraExpenses')}</Text>
          <Text style={s.cardVal}>{'\u20AC'}{(speseExtraFornTotale + speseExtraGenTotale).toFixed(2)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowSpeseFisseModal(true)}>
          <Text style={s.cardLbl}>{t('home.fixedExpenses')}</Text>
          <Text style={s.cardVal}>{'\u20AC'}{speseFisseTotali.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 4: INVENDUTO/PERDITA / BUONGIORNO ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowInvendutoModal(true)}>
          <Text style={s.cardLbl}>{perditaLabel}</Text>
          <Text style={s.cardVal}>{invendutoNum > 0 ? `€${invendutoNum}` : '0'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { height: normalRowH, backgroundColor: '#1E7F85' }]} activeOpacity={0.7} onPress={() => setShowBuongiorno(true)}>
          <Ionicons name="globe-outline" size={16} color="#FFF" />
          <Text style={[s.cardBold, { color: '#FFF', fontSize: 12 }]}>{t('home.goodMorning').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ STORICO MERCATO - Grafico Professionale ═══ */}
      <View style={[s.section, { height: STORICO_H }]}>
        <View style={[s.storico, { flex: 1, marginBottom: Math.round(GAP * 0.4), flexDirection: 'row', padding: 8 }]}>
          {(() => {
            const gg = store.storicoGiornate || [];
            const mNome = mercatoNome.toLowerCase();
            const filtered = gg.filter((g) => g.mercato.toLowerCase() === mNome);
            const currentYear = new Date().getFullYear();
            const prevYear = currentYear - 1;
            
            let chartData: number[] = [];
            let chartLabels: string[] = [];
            let media = 0;
            let totale = 0;
            let giorniCount = 0;
            
            // Dati per confronto anno
            let totaleAnnoCorr = 0;
            let totaleAnnoPrec = 0;
            
            if (chartMode === 'mese') {
              chartLabels = ['S1', 'S2', 'S3', 'S4'];
              chartData = Array(4).fill(0);
              const meseData = filtered.filter((g) => {
                const d = new Date(g.data);
                return d.getMonth() === dataCorrente.getMonth() && d.getFullYear() === currentYear;
              });
              meseData.forEach((g) => {
                const week = Math.min(Math.floor((new Date(g.data).getDate() - 1) / 7), 3);
                chartData[week] += g.lordo || 0;
              });
              giorniCount = meseData.length;
              totale = chartData.reduce((s, v) => s + v, 0);
              media = giorniCount > 0 ? totale / giorniCount : 0;
            } else if (chartMode === 'anno') {
              // 12 barre per i mesi
              chartLabels = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
              chartData = Array(12).fill(0);
              const yearData = filtered.filter((g) => new Date(g.data).getFullYear() === currentYear);
              yearData.forEach((g) => { chartData[new Date(g.data).getMonth()] += g.lordo || 0; });
              giorniCount = yearData.length;
              totale = chartData.reduce((s, v) => s + v, 0);
              media = totale / 12;
            } else {
              // ANNO PREC - confronto 2 barre
              chartLabels = [String(prevYear), String(currentYear)];
              const yearDataPrec = filtered.filter((g) => new Date(g.data).getFullYear() === prevYear);
              const yearDataCorr = filtered.filter((g) => new Date(g.data).getFullYear() === currentYear);
              totaleAnnoPrec = yearDataPrec.reduce((s, g) => s + (g.lordo || 0), 0);
              totaleAnnoCorr = yearDataCorr.reduce((s, g) => s + (g.lordo || 0), 0);
              chartData = [totaleAnnoPrec, totaleAnnoCorr];
              giorniCount = yearDataPrec.length + yearDataCorr.length;
              totale = totaleAnnoPrec + totaleAnnoCorr;
              media = totale / 2;
            }
            
            const maxVal = Math.max(...chartData, 1);
            const deltaPercent = totaleAnnoPrec > 0 ? Math.round(((totaleAnnoCorr - totaleAnnoPrec) / totaleAnnoPrec) * 100) : 0;
            
            return (
              <>
                {/* SINISTRA - Numeri */}
                <View style={{ width: chartMode === 'annoprec' ? 100 : 80, justifyContent: 'center', paddingRight: 6 }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A4040' }}>
                    €{Math.round(totale)}
                  </Text>
                  <Text style={{ fontSize: 9, color: '#7A9090', fontWeight: '600', marginTop: 2 }}>{giorniCount} giornate</Text>
                  
                  {/* KPI Delta - solo per ANNO PREC */}
                  {chartMode === 'annoprec' && (
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: deltaPercent >= 0 ? 'rgba(42,170,100,0.15)' : 'rgba(212,70,70,0.15)',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      marginTop: 6,
                      alignSelf: 'flex-start',
                    }}>
                      <Ionicons 
                        name={deltaPercent >= 0 ? 'trending-up' : 'trending-down'} 
                        size={14} 
                        color={deltaPercent >= 0 ? '#2AAA64' : '#D44646'} 
                      />
                      <Text style={{ fontSize: 13, fontWeight: '900', color: deltaPercent >= 0 ? '#2AAA64' : '#D44646', marginLeft: 4 }}>
                        {deltaPercent > 0 ? '+' : ''}{deltaPercent}%
                      </Text>
                    </View>
                  )}
                  
                  {/* Media - solo per MESE e ANNO */}
                  {chartMode !== 'annoprec' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <View style={{ width: 10, height: 2, backgroundColor: '#1E7F85', marginRight: 4, borderRadius: 1 }} />
                      <Text style={{ fontSize: 8, color: '#1E7F85', fontWeight: '700' }}>
                        media €{media.toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* DESTRA - Grafico a BARRE */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  {chartMode === 'anno' ? (
                    // ANNO - Layout con barre ANIMATE
                    <View style={{ flex: 1 }}>
                      {/* Tooltip elegante on-tap (no numeri fissi sopra) */}
                      {chartTooltip?.visible && (
                        <View style={{ alignItems: 'center', height: 18, marginBottom: 2 }}>
                          <View style={{ backgroundColor: '#1A4040', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF' }}>
                              {chartTooltip.label}: €{Math.round(chartTooltip.value)}
                            </Text>
                          </View>
                        </View>
                      )}
                      {!chartTooltip?.visible && <View style={{ height: 18, marginBottom: 2 }} />}
                      
                      {/* Barre ANIMATE - TOUCHABLE */}
                      <View style={{ height: BAR_AREA_H, flexDirection: 'row', alignItems: 'flex-end' }}>
                        {chartData.map((val, i) => {
                          const hPx = maxVal > 0 ? (val / maxVal) * BAR_AREA_H : 0;
                          const meseNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                          const animH = chartAnimRef.interpolate({
                            inputRange: [0, 1],
                            outputRange: [4, Math.max(hPx, 4)],
                          });
                          return (
                            <TouchableOpacity 
                              key={i} 
                              style={{ flex: 1, alignItems: 'center', height: BAR_AREA_H, justifyContent: 'flex-end' }}
                              activeOpacity={0.7}
                              onPress={() => {
                                hapticTap();
                                if (val > 0) {
                                  setChartTooltip({ visible: true, label: meseNomi[i], value: val });
                                  setTimeout(() => setChartTooltip(null), 2500);
                                }
                              }}
                            >
                              <Animated.View style={{
                                width: 16,
                                height: animH,
                                minHeight: 4,
                                backgroundColor: val > 0 ? '#E8A060' : '#D0D0D0',
                                borderRadius: 4,
                              }} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      
                      {/* Labels mesi */}
                      <View style={{ flexDirection: 'row', height: 14, marginTop: 3 }}>
                        {chartLabels.map((label, i) => (
                          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 8, color: '#7A9090', fontWeight: '700' }}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      
                      {/* Linea media */}
                      {media > 0 && (
                        <View style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 14 + 3 + (media / maxVal) * BAR_AREA_H,
                          height: 1.5,
                          backgroundColor: '#1E7F85',
                          opacity: 0.5,
                        }} />
                      )}
                    </View>
                  ) : chartMode === 'mese' ? (
                    // MESE - 4 barre ANIMATE CLICCABILI
                    <View style={{ flex: 1 }}>
                      {/* Valori sopra */}
                      <View style={{ flexDirection: 'row', height: 16, marginBottom: 2 }}>
                        {chartData.map((val, i) => (
                          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: val > 0 ? '#1A4040' : '#C0C0C0' }}>
                              {val > 0 ? `€${Math.round(val)}` : '-'}
                            </Text>
                          </View>
                        ))}
                      </View>
                      
                      {/* Barre ANIMATE */}
                      <View style={{ height: BAR_AREA_H, flexDirection: 'row', alignItems: 'flex-end' }}>
                        {chartData.map((val, i) => {
                          const hPx = maxVal > 0 ? (val / maxVal) * BAR_AREA_H : 0;
                          const settLabels = ['Settimana 1', 'Settimana 2', 'Settimana 3', 'Settimana 4'];
                          const animH = chartAnimRef.interpolate({
                            inputRange: [0, 1],
                            outputRange: [4, Math.max(hPx, 4)],
                          });
                          return (
                            <TouchableOpacity 
                              key={i} 
                              style={{ flex: 1, alignItems: 'center', height: BAR_AREA_H, justifyContent: 'flex-end', paddingHorizontal: 4 }}
                              activeOpacity={0.7}
                              onPress={() => {
                                hapticTap();
                                if (val > 0) {
                                  setChartTooltip({ visible: true, label: settLabels[i], value: val });
                                  setTimeout(() => setChartTooltip(null), 2500);
                                }
                              }}
                            >
                              <Animated.View style={{
                                width: 40,
                                height: animH,
                                minHeight: 4,
                                backgroundColor: val > 0 ? '#E8A060' : '#D0D0D0',
                                borderRadius: 6,
                              }} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      
                      {/* Labels settimane */}
                      <View style={{ flexDirection: 'row', height: 14, marginTop: 3 }}>
                        {chartLabels.map((label, i) => (
                          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, color: '#7A9090', fontWeight: '700' }}>{label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    // ANNO PREC - 2 barre ANIMATE confronto
                    <View style={{ flex: 1 }}>
                      {/* Labels anni + valori */}
                      <View style={{ flexDirection: 'row', height: 28, marginBottom: 4 }}>
                        {chartData.map((val, i) => (
                          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7A9090' }}>{chartLabels[i]}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: val > 0 ? '#1A4040' : '#C0C0C0' }}>
                              €{Math.round(val)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      
                      {/* Barre ANIMATE */}
                      <View style={{ height: BAR_AREA_H, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10 }}>
                        {chartData.map((val, i) => {
                          const hPx = maxVal > 0 ? (val / maxVal) * BAR_AREA_H : 0;
                          const animH = chartAnimRef.interpolate({
                            inputRange: [0, 1],
                            outputRange: [6, Math.max(hPx, 6)],
                          });
                          return (
                            <View key={i} style={{ flex: 1, alignItems: 'center', height: BAR_AREA_H, justifyContent: 'flex-end', paddingHorizontal: 8 }}>
                              <Animated.View style={{
                                width: 50,
                                height: animH,
                                minHeight: 6,
                                backgroundColor: i === 0 ? '#7A9090' : '#1E7F85',
                                borderRadius: 6,
                              }} />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              </>
            );
          })()}
        </View>
        
        <View style={s.filterRow}>
          {([['mese', 'MESE'], ['anno', 'ANNO'], ['annoprec', 'ANNO PREC.']] as [string, string][]).map(([k, l]) => {
            const on = chartMode === k;
            return (
              <TouchableOpacity key={k} style={[s.filterBtn, on && s.filterOn]} onPress={() => setChartMode(k as any)}>
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ SALVA GIORNATA ═══ */}
      <TouchableOpacity onPress={handleSalva} activeOpacity={0.8} style={[s.salva, { height: SALVA_H }]}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>{t('home.saveDay')}</Text>
      </TouchableOpacity>

      {/* ═══ MODALE CAMPANELLO / NOTIFICHE ═══ */}
      <Modal visible={showBellModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{t('home.commitmentSummary')}</Text>
            <Text style={s.modalSub}>{t('home.next2days')}</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {/* APPUNTAMENTI prossimi */}
              {appuntiProssimi.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E7F85', marginBottom: 6, letterSpacing: 1 }}>{t('home.appointments')}</Text>
                  {appuntiProssimi.map((a, i) => {
                    const d = new Date(a.data);
                    const isToday = d.toDateString() === dataCorrente.toDateString();
                    const dateLabel = isToday ? t('home.today') : `${d.getDate()}/${d.getMonth() + 1}`;
                    return (
                      <View key={`app-${i}`} style={s.modalRow}>
                        <View style={{ backgroundColor: isToday ? '#1E7F85' : '#7A9090', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{dateLabel}</Text>
                        </View>
                        <Ionicons name="time" size={16} color="#1E7F85" />
                        <Text style={[s.modalLabel, { flex: 1 }]} numberOfLines={2}>{a.testo}</Text>
                        <TouchableOpacity onPress={() => { removeAppunto(a.data, a.testo); }}>
                          <Ionicons name="close-circle" size={20} color="#D46A6A" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ORDINI prossimi */}
              {ordiniProssimi.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#E8A060', marginBottom: 6, letterSpacing: 1 }}>{t('home.orderDeliveries')}</Text>
                  {ordiniProssimi.map((o, i) => {
                    const d = new Date(o.data);
                    const isToday = d.toDateString() === dataCorrente.toDateString();
                    const dateLabel = isToday ? t('home.today') : `${d.getDate()}/${d.getMonth() + 1}`;
                    return (
                      <View key={`ord-${i}`} style={s.modalRow}>
                        <View style={{ backgroundColor: isToday ? '#E8A060' : '#B0A898', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{dateLabel}</Text>
                        </View>
                        <Ionicons name="cube" size={16} color="#E8A060" />
                        <Text style={[s.modalLabel, { flex: 1 }]} numberOfLines={2}>{o.testo}</Text>
                        <TouchableOpacity onPress={() => { removeOrdine(o.data, o.testo); }}>
                          <Ionicons name="close-circle" size={20} color="#D46A6A" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {notificheCount === 0 && (
                <Text style={s.modalEmpty}>{t('home.noCommitmentsNext2days')}</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowBellModal(false)}>
              <Text style={s.modalCloseTxt}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ MODALE INVENDUTO / PERDITA ═══ */}
      <Modal visible={showInvendutoModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{perditaLabel}</Text>
            <Text style={s.modalSub}>
              {isAlimentare
                ? 'Inserisci la quantità invenduta per prodotto'
                : 'Inserisci le perdite per fornitore con motivo'}
            </Text>
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
              ) : isAlimentare ? (
                /* ── ALIMENTARE: qty × prezzo/kg ── */
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
                      <Text style={s.invSubtot}>{'\u20AC'}{subtot.toFixed(2)}</Text>
                    </View>
                  );
                })
              ) : (
                /* ── NON ALIMENTARE: fornitore + motivo + prezzo ── */
                tuttiProdotti.map((p, i) => {
                  const key = `${p.fornitore}_${p.nome}`;
                  return (
                    <View key={i} style={[s.invProdRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="business-outline" size={14} color="#1E7F85" />
                        <Text style={[s.invProdName, { marginLeft: 6, flex: 1 }]}>{p.fornitore} — {p.nome}</Text>
                      </View>
                      <TextInput
                        style={[s.manualInput, { fontSize: 12, paddingVertical: 6, marginBottom: 4 }]}
                        placeholder="Motivo (es: maglione bucato)"
                        placeholderTextColor="#B0B5A8"
                        value={invendutoQty[`${key}_motivo`] || ''}
                        onChangeText={(t) => setInvendutoQty((prev) => ({ ...prev, [`${key}_motivo`]: t }))}
                      />
                      <TextInput
                        style={[s.manualInput, { fontSize: 14, paddingVertical: 8 }]}
                        placeholder="Prezzo perdita €"
                        placeholderTextColor="#B0B5A8"
                        keyboardType="numeric"
                        value={invendutoQty[key] || ''}
                        onChangeText={(t) => setInvendutoQty((prev) => ({ ...prev, [key]: t }))}
                        textAlign="center"
                      />
                    </View>
                  );
                })
              )}
            </ScrollView>
            {tuttiProdotti.length > 0 && (
              <>
                <View style={s.modalDivider} />
                <View style={s.modalTotalRow}>
                  <Text style={s.modalTotalLabel}>TOTALE {perditaLabel}</Text>
                  <Text style={s.modalTotalVal}>{'\u20AC'}{invendutoCalcolato.toFixed(2)}</Text>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
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
            {isFiera && fieraPlatNum > 0 && (
              <View style={[s.modalRow, { backgroundColor: '#E8DCC8', marginBottom: 8 }]}>
                <Ionicons name="star" size={16} color="#D4AF37" />
                <Text style={s.modalLabel}>Plateatico Fiera</Text>
                <Text style={s.modalVal}>{'\u20AC'}{fieraPlatNum.toFixed(2)}</Text>
              </View>
            )}
            <View style={s.modalDivider} />
            <View style={s.modalTotalRow}>
              <Text style={s.modalTotalLabel}>TOTALE ATTIVO</Text>
              <Text style={s.modalTotalVal}>{'\u20AC'}{speseFisseTotali.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowSpeseFisseModal(false)}>
              <Text style={s.modalCloseTxt}>{t('common.close')}</Text>
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

      {/* Fiera Modal */}
      <FieraModal
        visible={showFieraModal}
        onClose={() => setShowFieraModal(false)}
        luogo={fieraLuogo}
        setLuogo={setFieraLuogo}
        km={fieraKm}
        setKm={setFieraKm}
        plateatico={fieraPlat}
        setPlateatico={setFieraPlat}
      />

      {/* UTILE Breakdown Modal */}
      <UtileModal
        visible={showUtileModal}
        onClose={() => setShowUtileModal(false)}
        speseFisse={speseFisseTotali}
        excludeSpeseFisse={excludeSpeseFisse}
        toggleExcludeSpeseFisse={() => setExcludeSpeseFisse(!excludeSpeseFisse)}
        collabCosto={costoCollabAttivi}
        excludeCollaboratori={excludeCollaboratori}
        toggleExcludeCollaboratori={() => setExcludeCollaboratori(!excludeCollaboratori)}
        speseExtra={speseExtraFornTotale + speseExtraGenTotale}
        excludeSpeseExtra={excludeSpeseExtra}
        toggleExcludeSpeseExtra={() => setExcludeSpeseExtra(!excludeSpeseExtra)}
        invenduto={parseFloat(invenduto.replace(',', '.')) || 0}
        excludeInvenduto={excludeInvenduto}
        toggleExcludeInvenduto={() => setExcludeInvenduto(!excludeInvenduto)}
        utile={utile}
        lordo={lordoNum}
      />

      {/* Spese Extra Fornitori Modal */}
      <SpeseExtraModal
        visible={showSpeseExtraModal}
        onClose={() => setShowSpeseExtraModal(false)}
        fornitori={fornitori}
        speseExtraFornitore={speseExtraFornitore}
        setSpeseExtraFornitore={setSpeseExtraFornitore}
        vociGeneriche={vociGeneriche}
        setVociGeneriche={setVociGeneriche}
      />

      {/* Buongiorno AI Modal */}
      <BuongiornoModal
        visible={showBuongiorno}
        onClose={() => setShowBuongiorno(false)}
        storeData={{
          nomeAttivita: store.nomeAttivita || 'La mia attivita',
          nomeTitolare: store.nomeTitolare || 'Titolare',
          meteoOggi: meteo,
          mercatoOggi: mercatoNome,
          settimanaPrec: (() => {
            const now = dataCorrente;
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const prev = (store.storicoGiornate || []).filter((g) => {
              const d = new Date(g.data);
              return d >= weekAgo && d < now;
            });
            return {
              lordo: prev.reduce((s, g) => s + (g.lordo || 0), 0),
              netto: prev.reduce((s, g) => s + (g.netto || 0), 0),
              giorni: prev.length,
            };
          })(),
          settimanaPrecMercato: (() => {
            const now = dataCorrente;
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const prev = (store.storicoGiornate || []).filter((g) => {
              const d = new Date(g.data);
              return d >= weekAgo && d < now && g.mercato === mercatoNome;
            });
            return {
              lordo: prev.reduce((s, g) => s + (g.lordo || 0), 0),
              netto: prev.reduce((s, g) => s + (g.netto || 0), 0),
              giorni: prev.length,
              mercato: mercatoNome,
            };
          })(),
          ultimoCarburante: store.storicoCarburante?.length > 0
            ? { data: new Date(store.storicoCarburante[store.storicoCarburante.length - 1].data).toLocaleDateString('it-IT'), euro: store.storicoCarburante[store.storicoCarburante.length - 1].euro }
            : null,
          kmOggi: mercatoOggi?.km || 0,
          collaboratori: collaboratori.map((c) => c.nome),
          fornitori: fornitori.map((f) => f.nome),
          speseAnnue: speseAnnue.map((sp) => ({ voce: sp.voce, importo: sp.importo })),
          partenzaDa: store.partenzaDa || '',
          costoKm: costoPerKm,
          tipoCarburante: store.tipoCarburante || 'benzina',
          mediaScontrino: mercatoOggi?.mediaScontrino || 0,
        }}
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
  activityNameSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E7F85',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 2,
  },
  marketName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  badgeLeft: {
    position: 'absolute',
    top: 28,
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
    top: 28,
    right: 0,
  },
  bellTouchArea: {
    position: 'absolute',
    right: 4,
    top: 4,
    zIndex: 10,
    padding: 4,
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
  toggleTxt: { fontSize: 13, fontWeight: '700', color: '#4A3A2A', paddingHorizontal: 4 },
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
    justifyContent: 'space-evenly',
    gap: 0,
    paddingHorizontal: 8,
  },
  collab: {
    backgroundColor: '#E0DBC8',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 70,
    alignItems: 'center',
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
  filterTxt: { fontSize: 11, fontWeight: '900', color: '#4A3A2A', textAlign: 'center', letterSpacing: 0.5 },
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
