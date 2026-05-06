/**
 * RoleGuard — Renderizza un placeholder "MIA SCHEDA" se l'utente corrente
 * non ha il permesso richiesto.
 *
 * Per i collaboratori (MANAGER / UTENTE) le impostazioni dell'app non sono
 * accessibili: l'app è già configurata dall'amministratore. Mostriamo invece
 * una scheda personale con:
 *  - Il loro ruolo
 *  - Pulsante "Imposta/Cambia PIN" (per sicurezza locale)
 *  - Pulsante "Esci dal team" (logout cloud + reset locale)
 *
 * Uso:
 *   <RoleGuard allow={(p) => p.canSeeSettings}>...</RoleGuard>
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions, roleLabel, type Permissions } from '../utils/permissions';
import { useAppStore } from '../store/appStore';
import { useAppLockStore } from '../store/appLockStore';
import { useTeamSyncStore } from '../store/teamSyncStore';

interface Props {
  allow: (p: Permissions) => boolean;
  children: React.ReactNode;
  message?: string;
  title?: string;
}

export const RoleGuard: React.FC<Props> = ({ allow, children, message, title }) => {
  const perms = usePermissions();
  if (allow(perms)) {
    return <>{children}</>;
  }
  return <MiaSchedaCollaboratore />;
};

const MiaSchedaCollaboratore: React.FC = () => {
  const perms = usePermissions();
  const nomeAttivita = useAppStore((s) => s.nomeAttivita);
  const setStorePin = useAppLockStore((st) => st.setPin);
  const teamLogout = useTeamSyncStore((st) => st.logout);
  const resetAll = useAppStore((st) => (st as any).resetAll);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') (window as any).alert?.(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const confirmAlert = (title: string, msg: string, onYes: () => void, yesLabel = 'Conferma') => {
    if (Platform.OS === 'web') {
      if ((window as any).confirm?.(`${title}\n\n${msg}`)) onYes();
    } else {
      Alert.alert(title, msg, [
        { text: 'Annulla', style: 'cancel' },
        { text: yesLabel, style: 'destructive', onPress: onYes },
      ]);
    }
  };

  const handleSavePin = async () => {
    if (newPin.length !== 6) { setPinError('PIN deve essere di 6 cifre'); return; }
    if (newPin !== newPinConfirm) { setPinError('I due PIN non coincidono'); return; }
    try {
      await setStorePin(newPin);
      setPinModalOpen(false);
      setNewPin(''); setNewPinConfirm(''); setPinError('');
      showAlert('PIN aggiornato', 'Il tuo PIN è stato salvato in sicurezza.');
    } catch (e: any) {
      setPinError(String(e?.message || e));
    }
  };

  const handleLogout = () => {
    confirmAlert(
      'Esci dal team',
      'Tutti i tuoi dati locali verranno cancellati e tornerai alla schermata iniziale. Sei sicuro?',
      async () => {
        try { await teamLogout(); } catch {}
        try { await resetAll?.(); } catch {}
        try { await (useAppStore.getState() as any).saveToStorage?.(); } catch {}
        try { router.replace('/'); } catch {}
      },
      'Esci'
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <View style={st.container}>
        <View style={st.iconWrap}>
          <Ionicons name="person-circle" size={68} color="#1E7F85" />
        </View>
        <Text style={st.title}>LA MIA SCHEDA</Text>
        <Text style={st.subtitle}>
          {nomeAttivita ? `Sei nel team di "${nomeAttivita}"` : 'Sei un collaboratore del team'}
        </Text>

        <View style={st.roleBadge}>
          <Ionicons name="ribbon-outline" size={16} color="#5A8A85" />
          <Text style={st.roleText}>Ruolo: {roleLabel(perms.role)}</Text>
        </View>

        <View style={{ width: '100%', height: 1, backgroundColor: '#E2D9C4', marginVertical: 18 }} />

        {/* AZIONE: imposta/cambia PIN */}
        <TouchableOpacity
          style={st.actionBtn}
          onPress={() => setPinModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed-outline" size={20} color="#1A3A3A" />
          <View style={{ flex: 1 }}>
            <Text style={st.actionTitle}>Imposta o cambia PIN</Text>
            <Text style={st.actionDesc}>Protegge l'accesso al tuo dispositivo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7A9090" />
        </TouchableOpacity>

        {/* AZIONE: torna home */}
        <TouchableOpacity
          style={st.actionBtn}
          onPress={() => router.replace('/home')}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={20} color="#1A3A3A" />
          <View style={{ flex: 1 }}>
            <Text style={st.actionTitle}>Torna alla Home</Text>
            <Text style={st.actionDesc}>Continua a lavorare nel team</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7A9090" />
        </TouchableOpacity>

        {/* AZIONE: logout */}
        <TouchableOpacity
          style={[st.actionBtn, { borderColor: '#D46A6A' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#D46A6A" />
          <View style={{ flex: 1 }}>
            <Text style={[st.actionTitle, { color: '#D46A6A' }]}>Esci dal team</Text>
            <Text style={st.actionDesc}>Cancella i dati locali e torna alla welcome</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* MODAL: Imposta/Cambia PIN */}
      <Modal visible={pinModalOpen} transparent animationType="fade" onRequestClose={() => setPinModalOpen(false)}>
        <View style={st.modalBg}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Imposta nuovo PIN</Text>
            <Text style={st.modalSub}>Scegli un PIN di 6 cifre per proteggere l'accesso al tuo dispositivo.</Text>
            <TextInput
              value={newPin}
              onChangeText={(v) => { setNewPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
              placeholder="••••••"
              style={st.pinInput}
              placeholderTextColor="#A0B0B0"
            />
            <TextInput
              value={newPinConfirm}
              onChangeText={(v) => { setNewPinConfirm(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Conferma PIN"
              style={st.pinInput}
              placeholderTextColor="#A0B0B0"
            />
            {pinError ? <Text style={st.pinError}>{pinError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[st.modalBtn, { backgroundColor: '#E2D9C4' }]}
                onPress={() => { setPinModalOpen(false); setNewPin(''); setNewPinConfirm(''); setPinError(''); }}
              >
                <Text style={[st.modalBtnTxt, { color: '#1A3A3A' }]}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalBtn, { backgroundColor: '#1E7F85', flex: 1.4 }]}
                onPress={handleSavePin}
              >
                <Text style={st.modalBtnTxt}>Salva PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E6' },
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 24, paddingTop: 24 },
  iconWrap: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8EDE5', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A3A3A', textAlign: 'center', letterSpacing: 1.5 },
  subtitle: { fontSize: 14, color: '#5A7575', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  roleBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  roleText: { fontSize: 13, color: '#5A8A85', fontWeight: '700' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 12, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2D9C4' },
  actionTitle: { fontSize: 14, fontWeight: '800', color: '#1A3A3A' },
  actionDesc: { fontSize: 11, color: '#7A9090', marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1A3A3A', marginBottom: 6 },
  modalSub: { fontSize: 12, color: '#7A9090', marginBottom: 14, lineHeight: 18 },
  pinInput: { borderWidth: 1, borderColor: '#E2D9C4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, letterSpacing: 6, textAlign: 'center', marginBottom: 10, color: '#1A3A3A' },
  pinError: { color: '#D46A6A', fontSize: 12, fontWeight: '700', marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnTxt: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
