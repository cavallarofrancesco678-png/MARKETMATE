import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
  BackHandler,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';
import { useAppLockStore } from '../../src/store/appLockStore';
import { useTutorialStore } from '../../src/store/tutorialStore';
import { useTutorialAnchor } from '../../src/store/tutorialLayoutStore';
import { useTeamSyncStore } from '../../src/store/teamSyncStore';
import { useTeamSyncPolling } from '../../src/hooks/useTeamSyncPolling';
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
import { calcolaCostoMerceProporzionalePerFornitore } from '../../src/utils/proporzionaleFornitori';
import { usePermissions } from '../../src/utils/permissions';

// Day/Month names now come from i18n via getDayNames/getMonthNames

const WEATHER_ICONS: Array<{ icon: string; labelKey: string; code: string; color: string; bg: string }> = [
  { icon: 'weather-sunny', labelKey: 'home.sun', code: 'SOLE', color: '#FF8C00', bg: '#FFF3E0' },
  { icon: 'weather-partly-cloudy', labelKey: 'home.cloud', code: 'NUVOLO', color: '#7A8A9A', bg: '#ECEFF1' },
  { icon: 'weather-rainy', labelKey: 'home.rain', code: 'PIOGGIA', color: '#4A90D9', bg: '#E3F2FD' },
  { icon: 'weather-lightning', labelKey: 'home.snow', code: 'NEVE', color: '#FFB300', bg: '#FFF8E1' },
  { icon: 'weather-windy', labelKey: 'home.wind', code: 'VENTO', color: '#26A69A', bg: '#E0F2F1' },
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
  const { nomeAttivita, agenda, collaboratori, speseAnnue, salvaGiornata, speseFisseDisabilitate, fornitori, appuntiAgenda, removeAppunto, ordiniAgenda, removeOrdine, addOrdine } = useAppStore();
  const store = useAppStore();
  const { t } = useTranslation();
  const perms = usePermissions();

  // ═══ Tutorial anchor refs (per posizionamento nativo) ═══
  const anchorDateRow = useTutorialAnchor('home-date-row');
  const anchorMeteoRow = useTutorialAnchor('home-meteo-row');
  const anchorIncassoRow = useTutorialAnchor('home-incasso-row');
  const anchorSpeseRow = useTutorialAnchor('home-spese-row');
  const anchorBuongiorno = useTutorialAnchor('home-buongiorno-btn');
  const anchorStatsBox = useTutorialAnchor('home-stats-box');
  const anchorSalva = useTutorialAnchor('home-salva-btn');
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
  const [costiOverride, setCostiOverride] = useState<Record<string, number>>({});
  const [showCostModal, setShowCostModal] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState('');
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
  const [excludeFornitori, setExcludeFornitori] = useState(false);
  const [excludeInvenduto, setExcludeInvenduto] = useState(false);
  const [excludeSpeseFisse, setExcludeSpeseFisse] = useState(false);
  const [excludeCollaboratori, setExcludeCollaboratori] = useState(false);
  const [speseExtraFornitore, setSpeseExtraFornitore] = useState<Record<string, { importo: string; periodo: string }>>({});
  const [fornInfo, setFornInfo] = useState<Record<string, { numeroFattura: string; scadenza: string }>>({});
  const [ripartizione, setRipartizione] = useState<Record<string, { modo: 'oggi' | 'custom'; from: string; to: string }>>({});
  const [pagamentoMode, setPagamentoMode] = useState<Record<string, 'contanti' | 'fattura' | 'misto'>>({});
  // ─── Wrap setters per propagare le modifiche al livello del FORNITORE
  //     (single source of truth). Quando l'utente cambia da DAILY a CUSTOM
  //     o modifica il numero di giorni, NON solo aggiorniamo lo state locale
  //     ma anche `store.fornitori[i].deductionMode` / `deductionDays`. Così
  //     la modifica è permanente e si applica retroattivamente a TUTTE le
  //     giornate (passate e future): l'algoritmo proporzionale legge sempre
  //     il valore attuale dal fornitore, non lo snapshot della giornata. ───
  const setFornDeductionTypeWrapped = (v: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'>) => {
    setFornDeductionType(v);
    // Diff con lo state precedente per individuare quale fornitore è cambiato
    const cur = useAppStore.getState();
    const updated = (cur.fornitori || []).map((f: any) => {
      const newMode = v[f.nome];
      if (!newMode) return f;
      // Round 65: il supplier-level ora supporta DAILY | CUSTOM | WEEKLY.
      // MONTHLY (legacy) → CUSTOM 30g (gestito al save).
      const normalized: 'DAILY' | 'CUSTOM' | 'WEEKLY' =
        newMode === 'DAILY' ? 'DAILY'
        : newMode === 'WEEKLY' ? 'WEEKLY'
        : 'CUSTOM';
      if (f.deductionMode === normalized) return f;
      return { ...f, deductionMode: normalized };
    });
    useAppStore.setState({ fornitori: updated } as any);
    // Persisti immediatamente in AsyncStorage/localStorage così il valore
    // sopravvive al reload anche prima del prossimo salvaGiornata.
    try { (useAppStore.getState() as any).saveToStorage?.(); } catch {}
  };

  const setFornDeductionDaysWrapped = (v: Record<string, number>) => {
    setFornDeductionDays(v);
    const cur = useAppStore.getState();
    const updated = (cur.fornitori || []).map((f: any) => {
      const newDays = v[f.nome];
      if (!newDays || newDays < 1) return f;
      if (f.deductionDays === newDays) return f;
      return { ...f, deductionDays: newDays };
    });
    useAppStore.setState({ fornitori: updated } as any);
    try { (useAppStore.getState() as any).saveToStorage?.(); } catch {}
  };

  // Single source of truth per la START DATE del periodo CUSTOM:
  // ogni cambio modifica IL FORNITORE in store → tutte le statistiche
  // si ricalcolano retroattivamente.
  const setFornDeductionStartDateWrapped = (v: Record<string, string>) => {
    setFornDeductionStartDate(v);
    const cur = useAppStore.getState();
    const updated = (cur.fornitori || []).map((f: any) => {
      const newDate = v[f.nome];
      if (!newDate) return f;
      if (f.deductionStartDate === newDate) return f;
      return { ...f, deductionStartDate: newDate };
    });
    useAppStore.setState({ fornitori: updated } as any);
    try { (useAppStore.getState() as any).saveToStorage?.(); } catch {}
  };

  // Tipo di detrazione per fornitore: DAILY (default) | CUSTOM
  // Backwards-compat: i valori legacy 'WEEKLY' e 'MONTHLY' vengono accettati
  // dal modello Giornata e mappati a CUSTOM (7g / 30g) all'apertura.
  const [fornDeductionType, setFornDeductionType] = useState<Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'>>({});
  const [fornDeductionDays, setFornDeductionDays] = useState<Record<string, number>>({});
  // Data di inizio del periodo CUSTOM ('YYYY-MM-DD'). Se assente parte da oggi/registrazione.
  const [fornDeductionStartDate, setFornDeductionStartDate] = useState<Record<string, string>>({});
  const [showBuongiorno, setShowBuongiorno] = useState(false);
  const [vociGeneriche, setVociGeneriche] = useState<Array<{nome: string; importo: string; attivo: boolean; ripMode?: 'oggi' | 'settimana' | 'custom'; ripFrom?: string; ripTo?: string}>>([]);
  
  // Tooltip elegante per il grafico
  const [chartTooltip, setChartTooltip] = useState<{visible: boolean; label: string; value: number; giorni?: number} | null>(null);

  const [lordo, setLordo] = useState('');
  const [contanti, setContanti] = useState('');
  const [pos, setPos] = useState('');
  const [invenduto, setInvenduto] = useState('');

  const mercatoOggi = agenda[getGiornoIndex(dataCorrente)];
  const mercatoNome = isFiera ? (fieraLuogo || 'Fiera') : (mercatoOggi?.mercato || '');
  const giorno = dayNames[(dataCorrente.getDay() + 6) % 7]; // dayNames is Mon-Sun, getDay() is Sun=0
  const data = `${dataCorrente.getDate()} ${monthNames[dataCorrente.getMonth()]}`;

  /* Sincronizza la mappa presenze con la lista dei collaboratori SENZA
     resettare le presenze esistenti.
     IMPORTANTE: il sync polling rigenera l'array collaboratori (nuovo
     riferimento) e prima questo effect resettava TUTTE le presenze a false,
     facendo "scomparire" la spunta sui collaboratori che erano stati
     marcati come presenti per la giornata. Ora preserva i valori esistenti
     e aggiunge solo le chiavi nuove (nuovi collaboratori) a false. */
  useEffect(() => {
    setPresenze((prev) => {
      const next: Record<string, boolean> = {};
      collaboratori.forEach((c) => {
        next[c.nome] = prev[c.nome] ?? false;
      });
      return next;
    });
  }, [collaboratori]);

  /* ═══ AUTO-START TUTORIAL AL PRIMO INGRESSO IN HOME ═══
     Il tutorial NON deve apparire durante il setup iniziale (welcome / settings).
     Parte automaticamente SOLO quando l'utente entra per la prima volta in
     /home dopo aver completato il wizard di configurazione.
     Una volta completato o saltato, `tutHasCompleted` diventa true e non
     ripartirà più al rientro in Home.

     IMPORTANTE: il tutorial è una guida pensata per chi configura l'app
     da zero (l'AMMINISTRATORE). Chi entra come collaboratore tramite
     codice invito (MANAGER / UTENTE) NON deve vedere il wizard, perché
     l'app è già stata configurata da qualcun altro. */
  const tutActive = useTutorialStore((s) => s.active);
  const tutHasCompleted = useTutorialStore((s) => s.hasCompletedOnce);
  const tutIsHydrated = useTutorialStore((s) => s.isHydrated);
  const tutStart = useTutorialStore((s) => s.start);
  const tutAutoStartedRef = useRef(false);
  useEffect(() => {
    if (!tutIsHydrated) return;
    if (tutAutoStartedRef.current) return;
    if (tutHasCompleted) return;
    if (tutActive) { tutAutoStartedRef.current = true; return; }
    if (!store.isConfigured) return; // aspetta che l'utente abbia finito il setup
    // Skip auto-tutorial per chi è entrato tramite codice invito (collaboratori
    // o admin che si uniscono ad un'azienda già configurata): il tutorial è
    // pensato per il PRIMO admin che configura l'app da zero, non per chi
    // entra in un team già attivo.
    if ((store as any).joinedViaInviteCode || (store.currentRole && store.currentRole !== 'AMMINISTRATORE')) {
      tutAutoStartedRef.current = true;
      // Marca come completato così non ripartirà neanche al prossimo cold start
      try { useTutorialStore.setState({ hasCompletedOnce: true }); } catch {}
      return;
    }
    tutAutoStartedRef.current = true;
    const t = setTimeout(() => { tutStart(); }, 700);
    return () => clearTimeout(t);
  }, [tutIsHydrated, tutHasCompleted, tutActive, store.isConfigured, store.currentRole, (store as any).joinedViaInviteCode, tutStart]);

  /* ═══ POLL TEAM SYNC: pull periodico ogni 30s per vedere i contributi
     dell'altro lato (admin vede dati collab e viceversa).
     IMPORTANTE — Strategia merge ANTI-PERDITA-DATI:
      - storicoGiornate: union per data (cloud-wins su collisione)
      - collaboratori/fornitori/fiere/appuntiAgenda/ordiniAgenda: union PER NOME
        — i record locali NON ancora pushati al cloud non vengono cancellati,
        i record cloud nuovi vengono aggiunti. (Bug fix: prima overwriteavamo
        e i collab appena aggiunti sparivano.)
      - oggetti (storicoScontrini, storicoDiario, speseFisseAnnuali):
        spread merge cloud-wins.
     ─────────────────────────────────────────────────────────────────
     REFACTOR: tutta la logica di polling + merge è stata estratta nel
     hook `useTeamSyncPolling` (/app/frontend/src/hooks/useTeamSyncPolling.ts)
     che a sua volta delega `buildSyncMerge` a /app/frontend/src/utils/syncMerge.ts.
     Vantaggi: home/index.tsx torna concentrato sulla UI, la logica di
     sync è riusabile da altri schermi (login silent-pull, welcome
     collab join), ed è 100% testabile in isolamento. */
  useTeamSyncPolling();

  /* ═══ PERSISTENZA SPESE EXTRA (entro lo stesso giorno solare di creazione) ═══
     La sessione dura SOLO fino alle 23:59 del giorno in cui è stata creata.
     Questo evita che spese di "ieri" appaiano nella HOME di "oggi" senza che
     l'utente le abbia inserite oggi (bug #5 segnalato). */
  const isSpeseSessionValid = (createdAt: string): boolean => {
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) return false;
    const endOfDay = new Date(created);
    endOfDay.setHours(23, 59, 59, 999);
    return new Date() <= endOfDay;
  };

  // On mount/hydration: restore session if still valid
  const speseExtraMountedRef = useRef(false);
  const speseExtraHydrated = useRef(false);
  const speseExtraSessionFromStore = (store as any).speseExtraSession;
  useEffect(() => {
    if (speseExtraHydrated.current) return;
    // Aspetta che il store finisca di caricare. Marchiamo "hydrated" se:
    //   1) abbiamo trovato una sessione valida e l'abbiamo ripristinata, OPPURE
    //   2) sappiamo che la sessione è null E il caricamento è completo
    //      (uso `isConfigured` come proxy: se è settato, lo store è caricato).
    const stored = speseExtraSessionFromStore;
    if (stored !== undefined && stored !== null) {
      if (isSpeseSessionValid(stored.createdAt)) {
        setSpeseExtraFornitore(stored.speseExtraFornitore || {});
        setVociGeneriche(stored.vociGeneriche || []);
        setFornInfo(stored.fornInfo || {});
        setPagamentoMode(stored.pagamentoMode || {});
        setRipartizione(stored.ripartizione || {});
        setFornDeductionType(stored.fornDeductionType || {});
        setFornDeductionDays((stored as any).fornDeductionDays || {});
        setFornDeductionStartDate((stored as any).fornDeductionStartDate || {});
      } else {
        (store as any).clearSpeseExtraSession?.();
      }
      speseExtraHydrated.current = true;
      speseExtraMountedRef.current = true;
    } else if (store.isConfigured) {
      // Store caricato ma sessione null → setup vuoto, abilita la persistenza
      // per i futuri inserimenti.
      speseExtraHydrated.current = true;
      speseExtraMountedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speseExtraSessionFromStore, store.isConfigured]);

  // Persist changes (debounced)
  const speseExtraSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ───────────────────────────────────────────────────────────────
     Idratazione automatica del periodo CUSTOM dai FORNITORI.
     Single source of truth: ogni volta che `store.fornitori` cambia
     (es. l'utente modifica `deductionMode`/`deductionDays` da Settings
     o dal modal Spese), risincronizziamo lo state locale. Garantisce
     che la modifica si propaghi ANCHE alle giornate già salvate
     (l'utente cambia da 7 a 3 giorni → tutte le giornate del periodo
     si ricalcolano nelle stats con il nuovo valore).
     ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const fList = (store.fornitori as any[]) || [];
      const dedMap: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY'> = {};
      const daysMap: Record<string, number> = {};
      const startDateMap: Record<string, string> = {};
      fList.forEach((f) => {
        if (!f || !f.nome) return;
        if (f.deductionMode) dedMap[f.nome] = f.deductionMode;
        if (f.deductionDays && f.deductionDays > 0) daysMap[f.nome] = f.deductionDays;
        if (f.deductionStartDate) startDateMap[f.nome] = f.deductionStartDate;
      });
      if (Object.keys(dedMap).length > 0) {
        setFornDeductionType((prev) => ({ ...prev, ...dedMap } as any));
      }
      if (Object.keys(daysMap).length > 0) {
        setFornDeductionDays((prev) => ({ ...prev, ...daysMap }));
      }
      if (Object.keys(startDateMap).length > 0) {
        setFornDeductionStartDate((prev) => ({ ...prev, ...startDateMap }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fornitori]);

  useEffect(() => {
    if (!speseExtraMountedRef.current) return;
    if (speseExtraSaveTimerRef.current) clearTimeout(speseExtraSaveTimerRef.current);
    speseExtraSaveTimerRef.current = setTimeout(() => {
      const hasSupplierData = Object.values(speseExtraFornitore).some(v => (v?.importo || '').trim() !== '');
      const hasVoci = vociGeneriche.some(v => (v?.importo || '').trim() !== '' || v.attivo);
      // Anche le info fattura (numero, scadenza) o i flag di pagamento devono
      // tener vivi i dati: l'utente potrebbe inserire prima il numero fattura
      // e poi l'importo, non vogliamo perdere il numero fra i due passaggi.
      const hasFornInfo = Object.values(fornInfo || {}).some((f: any) =>
        (f?.numeroFattura || '').trim() !== '' || (f?.scadenza || '').trim() !== ''
      );
      const hasRipart = Object.keys(ripartizione || {}).length > 0;
      const hasMode = Object.keys(pagamentoMode || {}).length > 0;
      const hasDed = Object.keys(fornDeductionType || {}).length > 0;
      const hasDays = Object.keys(fornDeductionDays || {}).length > 0;
      const hasStartDate = Object.keys(fornDeductionStartDate || {}).length > 0;
      if (!hasSupplierData && !hasVoci && !hasFornInfo && !hasRipart && !hasMode && !hasDed && !hasDays && !hasStartDate) {
        if ((store as any).speseExtraSession) (store as any).clearSpeseExtraSession?.();
        return;
      }
      const existingCreatedAt = (store as any).speseExtraSession?.createdAt;
      const createdAt = existingCreatedAt && isSpeseSessionValid(existingCreatedAt)
        ? existingCreatedAt
        : new Date().toISOString();
      (store as any).setSpeseExtraSession?.({
        speseExtraFornitore,
        vociGeneriche,
        fornInfo,
        pagamentoMode,
        ripartizione,
        fornDeductionType,
        fornDeductionDays,
        fornDeductionStartDate,
        createdAt,
      });
      // Forza commit immediato in AsyncStorage (evita perdita dati su chiusura modal)
      try { (useAppStore.getState() as any).saveToStorage?.(); } catch {}
    }, 200); // ▼ Round 39: debounce ridotto da 600ms a 200ms per persistenza più reattiva
    return () => { if (speseExtraSaveTimerRef.current) clearTimeout(speseExtraSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speseExtraFornitore, vociGeneriche, fornInfo, pagamentoMode, ripartizione, fornDeductionType, fornDeductionDays, fornDeductionStartDate]);

  /* ── Funzione per caricare i dati salvati di una data ── */
  const loadSavedData = useCallback((targetDate: Date) => {
    // CRITICAL: Read FRESH state from store to avoid stale closure
    const freshStore = useAppStore.getState();
    const saved = freshStore.storicoGiornate.find(
      (g) => new Date(g.data).toDateString() === targetDate.toDateString()
    );
    const collabs = freshStore.collaboratori || [];
    if (saved) {
      setLordo(saved.lordo > 0 ? saved.lordo.toString() : '');
      setContanti(saved.contanti > 0 ? saved.contanti.toString() : '');
      setPos(saved.pos > 0 ? saved.pos.toString() : '');
      // Normalizza meteo salvato in formato legacy (stringhe tradotte) al nuovo codice
      const rawMet = (saved.meteo || '').toUpperCase();
      let metCode = 'SOLE';
      if (rawMet.includes('SOL') || rawMet.includes('SUN')) metCode = 'SOLE';
      else if (rawMet.includes('NUV') || rawMet.includes('CLOUD') || rawMet.includes('NUB') || rawMet.includes('NUAG')) metCode = 'NUVOLO';
      else if (rawMet.includes('PIOG') || rawMet.includes('RAIN') || rawMet.includes('LLUV') || rawMet.includes('PLUI') || rawMet.includes('CHUV')) metCode = 'PIOGGIA';
      else if (rawMet.includes('NEV') || rawMet.includes('SNOW') || rawMet.includes('NIE') || rawMet.includes('NEIG')) metCode = 'NEVE';
      else if (rawMet.includes('VENT') || rawMet.includes('WIND') || rawMet.includes('VIEN')) metCode = 'VENTO';
      setMeteo(metCode);
      const invTot = saved.dettaglio_invenduto?.totale;
      setInvenduto(invTot && invTot > 0 ? invTot.toString() : '0');
      // Ripristina il dettaglio per prodotto (pizza, pane-andrea, ecc.)
      if (saved.dettaglio_invenduto && typeof saved.dettaglio_invenduto === 'object') {
        // Ricostruisci invendutoQty mappando le chiavi "Pane - Andrea" -> invertire in "Andrea_Pane"
        const invQty: Record<string, string> = {};
        Object.entries(saved.dettaglio_invenduto).forEach(([label, val]) => {
          if (label === 'totale') return;
          // label formato "nome - fornitore"
          const parts = label.split(' - ');
          if (parts.length === 2) {
            const [nome, fornitore] = parts;
            const prodotto = fornitori?.flatMap(f => f.prodotti.map(p => ({ f: f.nome, n: p.nome, pr: p.prezzo }))).find(p => p.n === nome && p.f === fornitore);
            if (prodotto) {
              const key = `${fornitore}_${nome}`;
              // FIX precision: arrotonda a 2 decimali per evitare drift float (es 7→7.07)
              const rawQty = isAlimentare && prodotto.pr > 0 ? (val as number) / prodotto.pr : (val as number);
              const qty = Math.round(rawQty * 100) / 100;
              // Mostra come intero se è praticamente intero (tolleranza ±0.02)
              invQty[key] = (Math.abs(qty - Math.round(qty)) < 0.02 ? Math.round(qty).toString() : qty.toString());
            }
          }
        });
        setInvendutoQty(invQty);
      } else {
        setInvendutoQty({});
      }
      if (saved.dettaglio_staff && typeof saved.dettaglio_staff === 'object') {
        const p: Record<string, boolean> = {};
        const override: Record<string, number> = {};
        collabs.forEach((c) => {
          const val = saved.dettaglio_staff[c.nome];
          if (typeof val === 'number') {
            p[c.nome] = val > 0;
            // Se il costo salvato è diverso da quello base, è un override personalizzato
            if (val > 0 && val !== (c.costo || 0)) {
              override[c.nome] = val;
            }
          } else {
            p[c.nome] = val === true;
          }
        });
        setPresenze(p);
        setCostiOverride(override);
      }
      if (saved.dettaglio_fornitori && Object.keys(saved.dettaglio_fornitori).length > 0) {
        const fornData: Record<string, { importo: string; periodo: string }> = {};
        // Round 69 — FIX FATTURE: derivare pagamentoMode dalle CHIAVI presenti
        // in dettaglio_fornitori, così quando l'utente apre un giorno salvato,
        // il toggle "fattura/contanti/misto" rispecchia esattamente ciò che ha
        // salvato. Prima si vedeva sempre "contanti" e l'utente pensava che
        // la fattura non fosse stata salvata (in realtà era salvata, ma l'UI
        // non lo mostrava).
        const restoredModes: Record<string, 'contanti' | 'fattura' | 'misto'> = {};
        const fornitorIdx: Record<string, { hasFattura: boolean; hasContanti: boolean }> = {};
        Object.entries(saved.dettaglio_fornitori).forEach(([nome, val]) => {
          fornData[nome] = { importo: (val as number).toString(), periodo: 'giornaliero' };
          // Ignora chiavi tecniche (labels)
          if (nome.endsWith('__liberaLabel') || nome.includes('__fattn')) return;
          const isContanti = nome.endsWith('__libera');
          const baseName = isContanti ? nome.slice(0, -'__libera'.length) : nome;
          const v = Number(val) || 0;
          if (v <= 0) return;
          if (!fornitorIdx[baseName]) fornitorIdx[baseName] = { hasFattura: false, hasContanti: false };
          if (isContanti) fornitorIdx[baseName].hasContanti = true;
          else fornitorIdx[baseName].hasFattura = true;
        });
        Object.entries(fornitorIdx).forEach(([base, flags]) => {
          if (flags.hasFattura && flags.hasContanti) restoredModes[base] = 'misto';
          else if (flags.hasFattura) restoredModes[base] = 'fattura';
          else if (flags.hasContanti) restoredModes[base] = 'contanti';
        });
        setSpeseExtraFornitore(fornData);
        setPagamentoMode(restoredModes);
      } else {
        setSpeseExtraFornitore({});
        setPagamentoMode({});
      }
      // Carica fornitori info (numero fattura + scadenza)
      setFornInfo((saved as any).fornitoriInfo || {});
      // Carica deduction type per fornitore + giorni custom (default DAILY)
      // Round 65: WEEKLY torna a essere un valore VALIDO di prim'ordine
      // (l'utente lo seleziona dal pulsante "Settimanale"). Solo MONTHLY
      // legacy viene convertito a CUSTOM/30g.
      const savedDed = (saved as any).dettaglio_fornitori_deduction || {};
      const savedDays = (saved as any).dettaglio_fornitori_days || {};
      const migratedDed: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY'> = {};
      const migratedDays: Record<string, number> = { ...savedDays };
      Object.entries(savedDed).forEach(([nome, mode]) => {
        if (mode === 'WEEKLY') {
          migratedDed[nome] = 'WEEKLY';
          if (!migratedDays[nome]) migratedDays[nome] = 7;
        } else if (mode === 'MONTHLY') {
          migratedDed[nome] = 'CUSTOM';
          if (!migratedDays[nome]) migratedDays[nome] = 30;
        } else if (mode === 'CUSTOM') {
          migratedDed[nome] = 'CUSTOM';
        } else {
          migratedDed[nome] = 'DAILY';
        }
      });
      setFornDeductionType(migratedDed as any);
      setFornDeductionDays(migratedDays);
      // Round 45: carica anche lo snapshot startDate per ogni fornitore
      const savedStartDate = (saved as any).dettaglio_fornitori_startDate || {};
      if (Object.keys(savedStartDate).length > 0) {
        setFornDeductionStartDate(savedStartDate);
      }

      // ─── PRIORITÀ MASSIMA: il livello del fornitore (single source of truth)
      // Se l'utente ha modificato `deductionMode`/`deductionDays` nel
      // FornitoreEditor (Settings) o nel modal SPESE (con propagazione al
      // fornitore), quei valori vincono sui valori salvati nella vecchia
      // giornata. Garantisce: se cambio Andrea Pane da 7 a 3 giorni TUTTE
      // le giornate (anche già salvate) vengono ricalcolate con 3 giorni.
      try {
        const fList = (useAppStore.getState() as any).fornitori || [];
        // Round 65: il supplier-level ora supporta WEEKLY
        const fornDedFromSupplier: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY'> = {};
        const fornDaysFromSupplier: Record<string, number> = {};
        fList.forEach((f: any) => {
          if (!f || !f.nome) return;
          if (f.deductionMode) fornDedFromSupplier[f.nome] = f.deductionMode;
          if (f.deductionDays && f.deductionDays > 0) fornDaysFromSupplier[f.nome] = f.deductionDays;
        });
        // Merge: il livello fornitore vince
        if (Object.keys(fornDedFromSupplier).length > 0) {
          setFornDeductionType((prev) => ({ ...prev, ...fornDedFromSupplier } as any));
        }
        if (Object.keys(fornDaysFromSupplier).length > 0) {
          setFornDeductionDays((prev) => ({ ...prev, ...fornDaysFromSupplier }));
        }
      } catch {}
      // Ripristina le voci generiche (spese extra dettagliate)
      if ((saved as any).dettaglio_spese_extra && Object.keys((saved as any).dettaglio_spese_extra).length > 0) {
        const voci = Object.entries((saved as any).dettaglio_spese_extra).map(([nome, val]) => ({
          nome,
          importo: (val as number).toString(),
          attivo: true,
        }));
        setVociGeneriche(voci);
      } else {
        setVociGeneriche([]);
      }
      // ═══ Round 63 — HIDRATAZIONE da spesePeriodiche ═══
      // I fornitori/voci periodici NON sono più in `dettaglio_fornitori` o
      // `dettaglio_spese_extra`; vivono in store.spesePeriodiche. Se la
      // giornata che stiamo aprendo è la `dayOfPurchase` di una periodica,
      // popoliamo gli stati locali con i valori salvati così l'utente può
      // RIVEDERE e MODIFICARE (update → dedup chiave (nome,from,to)).
      try {
        const allPer = (useAppStore.getState() as any).spesePeriodiche || [];
        const isoOf = (d: any) => {
          try {
            const dt = new Date(d);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          } catch { return ''; }
        };
        const dayIsoLoad = isoOf(saved.data);
        if (dayIsoLoad) {
          // 1. Fornitori periodici acquistati questo giorno → ripristina importo
          const fornPeriodiciOggi = allPer.filter((sp: any) => sp.categoria === 'fornitore' && sp.dayOfPurchase === dayIsoLoad);
          if (fornPeriodiciOggi.length > 0) {
            setSpeseExtraFornitore((prev) => {
              const next = { ...prev };
              fornPeriodiciOggi.forEach((sp: any) => {
                next[sp.nome] = { importo: String(sp.importo), periodo: 'giornaliero' };
              });
              return next;
            });
            // Sincronizza type/days/startDate
            // Round 65: usa il `type` salvato (WEEKLY/CUSTOM) invece di forzare CUSTOM,
            // così il pulsante "Settimanale" resta evidenziato all'apertura della modal.
            const dedUpd: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY'> = {};
            const daysUpd: Record<string, number> = {};
            const startUpd: Record<string, string> = {};
            fornPeriodiciOggi.forEach((sp: any) => {
              const tp = (sp.type === 'WEEKLY' ? 'WEEKLY' : 'CUSTOM') as 'WEEKLY' | 'CUSTOM';
              dedUpd[sp.nome] = tp;
              const from = new Date(sp.from + 'T00:00:00');
              const to = new Date(sp.to + 'T00:00:00');
              const dd = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
              daysUpd[sp.nome] = dd;
              startUpd[sp.nome] = sp.from;
            });
            setFornDeductionType((prev) => ({ ...prev, ...dedUpd } as any));
            setFornDeductionDays((prev) => ({ ...prev, ...daysUpd }));
            setFornDeductionStartDate((prev) => ({ ...prev, ...startUpd }));
          }
          // 2. Voci generiche periodiche acquistate questo giorno → aggiungi alle voci
          const vociPeriodicheOggi = allPer.filter((sp: any) => sp.categoria === 'voce' && sp.dayOfPurchase === dayIsoLoad);
          if (vociPeriodicheOggi.length > 0) {
            setVociGeneriche((prev) => {
              const existingNames = new Set(prev.map((v: any) => v.nome));
              const newOnes = vociPeriodicheOggi
                .filter((sp: any) => !existingNames.has(sp.nome))
                .map((sp: any) => ({
                  nome: sp.nome,
                  importo: String(sp.importo),
                  attivo: true,
                  ripMode: (sp.type === 'WEEKLY' ? 'settimana' : 'custom') as any,
                  ripFrom: sp.from,
                  ripTo: sp.to,
                }));
              return [...prev, ...newOnes];
            });
          }
        }
      } catch (e) {
        console.warn('[Round 63] Errore hidratazione spesePeriodiche:', e);
      }

      if (saved.mercato?.toLowerCase() === 'fiera') {
        setIsFiera(true);
      }
      // Ripristina lo stato del pulsante 'casa/storefront' (vecchi record sono
      // pre-esistenti senza il campo → default true = sono andato a lavoro).
      setIsInPiazza((saved as any).inPiazza !== false);
    } else {
      setLordo('');
      setContanti('');
      setPos('');
      setInvenduto('0');
      setSpeseExtraFornitore({});
      setFornInfo({});
      setRipartizione({});
      setPagamentoMode({});
      // NON resettare `fornDeductionType` e `fornDeductionDays`: questi sono
      // GLOBALI per fornitore (non legati alla singola giornata) e vengono
      // idratati dal useEffect su [store.fornitori]. Resettarli qui
      // cancellerebbe la configurazione "Personalizza N giorni" appena
      // dopo un reload della pagina.
      setVociGeneriche([]);
      setCostiOverride({});
      // Reset al default 'sono andato a lavoro' per giornate non ancora salvate
      setIsInPiazza(true);
      const p: Record<string, boolean> = {};
      collabs.forEach((c) => { p[c.nome] = false; });
      setPresenze(p);
      // ═══ AUTO-METEO: primo caricamento → fetch meteo reale e setta icona ═══
      (async () => {
        try {
          const city = freshStore.partenzaDa || '';
          if (!city) return;
          const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ citta: city }),
          });
          const wdata = await res.json();
          const desc = (wdata?.descrizione || wdata?.condizioni || '').toLowerCase();
          let auto = 'SOLE';
          if (desc.includes('pioggia') || desc.includes('rain') || desc.includes('rovesc') || desc.includes('temporal')) auto = 'PIOGGIA';
          else if (desc.includes('neve') || desc.includes('snow')) auto = 'NEVE';
          else if (desc.includes('vento') || desc.includes('wind')) auto = 'VENTO';
          else if (desc.includes('nuv') || desc.includes('cloud') || desc.includes('copert') || desc.includes('cielo coperto')) auto = 'NUVOLO';
          else if (desc.includes('sereno') || desc.includes('sole') || desc.includes('sun') || desc.includes('clear')) auto = 'SOLE';
          setMeteo(auto);
        } catch { /* ignore, default SOLE */ }
      })();
    }
  }, []);

  /* ── Carica dati salvati SOLO quando cambia la data ── */
  useEffect(() => {
    setIsFiera(false);
    loadSavedData(dataCorrente);
  }, [dataCorrente]);

  /* ── Ricarica dati quando il tab torna in focus (solo per cambio tab) ── */
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadSavedData(dataCorrente);
    }, [dataCorrente])
  );

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

  /* ── Pagamenti fornitori imminenti (entro 7 giorni) per widget Buongiorno ──
     ⚠️ Single Source of Truth: SOLO le fatture salvate in storicoGiornate (Notes).
     Le fatture in corso (fornInfo session) NON vengono mai mostrate qui — devono
     prima essere salvate per essere considerate "in pagamento". */
  const pagamentiImminenti = useMemo(() => {
    const oggi = new Date(dataCorrente);
    oggi.setHours(0, 0, 0, 0);
    const result: { fornitore: string; numeroFattura: string; importo: number; scadenza: string; giorniRestanti: number }[] = [];
    // Scansiona lo storico giornate per raccogliere fornitoriInfo (= cosa c'è in Notes)
    (store.storicoGiornate || []).forEach((g: any) => {
      const info = g.fornitoriInfo || {};
      Object.entries(info).forEach(([nome, dati]: [string, any]) => {
        if (!dati || !dati.scadenza || !dati.numeroFattura) return;
        const scadDate = new Date(dati.scadenza + 'T12:00:00');
        if (isNaN(scadDate.getTime())) return;
        scadDate.setHours(0, 0, 0, 0);
        const diff = Math.floor((scadDate.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0 || diff > 7) return;
        // Importo = fattura > 0 OPPURE contanti (fallback)
        const impFatt = Math.abs(g.dettaglio_fornitori?.[nome] || 0);
        const impCash = Math.abs(g.dettaglio_fornitori?.[`${nome}__libera`] || 0);
        const imp = impFatt > 0 ? impFatt : impCash;
        if (imp <= 0) return; // Fatture senza importo non sono "in pagamento"
        // Evita duplicati: tieni la scadenza più recente per fornitore+fattura
        const key = `${nome}_${dati.numeroFattura}`;
        const existing = result.find((r) => `${r.fornitore}_${r.numeroFattura}` === key);
        if (!existing) {
          result.push({ fornitore: nome, numeroFattura: dati.numeroFattura, importo: imp, scadenza: dati.scadenza, giorniRestanti: diff });
        }
      });
    });
    return result.sort((a, b) => a.giorniRestanti - b.giorniRestanti);
  }, [store.storicoGiornate, dataCorrente]);

  /* ── Fiere prossimi 7 giorni per notifiche campanello ── */
  const fiereProssime = useMemo(() => {
    const result: { data: Date; nome: string; luogo: string; tipologia: string }[] = [];
    const oggi = new Date(dataCorrente); oggi.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 7; i++) {
      const d = new Date(oggi); d.setDate(oggi.getDate() + i);
      const dow = (d.getDay() + 6) % 7;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      (store.fiere || []).forEach((f: any) => {
        if (!f.attiva) return;
        if (f.giorni?.includes(dow) || (f.dateSpecifiche || []).includes(iso)) {
          // Dedupe: se stessa fiera già presente per data, skip
          if (!result.some((r) => r.nome === f.nome && r.data.toDateString() === d.toDateString())) {
            result.push({ data: new Date(d), nome: f.nome, luogo: f.luogo || '', tipologia: f.tipologia || 'Fiera' });
          }
        }
      });
    }
    return result;
  }, [store.fiere, dataCorrente]);

  const getTipologiaColor = (tipologia?: string) => {
    switch (tipologia) {
      case 'Sagra': return '#9B59B6';
      case 'Festa Patronale': return '#C0392B';
      case 'Evento Speciale': return '#16A085';
      case 'Fiera':
      default: return '#D4AF37';
    }
  };

  /* ── Note del diario degli ultimi e prossimi 7 giorni: incluse nella campanella ──
     Senza questo, le note scritte nel diario non scattavano la notifica.
     FIX: `now` non era definito → JS ReferenceError che chiudeva l'app subito
     dopo l'inserimento del PIN. Ora ricavato dalla `dataCorrente` (la data
     selezionata in home) così il calcolo è coerente con il resto della UI. */
  const diarioRecenti = useMemo(() => {
    const sd = (store as any).storicoDiario;
    if (!Array.isArray(sd)) return [];
    const baseTs = (dataCorrente instanceof Date ? dataCorrente : new Date()).getTime();
    const sevenDaysAgo = baseTs - 7 * 24 * 60 * 60 * 1000;
    const sevenDaysAhead = baseTs + 7 * 24 * 60 * 60 * 1000;
    return sd.filter((d: any) => {
      try {
        if (!d.testo || !d.testo.trim()) return false;
        const t = new Date(d.data).getTime();
        return t >= sevenDaysAgo && t <= sevenDaysAhead;
      } catch { return false; }
    });
  }, [(store as any).storicoDiario, dataCorrente]);

  /* ── Conteggio notifiche totale (appuntamenti + ordini + fiere + note diario) ── */
  const notificheCount = appuntiProssimi.length + ordiniProssimi.length + fiereProssime.length + diarioRecenti.length;

  /* ── Suono leggero quando aumentano le notifiche ── */
  const prevNotificheRef = useRef(notificheCount);
  useEffect(() => {
    if (notificheCount > prevNotificheRef.current) {
      // Nuova notifica: suono leggero + vibrazione
      playSuccess();
      hapticTap();
    }
    prevNotificheRef.current = notificheCount;
  }, [notificheCount]);

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
    // Round 53: includiamo anche il `costo` di acquisto per calcolare
    // l'invenduto come perdita reale (sul costo, non sul prezzo di vendita).
    const prods: { fornitore: string; nome: string; prezzo: number; costo?: number }[] = [];
    (fornitori || []).forEach((f: any) => {
      (f?.prodotti || []).forEach((p: any) => {
        if (!p) return;
        prods.push({
          fornitore: f.nome || '',
          nome: p.nome || '',
          prezzo: Number(p.prezzo) || 0,
          costo: typeof p.costo === 'number' ? Number(p.costo) : undefined,
        });
      });
    });
    return prods;
  }, [fornitori]);

  /* ── Invenduto/Perdita calculated from product COSTS (not selling prices) ──
     Round 53 (richiesta utente): l'invenduto è una PERDITA economica reale,
     quindi va calcolato sul COSTO di acquisto del prodotto (non sul prezzo
     di vendita, che include anche il margine non incassato).
     Fallback: se `costo` non è impostato (prodotti vecchi), usa `prezzo` per
     retrocompatibilità. */
  const invendutoCalcolato = useMemo(() => {
    let tot = 0;
    tuttiProdotti.forEach((p) => {
      const key = `${p.fornitore}_${p.nome}`;
      const costoUnit = (typeof p.costo === 'number' && p.costo > 0) ? p.costo : p.prezzo;
      if (isAlimentare) {
        // Alimentare: qty × costo/kg
        const qty = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
        tot += qty * costoUnit;
      } else {
        // Non-alimentare: l'utente inserisce direttamente il valore (€) della perdita
        const price = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
        tot += price;
      }
    });
    return tot;
  }, [tuttiProdotti, invendutoQty, isAlimentare]);

  const confermaInvenduto = () => {
    setInvenduto(parseFloat(invendutoCalcolato.toFixed(0)).toString());
    setShowInvendutoModal(false);
  };

  /* ── Build itemized spese fisse list ── */
  const speseFisseItems = useMemo(() => {
    const gg = (Array.isArray(agenda) ? agenda : []).filter((m: any) => m?.lavorativo).length || 6;
    const items: { id: string; label: string; importoGG: number }[] = [];

    // Annual expenses → divided by working days (48 weeks × workdays/week)
    (speseAnnue || []).forEach((sp: any) => {
      if (!sp) return;
      items.push({ id: `sp_${sp.voce}`, label: sp.voce || '', importoGG: (Number(sp.importo) || 0) / (48 * gg) });
    });

    // Plateatico for ALL markets → use p_giornaliero directly when available
    agenda.forEach((m) => {
      if (m.p_giornaliero > 0) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: m.p_giornaliero });
      } else if (m.p_annuo > 0) {
        items.push({ id: `plat_${m.giorno}`, label: `Plat. ${m.mercato || m.giorno}`, importoGG: Math.round(m.p_annuo / 48) });
      }
    });

    return items;
  }, [speseAnnue, agenda]);

  // Calcolo costo carburante per km REALISTICO
  const costoCarburanteSpeso = store.storicoCarburante.reduce((s: number, c: any) => s + (c.euro || 0), 0);
  const kmTotPercorsi = store.storicoGiornate.reduce((s: number, g: any) => s + (g.km || 0), 0);
  // Logica utente:
  //   - Fallback: 0,20 €/km (richiesta esplicita utente, copre carburante + usura tipica)
  //   - Reale: usa il rapporto storicoCarburante / km percorsi SOLO quando abbiamo
  //     almeno 30 giorni di dati storici (≈ 1 mese di mercati effettuati).
  const COSTO_KM_FALLBACK = 0.20;
  const giorniDatiCarburante = (() => {
    const dates = (store.storicoCarburante || []).map((c: any) => new Date(c.data).getTime());
    if (dates.length < 2) return 0;
    const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
    return span;
  })();
  const datiSufficienti = giorniDatiCarburante >= 30 && kmTotPercorsi > 100 && costoCarburanteSpeso > 0;
  const costoPerKm = datiSufficienti ? (costoCarburanteSpeso / kmTotPercorsi) : COSTO_KM_FALLBACK;

  const speseFisseConCarburante = useMemo(() => {
    const items = [...speseFisseItems];
    const kmMercato = mercatoOggi?.km || 0;
    // HARDCODED 0.20 €/km fino a nuova indicazione
    const mediaEuroKm = 0.20;
    const costoCarb = Math.round(kmMercato * mediaEuroKm);
    items.push({ id: 'carburante_gg', label: t('home.fuelCost') || 'Carburante', importoGG: costoCarb });
    return items;
  }, [speseFisseItems, mercatoOggi, t]);

  // Filter: only show today's plateatico + all general spese + fuel
  const speseFisseOggi = useMemo(() => {
    const mercatoGiornoId = `plat_${mercatoOggi?.giorno}`;
    return speseFisseConCarburante.filter((it) => {
      if (it.id === 'carburante_gg') return true;
      if (it.id.startsWith('plat_')) return it.id === mercatoGiornoId;
      return true;
    });
  }, [speseFisseConCarburante, mercatoOggi]);

  const speseFisse = !isInPiazza ? 0 : speseFisseOggi
    .filter((it) => !(speseFisseDisabilitate || []).includes(it.id))
    .reduce((s, it) => s + it.importoGG, 0);

  const toggleSpesaFissa = (id: string) => {
    const disabled = speseFisseDisabilitate || [];
    const newList = disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id];
    store.setConfig({ speseFisseDisabilitate: newList });
  };

  /* ── Spese Extra fornitori totale (importo del giorno, NO ripartizione) ── */
  const speseExtraFornTotale = useMemo(() => {
    let tot = 0;
    const fornitoriNomi = new Set<string>();
    Object.keys(speseExtraFornitore).forEach((k) => {
      if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
      fornitoriNomi.add(k.replace(/__libera$/, ''));
    });
    fornitoriNomi.forEach((nomeBase) => {
      // Solo i fornitori DAILY (default) vengono detratti dal netto del giorno.
      // CUSTOM (e i legacy WEEKLY/MONTHLY) sono accantonati e distribuiti
      // proporzionalmente nei prossimi N giorni — mostrati nelle Statistiche.
      const dedType = fornDeductionType[nomeBase] || 'DAILY';
      if (dedType !== 'DAILY') return;
      const mode = pagamentoMode[nomeBase] || 'contanti';
      const fatturaEntry = speseExtraFornitore[nomeBase];
      const contantiEntry = speseExtraFornitore[`${nomeBase}__libera`];
      const impFattura = parseFloat((fatturaEntry?.importo || '0').replace(',', '.')) || 0;
      const impContanti = parseFloat((contantiEntry?.importo || '0').replace(',', '.')) || 0;
      if (mode === 'contanti') tot += impContanti;
      else if (mode === 'fattura') tot += impFattura;
      else if (mode === 'misto') tot += impFattura + impContanti;
    });
    return tot;
  }, [speseExtraFornitore, pagamentoMode, fornDeductionType]);

  /* ── Fornitori CUSTOM (periodo personalizzato) accantonati per oggi ──
     Sostituisce i vecchi `speseExtraFornWeekly` + `speseExtraFornMonthly`.
     Include anche i legacy WEEKLY/MONTHLY (mappati a CUSTOM).
     Usato come hint informativo nell'UtileModal e nell'AI Brief. */
  const speseExtraFornCustom = useMemo(() => {
    let tot = 0;
    const nomi = new Set<string>();
    Object.keys(speseExtraFornitore).forEach((k) => {
      if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
      nomi.add(k.replace(/__libera$/, ''));
    });
    nomi.forEach((nomeBase) => {
      const mode = fornDeductionType[nomeBase] || 'DAILY';
      if (mode === 'DAILY') return; // solo non-DAILY
      const payMode = pagamentoMode[nomeBase] || 'contanti';
      const impF = parseFloat((speseExtraFornitore[nomeBase]?.importo || '0').replace(',', '.')) || 0;
      const impC = parseFloat((speseExtraFornitore[`${nomeBase}__libera`]?.importo || '0').replace(',', '.')) || 0;
      if (payMode === 'contanti') tot += impC;
      else if (payMode === 'fattura') tot += impF;
      else tot += impF + impC;
    });
    return tot;
  }, [speseExtraFornitore, pagamentoMode, fornDeductionType]);

  // ─── Alias di retrocompatibilità: alcuni componenti vecchi (es. UtileModal,
  //     AI Brief) leggono ancora `speseExtraFornWeekly` / `speseExtraFornMonthly`.
  //     Manteniamo i nomi ma puntiamo allo stesso valore "custom" così non
  //     dobbiamo riscrivere quei componenti. La distinzione settimanale/mensile
  //     non esiste più in UI, ma se serve in stats userà il nuovo periodo
  //     custom dei `dettaglio_fornitori_days`. ───
  const speseExtraFornWeekly = speseExtraFornCustom;
  const speseExtraFornMonthly = 0;

  /* ══════════════════════════════════════════════════════════════════
     RIPARTIZIONE GIORNALIERA OGGI (Round 43 — richiesta utente):
     "Non toglie nulla nei giorni successivi" → fix: calcola la quota
     proporzionale CUSTOM da sottrarre OGGI dall'utile, considerando:
       1. tutte le fatture CUSTOM già salvate in storico (fatture passate
          ancora dentro la loro finestra di N giorni che oggi tocca);
       2. eventuale NUOVA fattura CUSTOM appena inserita oggi nel modal
          (ancora non salvata in storicoGiornate).
     Algoritmo: applica `calcolaCostoMerceProporzionalePerFornitore` su
     `[storico + giornata-virtuale-oggi]` e somma la quota di ogni
     fornitore corrispondente alla data corrente.
     ⚠️ FIX TDZ: `lordoNum` dichiarato PRIMA del useMemo per evitare
     "Cannot access 'lordoNum' before initialization" (era a riga ~1063,
     mentre il useMemo lo usa ora — TDZ JS).
     ══════════════════════════════════════════════════════════════════ */
  const lordoNum = parseFloat(lordo.replace(',', '.')) || 0;
  const costoMerceRipartitoOggi = useMemo(() => {
    try {
      const todayIso = (() => {
        const d = new Date(dataCorrente);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      // Costruisci giornate "live": esclude oggi (se esiste già) e
      // aggiunge una giornata virtuale con i valori attuali del form.
      const tuttiNomi = new Set<string>();
      Object.keys(speseExtraFornitore).forEach((k) => {
        if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
        tuttiNomi.add(k.replace(/__libera$/, ''));
      });
      const dettOggi: Record<string, number> = {};
      const dedOggi: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'> = {};
      const daysOggi: Record<string, number> = {};
      const startDateOggi: Record<string, string> = {};
      tuttiNomi.forEach((nomeBase) => {
        const mode = fornDeductionType[nomeBase] || 'DAILY';
        if (mode === 'DAILY') return; // DAILY già detratto in g.netto
        const payMode = pagamentoMode[nomeBase] || 'contanti';
        const impF = parseFloat((speseExtraFornitore[nomeBase]?.importo || '0').replace(',', '.')) || 0;
        const impC = parseFloat((speseExtraFornitore[`${nomeBase}__libera`]?.importo || '0').replace(',', '.')) || 0;
        if (payMode === 'contanti' && impC > 0) dettOggi[`${nomeBase}__libera`] = impC;
        else if (payMode === 'fattura' && impF > 0) dettOggi[nomeBase] = impF;
        else if (payMode === 'misto') {
          if (impF > 0) dettOggi[nomeBase] = impF;
          if (impC > 0) dettOggi[`${nomeBase}__libera`] = impC;
        }
        if (Object.keys(dettOggi).some((k) => k.replace(/__libera$/, '') === nomeBase)) {
          dedOggi[nomeBase] = 'CUSTOM';
          daysOggi[nomeBase] = fornDeductionDays[nomeBase] || 7;
          // Round 45: includi anche lo startDate snapshot
          startDateOggi[nomeBase] = fornDeductionStartDate[nomeBase] || todayIso;
        }
      });
      const giornataVirtuale: any = {
        data: new Date(dataCorrente).toISOString(),
        mercato: '', meteo: '', km: 0,
        lordo: lordoNum, netto: 0, contanti: 0, pos: 0, spese_extra: 0,
        dettaglio_staff: {}, dettaglio_invenduto: {},
        dettaglio_fornitori: dettOggi,
        dettaglio_fornitori_deduction: dedOggi,
        dettaglio_fornitori_days: daysOggi,
        dettaglio_fornitori_startDate: startDateOggi,
        inPiazza: true,
      };
      const altreGiornate = (store.storicoGiornate || []).filter((g: any) => {
        try {
          const gIso = new Date(g.data).toISOString().slice(0, 10);
          return gIso !== todayIso;
        } catch { return true; }
      });
      const tutte = [...altreGiornate, giornataVirtuale];
      // Config dei fornitori dal store (single source of truth per mode/days/startDate)
      const fornCfg: Record<string, { mode?: 'DAILY' | 'CUSTOM'; days?: number; startDate?: string }> = {};
      (store.fornitori as any[] || []).forEach((f: any) => {
        if (!f || !f.nome) return;
        fornCfg[f.nome] = { mode: f.deductionMode, days: f.deductionDays, startDate: f.deductionStartDate };
      });
      const perForn = calcolaCostoMerceProporzionalePerFornitore(tutte, fornCfg);
      let totaleQuotaOggi = 0;
      Object.entries(perForn).forEach(([forn, daysMap]) => {
        const cfg = fornCfg[forn];
        const mode = cfg?.mode || (dedOggi[forn]) || 'DAILY';
        if (mode === 'DAILY') return;
        totaleQuotaOggi += (daysMap as any)[todayIso] || 0;
      });
      return Math.round(totaleQuotaOggi * 100) / 100;
    } catch (e) {
      return 0;
    }
  }, [
    dataCorrente, lordoNum,
    speseExtraFornitore, pagamentoMode, fornDeductionType, fornDeductionDays,
    store.storicoGiornate, store.fornitori,
  ]);

  /* ── Spese Extra generiche totale (importo del giorno, NO ripartizione) ── */
  const speseExtraGenTotale = useMemo(() => {
    let tot = 0;
    vociGeneriche.forEach((v: any) => {
      if (!v.attivo) return;
      // Round 61: SOLO le voci con ripMode='oggi' (o senza ripMode) impattano
      // il netto del giorno corrente. Le voci settimanali/personalizzate
      // sono spostate in spesePeriodiche e mostrate come promemoria.
      const ripMode = v.ripMode || 'oggi';
      if (ripMode !== 'oggi') return;
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (imp > 0) tot += imp;
    });
    return tot;
  }, [vociGeneriche]);

  /* ── Totali settimanali per fornitore (Lun-Dom contenente dataCorrente) ── */
  const weeklyTotalsByForn = useMemo(() => {
    const d = new Date(dataCorrente);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const result: Record<string, { contanti: number; fattura: number }> = {};

    // 1. Storico salvato — ESCLUDI il giorno corrente (sarà aggiunto da memoria viva sotto)
    (store.storicoGiornate || []).forEach((g: any) => {
      const gd = new Date(g.data);
      if (gd < monday || gd > sunday) return;
      if (gd.toDateString() === dataCorrente.toDateString()) return;
      const dettaglio = g.dettaglio_fornitori || {};
      Object.entries(dettaglio).forEach(([key, val]: [string, any]) => {
        const v = parseFloat(String(val)) || 0;
        if (v <= 0) return;
        const isLibera = key.endsWith('__libera');
        const nomeBase = isLibera ? key.slice(0, -'__libera'.length) : key;
        if (!result[nomeBase]) result[nomeBase] = { contanti: 0, fattura: 0 };
        if (isLibera) result[nomeBase].contanti += v;
        else result[nomeBase].fattura += v;
      });
    });

    // 2. Giorno corrente — usa lo stato in-memory (importo INTERO, no ripartizione)
    const currentDay = new Date(dataCorrente);
    currentDay.setHours(12, 0, 0, 0);
    if (currentDay >= monday && currentDay <= sunday) {
      const fornitoriNomi = new Set<string>();
      Object.keys(speseExtraFornitore).forEach((k) => {
        if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
        fornitoriNomi.add(k.replace(/__libera$/, ''));
      });
      fornitoriNomi.forEach((nomeBase) => {
        const mode = pagamentoMode[nomeBase] || 'contanti';
        const impFattura = parseFloat((speseExtraFornitore[nomeBase]?.importo || '0').replace(',', '.')) || 0;
        const impContanti = parseFloat((speseExtraFornitore[`${nomeBase}__libera`]?.importo || '0').replace(',', '.')) || 0;
        if (!result[nomeBase]) result[nomeBase] = { contanti: 0, fattura: 0 };
        if (mode === 'contanti') {
          result[nomeBase].contanti += impContanti;
        } else if (mode === 'fattura') {
          result[nomeBase].fattura += impFattura;
        } else if (mode === 'misto') {
          result[nomeBase].fattura += impFattura;
          result[nomeBase].contanti += impContanti;
        }
      });
    }
    return result;
  }, [dataCorrente, store.storicoGiornate, speseExtraFornitore, pagamentoMode]);

  /* ── Plateatico Fiera → aggiungere a spese fisse ── */
  const fieraPlatNum = parseFloat((fieraPlat || '0').replace(',', '.')) || 0;

  // (lordoNum è stato spostato sopra, prima di `costoMerceRipartitoOggi`,
  // per evitare la temporal dead zone JS che causava errore di rendering)
  // speseExtraTotNum = SOLO spese extra generiche (le fornitori DAILY sono separate e flaggabili)
  const speseExtraTotNum = excludeSpeseExtra ? 0 : speseExtraGenTotale;
  const fornitoriDailyNum = excludeFornitori ? 0 : speseExtraFornTotale;
  const invendutoNum = excludeInvenduto ? 0 : (parseFloat(invenduto.replace(',', '.')) || 0);

  // Costo collaboratori attivi (presenti oggi) con override giornaliero
  const costoCollabAttivi = collaboratori
    .filter((c) => presenze[c.nome])
    .reduce((s, c) => s + (costiOverride[c.nome] !== undefined ? costiOverride[c.nome] : (c.costo || 0)), 0);

  // Spese fisse totali = spese fisse annuali + plateatico fiera (se attivo)
  const speseFisseTotali = speseFisse + (isFiera ? fieraPlatNum : 0);

  // UTILE: calcolo con flag macro-categorie
  // ⭐ Round 46 (NUOVA LOGICA SEMPLIFICATA): la quota proporzionale CUSTOM
  // di OGGI NON viene più detratta dall'utile giornaliero. La logica è:
  //   - DAILY → detratta interamente dall'utile del giorno (come prima)
  //   - CUSTOM → detrazione FISSA sul lordo del PERIODO specificato
  //     (Dal/Al), visualizzata in Statistiche, NON nell'utile giornaliero.
  // Per il giorno: mostriamo solo il DAILY. La quota CUSTOM è informativa
  // (visibile in Spese Extra modal sotto "Totale del giorno").
  const utile = lordoNum
    - (excludeSpeseFisse ? 0 : speseFisseTotali)
    - (excludeSpeseExtra ? 0 : speseExtraTotNum)
    - (excludeFornitori ? 0 : speseExtraFornTotale)
    - (excludeInvenduto ? 0 : invendutoNum)
    - (excludeCollaboratori ? 0 : costoCollabAttivi);

  const collabNames = collaboratori.length > 0 ? collaboratori.map((c) => c.nome) : [];

  /* ═══ Round 63 — INPUT CURSOR FIX ═══
     Bug precedente: handleLordo aggiornava SIA lordo SIA contanti ad ogni
     keystroke. Il re-render contestuale faceva "saltare" il cursore alla
     fine del testo, impedendo la cancellazione mid-position con backspace.
     Fix: onChangeText aggiorna SOLO il campo digitato; l'auto-calc
     contanti/pos viene fatto SOLO su onBlur (quando l'utente esce dal
     campo). Cosi l'utente può inserire/cancellare in qualunque
     posizione senza interferenze. */
  const handleLordo = (val: string) => setLordo(val);
  const handleContanti = (val: string) => setContanti(val);
  const handlePos = (val: string) => setPos(val);

  const handleLordoBlur = () => {
    const l = parseFloat(lordo.replace(',', '.')) || 0;
    const p = parseFloat(pos.replace(',', '.')) || 0;
    if (l > 0) setContanti(Math.max(0, Math.round(l - p)).toString());
  };
  const handleContantiBlur = () => {
    const c = parseFloat(contanti.replace(',', '.')) || 0;
    if (lordoNum > 0) setPos(Math.max(0, Math.round(lordoNum - c)).toString());
  };
  const handlePosBlur = () => {
    const p = parseFloat(pos.replace(',', '.')) || 0;
    if (lordoNum > 0) setContanti(Math.max(0, Math.round(lordoNum - p)).toString());
  };

  const handleSalva = useCallback(() => {
    // ═══ PERMISSION GATING: MANAGER/UTENTE non possono modificare lo storico ═══
    // Solo l'AMMINISTRATORE può sovrascrivere giornate già esistenti.
    // Per gli altri ruoli: blocco se la data corrente NON è oggi.
    if (!perms.canEditHistory) {
      const today = new Date();
      const isToday = dataCorrente.toDateString() === today.toDateString();
      if (!isToday) {
        Alert.alert(
          'Operazione non consentita',
          'Solo l\u2019amministratore può modificare le giornate già passate. Puoi inserire dati solo per la giornata di oggi.'
        );
        return;
      }
      // Anche se è oggi: blocca la sovrascrittura se esiste già una giornata salvata
      const giaSalvata = (store.storicoGiornate || []).some((g: any) => {
        try { return new Date(g.data).toDateString() === today.toDateString(); }
        catch { return false; }
      });
      if (giaSalvata) {
        Alert.alert(
          'Giornata già registrata',
          'La giornata di oggi è già stata salvata. Solo l\u2019amministratore può modificarla.'
        );
        return;
      }
    }

    // ═══ Salva importi INTEGRI (NO ripartizione) ═══
    const dettaglioForn: Record<string, number> = {};
    const dettaglioFornDed: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'> = {};
    const dettaglioFornDays: Record<string, number> = {};
    // Round 45: snapshot della DATA DI INIZIO del periodo CUSTOM. Garantisce
    // che ogni fattura sia distribuita dalla SUA data di registrazione,
    // anche se l'utente modifica in seguito il default del fornitore.
    const dettaglioFornStartDate: Record<string, string> = {};
    const fornitoriNomi = new Set<string>();
    Object.keys(speseExtraFornitore).forEach((k) => {
      if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
      fornitoriNomi.add(k.replace(/__libera$/, ''));
    });

    fornitoriNomi.forEach((nomeBase) => {
      const mode = pagamentoMode[nomeBase] || 'contanti';
      const fatturaEntry = speseExtraFornitore[nomeBase];
      const contantiEntry = speseExtraFornitore[`${nomeBase}__libera`];
      const impFattura = parseFloat((fatturaEntry?.importo || '0').replace(',', '.')) || 0;
      const impContanti = parseFloat((contantiEntry?.importo || '0').replace(',', '.')) || 0;
      const dedType = fornDeductionType[nomeBase] || 'DAILY';

      // Salva chiavi separate: nomeBase (fattura) + nomeBase__libera (contanti)
      // così stats.tsx può distinguere correttamente Fatturata vs Contanti.
      let hasAmount = false;
      if (mode === 'contanti') {
        if (impContanti > 0) { dettaglioForn[`${nomeBase}__libera`] = Math.round(impContanti * 100) / 100; hasAmount = true; }
      } else if (mode === 'fattura') {
        if (impFattura > 0) { dettaglioForn[nomeBase] = Math.round(impFattura * 100) / 100; hasAmount = true; }
      } else if (mode === 'misto') {
        if (impFattura > 0) { dettaglioForn[nomeBase] = Math.round(impFattura * 100) / 100; hasAmount = true; }
        if (impContanti > 0) { dettaglioForn[`${nomeBase}__libera`] = Math.round(impContanti * 100) / 100; hasAmount = true; }
      }
      // Salva il deduction type sempre (anche solo se c'è importo o se l'utente ha selezionato)
      if (hasAmount) {
        dettaglioFornDed[nomeBase] = dedType;
        // Se CUSTOM (o legacy WEEKLY/MONTHLY) salva anche il numero giorni del periodo
        if (dedType !== 'DAILY') {
          const days = fornDeductionDays[nomeBase] || (dedType === 'MONTHLY' ? 30 : 7);
          dettaglioFornDays[nomeBase] = days;
          // Round 45: salva startDate snapshot (priorità: scelta utente → data giornata)
          const startDate = fornDeductionStartDate[nomeBase];
          if (startDate) {
            dettaglioFornStartDate[nomeBase] = startDate;
          } else {
            try {
              const d = new Date(dataCorrente);
              dettaglioFornStartDate[nomeBase] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } catch {}
          }
        }
      }
    });

    // Build dettaglio_spese_extra from vociGeneriche (importo intero, NO ripartizione)
    const dettaglioExtra: Record<string, number> = {};
    vociGeneriche.forEach((v: any) => {
      if (!v.attivo) return;
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (imp > 0) dettaglioExtra[v.nome] = imp;
    });

    // ═══ Round 61 — ROUTING SPESE PERIODICHE ═══
    // Le spese con tipo NON-DAILY (Fornitori CUSTOM/WEEKLY/MONTHLY +
    // VociGeneriche con ripMode != 'oggi') vengono spostate nella collezione
    // `spesePeriodiche` invece di restare nei dettaglio_* della giornata.
    // Effetti:
    //   • Il calcolo del netto giornaliero NON sottrae più questi importi
    //   • Le voci diventano "promemoria visivi" trascinati per tutto [from..to]
    //   • Il netto dell'intero periodo le sottrae correttamente (vedi stats.tsx)
    const dayIso = (() => {
      try {
        const d = new Date(dataCorrente);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } catch { return ''; }
    })();

    // 1) Prima azzeriamo le periodiche di questa data (sovrascrivi scelta utente "a")
    if (dayIso) {
      try { (useAppStore.getState() as any).clearSpesePeriodichePerData?.(dayIso); } catch {}
    }

    // 2) Estraiamo fornitori periodici e li spostiamo
    const fornitoriPeriodiciToSave: Array<any> = [];
    Object.keys(dettaglioFornDed).forEach((nomeBase) => {
      const dt = dettaglioFornDed[nomeBase];
      if (!dt || dt === 'DAILY') return;
      // Somma tutte le voci collegate (nomeBase + nomeBase__libera*)
      // Round 67 — tracciamo separatamente la parte FATTURA (chiave nomeBase)
      // e la parte CONTANTI (chiave nomeBase__libera) così le Statistiche
      // possono classificare correttamente Fatturata vs Contanti anche per
      // le spese ripartite.
      let importo = 0;
      let impFatturaPart = 0;
      let impContantiPart = 0;
      const keysToRemove: string[] = [];
      Object.keys(dettaglioForn).forEach((k) => {
        if (k === nomeBase || k.startsWith(nomeBase + '__libera') || k.startsWith(nomeBase + '__fattn')) {
          const v = parseFloat(String(dettaglioForn[k])) || 0;
          importo += v;
          if (k === nomeBase) impFatturaPart += v;
          else if (k.startsWith(nomeBase + '__libera') && !k.includes('__liberaLabel')) impContantiPart += v;
          keysToRemove.push(k);
        }
      });
      if (importo <= 0) return;
      const periodDays = dettaglioFornDays[nomeBase] || (dt === 'WEEKLY' ? 7 : dt === 'MONTHLY' ? 30 : 7);
      const startIso = dettaglioFornStartDate[nomeBase] || dayIso;
      if (!startIso) return;
      const startD = new Date(startIso + 'T00:00:00');
      const endD = new Date(startD); endD.setDate(startD.getDate() + periodDays - 1);
      const endIso = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;

      fornitoriPeriodiciToSave.push({
        nome: nomeBase, importo, categoria: 'fornitore' as const,
        from: startIso, to: endIso,
        type: dt as 'WEEKLY' | 'CUSTOM' | 'MONTHLY',
        dayOfPurchase: dayIso,
        numeroFattura: fornInfo?.[nomeBase]?.numeroFattura,
        // Round 67 — BUG FIX: il pagamentoMode era letto da fornInfo (che non
        // lo contiene → sempre undefined). Ora viene letto dallo state corretto
        // `pagamentoMode` e salviamo anche lo split fattura/contanti, così le
        // Statistiche sommano le fatture sotto "Fatturata" e non le disperdono.
        pagamentoMode: pagamentoMode[nomeBase] || 'contanti',
        importoFattura: Math.round(impFatturaPart * 100) / 100,
        importoContanti: Math.round(impContantiPart * 100) / 100,
      });

      // Rimuoviamo dai dettaglio_* in modo che la giornata salvi solo i DAILY
      keysToRemove.forEach((k) => { delete dettaglioForn[k]; });
      delete dettaglioFornDed[nomeBase];
      delete dettaglioFornDays[nomeBase];
      delete dettaglioFornStartDate[nomeBase];
    });

    // 3) Estraiamo voci generiche periodiche
    const vociPeriodicheToSave: Array<any> = [];
    vociGeneriche.forEach((v: any) => {
      if (!v.attivo) return;
      const ripMode = v.ripMode || 'oggi';
      if (ripMode === 'oggi') return;
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (imp <= 0) return;
      const from = v.ripFrom || dayIso;
      const to = v.ripTo || dayIso;
      if (!from || !to) return;
      vociPeriodicheToSave.push({
        nome: v.nome, importo: imp, categoria: 'voce' as const,
        from, to,
        type: (ripMode === 'settimana' ? 'WEEKLY' : 'CUSTOM') as 'WEEKLY' | 'CUSTOM' | 'MONTHLY',
        dayOfPurchase: dayIso,
      });
      // Rimuoviamo anche da dettaglioExtra così non viene contato come DAILY
      delete dettaglioExtra[v.nome];
    });

    // 4) Salviamo nel store le periodiche
    if (fornitoriPeriodiciToSave.length > 0 || vociPeriodicheToSave.length > 0) {
      try {
        const add = (useAppStore.getState() as any).addSpesaPeriodica;
        [...fornitoriPeriodiciToSave, ...vociPeriodicheToSave].forEach((sp) => add?.(sp));
      } catch (e) {
        console.warn('Errore salvataggio spesePeriodiche:', e);
      }
    }

    // Build dettaglio_staff as NUMBERS (cost including override) so stats uses the correct amounts
    const dettaglioStaff: Record<string, number> = {};
    (collaboratori || []).forEach((c) => {
      if (presenze[c.nome]) {
        const costoBase = c.costo || 0;
        dettaglioStaff[c.nome] = costiOverride[c.nome] !== undefined ? costiOverride[c.nome] : costoBase;
      } else {
        dettaglioStaff[c.nome] = 0;
      }
    });

    // Build dettaglio_invenduto per prodotto (pizza, pane-andrea, ecc.) + totale
    const dettaglioInv: Record<string, number> = { totale: invendutoNum };
    Object.entries(invendutoQty).forEach(([key, val]) => {
      const qty = parseFloat((val || '0').replace(',', '.')) || 0;
      if (qty <= 0) return;
      const prod = tuttiProdotti.find(p => `${p.fornitore}_${p.nome}` === key);
      if (!prod) return;
      const valore = isAlimentare ? qty * prod.prezzo : qty;
      // Etichetta: "Pane - Andrea"
      const label = `${prod.nome} - ${prod.fornitore}`;
      dettaglioInv[label] = valore;
    });

    salvaGiornata({
      data: dataCorrente, mercato: mercatoNome, meteo,
      km: mercatoOggi?.km || 0, lordo: lordoNum, netto: utile,
      contanti: parseFloat(contanti.replace(',', '.')) || 0,
      pos: parseFloat(pos.replace(',', '.')) || 0,
      spese_extra: speseExtraTotNum,
      dettaglio_staff: dettaglioStaff,
      dettaglio_invenduto: dettaglioInv,
      dettaglio_fornitori: dettaglioForn,
      dettaglio_fornitori_deduction: dettaglioFornDed,
      dettaglio_fornitori_days: dettaglioFornDays,
      dettaglio_fornitori_startDate: dettaglioFornStartDate,
      dettaglio_spese_extra: dettaglioExtra,
      fornitoriInfo: fornInfo,
      // Stato del pulsante 'casa/storefront': true = sono andato a lavoro,
      // false = non sono andato (icona casa rossa). Persistito nel record
      // così quando si torna a vedere quel giorno, il pulsante mantiene il colore.
      inPiazza: isInPiazza,
    } as any);

    // Integrazione in Ordini e Appuntamenti: per ogni fornitore con scadenza
    // crea (o aggiorna) un ordine con la data di scadenza
    Object.entries(fornInfo).forEach(([nomeFornitore, info]) => {
      if (!info || !info.scadenza) return;
      const imp = dettaglioForn[nomeFornitore] || 0;
      if (imp <= 0 && !info.numeroFattura) return;
      try {
        const scadenzaDate = new Date(info.scadenza + 'T12:00:00');
        if (isNaN(scadenzaDate.getTime())) return;
        const testo = `${nomeFornitore}${info.numeroFattura ? ` – Fatt. ${info.numeroFattura}` : ''} – €${imp.toFixed(0)}`;
        // Evita duplicati: rimuovi eventuale ordine esistente per stessa data+fornitore
        const existing = (ordiniAgenda || []).find((o: any) => {
          const d = new Date(o.data);
          return d.toDateString() === scadenzaDate.toDateString() && (o.testo || '').startsWith(nomeFornitore);
        });
        if (existing) {
          removeOrdine(new Date(existing.data), existing.testo);
        }
        addOrdine({ data: scadenzaDate, testo });
      } catch { /* skip */ }
    });

    /* ═══ Round 72 — APPEND FATTURE LOG (immutabile) ═══
       Per ogni fornitore con numeroFattura → upsert nel log fatture.
       L'archivio fatture e il totale Statistiche si basano su questo log,
       NON sul fornitoriInfo della giornata (che soffre di overwriting). */
    try {
      const upsertFattura = (useAppStore.getState() as any).upsertFatturaByKey;
      const giornataIso = (() => {
        try {
          return dataCorrente.toISOString().slice(0, 10);
        } catch { return new Date().toISOString().slice(0, 10); }
      })();
      Object.entries(fornInfo || {}).forEach(([nomeFornitore, info]: any) => {
        if (!info?.numeroFattura || !String(info.numeroFattura).trim()) return;
        const imp = dettaglioForn[nomeFornitore] || 0;
        if (imp <= 0) return;
        const mode = (pagamentoMode?.[nomeFornitore] || 'fattura') as 'contanti' | 'fattura' | 'misto';
        const periodoFrom = fornDeductionStartDate?.[nomeFornitore] || giornataIso;
        const dedDays = fornDeductionDays?.[nomeFornitore] || 0;
        let periodoTo = periodoFrom;
        if (dedDays > 0) {
          try {
            const d = new Date(periodoFrom + 'T12:00:00');
            d.setDate(d.getDate() + (dedDays - 1));
            periodoTo = d.toISOString().slice(0, 10);
          } catch { /* skip */ }
        }
        try {
          upsertFattura?.(
            { fornitore: nomeFornitore, numeroFattura: String(info.numeroFattura).trim() },
            {
              importo: imp,
              modoPagamento: mode,
              dataEmissione: giornataIso,
              periodoFrom,
              periodoTo,
              scadenza: info.scadenza || undefined,
            }
          );
        } catch { /* skip */ }
      });
    } catch { /* skip */ }
  }, [dataCorrente, mercatoNome, meteo, mercatoOggi, lordoNum, utile, contanti, pos, speseExtraTotNum, presenze, costiOverride, collaboratori, invendutoNum, invendutoQty, tuttiProdotti, isAlimentare, speseExtraFornitore, vociGeneriche, salvaGiornata, fornInfo, ordiniAgenda, pagamentoMode, fornDeductionType, fornDeductionDays, fornDeductionStartDate, perms.canEditHistory, store.storicoGiornate, isInPiazza]);

  /* ── Auto-salvataggio: salva automaticamente quando cambiano i dati principali ── */
  // Use a REF to always call the latest handleSalva (avoids stale-closure bug
  // where autosave would persist using OLD dataCorrente after a day change).
  const handleSalvaRef = useRef(handleSalva);
  useEffect(() => { handleSalvaRef.current = handleSalva; }, [handleSalva]);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last date we autosaved on, so day-changes don't write empty data
  // over a previously saved day.
  const lastAutosaveDateRef = useRef<string | null>(null);
  useEffect(() => {
    // Auto-salva se c'è ALMENO una di queste:
    //  - lordo > 0 (giornata di mercato vera)
    //  - spese extra > 0 (l'utente sta tracciando solo costi)
    //  - presenze collaboratori
    //  - una fattura inserita (numero o scadenza)
    //  - Round 64: una voce generica PERIODICA con importo > 0 (Settimana/Personalizza).
    //    Senza questo controllo le voci ripartite NON facevano scattare
    //    l'autosave (perché speseExtraTotNum esclude le periodiche), quindi
    //    venivano salvate solo manualmente cliccando SALVA GIORNATA.
    //  - Round 64: un fornitore CUSTOM/WEEKLY con importo > 0.
    const hasInvoice = Object.values(fornInfo || {}).some((f: any) =>
      (f?.numeroFattura || '').trim() !== '' || (f?.scadenza || '').trim() !== ''
    );
    const hasPresenze = Object.values(presenze || {}).some(Boolean);
    const hasVociPeriodiche = vociGeneriche.some((v: any) => {
      const ripMode = v?.ripMode || 'oggi';
      if (ripMode === 'oggi') return false;
      const imp = parseFloat((v?.importo || '0').replace(',', '.')) || 0;
      return imp > 0;
    });
    const hasFornitoriPeriodici = (() => {
      const nomi = new Set<string>();
      Object.keys(speseExtraFornitore || {}).forEach((k) => {
        if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
        nomi.add(k.replace(/__libera$/, ''));
      });
      for (const nomeBase of nomi) {
        const dt = (fornDeductionType as any)[nomeBase] || 'DAILY';
        if (dt === 'DAILY') continue;
        const impF = parseFloat(((speseExtraFornitore as any)[nomeBase]?.importo || '0').replace(',', '.')) || 0;
        const impC = parseFloat(((speseExtraFornitore as any)[`${nomeBase}__libera`]?.importo || '0').replace(',', '.')) || 0;
        if (impF + impC > 0) return true;
      }
      return false;
    })();
    const shouldAutosave = lordoNum > 0 || speseExtraTotNum > 0 || hasInvoice
      || hasPresenze || hasVociPeriodiche || hasFornitoriPeriodici;
    if (shouldAutosave) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const dataKey = dataCorrente.toDateString();
      autoSaveTimerRef.current = setTimeout(() => {
        // Sanity check: ensure dataCorrente didn't change during the debounce
        if (dataKey === dataCorrente.toDateString()) {
          handleSalvaRef.current();
          lastAutosaveDateRef.current = dataKey;
        }
      }, 1500); // Salva dopo 1.5 secondi di inattività
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [lordoNum, contanti, pos, meteo, invendutoNum, presenze, costiOverride,
      speseExtraFornTotale, speseExtraGenTotale, dataCorrente, fornInfo,
      speseExtraTotNum, vociGeneriche, speseExtraFornitore, fornDeductionType]);

  /* ─── Round 50: SALVA SINGOLO TOCCO ───
     Il vecchio handleSalvaManuale chiamava direttamente `handleSalva()`
     (useCallback con ~20 dipendenze). Quando il componente faceva re-render
     poco prima del tap, il `handleSalva` riferito dall'`onPress` poteva
     puntare a una versione stale e fallire silenziosamente → l'utente
     doveva premere DUE volte.
     Fix: chiamiamo `handleSalvaRef.current()` (sempre aggiornata via useEffect
     subito sotto) così la prima pressione esegue immediatamente la versione
     più recente. */
  const handleSalvaManuale = () => {
    if (handleSalvaRef.current) handleSalvaRef.current();
    playSuccess();
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
        {/* Badge ruolo (visibile SOLO per MANAGER e UTENTE — l'AMMINISTRATORE no) */}
        {!perms.isAmm ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: perms.isManager ? '#E8E0F2' : '#FFE5C9',
            paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
            marginTop: 2, marginBottom: 2,
          }}>
            <Ionicons
              name={perms.isManager ? 'briefcase' : 'person'}
              size={11}
              color={perms.isManager ? '#5D3A8A' : '#A0541E'}
            />
            <Text style={{
              fontSize: 10, fontWeight: '800', letterSpacing: 0.6,
              color: perms.isManager ? '#5D3A8A' : '#A0541E',
            }}>
              {perms.isManager ? 'MANAGER · INSERIMENTO ONLY' : 'UTENTE · BASE'}
            </Text>
          </View>
        ) : null}
        {/* Riga: power button (sx) + nome mercato (flex-center) + spacer (dx)
            Layout flex: il nome mercato prende tutto lo spazio rimanente e viene
            ellipsizzato correttamente con numberOfLines=1, senza overlap col power. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', minHeight: 28 }}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === 'web') {
                // Round 50: lock prima di chiudere la finestra (così al
                // prossimo accesso verrà richiesto il PIN come richiesto utente)
                try { useAppLockStore.getState().lock(); } catch {}
                window.close();
              } else {
                Alert.alert(
                  t('settings.exitApp') || "ESCI DALL'APP",
                  t('settings.exitAppConfirm') || 'Vuoi chiudere MarketMate?',
                  [
                    { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                    {
                      text: t('settings.exitApp') || 'ESCI',
                      onPress: () => {
                        // Round 50: lock app PRIMA di uscire — al prossimo
                        // avvio verrà richiesto il PIN. Senza questa
                        // chiamata, i normali rilanci dell'app NON
                        // chiedono più il PIN (richiesta utente).
                        try { useAppLockStore.getState().lock(); } catch {}
                        BackHandler.exitApp();
                      },
                    },
                  ]
                );
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, alignItems: 'flex-start' }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#B0A898', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="power" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text
            style={[s.marketName, { flex: 1, paddingHorizontal: 4 }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {(mercatoNome.toUpperCase() || t('home.noMarketToday'))}
          </Text>
          {/* Spacer dx per bilanciare il power, così il testo è ottica-mente centrato */}
          <View style={{ width: 32 }} />
        </View>
        <View style={s.dateRow} testID="home-date-row" ref={anchorDateRow}>
          <TouchableOpacity
            onPress={() => {
              hapticTap();
              const d = new Date(dataCorrente);
              d.setDate(d.getDate() - 1);
              setDataCorrente(d);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            testID="day-prev-btn"
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-back" size={22} color="#1E7F85" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticTap(); setShowCalendar(true); }} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
            <Ionicons name="calendar" size={18} color="#1E7F85" />
            <Text style={s.dateTxt}>{giorno.toUpperCase()} {data.toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticTap();
              const d = new Date(dataCorrente);
              d.setDate(d.getDate() + 1);
              setDataCorrente(d);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            testID="day-next-btn"
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-forward" size={22} color="#1E7F85" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ TOGGLE ═══ */}
      <View style={[s.section, { height: TOGGLE_H, justifyContent: 'center' }]}>
        <View style={s.toggleRow}>
          <TouchableOpacity style={{ flex: 1, marginRight: 4 }} onPress={() => setIsFiera(false)}>
            <View style={[s.toggle, !isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, !isFiera && { color: '#FFF' }]}>{t('home.market')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, marginHorizontal: 4 }} onPress={() => {
            setIsFiera(true);
            // Auto-rilevamento: se oggi c'è una fiera attiva (ricorrente o data specifica), pre-compila SENZA popup
            const dow = (dataCorrente.getDay() + 6) % 7; // 0=Lun .. 6=Dom
            const isoToday = `${dataCorrente.getFullYear()}-${String(dataCorrente.getMonth() + 1).padStart(2, '0')}-${String(dataCorrente.getDate()).padStart(2, '0')}`;
            const fiereOggi = (store.fiere || []).filter((f: any) => 
              f.attiva && (f.giorni?.includes(dow) || (f.dateSpecifiche || []).includes(isoToday))
            );
            if (fiereOggi.length >= 1) {
              // Prende la prima (o l'unica). Se multiple, la logica viene gestita dopo via dropdown in-place
              const f = fiereOggi[0];
              setFieraLuogo(f.nome + (f.luogo ? ` - ${f.luogo}` : ''));
              setFieraKm(String(f.km || ''));
              setFieraPlat(String(f.plateatico || ''));
            }
            // Nessun popup: i dati sono già in Impostazioni → Eventi e Fiere
          }}>
            <View style={[s.toggle, isFiera && s.toggleOn]}>
              <Text style={[s.toggleTxt, isFiera && { color: '#FFF' }]}>{t('stats.fairs') || 'FIERE'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginLeft: 4 }} onPress={() => setIsInPiazza(!isInPiazza)}>
            <View style={[s.piazzaBtn, !isInPiazza && { backgroundColor: '#CC3333' }]}>
              <Ionicons name={isInPiazza ? 'storefront' : 'home'} size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          {/* Bell allineata con la casetta */}
          <TouchableOpacity
            onPress={() => { hapticTap(); setShowBellModal(true); }}
            activeOpacity={0.7}
            style={{ marginLeft: 4 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[s.piazzaBtn, notificheCount > 0 && { backgroundColor: '#E44' }]}>
              <Ionicons name="notifications" size={18} color="#FFF" />
              {notificheCount > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeTxt}>{notificheCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ WEATHER (icone = dimensione tab bar) ═══ */}
      <View style={[s.section, { height: WEATHER_H, justifyContent: 'center' }]} testID="home-meteo-row" ref={anchorMeteoRow}>
        <View style={s.meteoRow}>
          {WEATHER_ICONS.map((w, i) => {
            const sel = meteo === w.code;
            return (
              <TouchableOpacity key={i} onPress={() => { hapticTap(); setMeteo(w.code); }} activeOpacity={0.7}>
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
            const hasOverride = costiOverride[n] !== undefined;
            const costoBase = collaboratori.find(c => c.nome === n)?.costo || 0;
            const costoGiorno = hasOverride ? costiOverride[n] : costoBase;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setPresenze((p) => ({ ...p, [n]: !p[n] }))}
                onLongPress={() => {
                  setTempCost(costoGiorno.toString());
                  setShowCostModal(n);
                }}
                delayLongPress={500}
              >
                <View style={[s.collab, on && s.collabOn]}>
                  <Text style={[s.collabTxt, on && { color: '#FFF' }]}>{n.toUpperCase()}</Text>
                  {hasOverride && on && (
                    <Text style={{ fontSize: 8, color: '#FFD700', fontWeight: '800' }}>€{costoGiorno}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: GAP * 2 }} />

      {/* ═══ ROW 1: LORDO / UTILE (+20% altezza) ═══ */}
      <View style={[s.gridRow, { gap: GAP }]} testID="home-incasso-row" ref={anchorIncassoRow}>
        <View style={[s.card, { height: lordoRowH }]}>
          <Text style={s.cardBold}>{t('home.gross')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={lordo} onChangeText={handleLordo} onBlur={handleLordoBlur} selectTextOnFocus />
        </View>
        <TouchableOpacity style={[s.card, { height: lordoRowH }]} activeOpacity={0.7} onPress={() => setShowUtileModal(true)}>
          {/* Round 49: solo freccia rivolta verso il basso (chevron) — niente testo */}
          <View style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,127,133,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={14} color="#1E7F85" />
          </View>
          <Text style={s.cardBold}>{t('home.profit')}</Text>
          <Text style={[s.cardValBold, { color: utile >= 0 ? '#2A7A5A' : '#D44' }]}>{'\u20AC'}{Math.round(utile)}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 2: CONTANTI / POS ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>{t('home.cash')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={contanti} onChangeText={handleContanti} onBlur={handleContantiBlur} selectTextOnFocus />
        </View>
        <View style={[s.card, { height: normalRowH }]}>
          <Text style={s.cardLbl}>{t('home.pos')}</Text>
          <TextInput style={s.cardInp} placeholder="0" placeholderTextColor="#C0B5A5" keyboardType="numeric" value={pos} onChangeText={handlePos} onBlur={handlePosBlur} selectTextOnFocus />
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 3: SPESE EXTRA (cliccabile → fornitori) / SPESE FISSE ═══ */}
      <View style={[s.gridRow, { gap: GAP }]} testID="home-spese-row" ref={anchorSpeseRow}>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowSpeseExtraModal(true)}>
          <Text style={s.cardLbl}>SPESE</Text>
          <Text style={[s.cardVal, { marginLeft: 4 }]}>{'\u20AC'}{(speseExtraFornTotale + speseExtraGenTotale).toFixed(0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowSpeseFisseModal(true)}>
          <Text style={s.cardLbl}>{t('home.fixedExpenses')}</Text>
          <Text style={s.cardVal}>{'\u20AC'}{speseFisseTotali.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ ROW 4: INVENDUTO/PERDITA / BUONGIORNO ═══ */}
      <View style={[s.gridRow, { gap: GAP }]}>
        <TouchableOpacity style={[s.card, { height: normalRowH }]} activeOpacity={0.7} onPress={() => setShowInvendutoModal(true)}>
          <Text style={s.cardLbl}>{perditaLabel}</Text>
          <Text style={s.cardVal}>{invendutoNum > 0 ? `€${invendutoNum}` : '0'}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="home-buongiorno-btn" ref={anchorBuongiorno as any} style={[s.card, { height: normalRowH, backgroundColor: '#1E7F85' }]} activeOpacity={0.7} onPress={() => setShowBuongiorno(true)}>
          <Ionicons name="globe-outline" size={16} color="#FFF" />
          <Text style={[s.cardBold, { color: '#FFF', fontSize: 12 }]}>{t('home.goodMorning').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ STORICO MERCATO - Grafico Professionale ═══ */}
      <View style={[s.section, { flex: 1, minHeight: STORICO_H }]} testID="home-stats-box" ref={anchorStatsBox}>
        <View style={[s.storico, { flex: 1, marginBottom: Math.round(GAP * 0.4), flexDirection: 'row', padding: 8 }]}>
          {(() => {
            const gg = store.storicoGiornate || [];
            const mNome = mercatoNome.toLowerCase();
            const filtered = gg.filter((g) => (g.mercato || '').toLowerCase() === mNome);
            const currentYear = new Date().getFullYear();
            
            let chartData: number[] = [];
            let chartLabels: string[] = [];
            let chartGiorniPerMese: number[] = []; // n. giorni con lordo>0 per ciascun mese (modalità ANNO)
            let media = 0;
            let totale = 0;
            let giorniCount = 0;
            
            // Dati per confronto anno
            let totaleAnnoCorr = 0;
            let totaleAnnoPrec = 0;
            
            if (chartMode === 'mese') {
              // ═══ 5 barre per le occorrenze del giorno della settimana corrente nel mese ═══
              // Filtra anche per stesso DOW così i totali combaciano con la pagina Statistiche
              const targetDow = dataCorrente.getDay(); // 0=Dom .. 6=Sab (JS native)
              const monthIdx = dataCorrente.getMonth();
              const yearIdx = dataCorrente.getFullYear();
              const daysInMonth = new Date(yearIdx, monthIdx + 1, 0).getDate();
              const occorrenze: number[] = [];
              for (let dn = 1; dn <= daysInMonth; dn++) {
                const dd = new Date(yearIdx, monthIdx, dn);
                if (dd.getDay() === targetDow) occorrenze.push(dn);
              }
              // Pad/limit fino a 5 barre (alcuni mesi hanno 5 occorrenze del DOW)
              const slots = occorrenze.slice(0, 5);
              chartLabels = slots.map((d) => String(d));
              chartData = slots.map((dn) => {
                const target = new Date(yearIdx, monthIdx, dn);
                const match = filtered.find((g) => {
                  const gd = new Date(g.data);
                  return gd.getFullYear() === target.getFullYear()
                      && gd.getMonth() === target.getMonth()
                      && gd.getDate() === target.getDate();
                });
                return match?.lordo || 0;
              });
              giorniCount = chartData.filter((v) => v > 0).length;
              totale = chartData.reduce((s, v) => s + v, 0);
              media = giorniCount > 0 ? totale / giorniCount : 0;
            } else if (chartMode === 'anno') {
              // 12 barre per i mesi
              chartLabels = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
              chartData = Array(12).fill(0);
              chartGiorniPerMese = Array(12).fill(0);
              const yearData = filtered.filter((g) => new Date(g.data).getFullYear() === currentYear);
              yearData.forEach((g) => {
                const m = new Date(g.data).getMonth();
                chartData[m] += g.lordo || 0;
                // Contiamo come "giornata lavorata" se ha incasso > 0
                if ((g.lordo || 0) > 0) chartGiorniPerMese[m] += 1;
              });
              giorniCount = yearData.length;
              totale = chartData.reduce((s, v) => s + v, 0);
              // ─── Round 54 (fix richiesta utente): la media annua era
              // sempre `totale / 12` (mesi fissi), errata in 2 casi:
              //   1. Anno in corso: divide per 12 ma sono trascorsi solo N mesi
              //   2. Mesi totalmente fermi (es. stagionalità) abbassavano la media
              // Adesso dividiamo per il numero di mesi EFFETTIVAMENTE LAVORATI
              // (mesi con almeno una giornata di incasso > 0). Cosi la "media
              // mensile" rappresenta davvero la media tra i mesi in cui si è
              // lavorato → cifra realistica e utile per il forecast.
              const mesiLavorati = chartGiorniPerMese.filter((g) => g > 0).length;
              media = mesiLavorati > 0 ? totale / mesiLavorati : 0;
            } else {
              // ═══ ANNO PREC — Round 67: confronto SINGOLO MERCATO ═══
              // Confronta l'ULTIMO mercato (1 giornata) dello stesso mese +
              // stesso giorno-settimana della data selezionata, anno corrente
              // vs anno precedente. Es: ultimo venerdì di maggio 2026 vs
              // ultimo venerdì di maggio 2025. Se non ancora tenuto → €0.
              const targetDow = dataCorrente.getDay();
              const monthIdx = dataCorrente.getMonth();
              const yearCur = dataCorrente.getFullYear();
              const lastMarketOf = (year: number) => {
                const matches = filtered
                  .filter((g) => {
                    const d = new Date(g.data);
                    return d.getFullYear() === year
                        && d.getMonth() === monthIdx
                        && d.getDay() === targetDow
                        && (g.lordo || 0) > 0;
                  })
                  .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
                return matches[0] || null;
              };
              const prevG = lastMarketOf(yearCur - 1);
              const currG = lastMarketOf(yearCur);
              totaleAnnoPrec = prevG?.lordo || 0;
              totaleAnnoCorr = currG?.lordo || 0;
              const fmtShort = (g: any, year: number) => {
                if (!g) return String(year);
                const d = new Date(g.data);
                return `${d.getDate()}/${d.getMonth() + 1}/${String(year).slice(2)}`;
              };
              chartLabels = [fmtShort(prevG, yearCur - 1), fmtShort(currG, yearCur)];
              chartData = [totaleAnnoPrec, totaleAnnoCorr];
              giorniCount = (prevG ? 1 : 0) + (currG ? 1 : 0);
              // Numero principale = ultimo mercato dell'anno corrente
              totale = totaleAnnoCorr;
              media = 0;
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
                              {typeof chartTooltip.giorni === 'number' && chartTooltip.giorni > 0
                                ? ` · ${chartTooltip.giorni} ${chartTooltip.giorni === 1 ? 'giorno' : 'giorni'}`
                                : ''}
                            </Text>
                          </View>
                        </View>
                      )}
                      {!chartTooltip?.visible && <View style={{ height: 18, marginBottom: 2 }} />}
                      
                      {/* Barre ANIMATE - TOUCHABLE */}
                      <View style={{ height: BAR_AREA_H, flexDirection: 'row', alignItems: 'flex-end' }}>
                        {/* Stato VUOTO: messaggio CTA quando non ci sono ancora dati */}
                        {totale === 0 && giorniCount === 0 && (
                          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                            <Ionicons name="bar-chart-outline" size={20} color="#A8B5B5" />
                            <Text style={{ fontSize: 10, color: '#7A9090', fontWeight: '700', marginTop: 4, textAlign: 'center', paddingHorizontal: 8 }}>
                              Salva la prima giornata{'\n'}per vedere le statistiche
                            </Text>
                          </View>
                        )}
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
                                  setChartTooltip({
                                    visible: true,
                                    label: meseNomi[i],
                                    value: val,
                                    giorni: chartGiorniPerMese[i] || 0,
                                  });
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
                          // Etichetta tooltip = "Giorno N" (es. "Giorno 17")
                          const tipoLabel = `Giorno ${chartLabels[i] || (i + 1)}`;
                          const animH = chartAnimRef.interpolate({
                            inputRange: [0, 1],
                            outputRange: [4, Math.max(hPx, 4)],
                          });
                          return (
                            <TouchableOpacity 
                              key={i} 
                              style={{ flex: 1, alignItems: 'center', height: BAR_AREA_H, justifyContent: 'flex-end', paddingHorizontal: 2 }}
                              activeOpacity={0.7}
                              onPress={() => {
                                hapticTap();
                                if (val > 0) {
                                  setChartTooltip({ visible: true, label: tipoLabel, value: val });
                                  setTimeout(() => setChartTooltip(null), 2500);
                                }
                              }}
                            >
                              <Animated.View style={{
                                width: '100%',
                                maxWidth: 36,
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
              <TouchableOpacity key={k} testID={`chart-mode-${k}`} style={[s.filterBtn, on && s.filterOn]} onPress={() => setChartMode(k as any)}>
                <Text style={[s.filterTxt, on && { color: '#FFF' }]}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ height: GAP }} />

      {/* ═══ SALVA GIORNATA ═══ */}
      <TouchableOpacity testID="home-salva-btn" ref={anchorSalva as any} onPress={handleSalvaManuale} activeOpacity={0.8} style={[s.salva, { height: SALVA_H }]}>
        <Ionicons name="save-outline" size={16} color="#FFF" />
        <Text style={s.salvaTxt}>{t('home.saveDay')}</Text>
      </TouchableOpacity>
      <Text style={{ textAlign: 'center', fontSize: 9, color: '#B0B0A0', marginTop: 2 }}>v4.5</Text>

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

              {/* FIERE prossime 7 giorni */}
              {fiereProssime.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#D4AF37', marginBottom: 6, letterSpacing: 1 }}>FIERE & EVENTI</Text>
                  {fiereProssime.map((f, i) => {
                    const d = new Date(f.data);
                    const isToday = d.toDateString() === dataCorrente.toDateString();
                    const dateLabel = isToday ? t('home.today') : `${d.getDate()}/${d.getMonth() + 1}`;
                    const col = getTipologiaColor(f.tipologia);
                    return (
                      <View key={`fie-${i}`} style={s.modalRow}>
                        <View style={{ backgroundColor: col, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{dateLabel}</Text>
                        </View>
                        <Ionicons name="flag" size={16} color={col} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.modalLabel]} numberOfLines={1}>{f.nome}</Text>
                          {f.luogo ? <Text style={{ fontSize: 9, color: '#7A9090' }} numberOfLines={1}>{f.tipologia} · {f.luogo}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* NOTE DEL DIARIO ±7 giorni — FIX: prima erano contate in
                  notificheCount ma NON renderizzate nel modale, quindi
                  l'utente vedeva il badge ma non il dettaglio. */}
              {diarioRecenti.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#9B59B6', marginBottom: 6, letterSpacing: 1 }}>{t('home.notesDiary') || 'NOTE / DIARIO'}</Text>
                  {diarioRecenti
                    .slice()
                    .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
                    .map((n: any, i: number) => {
                      const d = new Date(n.data);
                      const isToday = d.toDateString() === dataCorrente.toDateString();
                      const dateLabel = isToday ? t('home.today') : `${d.getDate()}/${d.getMonth() + 1}`;
                      const isPast = d.getTime() < dataCorrente.getTime() && !isToday;
                      const badgeBg = isToday ? '#9B59B6' : (isPast ? '#B0A898' : '#7A5BA8');
                      return (
                        <View key={`note-${i}`} style={s.modalRow}>
                          <View style={{ backgroundColor: badgeBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{dateLabel}</Text>
                          </View>
                          <Ionicons name="document-text" size={16} color="#9B59B6" />
                          <Text style={[s.modalLabel, { flex: 1 }]} numberOfLines={3}>{n.testo}</Text>
                          <TouchableOpacity onPress={() => {
                            try { (useAppStore.getState() as any).removeDiario?.(n.data); } catch {}
                          }}>
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
      <Modal visible={showInvendutoModal} transparent animationType="fade" onRequestClose={() => setShowInvendutoModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {/* X di chiusura in alto a destra */}
            <TouchableOpacity
              onPress={() => setShowInvendutoModal(false)}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: 8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="#5A7575" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>{perditaLabel}</Text>
            <Text style={s.modalSub}>
              {isAlimentare
                ? t('home.enterUnsoldQty')
                : t('home.enterLossDetail')}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {tuttiProdotti.length === 0 ? (
                <View>
                  <Text style={s.modalEmpty}>{t('home.noProductRegistered')}</Text>
                  <View style={s.modalDivider} />
                  <Text style={[s.modalSub, { marginBottom: 8 }]}>{t('home.orEnterManually')}</Text>
                  <TextInput
                    style={s.manualInput}
                    placeholder={t('home.amountPlaceholder')}
                    placeholderTextColor="#A0B5A8"
                    keyboardType="numeric"
                    value={invenduto}
                    onChangeText={setInvenduto}
                    textAlign="center"
                  />
                </View>
              ) : isAlimentare ? (
                /* ── ALIMENTARE: qty × COSTO/kg (Round 53bis: usa il costo
                    di acquisto del prodotto, non il prezzo di vendita.
                    Fallback al prezzo per retro-compat con prodotti vecchi
                    privi di costo.) ── */
                tuttiProdotti.map((p, i) => {
                  const key = `${p.fornitore}_${p.nome}`;
                  const qty = parseFloat((invendutoQty[key] || '0').replace(',', '.')) || 0;
                  const costoUnit = (typeof p.costo === 'number' && p.costo > 0) ? p.costo : p.prezzo;
                  const subtot = qty * costoUnit;
                  return (
                    <View key={i} style={s.invProdRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.invProdName}>{p.nome}</Text>
                        <Text style={s.invProdInfo}>{p.fornitore} · costo €{costoUnit}/kg</Text>
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
                      <Text style={s.invSubtot}>{'\u20AC'}{subtot.toFixed(0)}</Text>
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
                        placeholder={t('home.reasonPlaceholder')}
                        placeholderTextColor="#B0B5A8"
                        value={invendutoQty[`${key}_motivo`] || ''}
                        onChangeText={(t) => setInvendutoQty((prev) => ({ ...prev, [`${key}_motivo`]: t }))}
                      />
                      <TextInput
                        style={[s.manualInput, { fontSize: 14, paddingVertical: 8 }]}
                        placeholder={t('home.lossPricePlaceholder')}
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
            {/* Pulsante + per aggiungere voce manuale extra */}
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.modalSub, { flex: 0, marginBottom: 0 }]}>{t('home.manualEntry') || 'Aggiunta manuale:'}</Text>
                <TextInput
                  style={[s.invQtyInput, { flex: 1, textAlign: 'center' }]}
                  placeholder="€"
                  placeholderTextColor="#B0B5A8"
                  keyboardType="numeric"
                  value={invenduto !== '0' && !invendutoCalcolato ? invenduto : ''}
                  onChangeText={(v) => {
                    const manual = parseFloat(v.replace(',', '.')) || 0;
                    setInvenduto(manual > 0 ? manual.toString() : '0');
                  }}
                />
              </View>
            </View>
            {tuttiProdotti.length > 0 && (
              <>
                <View style={s.modalDivider} />
                <View style={s.modalTotalRow}>
                  <Text style={s.modalTotalLabel}>{t('common.total')} {perditaLabel}</Text>
                  <Text style={s.modalTotalVal}>{'\u20AC'}{invendutoCalcolato.toFixed(0)}</Text>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalClose, { flex: 1, backgroundColor: '#B0A898' }]} onPress={() => setShowInvendutoModal(false)}>
                <Text style={s.modalCloseTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalClose, { flex: 1 }]} onPress={confermaInvenduto}>
                <Text style={s.modalCloseTxt}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODALE SPESE FISSE ═══ */}
      <Modal visible={showSpeseFisseModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{t('home.dailyFixedExpenses')}</Text>
            <Text style={s.modalSub}>{t('home.disableExpensesHint')}</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {speseFisseOggi.length === 0 ? (
                <Text style={s.modalEmpty}>{t('home.noFixedExpenses')}</Text>
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
                <Text style={s.modalLabel}>{t('home.fairStandFee')}</Text>
                <Text style={s.modalVal}>{'\u20AC'}{fieraPlatNum.toFixed(0)}</Text>
              </View>
            )}
            <View style={s.modalDivider} />
            <View style={s.modalTotalRow}>
              <Text style={s.modalTotalLabel}>{t('home.totalActive')}</Text>
              <Text style={s.modalTotalVal}>{'\u20AC'}{speseFisseTotali.toFixed(0)}</Text>
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
        title={t('home.selectDate')}
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
        speseExtra={speseExtraGenTotale}
        excludeSpeseExtra={excludeSpeseExtra}
        toggleExcludeSpeseExtra={() => setExcludeSpeseExtra(!excludeSpeseExtra)}
        fornitoriDaily={speseExtraFornTotale}
        excludeFornitori={excludeFornitori}
        toggleExcludeFornitori={() => setExcludeFornitori(!excludeFornitori)}
        fornitoriWeekly={speseExtraFornWeekly}
        fornitoriMonthly={speseExtraFornMonthly}
        fornitoriCustom={speseExtraFornCustom}
        fornitoriCustomTodayQuota={costoMerceRipartitoOggi}
        invenduto={parseFloat(invenduto.replace(',', '.')) || 0}
        excludeInvenduto={excludeInvenduto}
        toggleExcludeInvenduto={() => setExcludeInvenduto(!excludeInvenduto)}
        utile={utile}
        lordo={lordoNum}
        storicoGiornate={store.storicoGiornate || []}
        dataCorrente={dataCorrente}
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
        fornInfo={fornInfo}
        setFornInfo={setFornInfo}
        pagamentoMode={pagamentoMode}
        setPagamentoMode={setPagamentoMode}
        fornDeductionType={fornDeductionType}
        setFornDeductionType={setFornDeductionTypeWrapped}
        fornDeductionStartDate={fornDeductionStartDate}
        setFornDeductionStartDate={setFornDeductionStartDateWrapped}
        fornDeductionDays={fornDeductionDays}
        setFornDeductionDays={setFornDeductionDaysWrapped}
        weeklyTotalsByForn={weeklyTotalsByForn}
        lordoOggi={lordoNum}
        dataCorrente={dataCorrente}
      />

      {/* Buongiorno AI Modal */}
      <BuongiornoModal
        visible={showBuongiorno}
        onClose={() => setShowBuongiorno(false)}
        storeData={{
          nomeAttivita: store.nomeAttivita || 'La mia attivita',
          nomeTitolare: store.nomeTitolare || 'Titolare',
          settore: store.settore || 'Alimentare',
          meteoOggi: meteo,
          mercatoOggi: mercatoNome,
          selectedDate: `${dataCorrente.getFullYear()}-${String(dataCorrente.getMonth() + 1).padStart(2, '0')}-${String(dataCorrente.getDate()).padStart(2, '0')}`,
          // ═══ ROUND 46: BILANCIO REALISTICO GLOBALE DEL GIORNO ═══
          // Numeri pronti per l'AI: lordo - tutte le spese del giorno = utile reale
          // L'AI userà questi dati per dare un riepilogo finanziario chiaro
          // all'utente nel saluto iniziale ("hai incassato X, speso Y, utile Z").
          bilancioOggi: {
            lordo: Math.round(lordoNum),
            speseFisseProrata: Math.round(speseFisseTotali),
            costoCollaboratoriOggi: Math.round(costoCollabAttivi),
            speseExtraOggi: Math.round(speseExtraGenTotale),
            fornitoriDailyOggi: Math.round(speseExtraFornTotale),
            fornitoriCustomOggi: Math.round(speseExtraFornCustom),
            invendutoOggi: Math.round(parseFloat(invenduto.replace(',', '.')) || 0),
            totSpeseOggi: Math.round(
              speseFisseTotali + costoCollabAttivi + speseExtraGenTotale +
              speseExtraFornTotale + speseExtraFornCustom + (parseFloat(invenduto.replace(',', '.')) || 0)
            ),
            utileRealisticoOggi: Math.round(
              lordoNum - speseFisseTotali - costoCollabAttivi - speseExtraGenTotale
              - speseExtraFornTotale - speseExtraFornCustom - (parseFloat(invenduto.replace(',', '.')) || 0)
            ),
          },
          // ═══ INVENDUTO ULTIMA OCCORRENZA STESSO MERCATO/GIORNO ═══
          invendutoMedesimoMercato: (() => {
            const now = new Date(dataCorrente);
            const dow = now.getDay();
            // cerca l'ULTIMA giornata con stesso mercato (o stesso giorno settimana se mercatoNome vuoto)
            const candidates = (store.storicoGiornate || []).filter((g) => {
              const d = new Date(g.data);
              if (d >= now) return false;
              const sameMkt = mercatoNome && g.mercato === mercatoNome;
              const sameDow = !mercatoNome && d.getDay() === dow;
              return sameMkt || sameDow;
            }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
            const ultimo = candidates[0];
            if (!ultimo) return null;
            const inv = (ultimo as any).dettaglio_invenduto?.totale || 0;
            const giorniIt = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
            const dUlt = new Date(ultimo.data);
            return {
              data: ultimo.data,
              giornoSett: giorniIt[dUlt.getDay()],
              mercato: ultimo.mercato,
              invenduto: Math.round(inv),
              giorniFa: Math.round((now.getTime() - dUlt.getTime()) / (1000 * 60 * 60 * 24)),
            };
          })(),
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
          // ═══ Settimana corrente (da lunedì ad oggi) e confronto ═══
          settimanaCorrente: (() => {
            const now = new Date(dataCorrente);
            const dow = (now.getDay() + 6) % 7; // lun=0
            const lunedi = new Date(now); lunedi.setDate(now.getDate() - dow); lunedi.setHours(0,0,0,0);
            const curr = (store.storicoGiornate || []).filter((g) => {
              const d = new Date(g.data);
              return d >= lunedi && d <= now;
            });
            return {
              lordo: Math.round(curr.reduce((s, g) => s + (g.lordo || 0), 0)),
              netto: Math.round(curr.reduce((s, g) => s + (g.netto || 0), 0)),
              giorni: curr.length,
              mercati: Array.from(new Set(curr.map((g) => g.mercato).filter(Boolean))),
            };
          })(),
          confrontoSettimana: (() => {
            const now = new Date(dataCorrente);
            const dow = (now.getDay() + 6) % 7;
            const lunediCorr = new Date(now); lunediCorr.setDate(now.getDate() - dow); lunediCorr.setHours(0,0,0,0);
            const lunediPrec = new Date(lunediCorr); lunediPrec.setDate(lunediPrec.getDate() - 7);
            const currLordo = (store.storicoGiornate || [])
              .filter((g) => { const d = new Date(g.data); return d >= lunediCorr && d <= now; })
              .reduce((s, g) => s + (g.lordo || 0), 0);
            const prevLordo = (store.storicoGiornate || [])
              .filter((g) => { const d = new Date(g.data); return d >= lunediPrec && d < lunediCorr; })
              .reduce((s, g) => s + (g.lordo || 0), 0);
            const diff = Math.round(currLordo - prevLordo);
            const pct = prevLordo > 0 ? Math.round(((currLordo - prevLordo) / prevLordo) * 100) : 0;
            return { correnteLordo: Math.round(currLordo), precedenteLordo: Math.round(prevLordo), differenza: diff, variazionePercentuale: pct };
          })(),
          // ═══ Top 3 mercati + Top 3 fornitori + Ultimo mese ═══
          topMercati: (() => {
            const now = new Date(dataCorrente);
            const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
            const byMkt: Record<string, { lordo: number; giorni: number }> = {};
            (store.storicoGiornate || []).forEach((g) => {
              const d = new Date(g.data);
              if (d < monthAgo || d > now) return;
              if (!g.mercato) return;
              if (!byMkt[g.mercato]) byMkt[g.mercato] = { lordo: 0, giorni: 0 };
              byMkt[g.mercato].lordo += g.lordo || 0;
              byMkt[g.mercato].giorni += 1;
            });
            return Object.entries(byMkt)
              .map(([nome, v]) => ({ nome, lordo: Math.round(v.lordo), giorni: v.giorni }))
              .sort((a, b) => b.lordo - a.lordo).slice(0, 3);
          })(),
          topFornitori: (() => {
            const now = new Date(dataCorrente);
            const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
            const byForn: Record<string, number> = {};
            (store.storicoGiornate || []).forEach((g) => {
              const d = new Date(g.data);
              if (d < monthAgo || d > now) return;
              Object.entries(g.dettaglio_fornitori || {}).forEach(([n, v]) => {
                byForn[n] = (byForn[n] || 0) + (typeof v === 'number' ? v : 0);
              });
            });
            return Object.entries(byForn)
              .map(([nome, totale]) => ({ nome, totale: Math.round(totale) }))
              .sort((a, b) => b.totale - a.totale).slice(0, 3);
          })(),
          ultimoMese: (() => {
            const now = new Date(dataCorrente);
            const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
            const data = (store.storicoGiornate || []).filter((g) => { const d = new Date(g.data); return d >= monthAgo && d <= now; });
            return {
              lordo: Math.round(data.reduce((s, g) => s + (g.lordo || 0), 0)),
              netto: Math.round(data.reduce((s, g) => s + (g.netto || 0), 0)),
              giorni: data.length,
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
          /* Round 69 — Lista mercati attivi: tutte le città uniche presenti
             in agenda settimanale + fiere ricorrenti + partenzaDa. Inviata
             al backend per dedurre la provincia/regione SENZA richiedere
             una configurazione manuale all'utente. */
          mercatiAttivi: (() => {
            const set = new Set<string>();
            (store.agenda || []).forEach((a: any) => {
              const m = (a?.mercato || '').trim();
              if (m && a?.lavorativo !== false) set.add(m);
            });
            (store.fiere || []).forEach((f: any) => {
              const lu = (f?.luogo || '').trim();
              if (lu) set.add(lu);
            });
            const pd = (store.partenzaDa || '').trim();
            if (pd) set.add(pd);
            return Array.from(set);
          })(),
          // ── Prossimi 7 giorni: fiere, appuntamenti, ordini ──
          fiereProssime: (fiereProssime || []).map((f: any) => ({
            data: new Date(f.data).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }),
            nome: f.nome,
            luogo: f.luogo || '',
          })),
          appuntiProssimi: (appuntiProssimi || []).map((a: any) => ({
            data: new Date(a.data).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }),
            testo: a.testo || a.titolo || '',
            luogo: a.luogo || '',
          })),
          ordiniProssimi: (ordiniProssimi || []).map((o: any) => ({
            data: new Date(o.data).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }),
            testo: o.testo || o.fornitore || o.titolo || '',
            luogo: o.luogo || '',
          })),
          pagamentiImminenti: pagamentiImminenti,
          noteOggi: (() => {
            try {
              const today = new Date();
              const entry = (store.storicoDiario || []).find((d: any) => new Date(d.data).toDateString() === today.toDateString());
              return entry?.testo || '';
            } catch { return ''; }
          })(),
          // ═══ DUMP COMPLETO TUTTI I DATI APP per chat libera AI ═══
          fullContextDump: (() => {
            try {
              const fmtDate = (d: any) => {
                try { return new Date(d).toISOString().split('T')[0]; } catch { return String(d); }
              };
              const lines: string[] = [];

              // STORICO GIORNATE — TUTTE
              const sg = (store.storicoGiornate || []).slice().sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
              if (sg.length > 0) {
                lines.push(`STORICO_GIORNATE (${sg.length} giornate, ordinato dal più recente):`);
                sg.forEach((g: any) => {
                  const det = g.dettaglio_fornitori || {};
                  const ded = g.dettaglio_fornitori_deduction || {};
                  const fornEntries = Object.entries(det).filter(([k, v]: any) => !k.endsWith('__fattn') && !k.endsWith('__liberaLabel') && (typeof v === 'number' ? v > 0 : false));
                  const fornStr = fornEntries.length > 0
                    ? fornEntries.map(([k, v]: any) => {
                        const nomeBase = k.endsWith('__libera') ? k.slice(0, -'__libera'.length) : k;
                        const tipo = k.endsWith('__libera') ? 'contanti' : 'fattura';
                        const dt = ded[nomeBase] || 'DAILY';
                        return `${nomeBase}(${tipo},${dt}):€${v}`;
                      }).join('; ')
                    : '-';
                  const extraStr = g.dettaglio_spese_extra
                    ? Object.entries(g.dettaglio_spese_extra).filter(([_, v]: any) => v > 0).map(([k, v]: any) => `${k}:€${v}`).join('; ')
                    : '-';
                  const inv = g.dettaglio_invenduto?.totale || 0;
                  lines.push(
                    `  ${fmtDate(g.data)}|${g.mercato || '-'}|lordo:€${g.lordo || 0}|netto:€${g.netto || 0}|cash:€${g.contanti || 0}|pos:€${g.pos || 0}|fornitori:[${fornStr}]|extra:[${extraStr}]|invenduto:€${inv}`
                  );
                });
              }

              // ORDINI AGENDA — TUTTI
              const ord = store.ordiniAgenda || [];
              if (ord.length > 0) {
                lines.push(`\nORDINI_AGENDA (${ord.length}):`);
                ord.slice().sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime()).forEach((o: any) => {
                  lines.push(`  ${fmtDate(o.data)}|${o.fornitore || ''}|${o.testo || o.titolo || ''}${o.luogo ? '|@' + o.luogo : ''}`);
                });
              }

              // APPUNTI AGENDA — TUTTI
              const app = store.appuntiAgenda || [];
              if (app.length > 0) {
                lines.push(`\nAPPUNTI_AGENDA (${app.length}):`);
                app.slice().sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime()).forEach((a: any) => {
                  lines.push(`  ${fmtDate(a.data)}|${a.testo || a.titolo || ''}${a.luogo ? '|@' + a.luogo : ''}`);
                });
              }

              // STORICO DIARIO — TUTTI
              const dia = store.storicoDiario || [];
              if (dia.length > 0) {
                lines.push(`\nSTORICO_DIARIO_NOTE (${dia.length} note):`);
                dia.slice().sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime()).forEach((d: any) => {
                  if (d.testo) lines.push(`  ${fmtDate(d.data)}|${d.testo}`);
                });
              }

              // SPESE ANNUE
              const sa = store.speseAnnue || [];
              if (sa.length > 0) {
                lines.push(`\nSPESE_ANNUE (fisse):`);
                sa.forEach((sp: any) => lines.push(`  ${sp.voce}: €${sp.importo}/anno`));
              }

              // FIERE
              const fi = store.fiere || [];
              if (fi.length > 0) {
                lines.push(`\nFIERE (${fi.length}):`);
                fi.forEach((f: any) => lines.push(`  ${fmtDate(f.data)}|${f.nome}${f.luogo ? '|@' + f.luogo : ''}${f.fineData ? '|→' + fmtDate(f.fineData) : ''}`));
              }

              // STORICO CARBURANTE
              const sc = store.storicoCarburante || [];
              if (sc.length > 0) {
                lines.push(`\nSTORICO_CARBURANTE (${sc.length} rifornimenti):`);
                sc.slice(-30).forEach((c: any) => lines.push(`  ${fmtDate(c.data)}|€${c.euro}|${c.litri || '?'}L${c.km ? '|km:' + c.km : ''}`));
              }

              // FORNITORI configurati
              const fr = store.fornitori || [];
              if (fr.length > 0) {
                lines.push(`\nFORNITORI_CONFIGURATI (${fr.length}):`);
                fr.forEach((f: any) => {
                  const prods = (f.prodotti || []).slice(0, 5).map((p: any) => `${p.nome}€${p.prezzo}`).join(',');
                  lines.push(`  ${f.nome}${prods ? '|prodotti:' + prods : ''}`);
                });
              }

              // COLLABORATORI configurati
              const cl = store.collaboratori || [];
              if (cl.length > 0) {
                lines.push(`\nCOLLABORATORI_CONFIGURATI (${cl.length}):`);
                cl.forEach((c: any) => lines.push(`  ${c.nome}${c.percentuale ? '|%' + c.percentuale : ''}${c.costoGiornaliero ? '|€' + c.costoGiornaliero + '/gg' : ''}`));
              }

              // AGENDA SETTIMANALE (mercati per giorno)
              const ag = store.agenda || [];
              if (ag.length > 0) {
                lines.push(`\nAGENDA_SETTIMANALE:`);
                ag.forEach((a: any) => {
                  if (a.attivo && a.mercato) lines.push(`  ${a.giorno}|${a.mercato}|km:${a.km || 0}|plateatico:€${a.plateatico || 0}/anno`);
                });
              }

              return lines.join('\n');
            } catch (e) {
              return '';
            }
          })(),
        }}
      />
      {/* ═══ MODALE COSTO COLLABORATORE (long-press) ═══ */}
      <Modal visible={showCostModal !== null} transparent animationType="fade" onRequestClose={() => setShowCostModal(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowCostModal(null)}>
          <View style={{ backgroundColor: '#F5F0E6', borderRadius: 20, padding: 24, width: '80%', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A4040', marginBottom: 4 }}>{showCostModal?.toUpperCase()}</Text>
            <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 16 }}>Costo solo per oggi</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, width: '100%', gap: 8 }}>
              <Ionicons name="cash-outline" size={18} color="#1E7F85" />
              <TextInput
                style={{ flex: 1, fontSize: 20, fontWeight: '800', color: '#1A4040', textAlign: 'center' }}
                value={tempCost}
                onChangeText={setTempCost}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#C0B5A5"
                autoFocus
              />
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E7F85' }}>€</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#E0DDD0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  setCostiOverride(prev => { const n = { ...prev }; delete n[showCostModal!]; return n; });
                  setShowCostModal(null);
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#7A7A6A' }}>RESET</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1E7F85', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  const val = parseFloat(tempCost.replace(',', '.')) || 0;
                  setCostiOverride(prev => ({ ...prev, [showCostModal!]: val }));
                  setShowCostModal(null);
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>CONFERMA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    color: '#1E7F85',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 3,
    minHeight: 17,
  },
  marketName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.2,
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
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(155,145,125,0.55), -5px -5px 12px rgba(255,255,250,0.9)',
  },
  toggleOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(15,55,60,0.6), -4px -4px 10px rgba(45,120,125,0.35)',
  },
  toggleTxt: { fontSize: 11, fontWeight: '900', color: '#4A3A2A', textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  piazzaBtn: {
    backgroundColor: '#1E7F85',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
