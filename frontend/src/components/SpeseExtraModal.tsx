import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import { useTranslation } from 'react-i18next';

interface Fornitore {
  nome: string;
  prodotti: { nome: string; prezzo: number }[];
}

interface SpeseExtraEntry {
  importo: string;
  periodo: string;
}

interface VoceGenerica {
  nome: string;
  importo: string;
  attivo: boolean;
  // Ripartizione costo (nuovo sistema): OGGI o PERSONALIZZA (range date)
  ripMode?: 'oggi' | 'custom';
  ripFrom?: string;
  ripTo?: string;
  // Legacy: periodicità (giornaliero/settimanale/mensile)
  periodo?: string;
}

interface FornInfoEntry {
  numeroFattura: string;
  scadenza: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  fornitori: Fornitore[];
  speseExtraFornitore: Record<string, SpeseExtraEntry>;
  setSpeseExtraFornitore: React.Dispatch<React.SetStateAction<Record<string, SpeseExtraEntry>>>;
  vociGeneriche: VoceGenerica[];
  setVociGeneriche: (v: VoceGenerica[]) => void;
  fornInfo: Record<string, FornInfoEntry>;
  setFornInfo: React.Dispatch<React.SetStateAction<Record<string, FornInfoEntry>>>;
  pagamentoMode: Record<string, 'contanti' | 'fattura' | 'misto'>;
  setPagamentoMode: (v: Record<string, 'contanti' | 'fattura' | 'misto'>) => void;
  // Frequenza di detrazione per fornitore: DAILY (default) | CUSTOM
  // Legacy values WEEKLY/MONTHLY accettati per retrocompat e mappati
  // a CUSTOM con 7/30 giorni rispettivamente all'ingresso del modal.
  fornDeductionType: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'>;
  setFornDeductionType: (v: Record<string, 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY'>) => void;
  // Numero di giorni del periodo personalizzato per ciascun fornitore (solo se CUSTOM)
  fornDeductionDays: Record<string, number>;
  setFornDeductionDays: (v: Record<string, number>) => void;
  // Data di inizio del periodo CUSTOM ('YYYY-MM-DD'). Se assente parte da oggi.
  fornDeductionStartDate: Record<string, string>;
  setFornDeductionStartDate: (v: Record<string, string>) => void;
  // Totali settimanali per fornitore (Lun-Dom): contanti / fattura
  weeklyTotalsByForn: Record<string, { contanti: number; fattura: number }>;
  /**
   * Round 43: Lordo del giorno corrente. Usato per mostrare un indicatore
   * visuale "Su €X di costo oggi hai venduto €Y" sotto ogni card fornitore.
   */
  lordoOggi?: number;
}

const PERIODI_LABELS: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Sett.',
  mensile: 'Mese',
};

