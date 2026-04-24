import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, MercatoAgenda } from '../../src/store/appStore';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage, getDayNames } from '../../src/i18n';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FiereRicorrentiSection } from '../../src/components/FiereRicorrentiSection';
import * as DocumentPicker from 'expo-document-picker';

/* ─── REUSABLE INPUT MODAL ─── */
const InputModal = ({
  visible,
  title,
  hints,
  onSave,
  onClose,
  keyboardTypes,
  collabName,
  collabCodice,
  onGenerateCodice,
  initialValues,
}: {
  visible: boolean;
  title: string;
  hints: string[];
  onSave: (values: string[]) => void;
  onClose: () => void;
  keyboardTypes?: string[];
  collabName?: string;
  collabCodice?: any;
  onGenerateCodice?: (tipo: 'A' | 'B', nome: string) => void;
  initialValues?: string[];
}) => {
  const [values, setValues] = useState<string[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteContact, setInviteContact] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Pre-fill values with initialValues or empty
  React.useEffect(() => {
    if (visible) {
      if (initialValues && initialValues.length > 0) {
        setValues(hints.map((_, i) => initialValues[i] || ''));
      } else {
        setValues(hints.map(() => ''));
      }
      // Auto-expand invite section if a code already exists
      setShowInvite(!!collabCodice);
      setInviteContact('');
      setGeneratedCode(null);
    }
  }, [visible, collabCodice]);

  const { t: tModal } = useTranslation();

  const handleSave = () => {
    if (!values[0] || values[0].trim() === '') {
      if (Platform.OS === 'web') {
        window.alert(tModal('settings.enterName') || 'Inserisci un valore');
      } else {
        Alert.alert(tModal('settings.attention') || 'Attenzione', tModal('settings.enterName') || 'Inserisci un valore');
      }
      return;
    }
    const filled = hints.map((_, i) => values[i] || '');
    onSave(filled);
    playSuccess();
    onClose();
  };

  // Check if this is a collaborator modal (based on title containing "collaborator")
  const isCollabModal = title.toLowerCase().includes('collaborator') || title.toLowerCase().includes('collaboratore') || collabName !== undefined;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={ms.overlay}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={[ms.modal, isCollabModal && { maxWidth: 360 }]} onPress={() => {}}>
          <View>
            <Text style={ms.modalTitle}>{title}</Text>
            {hints.map((h, i) => (
              <TextInput
                key={`input-${i}-${title}`}
                style={ms.modalInput}
                placeholder={h}
                placeholderTextColor="#A0A090"
                value={values[i] || ''}
                onChangeText={(txt) => {
                  setValues(prev => {
                    const nv = [...prev];
                    nv[i] = txt;
                    return nv;
                  });
                }}
                keyboardType={
                  (keyboardTypes?.[i] === 'numeric' ? 'numeric' : 'default') as any
                }
                autoFocus={i === 0}
                autoCapitalize="words"
                returnKeyType={i === hints.length - 1 ? 'done' : 'next'}
              />
            ))}
            
            <View style={ms.modalBtns}>
              <TouchableOpacity onPress={onClose} style={ms.modalCancel}>
                <Text style={ms.modalCancelTxt}>{(tModal('common.cancel') || 'Annulla').toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={ms.modalSave}>
                <Text style={ms.modalSaveTxt}>{tModal('common.save') || 'Salva'}</Text>
              </TouchableOpacity>
            </View>

            {/* Sezione INVITA per collaboratori */}
            {isCollabModal && (
              <>
                <TouchableOpacity 
                  style={[ms.inviteToggle, showInvite && { backgroundColor: '#E8A060' }]}
                  onPress={() => setShowInvite(!showInvite)}
                >
                  <Ionicons name="key" size={16} color={showInvite ? '#FFF' : '#E8A060'} />
                  <Text style={[ms.inviteToggleTxt, showInvite && { color: '#FFF' }]}>INVITA</Text>
                  <Ionicons name={showInvite ? 'chevron-up' : 'chevron-down'} size={16} color={showInvite ? '#FFF' : '#E8A060'} />
                </TouchableOpacity>

              {showInvite && (
                <View style={ms.inviteSection}>
                  {collabCodice ? (
                    <View style={ms.existingCode}>
                      <Text style={ms.existingCodeLabel}>{tModal('settings.activeCode') || 'CODICE ATTIVO'}:</Text>
                      <Text style={ms.existingCodeValue}>{collabCodice.codice}</Text>
                      <View style={[ms.codeBadge, { backgroundColor: collabCodice.tipo === 'A' ? '#E8A060' : '#1E7F85' }]}>
                        <Text style={ms.codeBadgeTxt}>{collabCodice.tipo === 'A' ? 'OPERATIVO' : 'FULL'}</Text>
                      </View>
                      <View style={{ width: '100%', marginTop: 12 }}>
                        <TextInput
                          style={ms.inviteContactInput}
                          placeholder="Email o telefono per inviare"
                          placeholderTextColor="#A0A090"
                          value={inviteContact}
                          onChangeText={setInviteContact}
                          keyboardType="email-address"
                        />
                        <TouchableOpacity 
                          style={ms.sendInviteBtn}
                          onPress={async () => {
                            if (!inviteContact.trim()) {
                              if (Platform.OS === 'web') window.alert('Inserisci email o telefono');
                              else Alert.alert('Attenzione', 'Inserisci email o telefono');
                              return;
                            }
                            const msg = `Ciao! Ecco il tuo codice per MarketMate: ${collabCodice.codice} (${collabCodice.tipo === 'A' ? 'Accesso Operativo' : 'Accesso Completo'})`;
                            if (Platform.OS !== 'web') {
                              try {
                                const { Share } = require('react-native');
                                await Share.share({ message: msg });
                              } catch (_e) {}
                            }
                            playSuccess();
                          }}
                        >
                          <Ionicons name="send" size={16} color="#FFF" />
                          <Text style={ms.sendInviteBtnTxt}>{tModal('settings.sendCode') || 'INVIA CODICE'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={ms.inviteTitle}>GENERA CODICE INVITO</Text>
                      <TextInput
                        style={[ms.inviteContactInput, { marginBottom: 12 }]}
                        placeholder="Email o telefono destinatario"
                        placeholderTextColor="#A0A090"
                        value={inviteContact}
                        onChangeText={setInviteContact}
                        keyboardType="email-address"
                      />
                      <TouchableOpacity
                        style={[ms.inviteBtn, { backgroundColor: '#E8A060' }]}
                        onPress={() => {
                          const nome = values[0] || collabName || 'Collaboratore';
                          if (onGenerateCodice) onGenerateCodice('A', nome);
                        }}
                      >
                        <Ionicons name="eye-off-outline" size={18} color="#FFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={ms.inviteBtnTxt}>{tModal('settings.typeAOperative') || 'TIPO A - OPERATIVO'}</Text>
                          <Text style={ms.inviteBtnDesc}>Solo HOME, può inserire dati</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ms.inviteBtn, { backgroundColor: '#1E7F85' }]}
                        onPress={() => {
                          const nome = values[0] || collabName || 'Collaboratore';
                          if (onGenerateCodice) onGenerateCodice('B', nome);
                        }}
                      >
                        <Ionicons name="eye-outline" size={18} color="#FFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={ms.inviteBtnTxt}>{tModal('settings.typeBFull') || 'TIPO B - FULL ACCESS'}</Text>
                          <Text style={ms.inviteBtnDesc}>Accesso completo a tutto</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

/* ─── SETTINGS PAGE ─── */
export default function SettingsPage() {
  const store = useAppStore();
  const { t, i18n } = useTranslation();
  const safeInsets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : safeInsets.top + 16;

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    visible: boolean;
    totale: number;
    numScontrini: number;
    mediaScontrino: number;
    mercatoIdx: number;
    message: string;
  }>({ visible: false, totale: 0, numScontrini: 0, mediaScontrino: 0, mercatoIdx: -1, message: '' });

  // Local state for dialogs
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    hints: string[];
    keyboardTypes?: string[];
    onSave: (values: string[]) => void;
    collabName?: string;
    collabCodice?: any;
    initialValues?: string[];
  }>({ visible: false, title: '', hints: [], onSave: () => {} });

  // Stato per mostrare sezione INVITA nel modal
  const [showInviteSection, setShowInviteSection] = useState(false);

  // Expanded state for agenda days
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // ALL market names stored LOCALLY to prevent any store-related re-render issues
  const [localNames, setLocalNames] = useState<string[]>(() => 
    store.agenda.map(m => m.mercato || '')
  );
  // Expanded state for fornitori
  const [expandedForn, setExpandedForn] = useState<number | null>(null);

  // Sync local names FROM store only once on mount
  useEffect(() => {
    setLocalNames(store.agenda.map(m => m.mercato || ''));
  }, []);

  // Save a specific market name to store
  const commitName = (idx: number, name: string) => {
    const updated = [...store.agenda];
    updated[idx] = { ...updated[idx], mercato: name };
    store.updateAgenda(updated);
    store.forceFlushSave();
    // Calculate km if applicable
    if (name && name.trim().length > 2 && store.partenzaDa) {
      autoCalculateKm(idx, store.partenzaDa, name);
    }
  };

  // When expanding a different day, save the current one first
  const handleExpandDay = (idx: number) => {
    // Save previous day's name if it was open
    if (expandedDay !== null && localNames[expandedDay] !== undefined) {
      commitName(expandedDay, localNames[expandedDay]);
    }
    setExpandedDay(expandedDay === idx ? null : idx);
  };

  // Expanded state for spese annuali
  const [expandedSpese, setExpandedSpese] = useState(false);

  // Modal collaboratori con codici invito
  const [showCollabModal, setShowCollabModal] = useState(false);

  const openModal = useCallback(
    (title: string, hints: string[], onSave: (values: string[]) => void, keyboardTypes?: string[], collabName?: string, collabCodice?: any, initVals?: string[]) => {
      setShowInviteSection(false);
      setModalConfig({ visible: true, title, hints, keyboardTypes, onSave, collabName, collabCodice, initialValues: initVals });
    },
    []
  );

  const handleLanguageChange = async (langCode: string) => {
    store.setConfig({ lingua: LANGUAGES.find(l => l.code === langCode)?.label || 'Italiano' });
    await changeLanguage(langCode);
  };

  // Map stored Italian day names to translated ones (stored as UPPERCASE with accents)
  const IT_DAYS_UPPER = ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO', 'DOMENICA'];
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const translateDay = (giorno: string) => {
    const upper = giorno.toUpperCase();
    const idx = IT_DAYS_UPPER.indexOf(upper);
    if (idx >= 0) {
      return t(`days.${DAY_KEYS[idx]}`).toUpperCase();
    }
    return giorno;
  };

  const totalePlatAnnui = store.agenda.reduce((s, m) => s + m.p_annuo, 0);
  const totaleSpeseAnnue = store.speseAnnue.reduce((s, x) => s + x.importo, 0) + totalePlatAnnui;

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const handleReceiptCapture = async (idx: number) => {
    try {
      // Ask user to choose camera or gallery
      const choiceResult = await new Promise<'camera' | 'gallery' | null>((resolve) => {
        if (Platform.OS === 'web') {
          resolve('gallery');
          return;
        }
        Alert.alert(
          t('settings.receiptPhoto') || 'Foto Scontrino',
          t('settings.chooseSource') || 'Come vuoi acquisire la foto?',
          [
            { text: t('settings.camera') || 'Fotocamera', onPress: () => resolve('camera') },
            { text: t('settings.gallery') || 'Galleria', onPress: () => resolve('gallery') },
            { text: t('common.cancel') || 'Annulla', onPress: () => resolve(null), style: 'cancel' },
          ]
        );
      });

      if (!choiceResult) return;

      let result: ImagePicker.ImagePickerResult;
      if (choiceResult === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permesso', 'Servono i permessi per la fotocamera.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permesso', 'Servono i permessi per la galleria.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setOcrLoading(true);

      // Get base64 data
      let base64Data = asset.base64 || '';
      if (!base64Data && asset.uri) {
        // Read file as base64 if not provided directly
        try {
          const fileData = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          base64Data = fileData;
        } catch {
          setOcrLoading(false);
          Alert.alert('Errore', 'Impossibile leggere il file immagine.');
          return;
        }
      }

      if (!base64Data) {
        setOcrLoading(false);
        Alert.alert('Errore', 'Nessun dato immagine disponibile.');
        return;
      }

      // Send to backend OCR
      const mercato = store.agenda[idx]?.mercato || '';
      const apiUrl = `${BACKEND_URL}/api/receipt/analyze`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          mercato: mercato,
        }),
      });

      const data = await response.json();
      setOcrLoading(false);

      if (data.success) {
        // Show result modal
        setOcrResult({
          visible: true,
          totale: data.totale,
          numScontrini: data.num_scontrini,
          mediaScontrino: data.media_scontrino,
          mercatoIdx: idx,
          message: data.message,
        });
      } else {
        Alert.alert(
          t('settings.ocrFailed') || 'Analisi non riuscita',
          data.message || 'Non sono riuscito a leggere lo scontrino. Prova con una foto più nitida.'
        );
      }
    } catch (error: any) {
      setOcrLoading(false);
      if (Platform.OS === 'web') {
        window.alert('Fotocamera non disponibile su web. Usa la galleria immagini.');
      } else {
        Alert.alert('Errore', `Si è verificato un errore: ${error?.message || 'sconosciuto'}`);
      }
    }
  };

  const confirmOcrResult = () => {
    if (ocrResult.mercatoIdx >= 0) {
      // Update mediaScontrino in the agenda
      updateMercato(ocrResult.mercatoIdx, 'mediaScontrino', ocrResult.mediaScontrino);

      // Save to storico scontrini
      const mercato = store.agenda[ocrResult.mercatoIdx]?.mercato || '';
      store.addScontrino({
        data: new Date().toISOString(),
        mercato: mercato,
        totale: ocrResult.totale,
        numScontrini: ocrResult.numScontrini,
        mediaScontrino: ocrResult.mediaScontrino,
      });
    }
    setOcrResult(prev => ({ ...prev, visible: false }));
  };

  const lingue = ['Italiano', 'Français', 'English', 'Español', 'Deutsch', 'Português'];

  const updateMercato = (idx: number, field: string, value: any) => {
    const updated = [...store.agenda];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'p_annuo') {
      updated[idx].p_giornaliero = Math.round(value / 48);
    }
    if (field === 'p_giornaliero') {
      updated[idx].p_annuo = Math.round(value * 48);
    }
    store.updateAgenda(updated);
    // KM auto-calc is triggered on blur, not on every keystroke
  };

  const handleMercatoBlur = (idx: number) => {
    store.forceFlushSave();
    const m = store.agenda[idx];
    if (m?.mercato && m.mercato.trim().length > 2 && store.partenzaDa) {
      autoCalculateKm(idx, store.partenzaDa, m.mercato);
    }
  };

  const handleExportData = async () => {
    try {
      const state = useAppStore.getState();
      const exportData = {
        esportato_il: new Date().toISOString(),
        app: 'MarketMate v3.9',
        produttore: 'T.V.S di Francesco Cavallaro',
        nomeAttivita: state.nomeAttivita || '',
        isAlimentare: state.isAlimentare,
        agenda: state.agenda || [],
        collaboratori: state.collaboratori || [],
        fornitori: state.fornitori || [],
        speseAnnue: state.speseAnnue || [],
        fiere: (state as any).fiere || [],
        speseExtraTags: (state as any).speseExtraTags || [],
        storicoGiornate: state.storicoGiornate || [],
        storicoCarburante: state.storicoCarburante || [],
        appuntiAgenda: state.appuntiAgenda || [],
        ordiniAgenda: state.ordiniAgenda || [],
        storicoDiario: state.storicoDiario || [],
        // Impostazioni generali
        partenzaDa: state.partenzaDa || '',
        costoPerKm: (state as any).costoPerKm || 0,
        tipoCarburante: state.tipoCarburante || '',
        targetMensile: state.targetMensile || 0,
      };

      const json = JSON.stringify(exportData, null, 2);
      const fileName = `MarketMate_${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        playSuccess();
      } else {
        const dirPath = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!dirPath) {
          Alert.alert('Export', 'Directory non disponibile. Riprova.');
          return;
        }
        const filePath = `${dirPath}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/json',
            dialogTitle: 'Esporta dati MarketMate',
          });
          playSuccess();
        } else {
          Alert.alert('Export', 'Dati salvati! Condivisione non disponibile su questo dispositivo.');
        }
      }
    } catch (err: any) {
      Alert.alert('Errore Export', `${err?.message || 'Errore sconosciuto'}. Riprova.`);
    }
  };

  const handleImportData = async () => {
    try {
      // Conferma import (sovrascrittura dati)
      const confirmImport = await new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('⚠️ Importare i dati SOVRASCRIVERÀ tutti i dati attuali. Vuoi procedere?'));
        } else {
          Alert.alert(
            'Importa Dati',
            '⚠️ Importare i dati SOVRASCRIVERÀ tutti i dati attuali (mercati, fornitori, storico, ecc.). Vuoi procedere?',
            [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Importa', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
          );
        }
      });
      if (!confirmImport) return;

      let jsonText = '';

      if (Platform.OS === 'web') {
        // Web: usa input file HTML
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        const fileData = await new Promise<string | null>((resolve) => {
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          };
          input.click();
        });
        if (!fileData) return;
        jsonText = fileData;
      } else {
        // Mobile: usa DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        const uri = result.assets[0].uri;
        jsonText = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      const data = JSON.parse(jsonText);

      // Applica i dati al store
      const currentState = useAppStore.getState();
      const updates: any = {};
      if (data.nomeAttivita !== undefined) updates.nomeAttivita = data.nomeAttivita;
      if (data.isAlimentare !== undefined) updates.isAlimentare = data.isAlimentare;
      if (Array.isArray(data.agenda)) updates.agenda = data.agenda;
      if (Array.isArray(data.collaboratori)) updates.collaboratori = data.collaboratori;
      if (Array.isArray(data.fornitori)) updates.fornitori = data.fornitori;
      if (Array.isArray(data.speseAnnue)) updates.speseAnnue = data.speseAnnue;
      if (Array.isArray(data.fiere)) updates.fiere = data.fiere;
      if (Array.isArray(data.speseExtraTags)) updates.speseExtraTags = data.speseExtraTags;
      if (Array.isArray(data.storicoGiornate)) updates.storicoGiornate = data.storicoGiornate;
      if (Array.isArray(data.storicoCarburante)) updates.storicoCarburante = data.storicoCarburante;
      if (Array.isArray(data.impegni)) updates.impegni = data.impegni;
      if (Array.isArray(data.appuntiGiornalieri)) updates.appuntiGiornalieri = data.appuntiGiornalieri;
      if (data.partenzaDa !== undefined) updates.partenzaDa = data.partenzaDa;
      if (typeof data.costoPerKm === 'number') updates.costoPerKm = data.costoPerKm;
      if (data.tipoCarburante !== undefined) updates.tipoCarburante = data.tipoCarburante;
      if (typeof data.targetMensile === 'number') updates.targetMensile = data.targetMensile;

      useAppStore.setState(updates);
      // Salva in AsyncStorage
      try {
        await (currentState as any).saveToStorage?.();
      } catch {}

      playSuccess();
      Alert.alert(
        'Import Riuscito',
        `Dati importati correttamente!\n\nMercati: ${(data.agenda || []).length}\nFornitori: ${(data.fornitori || []).length}\nGiornate storico: ${(data.storicoGiornate || []).length}\nFiere: ${(data.fiere || []).length}`,
      );
    } catch (err: any) {
      Alert.alert('Errore Import', `${err?.message || 'File non valido'}. Usa un file .json esportato da MarketMate.`);
    }
  };

  const autoCalculateKm = async (idx: number, partenza: string, destinazione: string) => {
    if (!partenza || !destinazione || partenza.trim().length < 2 || destinazione.trim().length < 2) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/distance/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partenza, destinazione }),
      });
      const data = await res.json();
      if (data.success && data.km_andata_ritorno > 0) {
        // CRITICAL: Read FRESH state from store, not from stale closure
        const freshAgenda = useAppStore.getState().agenda;
        const updated = [...freshAgenda];
        updated[idx] = { ...updated[idx], km: data.km_andata_ritorno };
        useAppStore.getState().updateAgenda(updated);
      }
    } catch (err) {
      // Silently fail
    }
  };

  // Ricalcola KM per TUTTI i mercati quando cambia la partenza
  const recalcAllKm = async (partenza: string) => {
    if (!partenza || partenza.trim().length < 2) return;
    for (let i = 0; i < store.agenda.length; i++) {
      const m = store.agenda[i];
      if (m.mercato && m.mercato.trim().length > 1) {
        // Delay between calls to respect rate limits
        await new Promise(r => setTimeout(r, 1200));
        await autoCalculateKm(i, partenza, m.mercato);
      }
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: topPad }]}>
      <Text style={s.title}>{t('settings.title')}</Text>

      {/* ─── LINGUA ─── */}
      <View style={s.card}>
        <Text style={[s.itemLabel, { marginBottom: 10, textAlign: 'center', fontSize: 12 }]}>{t('settings.language')}</Text>
        <View style={s.langRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              onPress={() => handleLanguageChange(l.code)}
              style={[s.langBtn, i18n.language === l.code && s.langBtnOn]}
            >
              <Text style={[s.langBtnTxt, i18n.language === l.code && { color: '#FFF' }]}>{l.flag} {l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Country-specific info */}
        <Text style={{ fontSize: 10, color: '#7A9090', textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
          {t('countries.marketRegulations')}
        </Text>
      </View>

      {/* ─── IDENTITÀ + PARTENZA ─── */}
      <View style={s.card}>
        <View style={s.itemRow}>
          <Ionicons name="storefront" size={20} color="#1E7F85" />
          <TouchableOpacity style={s.itemInfo} onPress={() => openModal(t('settings.businessName'), [t('settings.businessName')], (v) => store.setConfig({ nomeAttivita: v[0] }))}>
            <Text style={s.itemLabel}>{t('settings.businessName')}</Text>
            <Text style={s.itemVal}>{store.nomeAttivita || '---'}</Text>
          </TouchableOpacity>
          {!!store.nomeAttivita && store.nomeAttivita !== 'MarketMate' && (
            <TouchableOpacity onPress={() => store.setConfig({ nomeAttivita: '' })} style={{ marginRight: 6 }}>
              <Ionicons name="close-circle" size={20} color="#D46A6A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => openModal(t('settings.businessName'), [t('settings.businessName')], (v) => store.setConfig({ nomeAttivita: v[0] }))}>
            <Ionicons name="create-outline" size={18} color="#7A9090" />
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <View style={s.itemRow}>
          <Ionicons name="person" size={20} color="#1E7F85" />
          <TouchableOpacity style={s.itemInfo} onPress={() => openModal(t('settings.ownerName'), [t('settings.ownerName')], (v) => store.setConfig({ nomeTitolare: v[0] }))}>
            <Text style={s.itemLabel}>{t('settings.ownerName')}</Text>
            <Text style={s.itemVal}>{store.nomeTitolare || '---'}</Text>
          </TouchableOpacity>
          {!!store.nomeTitolare && (
            <TouchableOpacity onPress={() => store.setConfig({ nomeTitolare: '' })} style={{ marginRight: 6 }}>
              <Ionicons name="close-circle" size={20} color="#D46A6A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => openModal(t('settings.ownerName'), [t('settings.ownerName')], (v) => store.setConfig({ nomeTitolare: v[0] }))}>
            <Ionicons name="create-outline" size={18} color="#7A9090" />
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <View style={s.itemRow}>
          <Ionicons name="navigate" size={20} color="#1E7F85" />
          <TouchableOpacity style={s.itemInfo} onPress={() => openModal(t('settings.departure'), [t('settings.departure')], (v) => { store.setConfig({ partenzaDa: v[0] }); recalcAllKm(v[0]); })}>
            <Text style={s.itemLabel}>{t('settings.departure')}</Text>
            <Text style={s.itemVal}>{store.partenzaDa || '---'}</Text>
          </TouchableOpacity>
          {!!store.partenzaDa && (
            <TouchableOpacity onPress={() => store.setConfig({ partenzaDa: '' })} style={{ marginRight: 6 }}>
              <Ionicons name="close-circle" size={20} color="#D46A6A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => openModal(t('settings.departure'), [t('settings.departure')], (v) => { store.setConfig({ partenzaDa: v[0] }); recalcAllKm(v[0]); })}>
            <Ionicons name="create-outline" size={18} color="#7A9090" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── TIPO CARBURANTE ─── */}
      <View style={s.card}>
        <View style={s.itemRow}>
          <Ionicons name="speedometer" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>{t('settings.fuelType') || 'Tipo Carburante'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {['benzina', 'gasolio', 'gpl'].map((tipo) => (
            <TouchableOpacity
              key={tipo}
              onPress={() => store.setConfig({ tipoCarburante: tipo })}
              style={[
                s.fuelChip,
                (store.tipoCarburante || 'benzina') === tipo && s.fuelChipActive
              ]}
            >
              <Text style={[
                s.fuelChipText,
                (store.tipoCarburante || 'benzina') === tipo && s.fuelChipTextActive
              ]}>
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── SETTORE ─── */}
      <View style={s.card}>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>{store.isAlimentare ? t('settings.food') : t('settings.nonFood')}</Text>
          <Switch
            value={store.isAlimentare}
            onValueChange={(v) => store.setConfig({ isAlimentare: v })}
            trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* ─── SICUREZZA OTP ─── */}
      <Text style={s.secTitle}>{t('settings.securityTitle') || 'SICUREZZA'}</Text>
      <View style={s.card}>
        <View style={s.itemRow}>
          <Ionicons name="shield-checkmark" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>{t('settings.phoneNumber') || 'Numero di telefono'}</Text>
            <Text style={s.itemVal}>{store.phoneNumber || '---'}</Text>
          </View>
          <TouchableOpacity onPress={() => openModal(t('settings.phoneNumber') || 'Numero di telefono', ['+39...'], (v) => store.setConfig({ phoneNumber: v[0] }))}>
            <Ionicons name="create-outline" size={18} color="#1E7F85" />
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchLabel}>{t('settings.otpLogin') || 'Login con OTP'}</Text>
            <Text style={{ fontSize: 10, color: '#7A9090' }}>
              {t('settings.otpDesc') || 'Ricevi un codice di verifica ad ogni accesso'}
            </Text>
          </View>
          <Switch
            value={store.otpEnabled || false}
            onValueChange={(v) => {
              if (v && !store.phoneNumber) {
                if (Platform.OS === 'web') {
                  window.alert('Inserisci prima il numero di telefono');
                } else {
                  Alert.alert('Attenzione', 'Inserisci prima il numero di telefono');
                }
                return;
              }
              store.setConfig({ otpEnabled: v });
            }}
            trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* ─── SQUADRA COLLABORATORI ─── */}
      <Text style={s.secTitle}>{t('settings.collaboratorsTitle') || 'COLLABORATORI'}</Text>
      {store.collaboratori.map((c, i) => {
        const codiceCollab = store.codiciInvito?.find(cod => cod.nome === c.nome);
        return (
          <View key={i} style={s.card}>
            <View style={s.itemRow}>
              <Ionicons name="person-circle" size={28} color="#1E7F85" />
              <View style={[s.itemInfo, { flex: 1 }]}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A4040' }}>{c.nome}</Text>
              </View>
              {codiceCollab ? (
                <View style={{ backgroundColor: codiceCollab.tipo === 'A' ? '#E8A060' : '#1E7F85', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>
                    {t('settings.type') || 'TIPO'} {codiceCollab.tipo}
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#D0D0D0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>—</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() =>
                  openModal(t('settings.collaborators'), [t('settings.name'), `${t('settings.dailyCost')} €`, `${t('common.annual')} €`], (vals) => {
                    const updated = [...store.collaboratori];
                    updated[i] = { nome: vals[0], costo: parseFloat(vals[1].replace(',', '.')) || 0, costoAnnuo: parseFloat(vals[2].replace(',', '.')) || 0 };
                    store.setConfig({ collaboratori: updated });
                  }, ['default', 'numeric', 'numeric'], c.nome, codiceCollab, [c.nome, String(c.costo || ''), String(c.costoAnnuo || '')])
                }
              >
                <Ionicons name="create-outline" size={18} color="#7A9090" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (codiceCollab) store.removeCodiceInvito(codiceCollab.codice);
                store.removeCollaboratore(c.nome);
              }} style={{ marginLeft: 8 }}>
                <Ionicons name="trash-outline" size={18} color="#D46A6A" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          openModal(t('settings.addCollaborator'), [t('settings.name'), `${t('settings.dailyCost')} €`, `${t('common.annual')} €`], (vals) =>
            store.addCollaboratore({ nome: vals[0], costo: parseFloat(vals[1].replace(',', '.')) || 0, costoAnnuo: parseFloat(vals[2].replace(',', '.')) || 0 }), ['default', 'numeric', 'numeric'])
        }
      >
        <Ionicons name="person-add" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>{t('settings.addCollaborator')}</Text>
      </TouchableOpacity>

      {/* ─── ⭐ EVENTI E FIERE (Food Truck / Sagre / Festival) ─── */}
      <FiereRicorrentiSection />

      {/* ─── AGENDA MERCATI ─── */}
      <Text style={s.secTitle}>{t('settings.marketsTitle') || 'MERCATI'}</Text>
      {store.agenda.map((m, idx) => {
        const isOpen = expandedDay === idx;
        return (
          <View key={idx} style={s.card}>
            <TouchableOpacity style={s.agendaHeader} onPress={() => handleExpandDay(idx)}>
              <Text style={s.agendaDay}>{t(`days.${['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][idx]}`).toUpperCase()}</Text>
              <Text style={s.agendaMarket} numberOfLines={2}>{m.mercato || '---'}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
            </TouchableOpacity>
            {isOpen && (
              <View style={s.agendaBody}>
                <View style={s.divider} />
                {/* TextInput nome mercato con stato completamente locale */}
                <View style={s.inlineInputRow}>
                  <Ionicons name="storefront-outline" size={18} color="#1E7F85" />
                  <TextInput
                    style={[s.inlineInput, { flex: 1 }]}
                    placeholder={t('settings.marketName') || 'Nome mercato'}
                    placeholderTextColor="#A0A090"
                    value={localNames[idx] || ''}
                    onChangeText={(text) => {
                      setLocalNames(prev => {
                        const next = [...prev];
                        next[idx] = text;
                        return next;
                      });
                    }}
                    onBlur={() => commitName(idx, localNames[idx] || '')}
                    onEndEditing={() => commitName(idx, localNames[idx] || '')}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                  {localNames[idx] ? (
                    <TouchableOpacity onPress={() => {
                      setLocalNames(prev => { const n = [...prev]; n[idx] = ''; return n; });
                      commitName(idx, '');
                    }} style={{ marginLeft: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#D46A6A" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity style={[s.agendaItem, { flex: 1 }]} onPress={() => openModal(t('settings.kmRoundTrip'), [t('settings.km')], (v) => updateMercato(idx, 'km', parseFloat(v[0].replace(',', '.')) || 0))}>
                    <Text style={s.itemLabel}>{t('settings.kmRoundTrip')}</Text>
                    <Text style={s.agendaVal}>{m.km || '---'}</Text>
                  </TouchableOpacity>
                  {store.partenzaDa && m.mercato ? (
                    <TouchableOpacity
                      style={{ backgroundColor: '#1E7F85', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4 }}
                      onPress={() => autoCalculateKm(idx, store.partenzaDa, m.mercato)}
                    >
                      <Ionicons name="navigate" size={14} color="#FFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity style={s.agendaItem} onPress={() => openModal(t('settings.avgReceipt'), [`${t('settings.amount')}`], (v) => updateMercato(idx, 'mediaScontrino', parseFloat(v[0].replace(',', '.')) || 0))}>
                  <Text style={s.itemLabel}>{t('settings.avgReceipt')}</Text>
                  <Text style={s.agendaVal}>{m.mediaScontrino ? `€${m.mediaScontrino}` : '---'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.cameraBtn}
                  onPress={() => handleReceiptCapture(idx)}
                  disabled={ocrLoading}
                >
                  {ocrLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color="#FFF" />
                  )}
                  <Text style={s.cameraBtnTxt}>
                    {ocrLoading ? (t('settings.analyzing') || 'Analisi in corso...') : (t('settings.receiptPhotoBtn') || 'Foto chiusura fiscale → calcola media scontrino')}
                  </Text>
                </TouchableOpacity>
                {/* Show storico scontrini count if available */}
                {store.storicoScontrini && store.storicoScontrini.filter(sc => sc.mercato === m.mercato).length > 0 && (
                  <Text style={s.agendaHint}>
                    {store.storicoScontrini.filter(sc => sc.mercato === m.mercato).length} {t('settings.receiptsAnalyzed') || 'scontrini analizzati'}
                  </Text>
                )}
                <View style={s.switchRow}>
                  <Text style={s.itemLabel}>{t('settings.standFeeType')}</Text>
                  <Switch
                    value={m.is_plat_annuo}
                    onValueChange={(v) => updateMercato(idx, 'is_plat_annuo', v)}
                    trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
                    thumbColor="#FFF"
                  />
                  <Text style={[s.itemLabel, { color: '#1E7F85', fontWeight: '800' }]}>
                    {m.is_plat_annuo ? t('settings.annualFee') : t('settings.dailyFee')}
                  </Text>
                </View>
                {m.is_plat_annuo ? (
                  <TouchableOpacity style={s.agendaItem} onPress={() => openModal(t('settings.annualStandFeeShort'), [`${t('settings.amount')}`], (v) => updateMercato(idx, 'p_annuo', parseFloat(v[0].replace(',', '.')) || 0))}>
                    <Text style={s.itemLabel}>{t('settings.annualStandFeeShort')} €</Text>
                    <Text style={s.agendaVal}>{m.p_annuo}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.agendaItem} onPress={() => openModal(t('settings.dailyStandFeeShort'), [`${t('settings.amount')}`], (v) => updateMercato(idx, 'p_giornaliero', parseFloat(v[0].replace(',', '.')) || 0))}>
                    <Text style={s.itemLabel}>{t('settings.dailyStandFeeShort')} €</Text>
                    <Text style={s.agendaVal}>{m.p_giornaliero}</Text>
                  </TouchableOpacity>
                )}
                <Text style={s.agendaHint}>
                  {m.is_plat_annuo ? `${t('settings.dailyImpact')}: €${m.p_giornaliero}` : `${t('settings.annualTotal')}: €${m.p_annuo}`}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      <Text style={s.secTitle}>{t('settings.marketsTitle') || 'MERCATI'}</Text>
      {store.fornitori.map((f, fi) => {
        const isOpen = expandedForn === fi;
        return (
          <View key={fi} style={s.card}>
            <TouchableOpacity style={s.agendaHeader} onPress={() => setExpandedForn(isOpen ? null : fi)}>
              <Ionicons name="cube-outline" size={20} color="#1E7F85" />
              <Text style={[s.agendaDay, { flex: 1 }]}>{f.nome}</Text>
              {/* Modifica nome fornitore */}
              <TouchableOpacity onPress={() =>
                openModal(t('settings.editName') || 'Modifica nome', [t('settings.name')], (vals) => {
                  if (vals[0] && vals[0].trim()) {
                    const updF = [...store.fornitori];
                    updF[fi] = { ...updF[fi], nome: vals[0].trim() };
                    store.setConfig({ fornitori: updF });
                  }
                }, ['default'], undefined, undefined, [f.nome])
              }>
                <Ionicons name="pencil-outline" size={16} color="#1E7F85" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => store.removeFornitore(f.nome)} style={{ marginLeft: 6 }}>
                <Ionicons name="trash-outline" size={18} color="#D46A6A" />
              </TouchableOpacity>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            {isOpen && store.isAlimentare && (
              <View style={s.agendaBody}>
                <View style={s.divider} />
                {f.prodotti.map((p, pi) => (
                  <View key={pi} style={s.prodRow}>
                    {/* Tap sul nome/prezzo per modificare */}
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() =>
                      openModal(t('settings.editProduct') || 'Modifica prodotto', [t('settings.productName'), `${t('settings.pricePerKg')} €`], (vals) => {
                        const updF = [...store.fornitori];
                        updF[fi] = {
                          ...updF[fi],
                          prodotti: updF[fi].prodotti.map((prod, idx) =>
                            idx === pi ? { nome: vals[0] || prod.nome, prezzo: parseFloat(vals[1].replace(',', '.')) || prod.prezzo } : prod
                          ),
                        };
                        store.setConfig({ fornitori: updF });
                      }, ['default', 'numeric'], undefined, undefined, [p.nome, p.prezzo.toString()])
                    }>
                      <Text style={s.itemVal}>{p.nome}</Text>
                      <Text style={[s.itemLabel, { color: '#1E7F85' }]}>€{p.prezzo}/kg</Text>
                      <Ionicons name="pencil-outline" size={12} color="#B0B0A0" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      const updF = [...store.fornitori];
                      updF[fi] = { ...updF[fi], prodotti: updF[fi].prodotti.filter((_, idx) => idx !== pi) };
                      store.setConfig({ fornitori: updF });
                    }}>
                      <Ionicons name="trash-outline" size={16} color="#D46A6A" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={s.addBtnSmall}
                  onPress={() =>
                    openModal(t('settings.newProduct'), [t('settings.productName'), `${t('settings.pricePerKg')} €`], (vals) => {
                      const updF = [...store.fornitori];
                      updF[fi] = {
                        ...updF[fi],
                        prodotti: [...updF[fi].prodotti, { nome: vals[0], prezzo: parseFloat(vals[1].replace(',', '.')) || 0 }],
                      };
                      store.setConfig({ fornitori: updF });
                    }, ['default', 'numeric'])
                  }
                >
                  <Ionicons name="add" size={16} color="#1E7F85" />
                  <Text style={s.addBtnSmallTxt}>{t('settings.addProduct')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isOpen && !store.isAlimentare && (
              <View style={s.agendaBody}>
                <View style={s.divider} />
                <Text style={[s.itemLabel, { paddingVertical: 8, color: '#7A9090', fontStyle: 'italic' }]}>
                  Fornitore registrato. Le perdite si inseriscono dalla Home.
                </Text>
              </View>
            )}
          </View>
        );
      })}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          openModal(t('settings.addSupplier'), [t('settings.name')], (vals) =>
            store.addFornitore({ nome: vals[0], prodotti: [] }))
        }
      >
        <Ionicons name="cube-outline" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>{t('settings.addSupplier')}</Text>
      </TouchableOpacity>

      {/* ─── SPESE ANNUALI (collapsible) ─── */}
      <View style={s.card}>
        <TouchableOpacity style={s.agendaHeader} onPress={() => setExpandedSpese(!expandedSpese)}>
          <Ionicons name="card" size={20} color="#1E7F85" />
          <Text style={[s.agendaDay, { flex: 1 }]}>{t('settings.fixedExpenses')}</Text>
          <Text style={[s.itemLabel, { color: '#D46A6A', fontWeight: '800' }]}>€{totaleSpeseAnnue}</Text>
          <Ionicons name={expandedSpese ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
        {expandedSpese && (
          <View style={s.agendaBody}>
            <View style={s.divider} />
            {store.speseAnnue.length === 0 && totalePlatAnnui === 0 && (
              <Text style={s.emptyTxt}>{t('settings.noExpenses')}</Text>
            )}
            {store.speseAnnue.map((sp, i) => {
              const isDisabled = (store.speseAnnueDisabilitate || []).includes(sp.voce);
              return (
                <View key={i} style={s.spesaRow}>
                  <Switch
                    value={!isDisabled}
                    onValueChange={() => store.toggleSpesaAnnua(sp.voce)}
                    trackColor={{ false: '#D0C8C0', true: '#1E7F85' }}
                    thumbColor="#FFF"
                    style={{ transform: [{ scale: 0.7 }], marginRight: 4 }}
                  />
                  <Text style={[s.spesaNome, isDisabled && { textDecorationLine: 'line-through', color: '#B0A898' }]}>{sp.voce}</Text>
                  <Text style={[s.spesaVal, isDisabled && { textDecorationLine: 'line-through', color: '#B0A898' }]}>€{sp.importo}</Text>
                  <TouchableOpacity onPress={() => store.removeSpesaAnnua(sp.voce)}>
                    <Ionicons name="trash-outline" size={16} color="#D46A6A" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {store.agenda.filter((m) => m.p_annuo > 0).map((m, i) => (
              <View key={`p-${i}`} style={s.spesaRow}>
                <Text style={[s.spesaNome, { color: '#7A9090' }]}>Plat. {m.mercato}</Text>
                <Text style={[s.spesaVal, { color: '#7A9090' }]}>€{m.p_annuo}</Text>
                <TouchableOpacity onPress={() => {
                  const idx = store.agenda.findIndex(a => a.mercato === m.mercato);
                  if (idx >= 0) {
                    updateMercato(idx, 'p_annuo', 0);
                    updateMercato(idx, 'p_giornaliero', 0);
                  }
                }}>
                  <Ionicons name="trash-outline" size={16} color="#D46A6A" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[s.addBtnSmall, { marginTop: 10 }]}
              onPress={() => openModal(t('settings.annualExpense'), [t('settings.expenseItem'), `${t('settings.amount')}`], (vals) =>
                store.addSpesaAnnua({ voce: vals[0], importo: parseFloat((vals[1] || '0').replace(',', '.')) || 0 }),
                ['default', 'numeric']
              )}
            >
              <Ionicons name="add" size={16} color="#1E7F85" />
              <Text style={s.addBtnSmallTxt}>{t('settings.addExpense')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── SALVA TUTTO ─── */}
      <TouchableOpacity style={s.saveAll} onPress={() => { store.forceFlushSave(); playSuccess(); }}>
        <Ionicons name="save" size={18} color="#FFF" />
        <Text style={s.saveAllTxt}>{t('settings.saveSettings')}</Text>
      </TouchableOpacity>

      {/* ─── RESET ─── */}
      <Text style={[s.secTitle, { marginTop: 24, color: '#D46A6A' }]}>{t('settings.dangerZone') || 'ZONA PERICOLOSA'}</Text>
      <View style={[s.card, { borderWidth: 2, borderColor: '#D46A6A' }]}>
        <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 12, textAlign: 'center' }}>
          {t('settings.resetWarning') || 'Queste azioni sono irreversibili'}
        </Text>
        
        <TouchableOpacity
          style={[s.resetBtn, { backgroundColor: '#E8A060' }]}
          onPress={() => {
            const doReset = () => {
              // Reset only numeric values (incassi, spese)
              store.setConfig({
                storicoGiornate: [],
                storicoCarburante: [],
                storicoDiario: [],
                storicoScontrini: [],
              });
              if (Platform.OS === 'web') window.alert(t('settings.valuesReset') || 'Valori numerici azzerati');
              else Alert.alert(t('common.done') || 'Fatto', t('settings.valuesReset') || 'Valori numerici azzerati');
            };
            if (Platform.OS === 'web') {
              if (window.confirm(t('settings.confirmResetValues') || 'Azzerare tutti i dati numerici (incassi, spese, carburante)?')) doReset();
            } else {
              Alert.alert(
                t('settings.resetValues') || 'Reset Valori',
                t('settings.confirmResetValues') || 'Azzerare tutti i dati numerici (incassi, spese, carburante)?',
                [
                  { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                  { text: t('settings.reset') || 'Reset', style: 'destructive', onPress: doReset },
                ]
              );
            }
          }}
        >
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={s.resetBtnTxt}>{t('settings.resetValues') || 'RESET VALORI'}</Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 10, color: '#7A9090', marginVertical: 8, textAlign: 'center' }}>
          {t('settings.resetValuesDesc') || 'Azzera solo incassi, spese e carburante. Mantiene mercati, fornitori e impostazioni.'}
        </Text>
        
        <TouchableOpacity
          style={[s.resetBtn, { backgroundColor: '#D46A6A' }]}
          onPress={() => {
            const doFullReset = () => {
              store.resetAll();
              if (Platform.OS === 'web') window.alert(t('settings.fullResetDone') || 'App ripristinata allo stato di fabbrica');
              else Alert.alert(t('common.done') || 'Fatto', t('settings.fullResetDone') || 'App ripristinata allo stato di fabbrica');
            };
            if (Platform.OS === 'web') {
              if (window.confirm(t('settings.confirmFullReset') || 'ATTENZIONE! Eliminare TUTTO e ripristinare lo stato di fabbrica?')) doFullReset();
            } else {
              Alert.alert(
                t('settings.fullReset') || 'RESET TOTALE',
                t('settings.confirmFullReset') || 'ATTENZIONE! Eliminare TUTTO (mercati, fornitori, impostazioni) e ripristinare lo stato di fabbrica?',
                [
                  { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                  { text: t('settings.fullReset') || 'RESET TOTALE', style: 'destructive', onPress: doFullReset },
                ]
              );
            }
          }}
        >
          <Ionicons name="trash" size={18} color="#FFF" />
          <Text style={s.resetBtnTxt}>{t('settings.fullReset') || 'RESET TOTALE'}</Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 10, color: '#D46A6A', marginTop: 8, textAlign: 'center', fontWeight: '700' }}>
          {t('settings.fullResetDesc') || 'Elimina TUTTO: mercati, fornitori, collaboratori, impostazioni. Ripristina lo stato di fabbrica.'}
        </Text>
      </View>

      {/* ─── EXPORT DATI ─── */}
      <View style={[s.card, { marginTop: 20 }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="download-outline" size={20} color="#1E7F85" />
          <Text style={s.sectionTitle}>BACKUP DATI</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 12 }}>
          Esporta un file di backup con tutti i tuoi dati. Puoi inviarlo via WhatsApp, email o salvarlo. Usa "Importa" per ripristinare i dati su un nuovo dispositivo o dopo una reinstallazione.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
          onPress={handleExportData}
        >
          <Ionicons name="share-outline" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>ESPORTA DATI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#D4AF37', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onPress={handleImportData}
        >
          <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>IMPORTA DATI</Text>
        </TouchableOpacity>
      </View>

      {/* ─── INFO APP ─── */}
      <View style={{ marginTop: 24, alignItems: 'center', paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1A4040', letterSpacing: 2 }}>MarketMate</Text>
        <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>Versione 3.9</Text>
        <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>© 2026 T.V.S di Francesco Cavallaro</Text>
        <Text style={{ fontSize: 10, color: '#B0B0A0', marginTop: 6 }}>Tutti i diritti riservati</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Ionicons name="shield-checkmark" size={14} color="#1E7F85" />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E7F85' }}>Dati protetti e crittografati sul dispositivo</Text>
        </View>
      </View>

      {/* ─── Il pulsante "Esci dall'App" è stato rimosso: è già presente in Home ─── */}

      <View style={{ height: 40 }} />

      {/* ─── OCR Loading Overlay ─── */}
      {ocrLoading && (
        <Modal visible transparent animationType="fade">
          <View style={ms.overlay}>
            <View style={[ms.modal, { alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#1E7F85" />
              <Text style={[ms.modalTitle, { marginTop: 16 }]}>
                {t('settings.analyzingReceipt') || 'Analisi scontrino in corso...'}
              </Text>
              <Text style={{ fontSize: 12, color: '#7A9090', textAlign: 'center', marginTop: 8 }}>
                {t('settings.aiReading') || 'L\'AI sta leggendo i dati dalla foto'}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── OCR Result Modal ─── */}
      <Modal visible={ocrResult.visible} transparent animationType="fade" onRequestClose={() => setOcrResult(p => ({ ...p, visible: false }))}>
        <View style={ms.overlay}>
          <View style={ms.modal}>
            <Text style={ms.modalTitle}>
              {t('settings.receiptResult') || 'Risultato Analisi'}
            </Text>
            
            <View style={s.ocrResultCard}>
              <View style={s.ocrResultRow}>
                <Ionicons name="cash-outline" size={22} color="#1E7F85" />
                <View style={{ flex: 1 }}>
                  <Text style={s.ocrResultLabel}>{t('settings.dailyTotal') || 'Totale Giornaliero'}</Text>
                  <Text style={s.ocrResultValue}>€{ocrResult.totale.toFixed(0)}</Text>
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.ocrResultRow}>
                <Ionicons name="receipt-outline" size={22} color="#1E7F85" />
                <View style={{ flex: 1 }}>
                  <Text style={s.ocrResultLabel}>{t('settings.numReceipts') || 'N. Scontrini'}</Text>
                  <Text style={s.ocrResultValue}>{ocrResult.numScontrini}</Text>
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.ocrResultRow}>
                <Ionicons name="analytics-outline" size={22} color="#8B6914" />
                <View style={{ flex: 1 }}>
                  <Text style={s.ocrResultLabel}>{t('settings.avgReceipt') || 'Media Scontrino'}</Text>
                  <Text style={[s.ocrResultValue, { color: '#8B6914', fontSize: 22 }]}>€{ocrResult.mediaScontrino.toFixed(0)}</Text>
                </View>
              </View>
            </View>

            <View style={ms.modalBtns}>
              <TouchableOpacity onPress={() => setOcrResult(p => ({ ...p, visible: false }))} style={ms.modalCancel}>
                <Text style={ms.modalCancelTxt}>{(t('common.cancel') || 'ANNULLA').toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmOcrResult} style={ms.modalSave}>
                <Text style={ms.modalSaveTxt}>{t('settings.saveResult') || 'Salva Risultato'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Input Modal ─── */}
      <InputModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        hints={modalConfig.hints}
        keyboardTypes={modalConfig.keyboardTypes}
        onSave={modalConfig.onSave}
        onClose={() => setModalConfig((p) => ({ ...p, visible: false }))}
        collabName={modalConfig.collabName}
        collabCodice={modalConfig.collabCodice}
        initialValues={modalConfig.initialValues}
        onGenerateCodice={(tipo, nome) => {
          const codice = store.generateCodiceInvito(tipo, nome);
          // Aggiorna il modal per mostrare il codice generato inline (non chiudiamo il modal)
          setModalConfig((p) => ({
            ...p,
            collabCodice: { codice, tipo, nome, attivo: true, dataCreazione: new Date().toISOString() },
          }));
        }}
      />
    </ScrollView>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E6' },
  content: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 30, gap: 10 },

  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7A9090',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 6,
  },

  secTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A7575',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#EDE8DA',
    borderRadius: 16,
    padding: 16,
    // @ts-ignore
    boxShadow:
      '4px 4px 10px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },

  divider: {
    height: 1,
    backgroundColor: '#D0C8B8',
    marginVertical: 10,
  },

  /* Item rows */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 11, color: '#7A9090', fontWeight: '600' },
  itemVal: { fontSize: 14, fontWeight: '700', color: '#1A3535' },

  /* Switch */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#1A3535' },

  /* Language */
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0DBC8',
    // @ts-ignore
    boxShadow:
      '2px 2px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.8)',
  },
  langBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow:
      '3px 3px 8px rgba(15,60,65,0.45), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  langBtnTxt: { fontSize: 12, fontWeight: '700', color: '#4A3A2A' },

  /* Agenda */
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agendaDay: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
  agendaMarket: {
    flex: 1,
    fontSize: 13,
    color: '#7A9090',
    textAlign: 'right',
    marginRight: 8,
  },
  agendaBody: { paddingTop: 4 },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(30,127,133,0.2)',
  },
  inlineInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3535',
    paddingVertical: 10,
  },
  agendaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  agendaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E7F85',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  agendaHint: {
    fontSize: 11,
    color: '#7A9090',
    fontStyle: 'italic',
    marginTop: 4,
  },

  /* Checkbox */
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#1E7F85' },

  /* Prodotti */
  prodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },

  /* Add button */
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 4,
  },
  addBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E7F85',
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1E7F85',
    borderRadius: 8,
  },
  addBtnSmallTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E7F85',
  },

  /* Spese */
  spesaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  spesaNome: { flex: 1, fontSize: 13, color: '#1A3535' },
  spesaVal: { fontSize: 14, fontWeight: '700', color: '#1A3535', marginRight: 10 },
  emptyTxt: {
    fontSize: 12,
    color: '#7A9090',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#D46A6A' },

  /* Save All */
  saveAll: {
    backgroundColor: '#1A3535',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    // @ts-ignore
    boxShadow:
      '4px 4px 12px rgba(0,0,0,0.3), -2px -2px 6px rgba(50,80,80,0.2)',
  },
  saveAllTxt: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 4,
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(0,0,0,0.2)',
  },
  resetBtnTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  cameraBtnTxt: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  ocrResultCard: {
    backgroundColor: '#E8E3D5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  ocrResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  ocrResultLabel: {
    fontSize: 11,
    color: '#7A9090',
    fontWeight: '600',
  },
  ocrResultValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A3535',
  },
  fuelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8E3D5',
    borderWidth: 1.5,
    borderColor: '#C0D0C8',
  },
  fuelChipActive: {
    backgroundColor: '#1E7F85',
    borderColor: '#1E7F85',
  },
  fuelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3535',
  },
  fuelChipTextActive: {
    color: '#FFF',
  },
  // Codici invito
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E3D5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A3535',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  codeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  inviteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  inviteBtnTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});

/* ─── MODAL STYLES ─── */
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#F0EDE5',
    borderRadius: 20,
    padding: 24,
    // @ts-ignore
    boxShadow: '0px 8px 30px rgba(0,0,0,0.25)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A3535',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#E0DBC8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A3535',
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E0DBC8',
    alignItems: 'center',
  },
  modalCancelTxt: { fontSize: 12, fontWeight: '700', color: '#7A9090' },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E7F85',
    alignItems: 'center',
  },
  modalSaveTxt: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  // Stili per sezione INVITA
  inviteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8A060',
    backgroundColor: 'transparent',
  },
  inviteToggleTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E8A060',
    letterSpacing: 0.5,
  },
  inviteSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F0E6',
    borderRadius: 12,
  },
  inviteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A9090',
    marginBottom: 10,
    textAlign: 'center',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  inviteBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  inviteBtnDesc: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  existingCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  existingCodeLabel: {
    fontSize: 10,
    color: '#7A9090',
    fontWeight: '600',
  },
  existingCodeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A4040',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  inviteContactInput: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1A4040',
    borderWidth: 1,
    borderColor: '#E0D8C8',
  },
  sendInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E7F85',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  sendInviteBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
});
