import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';
import { getDayMarker, resolveRegion } from '../../src/utils/italianCalendar';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI_SETT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export default function AgendaScreen() {
  const { t } = useTranslation();
  const {
    appuntiAgenda, addAppunto, removeAppunto,
    ordiniAgenda, addOrdine, removeOrdine,
    storicoDiario, addDiario, removeDiario, getDiarioForDate,
  } = useAppStore();
  const store = useAppStore();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const TAB_BAR = 70 + Math.max(insets.bottom, 10) + 40;
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 4 : insets.top + 4;
  const contentH = screenH - TAB_BAR - topPad;

  // ═══ ORDINI E APPUNTAMENTI ═══
  const [orderText, setOrderText] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  
  // ═══ MODAL GIORNO (edit/delete) ═══
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalText, setDayModalText] = useState('');
  const [dayModalType, setDayModalType] = useState<'new' | 'edit' | 'fiera'>('new');

  // ═══ MODAL EDIT NOTA (apre quando clicchi una nota nell'archivio) ═══
  // Su mobile lo scroll-to-top non era abbastanza chiaro, quindi mostriamo
  // un modal centrato con textarea precompilato + bottoni Salva/Annulla.
  const [editNoteModal, setEditNoteModal] = useState<{ visible: boolean; data: string; testo: string }>({
    visible: false, data: '', testo: ''
  });

  // ═══ NOTE DEL GIORNO ═══
  const [noteText, setNoteText] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'note' | 'fiere' | 'fatture'>('note');
  // Round 78 BIS — UI Fatture organizzata in cartelle Fornitore → Mese
  const [expandedFornitori, setExpandedFornitori] = useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Carica nota di oggi
  React.useEffect(() => {
    const today = new Date();
    const existing = getDiarioForDate(today);
    setNoteText(existing ? existing.testo : '');
  }, []);

  /* ═══ ORDINI + APPUNTAMENTI + FIERE DEL MESE ═══ */
  const impegniMese = useMemo(() => {
    const map: { [day: number]: { testo: string; tipo: string; tipologia?: string; luogo?: string; km?: number; plateatico?: number; fieraId?: string }[] } = {};
    (appuntiAgenda || []).forEach(a => {
      const d = new Date(a.data);
      if (d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ testo: a.testo, tipo: 'appuntamento' });
      }
    });
    (ordiniAgenda || []).forEach(o => {
      const d = new Date(o.data);
      if (d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ testo: o.testo, tipo: 'ordine' });
      }
    });
    // Aggiungi le fiere del mese (ricorrenti + date specifiche)
    const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
      const dow = (date.getDay() + 6) % 7;
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      (store.fiere || []).forEach((f: any) => {
        if (!f.attiva) return;
        const match = f.giorni?.includes(dow) || (f.dateSpecifiche || []).includes(iso);
        if (match) {
          if (!map[d]) map[d] = [];
          // Evita duplicati se la fiera è già stata aggiunta per questo giorno
          if (!map[d].some((x) => x.testo === f.nome && x.tipo === 'fiera')) {
            map[d].push({
              testo: f.nome,
              tipo: 'fiera',
              tipologia: f.tipologia || 'Fiera',
              luogo: f.luogo || '',
              km: f.km || 0,
              plateatico: f.plateatico || 0,
              fieraId: f.id,
            });
          }
        }
      });
    }
    return map;
  }, [appuntiAgenda, ordiniAgenda, calMonth, store.fiere]);

  /* ═══ COLORE PER TIPOLOGIA EVENTO ═══ */
  const getTipologiaColor = (tipologia?: string) => {
    switch (tipologia) {
      case 'Sagra': return '#9B59B6';
      case 'Festa Patronale': return '#C0392B';
      case 'Evento Speciale': return '#16A085';
      case 'Fiera':
      default: return '#D4AF37';
    }
  };

  /* ═══ LISTA FIERE DEL MESE ═══ */
  const fiereDelMese = useMemo(() => {
    const arr: { giorno: number; nome: string; luogo: string; tipologia: string; km: number; plateatico: number }[] = [];
    const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
      const dow = (date.getDay() + 6) % 7;
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      (store.fiere || []).forEach((f: any) => {
        if (!f.attiva) return;
        const match = f.giorni?.includes(dow) || (f.dateSpecifiche || []).includes(iso);
        if (match) {
          arr.push({
            giorno: d,
            nome: f.nome,
            luogo: f.luogo || '',
            tipologia: f.tipologia || 'Fiera',
            km: f.km || 0,
            plateatico: f.plateatico || 0,
          });
        }
      });
    }
    return arr.sort((a, b) => a.giorno - b.giorno);
  }, [store.fiere, calMonth]);

  /* ═══ CALENDARIO GRID ═══ */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [calMonth]);

  /* ═══ ARCHIVIO NOTE ═══
     Single source: unisce appuntiAgenda (note dei giorni) + storicoDiario.
     storicoDiario è un Array<DiarioEntry> nel modello. Defensive: se per
     errore arriva come Object (es. da vecchi sync), lo convertiamo. */
  const noteArchive = useMemo(() => {
    const fromAppunti = (appuntiAgenda || []).map((a: any) => ({ data: new Date(a.data), testo: a.testo, src: 'appunto' }));
    let diarioList: any[] = [];
    if (Array.isArray(storicoDiario)) {
      diarioList = storicoDiario;
    } else if (storicoDiario && typeof storicoDiario === 'object') {
      // Legacy: storicoDiario poteva essere { dataKey: testo }
      diarioList = Object.entries(storicoDiario).map(([dataKey, value]: [string, any]) => ({
        data: dataKey,
        testo: typeof value === 'string' ? value : (value?.testo || '')
      }));
    }
    const fromDiario = diarioList
      .map((d: any) => ({ data: new Date(d.data), testo: d.testo, src: 'diario' }))
      .filter((n) => !isNaN(n.data.getTime()));
    /* Round 72 — Includi anche le FATTURE nel NOTE archive
       con data = dataInserimento (timestamp reale di inserimento) */
    const fromFatture = ((store as any).fattureLog || [])
      .map((f: any) => {
        const dataIns = f.dataInserimento ? new Date(f.dataInserimento) : null;
        if (!dataIns || isNaN(dataIns.getTime())) return null;
        const imp = Number(f.importo) || 0;
        const periodoTxt = f.periodoFrom && f.periodoTo && f.periodoFrom !== f.periodoTo
          ? ` · periodo ${f.periodoFrom.slice(8,10)}/${f.periodoFrom.slice(5,7)}/${f.periodoFrom.slice(0,4)} → ${f.periodoTo.slice(8,10)}/${f.periodoTo.slice(5,7)}/${f.periodoTo.slice(0,4)}`
          : '';
        const numTxt = String(f.numeroFattura || '').startsWith('_auto_') ? '(senza n°)' : `Fatt. ${f.numeroFattura}`;
        const dataEmTxt = f.dataEmissione ? ` · emessa ${f.dataEmissione.slice(8,10)}/${f.dataEmissione.slice(5,7)}/${f.dataEmissione.slice(0,4)}` : '';
        return {
          data: dataIns,
          testo: `📄 ${f.fornitore} • ${numTxt}${imp > 0 ? ` • €${imp.toFixed(0)}` : ''}${dataEmTxt}${periodoTxt}`,
          src: 'fattura',
        };
      })
      .filter(Boolean);
    return [...fromAppunti, ...fromDiario, ...fromFatture]
      .filter((n: any) => n.testo && n.testo.trim() !== '')
      .sort((a: any, b: any) => b.data.getTime() - a.data.getTime())
      .slice(0, 50);
  }, [storicoDiario, appuntiAgenda, (store as any).fattureLog]);

  /* ═══ ARCHIVIO FIERE (prossime + ricorrenti attive) ═══ */
  const fiereArchive = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const arr: { id: string; nome: string; luogo: string; tipologia: string; next?: Date; ricorrente?: boolean }[] = [];
    (store.fiere || []).forEach((f: any) => {
      if (!f.attiva) return;
      // Calcola la prossima data utile (dateSpecifiche + ricorrenti nei prossimi 90 giorni)
      const datesSpec = (f.dateSpecifiche || [])
        .map((iso: string) => new Date(iso + 'T12:00:00'))
        .filter((d: Date) => !isNaN(d.getTime()) && d >= now);
      let nextDate: Date | undefined = datesSpec.sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];

      // Se ha giorni ricorrenti, trova il prossimo tra 7 giorni
      if ((f.giorni || []).length > 0) {
        for (let i = 0; i < 90; i++) {
          const cur = new Date(now);
          cur.setDate(cur.getDate() + i);
          const dow = (cur.getDay() + 6) % 7;
          if (f.giorni.includes(dow)) {
            if (!nextDate || cur < nextDate) nextDate = cur;
            break;
          }
        }
      }
      arr.push({
        id: f.id,
        nome: f.nome,
        luogo: f.luogo || '',
        tipologia: f.tipologia || 'Fiera',
        next: nextDate,
        ricorrente: (f.giorni || []).length > 0,
      });
    });
    return arr.sort((a, b) => (a.next?.getTime() || Infinity) - (b.next?.getTime() || Infinity));
  }, [store.fiere]);

  /* ═══ Round 72 — ARCHIVIO FATTURE ═══
     Fonte PRIMARIA: `fattureLog` (immutabile, conserva TUTTI gli inserimenti).
     Fonti legacy aggiunte solo se non già coperte da fattureLog (per
     retrocompatibilità con utenti che hanno dati storici pre-Round 72). */
  const fattureArchive = useMemo(() => {
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const items: { id: string; data: Date; dataInserimento?: Date; fornitore: string; numero: string; importo: string; scadenza: string; overdue: boolean; testo: string; source: 'log' | 'historic' | 'session' | 'agenda'; periodoFrom?: string; periodoTo?: string }[] = [];
    const seen = new Set<string>();
    const seenLogKey = new Set<string>(); // (fornitore_lower|numero_lower) per dedup legacy

    // 0. FATTURE LOG (Round 72) — fonte PRIMARIA, immutabile
    const log = ((store as any).fattureLog || []) as any[];
    log.forEach((ft) => {
      const dd = new Date((ft.dataEmissione || '') + 'T12:00:00');
      if (isNaN(dd.getTime())) return;
      const scad = ft.scadenza ? new Date(ft.scadenza + 'T12:00:00') : null;
      const importoNum = Number(ft.importo) || 0;
      const dataIns = ft.dataInserimento ? new Date(ft.dataInserimento) : undefined;
      const key = `log_${ft.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      seenLogKey.add(`${(ft.fornitore || '').toLowerCase()}|${(ft.numeroFattura || '').toLowerCase()}`);
      items.push({
        id: key,
        data: dd,
        dataInserimento: dataIns,
        fornitore: ft.fornitore,
        numero: ft.numeroFattura,
        importo: String(importoNum),
        scadenza: ft.scadenza || '',
        overdue: scad ? scad < today0 : false,
        testo: `${ft.fornitore} • Fatt. ${ft.numeroFattura}${importoNum > 0 ? ` • €${importoNum.toFixed(0)}` : ''}`,
        source: 'log',
        periodoFrom: ft.periodoFrom,
        periodoTo: ft.periodoTo,
      });
    });

    // 1. Fatture archiviate nelle giornate salvate (LEGACY — solo se non già nel log)
    (store.storicoGiornate || []).forEach((g: any) => {
      const info = g.fornitoriInfo || {};
      const dettaglio = g.dettaglio_fornitori || {};
      Object.entries(info).forEach(([forn, fInfo]: [string, any]) => {
        if (!fInfo?.numeroFattura) return;
        const logKey = `${(forn || '').toLowerCase()}|${(fInfo.numeroFattura || '').toLowerCase()}`;
        if (seenLogKey.has(logKey)) return; // già nel log
        // Importo: preferisci la fattura, altrimenti contanti, altrimenti 0
        const impFatt = Math.abs(dettaglio[forn] || 0);
        const impCash = Math.abs(dettaglio[`${forn}__libera`] || 0);
        let importoNum = impFatt > 0 ? impFatt : impCash;
        const dd = new Date(g.data);
        if (importoNum === 0) {
          try {
            const dayIso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
            const spMatch = ((store as any).spesePeriodiche || []).find((sp: any) =>
              sp.nome === forn && (sp.dayOfPurchase || sp.from) === dayIso
            );
            if (spMatch) importoNum = Number(spMatch.importo) || 0;
          } catch { /* skip */ }
        }
        const key = `${dd.toISOString().slice(0,10)}_${forn}_${fInfo.numeroFattura}`;
        if (seen.has(key)) return;
        seen.add(key);
        const scad = fInfo.scadenza ? new Date(fInfo.scadenza) : null;
        items.push({
          id: key,
          data: dd,
          fornitore: forn,
          numero: fInfo.numeroFattura,
          importo: String(importoNum),
          scadenza: fInfo.scadenza || '',
          overdue: scad ? scad < today0 : false,
          testo: `${forn} • Fatt. ${fInfo.numeroFattura}${importoNum > 0 ? ` • €${importoNum.toFixed(0)}` : ''}`,
          source: 'historic',
        });
      });
    });

    // 2. Fatture in corso (sessione attiva non ancora salvata)
    const session = (store as any).speseExtraSession;
    if (session?.fornInfo) {
      Object.entries(session.fornInfo).forEach(([forn, fInfo]: [string, any]) => {
        if (!fInfo?.numeroFattura) return;
        const sessionEntries = session.speseExtraFornitore || {};
        const impFatt = parseFloat((sessionEntries[forn]?.importo || '0').replace(',', '.')) || 0;
        const impCash = parseFloat((sessionEntries[`${forn}__libera`]?.importo || '0').replace(',', '.')) || 0;
        const importoNum = impFatt > 0 ? impFatt : impCash;
        const dd = new Date();
        const key = `session_${forn}_${fInfo.numeroFattura}`;
        if (seen.has(key)) return;
        seen.add(key);
        const scad = fInfo.scadenza ? new Date(fInfo.scadenza) : null;
        items.push({
          id: key,
          data: dd,
          fornitore: forn,
          numero: fInfo.numeroFattura,
          importo: String(importoNum),
          scadenza: fInfo.scadenza || '',
          overdue: scad ? scad < today0 : false,
          testo: `${forn} • Fatt. ${fInfo.numeroFattura}${importoNum > 0 ? ` • €${importoNum.toFixed(0)}` : ''}`,
          source: 'session',
        });
      });
    }

    // 3. Vecchio formato: fatture estratte da ordiniAgenda con regex
    const SEP = '(?:\\s*[–—\\-•:]\\s*|,\\s*)';
    const reFull = new RegExp('^(.+?)' + SEP + 'Fatt\\.?\\s+([^\\s–—\\-•:]+)' + SEP + '€?\\s*([\\d.,]+)', 'i');
    (ordiniAgenda || []).forEach((o: any) => {
      const txt = String(o.testo || '').trim();
      if (!txt) return;
      const mFull = txt.match(reFull);
      if (!mFull) return;
      const fornitore = mFull[1].trim();
      const numero = mFull[2];
      const importoRaw = mFull[3].replace(/\./g, '').replace(',', '.');
      const importoNum = parseFloat(importoRaw);
      if (!isFinite(importoNum) || importoNum <= 0) return;
      const dd = new Date(o.data);
      if (isNaN(dd.getTime())) return;
      const key = `agenda_${dd.toISOString().slice(0,10)}_${fornitore}_${numero}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        id: key,
        data: dd,
        fornitore,
        numero,
        importo: String(importoNum),
        scadenza: '',
        overdue: dd < today0,
        testo: txt,
        source: 'agenda',
      });
    });
    return items.sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [store.storicoGiornate, (store as any).speseExtraSession, ordiniAgenda, (store as any).spesePeriodiche, (store as any).fattureLog]);

  /* ═══ Round 78 BIS — Raggruppa fatture per Fornitore → Mese ═══
     Struttura risultante:
       {
         "Andrea Pane": {
           total: 1234,
           count: 5,
           months: {
             "2026-06": { label: "Giugno 2026", total: 500, items: [...] },
             "2026-05": { label: "Maggio 2026", total: 734, items: [...] },
           }
         }
       }
     Mesi e fornitori ordinati per recency (più recenti in cima). */
  const fattureGrouped = useMemo(() => {
    const MESI_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    type Item = (typeof fattureArchive)[number];
    type MonthBucket = { key: string; label: string; total: number; items: Item[]; lastDate: number };
    type FornBucket = { nome: string; total: number; count: number; months: Record<string, MonthBucket>; lastDate: number };
    const acc: Record<string, FornBucket> = {};
    fattureArchive.forEach((ft) => {
      const fName = (ft.fornitore || 'Altro').trim() || 'Altro';
      const mKey = `${ft.data.getFullYear()}-${String(ft.data.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = `${MESI_FULL[ft.data.getMonth()]} ${ft.data.getFullYear()}`;
      if (!acc[fName]) acc[fName] = { nome: fName, total: 0, count: 0, months: {}, lastDate: 0 };
      const f = acc[fName];
      if (!f.months[mKey]) f.months[mKey] = { key: mKey, label: mLabel, total: 0, items: [], lastDate: 0 };
      const m = f.months[mKey];
      const imp = parseFloat(ft.importo) || 0;
      f.total += imp;
      f.count += 1;
      f.lastDate = Math.max(f.lastDate, ft.data.getTime());
      m.total += imp;
      m.items.push(ft);
      m.lastDate = Math.max(m.lastDate, ft.data.getTime());
    });
    // Ordina mesi e fornitori per data (più recente in cima)
    const fornitori = Object.values(acc).sort((a, b) => b.lastDate - a.lastDate);
    fornitori.forEach((f) => {
      f.months = Object.fromEntries(
        Object.values(f.months)
          .sort((a, b) => b.lastDate - a.lastDate)
          .map((m) => {
            m.items.sort((a, b) => b.data.getTime() - a.data.getTime());
            return [m.key, m];
          })
      );
    });
    return fornitori;
  }, [fattureArchive]);

  /* ═══ Combina impegniMese con le fatture (definito DOPO fattureArchive per evitare TDZ) ═══ */
  const impegniMeseFinal = useMemo(() => {
    const map: typeof impegniMese = JSON.parse(JSON.stringify(impegniMese));
    fattureArchive.forEach((ft) => {
      const datesToMark: Date[] = [ft.data];
      if (ft.scadenza) {
        const sc = new Date(ft.scadenza);
        if (!isNaN(sc.getTime()) && sc.toDateString() !== ft.data.toDateString()) datesToMark.push(sc);
      }
      datesToMark.forEach((dd) => {
        if (dd.getMonth() === calMonth.getMonth() && dd.getFullYear() === calMonth.getFullYear()) {
          const day = dd.getDate();
          if (!map[day]) map[day] = [];
          if (!map[day].some((x: any) => x.tipo === 'fattura' && x.testo === ft.testo)) {
            map[day].push({ testo: ft.testo, tipo: 'fattura' });
          }
        }
      });
    });
    return map;
  }, [impegniMese, calMonth, fattureArchive]);

  const today = new Date();
  /* ═══ GIORNI LAVORATI NEL MESE (dal storico giornate) ═══ */
  const giorniLavoratiMese = useMemo(() => {
    const set = new Set<number>();
    (store.storicoGiornate || []).forEach(g => {
      const d = new Date(g.data);
      if (d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear()) {
        set.add(d.getDate());
      }
    });
    return set;
  }, [store.storicoGiornate, calMonth]);

  const isCurrentMonth = calMonth.getMonth() === today.getMonth() && calMonth.getFullYear() === today.getFullYear();

  /* Round 68 — regione del mercato (partenza) per marker scolastici regionali */
  const regioneAgenda = useMemo(
    () => resolveRegion(store.partenzaDa) || null,
    [store.partenzaDa]
  );

  /* ═══ FIERE RICORRENTI ATTIVE: mappa per giorno-della-settimana (0=Lun..6=Dom) + date specifiche ═══ */
  const fiereByDow = useMemo(() => {
    const map: Record<number, { nome: string; luogo: string }[]> = {};
    (store.fiere || []).forEach((f: any) => {
      if (!f.attiva) return;
      (f.giorni || []).forEach((dow: number) => {
        if (!map[dow]) map[dow] = [];
        map[dow].push({ nome: f.nome, luogo: f.luogo });
      });
    });
    return map;
  }, [store.fiere]);

  // Mappa per date specifiche (ISO YYYY-MM-DD)
  const fiereByDate = useMemo(() => {
    const map: Record<string, { nome: string; luogo: string }[]> = {};
    (store.fiere || []).forEach((f: any) => {
      if (!f.attiva) return;
      (f.dateSpecifiche || []).forEach((iso: string) => {
        if (!map[iso]) map[iso] = [];
        map[iso].push({ nome: f.nome, luogo: f.luogo });
      });
    });
    return map;
  }, [store.fiere]);

  const getFiereForDay = (day: number) => {
    if (!day) return [];
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    const dow = (date.getDay() + 6) % 7; // 0=Lun..6=Dom
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const fromDow = fiereByDow[dow] || [];
    const fromDate = fiereByDate[iso] || [];
    // Merge dedupe per nome
    const combined = [...fromDow, ...fromDate];
    const seen = new Set<string>();
    return combined.filter((f) => { if (seen.has(f.nome)) return false; seen.add(f.nome); return true; });
  };

  /* ═══ SALVA ORDINE SU GIORNO ═══ */
  const handleSaveOrder = (day: number) => {
    const text = dayModalType === 'new' ? orderText.trim() : dayModalText.trim();
    if (!text) {
      if (Platform.OS === 'web') window.alert(t('agenda.enterDetail') || 'Inserisci il dettaglio');
      else Alert.alert(t('common.error') || 'Errore', t('agenda.enterDetail') || 'Inserisci il dettaglio');
      return;
    }
    const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), day, 12, 0, 0);
    addAppunto({ data: newDate, testo: text });
    if (dayModalType === 'new') {
      setOrderText('');
      setShowCalendar(false);
    } else {
      setShowDayModal(false);
    }
  };

  /* ═══ CLICK SU GIORNO CALENDARIO ═══ */
  const handleDayPress = (day: number) => {
    const existing = impegniMese[day] || [];
    // Se ci sono solo fiere (nessun appuntamento/ordine), mostra info fiera
    const nonFiera = existing.filter(x => x.tipo !== 'fiera');
    if (existing.length > 0) {
      setSelectedDay(day);
      // Se c'è un item non-fiera lo editi, altrimenti mostri la fiera
      if (nonFiera.length > 0) {
        setDayModalText(nonFiera[0].testo);
        setDayModalType('edit');
      } else {
        // Precompila con il nome della fiera
        setDayModalText(existing.find(x => x.tipo === 'fiera')?.testo || '');
        setDayModalType('fiera');
      }
      setShowDayModal(true);
    } else if (showCalendar && orderText.trim()) {
      // Salva nuovo ordine su questo giorno
      handleSaveOrder(day);
    } else {
      // Apri il giorno per un nuovo impegno
      setSelectedDay(day);
      setDayModalText('');
      setDayModalType('new');
      setShowDayModal(true);
    }
  };

  /* ═══ ELIMINA IMPEGNO ═══ */
  const handleDeleteImpegno = () => {
    if (!selectedDay) return;
    const existing = impegniMese[selectedDay] || [];
    // Solo impegni non-fiera sono cancellabili (le fiere si gestiscono in Settings)
    const item = existing.find(x => x.tipo !== 'fiera');
    if (item) {
      const dDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay, 12, 0, 0);
      if (item.tipo === 'appuntamento') {
        removeAppunto(dDate, item.testo);
      } else {
        removeOrdine(dDate, item.testo);
      }
      setShowDayModal(false);
    }
  };

  /* ═══ MODIFICA IMPEGNO ═══ */
  const handleEditImpegno = () => {
    if (!selectedDay || !dayModalText.trim()) return;
    const existing = impegniMese[selectedDay] || [];
    const item = existing.find(x => x.tipo !== 'fiera');
    const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay, 12, 0, 0);
    // Rimuovi esistente
    if (item) {
      if (item.tipo === 'appuntamento') {
        removeAppunto(newDate, item.testo);
      } else {
        removeOrdine(newDate, item.testo);
      }
    }
    // Aggiungi nuovo
    addAppunto({ data: newDate, testo: dayModalText.trim() });
    setShowDayModal(false);
  };

  /* ═══ SALVA / MODIFICA NOTA ═══ */
  const [noteSavedFlash, setNoteSavedFlash] = useState(false);
  // Se editingNote è settato, il bottone diventa "MODIFICA" e sostituisce la vecchia nota
  const [editingNote, setEditingNote] = useState<{ data: string; testo: string } | null>(null);
  const handleSaveNote = () => {
    const txt = noteText.trim();
    if (!txt) return;
    if (editingNote) {
      // Rimpiazza la vecchia (rimuovi vecchia + aggiungi nuova con la stessa data)
      removeDiario(editingNote.data);
      addDiario({ data: new Date(editingNote.data), testo: txt });
      setEditingNote(null);
    } else {
      addDiario({ data: new Date(), testo: txt });
    }
    setNoteText('');
    setNoteSavedFlash(true);
    setTimeout(() => setNoteSavedFlash(false), 1800);
    setShowArchive(true);
    if (Platform.OS === 'web') window.alert(t('agenda.noteSaved') || 'Nota salvata!');
    else playSuccess();
  };
  const startEditNote = (data: string, testo: string) => {
    // Apre il modal di modifica con la nota precompilata.
    setEditNoteModal({ visible: true, data, testo });
  };
  const handleSaveEditNote = () => {
    if (!editNoteModal.visible) return;
    const txt = (editNoteModal.testo || '').trim();
    const dataDate = new Date(editNoteModal.data);
    if (!txt) {
      // Testo vuoto = elimina la nota
      removeDiario(dataDate);
    } else {
      removeDiario(dataDate);
      addDiario({ data: dataDate, testo: txt });
    }
    // Se era oggi, sincronizza anche il textarea principale
    const today = new Date();
    if (dataDate.toDateString() === today.toDateString()) setNoteText(txt);
    setEditNoteModal({ visible: false, data: '', testo: '' });
    setNoteSavedFlash(true);
    setTimeout(() => setNoteSavedFlash(false), 1800);
    if (Platform.OS === 'web') window.alert(t('agenda.noteSaved') || 'Nota salvata!');
    else playSuccess();
  };
  const handleDeleteEditNote = () => {
    if (!editNoteModal.visible) return;
    const dataDate = new Date(editNoteModal.data);
    removeDiario(dataDate);
    const today = new Date();
    if (dataDate.toDateString() === today.toDateString()) setNoteText('');
    setEditNoteModal({ visible: false, data: '', testo: '' });
  };

  return (
    <View style={[s.root, { height: contentH, paddingTop: topPad }]}>
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>{t('agenda.ordersAndAppointments') || 'NOTES'}</Text>

      {/* ═══ CALENDARIO (sempre visibile) ═══ */}
      <View style={s.calCard}>
        {/* Nav mese */}
        <View style={s.calNav}>
          <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={18} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{MESI[calMonth.getMonth()].toUpperCase()} {calMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={18} color="#1E7F85" />
          </TouchableOpacity>
        </View>

        {/* Giorni settimana */}
        <View style={s.calWeekRow}>
          {GIORNI_SETT.map((g, i) => <Text key={i} style={s.calWeekTxt}>{g}</Text>)}
        </View>

        {/* Griglia */}
        {calendarGrid.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const items = day ? impegniMeseFinal[day] || [] : [];
              const hasItem = items.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              const isWorked = day ? giorniLavoratiMese.has(day) : false;
              const fieraItem = items.find(x => x.tipo === 'fiera');
              const hasFiera = !!fieraItem;
              const hasApp = items.some(x => x.tipo === 'appuntamento');
              const hasOrd = items.some(x => x.tipo === 'ordine');
              /* Round 68 — marker festa/scuola contestuale alla regione del mercato */
              const dayDate = day ? new Date(calMonth.getFullYear(), calMonth.getMonth(), day) : null;
              const marker = dayDate ? getDayMarker(dayDate, regioneAgenda) : { type: null };
              // Priorità colore: fiera > ordine > appuntamento
              const fieraColor = fieraItem ? getTipologiaColor(fieraItem.tipologia) : null;
              const bgColor = hasFiera ? fieraColor! :
                               hasApp && hasOrd ? '#1A4040' :
                               hasOrd ? '#E8A060' :
                               hasApp ? '#1E7F85' :
                               isWorked ? '#D5F0E8' : 'transparent';
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    s.calDay,
                    hasItem && { backgroundColor: bgColor },
                    !hasItem && isWorked && { backgroundColor: '#D5F0E8', borderWidth: 1.5, borderColor: '#5AAA6A' },
                    isToday && !hasItem && !isWorked && s.calDayToday,
                    isToday && isWorked && !hasItem && { borderColor: '#1E7F85', borderWidth: 2 },
                  ]}
                  disabled={!day}
                  onPress={() => day && handleDayPress(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    s.calDayTxt,
                    hasItem && { color: '#FFF', fontWeight: '800' },
                    !hasItem && isWorked && { color: '#2A7A5A', fontWeight: '800' },
                    isToday && !hasItem && !isWorked && { color: '#1E7F85', fontWeight: '800' },
                  ]}>
                    {day || ''}
                  </Text>
                  {/* Indicatore multi-tipo (piccoli pallini) quando più elementi */}
                  {hasItem && items.length > 1 && (
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
                      {items.slice(0, 3).map((it, idx) => (
                        <View
                          key={idx}
                          style={{
                            width: 4, height: 4, borderRadius: 2,
                            backgroundColor: '#FFF',
                            opacity: 0.9,
                          }}
                        />
                      ))}
                    </View>
                  )}
                  {hasItem && items.length === 1 && (
                    <View style={[s.calDot, { backgroundColor: '#FFF' }]} />
                  )}
                  {!hasItem && isWorked && <View style={[s.calDot, { backgroundColor: '#5AAA6A' }]} />}
                  {/* Round 68 — marker festa/scuola (top-right) */}
                  {marker.type && (
                    <View
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: marker.color || '#D44343',
                        borderWidth: hasItem ? 1 : 0,
                        borderColor: '#FFF',
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Round 68 — Legenda festività + chiusure scolastiche regionali */}
      <View style={s.calLegendRow}>
        <View style={s.calLegendItem}>
          <View style={[s.calLegendDot, { backgroundColor: '#D44343' }]} />
          <Text style={s.calLegendTxt}>Festa nazionale</Text>
        </View>
        <View style={s.calLegendItem}>
          <View style={[s.calLegendDot, { backgroundColor: '#D4A535' }]} />
          <Text style={s.calLegendTxt}>{regioneAgenda ? `Scuole chiuse · ${regioneAgenda}` : 'Scuole chiuse'}</Text>
        </View>
      </View>

      {/* ═══ LEGENDA CALENDARIO (rimossa su richiesta utente) ═══ */}

      {/* ═══ FIERE DI OGGI (se presenti) ═══ */}
      {(() => {
        const fiereOggi = getFiereForDay(today.getDate()).length > 0 && isCurrentMonth
          ? getFiereForDay(today.getDate())
          : [];
        if (fiereOggi.length === 0) return null;
        return (
          <View style={{ backgroundColor: '#FFF8E1', borderLeftWidth: 3, borderLeftColor: '#D4AF37', padding: 8, marginBottom: 8, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="star" size={12} color="#D4AF37" />
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#8A6A1F', letterSpacing: 0.5 }}>FIERE DI OGGI</Text>
            </View>
            {fiereOggi.map((f, i) => (
              <Text key={i} style={{ fontSize: 11, color: '#5A4A1F', fontWeight: '700' }}>
                • {f.nome}{f.luogo ? ` — ${f.luogo}` : ''}
              </Text>
            ))}
          </View>
        );
      })()}

      {/* ═══ NOTE DEL GIORNO ═══ */}
      <View style={[s.card, { flex: 1 }]}>
        <View style={s.cardHeader}>
          <Ionicons name="document-text" size={15} color="#E8A060" />
          <Text style={[s.cardHeaderTxt, { color: '#E8A060' }]}>NOTE DEL GIORNO</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleSaveNote} style={[s.noteSaveBtn, noteSavedFlash && { backgroundColor: '#2A8C5F' }, editingNote && { backgroundColor: '#E8A060' }]}>
            <Ionicons name={noteSavedFlash ? 'checkmark' : (editingNote ? 'create' : 'save')} size={14} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>{noteSavedFlash ? 'SALVATA' : (editingNote ? 'MODIFICA' : 'SALVA')}</Text>
          </TouchableOpacity>
          {editingNote && (
            <TouchableOpacity
              onPress={() => { setEditingNote(null); setNoteText(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 6, padding: 6 }}
            >
              <Ionicons name="close-circle" size={20} color="#7A9090" />
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={s.noteInput}
          placeholder="Scrivi le tue note del giorno..."
          placeholderTextColor="#B0A898"
          value={noteText}
          onChangeText={setNoteText}
          multiline
        />
        {/* Archivio a tendina */}
        <TouchableOpacity
          style={s.archiveToggle}
          onPress={() => setShowArchive(!showArchive)}
          activeOpacity={0.8}
        >
          <Ionicons name="archive" size={14} color="#7A9090" />
          <Text style={s.archiveToggleTxt}>{t('agenda.noteArchive') || 'ARCHIVIO NOTE'}</Text>
          <Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={14} color="#7A9090" />
        </TouchableOpacity>
        {showArchive && (
          <>
            {/* ═══ TABS: Note | Fiere | Fatture ═══ */}
            <View style={s.archiveTabs}>
              {([
                { key: 'note' as const, icon: 'document-text' as const, label: t('agenda.tabNotes') || 'Note', color: '#E8A060', count: noteArchive.length },
                { key: 'fiere' as const, icon: 'star' as const, label: t('agenda.tabFiere') || 'Fiere', color: '#D4AF37', count: fiereArchive.length },
                { key: 'fatture' as const, icon: 'receipt' as const, label: t('agenda.tabFatture') || 'Fatture', color: '#B08050', count: fattureArchive.length },
              ]).map((tab) => {
                const on = archiveTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.archiveTab, on && { backgroundColor: tab.color, borderColor: tab.color }]}
                    onPress={() => setArchiveTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={tab.icon} size={12} color={on ? '#FFF' : tab.color} />
                    <Text style={[s.archiveTabTxt, on && { color: '#FFF' }]}>{tab.label}</Text>
                    {tab.count > 0 && (
                      <View style={[s.archiveBadge, { backgroundColor: on ? '#FFF' : tab.color }]}>
                        <Text style={[s.archiveBadgeTxt, { color: on ? tab.color : '#FFF' }]}>{tab.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══ TAB: NOTE ═══ */}
            {archiveTab === 'note' && (
              <View style={s.archiveList}>
                {noteArchive.length === 0 ? (
                  <Text style={s.archiveEmpty}>{t('agenda.noNotes') || 'Nessuna nota salvata'}</Text>
                ) : (
                  noteArchive.map((n, i) => {
                    const dayNames = (t('days', { returnObjects: true }) as any) || {};
                    const dowKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dowKey = dowKeys[n.data.getDay()];
                    const dayLabel = (dayNames[dowKey] || '').substring(0, 3).toUpperCase() || '';
                    return (
                    <View key={i} style={s.archiveItem}>
                      <View style={s.archiveDateBox}>
                        <Text style={s.archiveDateTxt}>
                          {dayLabel ? `${dayLabel}\n` : ''}{n.data.getDate()} {MESI[n.data.getMonth()].substring(0, 3)}
                        </Text>
                      </View>
                      {/* TAP per editare la nota */}
                      <TouchableOpacity
                        activeOpacity={0.6}
                        hitSlop={{ top: 6, bottom: 6 }}
                        onPress={() => {
                          if (n.src === 'appunto') return; // gli appunti calendario hanno editing diverso
                          startEditNote(n.data.toISOString(), n.testo);
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Text style={s.archiveTxt}>{n.testo}</Text>
                        {n.src !== 'appunto' && (
                          <Text style={{ fontSize: 9, color: '#7A9090', fontStyle: 'italic', marginTop: 2 }}>
                            tocca per modificare
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (n.src === 'appunto') {
                            removeAppunto(n.data, n.testo);
                          } else {
                            removeDiario(n.data);
                          }
                          // Se era oggi, pulisci il campo note
                          const today = new Date();
                          if (n.data.toDateString() === today.toDateString()) setNoteText('');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4, marginTop: 2 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#D46A6A" />
                      </TouchableOpacity>
                    </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ═══ TAB: FIERE ═══ */}
            {archiveTab === 'fiere' && (
              <View style={s.archiveList}>
                {fiereArchive.length === 0 ? (
                  <Text style={s.archiveEmpty}>{t('agenda.noFiere') || 'Nessuna fiera in programma'}</Text>
                ) : (
                  fiereArchive.map((f, i) => {
                    const col = getTipologiaColor(f.tipologia);
                    return (
                      <View key={f.id + i} style={s.archiveItem}>
                        <View style={{ backgroundColor: col, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 }}>
                            {f.next ? `${f.next.getDate()} ${MESI[f.next.getMonth()].substring(0, 3)}` : (f.ricorrente ? 'RIC.' : '—')}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.archiveTxt, { color: col }]} numberOfLines={2}>{f.nome}</Text>
                          {f.luogo ? (
                            <Text style={{ fontSize: 12, color: '#5A7575', fontWeight: '600', marginTop: 2 }} numberOfLines={1}>{f.luogo}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS === 'web') {
                              if (window.confirm(`Eliminare la fiera "${f.nome}"?`)) store.removeFiera(f.id);
                            } else {
                              Alert.alert(
                                'Elimina fiera',
                                `Eliminare "${f.nome}"?`,
                                [
                                  { text: 'Annulla', style: 'cancel' },
                                  { text: 'Elimina', style: 'destructive', onPress: () => store.removeFiera(f.id) },
                                ],
                              );
                            }
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 2 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#D46A6A" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ═══ TAB: FATTURE — Round 78 BIS: Cartelle Fornitore → Mese con X delete ═══ */}
            {archiveTab === 'fatture' && (
              <View style={s.archiveList}>
                {fattureGrouped.length === 0 ? (
                  <Text style={s.archiveEmpty}>{t('agenda.noFatture') || 'Nessuna fattura inserita'}</Text>
                ) : (
                  fattureGrouped.map((forn) => {
                    const isFornOpen = !!expandedFornitori[forn.nome];
                    const fornTotal = Math.round(forn.total);
                    return (
                      <View key={`f_${forn.nome}`} style={s.fattureFornCard}>
                        {/* Header Fornitore */}
                        <TouchableOpacity
                          onPress={() => setExpandedFornitori((prev) => ({ ...prev, [forn.nome]: !prev[forn.nome] }))}
                          activeOpacity={0.7}
                          style={s.fattureFornHeader}
                        >
                          <Ionicons name={isFornOpen ? 'folder-open' : 'folder'} size={20} color="#B08050" />
                          <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                            <Text style={s.fattureFornName} numberOfLines={1}>{forn.nome}</Text>
                            <Text style={s.fattureFornMeta}>
                              {forn.count} {forn.count === 1 ? 'fattura' : 'fatture'} · €{fornTotal}
                            </Text>
                          </View>
                          <Ionicons
                            name={isFornOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#7A8585"
                          />
                        </TouchableOpacity>
                        {/* Mesi (visibili solo se fornitore espanso) */}
                        {isFornOpen && Object.values(forn.months).map((m) => {
                          const monthKey = `${forn.nome}__${m.key}`;
                          const isMonthOpen = !!expandedMonths[monthKey];
                          const monthTotal = Math.round(m.total);
                          return (
                            <View key={monthKey} style={s.fattureMonthBlock}>
                              <TouchableOpacity
                                onPress={() => setExpandedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                                activeOpacity={0.7}
                                style={s.fattureMonthHeader}
                              >
                                <Ionicons name="calendar-outline" size={15} color="#1E7F85" />
                                <Text style={s.fattureMonthLabel}>{m.label}</Text>
                                <Text style={s.fattureMonthTotal}>€{monthTotal}</Text>
                                <Ionicons
                                  name={isMonthOpen ? 'chevron-up' : 'chevron-down'}
                                  size={14}
                                  color="#7A8585"
                                />
                              </TouchableOpacity>
                              {/* Fatture (visibili solo se mese espanso) */}
                              {isMonthOpen && m.items.map((ft, idx) => {
                                const color = ft.overdue ? '#D46A6A' : '#B08050';
                                return (
                                  <View key={ft.id + idx} style={s.fattureItemRow}>
                                    <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: 'center' }}>
                                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 }}>
                                        {ft.data.getDate()} {MESI[ft.data.getMonth()].substring(0, 3)}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[s.archiveTxt, { color: '#1A4040', flex: 1, fontSize: 12 }]} numberOfLines={1}>
                                          {ft.numero ? `Fatt. ${ft.numero}` : 'Pagamento'}
                                        </Text>
                                        <Text style={{ fontSize: 14, color, fontWeight: '900' }}>
                                          €{parseFloat(ft.importo).toFixed(0)}
                                        </Text>
                                      </View>
                                      {(ft.scadenza || ft.overdue) && (
                                        <Text style={{ fontSize: 10, color: '#7A8585', fontWeight: '700', marginTop: 2 }}>
                                          {ft.scadenza ? `scad. ${ft.scadenza.slice(8,10)}/${ft.scadenza.slice(5,7)}/${ft.scadenza.slice(0,4)}` : ''}
                                          {ft.overdue ? <Text style={{ color: '#D46A6A', fontWeight: '900' }}> · SCADUTA</Text> : null}
                                        </Text>
                                      )}
                                    </View>
                                    <TouchableOpacity
                                      onPress={() => {
                                        const doDelete = () => {
                                          if (ft.source === 'log') {
                                            const id = ft.id.startsWith('log_') ? ft.id.slice(4) : ft.id;
                                            (store as any).removeFattura?.(id);
                                          } else if (ft.source === 'session') {
                                            const sess = (store as any).speseExtraSession;
                                            if (sess?.fornInfo) {
                                              const newFornInfo = { ...(sess.fornInfo as Record<string, any>) };
                                              delete newFornInfo[ft.fornitore];
                                              const newSpese = { ...(sess.speseExtraFornitore || {}) };
                                              delete newSpese[ft.fornitore];
                                              (store as any).setSpeseExtraSession?.({
                                                ...sess,
                                                fornInfo: newFornInfo,
                                                speseExtraFornitore: newSpese,
                                              });
                                            }
                                          } else if (ft.source === 'historic') {
                                            const dayIso = ft.data.toISOString().slice(0, 10);
                                            const updated = (store.storicoGiornate || []).map((g: any) => {
                                              const gIso = new Date(g.data).toISOString().slice(0, 10);
                                              if (gIso !== dayIso) return g;
                                              const info = { ...(g.fornitoriInfo || {}) };
                                              delete info[ft.fornitore];
                                              return { ...g, fornitoriInfo: info };
                                            });
                                            store.setConfig({ storicoGiornate: updated });
                                          } else {
                                            removeOrdine(ft.data, ft.testo);
                                          }
                                        };
                                        if (Platform.OS === 'web') {
                                          if (window.confirm(`Eliminare la fattura ${ft.fornitore}${ft.numero ? ' n. ' + ft.numero : ''}?`)) doDelete();
                                        } else {
                                          Alert.alert('Elimina fattura', `Eliminare ${ft.fornitore}${ft.numero ? ' • Fatt. ' + ft.numero : ''}?`, [
                                            { text: 'Annulla', style: 'cancel' },
                                            { text: 'Elimina', style: 'destructive', onPress: doDelete },
                                          ]);
                                        }
                                      }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      style={{ padding: 2 }}
                                    >
                                      <Ionicons name="close-circle" size={18} color="#D46A6A" />
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* ═══ MODAL GIORNO (Modifica/Cancella/Dettaglio Fiera) ═══ */}
      <Modal visible={showDayModal} transparent animationType="fade" onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowDayModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            {/* X close button */}
            <TouchableOpacity
              onPress={() => setShowDayModal(false)}
              style={{ position: 'absolute', top: 10, right: 10, padding: 6, zIndex: 10 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#7A9090" />
            </TouchableOpacity>
            <View style={s.modalTitleRow}>
              <Ionicons name="calendar" size={20} color="#1E7F85" />
              <Text style={s.modalTitle}>
                {selectedDay} {MESI[calMonth.getMonth()]}
              </Text>
            </View>

            {dayModalType === 'fiera' && selectedDay !== null && (() => {
              const items = impegniMese[selectedDay] || [];
              const fiereItems = items.filter(x => x.tipo === 'fiera');
              const f = fiereItems[0];
              if (!f) return null;
              const col = getTipologiaColor(f.tipologia);
              const iso = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
              return (
                <View style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <View style={{
                      backgroundColor: col,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
                        {(f.tipologia || 'Fiera').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Nome modificabile */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#5A7575', marginBottom: 3, letterSpacing: 0.5 }}>NOME</Text>
                  <TextInput
                    style={[s.modalInput, { borderLeftWidth: 3, borderLeftColor: col }]}
                    value={dayModalText || f.testo}
                    onChangeText={setDayModalText}
                    placeholder="Nome fiera"
                    placeholderTextColor="#B0A898"
                  />

                  {/* Info compatte */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {f.luogo ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: col + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                        <Ionicons name="location" size={11} color={col} />
                        <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '600' }}>{f.luogo}</Text>
                      </View>
                    ) : null}
                    {(f.km ?? 0) > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: col + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                        <Ionicons name="car" size={11} color={col} />
                        <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '600' }}>{f.km} km</Text>
                      </View>
                    ) : null}
                    {(f.plateatico ?? 0) > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: col + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                        <Ionicons name="cash" size={11} color={col} />
                        <Text style={{ fontSize: 11, color: '#1A4040', fontWeight: '600' }}>€{f.plateatico}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Pulsanti azione */}
                  <View style={s.modalBtns}>
                    <TouchableOpacity
                      style={[s.modalBtn, { backgroundColor: '#D46A6A' }]}
                      onPress={() => {
                        if (!f.fieraId) return;
                        const fiera = (store.fiere || []).find((x: any) => x.id === f.fieraId);
                        if (!fiera) return;
                        const dates = (fiera.dateSpecifiche || []).filter((d: string) => d !== iso);
                        // Rimuovi anche dai giorni ricorrenti se presente per quel dow
                        const dow = (new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay!).getDay() + 6) % 7;
                        const giorni = (fiera.giorni || []).filter((g: number) => g !== dow);
                        // Se non rimangono date né giorni, elimina l'intera fiera
                        if (dates.length === 0 && giorni.length === 0) {
                          store.removeFiera(f.fieraId);
                        } else {
                          store.updateFiera(f.fieraId, { dateSpecifiche: dates, giorni });
                        }
                        setShowDayModal(false);
                      }}
                    >
                      <Ionicons name="trash" size={16} color="#FFF" />
                      <Text style={s.modalBtnTxt}>RIMUOVI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.modalBtn, { backgroundColor: col, flex: 1 }]}
                      onPress={() => {
                        if (!f.fieraId) return;
                        const newName = (dayModalText || f.testo).trim();
                        if (!newName) return;
                        store.updateFiera(f.fieraId, { nome: newName });
                        playSuccess();
                        setShowDayModal(false);
                      }}
                    >
                      <Ionicons name="create" size={16} color="#FFF" />
                      <Text style={s.modalBtnTxt}>MODIFICA</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Opzione: aggiungi anche un appunto su questo giorno */}
                  <TouchableOpacity
                    style={{ alignSelf: 'center', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      setDayModalType('new');
                      setDayModalText('');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#1E7F85" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E7F85', letterSpacing: 0.3 }}>
                      Aggiungi anche un appunto
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {dayModalType !== 'fiera' && (
              <>
                {dayModalType === 'edit' && impegniMese[selectedDay!] ? (
                  <Text style={s.modalSubtitle}>
                    {(impegniMese[selectedDay!].find(x => x.tipo !== 'fiera')?.tipo === 'appuntamento') ? 'APPUNTAMENTO' : 'ORDINE'}
                  </Text>
                ) : (
                  <Text style={s.modalSubtitle}>NUOVO IMPEGNO</Text>
                )}

                <TextInput
                  style={s.modalInput}
                  placeholder="Descrizione..."
                  placeholderTextColor="#B0A898"
                  value={dayModalText}
                  onChangeText={setDayModalText}
                  multiline
                />

                <View style={s.modalBtns}>
                  {dayModalType === 'edit' && (
                    <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#D46A6A' }]} onPress={handleDeleteImpegno}>
                      <Ionicons name="trash" size={16} color="#FFF" />
                      <Text style={s.modalBtnTxt}>CANCELLA</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[s.modalBtn, { backgroundColor: '#1E7F85', flex: 1 }]} 
                    onPress={() => {
                      if (dayModalType === 'edit') {
                        handleEditImpegno();
                      } else {
                        if (!dayModalText.trim()) return;
                        const newDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay!, 12, 0, 0);
                        addAppunto({ data: newDate, testo: dayModalText.trim() });
                        playSuccess();
                        setShowDayModal(false);
                      }
                    }}
                  >
                    <Ionicons name={dayModalType === 'edit' ? 'create' : 'save'} size={16} color="#FFF" />
                    <Text style={s.modalBtnTxt}>{dayModalType === 'edit' ? (t('common.edit') || 'MODIFICA') : (t('agenda.save') || 'SALVA')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ═══ MODAL EDIT NOTA — apre cliccando una nota dell'archivio ═══ */}
      <Modal
        visible={editNoteModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNoteModal({ visible: false, data: '', testo: '' })}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setEditNoteModal({ visible: false, data: '', testo: '' })}
          style={s.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={[s.modalCard, { width: '100%' }]} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <Text style={s.modalTitle}>
              {t('agenda.editNote') || 'MODIFICA NOTA'}
            </Text>
            <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 10, textAlign: 'center' }}>
              {(() => { try { return new Date(editNoteModal.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return ''; } })()}
            </Text>
            <TextInput
              value={editNoteModal.testo}
              onChangeText={(v) => setEditNoteModal((p) => ({ ...p, testo: v }))}
              placeholder={t('agenda.notePlaceholder') || 'Scrivi qui...'}
              placeholderTextColor="#A0B0B0"
              multiline
              autoFocus
              style={[s.modalInput, { minHeight: 120 }]}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#FCE8E8', flex: 1 }]}
                onPress={handleDeleteEditNote}
              >
                <Ionicons name="trash-outline" size={14} color="#D46A6A" />
                <Text style={[s.modalBtnTxt, { color: '#D46A6A' }]}>
                  {t('common.delete') || 'ELIMINA'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#E2D9C4', flex: 1 }]}
                onPress={() => setEditNoteModal({ visible: false, data: '', testo: '' })}
              >
                <Text style={[s.modalBtnTxt, { color: '#1A3A3A' }]}>
                  {t('common.cancel') || 'ANNULLA'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#1E7F85', flex: 1.4 }]}
                onPress={handleSaveEditNote}
              >
                <Ionicons name="checkmark" size={14} color="#FFF" />
                <Text style={s.modalBtnTxt}>
                  {t('common.save') || 'SALVA'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Card generica
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardHeaderTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E7F85',
    letterSpacing: 1,
  },
  // Ordini
  orderInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#1A4040',
    minHeight: 36,
    textAlignVertical: 'top',
  },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  orderBtnTxt: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Calendario
  calCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 8,
    marginBottom: 6,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  calNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calMonthTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A4040',
    letterSpacing: 1,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calWeekTxt: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
    marginHorizontal: 1,
  },
  calRow: {
    flexDirection: 'row',
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    margin: 1,
    minHeight: 28,
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  calDayTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginTop: 1,
  },
  // Round 68 — Legenda festività/scuole
  calLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  calLegendTxt: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7A9090',
  },
  // Note
  noteInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#1A4040',
    minHeight: 32,
    textAlignVertical: 'top',
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8A060',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // Archivio a tendina
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E8E3D5',
  },
  archiveToggleTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5A7575',
    letterSpacing: 1,
  },
  archiveList: {
    paddingTop: 4,
  },
  archiveEmpty: {
    fontSize: 14,
    color: '#9A9080',
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '600',
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE1',
    minHeight: 44,
  },
  // Round 78 BIS — Cartelle Fornitore → Mese per Fatture
  fattureFornCard: {
    backgroundColor: '#FBF6E8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5DDC2',
  },
  fattureFornHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  fattureFornName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 0.2,
  },
  fattureFornMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8585',
    marginTop: 2,
  },
  fattureMonthBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EAE2C8',
  },
  fattureMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    minHeight: 32,
  },
  fattureMonthLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1E7F85',
  },
  fattureMonthTotal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B08050',
    marginRight: 4,
  },
  fattureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 6,
    paddingRight: 2,
    borderTopWidth: 1,
    borderTopColor: '#F2EDD9',
    minHeight: 38,
  },
  archiveTabs: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
    marginBottom: 8,
  },
  archiveTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E8E3D5',
    backgroundColor: '#F5F0E6',
  },
  archiveTabTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5A7575',
    letterSpacing: 0.3,
  },
  archiveBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveBadgeTxt: {
    fontSize: 11,
    fontWeight: '900',
  },
  archiveDate: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5A7575',
    backgroundColor: '#F5F0E6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
    marginTop: 1, // allinea con il primo riga di testo
  },
  archiveDateBox: {
    backgroundColor: '#F5F0E6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  archiveDateTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5A7575',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  archiveTxt: {
    fontSize: 14.5,
    color: '#1A4040',
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    // @ts-ignore
    boxShadow: '0px 10px 30px rgba(0,0,0,0.25)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A4040',
  },
  modalSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A9090',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A4040',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
