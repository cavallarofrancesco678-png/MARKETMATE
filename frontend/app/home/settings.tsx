import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  StatusBar,
  Share as RNShare,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, MercatoAgenda } from '../../src/store/appStore';
import { playTap, playSuccess, hapticTap } from '../../src/utils/feedback';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage, getDayNames } from '../../src/i18n';
// Round 57: rimosso `import * as ImagePicker from 'expo-image-picker'`
// (eliminata la funzionalità camera/scontrino)
// IMPORT DA /legacy: la nuova API di expo-file-system >=19 ha deprecato
// readAsStringAsync/writeAsStringAsync (throw error). L'API legacy le mantiene
// identiche e funzionanti. Documentazione:
// https://docs.expo.dev/versions/latest/sdk/filesystem/#legacy-api
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { useAuthStore } from '../../src/store/authStore';
import { useTeamSyncStore, roleBackendToUi } from '../../src/store/teamSyncStore';
import * as Clipboard from 'expo-clipboard';
import { useTutorialStore } from '../../src/store/tutorialStore';
import { FornitoreEditor } from '../../src/components/FornitoreEditor';
import { useTutorialAnchor, useTutorialScrollHelper } from '../../src/store/tutorialLayoutStore';
import { router } from 'expo-router';
import { RoleGuard } from '../../src/components/RoleGuard';
import { NotificationsCard } from '../../src/components/NotificationsCard';