export const SpeseExtraModal: React.FC<Props> = ({
  visible, onClose, fornitori, speseExtraFornitore, setSpeseExtraFornitore,
  vociGeneriche, setVociGeneriche, fornInfo, setFornInfo,
  pagamentoMode, setPagamentoMode,
  fornDeductionType, setFornDeductionType,
  fornDeductionDays, setFornDeductionDays,
  fornDeductionStartDate, setFornDeductionStartDate,
  weeklyTotalsByForn,
  lordoOggi = 0,
}) => {
  const { t } = useTranslation();
  const [nuovaVoce, setNuovaVoce] = useState('');
  const { speseExtraTags, addSpeseExtraTag, removeSpeseExtraTag } = useAppStore();
  const insets = useSafeAreaInsets();

  // Stato locale: quale fornitore sta aprendo il datepicker scadenza
  const [scadenzaPickerFor, setScadenzaPickerFor] = useState<string | null>(null);

  // Stato locale: quale fornitore sta aprendo il calendario "Dal — Al"
  // per il periodo CUSTOM. Quando è attivo, mostriamo il MiniMonthCalendar
  // in modalità range. Salviamo `from`/`to` direttamente in
  // fornDeductionStartDate + fornDeductionDays (delta in giorni).
  const [periodoPickerFor, setPeriodoPickerFor] = useState<string | null>(null);

  // Expansion states (fornitori + voci generiche - a pacchetto)
  const [expandedForn, setExpandedForn] = useState<Record<string, boolean>>({});
  const [expandedVoce, setExpandedVoce] = useState<Record<number, boolean>>({});

  const toggleForn = (nome: string) =>
    setExpandedForn(prev => ({ ...prev, [nome]: !prev[nome] }));
  const toggleVoce = (idx: number) =>
    setExpandedVoce(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Local state for input values to prevent re-render losing characters.
  // ⚠️ Round 41: snapshot LIVE del parent (speseExtraFornitore) cosi le
  // modifiche esterne (es. caricamento sessione) si propagano subito agli
  // input quando il modal è aperto. Tutti gli onChangeText scrivono PRIMA
  // sul parent (debounce) e POI aggiornano localImporti per il rendering
  // del TextInput. Questo evita il bug "valore sparisce dopo blur" perché
  // la sorgente di verità è SEMPRE il parent.
  const [localImporti, setLocalImporti] = useState<Record<string, string>>({});

  // Sync local state when modal opens AND when parent speseExtraFornitore
  // changes (es. dopo restore di sessione): rebuild i valori da parent.
  // Round 41: aggiungiamo `speseExtraFornitore` alla dependency array.
  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      // Carica TUTTE le chiavi da parent (sia fattura che __libera) — non
      // solo le entry su fornitori conosciuti. Ciò evita che switch
      // contanti↔fattura mostri campi vuoti.
      Object.entries(speseExtraFornitore).forEach(([k, v]) => {
        if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
        initial[k] = v?.importo || '';
      });
      // Garantisci che ogni fornitore visibile abbia almeno una key
      // inizializzata (vuota) per evitare re-init successivi.
      fornitori.forEach(f => {
        if (initial[f.nome] === undefined) initial[f.nome] = '';
        const lk = `${f.nome}__libera`;
        if (initial[lk] === undefined) initial[lk] = '';
      });
      setLocalImporti(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, speseExtraFornitore]);

  const updateEntry = (key: string, field: 'importo' | 'periodo', value: string) => {
    if (field === 'importo') {
      // ⚠️ Round 41bis (FIX critico stale closure): usa FUNCTIONAL UPDATER
      // ovunque mutiamo `speseExtraFornitore`. Senza `prev =>`, ogni
      // keystroke leggeva una versione obsoleta di speseExtraFornitore
      // catturata al render precedente → race condition: l'ultima
      // setSpeseExtraFornitore vinceva e sovrascriveva le precedenti con
      // dati STALE, causando la perdita del valore appena digitato.
      setLocalImporti(prev => ({ ...prev, [key]: value }));
      setSpeseExtraFornitore((prev: any) => {
        const current = prev[key] || { importo: '', periodo: 'giornaliero' };
        return { ...prev, [key]: { ...current, importo: value } };
      });
    } else {
      setSpeseExtraFornitore((prev: any) => {
        const current = prev[key] || { importo: localImporti[key] || '', periodo: 'giornaliero' };
        return { ...prev, [key]: { ...current, [field]: value, importo: localImporti[key] || current.importo } };
      });
    }
  };

  const flushImporto = (key: string) => {
    const val = localImporti[key];
    if (val !== undefined) {
      setSpeseExtraFornitore((prev: any) => {
        const current = prev[key] || { importo: '', periodo: 'giornaliero' };
        return { ...prev, [key]: { ...current, importo: val } };
      });
    }
  };

  const handleClose = () => {
    // Flush all local importi to parent state before closing (functional updater)
    setSpeseExtraFornitore((prev: any) => {
      const updated = { ...prev };
      Object.entries(localImporti).forEach(([key, val]) => {
        const current = updated[key] || { importo: '', periodo: 'giornaliero' };
        updated[key] = { ...current, importo: val };
      });
      return updated;
    });
    setLocalImporti({});
    onClose();
  };

  const addVoceGenerica = () => {
    if (!nuovaVoce.trim()) return;
    const tagName = nuovaVoce.trim();
    setVociGeneriche([...vociGeneriche, { nome: tagName, importo: '', attivo: true }]);
    addSpeseExtraTag(tagName);
    setNuovaVoce('');
  };

  const addVoceFromTag = (tag: string) => {
    const alreadyExists = vociGeneriche.some((v) => v.nome === tag);
    if (!alreadyExists) {
      setVociGeneriche([...vociGeneriche, { nome: tag, importo: '', attivo: true }]);
    }
  };

  const updateVoce = (idx: number, field: string, value: any) => {
    const updated = [...vociGeneriche];
    (updated[idx] as any)[field] = value;
    setVociGeneriche(updated);
  };

  const removeVoce = (idx: number) => {
    setVociGeneriche(vociGeneriche.filter((_, i) => i !== idx));
  };

  const getTotale = () => {
    let tot = 0;
    Object.entries(speseExtraFornitore).forEach(([key, v]) => {
      if (key.endsWith('__fattn') || key.endsWith('__liberaLabel')) return;
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      tot += imp;
    });
    vociGeneriche.forEach((v) => {
      if (!v.attivo) return;
      const imp = parseFloat((v.importo || '0').replace(',', '.')) || 0;
      if (imp <= 0) return;
      tot += imp;
    });
    return tot;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={st.container}>
          <View style={st.handle} />
          <View style={st.headerRow}>
            <Text style={st.title}>SPESE EXTRA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* ═══ Azzera rapido — utile per eliminare valori fantasma da vecchie versioni ═══ */}
              <TouchableOpacity
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  Alert.alert(
                    'Azzera spese di oggi',
                    'Vuoi cancellare TUTTE le voci spese e fornitori di oggi? L\'operazione è immediata.',
                    [
                      { text: 'Annulla', style: 'cancel' },
                      {
                        text: 'Azzera',
                        style: 'destructive',
                        onPress: () => {
                          setSpeseExtraFornitore({});
                          setVociGeneriche([]);
                          setLocalImporti({});
                          setPagamentoMode({});
                          setFornDeductionType({});
                        },
                      },
                    ]
                  );
                }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE8E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 }}
              >
                <Ionicons name="refresh" size={14} color="#B85450" />
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#B85450', letterSpacing: 0.5 }}>AZZERA</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color="#5A7575" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Totale del giorno:</Text>
            <Text style={st.totalVal}>{'\u20AC'}{getTotale().toFixed(0)}</Text>
          </View>

          {/* ═══ Round 47 — RIEPILOGO SETTIMANALE FORNITORI ═══
              Mini-riepilogo dei fornitori settimanali (WEEKLY) registrati
              oggi. NON viene incluso nel "totale del giorno" perché è una
              detrazione settimanale (Lun→Dom). La scritta "DA DEDURRE DAL
              LORDO" è stata rimossa su richiesta utente. */}
          {(() => {
            const weeklyRows: { nome: string; importo: number }[] = [];
            Object.keys(speseExtraFornitore).forEach((k) => {
              if (k.endsWith('__fattn') || k.endsWith('__liberaLabel')) return;
              const nomeBase = k.replace(/__libera$/, '');
              if (weeklyRows.some((r) => r.nome === nomeBase)) return;
              const mode = fornDeductionType[nomeBase] || 'DAILY';
              if (mode === 'DAILY') return;
              const impF = parseFloat((speseExtraFornitore[nomeBase]?.importo || '0').replace(',', '.')) || 0;
              const impC = parseFloat((speseExtraFornitore[`${nomeBase}__libera`]?.importo || '0').replace(',', '.')) || 0;
              const total = impF + impC;
              if (total <= 0) return;
              weeklyRows.push({ nome: nomeBase, importo: total });
            });
            if (weeklyRows.length === 0) return null;
            const sumWeekly = weeklyRows.reduce((s, r) => s + r.importo, 0);
            // Calcolo settimana Lun→Dom corrente
            const today = new Date();
            const dow = (today.getDay() + 6) % 7;
            const lun = new Date(today); lun.setDate(today.getDate() - dow);
            const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
            const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            return (
              <View style={{
                marginHorizontal: 16,
                marginTop: -4,
                marginBottom: 10,
                padding: 12,
                backgroundColor: '#FFF8E6',
                borderRadius: 12,
                borderLeftWidth: 3,
                borderLeftColor: '#D4AF37',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="calendar-outline" size={14} color="#B08050" />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#8A6A1F', letterSpacing: 0.5 }}>
                    SETTIMANALE ({fmt(lun)} → {fmt(dom)})
                  </Text>
                  <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '900', color: '#B08050' }}>
                    €{sumWeekly.toFixed(0)}
                  </Text>
                </View>
                {weeklyRows.map((r) => (
                  <Text key={r.nome} style={{ fontSize: 11, color: '#5A4A2A', lineHeight: 16 }}>
                    <Text style={{ fontWeight: '900' }}>{r.nome}</Text>: €{r.importo.toFixed(0)}
                  </Text>
                ))}
              </View>
            );
          })()}

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* ═══ FORNITORI ═══ */}
            {fornitori.length > 0 && (
              <Text style={st.sectionTitle}>FORNITORI</Text>
            )}
            {fornitori.map((f) => {
              const entry = speseExtraFornitore[f.nome] || { importo: '', periodo: 'giornaliero' };
              const libKey = `${f.nome}__libera`;
              const entryLib = speseExtraFornitore[libKey] || { importo: '', periodo: 'giornaliero' };
              const fatturato = parseFloat((localImporti[f.nome] !== undefined ? localImporti[f.nome] : entry.importo || '0').replace(',', '.')) || 0;
              const libera = parseFloat((localImporti[libKey] !== undefined ? localImporti[libKey] : entryLib.importo || '0').replace(',', '.')) || 0;
              const totFornitore = fatturato + libera;
              const isOpen = !!expandedForn[f.nome];
              return (
                <View key={f.nome} style={[st.card, isOpen && st.cardOpen]}>
                  <TouchableOpacity onPress={() => toggleForn(f.nome)} activeOpacity={0.7}>
                    <View style={st.fornHeader}>
                      <Ionicons name="storefront" size={16} color={isOpen ? '#FFF' : '#1E7F85'} />
                      <Text style={[st.cardTitle, isOpen && { color: '#FFF' }]}>{f.nome}</Text>
                      {totFornitore > 0 ? (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, fontWeight: '900', color: isOpen ? '#FFD86F' : '#1E7F85' }}>TOT €{totFornitore.toFixed(0)}</Text>
                      ) : (
                        <View style={{ marginLeft: 'auto' }} />
                      )}
                      {totFornitore > 0 ? (
                        <TouchableOpacity onPress={() => {
                          // Round 41bis: functional updater to avoid stale closure
                          setSpeseExtraFornitore((prev: any) => {
                            const updated = { ...prev };
                            delete updated[f.nome];
                            delete updated[libKey];
                            return updated;
                          });
                          setLocalImporti(prev => { const n = { ...prev }; delete n[f.nome]; delete n[libKey]; return n; });
                        }} style={{ marginLeft: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={20} color={isOpen ? '#FFD86F' : '#D46A6A'} />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={isOpen ? '#FFF' : '#5A7575'} style={{ marginLeft: 6 }} />
                    </View>
                  </TouchableOpacity>
                  {isOpen && (() => {
                    const mode = pagamentoMode[f.nome] || 'contanti';
                    const importoFatturaNum = parseFloat((entry.importo || '0').replace(',', '.')) || 0;
                    const importoContantiNum = parseFloat((entryLib.importo || '0').replace(',', '.')) || 0;
                    const setMode = (m: 'contanti' | 'fattura' | 'misto') => setPagamentoMode({ ...pagamentoMode, [f.nome]: m });
                    const wkTot = weeklyTotalsByForn[f.nome] || { contanti: 0, fattura: 0 };

                    /* ─── FREQUENZA + PERIODO block (renderizzato DOPO l'importo)
                           per garantire che il campo importo non si sposti in
                           basso quando l'utente passa da Giornaliera a
                           Personalizza. Richiesta utente: layout stabile. ─── */
                    const FrequenzaBlock = (
                      <>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginTop: 12, marginBottom: 4, letterSpacing: 0.5 }}>
                          FREQUENZA DI DETRAZIONE
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {([
                            { key: 'DAILY', label: 'Giornaliera' },
                            { key: 'WEEKLY', label: 'Settimanale' },
                          ] as const).map((opt) => {
                            // Round 47: solo DAILY o WEEKLY. Legacy CUSTOM/MONTHLY → mappati a WEEKLY
                            const stored = fornDeductionType[f.nome] || 'DAILY';
                            const cur: 'DAILY' | 'WEEKLY' = stored === 'DAILY' ? 'DAILY' : 'WEEKLY';
                            const on = cur === opt.key;
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                onPress={() => {
                                  // Aggiornamento type. WEEKLY = sempre Lun→Dom della
                                  // settimana corrente (no più date custom). Settiamo
                                  // days=7 per retrocompat con codice esistente.
                                  setFornDeductionType({ ...fornDeductionType, [f.nome]: opt.key });
                                  if (opt.key === 'WEEKLY') {
                                    setFornDeductionDays({ ...fornDeductionDays, [f.nome]: 7 });
                                  }
                                }}
                                activeOpacity={0.7}
                                style={{
                                  flex: 1,
                                  paddingVertical: 9,
                                  borderRadius: 999,
                                  backgroundColor: on ? '#1E7F85' : '#F5EFDC',
                                  borderWidth: 1.5,
                                  borderColor: on ? '#1E7F85' : '#E0D8C0',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '900', color: on ? '#FFF' : '#5A7575', letterSpacing: 0.4 }}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {(() => {
                          const stored = fornDeductionType[f.nome] || 'DAILY';
                          const isWeekly = stored !== 'DAILY';
                          if (!isWeekly) return null;
                          // Round 51: la settimana di riferimento è SCELTA DALL'UTENTE.
                          // - Default: settimana CORRENTE (lun→dom della settimana di oggi).
                          // - Persistita in fornDeductionStartDate[f.nome] (ISO del lunedì).
                          // - Tap sul box → apre MiniMonthCalendar; l'utente sceglie UN
                          //   giorno qualsiasi → l'app calcola la settimana Lun→Dom
                          //   corrispondente e salva il lunedì come start date.
                          const isoNow = (() => {
                            const t = new Date();
                            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                          })();
                          // Ricava il lunedì della settimana che contiene `iso`
                          const lunOfWeek = (iso: string): Date => {
                            const d = new Date(iso + 'T00:00:00');
                            const dow = (d.getDay() + 6) % 7;
                            const lun = new Date(d); lun.setDate(d.getDate() - dow);
                            return lun;
                          };
                          const startIso = fornDeductionStartDate[f.nome] || isoNow;
                          const lun = lunOfWeek(startIso);
                          const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
                          const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const GIORNI_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
                          const fmtFull = (d: Date) => `${GIORNI_LONG[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

                          const isPickerOpen = periodoPickerFor === f.nome;
                          // Navigatori settimana ± 1
                          const shiftWeek = (deltaDays: number) => {
                            const newLun = new Date(lun); newLun.setDate(lun.getDate() + deltaDays);
                            setFornDeductionStartDate({ ...fornDeductionStartDate, [f.nome]: isoOf(newLun) });
                          };

                          return (
                            <View style={{ marginTop: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  onPress={() => shiftWeek(-7)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="chevron-back" size={20} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => setPeriodoPickerFor(isPickerOpen ? null : f.nome)}
                                  style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingHorizontal: 10, paddingVertical: 9,
                                    backgroundColor: isPickerOpen ? '#FFF8E6' : '#F5EFDC',
                                    borderRadius: 10, gap: 6, flexWrap: 'wrap',
                                    borderWidth: 1.5, borderColor: isPickerOpen ? '#D4AF37' : '#E0D8C0',
                                  }}
                                >
                                  <Ionicons name="calendar" size={14} color={isPickerOpen ? '#D4AF37' : '#1E7F85'} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040' }}>
                                    <Text style={{ fontWeight: '900', color: '#1E7F85' }}>{fmtFull(lun)}</Text>
                                  </Text>
                                  <Text style={{ fontSize: 11, color: '#7A9090' }}>→</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040' }}>{fmtFull(dom)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => shiftWeek(7)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E7F85', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                                </TouchableOpacity>
                              </View>
                              {/* Mini calendar picker: clic singolo su un giorno qualsiasi
                                  → l'app deduce il lunedì della settimana e lo salva */}
                              {isPickerOpen && (
                                <View style={{ marginTop: 10, backgroundColor: '#F9F3E0', padding: 8, borderRadius: 10 }}>
                                  <Text style={{ fontSize: 9, color: '#7A9090', textAlign: 'center', marginBottom: 4, fontStyle: 'italic' }}>
                                    Tocca un giorno qualsiasi: l'app userà la settimana (Lun→Dom) corrispondente
                                  </Text>
                                  <MiniMonthCalendar
                                    selectedDates={[isoOf(lun), isoOf(dom)]}
                                    onToggleDate={(dateIso) => {
                                      const chosenLun = lunOfWeek(dateIso);
                                      setFornDeductionStartDate({ ...fornDeductionStartDate, [f.nome]: isoOf(chosenLun) });
                                      setPeriodoPickerFor(null);
                                    }}
                                    rangeMode={true}
                                    rangeFrom={isoOf(lun)}
                                    rangeTo={isoOf(dom)}
                                    themeColor="#1E7F85"
                                  />
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </>
                    );

                    return (
                      <>
                        {/* ═══ 3 PULSANTI: CONTANTI | FATTURA | MISTO (monocolore: verde se attivo) ═══ */}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          {([
                            { key: 'contanti', label: t('suppliers.cash') },
                            { key: 'fattura', label: t('suppliers.invoice') },
                            { key: 'misto', label: t('suppliers.mixed') },
                          ] as const).map((opt) => {
                            const on = mode === opt.key;
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                onPress={() => setMode(opt.key)}
                                activeOpacity={0.7}
                                style={{
                                  flex: 1,
                                  paddingVertical: 9,
                                  borderRadius: 10,
                                  backgroundColor: on ? '#1E7F85' : '#F5EFDC',
                                  borderWidth: 1.5,
                                  borderColor: on ? '#1E7F85' : '#E0D8C0',
                                  alignItems: 'center',
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '900', color: on ? '#FFF' : '#5A7575', letterSpacing: 0.8 }}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* FREQUENZA+PERIODO bloccati renderizzati DOPO i campi importo (vedi sotto) */}

                        {/* ═══ CONTANTI: solo importo + totale settimanale ═══ */}
                        {mode === 'contanti' && (
                          <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2 }}>{t('suppliers.cashAmount')}</Text>
                            <View style={st.inputRow}>
                              <TextInput
                                style={st.amountInput}
                                placeholder="0"
                                placeholderTextColor="#B0B0A0"
                                keyboardType="decimal-pad"
                                value={localImporti[libKey] !== undefined ? localImporti[libKey] : (entryLib.importo || '')}
                                onChangeText={(v) => updateEntry(libKey, 'importo', v)}
                                onBlur={() => flushImporto(libKey)}
                                onEndEditing={() => flushImporto(libKey)}
                                returnKeyType="done"
                              />
                              <Text style={st.euro}>{'\u20AC'}</Text>
                            </View>
                            {/* Box "Settimana: €X in contanti..." rimosso (richiesta utente: pulizia interfaccia). */}
                          </View>
                        )}

                        {/* ═══ FATTURA: N° + scadenza + importo + totale settimanale fatture ═══ */}
                        {(mode === 'fattura' || mode === 'misto') && (
                          <View style={{ marginTop: 10 }}>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
                              <View style={{ flex: 1.2 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2 }}>{t('suppliers.invoiceNumber')}</Text>
                                <TextInput
                                  style={st.fattInput}
                                  placeholder="es. 2025/127"
                                  placeholderTextColor="#C0C0B0"
                                  value={(fornInfo[f.nome]?.numeroFattura) || ''}
                                  onChangeText={(v) => {
                                    // Round 42: functional updater per evitare stale closure su typing veloce
                                    setFornInfo((prev: any) => {
                                      const current = prev[f.nome] || { numeroFattura: '', scadenza: '' };
                                      return { ...prev, [f.nome]: { ...current, numeroFattura: v } };
                                    });
                                  }}
                                  returnKeyType="done"
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2 }}>{t('suppliers.dueDate')}</Text>
                                <TouchableOpacity
                                  style={st.scadenzaBtn}
                                  onPress={() => setScadenzaPickerFor(scadenzaPickerFor === f.nome ? null : f.nome)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="calendar" size={12} color="#B08050" />
                                  <Text style={{ fontSize: 11, color: fornInfo[f.nome]?.scadenza ? '#1A4040' : '#B0B0A0', fontWeight: '700', flex: 1, marginLeft: 4 }}>
                                    {fornInfo[f.nome]?.scadenza
                                      ? (() => { const [y, m, d] = fornInfo[f.nome].scadenza.split('-'); return `${d}/${m}/${y.slice(2)}`; })()
                                      : t('suppliers.chooseDate')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {scadenzaPickerFor === f.nome && (
                              <View style={{ marginTop: 8, backgroundColor: '#F9F3E0', padding: 8, borderRadius: 10 }}>
                                <MiniMonthCalendar
                                  selectedDates={fornInfo[f.nome]?.scadenza ? [fornInfo[f.nome].scadenza] : []}
                                  onToggleDate={(iso) => {
                                    // Round 42: functional updater per evitare stale closure
                                    setFornInfo((prev: any) => {
                                      const current = prev[f.nome] || { numeroFattura: '', scadenza: '' };
                                      const newScadenza = current.scadenza === iso ? '' : iso;
                                      return { ...prev, [f.nome]: { ...current, scadenza: newScadenza } };
                                    });
                                    setScadenzaPickerFor(null);
                                  }}
                                  themeColor="#B08050"
                                />
                              </View>
                            )}

                            {/* Importo Fattura */}
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2 }}>{t('suppliers.invoiceAmount')}</Text>
                              <View style={st.inputRow}>
                                <TextInput
                                  style={st.amountInput}
                                  placeholder="0"
                                  placeholderTextColor="#B0B0A0"
                                  keyboardType="decimal-pad"
                                  value={localImporti[f.nome] !== undefined ? localImporti[f.nome] : (entry.importo || '')}
                                  onChangeText={(v) => updateEntry(f.nome, 'importo', v)}
                                  onBlur={() => flushImporto(f.nome)}
                                  onEndEditing={() => flushImporto(f.nome)}
                                  returnKeyType="done"
                                />
                                <Text style={st.euro}>{'\u20AC'}</Text>
                              </View>
                            </View>

                            {/* Box "Settimana: €X di fatture..." rimosso (richiesta utente: pulizia interfaccia). */}
                          </View>
                        )}

                        {/* ═══ MISTO: importo contanti + totale settimanale combinato ═══ */}
                        {mode === 'misto' && (
                          <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#7A9090', marginBottom: 2 }}>{t('suppliers.cashAmount')}</Text>
                            <View style={st.inputRow}>
                              <TextInput
                                style={st.amountInput}
                                placeholder="0"
                                placeholderTextColor="#B0B0A0"
                                keyboardType="decimal-pad"
                                value={localImporti[libKey] !== undefined ? localImporti[libKey] : (entryLib.importo || '')}
                                onChangeText={(v) => updateEntry(libKey, 'importo', v)}
                                onBlur={() => flushImporto(libKey)}
                                onEndEditing={() => flushImporto(libKey)}
                                returnKeyType="done"
                              />
                              <Text style={st.euro}>{'\u20AC'}</Text>
                            </View>
                            {/* Box "Settimana: €X totali..." rimosso (richiesta utente: pulizia interfaccia). */}
                          </View>
                        )}

                        {/* "COSTO vs INCASSATO OGGI" RIMOSSO (Round 46 — richiesta utente).
                            La nuova logica Personalizza è una detrazione fissa di periodo
                            visualizzata in Statistiche / Buongiorno IA, non per fornitore. */}

                        {/* ═══ FREQUENZA + PERIODO renderizzati QUI per mantenere
                            il campo importo nella stessa posizione tra
                            Giornaliera/Personalizza (richiesta utente Round 39). */}
                        {FrequenzaBlock}

                        {/* ═══ Round 50: bottone SALVA — chiude SOLO questo
                            accordion (NON il modal). L'utente resta nelle
                            Spese Extra per aggiungere altri fornitori.
                            Esce dal modal solo cliccando CONFERMA in basso. */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            // Flush importi locali → state globale prima di chiudere
                            flushImporto(f.nome);
                            flushImporto(libKey);
                            // Chiudi solo questo accordion
                            setExpandedForn(prev => ({ ...prev, [f.nome]: false }));
                          }}
                          style={{
                            marginTop: 14,
                            backgroundColor: '#FFD86F',
                            borderRadius: 12,
                            paddingVertical: 11,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 6,
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#1A4040" />
                          <Text style={{ fontSize: 13, fontWeight: '900', color: '#1A4040', letterSpacing: 0.6 }}>
                            SALVA FORNITORE
                          </Text>
                        </TouchableOpacity>
                      </>
                    );
                  })()}
                </View>
              );
            })}

            {/* ═══ SPESE EXTRA GENERICHE ═══ */}
            <Text style={st.sectionTitle}>SPESE EXTRA GENERICHE</Text>

            {vociGeneriche.map((v, idx) => {
              const isOpen = !!expandedVoce[idx];
              const importNum = parseFloat((v.importo || '0').replace(',', '.')) || 0;
              return (
                <View key={idx} style={st.card}>
                  <TouchableOpacity onPress={() => toggleVoce(idx)} activeOpacity={0.7}>
                    <View style={st.fornHeader}>
                      <Ionicons name="receipt-outline" size={16} color="#1E7F85" />
                      <Text style={st.cardTitle}>{v.nome}</Text>
                      {importNum > 0 ? (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, fontWeight: '900', color: '#1E7F85' }}>€{importNum.toFixed(0)}</Text>
                      ) : (
                        <View style={{ marginLeft: 'auto' }} />
                      )}
                      <TouchableOpacity onPress={() => removeVoce(idx)} style={{ marginLeft: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color="#D46A6A" />
                      </TouchableOpacity>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#5A7575" style={{ marginLeft: 6 }} />
                    </View>
                  </TouchableOpacity>
                  {isOpen && (() => {
                    return (
                      <>
                        <View style={st.inputRow}>
                          <TextInput
                            style={st.amountInput}
                            placeholder="0"
                            placeholderTextColor="#B0B0A0"
                            keyboardType="decimal-pad"
                            value={v.importo}
                            onChangeText={(val) => updateVoce(idx, 'importo', val)}
                            returnKeyType="done"
                          />
                          <Text style={st.euro}>{'\u20AC'}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              );
            })}

            {/* ═══ TAG SALVATI (quick add + X per rimuovere) ═══ */}
            {speseExtraTags.length > 0 && (
              <View style={st.tagsRow}>
                {speseExtraTags
                  .filter((tag) => !vociGeneriche.some((v) => v.nome === tag))
                  .map((tag) => (
                    <View key={tag} style={st.tagChip}>
                      <TouchableOpacity onPress={() => addVoceFromTag(tag)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="add-circle-outline" size={14} color="#1E7F85" />
                        <Text style={st.tagChipTxt}>{tag}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeSpeseExtraTag(tag)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={{ marginLeft: 6 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#D46A6A" />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}

            {/* Aggiungi nuova voce */}
            <View style={st.addRow}>
              <TextInput
                style={st.addInput}
                placeholder="Nuova voce (es: Colazione)"
                placeholderTextColor="#B0B0A0"
                value={nuovaVoce}
                onChangeText={setNuovaVoce}
                onSubmitEditing={addVoceGenerica}
              />
              <TouchableOpacity style={st.addBtn} onPress={addVoceGenerica}>
                <Ionicons name="add" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          <TouchableOpacity style={[st.confirmBtn, { marginBottom: Math.max(insets.bottom, 8) + 8 }]} onPress={handleClose} activeOpacity={0.8}>
            <Text style={st.confirmTxt}>CONFERMA</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: {
    flex: 1, backgroundColor: '#D8EDE5', marginTop: 60,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  handle: { width: 40, height: 4, backgroundColor: '#B0C4BC', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', letterSpacing: 1.5 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 16,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#5A7575' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#1A3535' },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#5A7575', letterSpacing: 1.5, marginTop: 12, marginBottom: 8 },
  card: {
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14, marginBottom: 10,
    // @ts-ignore
    boxShadow: '5px 5px 12px rgba(160,150,130,0.45), -4px -4px 10px rgba(255,255,250,0.9)',
  },
  // Round 50: card aperta — sfondo teal scuro (come bottone home cliccato)
  cardOpen: {
    backgroundColor: '#1A4040',
    // @ts-ignore
    boxShadow: '0 4px 14px rgba(30,127,133,0.45), inset 0 1px 2px rgba(255,255,255,0.15)',
  },
  fornHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  prodottiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#D8EDE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { fontSize: 9, fontWeight: '600', color: '#5A7575' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  amountInput: {
    flex: 1, fontSize: 18, fontWeight: '800', color: '#1A3535',
    backgroundColor: '#E0DBC8', borderRadius: 10, padding: 8, textAlign: 'center',
  },
  fattInput: {
    fontSize: 12, fontWeight: '700', color: '#1A4040',
    backgroundColor: '#F0EBD8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#D8D0B8',
  },
  scadenzaBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0EBD8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: '#D8D0B8',
  },
  euro: { fontSize: 16, fontWeight: '800', color: '#5A7575' },
  periodoRow: { flexDirection: 'row', gap: 6 },
  periodoBtn: {
    flex: 1, backgroundColor: '#E0DBC8', borderRadius: 10, paddingVertical: 7, alignItems: 'center',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.85)',
  },
  periodoBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow: '3px 3px 6px rgba(15,55,60,0.5), -2px -2px 5px rgba(45,120,125,0.35)',
  },
  periodoTxt: { fontSize: 10, fontWeight: '800', color: '#4A3A2A' },
  voceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voceName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1A3535' },
  voceInput: {
    width: 70, fontSize: 16, fontWeight: '800', color: '#1A3535',
    backgroundColor: '#E0DBC8', borderRadius: 8, padding: 6, textAlign: 'right',
  },
  deleteBtn: { padding: 4 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D8EDE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#A5D8D0',
  },
  tagChipTxt: { fontSize: 11, fontWeight: '700', color: '#1E7F85' },
  addInput: {
    flex: 1, fontSize: 14, color: '#1A3535', backgroundColor: '#EDE8DA',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    // @ts-ignore
    boxShadow: 'inset 2px 2px 5px rgba(160,150,130,0.3), inset -2px -2px 5px rgba(255,255,250,0.7)',
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#1E7F85',
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore
    boxShadow: '4px 4px 10px rgba(15,55,60,0.5)',
  },
  confirmBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  confirmTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  weeklyBox: {
    marginTop: 8,
    backgroundColor: '#F5F0E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#5A7575',
  },
  weeklyLine: { fontSize: 14, color: '#1A4040', lineHeight: 19, fontWeight: '700' },
  weeklyAmt: { fontWeight: '900' },
  weeklyHint: { fontSize: 14, color: '#5A7575', fontStyle: 'italic', marginTop: 6, fontWeight: '700' },
});
