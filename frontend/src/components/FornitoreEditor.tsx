/**
 * ═══════════════════════════════════════════════════════════════════════
 *  FornitoreEditor — Card editabile per un singolo fornitore
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Usato sia nella schermata Settings (sezione FORNITORI) sia nella
 * schermata SupplierSettings dedicata. UNICA fonte di verità della UI
 * di configurazione fornitori per evitare divergenze.
 *
 * Layout (mobile-first):
 *  ┌─────────────────────────────────────────────────────────┐
 *  │ ▼ ANDREA PANE                              [70%] ✏ 🗑   │
 *  │ ─── (espanso) ──────────────────────────────────────── │
 *  │ RICARICO MEDIO FORNITORE   [ 70 ] %                     │
 *  │ ─────────────────────────────────────────────────────── │
 *  │ PRODOTTI                                                │
 *  │ ┌───────────────────────────────────────────────────┐   │
 *  │ │ Pane Toscano                                  🗑 │   │
 *  │ │ COSTO         PREZZO         %                   │   │
 *  │ │ € 2.50        € 4.25         70                  │   │
 *  │ └───────────────────────────────────────────────────┘   │
 *  │ [+ AGGIUNGI PRODOTTO]                                   │
 *  └─────────────────────────────────────────────────────────┘
 *
 * BIDIREZIONALITÀ richiesta dall'utente:
 *  - Cambia COSTO  → ricalcola PREZZO mantenendo la % corrente
 *  - Cambia PREZZO → ricalcola % (nuovo "ricarico effettivo")
 *  - Cambia %      → ricalcola PREZZO usando la nuova %
 *
 * Decimal-point fix: gli input numerici usano stato di editing locale
 * (string) e parsano solo onBlur/onEndEditing — vedi NUM_INPUT_RE.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Fornitore, Prodotto } from '../store/appStore';
import { calcolaPrezzoSuggerito } from '../utils/proporzionaleFornitori';

const DEFAULT_RICARICO = 70;
const NUM_INPUT_RE = /^\d*[.,]?\d{0,2}$/;

// ─────────────────────────────────────────────────────────────────────
//  ProductRow — singola riga prodotto con costo / prezzo / % bidirezionali
// ─────────────────────────────────────────────────────────────────────
interface ProductRowProps {
  prodotto: Prodotto;
  ricaricoFornitore: number; // ricarico medio del fornitore (default per nuovi prodotti)
  onChange: (patch: Partial<Prodotto>) => void;
  onDelete: () => void;
}

const ProductRow: React.FC<ProductRowProps> = ({ prodotto, ricaricoFornitore, onChange, onDelete }) => {
  const { t } = useTranslation();

  // ─── Stato di editing locale (string) per evitare il bug del decimale ───
  const [costoText, setCostoText] = useState(prodotto.costo ? String(prodotto.costo) : '');
  const [prezzoText, setPrezzoText] = useState(prodotto.prezzo ? String(prodotto.prezzo) : '');

  // % effettiva di questo prodotto (può divergere dal ricarico medio del fornitore
  // quando l'utente l'ha sovrascritta manualmente).
  const ricaricoCorrente = (() => {
    const c = prodotto.costo || 0;
    const p = prodotto.prezzo || 0;
    if (c > 0 && p > 0) return ((p / c - 1) * 100);
    return ricaricoFornitore;
  })();
  const [pctText, setPctText] = useState(
    Number.isFinite(ricaricoCorrente) ? String(Math.round(ricaricoCorrente * 10) / 10) : String(ricaricoFornitore)
  );

  // ─── Sync esterno: se il ricarico fornitore cambia da fuori e la % è
  //     in default → aggiorna anche pctText. Se costo/prezzo cambiano
  //     da fuori (es. import dati) → aggiorna i text. ───────────────────
  useEffect(() => {
    setCostoText(prodotto.costo ? String(prodotto.costo) : '');
  }, [prodotto.costo]);
  useEffect(() => {
    setPrezzoText(prodotto.prezzo ? String(prodotto.prezzo) : '');
  }, [prodotto.prezzo]);
  /* ═══ Round 44: SINGLE SOURCE OF TRUTH per pctText ═══
     Prima c'erano DUE useEffect concorrenti che potevano sovrascrivere
     pctText in ordine non deterministico:
       (a) [ricaricoFornitore, prezzoOverwrite] → setPctText(ricaricoFornitore)
       (b) [costo, prezzo] → setPctText((p/c-1)*100)
     Risultato: per prodotti legacy con prezzoOverwrite=undefined, (a)
     sovrascriveva pctText con `ricaricoFornitore` (es. 18) anche se la
     ratio reale era 41.67%. UTENTE VEDEVA 18% INVECE DI 41.67%. ❌
     
     FIX: un solo effect unificato con priorità chiara:
       1. Se c'è un costo E un prezzo entrambi > 0 → calcola % dalla ratio reale
       2. Altrimenti se prezzoOverwrite è false (o undefined) → usa
          ricaricoFornitore come default
       3. Altrimenti (prezzoOverwrite=true ma cost/price non disponibili)
          mantieni il pctText corrente (utente l'ha settato manualmente). */
  useEffect(() => {
    const c = Number(prodotto.costo) || 0;
    const p = Number(prodotto.prezzo) || 0;
    if (c > 0 && p > 0) {
      // Caso 1: cost e price entrambi presenti → % dalla ratio reale
      const pct = (p / c - 1) * 100;
      setPctText(String(Math.round(pct * 10) / 10));
    } else if (!prodotto.prezzoOverwrite) {
      // Caso 2: niente prezzo + non sovrascritto → default del fornitore
      setPctText(String(ricaricoFornitore));
    }
    // Caso 3: niente prezzo + sovrascritto → mantieni il valore corrente
  }, [prodotto.costo, prodotto.prezzo, ricaricoFornitore, prodotto.prezzoOverwrite]);

  // ─── Helpers ────────────────────────────────────────────────────────
  const parseN = (s: string): number => {
    const n = parseFloat((s || '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // ─── COSTO commit: ricalcola prezzo dalla % corrente ────────────────
  const commitCost = () => {
    const cost = parseN(costoText);
    if (cost <= 0) {
      onChange({ costo: 0 });
      return;
    }
    const pct = parseN(pctText);
    const newPrezzo = round2(cost * (1 + pct / 100));
    setPrezzoText(String(newPrezzo));
    onChange({ costo: cost, prezzo: newPrezzo });
  };

  // ─── PREZZO commit: ricalcola % (= ricarico effettivo) ──────────────
  const commitPrice = () => {
    const price = parseN(prezzoText);
    const cost = parseN(costoText) || prodotto.costo || 0;
    if (price <= 0) {
      onChange({ prezzo: 0, prezzoOverwrite: false });
      return;
    }
    if (cost > 0) {
      const newPct = round1((price / cost - 1) * 100);
      setPctText(String(newPct));
    }
    // Marchiamo prezzoOverwrite=true se la nuova % differisce dal ricarico del
    // fornitore, così quando l'utente cambia ricarico medio NON la sovrascriviamo
    const isOverride = cost > 0 ? Math.abs((price / cost - 1) * 100 - ricaricoFornitore) > 0.05 : false;
    onChange({ prezzo: price, prezzoOverwrite: isOverride });
  };

  // ─── % commit: ricalcola prezzo dal costo corrente ──────────────────
  const commitPct = () => {
    const pct = parseN(pctText);
    const cost = parseN(costoText) || prodotto.costo || 0;
    if (cost <= 0) {
      // No costo → impossibile derivare prezzo, salviamo solo la %
      onChange({ prezzoOverwrite: pct !== ricaricoFornitore });
      return;
    }
    const newPrezzo = round2(cost * (1 + pct / 100));
    setPrezzoText(String(newPrezzo));
    const isOverride = Math.abs(pct - ricaricoFornitore) > 0.05;
    onChange({ prezzo: newPrezzo, prezzoOverwrite: isOverride });
  };

  // ─── Input change handlers (validazione) ─────────────────────────────
  const onCostoChange = (v: string) => { if (v === '' || NUM_INPUT_RE.test(v)) setCostoText(v); };
  const onPrezzoChange = (v: string) => { if (v === '' || NUM_INPUT_RE.test(v)) setPrezzoText(v); };
  const onPctChange = (v: string) => { if (v === '' || NUM_INPUT_RE.test(v)) setPctText(v); };

  return (
    <View style={ps.row}>
      {/*  Layout a 2 RIGHE per garantire che il nome del prodotto sia
          sempre PIENAMENTE VISIBILE su qualsiasi larghezza schermo.
          - Riga 1: NOME PRODOTTO (full width) + bottone elimina
          - Riga 2: COSTO | → | PREZZO | %
          Risolve il bug "i nomi dei prodotti non si vedono nella sezione
          Settings → Fornitori": prima il flex layout schiacciava il nome a
          80-100px e su nomi lunghi tagliava il testo. */}
      {/* RIGA 1 — NOME + delete */}
      <View style={ps.nameRow}>
        <Ionicons name="cube-outline" size={16} color="#1E7F85" style={{ marginRight: 6 }} />
        <TextInput
          style={ps.nameInput}
          value={prodotto.nome || ''}
          onChangeText={(v) => onChange({ nome: v })}
          placeholder={t('supplier.productName') || 'Nome prodotto'}
          placeholderTextColor="#A6A095"
          testID="supplier-product-name-input"
        />
        <TouchableOpacity onPress={onDelete} style={ps.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={22} color="#D46A6A" />
        </TouchableOpacity>
      </View>

      {/* RIGA 2 — COSTO | → | PREZZO | % */}
      <View style={ps.priceRow}>
      {/* COSTO */}
      <View style={ps.priceField}>
        <Text style={ps.priceLabel}>{t('supplier.cost') || 'Costo'}</Text>
        <View style={ps.priceInputBox}>
          <Text style={ps.eur}>€</Text>
          <TextInput
            style={ps.priceInput}
            value={costoText}
            onChangeText={onCostoChange}
            onBlur={commitCost}
            onEndEditing={commitCost}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#B8B0A0"
            testID="supplier-cost-input"
          />
        </View>
      </View>

      {/* Freccia separatore — verticalmente centrata */}
      <View style={ps.arrowWrap}>
        <Ionicons name="arrow-forward" size={16} color="#1E7F85" />
      </View>

      {/* PREZZO + % al suo fianco (richiesta utente: non più sotto) */}
      <View style={ps.priceField}>
        <Text style={ps.priceLabel}>{t('supplier.price') || 'Prezzo'}</Text>
        <View style={ps.priceWithPctRow}>
          <View style={[ps.priceInputBox, ps.priceInputBoxWithPct, prodotto.prezzoOverwrite && ps.priceInputBoxOverride]}>
            <Text style={ps.eur}>€</Text>
            <TextInput
              style={ps.priceInput}
              value={prezzoText}
              onChangeText={onPrezzoChange}
              onBlur={commitPrice}
              onEndEditing={commitPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#B8B0A0"
              testID="supplier-price-input"
            />
          </View>
          {/* % accanto al prezzo: editabile, in verde teal grande e leggibile */}
          <View style={[ps.pctInputBox, prodotto.prezzoOverwrite && ps.pctInputBoxOverride]}>
            <Text style={ps.pctSign}>+</Text>
            <TextInput
              style={ps.pctInput}
              value={pctText}
              onChangeText={onPctChange}
              onBlur={commitPct}
              onEndEditing={commitPct}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#B8B0A0"
              testID="supplier-markup-input"
            />
            <Text style={ps.pctSign}>%</Text>
          </View>
        </View>
      </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
//  FornitoreEditor — Card del singolo fornitore
// ─────────────────────────────────────────────────────────────────────
export interface FornitoreEditorProps {
  fornitore: Fornitore;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Fornitore>) => void;
  onDelete: () => void;
  onRename: () => void;
}

export const FornitoreEditor: React.FC<FornitoreEditorProps> = ({
  fornitore,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onRename,
}) => {
  const { t } = useTranslation();
  const ric = fornitore.ricaricoMedio ?? DEFAULT_RICARICO;
  const [ricText, setRicText] = useState(String(ric));
  const [showAddProd, setShowAddProd] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCost, setNewProdCost] = useState('');

  useEffect(() => { setRicText(String(ric)); }, [ric]);

  const onRicChange = (v: string) => { if (v === '' || NUM_INPUT_RE.test(v)) setRicText(v); };
  const commitRic = () => {
    const n = parseFloat((ricText || '').replace(',', '.'));
    if (isNaN(n) || n < 0 || n > 999) {
      setRicText(String(ric));
      return;
    }
    // Quando il ricarico fornitore cambia, riapplichiamo il nuovo prezzo a tutti
    // i prodotti che NON sono in overwrite (cioè quelli che seguono il default).
    const nextProdotti = fornitore.prodotti.map((p) => {
      if (p.prezzoOverwrite || !p.costo) return p;
      return { ...p, prezzo: calcolaPrezzoSuggerito(p.costo, n) };
    });
    onUpdate({ ricaricoMedio: n, prodotti: nextProdotti });
  };

  const updateProdotto = (pIdx: number, patch: Partial<Prodotto>) => {
    onUpdate({
      prodotti: fornitore.prodotti.map((p, i) => (i === pIdx ? { ...p, ...patch } : p)),
    });
  };
  const removeProdotto = (pIdx: number) => {
    onUpdate({ prodotti: fornitore.prodotti.filter((_, i) => i !== pIdx) });
  };

  const addProdotto = () => {
    const name = newProdName.trim();
    if (!name) { setShowAddProd(false); return; }
    const cost = parseFloat((newProdCost || '').replace(',', '.')) || 0;
    const prezzo = calcolaPrezzoSuggerito(cost, ric);
    onUpdate({
      prodotti: [...fornitore.prodotti, { nome: name, costo: cost, prezzo, prezzoOverwrite: false }],
    });
    setNewProdName('');
    setNewProdCost('');
    setShowAddProd(false);
  };

  return (
    <View style={fs.card}>
      <TouchableOpacity style={fs.header} activeOpacity={0.7} onPress={onToggleExpand}>
        <Ionicons name="cube" size={20} color="#1E7F85" />
        <Text style={fs.title}>{fornitore.nome}</Text>
        <View style={fs.badge}>
          <Text style={fs.badgeTxt}>{ric}%</Text>
        </View>
        <TouchableOpacity onPress={onRename} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="pencil-outline" size={18} color="#7A9090" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 6 }}>
          <Ionicons name="trash-outline" size={18} color="#D46A6A" />
        </TouchableOpacity>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={fs.body}>
          {/* RICARICO MEDIO FORNITORE */}
          <View style={fs.ricRow}>
            <View style={{ flex: 1 }}>
              <Text style={fs.fieldLabel}>{t('supplier.avgMarkup') || 'RICARICO MEDIO FORNITORE'}</Text>
              <Text style={fs.fieldHint}>
                {t('supplier.avgMarkupHint') || 'Default per nuovi prodotti. Cambia anche i prezzi non sovrascritti.'}
              </Text>
            </View>
            <View style={fs.ricInputBox}>
              <TextInput
                style={fs.ricInput}
                value={ricText}
                onChangeText={onRicChange}
                onBlur={commitRic}
                onEndEditing={commitRic}
                keyboardType="decimal-pad"
                maxLength={5}
                textAlign="center"
              />
              <Text style={fs.percentLabel}>%</Text>
            </View>
          </View>

          <View style={fs.divider} />

          {/* PRODOTTI */}
          <Text style={fs.section}>{t('supplier.products') || 'PRODOTTI'}</Text>
          {fornitore.prodotti.length === 0 ? (
            <Text style={fs.emptyTxt}>{t('supplier.noProducts') || 'Nessun prodotto. Aggiungine uno qui sotto.'}</Text>
          ) : (
            fornitore.prodotti.map((p, pIdx) => (
              <ProductRow
                /* CHIAVE STABILE: prima usavamo `${p.nome}-${pIdx}` ma `p.nome`
                   cambia ad OGNI keystroke nel TextInput del nome → React
                   smonta e rimonta la riga ad ogni carattere → la TextInput
                   perde il focus e l'utente vede il nome "non salvato".
                   Usando solo l'indice di posizione, il componente rimane
                   montato durante l'editing del nome. */
                key={`prod-${pIdx}`}
                prodotto={p}
                ricaricoFornitore={ric}
                onChange={(patch) => updateProdotto(pIdx, patch)}
                onDelete={() => removeProdotto(pIdx)}
              />
            ))
          )}

          <TouchableOpacity style={fs.addBtn} onPress={() => setShowAddProd(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#1E7F85" />
            <Text style={fs.addBtnTxt}>{t('supplier.addProduct') || 'AGGIUNGI PRODOTTO'}</Text>
          </TouchableOpacity>

          {/* ═══ Pulsante SALVA neomorfico (richiesta utente Round 35).
              In realtà i dati vengono già salvati automaticamente ad ogni
              onBlur/onEndEditing dei campi (autosave), ma l'utente ha chiesto
              feedback visivo esplicito. Cliccando questo pulsante mostriamo
              un toast/Alert "Salvato ✓" che rassicura l'utente. ═══ */}
          <TouchableOpacity
            style={fs.saveBtn}
            activeOpacity={0.85}
            onPress={() => {
              // Trigger opzionale di un re-save esplicito (forza commit
              // di qualsiasi input ancora in editing): facciamo un no-op
              // setUpdate per forzare il flow di Zustand → AsyncStorage.
              try { onUpdate({ ricaricoMedio: ric }); } catch {}
              if (Platform.OS === 'web') {
                // Su web mostriamo un alert nativo veloce
                try { window.alert('✓ Salvato'); } catch {}
              } else {
                Alert.alert(
                  t('common.saved') || 'Salvato',
                  t('supplier.saveOk') || 'Modifiche salvate correttamente.',
                );
              }
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFF" />
            <Text style={fs.saveBtnTxt}>{t('common.save') || 'SALVA'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL AGGIUNGI PRODOTTO */}
      <Modal visible={showAddProd} transparent animationType="fade" onRequestClose={() => setShowAddProd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ms.overlay}>
          <View style={ms.card}>
            <Text style={ms.title}>{t('supplier.newProduct') || 'Nuovo prodotto'}</Text>
            <TextInput
              style={ms.input}
              placeholder={t('supplier.productNamePlaceholder') || 'Nome prodotto (es. Pane Toscano)'}
              placeholderTextColor="#9A9890"
              value={newProdName}
              onChangeText={setNewProdName}
              autoFocus
            />
            <TextInput
              style={[ms.input, { marginTop: 10 }]}
              placeholder={t('supplier.costPlaceholder') || 'Costo unitario € (es. 2.50)'}
              placeholderTextColor="#9A9890"
              value={newProdCost}
              onChangeText={setNewProdCost}
              keyboardType="decimal-pad"
            />
            <View style={ms.btnRow}>
              <TouchableOpacity style={[ms.btn, ms.btnGhost]} onPress={() => { setShowAddProd(false); setNewProdName(''); setNewProdCost(''); }}>
                <Text style={ms.btnGhostTxt}>{t('common.cancel') || 'ANNULLA'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.btn, ms.btnPrimary]} onPress={addProdotto}>
                <Text style={ms.btnPrimaryTxt}>{t('common.save') || 'SALVA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
//  Stili
// ─────────────────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  card: { backgroundColor: '#F5EFDC', borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  title: { flex: 1, fontSize: 14, fontWeight: '900', color: '#1A4040' },
  badge: { backgroundColor: '#D4AF37', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  body: { paddingHorizontal: 12, paddingBottom: 12 },
  ricRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#1A4040', letterSpacing: 0.6 },
  fieldHint: { fontSize: 9, color: '#7A9090', marginTop: 2 },
  ricInputBox: {
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
  ricInput: { flex: 1, fontSize: 17, fontWeight: '900', color: '#1A4040', paddingVertical: 4 },
  percentLabel: { fontSize: 14, fontWeight: '800', color: '#1E7F85' },

  divider: { height: 1, backgroundColor: '#E5DECF', marginVertical: 8 },
  section: { fontSize: 11, fontWeight: '900', color: '#7A9090', letterSpacing: 1, marginBottom: 8 },
  emptyTxt: { fontSize: 11, color: '#9A9890', fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, marginTop: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#1E7F85', borderStyle: 'dashed',
  },
  addBtnTxt: { color: '#1E7F85', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  // Pulsante SALVA neomorfico (Round 35) - in fondo alla card del fornitore
  // Stile gold/teal coerente con il resto della UI dell'app.
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#1E7F85',
    // Ombra neomorfica
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  saveBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
});

const ps = StyleSheet.create({
  // Layout VERTICALE a 2 RIGHE: nome sopra, costi sotto. Il nome del prodotto
  // ha tutto lo spazio orizzontale che gli serve (no flex squeezing) — risolve
  // il bug "non vedo i nomi prodotti" segnalato dall'utente.
  row: {
    backgroundColor: '#FFFAEC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5DECF',
  },
  // RIGA 1 — Nome prodotto + delete
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1A4040',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E5DECF',
  },
  // RIGA 2 — Costo | → | Prezzo + %
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Campo COSTO / PREZZO — leggermente più piccoli del Ricarico ma comunque
  // grandi e leggibili. Label sopra il box (piccolo), box con bordo teal.
  priceField: { alignItems: 'center', minWidth: 0, flex: 1 },
  priceLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#7A9090',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E5DECF',
    minHeight: 40,
    minWidth: 70,
  },
  priceInputBoxOverride: { borderColor: '#D4AF37', backgroundColor: '#FFF8E6' },
  // Box prezzo quando ha la % di fianco (un po' più stretto per fare spazio)
  priceInputBoxWithPct: { minWidth: 64 },
  eur: { fontSize: 12, color: '#7A9090', fontWeight: '800', marginRight: 1 },
  priceInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#1A4040',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 36,
  },

  // Freccia → fra Costo e Prezzo, allineata verticalmente al centro dei box
  arrowWrap: { paddingHorizontal: 1, paddingTop: 14 /* per centrarsi sui box (sotto label) */ },

  // PREZZO + % affiancata: la richiesta esplicita dell'utente è
  // "spostato di fianco al campo input del Prezzo (non sotto)".
  priceWithPctRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // % box: piccolo ma leggibile, con segno + e segno %, in TEAL.
  pctInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#1E7F85',
    minHeight: 40,
    minWidth: 56,
  },
  pctInputBoxOverride: { borderColor: '#D4AF37', backgroundColor: '#FFF8E6' },
  pctSign: { fontSize: 13, fontWeight: '900', color: '#1E7F85' },
  pctInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#1E7F85',     // % in verde teal come richiesto, ma più LEGGIBILE
    paddingVertical: 0,
    paddingHorizontal: 1,
    textAlign: 'center',
    minWidth: 24,
  },

  delBtn: { padding: 4, marginLeft: 6 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFF8EC', borderRadius: 22, padding: 22 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  input: {
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1A4040', borderWidth: 1, borderColor: '#E5DECF',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7A9090' },
  btnGhostTxt: { color: '#7A9090', fontWeight: '900', letterSpacing: 1 },
  btnPrimary: { backgroundColor: '#1E7F85' },
  btnPrimaryTxt: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
});
