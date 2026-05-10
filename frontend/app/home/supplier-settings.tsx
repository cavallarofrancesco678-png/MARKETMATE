/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SupplierSettings — Schermata FORNITORI / RICARICHI dedicata
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Pagina che usa lo stesso `<FornitoreEditor>` impiegato dalle Settings,
 * così UI e logica sono allineate (DRY / single source of truth).
 *
 * REFACTOR Round 35: rimosso il vecchio ProductRow locale (con +70% sotto
 * al campo prezzo) → ora usa il nuovo layout a 3 input affiancati e
 * verticalmente allineati (COSTO / PREZZO / %) con bidirezionalità.
 */

import React, { useState } from 'react';
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
import { useAppStore } from '../../src/store/appStore';
import { FornitoreEditor } from '../../src/components/FornitoreEditor';

const DEFAULT_RICARICO = 70;

export default function SupplierSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const fornitori = useAppStore((s) => s.fornitori);
  const setConfig = useAppStore((s) => s.setConfig);
  const addFornitore = useAppStore((s) => s.addFornitore);
  const removeFornitore = useAppStore((s) => s.removeFornitore);

  const [expanded, setExpanded] = useState<number | null>(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [modalText, setModalText] = useState('');

  const closeAdd = () => { setShowAddModal(false); setModalText(''); };
  const closeRename = () => { setRenameIdx(null); setModalText(''); };

  const onAdd = () => {
    const txt = modalText.trim();
    if (!txt) { closeAdd(); return; }
    addFornitore({ nome: txt, prodotti: [], ricaricoMedio: DEFAULT_RICARICO });
    closeAdd();
  };

  const onRename = () => {
    if (renameIdx === null) return;
    const txt = modalText.trim();
    if (!txt) { closeRename(); return; }
    const next = fornitori.map((f, i) => (i === renameIdx ? { ...f, nome: txt } : f));
    setConfig({ fornitori: next });
    closeRename();
  };

  const confirmDelete = (nome: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Eliminare il fornitore "${nome}" e tutti i suoi prodotti?`)) {
        removeFornitore(nome);
      }
      return;
    }
    Alert.alert(
      t('supplier.confirmDeleteTitle') || 'Elimina fornitore',
      (t('supplier.confirmDeleteDesc', { nome }) as string) || `Eliminare "${nome}" e tutti i suoi prodotti?`,
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        { text: t('common.delete') || 'Elimina', style: 'destructive', onPress: () => removeFornitore(nome) },
      ]
    );
  };

  return (
    <SafeAreaView style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={26} color="#1A4040" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('supplier.title') || 'FORNITORI / RICARICHI'}</Text>
        <TouchableOpacity
          onPress={() => { setShowAddModal(true); setModalText(''); }}
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
        <View style={s.infoBox}>
          <Ionicons name="information-circle" size={18} color="#1E7F85" />
          <Text style={s.infoTxt}>
            {t('supplier.infoBox') ||
              "Imposta il ricarico medio e i prodotti del fornitore. La ripartizione del costo merce sui giorni avviene automaticamente in base agli incassi."}
          </Text>
        </View>

        {fornitori.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={32} color="#B0B0A0" />
            <Text style={s.emptyTxt}>{t('supplier.empty') || 'Nessun fornitore configurato'}</Text>
            <TouchableOpacity
              style={s.emptyCta}
              onPress={() => { setShowAddModal(true); setModalText(''); }}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={s.emptyCtaTxt}>{t('supplier.addFirst') || 'AGGIUNGI IL PRIMO'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          fornitori.map((f, fIdx) => {
            const isOpen = expanded === fIdx;
            return (
              <FornitoreEditor
                key={`${f.nome}-${fIdx}`}
                fornitore={f}
                isExpanded={isOpen}
                onToggleExpand={() => setExpanded(isOpen ? null : fIdx)}
                onUpdate={(patch) => {
                  const next = fornitori.map((x, i) => (i === fIdx ? { ...x, ...patch } : x));
                  setConfig({ fornitori: next });
                }}
                onDelete={() => confirmDelete(f.nome)}
                onRename={() => { setRenameIdx(fIdx); setModalText(f.nome); }}
              />
            );
          })
        )}
      </ScrollView>

      {/* Modal aggiungi fornitore */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={closeAdd}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ms.overlay}>
          <View style={ms.card}>
            <Text style={ms.title}>{t('supplier.newFornitore') || 'Nuovo fornitore'}</Text>
            <TextInput
              style={ms.input}
              placeholder={t('supplier.fornitoreNamePlaceholder') || 'Nome fornitore (es. Andrea Pane)'}
              placeholderTextColor="#9A9890"
              value={modalText}
              onChangeText={setModalText}
              autoFocus
            />
            <View style={ms.btnRow}>
              <TouchableOpacity style={[ms.btn, ms.btnGhost]} onPress={closeAdd}>
                <Text style={ms.btnGhostTxt}>{t('common.cancel') || 'ANNULLA'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.btn, ms.btnPrimary]} onPress={onAdd}>
                <Text style={ms.btnPrimaryTxt}>{t('common.save') || 'SALVA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal rinomina fornitore */}
      <Modal visible={renameIdx !== null} transparent animationType="fade" onRequestClose={closeRename}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ms.overlay}>
          <View style={ms.card}>
            <Text style={ms.title}>{t('supplier.renameFornitore') || 'Rinomina fornitore'}</Text>
            <TextInput
              style={ms.input}
              placeholder={t('supplier.fornitoreNamePlaceholder') || 'Nome fornitore'}
              placeholderTextColor="#9A9890"
              value={modalText}
              onChangeText={setModalText}
              autoFocus
            />
            <View style={ms.btnRow}>
              <TouchableOpacity style={[ms.btn, ms.btnGhost]} onPress={closeRename}>
                <Text style={ms.btnGhostTxt}>{t('common.cancel') || 'ANNULLA'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.btn, ms.btnPrimary]} onPress={onRename}>
                <Text style={ms.btnPrimaryTxt}>{t('common.save') || 'SALVA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8E0CC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#1A4040', letterSpacing: 1.2 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#D6E8E5', borderRadius: 14, padding: 12, marginBottom: 16,
  },
  infoTxt: { flex: 1, fontSize: 11, color: '#1A4040', lineHeight: 16 },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTxt: { color: '#7A9090', fontSize: 13 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E7F85', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, marginTop: 8 },
  emptyCtaTxt: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
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
