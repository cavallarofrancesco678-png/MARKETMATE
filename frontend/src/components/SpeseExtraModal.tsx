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
  setSpeseExtraFornitore: (v: Record<string, SpeseExtraEntry>) => void;
  vociGeneriche: VoceGenerica[];
  setVociGeneriche: (v: VoceGenerica[]) => void;
  fornInfo: Record<string, FornInfoEntry>;
  setFornInfo: (v: Record<string, FornInfoEntry>) => void;
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

  // Local state for input values to prevent re-render losing characters
  const [localImporti, setLocalImporti] = useState<Record<string, string>>({});

  // Sync local state when modal opens
  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      fornitori.forEach(f => {
        initial[f.nome] = speseExtraFornitore[f.nome]?.importo || '';
      });
      setLocalImporti(initial);
    }
  }, [visible]);

  const updateEntry = (key: string, field: 'importo' | 'periodo', value: string) => {
    if (field === 'importo') {
      // Update local state only for typing
      setLocalImporti(prev => ({ ...prev, [key]: value }));
    } else {
      // For periodo changes, update parent directly
      const current = speseExtraFornitore[key] || { importo: localImporti[key] || '', periodo: 'giornaliero' };
      setSpeseExtraFornitore({
        ...speseExtraFornitore,
        [key]: { ...current, [field]: value, importo: localImporti[key] || current.importo },
      });
    }
  };

  const flushImporto = (key: string) => {
    const val = localImporti[key];
    if (val !== undefined) {
      const current = speseExtraFornitore[key] || { importo: '', periodo: 'giornaliero' };
      setSpeseExtraFornitore({
        ...speseExtraFornitore,
        [key]: { ...current, importo: val },
      });
    }
  };

  const handleClose = () => {
    // Flush all local importi to parent state before closing
    const updated = { ...speseExtraFornitore };
    Object.entries(localImporti).forEach(([key, val]) => {
      const current = updated[key] || { importo: '', periodo: 'giornaliero' };
      updated[key] = { ...current, importo: val };
    });
    setSpeseExtraFornitore(updated);
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
                <View key={f.nome} style={st.card}>
                  <TouchableOpacity onPress={() => toggleForn(f.nome)} activeOpacity={0.7}>
                    <View style={st.fornHeader}>
                      <Ionicons name="storefront" size={16} color="#1E7F85" />
                      <Text style={st.cardTitle}>{f.nome}</Text>
                      {totFornitore > 0 ? (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, fontWeight: '900', color: '#1E7F85' }}>TOT €{totFornitore.toFixed(0)}</Text>
                      ) : (
                        <View style={{ marginLeft: 'auto' }} />
                      )}
                      {totFornitore > 0 ? (
                        <TouchableOpacity onPress={() => {
                          const updated = { ...speseExtraFornitore };
                          delete updated[f.nome];
                          delete updated[libKey];
                          setSpeseExtraFornitore(updated);
                          setLocalImporti(prev => { const n = { ...prev }; delete n[f.nome]; delete n[libKey]; return n; });
                        }} style={{ marginLeft: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={20} color="#D46A6A" />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#5A7575" style={{ marginLeft: 6 }} />
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
                            { key: 'CUSTOM', label: 'Personalizza' },
                          ] as const).map((opt) => {
                            const stored = fornDeductionType[f.nome] || 'DAILY';
                            const cur: 'DAILY' | 'CUSTOM' = stored === 'DAILY' ? 'DAILY' : 'CUSTOM';
                            const on = cur === opt.key;
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                onPress={() => {
                                  if (opt.key === 'DAILY') {
                                    setFornDeductionType({ ...fornDeductionType, [f.nome]: 'DAILY' });
                                  } else {
                                    const oldType = fornDeductionType[f.nome];
                                    const defDays = fornDeductionDays[f.nome] || (oldType === 'MONTHLY' ? 30 : 7);
                                    setFornDeductionType({ ...fornDeductionType, [f.nome]: 'CUSTOM' });
                                    setFornDeductionDays({ ...fornDeductionDays, [f.nome]: defDays });
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
                          const isCustom = stored !== 'DAILY';
                          if (!isCustom) return null;
                          const days = fornDeductionDays[f.nome] || 7;
                          const decDays = () => setFornDeductionDays({ ...fornDeductionDays, [f.nome]: Math.max(1, days - 1) });
                          const incDays = () => setFornDeductionDays({ ...fornDeductionDays, [f.nome]: Math.min(365, days + 1) });
                          const todayIso = (() => {
                            const t = new Date();
                            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                          })();
                          const startIso = fornDeductionStartDate[f.nome] || todayIso;
                          const startD = new Date(startIso + 'T00:00:00');
                          const endD = new Date(startD.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
                          const endIso = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
                          const GIORNI_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
                          const fmtFull = (d: Date) => `${GIORNI_LONG[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                          const isPickerOpen = periodoPickerFor === f.nome;
                          return (
                            <View style={{ marginTop: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                                <TouchableOpacity onPress={decDays} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: days > 1 ? '#1E7F85' : '#C0D0C8', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="remove" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7}
                                  onPress={() => setPeriodoPickerFor(isPickerOpen ? null : f.nome)}
                                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isPickerOpen ? '#FFF8E6' : '#FFF', borderRadius: 12, borderWidth: 2, borderColor: isPickerOpen ? '#D4AF37' : '#1E7F85', paddingHorizontal: 14, paddingVertical: 8, minWidth: 92, minHeight: 44, justifyContent: 'center', gap: 4 }}>
                                  <Ionicons name="calendar" size={16} color={isPickerOpen ? '#D4AF37' : '#1E7F85'} />
                                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A4040', minWidth: 32, textAlign: 'center' }}>{days}</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: isPickerOpen ? '#D4AF37' : '#1E7F85' }}>gg</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={incDays} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: days < 365 ? '#1E7F85' : '#C0D0C8', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="add" size={24} color="#FFF" />
                                </TouchableOpacity>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F5EFDC', borderRadius: 10, gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040' }}>
                                  Da <Text style={{ fontWeight: '900', color: '#1E7F85' }}>{fmtFull(startD)}</Text>
                                </Text>
                                <Text style={{ fontSize: 11, color: '#7A9090' }}>→</Text>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A4040' }}>
                                  Al <Text style={{ fontWeight: '900', color: '#1E7F85' }}>{fmtFull(endD)}</Text>
                                </Text>
                              </View>
                              {isPickerOpen && (
                                <View style={{ marginTop: 10, backgroundColor: '#F9F3E0', padding: 8, borderRadius: 10 }}>
                                  <Text style={{ fontSize: 9, color: '#7A9090', textAlign: 'center', marginBottom: 4, fontStyle: 'italic' }}>
                                    Tocca due date per impostare l'intervallo "Dal — Al"
                                  </Text>
                                  <MiniMonthCalendar
                                    selectedDates={[]}
                                    onToggleDate={() => {}}
                                    rangeMode={true}
                                    rangeFrom={startIso}
                                    rangeTo={endIso}
                                    onRangeChange={(from, to) => {
                                      if (from && !to) {
                                        setFornDeductionStartDate({ ...fornDeductionStartDate, [f.nome]: from });
                                      } else if (from && to) {
                                        const dF = new Date(from + 'T00:00:00').getTime();
                                        const dT = new Date(to + 'T00:00:00').getTime();
                                        const diff = Math.round((dT - dF) / (24 * 60 * 60 * 1000)) + 1;
                                        const nDays = Math.max(1, Math.min(365, diff));
                                        setFornDeductionStartDate({ ...fornDeductionStartDate, [f.nome]: from });
                                        setFornDeductionDays({ ...fornDeductionDays, [f.nome]: nDays });
                                        setPeriodoPickerFor(null);
                                      }
                                    }}
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
                                    const current = fornInfo[f.nome] || { numeroFattura: '', scadenza: '' };
                                    setFornInfo({ ...fornInfo, [f.nome]: { ...current, numeroFattura: v } });
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
                                    const current = fornInfo[f.nome] || { numeroFattura: '', scadenza: '' };
                                    const newScadenza = current.scadenza === iso ? '' : iso;
                                    setFornInfo({ ...fornInfo, [f.nome]: { ...current, scadenza: newScadenza } });
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

                        {/* ═══ FREQUENZA + PERIODO renderizzati QUI per mantenere
                            il campo importo nella stessa posizione tra
                            Giornaliera/Personalizza (richiesta utente Round 39). */}
                        {FrequenzaBlock}
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
