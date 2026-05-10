/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SupplierSettings — Schermata A: Configurazione FORNITORI dedicata
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Layout (Gold/Teal neumorphic, coerente col resto della app):
 *  ┌─────────────────────────────────────────────────────────┐
 *  │ [←]   FORNITORI / RICARICHI                  [+ AGGIUNGI]│
 *  │─────────────────────────────────────────────────────────│
 *  │  ▼ ANDREA PANE                                ✏ 🗑      │
 *  │   ─────────────────────────────────────────────────────  │
 *  │   RICARICO MEDIO FORNITORE   [ 70 % ]                   │
 *  │   ─────────────────────────────────────────────────────  │
 *  │   PRODOTTI                                              │
 *  │   • Pane Toscano    €2.50 → €4.25 (+70%)   [overwrite]  │
 *  │   • Focaccia        €3.00 → €5.10           [✓ €5.50]   │
 *  │   [+ AGGIUNGI PRODOTTO]                                 │
 *  └─────────────────────────────────────────────────────────┘
 *
 * Note implementative:
 *  - Niente UI di "ripartizione %" sui giorni: quel calcolo è 100% backend
 *    (vedi /app/frontend/src/utils/proporzionaleFornitori.ts)
 *  - Il `prezzo` viene calcolato live dal `costo × (1 + ricarico/100)`
 *    A MENO CHE l'utente non lo overwriti manualmente (toggle dedicato)
 *  - Modifica nome fornitore avviene tramite tap sul nome
 *  - Supporta i tre ruoli: AMMINISTRATORE/MANAGER/UTENTE — solo admin
 *    e manager possono modificare ricarico e prodotti
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, type Fornitore, type Prodotto } from '../../src/store/appStore';
import { calcolaPrezzoSuggerito } from '../../src/utils/proporzionaleFornitori';

const DEFAULT_RICARICO = 70;