// ═══════════════════════════════════════════════════════════════
// AccountSection — Login/Register/Multi-user entrypoint
// ═══════════════════════════════════════════════════════════════
function AccountSection() {
  const { user, isAuthenticated, logout, deleteAccount } = useAuthStore();
  const { t } = useTranslation();
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const wipeAllAppData = useAppStore((st) => (st as any).resetAll);

  /* ═══ Round 67 — Cancellazione DEFINITIVA account (GDPR Art. 17 + Apple 5.1.1) ═══
     Doppia conferma: prima conferma soft, poi modal con typing del testo
     "ELIMINA" come safeguard contro click accidentali. */
  const performDeleteAccount = async () => {
    setDeleting(true);
    try {
      const details = await deleteAccount();
      // Pulisce anche i dati locali (Zustand + AsyncStorage)
      try { if (typeof wipeAllAppData === 'function') await wipeAllAppData(); } catch {}
      const msg = details?.is_owner
        ? `Account eliminato. Rimossi ${details.collaborators_deleted} collaboratori e ${details.data_records_deleted} record dati.`
        : 'Account collaboratore eliminato.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Eliminato', msg);
      }
      // Reindirizza all'onboarding
      router.replace('/');
    } catch (e: any) {
      const err = String(e?.message || e || 'Errore sconosciuto');
      if (Platform.OS === 'web') {
        window.alert('Errore: ' + err);
      } else {
        Alert.alert('Errore', err);
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const promptDeleteAccount = () => {
    const isOwner = user?.role === 'owner';
    const warningMsg = isOwner
      ? 'ATTENZIONE: stai per eliminare DEFINITIVAMENTE il tuo account TITOLARE.\n\nVerranno cancellati:\n• Il tuo profilo\n• TUTTI i tuoi collaboratori\n• TUTTI i dati dell\'attività (storico, fornitori, fiere, statistiche)\n\nQuesta operazione è IRREVERSIBILE.'
      : 'Stai per eliminare il tuo account collaboratore. I dati dell\'attività restano in capo al titolare.\n\nQuesta operazione è irreversibile.';

    if (Platform.OS === 'web') {
      if (window.confirm(warningMsg + '\n\nProcedere con la richiesta?')) {
        setShowDeleteConfirm(true);
      }
    } else {
      Alert.alert(
        '⚠️ Eliminare account?',
        warningMsg,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Procedi', style: 'destructive', onPress: () => setShowDeleteConfirm(true) },
        ],
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[s.card, { marginTop: 20 }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="cloud-outline" size={20} color="#1E7F85" />
          <Text style={s.sectionTitle}>{t('settings.cloudAccountTitle') || 'ACCOUNT CLOUD'}</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 10, lineHeight: 16 }}>
          {t('settings.cloudAccountDesc') || 'Crea un account cloud per sincronizzare i dati su più dispositivi.'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onPress={() => router.push('/auth')}
        >
          <Ionicons name="person-add" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>{t('settings.enableCloudBtn') || 'ABILITA ACCOUNT CLOUD'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const isOwner = user?.role === 'owner';
  return (
    <View style={[s.card, { marginTop: 20 }]}>
      <View style={s.sectionHeader}>
        <Ionicons name="cloud-done" size={20} color="#1E7F85" />
        <Text style={s.sectionTitle}>{t('settings.cloudAccountTitle') || 'ACCOUNT CLOUD'}</Text>
      </View>
      <View style={{ backgroundColor: '#E3F5EF', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#1E7F85' }}>{user?.email}</Text>
        <Text style={{ fontSize: 11, color: '#5A7575', marginTop: 2 }}>
          Ruolo: {user?.role === 'owner' ? 'TITOLARE' : user?.role === 'full' ? 'COLLABORATORE FULL' : 'COLLABORATORE OPERATIVO'}
        </Text>
      </View>
      {isOwner && (
        <TouchableOpacity
          style={{ backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}
          onPress={() => router.push('/home/collaborators')}
        >
          <Ionicons name="people" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>GESTISCI COLLABORATORI</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={{ backgroundColor: '#F5EFDC', borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#D46A6A' }}
        onPress={() => {
          if (Platform.OS === 'web') {
            if (window.confirm('Uscire dall\'account? I dati locali sul dispositivo restano, ma non saranno più sincronizzati.')) logout();
          } else {
            Alert.alert('Esci dall\'account', 'I dati locali restano, ma non saranno più sincronizzati.', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Esci', style: 'destructive', onPress: () => logout() },
            ]);
          }
        }}
      >
        <Ionicons name="log-out" size={18} color="#D46A6A" />
        <Text style={{ color: '#D46A6A', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>ESCI DALL'ACCOUNT</Text>
      </TouchableOpacity>

      {/* ═══ Round 67 — ELIMINA ACCOUNT (GDPR Art. 17) ═══ */}
      <TouchableOpacity
        style={{
          marginTop: 10,
          backgroundColor: '#FFEDE9',
          borderRadius: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: 1.5,
          borderColor: '#D62828',
        }}
        onPress={promptDeleteAccount}
        disabled={deleting}
      >
        <Ionicons name="trash" size={18} color="#D62828" />
        <Text style={{ color: '#D62828', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
          ELIMINA ACCOUNT
        </Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 10, color: '#7A7A7A', textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
        Diritto all'oblio (GDPR Art. 17). Operazione irreversibile.
      </Text>

      {/* ═══ Modal CONFERMA FINALE con typing safeguard ═══ */}
      <DeleteAccountConfirmModal
        visible={showDeleteConfirm}
        isOwner={isOwner}
        deleting={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={performDeleteAccount}
      />
    </View>
  );
}

/* ═══ Round 67 — Modal di conferma con typing safeguard ═══
   L'utente deve digitare "ELIMINA" per attivare il pulsante finale.
   Previene click accidentali e segnala chiaramente l'irreversibilità. */
function DeleteAccountConfirmModal(props: {
  visible: boolean;
  isOwner: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => { if (!props.visible) setTyped(''); }, [props.visible]);
  const canConfirm = typed.trim().toUpperCase() === 'ELIMINA';

  if (!props.visible) return null;
  return (
    <Modal transparent animationType="fade" visible={props.visible} onRequestClose={props.onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 22 }}>
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFEDE9', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={32} color="#D62828" />
            </View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 10 }}>
            Conferma eliminazione
          </Text>
          <Text style={{ fontSize: 13, color: '#5A5A5A', lineHeight: 19, marginBottom: 16, textAlign: 'center' }}>
            {props.isOwner
              ? 'Stai per eliminare in modo DEFINITIVO il tuo account titolare e tutti i dati associati.'
              : 'Stai per eliminare in modo DEFINITIVO il tuo account collaboratore.'}
            {'\n\n'}Per confermare, digita <Text style={{ fontWeight: '900', color: '#D62828' }}>ELIMINA</Text> qui sotto:
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Digita ELIMINA"
            placeholderTextColor="#B0B0B0"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              backgroundColor: '#F5F1E8',
              borderRadius: 10,
              padding: 12,
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
              color: '#D62828',
              letterSpacing: 3,
              borderWidth: 1.5,
              borderColor: canConfirm ? '#D62828' : '#DCD5C4',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              onPress={props.onCancel}
              disabled={props.deleting}
              style={{ flex: 1, backgroundColor: '#F5F1E8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#1A4040' }}>ANNULLA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={props.onConfirm}
              disabled={!canConfirm || props.deleting}
              style={{
                flex: 1,
                backgroundColor: canConfirm && !props.deleting ? '#D62828' : '#E5C8C5',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {props.deleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="trash" size={15} color="#FFF" />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFF' }}>ELIMINA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  onGenerateCodice?: (tipo: 'AMMINISTRATORE' | 'MANAGER' | 'UTENTE', nome: string) => void;
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
                  {collabCodice ? (() => {
                    // Mappa colore + label per i 3 ruoli (con backward compat su 'A'/'B')
                    const t = collabCodice.tipo as any;
                    let color = '#E8A060';
                    let label = 'UTENTE';
                    let descRuolo = 'Accesso Utente';
                    if (t === 'AMMINISTRATORE' || t === 'B') { color = '#B85450'; label = 'AMMINISTRATORE'; descRuolo = 'Accesso Amministratore'; }
                    else if (t === 'MANAGER') { color = '#1E7F85'; label = 'MANAGER'; descRuolo = 'Accesso Manager'; }
                    else if (t === 'UTENTE' || t === 'A') { color = '#E8A060'; label = 'UTENTE'; descRuolo = 'Accesso Utente'; }
                    return (
                    <View style={ms.existingCode}>
                      <Text style={ms.existingCodeLabel}>{tModal('settings.activeCode') || 'CODICE ATTIVO'}:</Text>
                      <Text style={ms.existingCodeValue}>{collabCodice.codice}</Text>
                      <View style={[ms.codeBadge, { backgroundColor: color }]}>
                        <Text style={ms.codeBadgeTxt}>{label}</Text>
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
                            const msg = `Ciao! Ecco il tuo codice per MarketMate: ${collabCodice.codice} (${descRuolo})`;
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
                    );
                  })() : (
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
                      {/* ═══ AMMINISTRATORE — controllo totale ═══ */}
                      <TouchableOpacity
                        style={[ms.inviteBtn, { backgroundColor: '#B85450' }]}
                        onPress={() => {
                          const nome = values[0] || collabName || 'Collaboratore';
                          if (onGenerateCodice) onGenerateCodice('AMMINISTRATORE', nome);
                        }}
                      >
                        <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={ms.inviteBtnTxt}>{tModal('settings.roleAdmin') || 'AMMINISTRATORE'}</Text>
                          <Text style={ms.inviteBtnDesc}>{tModal('settings.roleAdminDesc') || 'Controllo totale: settings, fatturazione, gestione ruoli'}</Text>
                        </View>
                      </TouchableOpacity>
                      {/* ═══ MANAGER — operatività quotidiana, NO modifiche ai dati passati ═══ */}
                      <TouchableOpacity
                        style={[ms.inviteBtn, { backgroundColor: '#1E7F85' }]}
                        onPress={() => {
                          const nome = values[0] || collabName || 'Collaboratore';
                          if (onGenerateCodice) onGenerateCodice('MANAGER', nome);
                        }}
                      >
                        <Ionicons name="briefcase-outline" size={18} color="#FFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={ms.inviteBtnTxt}>{tModal('settings.roleManager') || 'MANAGER'}</Text>
                          <Text style={ms.inviteBtnDesc}>{tModal('settings.roleManagerDesc') || 'Home, note, carburante. Dati passati in sola lettura'}</Text>
                        </View>
                      </TouchableOpacity>
                      {/* ═══ UTENTE — solo input base, niente altro visibile ═══ */}
                      <TouchableOpacity
                        style={[ms.inviteBtn, { backgroundColor: '#E8A060' }]}
                        onPress={() => {
                          const nome = values[0] || collabName || 'Collaboratore';
                          if (onGenerateCodice) onGenerateCodice('UTENTE', nome);
                        }}
                      >
                        <Ionicons name="person-outline" size={18} color="#FFF" />
                        <View style={{ flex: 1 }}>
                          <Text style={ms.inviteBtnTxt}>{tModal('settings.roleUser') || 'UTENTE'}</Text>
                          <Text style={ms.inviteBtnDesc}>{tModal('settings.roleUserDesc') || 'Inserisce dati home/fuel/note. Non vede altro'}</Text>
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
function SettingsPageInner() {
  const store = useAppStore();
  const { t, i18n } = useTranslation();
  const tutStart = useTutorialStore((s) => s.start);
  const safeInsets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : safeInsets.top + 16;

  // ═══ Tutorial: ref di pagina + tracker scroll Y per native ═══
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  useTutorialScrollHelper('/home/settings', scrollRef, scrollYRef);

  // Anchor refs registrati nello store
  const anchorCollab = useTutorialAnchor('sett-collab-card');
  const anchorAgenda = useTutorialAnchor('sett-agenda-card');
  const anchorFornitori = useTutorialAnchor('sett-fornitori-card');
  const anchorSpese = useTutorialAnchor('sett-spese-card');

  // Round 57: OCR state rimossi (rimossa funzionalità camera/scontrino).
  // I refs ai vecchi `ocrLoading` / `ocrResult` / `setOcrLoading` / `setOcrResult`
  // sono stati eliminati assieme ai relativi modal.

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
  const [expandedCollab, setExpandedCollab] = useState<number | null>(null);
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

  // Round 57 (richiesta utente): rimossa completamente la funzionalità foto
  // scontrino e tutte le chiamate camera/gallery. La media scontrino si
  // inserisce manualmente cliccando sulla riga "Media Scontrino" nell'agenda.
  // Nessun import di expo-image-picker, nessun OCR endpoint, nessun permesso
  // camera/galleria nel manifest.

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
        nomeTitolare: (state as any).nomeTitolare || '',
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
        storicoScontrini: (state as any).storicoScontrini || [],
        codiciInvito: (state as any).codiciInvito || [],
        // Impostazioni generali
        partenzaDa: state.partenzaDa || '',
        costoPerKm: (state as any).costoPerKm || 0,
        tipoCarburante: state.tipoCarburante || '',
        targetMensile: state.targetMensile || 0,
        themeColor: (state as any).themeColor || '',
        speseFisseDisabilitate: (state as any).speseFisseDisabilitate || [],
        speseAnnueDisabilitate: (state as any).speseAnnueDisabilitate || [],
      };

      const json = JSON.stringify(exportData, null, 2);
      const ownerTag = (state as any).nomeTitolare
        ? `-${String((state as any).nomeTitolare).trim().replace(/[^\w]+/g, '')}`
        : '';
      const dateStr = new Date().toISOString().split('T')[0];
      // ⬇️ ESTENSIONE .txt + mimeType text/plain → WhatsApp/Drive/Email accettano il file
      // come ALLEGATO senza tentare di interpretarlo come messaggio. Il contenuto
      // è comunque JSON valido, quindi handleImportData può leggerlo regolarmente.
      const fileName = `MarketMate-Backup${ownerTag}-${dateStr}.txt`;
      const sizeKB = Math.round(json.length / 1024);

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        playSuccess();
        window.alert(`Esportazione completata!\nFile: ${fileName} (${sizeKB} KB)\nScaricato automaticamente dal browser.`);
        return;
      }

      // ═══ MOBILE (iOS/Android) ═══
      // 1. Scrivo il file in cacheDirectory (più affidabile per la condivisione su Android)
      // 2. Uso ESCLUSIVAMENTE expo-sharing.shareAsync con mimeType text/plain
      //    → WhatsApp lo riceve come ALLEGATO (non come testo da copiare)
      // 3. NESSUN fallback con RNShare(message): quello convertiva il JSON in
      //    messaggio di testo costringendo l'utente al copia-incolla.
      const dirPath = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!dirPath) {
        Alert.alert('Errore Export', 'Spazio file non disponibile sul dispositivo.');
        return;
      }
      const filePath = `${dirPath}${fileName}`;
      try {
        await FileSystem.writeAsStringAsync(filePath, json, { encoding: 'utf8' as any });
      } catch (writeErr: any) {
        console.warn('FileSystem write failed:', writeErr);
        Alert.alert('Errore Export', `Impossibile salvare il file (${writeErr?.message || 'errore disco'}). Spazio libero?`);
        return;
      }

      // Verifica che il file esista realmente
      let fileExists = false;
      try {
        const info = await FileSystem.getInfoAsync(filePath);
        fileExists = !!info.exists;
      } catch {}
      if (!fileExists) {
        Alert.alert('Errore Export', `File non creato. Riprova.`);
        return;
      }

      // Condivisione tramite expo-sharing (l'unico metodo che condivide il file vero)
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Backup salvato',
          `Il file è stato salvato sul telefono ma la condivisione non è disponibile.\n\nFile: ${fileName}\n(${sizeKB} KB)\n\nPercorso: ${filePath}`,
        );
        return;
      }

      try {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: `Backup MarketMate (${sizeKB} KB)`,
          UTI: 'public.plain-text',
        });
        playSuccess();
      } catch (shareErr: any) {
        console.warn('Sharing failed:', shareErr);
        Alert.alert(
          'Condivisione annullata',
          `Il backup è stato salvato come ${fileName} (${sizeKB} KB) ma la condivisione è stata annullata. Puoi ritentare premendo di nuovo SALVA BACKUP.`,
        );
      }
    } catch (err: any) {
      console.warn('Export error:', err);
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
        // Web: usa input file HTML — accetta sia .txt che .json
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt,application/json,text/plain,text/*';
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
        // Mobile: usa DocumentPicker SENZA filtro restrittivo.
        // type:'*/*' accetta qualunque file (txt, json, ecc.) — fondamentale
        // perché alcuni file system / WhatsApp / Drive rinominano i file
        // o usano content URI senza estensione visibile.
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        const uri = result.assets[0].uri;
        try {
          jsonText = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' as any });
        } catch (readErr: any) {
          Alert.alert('Errore lettura file', `Impossibile leggere il file: ${readErr?.message || 'errore sconosciuto'}.`);
          return;
        }
      }

      // Pulizia preventiva: trim e rimuovi BOM (se presente)
      jsonText = jsonText.replace(/^\uFEFF/, '').trim();
      if (!jsonText) {
        Alert.alert('Errore Import', 'Il file selezionato è vuoto.');
        return;
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
      if (Array.isArray(data.appuntiAgenda)) updates.appuntiAgenda = data.appuntiAgenda;
      if (Array.isArray(data.ordiniAgenda)) updates.ordiniAgenda = data.ordiniAgenda;
      if (Array.isArray(data.storicoDiario)) updates.storicoDiario = data.storicoDiario;
      // Retrocompatibilità: chiavi vecchie
      if (Array.isArray(data.impegni) && !Array.isArray(data.appuntiAgenda)) updates.appuntiAgenda = data.impegni;
      if (Array.isArray(data.appuntiGiornalieri) && !Array.isArray(data.storicoDiario)) updates.storicoDiario = data.appuntiGiornalieri;
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
      Alert.alert('Errore Import', `${err?.message || 'File non valido'}.\n\nAssicurati di aver selezionato un file di backup di MarketMate (file .txt o .json esportato dall'app).`);
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
    <ScrollView
      ref={scrollRef}
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: topPad }]}
      onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
    >
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

      {/* ─── PROMEMORIA GIORNALIERI (notifiche locali) ─── */}
      <NotificationsCard />

      {/* ─── ACCOUNT CLOUD (login Google + delete account GDPR) — Round 67 ─── */}
      <AccountSection />

      {/* ─── SQUADRA COLLABORATORI ─── */}
      <Text style={s.secTitle} testID="sett-collab-card" ref={anchorCollab as any}>{t('settings.collaboratorsTitle') || 'COLLABORATORI'}</Text>
      {store.collaboratori.map((c, i) => {
        const codiceCollab = store.codiciInvito?.find(cod => cod.nome === c.nome);
        const isOpen = expandedCollab === i;
        const tt = codiceCollab?.tipo as any;
        const meta = codiceCollab
          ? (tt === 'AMMINISTRATORE' || tt === 'B')
            ? { c: '#B85450', l: 'AMMIN.' }
            : tt === 'MANAGER'
              ? { c: '#1E7F85', l: 'MANAGER' }
              : { c: '#E8A060', l: 'UTENTE' }
          : { c: '#D0D0D0', l: '—' };

        // Switcher ruolo inline: cambia ruolo con 1 tap (rimuove vecchio + crea nuovo)
        // + sync cloud: registra l'admin se non già fatto, push dei dati attuali, e crea
        // un codice cloud (8 char alfanumerico) sostituendo quello locale.
        // Questo garantisce che il codice inviato al collaboratore via WhatsApp sia
        // valido sul backend e che il collab possa scaricare i dati del team al join.
        const setRuoloRapido = async (nuovo: 'AMMINISTRATORE' | 'MANAGER' | 'UTENTE' | null) => {
          if (codiceCollab) {
            // Se c'era un codice precedente, prova a revocarlo anche sul cloud
            try {
              const ts = useTeamSyncStore.getState();
              if (ts.token) {
                const cloudCollabs = await ts.listCollaborators();
                const match = cloudCollabs.find((cc: any) => (cc.code || '').toUpperCase() === codiceCollab.codice.toUpperCase());
                if (match) await ts.revokeCollaborator(match.id);
                try { await ts.revokeInvite(codiceCollab.codice); } catch {}
              }
            } catch {}
            store.removeCodiceInvito(codiceCollab.codice);
          }
          if (!nuovo) return;
          // 1) Genera codice LOCALE (UX immediata, sostituito dopo)
          const codiceLocale = store.generateCodiceInvito(nuovo as any, c.nome);
          // 2) Sync cloud asincrono → sostituzione con codice cloud
          (async () => {
            try {
              const teamStore = useTeamSyncStore.getState();
              if (!teamStore.token) {
                let ok = await teamStore.adminLoginSilent();
                if (!ok) {
                  ok = await teamStore.adminRegister({
                    nomeAttivita: (store as any).nomeAttivita || 'MarketMate',
                    nomeTitolare: (store as any).nomeTitolare || '',
                  });
                }
                if (!ok) return;
              }
              const fullData = useAppStore.getState() as any;
              await teamStore.pushData({
                nomeAttivita: fullData.nomeAttivita,
                nomeTitolare: fullData.nomeTitolare,
                isAlimentare: fullData.isAlimentare,
                lingua: fullData.lingua,
                storicoGiornate: fullData.storicoGiornate || [],
                storicoCarburante: fullData.storicoCarburante || [],
                storicoScontrini: fullData.storicoScontrini || {},
                fiere: fullData.fiere || [],
                appuntiAgenda: fullData.appuntiAgenda || [],
                ordiniAgenda: fullData.ordiniAgenda || [],
                storicoDiario: fullData.storicoDiario || {},
                fornitori: fullData.fornitori || [],
                collaboratori: fullData.collaboratori || [],
                codiciInvito: fullData.codiciInvito || [],
                speseFisseAnnuali: fullData.speseFisseAnnuali || {},
                dailyBrief: fullData.dailyBrief || null,
              });
              const backendRole: 'full' | 'operativo' =
                (nuovo === 'AMMINISTRATORE' || nuovo === 'MANAGER') ? 'full' : 'operativo';
              const cloudCode = await teamStore.createInvite(backendRole);
              if (cloudCode) {
                const codiciInvito = (useAppStore.getState() as any).codiciInvito || [];
                const updated = codiciInvito.map((cc: any) =>
                  cc.codice === codiceLocale ? { ...cc, codice: cloudCode } : cc
                );
                useAppStore.setState({ codiciInvito: updated } as any);
                await (useAppStore.getState() as any).saveToStorage?.();
              }
            } catch {}
          })();
        };

        return (
          <View key={i} style={s.card}>
            {/* ═══ HEADER ESPANDIBILE — stesso pattern di Mercati ═══ */}
            <TouchableOpacity
              style={s.agendaHeader}
              activeOpacity={0.6}
              onPress={() => setExpandedCollab(isOpen ? null : i)}
            >
              <Ionicons name="person-circle" size={26} color="#1E7F85" />
              <Text style={[s.agendaMarket, { marginLeft: 8 }]} numberOfLines={1}>{c.nome}</Text>
              <View style={{ backgroundColor: meta.c, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.8 }}>{meta.l}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1E7F85" />
            </TouchableOpacity>

            {/* ═══ BODY — switcher ruolo + costo + codice + elimina ═══ */}
            {isOpen && (
              <View style={s.agendaBody}>
                <View style={s.divider} />

                {/* COSTO GIORNALIERO */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() =>
                    openModal(t('settings.collaborators'), [t('settings.name'), `${t('settings.dailyCost')} €`, `${t('common.annual')} €`], (vals) => {
                      const updated = [...store.collaboratori];
                      updated[i] = { nome: vals[0], costo: parseFloat(vals[1].replace(',', '.')) || 0, costoAnnuo: parseFloat(vals[2].replace(',', '.')) || 0 };
                      store.setConfig({ collaboratori: updated });
                    }, ['default', 'numeric', 'numeric'], c.nome, codiceCollab, [c.nome, String(c.costo || ''), String(c.costoAnnuo || '')])
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}
                >
                  <Ionicons name="cash-outline" size={16} color="#7A9090" />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#5A7575' }}>Costo giornaliero</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#1A4040' }}>€{c.costo || 0}</Text>
                  <Ionicons name="create-outline" size={16} color="#7A9090" />
                </TouchableOpacity>

                {/* COSTO ANNUALE */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() =>
                    openModal(t('settings.collaborators'), [t('settings.name'), `${t('settings.dailyCost')} €`, `${t('common.annual')} €`], (vals) => {
                      const updated = [...store.collaboratori];
                      updated[i] = { nome: vals[0], costo: parseFloat(vals[1].replace(',', '.')) || 0, costoAnnuo: parseFloat(vals[2].replace(',', '.')) || 0 };
                      store.setConfig({ collaboratori: updated });
                    }, ['default', 'numeric', 'numeric'], c.nome, codiceCollab, [c.nome, String(c.costo || ''), String(c.costoAnnuo || '')])
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderTopWidth: 1, borderTopColor: '#EDE8D9' }}
                >
                  <Ionicons name="calendar-outline" size={16} color="#7A9090" />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#5A7575' }}>Costo annuale</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#1A4040' }}>€{c.costoAnnuo || 0}</Text>
                  <Ionicons name="create-outline" size={16} color="#7A9090" />
                </TouchableOpacity>

                {/* SWITCHER RUOLO — 4 chips */}
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#7A9090', letterSpacing: 0.8, marginTop: 10, marginBottom: 6 }}>
                  RUOLO
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {([
                    { key: 'AMMINISTRATORE', label: 'AMMIN.' },
                    { key: 'MANAGER', label: 'MANAGER' },
                    { key: 'UTENTE', label: 'UTENTE' },
                    { key: null, label: 'NESSUNO' },
                  ] as const).map((opt) => {
                    const cur = codiceCollab?.tipo === 'B' ? 'AMMINISTRATORE' : codiceCollab?.tipo;
                    const on = opt.key === null ? !codiceCollab : cur === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        activeOpacity={0.5}
                        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        onPress={() => setRuoloRapido(opt.key as any)}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          paddingHorizontal: 4,
                          borderRadius: 999,
                          backgroundColor: on ? '#1E7F85' : '#F5EFDC',
                          borderWidth: 1.5,
                          borderColor: on ? '#1E7F85' : '#E0D8C0',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{ fontSize: 9.5, fontWeight: '900', color: on ? '#FFF' : '#5A7575', letterSpacing: 0.2 }}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ═══ CODICE INVITO + BOTTONE INVIA ═══ */}
                {codiceCollab && (
                  <View style={{ marginTop: 12 }}>
                    {/* Riquadro codice */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F4FAF7', borderRadius: 10, borderWidth: 1, borderColor: '#D6E8E2' }}>
                      <Ionicons name="key" size={16} color="#1E7F85" />
                      <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '900', color: '#1A4040', letterSpacing: 1.2 }} numberOfLines={1}>
                        {codiceCollab.codice}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={async () => {
                          // Copia il codice negli appunti su tutte le piattaforme
                          // (web → navigator.clipboard, mobile → expo-clipboard)
                          try {
                            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
                              await (navigator as any).clipboard.writeText(codiceCollab.codice);
                            } else {
                              await Clipboard.setStringAsync(codiceCollab.codice);
                            }
                            try { hapticTap(); } catch {}
                            if (Platform.OS === 'web') {
                              try { (window as any).alert?.('✅ Codice copiato!'); } catch {}
                            } else {
                              Alert.alert('✅ Copiato', `Codice "${codiceCollab.codice}" copiato negli appunti.\n\nIncollalo dove vuoi (WhatsApp, Note, ecc.).`);
                            }
                          } catch {}
                        }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="copy-outline" size={18} color="#1E7F85" />
                      </TouchableOpacity>
                    </View>

                    {/* BOTTONE INVIA CODICE — apre il selettore di app (WhatsApp / SMS / Email / Telegram)
                        L'utente sceglie tra:
                          A. Messaggio completo (testo + codice + istruzioni)
                          B. Solo codice (per incollare velocemente in chat) */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={async () => {
                        const ruoloLabel = (codiceCollab.tipo === 'AMMINISTRATORE') ? 'Amministratore'
                          : (codiceCollab.tipo === 'MANAGER') ? 'Manager' : 'Utente';
                        const titolare = (store as any).nomeTitolare || 'Il titolare';
                        const azienda = (store as any).nomeAttivita || 'MarketMate';
                        const messaggioCompleto =
                          `Ciao ${c.nome}! 👋\n\n` +
                          `${titolare} di "${azienda}" ti ha invitato a collaborare su MarketMate come ${ruoloLabel}.\n\n` +
                          `🔑 Codice invito: ${codiceCollab.codice}\n\n` +
                          `Per attivare il tuo ruolo:\n` +
                          `1. Scarica MarketMate\n` +
                          `2. Apri l'app e tocca "Ho un codice invito"\n` +
                          `3. Inserisci il codice qui sopra`;
                        const soloCodice = codiceCollab.codice;

                        // Helper per condividere
                        const doShare = async (msg: string) => {
                          try {
                            await RNShare.share({ message: msg, title: `Codice MarketMate per ${c.nome}` });
                          } catch (e) {
                            try {
                              if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
                                await (navigator as any).clipboard.writeText(msg);
                                try { (window as any).alert?.('Copiato negli appunti!'); } catch {}
                              }
                            } catch {}
                          }
                        };

                        // Mostra dialogo nativo "completo / solo codice"
                        if (Platform.OS === 'web') {
                          const choice = (window as any).confirm?.(
                            'OK = Invia messaggio completo (testo + istruzioni)\n' +
                            'Annulla = Invia SOLO il codice (rapido)'
                          );
                          await doShare(choice ? messaggioCompleto : soloCodice);
                        } else {
                          Alert.alert(
                            `Invia codice a ${c.nome}`,
                            'Cosa vuoi inviare?',
                            [
                              { text: 'Solo il codice', onPress: () => doShare(soloCodice) },
                              { text: 'Messaggio completo', onPress: () => doShare(messaggioCompleto) },
                              { text: 'Annulla', style: 'cancel' },
                            ],
                            { cancelable: true }
                          );
                        }
                      }}
                      style={{
                        marginTop: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 13,
                        backgroundColor: '#1E7F85',
                        borderRadius: 12,
                        shadowColor: '#1E7F85',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                    >
                      <Ionicons name="paper-plane" size={16} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
                        INVIA CODICE A {c.nome.trim().toUpperCase()}
                      </Text>
                    </TouchableOpacity>

                    <Text style={{ marginTop: 6, fontSize: 10, color: '#7A9090', textAlign: 'center', fontStyle: 'italic' }}>
                      Scegli "Solo il codice" per incollarlo velocemente, o "Messaggio completo" per le istruzioni
                    </Text>
                  </View>
                )}

                {/* ELIMINA COLLABORATORE — funziona sia su web che mobile, e revoca anche sul cloud */}
                <TouchableOpacity
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    const doDelete = async () => {
                      // 1) Revoca sul cloud (se questo codice/collab è registrato sul backend)
                      try {
                        const teamStore = useTeamSyncStore.getState();
                        if (teamStore.token && codiceCollab?.codice) {
                          // Trova il collaboratore cloud che ha usato questo codice
                          const cloudCollabs = await teamStore.listCollaborators();
                          const match = cloudCollabs.find((cc: any) => (cc.code || '').toUpperCase() === codiceCollab.codice.toUpperCase());
                          if (match) await teamStore.revokeCollaborator(match.id);
                          // Revoca anche il codice se non ancora usato
                          try { await teamStore.revokeInvite(codiceCollab.codice); } catch {}
                        }
                      } catch {}
                      // 2) Cancella in locale
                      if (codiceCollab) store.removeCodiceInvito(codiceCollab.codice);
                      store.removeCollaboratore(c.nome);
                      setExpandedCollab(null);
                    };
                    if (Platform.OS === 'web') {
                      // window.confirm funziona su tutti i browser
                      if ((window as any).confirm?.(`Eliminare ${c.nome}?\n\nVerrà rimosso anche il suo accesso al team cloud.`)) {
                        doDelete();
                      }
                    } else {
                      Alert.alert(
                        'Elimina collaboratore',
                        `Vuoi eliminare ${c.nome}?\n\nVerrà rimosso anche il suo accesso al team cloud.`,
                        [
                          { text: 'Annulla', style: 'cancel' },
                          { text: 'Elimina', style: 'destructive', onPress: doDelete },
                        ]
                      );
                    }
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 11, borderRadius: 10, backgroundColor: '#FCE8E8', borderWidth: 1, borderColor: '#F2C0C0' }}
                >
                  <Ionicons name="trash-outline" size={15} color="#D46A6A" />
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#D46A6A', letterSpacing: 0.5 }}>
                    ELIMINA COLLABORATORE
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
      <Text style={s.secTitle} testID="sett-agenda-card" ref={anchorAgenda as any}>{t('settings.marketsTitle') || 'MERCATI'}</Text>
      {store.agenda.map((m, idx) => {
        const isOpen = expandedDay === idx;
        return (
          <View key={idx} style={s.card}>
            <TouchableOpacity style={s.agendaHeader} activeOpacity={0.6} onPress={() => handleExpandDay(idx)}>
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
                {/* Round 56 (richiesta utente): rimossa funzionalità foto scontrino + camera.
                    L'utente inserisce la media scontrino solo manualmente cliccando la riga sopra. */}
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

      <Text style={s.secTitle} testID="sett-fornitori-card" ref={anchorFornitori as any}>
        {t('settings.supplierSettingsTitle') || 'CONFIGURA RICARICHI E PREZZI'}
      </Text>

      {/* Sub-header "FORNITORI" prima della lista (richiesta utente Round 36) */}
      <View style={s.fornHeaderRow}>
        <Ionicons name="cube" size={16} color="#1E7F85" />
        <Text style={s.fornHeaderTxt}>{t('settings.suppliersTitle') || 'FORNITORI'}</Text>
        <View style={s.fornHeaderLine} />
      </View>

      {/*  ─────────────────────────────────────────────────────────────
          FORNITORI con editor inline (richiesta utente: niente seconda
          schermata, tutto in un unico punto). Ogni card del fornitore
          mostra: nome + ricarico% + lista prodotti con costo/prezzo/%
          bidirezionali. Il componente è in /app/frontend/src/components/
          FornitoreEditor.tsx e gestisce internamente la logica di
          aggiornamento bidirezionale dei tre campi.
          ───────────────────────────────────────────────────────────── */}
      {store.fornitori.map((f, fi) => {
        const isOpen = expandedForn === fi;
        return (
          <FornitoreEditor
            key={`${f.nome}-${fi}`}
            fornitore={f}
            isExpanded={isOpen}
            onToggleExpand={() => setExpandedForn(isOpen ? null : fi)}
            onUpdate={(patch) => {
              // Round 42: usa getState() invece di store.fornitori catturato
              // al render → evita stale closure quando l'utente digita
              // rapidamente nei campi prodotto (nome, costo, prezzo, %).
              const latest = (useAppStore.getState() as any).fornitori || [];
              const updF = [...latest];
              updF[fi] = { ...updF[fi], ...patch };
              store.setConfig({ fornitori: updF });
            }}
            onDelete={() => {
              if (Platform.OS === 'web') {
                if (window.confirm(`Eliminare il fornitore "${f.nome}" e tutti i suoi prodotti?`)) {
                  store.removeFornitore(f.nome);
                }
              } else {
                Alert.alert(
                  t('supplier.confirmDeleteTitle') || 'Elimina fornitore',
                  (t('supplier.confirmDeleteDesc', { nome: f.nome }) as string) || `Eliminare "${f.nome}" e tutti i suoi prodotti?`,
                  [
                    { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                    { text: t('common.delete') || 'Elimina', style: 'destructive', onPress: () => store.removeFornitore(f.nome) },
                  ]
                );
              }
            }}
            onRename={() =>
              openModal(
                t('settings.editName') || 'Modifica nome',
                [t('settings.name') || 'Nome'],
                (vals) => {
                  if (vals[0] && vals[0].trim()) {
                    const updF = [...store.fornitori];
                    updF[fi] = { ...updF[fi], nome: vals[0].trim() };
                    store.setConfig({ fornitori: updF });
                  }
                },
                ['default'],
                undefined,
                undefined,
                [f.nome]
              )
            }
          />
        );
      })}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          openModal(t('settings.addSupplier'), [t('settings.name')], (vals) =>
            store.addFornitore({ nome: vals[0], prodotti: [], ricaricoMedio: 70 }))
        }
      >
        <Ionicons name="cube-outline" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>{t('settings.addSupplier')}</Text>
      </TouchableOpacity>

      {/* ─── SPESE ANNUALI (collapsible) ─── */}
      <View style={s.card} testID="sett-spese-card" ref={anchorSpese as any}>
        <TouchableOpacity style={s.agendaHeader} activeOpacity={0.6} onPress={() => setExpandedSpese(!expandedSpese)}>
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

      {/* ─── INFORMAZIONI E PRIVACY ───
          Round 63: sezione spostata dopo il footer "MarketMate" (richiesta utente). */}

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
                spesePeriodiche: [], // Round 62: pulisci anche le spese ripartite
              } as any);
              // Pulisci anche la sessione spese in corso (fatture/ripartizioni
              // residue di sessioni precedenti che potevano restare in memoria)
              try { (store as any).clearSpeseExtraSession?.(); } catch {}
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

        {/* Round 63: rimosso bottone "PULISCI SPESE RIPARTITE" su richiesta utente.
            La pulizia avviene automaticamente con il dedup in loadFromStorage. */}

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

      {/* ─── ACCOUNT CLOUD rimosso: il sync è ora gestito automaticamente
            tramite il sistema team (codice invito + auto-register admin) e
            non serve più una sezione manuale di login/register ─── */}

      {/* ─── EXPORT DATI ─── */}
      <View style={[s.card, { marginTop: 20 }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="download-outline" size={20} color="#1E7F85" />
          <Text style={s.sectionTitle}>{t('settings.backupTitle') || 'BACKUP DATI'}</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 12, lineHeight: 16 }}>
          {t('settings.backupDesc') || 'Salva tutti i tuoi dati in un file. Puoi conservarlo sul telefono (Drive, WhatsApp, Email) e ripristinarlo quando vuoi: basta toccare IMPORTA e scegliere il file, senza copia-incolla.'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
          onPress={handleExportData}
        >
          <Ionicons name="save-outline" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>{t('settings.exportBtn') || '💾 SALVA BACKUP'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#D4AF37', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onPress={handleImportData}
        >
          <Ionicons name="folder-open-outline" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>{t('settings.importBtn') || '📂 APRI BACKUP'}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── RIAVVIA TUTORIAL ─── */}
      <View style={[s.card, { marginTop: 20 }]}>
        <View style={s.sectionHeader}>
          <MaterialCommunityIcons name="school" size={20} color="#1E7F85" />
          <Text style={s.sectionTitle}>{(t('tutorial.common.restart') || 'Riavvia la guida').toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#7A9090', marginBottom: 12 }}>
          {t('tutorial.common.restartDesc') || 'Rilancia la guida interattiva passo-passo per rivedere tutte le funzioni dell\'app.'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onPress={() => tutStart()}
          activeOpacity={0.8}
          testID="restart-tutorial-btn"
        >
          <MaterialCommunityIcons name="rocket-launch" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
            {(t('tutorial.common.restart') || 'Riavvia la guida').toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── INFO APP ─── */}
      <View style={{ marginTop: 24, alignItems: 'center', paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1A4040', letterSpacing: 2 }}>MarketMate</Text>
        <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>{t('settings.version') || 'Versione 3.9'}</Text>
        <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>© 2026 T.V.S di Francesco Cavallaro</Text>
        <Text style={{ fontSize: 10, color: '#B0B0A0', marginTop: 6 }}>{t('settings.allRights') || 'Tutti i diritti riservati'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Ionicons name="shield-checkmark" size={14} color="#1E7F85" />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E7F85' }}>{t('settings.dataProtected') || 'Dati protetti e crittografati sul dispositivo'}</Text>
        </View>
      </View>

      {/* ─── Round 63: INFORMAZIONI E PRIVACY (spostata in fondo, dopo MarketMate, su richiesta utente) ─── */}
      <View style={[s.card, { marginTop: 16 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
          onPress={async () => {
            const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://marketmate-hub-1.emergent.host'}/api/privacy-policy`;
            try {
              const Linking = await import('expo-linking');
              await Linking.openURL(url);
            } catch {
              try { (window as any).open?.(url, '_blank'); } catch {}
            }
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color="#1E7F85" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A3A3A' }}>
              {t('settings.privacyPolicy') || 'Privacy Policy'}
            </Text>
            <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>
              {t('settings.privacyPolicyDesc') || 'Come trattiamo i tuoi dati personali'}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#7A9090" />
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: '#E2D9C4', marginVertical: 6 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <Ionicons name="information-circle-outline" size={22} color="#1E7F85" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A3A3A' }}>
              {t('settings.appVersion') || 'Versione App'}
            </Text>
            <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>
              MarketMate v3.9.0 · {t('settings.appBy') || 'Sviluppata da T.V.S di Cavallaro Francesco'}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: '#E2D9C4', marginVertical: 6 }} />

        <TouchableOpacity
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
          onPress={async () => {
            const email = 'tvscavallaro@gmail.com';
            const subject = encodeURIComponent('MarketMate — Supporto');
            const url = `mailto:${email}?subject=${subject}`;
            try {
              const Linking = await import('expo-linking');
              await Linking.openURL(url);
            } catch {
              try { (window as any).open?.(url, '_blank'); } catch {}
            }
          }}
        >
          <Ionicons name="mail-outline" size={22} color="#1E7F85" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A3A3A' }}>
              {t('settings.contactSupport') || 'Contatta il supporto'}
            </Text>
            <Text style={{ fontSize: 11, color: '#7A9090', marginTop: 2 }}>tvscavallaro@gmail.com</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#7A9090" />
        </TouchableOpacity>
      </View>

      {/* ─── Il pulsante "Esci dall'App" è stato rimosso: è già presente in Home ─── */}

      <View style={{ height: 40 }} />

      {/* Round 57: rimossi OCR Loading Overlay e OCR Result Modal
          (la funzionalità camera/scontrino è stata eliminata) */}

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
        onGenerateCodice={async (tipo, nome) => {
          // ═══════════════════════════════════════════════════════════════
          // FLUSSO IBRIDO: genera SUBITO il codice locale (UX immediata),
          // poi in parallelo (asincrono):
          //  1. Auto-registra l'admin sul cloud se non già fatto
          //  2. Sincronizza i dati attuali al cloud
          //  3. Crea un codice 'cloud' (8 char alfanum) sul backend
          //  4. Sostituisce il codice locale con quello cloud nel modal
          //     (così quando l'admin lo invia, il collab lo trova davvero
          //     sul backend e può scaricare i dati del team)
          //
          // Se il backend non risponde (offline), il codice locale resta
          // attivo e l'app continua a funzionare in modalità degradata
          // (il collab vedrà un errore "codice non valido" finché non
          // c'è connessione).
          // ═══════════════════════════════════════════════════════════════
          const codiceLocale = store.generateCodiceInvito(tipo, nome);
          setModalConfig((p) => ({
            ...p,
            collabCodice: { codice: codiceLocale, tipo, nome, attivo: true, dataCreazione: new Date().toISOString() },
          }));

          (async () => {
            try {
              console.log('[CLOUD-CODE] start, BACKEND_URL =', process.env.EXPO_PUBLIC_BACKEND_URL);
              const teamStore = useTeamSyncStore.getState();
              console.log('[CLOUD-CODE] teamStore.token =', teamStore.token ? 'YES' : 'NO');
              // Step 1: assicura che l'admin sia registrato in cloud
              if (!teamStore.token) {
                console.log('[CLOUD-CODE] trying adminLoginSilent...');
                let ok = await teamStore.adminLoginSilent();
                console.log('[CLOUD-CODE] adminLoginSilent =', ok);
                if (!ok) {
                  console.log('[CLOUD-CODE] trying adminRegister...');
                  ok = await teamStore.adminRegister({
                    nomeAttivita: (store as any).nomeAttivita || 'MarketMate',
                    nomeTitolare: (store as any).nomeTitolare || '',
                  });
                  console.log('[CLOUD-CODE] adminRegister =', ok);
                }
                if (!ok) { console.warn('[CLOUD-CODE] backend not reachable, aborting'); return; }
              }
              // Step 2: push dei dati correnti (così il collab li trova al join)
              const fullData = useAppStore.getState() as any;
              const pushOk = await teamStore.pushData({
                nomeAttivita: fullData.nomeAttivita,
                nomeTitolare: fullData.nomeTitolare,
                isAlimentare: fullData.isAlimentare,
                lingua: fullData.lingua,
                storicoGiornate: fullData.storicoGiornate || [],
                storicoCarburante: fullData.storicoCarburante || [],
                storicoScontrini: fullData.storicoScontrini || {},
                fiere: fullData.fiere || [],
                appuntiAgenda: fullData.appuntiAgenda || [],
                ordiniAgenda: fullData.ordiniAgenda || [],
                storicoDiario: fullData.storicoDiario || {},
                fornitori: fullData.fornitori || [],
                collaboratori: fullData.collaboratori || [],
                codiciInvito: fullData.codiciInvito || [],
                speseFisseAnnuali: fullData.speseFisseAnnuali || {},
                dailyBrief: fullData.dailyBrief || null,
              });
              console.log('[CLOUD-CODE] pushData =', pushOk);
              // Step 3: crea codice cloud (mapping: AMMINISTRATORE→full, MANAGER→full, UTENTE→operativo)
              const backendRole: 'full' | 'operativo' =
                (tipo === 'AMMINISTRATORE' || tipo === 'MANAGER') ? 'full' : 'operativo';
              const cloudCode = await teamStore.createInvite(backendRole);
              console.log('[CLOUD-CODE] cloudCode =', cloudCode);
              if (cloudCode) {
                // Sostituisci il codice locale con quello cloud nel modal e nello store
                setModalConfig((p) => ({
                  ...p,
                  collabCodice: { codice: cloudCode, tipo, nome, attivo: true, dataCreazione: new Date().toISOString() },
                }));
                // Aggiorna anche nello store (sostituisci codice locale con cloud)
                try {
                  const codiciInvito = (useAppStore.getState() as any).codiciInvito || [];
                  const updated = codiciInvito.map((c: any) =>
                    c.codice === codiceLocale ? { ...c, codice: cloudCode } : c
                  );
                  useAppStore.setState({ codiciInvito: updated } as any);
                  await (useAppStore.getState() as any).saveToStorage?.();
                  console.log('[CLOUD-CODE] store updated, codice locale sostituito con', cloudCode);
                } catch (e) { console.error('[CLOUD-CODE] store update err', e); }
              }
            } catch (e) { console.error('[CLOUD-CODE] outer error', e); }
          })();
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
  /* Round 57: rimossi stili cameraBtn/cameraBtnTxt/ocrResultCard/ocrResultRow/
     ocrResultLabel/ocrResultValue — non più utilizzati */
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
  // ─── CTA SupplierSettings (apre la schermata dedicata ricarico/prezzi) ───
  supplierSettingsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFAEC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1E7F85',
  },
  supplierSettingsIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D6E8E5',
  },
  supplierSettingsTitle: { fontSize: 12, fontWeight: '900', color: '#1A4040', letterSpacing: 0.8 },
  supplierSettingsHint: { fontSize: 10, color: '#7A9090', marginTop: 2 },
  // Sub-header "FORNITORI" prima della lista (Round 36)
  fornHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  fornHeaderTxt: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E7F85',
    letterSpacing: 1.2,
  },
  fornHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E7F8540',
    marginLeft: 4,
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

// ═══ Wrapper con permission gating ═══
// Solo gli AMMINISTRATORI vedono Impostazioni: MANAGER e UTENTE incappano nel
// placeholder lock screen (con bottone "Torna alla Home").
export default function SettingsPage() {
  return (
    <RoleGuard
      allow={(p) => p.canSeeSettings}
      message={'Le impostazioni dell\u2019app sono riservate all\u2019amministratore. Se ti serve accedere chiedi al titolare.'}
    >
      <SettingsPageInner />
    </RoleGuard>
  );
}

