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
  useEffect(() => {
    // Se il prodotto NON è in overwrite, segui il ricarico del fornitore
    if (!prodotto.prezzoOverwrite) {
      setPctText(String(ricaricoFornitore));
    }
  }, [ricaricoFornitore, prodotto.prezzoOverwrite]);
  // Quando costo/prezzo arrivano da fuori, ricalcola pctText (per allineamento)
  useEffect(() => {
    const c = prodotto.costo || 0;
    const p = prodotto.prezzo || 0;
    if (c > 0 && p > 0) {
      const pct = ((p / c - 1) * 100);
      setPctText(String(Math.round(pct * 10) / 10));
    }
  }, [prodotto.costo, prodotto.prezzo]);

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
      {/* Riga 1: nome + cestino */}
      <View style={ps.nameRow}>
        <TextInput
          style={ps.nameInput}
          value={prodotto.nome}
          onChangeText={(v) => onChange({ nome: v })}
          placeholder={t('supplier.productName') || 'Nome prodotto'}
          placeholderTextColor="#A6A095"
        />
        <TouchableOpacity onPress={onDelete} style={ps.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={22} color="#D46A6A" />
        </TouchableOpacity>
      </View>

      {/* Riga 2: COSTO / PREZZO / % — tutti editabili e bidirezionali */}
      <View style={ps.priceRow}>
        {/* COSTO */}
        <View style={ps.priceField}>
          <Text style={ps.priceLabel}>{t('supplier.cost') || 'COSTO'}</Text>
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

        {/* PREZZO */}
        <View style={ps.priceField}>
          <Text style={ps.priceLabel}>{t('supplier.price') || 'PREZZO'}</Text>
          <View style={[ps.priceInputBox, prodotto.prezzoOverwrite && ps.priceInputBoxOverride]}>
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
        </View>

        {/* % RICARICO */}
        <View style={[ps.priceField, ps.pctField]}>
          <Text style={ps.priceLabel}>%</Text>
          <View style={[ps.priceInputBox, prodotto.prezzoOverwrite && ps.priceInputBoxOverride]}>
            <TextInput
              style={[ps.priceInput, { textAlign: 'center' }]}
              value={pctText}
              onChangeText={onPctChange}
              onBlur={commitPct}
              onEndEditing={commitPct}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#B8B0A0"
              testID="supplier-markup-input"
            />
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
                key={`${p.nome}-${pIdx}`}
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
});

const ps = StyleSheet.create({
  row: { backgroundColor: '#FFFAEC', padding: 12, borderRadius: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: '#E5DECF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1, fontSize: 14, fontWeight: '800', color: '#1A4040',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#FFF', borderRadius: 10, minHeight: 42,
    borderWidth: 1, borderColor: '#E5DECF',
  },
  delBtn: { padding: 4 },

  // 3 campi affiancati: COSTO / PREZZO / %
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  priceField: { flex: 1, minWidth: 0 },
  pctField: { flex: 0.55 },  // % box leggermente più stretto
  priceLabel: { fontSize: 10, fontWeight: '900', color: '#7A9090', letterSpacing: 0.6, marginBottom: 4 },

  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#E5DECF',
    minHeight: 46,
  },
  priceInputBoxOverride: { borderColor: '#D4AF37', backgroundColor: '#FFF8E6' },
  eur: { fontSize: 13, color: '#7A9090', fontWeight: '800', marginRight: 2 },
  priceInput: { flex: 1, fontSize: 16, fontWeight: '900', color: '#1A4040', paddingVertical: 0, paddingHorizontal: 0 },
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