export default function SupplierSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const fornitori = useAppStore((s) => s.fornitori);
  const setConfig = useAppStore((s) => s.setConfig);
  const addFornitore = useAppStore((s) => s.addFornitore);
  const removeFornitore = useAppStore((s) => s.removeFornitore);

  // Indice del fornitore espanso (uno alla volta per chiarezza)
  const [expanded, setExpanded] = useState<number | null>(0);

  // Modal "aggiungi" o "rinomina"
  const [modalState, setModalState] = useState<
    null | { type: 'add-fornitore' } | { type: 'rename-fornitore'; index: number } | { type: 'add-prodotto'; fIdx: number }
  >(null);
  const [modalText, setModalText] = useState('');
  const [modalCost, setModalCost] = useState('');

  const closeModal = () => {
    setModalState(null);
    setModalText('');
    setModalCost('');
  };

  // ─────────────────────────────────────────────────────────────
  // Operazioni mutazione (immutable update via setConfig)
  // ─────────────────────────────────────────────────────────────
  const updateFornitore = (idx: number, patch: Partial<Fornitore>) => {
    const next = fornitori.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setConfig({ fornitori: next });
  };

  const updateProdotto = (fIdx: number, pIdx: number, patch: Partial<Prodotto>) => {
    const f = fornitori[fIdx];
    if (!f) return;
    const nextProdotti = f.prodotti.map((p, i) => (i === pIdx ? { ...p, ...patch } : p));
    updateFornitore(fIdx, { prodotti: nextProdotti });
  };

  const removeProdotto = (fIdx: number, pIdx: number) => {
    const f = fornitori[fIdx];
    if (!f) return;
    updateFornitore(fIdx, { prodotti: f.prodotti.filter((_, i) => i !== pIdx) });
  };

  // ─────────────────────────────────────────────────────────────
  // Modal handlers
  // ─────────────────────────────────────────────────────────────
  const onModalSave = () => {
    if (!modalState) return;
    const txt = modalText.trim();
    if (modalState.type === 'add-fornitore') {
      if (!txt) { closeModal(); return; }
      addFornitore({ nome: txt, prodotti: [], ricaricoMedio: DEFAULT_RICARICO });
    } else if (modalState.type === 'rename-fornitore') {
      if (!txt) { closeModal(); return; }
      updateFornitore(modalState.index, { nome: txt });
    } else if (modalState.type === 'add-prodotto') {
      if (!txt) { closeModal(); return; }
      const f = fornitori[modalState.fIdx];
      if (!f) { closeModal(); return; }
      const ric = f.ricaricoMedio ?? DEFAULT_RICARICO;
      const cost = parseFloat(modalCost.replace(',', '.')) || 0;
      const prezzo = calcolaPrezzoSuggerito(cost, ric);
      updateFornitore(modalState.fIdx, {
        prodotti: [...f.prodotti, { nome: txt, costo: cost, prezzo, prezzoOverwrite: false }],
      });
    }
    closeModal();
  };

  const confirmDeleteFornitore = (nome: string) => {
    const doDel = () => removeFornitore(nome);
    if (Platform.OS === 'web') {
      if (window.confirm(`Eliminare il fornitore "${nome}" e tutti i suoi prodotti?`)) doDel();
    } else {
      Alert.alert(
        t('supplier.confirmDeleteTitle') || 'Elimina fornitore',
        (t('supplier.confirmDeleteDesc', { nome }) as string) || `Eliminare "${nome}" e tutti i suoi prodotti?`,
        [
          { text: t('common.cancel') || 'Annulla', style: 'cancel' },
          { text: t('common.delete') || 'Elimina', style: 'destructive', onPress: doDel },
        ]
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={26} color="#1A4040" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('supplier.title') || 'FORNITORI / RICARICHI'}</Text>
        <TouchableOpacity
          onPress={() => { setModalState({ type: 'add-fornitore' }); setModalText(''); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="add-circle" size={28} color="#1E7F85" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* INFO BOX — spiega la logica all'utente */}
        <View style={s.infoBox}>
          <Ionicons name="information-circle" size={18} color="#1E7F85" />
          <Text style={s.infoTxt}>
            {t('supplier.infoBox') ||
              "Imposta il ricarico medio e i prodotti del fornitore. La ripartizione del costo merce sui giorni avviene automaticamente in base agli incassi."}
          </Text>
        </View>

        {/* LISTA FORNITORI */}
        {fornitori.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={32} color="#B0B0A0" />
            <Text style={s.emptyTxt}>
              {t('supplier.empty') || 'Nessun fornitore configurato'}
            </Text>
            <TouchableOpacity
              style={s.emptyCta}
              onPress={() => { setModalState({ type: 'add-fornitore' }); setModalText(''); }}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={s.emptyCtaTxt}>{t('supplier.addFirst') || 'AGGIUNGI IL PRIMO'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          fornitori.map((f, fIdx) => {
            const isOpen = expanded === fIdx;
            const ric = f.ricaricoMedio ?? DEFAULT_RICARICO;
            return (
              <View key={`${f.nome}-${fIdx}`} style={s.card} testID={`forn-card-${fIdx}`}>
                <TouchableOpacity
                  style={s.cardHeader}
                  activeOpacity={0.7}
                  onPress={() => setExpanded(isOpen ? null : fIdx)}
                >
                  <Ionicons name="cube" size={22} color="#1E7F85" />
                  <Text style={s.fornitoreName}>{f.nome}</Text>
                  <View style={s.ricaricoBadge}>
                    <Text style={s.ricaricoBadgeTxt}>{ric}%</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setModalState({ type: 'rename-fornitore', index: fIdx }); setModalText(f.nome); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#7A9090" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteFornitore(f.nome)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#D46A6A" />
                  </TouchableOpacity>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                {isOpen && (
                  <View style={s.cardBody}>
                    {/* RICARICO MEDIO */}
                    <View style={s.ricaricoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>{t('supplier.avgMarkup') || 'RICARICO MEDIO FORNITORE'}</Text>
                        <Text style={s.fieldHint}>
                          {t('supplier.avgMarkupHint') || 'Usato come default per calcolare i prezzi suggeriti'}
                        </Text>
                      </View>
                      <View style={s.ricaricoInputBox}>
                        <TextInput
                          style={s.ricaricoInput}
                          value={String(ric)}
                          onChangeText={(v) => {
                            const n = parseFloat(v.replace(',', '.'));
                            if (!isNaN(n) && n >= 0 && n <= 999) {
                              const nextProdotti = f.prodotti.map((p) =>
                                p.prezzoOverwrite || !p.costo
                                  ? p
                                  : { ...p, prezzo: calcolaPrezzoSuggerito(p.costo, n) }
                              );
                              updateFornitore(fIdx, { ricaricoMedio: n, prodotti: nextProdotti });
                            } else if (v === '') {
                              updateFornitore(fIdx, { ricaricoMedio: 0 });
                            }
                          }}
                          keyboardType="numeric"
                          maxLength={5}
                          textAlign="center"
                        />
                        <Text style={s.percentLabel}>%</Text>
                      </View>
                    </View>

                    <View style={s.divider} />

                    {/* PRODOTTI */}
                    <Text style={s.sectionLabel}>{t('supplier.products') || 'PRODOTTI'}</Text>
                    {f.prodotti.length === 0 ? (
                      <Text style={s.emptyProdTxt}>
                        {t('supplier.noProducts') || 'Nessun prodotto. Aggiungine uno qui sotto.'}
                      </Text>
                    ) : (
                      f.prodotti.map((p, pIdx) => (
                        <ProductRow
                          key={`${p.nome}-${pIdx}`}
                          prodotto={p}
                          ricaricoMedio={ric}
                          onChange={(patch) => updateProdotto(fIdx, pIdx, patch)}
                          onDelete={() => removeProdotto(fIdx, pIdx)}
                        />
                      ))
                    )}

                    <TouchableOpacity
                      style={s.addProdBtn}
                      onPress={() => { setModalState({ type: 'add-prodotto', fIdx }); setModalText(''); setModalCost(''); }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#1E7F85" />
                      <Text style={s.addProdTxt}>{t('supplier.addProduct') || 'AGGIUNGI PRODOTTO'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL: aggiungi/rinomina fornitore o aggiungi prodotto */}
      <Modal visible={!!modalState} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ms.overlay}>
          <View style={ms.card}>
            <Text style={ms.title}>
              {modalState?.type === 'add-fornitore' && (t('supplier.newFornitore') || 'Nuovo fornitore')}
              {modalState?.type === 'rename-fornitore' && (t('supplier.renameFornitore') || 'Rinomina fornitore')}
              {modalState?.type === 'add-prodotto' && (t('supplier.newProduct') || 'Nuovo prodotto')}
            </Text>
            <TextInput
              style={ms.input}
              placeholder={
                modalState?.type === 'add-prodotto'
                  ? (t('supplier.productNamePlaceholder') || 'Nome prodotto (es. Pane Toscano)')
                  : (t('supplier.fornitoreNamePlaceholder') || 'Nome fornitore (es. Andrea Pane)')
              }
              placeholderTextColor="#9A9890"
              value={modalText}
              onChangeText={setModalText}
              autoFocus
            />
            {modalState?.type === 'add-prodotto' && (
              <TextInput
                style={[ms.input, { marginTop: 10 }]}
                placeholder={t('supplier.costPlaceholder') || 'Costo unitario € (es. 2.50)'}
                placeholderTextColor="#9A9890"
                value={modalCost}
                onChangeText={setModalCost}
                keyboardType="numeric"
              />
            )}
            <View style={ms.btnRow}>
              <TouchableOpacity style={[ms.btn, ms.btnGhost]} onPress={closeModal}>
                <Text style={ms.btnGhostTxt}>{t('common.cancel') || 'ANNULLA'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.btn, ms.btnPrimary]} onPress={onModalSave}>
                <Text style={ms.btnPrimaryTxt}>{t('common.save') || 'SALVA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ProductRow — singola riga prodotto: costo / prezzo suggerito / overwrite
// ─────────────────────────────────────────────────────────────────────
interface ProductRowProps {
  prodotto: Prodotto;
  ricaricoMedio: number;
  onChange: (patch: Partial<Prodotto>) => void;
  onDelete: () => void;
}

/** Regex per accettare numeri decimali in fase di digitazione:
 *  - vuoto, oppure
 *  - cifre, opzionale punto/virgola e fino a 2 decimali */
const NUM_INPUT_RE = /^\d*[.,]?\d{0,2}$/;

const ProductRow: React.FC<ProductRowProps> = ({ prodotto, ricaricoMedio, onChange, onDelete }) => {
  const { t } = useTranslation();

  // ─── State LOCALE per gli input numerici ───────────────────────────
  // Bug fix: prima usavamo direttamente `prodotto.costo` come `value`
  // del TextInput → `parseFloat("4.")` = 4 → React forzava il value a "4"
  // → il punto decimale spariva mentre l'utente stava ancora digitando.
  // Ora teniamo una stringa di EDITING locale e parsiamo solo onBlur o
  // quando il valore è chiaramente completo (es. "4.90").
  const [costoText, setCostoText] = React.useState<string>(
    prodotto.costo ? String(prodotto.costo) : ''
  );
  const [prezzoText, setPrezzoText] = React.useState<string>(
    prodotto.prezzo ? String(prodotto.prezzo) : ''
  );

  // Se il ricarico medio cambia esternamente (es. l'utente lo modifica
  // dal campo del fornitore) e questo prodotto NON è in overwrite,
  // ricalcoliamo il prezzo suggerito anche nel testo della riga.
  React.useEffect(() => {
    if (!prodotto.prezzoOverwrite) {
      setPrezzoText(prodotto.prezzo ? String(prodotto.prezzo) : '');
    }
  }, [prodotto.prezzo, prodotto.prezzoOverwrite]);

  // ─── Helpers parsing ────────────────────────────────────────────────
  const parseNum = (s: string): number => {
    const n = parseFloat((s || '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  // ─── Costo: handlers ────────────────────────────────────────────────
  const handleCostChange = (v: string) => {
    // Accetta solo input numerici parziali (es. "4." durante la digitazione)
    if (v === '' || NUM_INPUT_RE.test(v)) {
      setCostoText(v);
    }
  };
  const commitCost = () => {
    const cost = parseNum(costoText);
    if (cost <= 0) {
      onChange({ costo: 0 });
      return;
    }
    if (prodotto.prezzoOverwrite) {
      onChange({ costo: cost });
      // (non aggiorniamo il prezzo: l'utente ha imposto un prezzo manuale)
    } else {
      const newPrezzo = calcolaPrezzoSuggerito(cost, ricaricoMedio);
      setPrezzoText(String(newPrezzo));
      onChange({ costo: cost, prezzo: newPrezzo });
    }
  };

  // ─── Prezzo: handlers ───────────────────────────────────────────────
  const handlePriceChange = (v: string) => {
    if (v === '' || NUM_INPUT_RE.test(v)) {
      setPrezzoText(v);
    }
  };
  const commitPrice = () => {
    const p = parseNum(prezzoText);
    if (p <= 0) {
      onChange({ prezzo: 0, prezzoOverwrite: false });
      return;
    }
    onChange({ prezzo: p, prezzoOverwrite: true });
  };

  const handleResetOverwrite = () => {
    const newPrezzo = calcolaPrezzoSuggerito(prodotto.costo || 0, ricaricoMedio);
    setPrezzoText(String(newPrezzo));
    onChange({
      prezzoOverwrite: false,
      prezzo: newPrezzo,
    });
  };

  // ─── Calcolo del ricarico effettivo (utile quando l'utente fa overwrite) ─
  // Esempio: costo 2€, prezzo manuale 5€ → ricarico effettivo 150%
  // Mostriamo SEMPRE il ricarico effettivo della riga, così l'utente vede
  // subito di quanto si discosta dal default del fornitore.
  const ricaricoEffettivo = React.useMemo(() => {
    const c = prodotto.costo || 0;
    const p = prodotto.prezzo || 0;
    if (c <= 0 || p <= 0) return null;
    return ((p / c - 1) * 100);
  }, [prodotto.costo, prodotto.prezzo]);

  return (
    <View style={ps.row}>
      {/* Riga 1: nome prodotto */}
      <View style={ps.nameRow}>
        <TextInput
          style={ps.nameInput}
          value={prodotto.nome}
          onChangeText={(v) => onChange({ nome: v })}
          placeholder={t('supplier.productName') || 'Nome prodotto'}
          placeholderTextColor="#A6A095"
        />
        <TouchableOpacity
          onPress={onDelete}
          style={ps.delBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={22} color="#D46A6A" />
        </TouchableOpacity>
      </View>

      {/* Riga 2: COSTO → PREZZO con larghezza generosa e allineamento perfetto */}
      <View style={ps.priceRow}>
        {/* COSTO */}
        <View style={ps.priceField}>
          <Text style={ps.priceLabel}>{t('supplier.cost') || 'COSTO'}</Text>
          <View style={ps.priceInputBox}>
            <Text style={ps.eur}>€</Text>
            <TextInput
              style={ps.priceInput}
              value={costoText}
              onChangeText={handleCostChange}
              onBlur={commitCost}
              onEndEditing={commitCost}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#B8B0A0"
              testID="supplier-cost-input"
            />
          </View>
        </View>

        <View style={ps.arrowWrap}>
          <Ionicons name="arrow-forward" size={18} color="#1E7F85" />
        </View>

        {/* PREZZO */}
        <View style={ps.priceField}>
          <View style={ps.priceLabelRow}>
            <Text style={ps.priceLabel}>{t('supplier.price') || 'PREZZO'}</Text>
            {prodotto.prezzoOverwrite ? (
              <TouchableOpacity onPress={handleResetOverwrite} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Ionicons name="refresh" size={13} color="#1E7F85" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={[ps.priceInputBox, prodotto.prezzoOverwrite && ps.priceInputBoxOverride]}>
            <Text style={ps.eur}>€</Text>
            <TextInput
              style={ps.priceInput}
              value={prezzoText}
              onChangeText={handlePriceChange}
              onBlur={commitPrice}
              onEndEditing={commitPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#B8B0A0"
              testID="supplier-price-input"
            />
          </View>
        </View>
      </View>

      {/* Riga 3: indicatore ricarico effettivo */}
      {ricaricoEffettivo !== null && (
        <View style={ps.markupRow}>
          {prodotto.prezzoOverwrite ? (
            <View style={[ps.markupBadge, ps.markupBadgeManual]}>
              <Ionicons name="create-outline" size={12} color="#FFF" />
              <Text style={ps.markupBadgeTxt}>
                {(t('supplier.priceOverride') || 'Manuale')} · +{ricaricoEffettivo.toFixed(1)}%
              </Text>
            </View>
          ) : (
            <View style={[ps.markupBadge, ps.markupBadgeAuto]}>
              <Ionicons name="trending-up" size={12} color="#FFF" />
              <Text style={ps.markupBadgeTxt}>
                {(t('supplier.markupAuto') || 'Auto')} · +{ricaricoEffettivo.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Stili
// ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8E0CC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#1A4040', letterSpacing: 1.2 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#D6E8E5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoTxt: { flex: 1, fontSize: 11, color: '#1A4040', lineHeight: 16 },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTxt: { color: '#7A9090', fontSize: 13 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E7F85', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, marginTop: 8 },
  emptyCtaTxt: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  card: {
    backgroundColor: '#F5EFDC',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  fornitoreName: { flex: 1, fontSize: 15, fontWeight: '900', color: '#1A4040' },
  ricaricoBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ricaricoBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  cardBody: { paddingHorizontal: 14, paddingBottom: 14 },
  ricaricoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#1A4040', letterSpacing: 0.8 },
  fieldHint: { fontSize: 9, color: '#7A9090', marginTop: 2 },

  ricaricoInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#1E7F85',
    minWidth: 80,
  },
  ricaricoInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 4,
  },
  percentLabel: { fontSize: 14, fontWeight: '800', color: '#1E7F85' },

  divider: { height: 1, backgroundColor: '#E5DECF', marginVertical: 10 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7A9090',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyProdTxt: { fontSize: 11, color: '#9A9890', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' },

  addProdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E7F85',
    borderStyle: 'dashed',
  },
  addProdTxt: { color: '#1E7F85', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
});

const ps = StyleSheet.create({
  // ─── Card-row del prodotto ──────────────────────────────────────────
  // Layout verticale: nome → COSTO+PREZZO → badge ricarico
  // Padding/font generosi come richiesto dall'utente.
  row: {
    backgroundColor: '#FFFAEC',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5DECF',
  },
  // Riga 1: nome prodotto + cestino
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1A4040',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E5DECF',
  },
  delBtn: { padding: 4 },

  // Riga 2: Costo → Prezzo (allineati con flex 1 / 1 + freccia centrale)
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceField: {
    flex: 1,        // Allineamento perfetto: i due box hanno la STESSA larghezza
    minWidth: 0,    // Evita overflow su schermi stretti
  },
  priceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  priceLabel: { fontSize: 11, fontWeight: '900', color: '#7A9090', letterSpacing: 0.8 },

  // Box di input GRANDE — padding generoso, font da 18 (era 13)
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#E5DECF',
    minHeight: 52,    // ≥ 48 = touch target Android, ≥ 44 = iOS
  },
  priceInputBoxOverride: { borderColor: '#D4AF37', backgroundColor: '#FFF8E6' },
  eur: { fontSize: 16, color: '#7A9090', fontWeight: '800', marginRight: 4 },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },

  // Freccia centrale tra costo e prezzo
  arrowWrap: {
    paddingBottom: 14,   // così la freccia è centrata sul box (label + input)
    paddingHorizontal: 2,
  },

  // Badge ricarico effettivo (riga 3)
  markupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  markupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  markupBadgeAuto: { backgroundColor: '#1E7F85' },
  markupBadgeManual: { backgroundColor: '#D4AF37' },
  markupBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFF8EC', borderRadius: 22, padding: 22 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A4040',
    borderWidth: 1,
    borderColor: '#E5DECF',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7A9090' },
  btnGhostTxt: { color: '#7A9090', fontWeight: '900', letterSpacing: 1 },
  btnPrimary: { backgroundColor: '#1E7F85' },
  btnPrimaryTxt: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
});
