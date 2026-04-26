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

  // ═══ NOTE DEL GIORNO ═══
  const [noteText, setNoteText] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'note' | 'fiere' | 'fatture'>('note');

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
    // Aggiungi le fatture (con scadenza) al calendario del mese
    fattureArchive.forEach((ft) => {
      // Mostra la fattura sia nel giorno di EMISSIONE che alla SCADENZA
      const datesToMark: Date[] = [ft.data];
      if (ft.scadenza) {
        const sc = new Date(ft.scadenza);
        if (!isNaN(sc.getTime()) && sc.toDateString() !== ft.data.toDateString()) datesToMark.push(sc);
      }
      datesToMark.forEach((dd) => {
        if (dd.getMonth() === calMonth.getMonth() && dd.getFullYear() === calMonth.getFullYear()) {
          const day = dd.getDate();
          if (!map[day]) map[day] = [];
          if (!map[day].some((x) => x.tipo === 'fattura' && x.testo === ft.testo)) {
            map[day].push({ testo: ft.testo, tipo: 'fattura' });
          }
        }
      });
    });
    return map;
  }, [appuntiAgenda, ordiniAgenda, calMonth, store.fiere, fattureArchive]);

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

  /* ═══ ARCHIVIO NOTE ═══ */
  const noteArchive = useMemo(() => {
    return (storicoDiario || [])
      .map(d => ({ ...d, data: new Date(d.data) }))
      .sort((a, b) => b.data.getTime() - a.data.getTime())
      .slice(0, 30);
  }, [storicoDiario]);

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

  /* ═══ ARCHIVIO FATTURE — letto direttamente dal `storicoGiornate` ═══
     Per ogni giornata salvata, se un fornitore ha numeroFattura + importo,
     viene aggiunta una voce all'archivio. Inclusa anche la sessione corrente
     (fornInfo + speseExtraSession) per mostrare le fatture in corso prima
     che la giornata venga salvata. */
  const fattureArchive = useMemo(() => {
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const items: { id: string; data: Date; fornitore: string; numero: string; importo: string; scadenza: string; overdue: boolean; testo: string; source: 'historic' | 'session' | 'agenda' }[] = [];
    const seen = new Set<string>();

    // 1. Fatture archiviate nelle giornate salvate
    (store.storicoGiornate || []).forEach((g: any) => {
      const info = g.fornitoriInfo || {};
      const dettaglio = g.dettaglio_fornitori || {};
      Object.entries(info).forEach(([forn, fInfo]: [string, any]) => {
        if (!fInfo?.numeroFattura) return;
        const importoNum = Math.abs(dettaglio[forn] || 0);
        if (!importoNum) return;
        const dd = new Date(g.data);
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
          testo: `${forn} • Fatt. ${fInfo.numeroFattura} • €${importoNum.toFixed(0)}`,
          source: 'historic',
        });
      });
    });

    // 2. Fatture in corso (sessione attiva non ancora salvata)
    const session = (store as any).speseExtraSession;
    if (session?.fornInfo) {
      Object.entries(session.fornInfo).forEach(([forn, fInfo]: [string, any]) => {
        if (!fInfo?.numeroFattura) return;
        const sessionEntry = (session.speseExtraFornitore || {})[forn];
        const importoNum = parseFloat((sessionEntry?.importo || '0').replace(',', '.')) || 0;
        if (!importoNum) return;
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
          testo: `${forn} • Fatt. ${fInfo.numeroFattura} • €${importoNum.toFixed(0)}`,
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
  }, [store.storicoGiornate, (store as any).speseExtraSession, ordiniAgenda]);

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

  /* ═══ SALVA NOTA ═══ */
  const handleSaveNote = () => {
    if (noteText.trim()) {
      addDiario({ data: new Date(), testo: noteText.trim() });
      if (Platform.OS === 'web') window.alert(t('agenda.noteSaved') || 'Nota salvata!');
      else playSuccess(); // Conferma sonora, nessun popup
    }
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
              const items = day ? impegniMese[day] || [] : [];
              const hasItem = items.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              const isWorked = day ? giorniLavoratiMese.has(day) : false;
              const fieraItem = items.find(x => x.tipo === 'fiera');
              const hasFiera = !!fieraItem;
              const hasApp = items.some(x => x.tipo === 'appuntamento');
              const hasOrd = items.some(x => x.tipo === 'ordine');
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
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
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
          <TouchableOpacity onPress={handleSaveNote} style={s.noteSaveBtn}>
            <Ionicons name="save" size={14} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>SALVA</Text>
          </TouchableOpacity>
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
                      <Text style={s.archiveDate}>
                        {dayLabel ? `${dayLabel} ` : ''}{n.data.getDate()} {MESI[n.data.getMonth()].substring(0, 3)}
                      </Text>
                      <Text style={[s.archiveTxt, { flex: 1 }]}>{n.testo}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          removeDiario(n.data);
                          // Se era oggi, pulisci il campo note
                          const today = new Date();
                          if (n.data.toDateString() === today.toDateString()) setNoteText('');
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
                        <View style={{ backgroundColor: col, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 }}>
                            {f.next ? `${f.next.getDate()} ${MESI[f.next.getMonth()].substring(0, 3)}` : (f.ricorrente ? 'RIC.' : '—')}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.archiveTxt, { color: col, flex: 1 }]}>{f.nome}</Text>
                          {f.luogo ? (
                            <Text style={{ fontSize: 9, color: '#7A9090', fontWeight: '600' }}>{f.luogo}</Text>
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

            {/* ═══ TAB: FATTURE ═══ */}
            {archiveTab === 'fatture' && (
              <View style={s.archiveList}>
                {fattureArchive.length === 0 ? (
                  <Text style={s.archiveEmpty}>{t('agenda.noFatture') || 'Nessuna fattura in scadenza'}</Text>
                ) : (
                  fattureArchive.map((ft, i) => {
                    const color = ft.overdue ? '#D46A6A' : '#B08050';
                    return (
                      <View key={ft.id + i} style={s.archiveItem}>
                        <View style={{ backgroundColor: color, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 }}>
                            {ft.data.getDate()} {MESI[ft.data.getMonth()].substring(0, 3)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.archiveTxt, { color: '#1A4040' }]}>
                            {ft.fornitore}{ft.numero ? ` • Fatt. ${ft.numero}` : ''}
                          </Text>
                          <Text style={{ fontSize: 11, color, fontWeight: '900', marginTop: 1 }}>
                            €{parseFloat(ft.importo).toFixed(0)}
                            {ft.scadenza ? ` · scad. ${ft.scadenza.slice(8,10)}/${ft.scadenza.slice(5,7)}` : ''}
                            {ft.overdue ? ' · SCADUTA' : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            const doDelete = () => {
                              if (ft.source === 'session') {
                                // Rimuovi la fattura dalla sessione spese in corso
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
                                // Rimuovi la fattura dalla giornata storica
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
    paddingHorizontal: 1,
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
    fontSize: 9,
    fontWeight: '800',
    color: '#7A9090',
    letterSpacing: 1,
  },
  archiveList: {
    paddingTop: 4,
  },
  archiveEmpty: {
    fontSize: 11,
    color: '#B0A898',
    textAlign: 'center',
    paddingVertical: 8,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE1',
  },
  archiveTabs: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  archiveTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E8E3D5',
    backgroundColor: '#F5F0E6',
  },
  archiveTabTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A7575',
    letterSpacing: 0.3,
  },
  archiveBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
  },
  archiveDate: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A9090',
    backgroundColor: '#F5F0E6',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  archiveTxt: {
    fontSize: 12.5,
    color: '#1A4040',
    fontWeight: '700',
    flex: 1,
    lineHeight: 17,
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
