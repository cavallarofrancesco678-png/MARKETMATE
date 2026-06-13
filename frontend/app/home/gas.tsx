import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { useTranslation } from 'react-i18next';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTutorialAnchor } from '../../src/store/tutorialLayoutStore';
import { RangePickerModal, type RangeResult, type RangeMode } from '../../src/components/RangePickerModal';
import { getDayMarker, resolveRegion } from '../../src/utils/italianCalendar';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/* Util: parse data difensivo. Round 59 — fix crash da dati legacy con date
   corrotte o stringhe non valide. Ritorna null se la data non è parsabile. */
const safeParseDate = (raw: any): Date | null => {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Round 67 — costruisce un RangeResult 'mese' per la data indicata.
   Usato per la SINCRONIZZAZIONE fra il filtro periodo (KPI/grafico sopra)
   e il calendario mensile (sotto): cambiare mese in uno aggiorna l'altro. */
const monthPeriodOf = (d: Date): RangeResult => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    mode: 'mese',
    from: isoOf(first),
    to: isoOf(last),
    label: `${MESI_SHORT[d.getMonth()]} ${d.getFullYear()}`,
  };
};

export default function GasScreen() {
  const store = useAppStore();
  const { storicoCarburante, storicoGiornate, addCarburante, removeCarburante } = store;
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Tutorial anchor
  const anchorGasInput = useTutorialAnchor('gas-input-block');

  /* ═══ Round 59 — REFACTOR FILTRO PERIODO ═══
     Sostituiamo il vecchio sistema Filtro = 'SETT.'/'MESE'/'ANNO'/'PERS.' con il
     nuovo RangePickerModal condiviso. Manteniamo solo lo stato `period`
     (RangeResult) che il modal restituisce. Le bug precedenti:
       • SETT. faceva "ultimi 7 giorni rolling" → ora SETT. = settimana
         calendario (Lun→Dom) della data di riferimento.
       • MESE faceva "ultimi 30 giorni rolling" → ora MESE = mese calendario
         (1→fine del mese) della data di riferimento. Questo elimina il
         bug "ho speso €80 ma me ne mostra €168" (sommava dati di mesi
         diversi).
       • PERS. ora condivide lo stesso componente di Statistiche per
         coerenza UX. */
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState<RangeResult>(() => monthPeriodOf(new Date()));

  const [euroText, setEuroText] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayNote, setDayNote] = useState('');
  const [dayAmount, setDayAmount] = useState('');
  const [displayMonth, setDisplayMonth] = useState(new Date());

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : insets.top + 16;
  const contentH = height - insets.bottom - 130 - topPad;

  /* ═══ SALVA RIFORNIMENTO OGGI ═══ */
  const handleSalvaRifornimento = () => {
    const euro = parseFloat(euroText.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.enterValidAmount') || 'Inserisci un importo valido');
      else Alert.alert(t('common.error') || 'Errore', t('gas.enterValidAmount') || 'Inserisci un importo valido');
      return;
    }
    addCarburante({ data: new Date(), euro, nota: '' });
    setEuroText('');
    playSuccess(); // Conferma sonora + aptica, nessun popup
  };

  /* ═══ STATISTICHE FILTRATE per il `period` selezionato ═══
     Filtra storicoCarburante e storicoGiornate per data ∈ [from..to] usando
     ISO comparisons (no timezone hell). Round 59: anti-crash via safeParseDate. */
  const stats = useMemo(() => {
    const fromIso = period.from;
    const toIso = period.to;

    const filtered = storicoCarburante.filter((c) => {
      const d = safeParseDate(c?.data);
      if (!d) return false;
      const iso = isoOf(d);
      return iso >= fromIso && iso <= toIso;
    });
    const filteredGiornate = storicoGiornate.filter((g) => {
      const d = safeParseDate(g?.data);
      if (!d) return false;
      const iso = isoOf(d);
      return iso >= fromIso && iso <= toIso;
    });

    const totale = filtered.reduce((s, c) => s + (Number(c?.euro) || 0), 0);
    const km = filteredGiornate.reduce((s, g) => s + (Number(g?.km) || 0), 0);
    const euroKm = km > 0 ? totale / km : 0;

    return { totale, km, euroKm, filtered };
  }, [storicoCarburante, storicoGiornate, period]);

  /* ═══ DATI GRAFICO ═══
     Sempre coerente con il `period` selezionato.
     Heuristic per il raggruppamento:
       • Range ≤ 14 giorni → barre per giorno
       • Range ≤ 60 giorni → barre per settimana
       • Range > 60 giorni → barre per mese */
  const chartData = useMemo(() => {
    const fromIso = period.from;
    const toIso = period.to;
    const fromDate = new Date(fromIso + 'T00:00:00');
    const toDate = new Date(toIso + 'T00:00:00');
    const msDay = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / msDay) + 1);

    if (period.mode === 'anno' || days > 60) {
      // Raggruppa per mese
      const monthsInRange: { label: string; key: string; value: number }[] = [];
      const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      while (cur <= toDate) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        monthsInRange.push({ label: MESI_SHORT[cur.getMonth()], key, value: 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
      storicoCarburante.forEach((c) => {
        const d = safeParseDate(c?.data);
        if (!d) return;
        const iso = isoOf(d);
        if (iso < fromIso || iso > toIso) return;
        const key = iso.slice(0, 7);
        const bucket = monthsInRange.find((b) => b.key === key);
        if (bucket) bucket.value += Number(c?.euro) || 0;
      });
      return { values: monthsInRange.map((m) => m.value), labels: monthsInRange.map((m) => m.label) };
    }

    if (days <= 14) {
      // Per giorno
      const values: number[] = Array(days).fill(0);
      const labels: string[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(fromDate); d.setDate(fromDate.getDate() + i);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      }
      storicoCarburante.forEach((c) => {
        const d = safeParseDate(c?.data);
        if (!d) return;
        const iso = isoOf(d);
        if (iso < fromIso || iso > toIso) return;
        const idx = Math.floor((d.getTime() - fromDate.getTime()) / msDay);
        if (idx >= 0 && idx < days) values[idx] += Number(c?.euro) || 0;
      });
      return { values, labels };
    }

    // Per settimana (15-60 gg)
    const weeks = Math.ceil(days / 7);
    const values: number[] = Array(weeks).fill(0);
    const labels: string[] = [];
    for (let i = 0; i < weeks; i++) labels.push(`S${i + 1}`);
    storicoCarburante.forEach((c) => {
      const d = safeParseDate(c?.data);
      if (!d) return;
      const iso = isoOf(d);
      if (iso < fromIso || iso > toIso) return;
      const idx = Math.floor((d.getTime() - fromDate.getTime()) / (7 * msDay));
      if (idx >= 0 && idx < weeks) values[idx] += Number(c?.euro) || 0;
    });
    return { values, labels };
  }, [storicoCarburante, period]);

  const maxChart = Math.max(...chartData.values, 1);

  /* ═══ RIFORNIMENTI DEL MESE ═══ */
  const rifornimentiMese = useMemo(() => {
    const map: { [day: number]: { euro: number; nota?: string; data: Date }[] } = {};
    storicoCarburante.forEach(c => {
      const d = new Date(c.data);
      if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ euro: c.euro, nota: (c as any).nota, data: d });
      }
    });
    return map;
  }, [storicoCarburante, displayMonth]);

  const handleDayPress = (day: number) => {
    // Round 68 — BLOCCO GIORNI FUTURI: non si possono inserire rifornimenti
    // in date future (causa primaria del bug "conti sballati" e "rifornimento
    // nei prossimi giorni"). Si avvisa l'utente con un toast/alert.
    const target = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (target.getTime() > todayMidnight.getTime()) {
      const msg = t('gas.noFutureRefuel', { defaultValue: 'Non puoi registrare un rifornimento per un giorno futuro.' });
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('common.notice', { defaultValue: 'Attenzione' }), msg);
      return;
    }
    setSelectedDay(day);
    const rifs = rifornimentiMese[day];
    if (rifs && rifs.length > 0) {
      setDayAmount(rifs[0].euro.toFixed(0));
      setDayNote(rifs[0].nota || '');
    } else {
      setDayAmount('');
      setDayNote('');
    }
    setShowDayModal(true);
  };

  /* Trova indice reale in storicoCarburante dato un rifornimento */
  const findCarburanteIndex = (data: Date, euro: number): number => {
    return storicoCarburante.findIndex(c =>
      new Date(c.data).toDateString() === new Date(data).toDateString() && c.euro === euro
    );
  };

  const handleSaveDayRifornimento = () => {
    if (!selectedDay) return;
    // Round 68 — Difesa in profondità: verifica ancora la data del giorno
    // selezionato per impedire salvataggio futuro anche se la modal fosse
    // stata aperta in modo anomalo.
    const target = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), selectedDay);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (target.getTime() > todayMidnight.getTime()) {
      const msg = t('gas.noFutureRefuel', { defaultValue: 'Non puoi registrare un rifornimento per un giorno futuro.' });
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('common.notice', { defaultValue: 'Attenzione' }), msg);
      setShowDayModal(false);
      return;
    }
    const euro = parseFloat(dayAmount.replace(',', '.'));
    if (!euro || euro <= 0) {
      if (Platform.OS === 'web') window.alert(t('gas.invalidAmount') || 'Importo non valido');
      else Alert.alert(t('common.error') || 'Errore', t('gas.invalidAmount') || 'Importo non valido');
      return;
    }
    // Rimuovi esistente
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      const idx = findCarburanteIndex(existing[0].data, existing[0].euro);
      if (idx !== -1) removeCarburante(idx);
    }
    // Aggiungi nuovo
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), selectedDay, 12, 0, 0);
    addCarburante({ data: newDate, euro, nota: dayNote });
    playSuccess();
    setShowDayModal(false);
  };

  const handleDeleteDayRifornimento = () => {
    if (!selectedDay) return;
    const existing = rifornimentiMese[selectedDay];
    if (existing && existing.length > 0) {
      const idx = findCarburanteIndex(existing[0].data, existing[0].euro);
      if (idx !== -1) removeCarburante(idx);
      setShowDayModal(false);
    }
  };

  /* ═══ GRIGLIA CALENDARIO ═══ */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const lastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [displayMonth]);

  const today = new Date();
  const isCurrentMonth = displayMonth.getMonth() === today.getMonth() && displayMonth.getFullYear() === today.getFullYear();

  /* Round 68 — resolve regione mercato per marker scolastici contestuali */
  const regioneMercato = useMemo(
    () => resolveRegion(store.partenzaDa) || null,
    [store.partenzaDa]
  );

  /* Round 68 — la freccia → del calendario si disabilita una volta arrivati
     al mese corrente: evita all'utente di vagare nei mesi futuri (dove
     comunque non può registrare nulla) e di sentirsi disorientato. */
  const canGoForward = displayMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  const isFutureMonth = displayMonth > new Date(today.getFullYear(), today.getMonth(), 1);

  /* Round 67 — SINCRONIZZAZIONE CALENDARIO ↔ FILTRO PERIODO.
     Cambiare mese con le frecce del calendario (sotto) aggiorna anche il
     filtro periodo (sopra) così KPI + grafico mostrano lo STESSO mese. */
  const goToMonth = (delta: number) => {
    hapticTap();
    const next = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + delta, 1);
    setDisplayMonth(next);
    setPeriod(monthPeriodOf(next));
  };

  return (
    <ScrollView
      style={[s.root, { paddingTop: topPad }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ═══ TITOLO ═══ */}
      <Text style={s.pageTitle}>{t('gas.title')}</Text>

      {/* ═══ INPUT GRANDE + SALVA ═══ */}
      <View style={s.inputCard} testID="gas-input-block" ref={anchorGasInput}>
        <TextInput
          style={s.bigInput}
          placeholder="€ 0"
          placeholderTextColor="#B0A898"
          keyboardType="numeric"
          value={euroText}
          onChangeText={setEuroText}
          selectTextOnFocus
        />
        <TouchableOpacity style={s.saveBtn} onPress={handleSalvaRifornimento}>
          <Ionicons name="save" size={20} color="#FFF" />
          <Text style={s.saveBtnTxt}>{t('gas.save')}</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ FILTRO PERIODO — bottone unico che apre RangePickerModal ═══ */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterBtn, s.filterOn, { flex: 1 }]}
          onPress={() => { hapticTap(); setPeriodOpen(true); }}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar" size={14} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={[s.filterTxt, { color: '#FFF', textTransform: 'uppercase' }]}>
            {period.label}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#FFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* ═══ KPI ═══
          Round 59 — bug fix: €/KM mostrava sempre €0 perché usava toFixed(0).
          Per valori tipici 0.18-0.25 €/km serve almeno toFixed(3). */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="speedometer-outline" size={16} color="#1E7F85" />
          <Text style={s.kpiLabel}>KM</Text>
          <Text style={s.kpiValue}>{stats.km.toFixed(0)}</Text>
        </View>
        <View style={[s.kpiCard, s.kpiCardMain]}>
          <Ionicons name="wallet-outline" size={16} color="#FFF" />
          <Text style={[s.kpiLabel, { color: '#FFF' }]}>{t('gas.total')}</Text>
          <Text style={[s.kpiValue, { color: '#FFF' }]}>€{stats.totale.toFixed(0)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="calculator-outline" size={16} color="#1E7F85" />
          <Text style={s.kpiLabel}>€/KM</Text>
          <Text style={s.kpiValue}>{stats.euroKm > 0 ? `€${stats.euroKm.toFixed(3)}` : '—'}</Text>
        </View>
      </View>

      {/* ═══ GRAFICO ═══ */}
      <View style={s.chartCard}>
        <View style={s.chartArea}>
          {chartData.values.map((val, i) => {
            const h = maxChart > 0 ? (val / maxChart) * 100 : 5;
            return (
              <TouchableOpacity key={i} style={s.barCol} onPress={() => {
                hapticTap();
              }}>
                <Text style={s.barValue}>{val > 0 ? `€${Math.round(val)}` : ''}</Text>
                <View style={s.barWrap}>
                  <View style={[s.bar, { height: `${Math.max(h, 8)}%`, backgroundColor: val > 0 ? '#1E7F85' : '#D8D0C0' }]} />
                </View>
                <Text style={s.barLabel}>{chartData.labels[i]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══ CALENDARIO ═══ */}
      <View style={s.calCard}>
        <View style={s.calHeader}>
          <TouchableOpacity testID="gas-cal-prev-month" onPress={() => goToMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={18} color="#1E7F85" />
          </TouchableOpacity>
          <Text style={s.calMonthTxt}>{(t('gas.months', { returnObjects: true }) as string[])?.[displayMonth.getMonth()]?.toUpperCase() || MESI[displayMonth.getMonth()].toUpperCase()} {displayMonth.getFullYear()}</Text>
          <TouchableOpacity
            testID="gas-cal-next-month"
            onPress={() => canGoForward && goToMonth(1)}
            disabled={!canGoForward}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={18} color={canGoForward ? '#1E7F85' : '#C5C2B8'} />
          </TouchableOpacity>
        </View>
        <View style={s.calWeekRow}>
          {[t('gas.mon'), t('gas.tue'), t('gas.wed'), t('gas.thu'), t('gas.fri'), t('gas.sat'), t('gas.sun')].map((d, i) => <Text key={i} style={s.calWeekDay}>{d}</Text>)}
        </View>
        {calendarGrid.map((row, ri) => (
          <View key={ri} style={s.calRow}>
            {row.map((day, di) => {
              const rif = day ? rifornimentiMese[day] : null;
              const hasRif = rif && rif.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              /* Round 68 — marker festa/scuola + blocco visivo giorni futuri */
              const dayDate = day ? new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day) : null;
              const marker = dayDate ? getDayMarker(dayDate, regioneMercato) : { type: null };
              const isFutureDay = !!(dayDate && dayDate.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime());
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    s.calDay,
                    hasRif && s.calDayActive,
                    isToday && !hasRif && s.calDayToday,
                    isFutureDay && !hasRif && { opacity: 0.35 },
                  ]}
                  disabled={!day}
                  onPress={() => day && handleDayPress(day)}
                >
                  <Text style={[s.calDayTxt, hasRif && { color: '#FFF', fontWeight: '900' }, isToday && !hasRif && { color: '#1E7F85', fontWeight: '900' }]}>
                    {day || ''}
                  </Text>
                  {hasRif && <Text style={s.calDayAmount}>€{Math.round(rif[0].euro)}</Text>}
                  {/* Marker festa/scuola — puntino in alto a destra */}
                  {!hasRif && marker.type && (
                    <View
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: marker.color || '#D44343',
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {/* Round 68 — Legenda festività + chiusure scolastiche */}
        <View style={s.calLegend}>
          <View style={s.calLegendItem}>
            <View style={[s.calLegendDot, { backgroundColor: '#D44343' }]} />
            <Text style={s.calLegendTxt}>Festa nazionale</Text>
          </View>
          <View style={s.calLegendItem}>
            <View style={[s.calLegendDot, { backgroundColor: '#D4A535' }]} />
            <Text style={s.calLegendTxt}>{regioneMercato ? `Scuole chiuse (${regioneMercato})` : 'Scuole chiuse'}</Text>
          </View>
        </View>
      </View>

      {/* ═══ MODAL GIORNO ═══ */}
      <Modal visible={showDayModal} transparent animationType="fade" onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setShowDayModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent} onPress={() => {}}>
            <Text style={s.modalTitle}>{selectedDay} {(t('gas.months', { returnObjects: true }) as string[])?.[displayMonth.getMonth()] || MESI[displayMonth.getMonth()]}</Text>
            
            <Text style={s.modalLabel}>{t('gas.refuelAmount')}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="€ 0"
              placeholderTextColor="#B0A898"
              keyboardType="numeric"
              value={dayAmount}
              onChangeText={setDayAmount}
            />
            
            <Text style={s.modalLabel}>{t('gas.noteLabel')}</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMulti]}
              placeholder={t('gas.notePlaceholder')}
              placeholderTextColor="#B0A898"
              multiline
              value={dayNote}
              onChangeText={setDayNote}
            />
            
            <View style={s.modalBtns}>
              {rifornimentiMese[selectedDay!] && rifornimentiMese[selectedDay!].length > 0 && (
                <TouchableOpacity style={s.modalBtnDelete} onPress={handleDeleteDayRifornimento}>
                  <Ionicons name="trash" size={18} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowDayModal(false)}>
                <Text style={s.modalBtnTxt}>{t('gas.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={handleSaveDayRifornimento}>
                <Ionicons name="save" size={16} color="#FFF" />
                <Text style={s.modalBtnTxt}>{t('gas.save')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ═══ Round 59 — RANGEPICKER condiviso (sostituisce vecchio CalendarModal PERS.) ═══ */}
      <RangePickerModal
        visible={periodOpen}
        onClose={() => setPeriodOpen(false)}
        onConfirm={(r) => {
          setPeriod(r);
          /* Round 67 — sincronizza anche il calendario sotto col mese
             di inizio del periodo scelto nel filtro sopra. */
          const d = new Date(r.from + 'T12:00:00');
          if (!isNaN(d.getTime())) setDisplayMonth(d);
        }}
        initialMode={period.mode}
        initialFrom={period.mode === 'pers' ? period.from : undefined}
        initialTo={period.mode === 'pers' ? period.to : undefined}
        themeColor="#1E7F85"
        title="Periodo Carburante"
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  // Input grande
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    // @ts-ignore
    boxShadow: '4px 4px 12px rgba(0,0,0,0.12)',
  },
  bigInput: {
    width: '65%',
    fontSize: 28,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    textAlign: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginLeft: 10,
    justifyContent: 'center',
  },
  saveBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  // Filtri
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E8E3D5',
    alignItems: 'center',
  },
  filterOn: {
    backgroundColor: '#E8A060',
  },
  filterTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A7575',
    letterSpacing: 0.5,
  },
  // KPI
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '2px 2px 8px rgba(0,0,0,0.08)',
  },
  kpiCardMain: {
    backgroundColor: '#E8A060',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7A9090',
    marginTop: 2,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A4040',
  },
  // Grafico
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    flex: 1,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 7,
    fontWeight: '800',
    color: '#1E7F85',
    marginBottom: 2,
  },
  barWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 40,
  },
  bar: {
    width: 18,
    borderRadius: 5,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: '#7A9090',
    marginTop: 3,
    fontWeight: '700',
  },
  // Calendario
  calCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    flex: 1.5,
    // @ts-ignore
    boxShadow: '3px 3px 10px rgba(0,0,0,0.1)',
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calMonthTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#7A9090',
  },
  calRow: {
    flexDirection: 'row',
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    margin: 1,
    minHeight: 36,
  },
  calDayActive: {
    backgroundColor: '#E8A060',
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  calDayTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A4040',
  },
  calDayAmount: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 1,
  },
  // Round 68 — legenda festività/scuole
  calLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDE5D5',
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calLegendTxt: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7A9090',
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    // @ts-ignore
    boxShadow: '0px 10px 30px rgba(0,0,0,0.25)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A4040',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A9090',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A4040',
  },
  modalInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalBtnDelete: {
    backgroundColor: '#D46A6A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: '#B0A898',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalBtnSave: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#1E7F85',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
