/**
 * NotificationsCard — Sezione "PROMEMORIA" nelle Impostazioni.
 *
 * Permette all'utente di:
 *  - Attivare/Disattivare i promemoria giornalieri (Switch)
 *  - Scegliere l'orario (modale TimePicker custom)
 *  - Inviare una notifica di test (verifica che il sistema operativo
 *    accetti effettivamente la consegna)
 *
 * Web preview: il componente viene visualizzato ma le notifiche reali
 * non vengono pianificate (Platform.OS === 'web' = noop).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useNotificationsStore, formatHHmm } from '../store/notificationsStore';

export const NotificationsCard: React.FC = () => {
  const { t } = useTranslation();
  const enabled = useNotificationsStore((s) => s.enabled);
  const hour = useNotificationsStore((s) => s.hour);
  const minute = useNotificationsStore((s) => s.minute);
  const permission = useNotificationsStore((s) => s.permission);
  const setEnabled = useNotificationsStore((s) => s.setEnabled);
  const setTime = useNotificationsStore((s) => s.setTime);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempH, setTempH] = useState(hour);
  const [tempM, setTempM] = useState(minute);

  const isWeb = Platform.OS === 'web';

  // ───────────────────────────────────────────────────
  // Toggle ON/OFF
  // ───────────────────────────────────────────────────
  const handleToggle = async (v: boolean) => {
    if (isWeb) {
      Alert.alert(
        t('settings.notifWebTitle') || 'Web non supportato',
        t('settings.notifWebDesc') || "Le notifiche giornaliere funzionano solo nell'app installata sul telefono (Android/iOS)."
      );
      return;
    }
    const res = await setEnabled(v);
    if (!res.ok) {
      if (res.error === 'permission-denied') {
        Alert.alert(
          t('settings.notifPermDeniedTitle') || 'Permesso negato',
          t('settings.notifPermDeniedDesc') || "Per ricevere i promemoria devi abilitare le notifiche nelle Impostazioni del sistema.",
          [
            { text: t('common.cancel') || 'Annulla', style: 'cancel' },
            {
              text: t('settings.openSystemSettings') || 'Apri Impostazioni',
              onPress: () => { try { Linking.openSettings(); } catch {} },
            },
          ]
        );
      }
    }
  };

  // ───────────────────────────────────────────────────
  // Salva orario dal time picker
  // ───────────────────────────────────────────────────
  const saveTime = async () => {
    await setTime(tempH, tempM);
    setShowTimePicker(false);
  };

  // ───────────────────────────────────────────────────
  // Notifica di test (immediata, ~5s nel futuro)
  // ───────────────────────────────────────────────────
  const sendTest = async () => {
    if (isWeb) {
      Alert.alert(
        t('settings.notifWebTitle') || 'Web non supportato',
        t('settings.notifWebDesc') || "Le notifiche giornaliere funzionano solo nell'app installata sul telefono."
      );
      return;
    }
    if (permission !== 'granted') {
      Alert.alert(
        t('settings.notifPermDeniedTitle') || 'Permesso negato',
        t('settings.notifEnableFirst') || "Attiva prima i promemoria per dare il permesso al sistema.",
      );
      return;
    }
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('settings.notifTestTitle') || 'MarketMate · Test',
          body: t('settings.notifTestBody') || 'Notifica di prova ricevuta correttamente!',
          sound: 'default',
        },
        trigger: { seconds: 3 } as any,
      });
      Alert.alert(
        t('settings.notifTestSentTitle') || 'Notifica inviata',
        t('settings.notifTestSentDesc') || 'Riceverai una notifica tra 3 secondi. Lascia pure aperta la app: la vedrai comparire in alto.',
      );
    } catch (e) {
      Alert.alert('Errore', String((e as any)?.message || e));
    }
  };

  // Stato testuale per l'utente
  let statusTxt = '';
  if (isWeb) {
    statusTxt = t('settings.notifStatusWeb') || 'Web — non supportato (solo app mobile)';
  } else if (permission === 'denied') {
    statusTxt = t('settings.notifStatusDenied') || 'Permesso negato — apri le Impostazioni di sistema';
  } else if (enabled) {
    const fmt = formatHHmm(hour, minute);
    statusTxt = (t('settings.notifStatusOn', { time: fmt }) as string) || `Attivo · ${fmt} ogni giorno`;
  } else {
    statusTxt = t('settings.notifStatusOff') || 'Disattivato';
  }

  return (
    <>
      <Text style={s.secTitle}>{t('settings.notifTitle') || 'PROMEMORIA'}</Text>
      <View style={s.card}>
        {/* Master toggle */}
        <View style={s.switchRow}>
          <View style={s.iconBox}>
            <Ionicons name="notifications" size={20} color="#1E7F85" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemLabel}>{t('settings.notifDailyReminder') || 'Promemoria giornaliero'}</Text>
            <Text style={s.itemHint}>
              {t('settings.notifDailyDesc') || "Ricevi una notifica per ricordarti di registrare l'incasso del giorno."}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
            thumbColor="#FFF"
          />
        </View>

        {/* Time picker row */}
        <View style={s.divider} />
        <TouchableOpacity
          style={[s.itemRow, !enabled && { opacity: 0.4 }]}
          onPress={() => {
            if (!enabled) return;
            setTempH(hour);
            setTempM(minute);
            setShowTimePicker(true);
          }}
          disabled={!enabled}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>{t('settings.notifTime') || 'Orario notifica'}</Text>
            <Text style={s.itemVal}>{formatHHmm(hour, minute)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7A9090" />
        </TouchableOpacity>

        {/* Status row */}
        <View style={s.divider} />
        <View style={s.itemRow}>
          <Ionicons
            name={
              enabled && permission === 'granted' ? 'checkmark-circle' :
              permission === 'denied' ? 'alert-circle' :
              'pause-circle'
            }
            size={20}
            color={
              enabled && permission === 'granted' ? '#5DAD78' :
              permission === 'denied' ? '#D46A6A' :
              '#7A9090'
            }
          />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>{t('settings.notifStatus') || 'Stato'}</Text>
            <Text style={s.itemVal}>{statusTxt}</Text>
          </View>
        </View>

        {/* Test notification button */}
        <View style={s.divider} />
        <TouchableOpacity
          style={[s.testBtn, (!enabled || permission !== 'granted') && { opacity: 0.4 }]}
          onPress={sendTest}
          disabled={!enabled || permission !== 'granted'}
          activeOpacity={0.85}
        >
          <Ionicons name="paper-plane-outline" size={16} color="#FFF" />
          <Text style={s.testBtnTxt}>{t('settings.notifSendTest') || 'INVIA UNA NOTIFICA DI PROVA'}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Time picker modal ─── */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('settings.notifPickTime') || 'Scegli orario'}</Text>
            <Text style={s.modalSub}>{t('settings.notifPickTimeHint') || 'A che ora vuoi essere avvisato ogni giorno?'}</Text>

            <View style={s.timeRow}>
              {/* Hours */}
              <View style={s.colWrap}>
                <Text style={s.colLabel}>{t('settings.hour') || 'ORA'}</Text>
                <TouchableOpacity onPress={() => setTempH((h) => (h + 1) % 24)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-up" size={28} color="#1E7F85" />
                </TouchableOpacity>
                <Text style={s.timeNum}>{String(tempH).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setTempH((h) => (h - 1 + 24) % 24)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-down" size={28} color="#1E7F85" />
                </TouchableOpacity>
              </View>
              <Text style={s.colon}>:</Text>
              {/* Minutes */}
              <View style={s.colWrap}>
                <Text style={s.colLabel}>{t('settings.minute') || 'MIN'}</Text>
                <TouchableOpacity onPress={() => setTempM((m) => (m + 5) % 60)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-up" size={28} color="#1E7F85" />
                </TouchableOpacity>
                <Text style={s.timeNum}>{String(tempM).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setTempM((m) => (m - 5 + 60) % 60)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-down" size={28} color="#1E7F85" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick presets */}
            <Text style={[s.colLabel, { marginTop: 8, marginBottom: 6, alignSelf: 'flex-start' }]}>
              {t('settings.notifQuickPresets') || 'PRESET RAPIDI'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.presetsRow}>
                {[
                  { h: 8, m: 0, label: '08:00' },
                  { h: 13, m: 0, label: '13:00' },
                  { h: 19, m: 0, label: '19:00' },
                  { h: 20, m: 30, label: '20:30' },
                  { h: 22, m: 0, label: '22:00' },
                ].map((p) => {
                  const active = tempH === p.h && tempM === p.m;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      style={[s.presetBtn, active && s.presetBtnActive]}
                      onPress={() => { setTempH(p.h); setTempM(p.m); }}
                    >
                      <Text style={[s.presetTxt, active && s.presetTxtActive]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setShowTimePicker(false)}>
                <Text style={s.modalBtnGhostTxt}>{t('common.cancel') || 'Annulla'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={saveTime}>
                <Text style={s.modalBtnPrimaryTxt}>{t('common.save') || 'Salva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  secTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7A9090',
    letterSpacing: 1.4,
    marginTop: 26,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#F5EFDC',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  iconBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  itemInfo: { flex: 1, paddingHorizontal: 8 },
  itemLabel: { fontSize: 11, fontWeight: '800', color: '#7A9090', letterSpacing: 0.8 },
  itemHint: { fontSize: 10, color: '#9A9890', marginTop: 1 },
  itemVal: { fontSize: 14, fontWeight: '900', color: '#1A4040', marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  switchLabel: { fontSize: 13, fontWeight: '900', color: '#1A4040' },
  divider: { height: 1, backgroundColor: '#E5DECF', marginVertical: 4 },

  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1E7F85',
    paddingVertical: 12, borderRadius: 12,
    marginTop: 6, marginBottom: 6,
  },
  testBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#FFF8EC', borderRadius: 22, padding: 22 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#1A4040', textAlign: 'center', letterSpacing: 1 },
  modalSub: { fontSize: 12, color: '#7A9090', textAlign: 'center', marginTop: 6, marginBottom: 18 },

  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginVertical: 8 },
  colWrap: { alignItems: 'center', gap: 4 },
  colLabel: { fontSize: 10, fontWeight: '800', color: '#7A9090', letterSpacing: 1.2 },
  timeNum: { fontSize: 38, fontWeight: '900', color: '#1A4040', minWidth: 72, textAlign: 'center', letterSpacing: 2 },
  colon: { fontSize: 38, fontWeight: '900', color: '#1A4040', marginTop: 22 },

  presetsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginBottom: 14 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#E8E0CC', borderWidth: 1, borderColor: 'transparent' },
  presetBtnActive: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  presetTxt: { fontSize: 12, fontWeight: '800', color: '#7A9090' },
  presetTxtActive: { color: '#FFF' },

  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7A9090' },
  modalBtnGhostTxt: { color: '#7A9090', fontWeight: '900', letterSpacing: 1 },
  modalBtnPrimary: { backgroundColor: '#1E7F85' },
  modalBtnPrimaryTxt: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
});
