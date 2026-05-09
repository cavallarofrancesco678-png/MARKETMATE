/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Notifications Store — promemoria giornalieri (LOCAL only, no push API)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Architettura:
 *  - Usa expo-notifications per pianificare notifiche LOCALI ricorrenti
 *    (DAILY trigger). NON serve account Firebase / APNs / Expo Push token
 *    perché l'utente programma le sue stesse notifiche sul telefono.
 *  - Sono completamente offline: il calendario delle notifiche è gestito
 *    dal sistema operativo. Anche se l'app è chiusa, il sistema scatena
 *    la notifica all'orario impostato.
 *
 * Stato persistito in AsyncStorage:
 *  - enabled: bool         → master switch (default false, opt-in)
 *  - hour: int (0-23)      → ora del promemoria (default 19)
 *  - minute: int (0-59)    → minuto del promemoria (default 0)
 *  - title: string         → titolo notifica (default localizzato)
 *  - body: string          → corpo notifica (default localizzato)
 *  - lastScheduledId: str  → id notifica corrente (per cancellarla prima
 *                            di ripianificare)
 *
 * Web fallback: tutto restituisce noop, le notifiche non sono supportate
 * sul web preview ma il toggle in UI rimane visibile.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = 'mm_notif_settings_v1';

// ═══ Default ═══
const DEFAULTS = {
  enabled: false,
  hour: 19,
  minute: 0,
  title: 'MarketMate',
  body: "Hai registrato l'incasso di oggi?",
};

interface NotifSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  title: string;
  body: string;
  lastScheduledId?: string | null;
}

interface NotifStore extends NotifSettings {
  isHydrated: boolean;
  permission: 'granted' | 'denied' | 'undetermined' | 'unsupported';

  hydrate: () => Promise<void>;
  setEnabled: (b: boolean) => Promise<{ ok: boolean; error?: string }>;
  setTime: (h: number, m: number) => Promise<void>;
  setMessage: (title: string, body: string) => Promise<void>;
  refreshPermission: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  reschedule: () => Promise<string | null>;
  cancelScheduled: () => Promise<void>;
}

// ═══ Helpers ═══
const isWeb = Platform.OS === 'web';

async function persist(state: Partial<NotifSettings>) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    const next = { ...cur, ...state };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

async function readPersist(): Promise<NotifSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ═══ Configura il behavior delle notifiche quando l'app è in foreground.
//     Senza questo, le notifiche schedulate non appaiono se l'utente è
//     dentro l'app — invece vogliamo che vibri/suoni anche in foreground. ═══
if (!isWeb) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });
  } catch {}
}

// ═══ Setup channel Android (richiesto su Android 8+) ═══
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('marketmate-reminders', {
      name: 'Promemoria MarketMate',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E7F85',
      sound: 'default',
    });
  } catch {}
}

export const useNotificationsStore = create<NotifStore>((set, get) => ({
  ...DEFAULTS,
  isHydrated: false,
  permission: 'undetermined',

  hydrate: async () => {
    const saved = await readPersist();
    const merged = { ...DEFAULTS, ...(saved || {}) };
    set({ ...merged, isHydrated: true });
    if (isWeb) {
      set({ permission: 'unsupported' });
      return;
    }
    try {
      await ensureAndroidChannel();
      const p = await Notifications.getPermissionsAsync();
      set({ permission: p.granted ? 'granted' : (p.canAskAgain ? 'undetermined' : 'denied') });
      // Se l'utente aveva il toggle ON ma il sistema ha revocato la permission
      // (cancellato dalle impostazioni del sistema), spegniamo il toggle locale.
      if (merged.enabled && !p.granted) {
        await persist({ enabled: false });
        set({ enabled: false });
      }
      // Se è abilitato e abbiamo la permission, riprogrammiamo (idempotente)
      if (merged.enabled && p.granted) {
        await get().reschedule();
      }
    } catch {
      set({ permission: 'undetermined' });
    }
  },

  refreshPermission: async () => {
    if (isWeb) { set({ permission: 'unsupported' }); return; }
    try {
      const p = await Notifications.getPermissionsAsync();
      set({ permission: p.granted ? 'granted' : (p.canAskAgain ? 'undetermined' : 'denied') });
    } catch {}
  },

  requestPermission: async () => {
    if (isWeb) return false;
    try {
      await ensureAndroidChannel();
      const p = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: true,
          allowBadge: false,
        },
      });
      const granted = !!p.granted;
      set({ permission: granted ? 'granted' : 'denied' });
      return granted;
    } catch {
      set({ permission: 'denied' });
      return false;
    }
  },

  setEnabled: async (b) => {
    if (isWeb) {
      // Su web non supportato — accettiamo il toggle solo a UI ma è no-op
      await persist({ enabled: b });
      set({ enabled: b });
      return { ok: false, error: 'web-unsupported' };
    }
    if (b) {
      // Richiedi permesso se necessario
      const p = await Notifications.getPermissionsAsync();
      let granted = p.granted;
      if (!granted) {
        granted = await get().requestPermission();
      }
      if (!granted) {
        return { ok: false, error: 'permission-denied' };
      }
      await persist({ enabled: true });
      set({ enabled: true });
      const id = await get().reschedule();
      return { ok: !!id };
    } else {
      await get().cancelScheduled();
      await persist({ enabled: false });
      set({ enabled: false });
      return { ok: true };
    }
  },

  setTime: async (h, m) => {
    const hour = Math.max(0, Math.min(23, Math.floor(h)));
    const minute = Math.max(0, Math.min(59, Math.floor(m)));
    await persist({ hour, minute });
    set({ hour, minute });
    // Riprogramma se attivo
    if (get().enabled && !isWeb) {
      await get().reschedule();
    }
  },

  setMessage: async (title, body) => {
    const t = (title || '').trim() || DEFAULTS.title;
    const b = (body || '').trim() || DEFAULTS.body;
    await persist({ title: t, body: b });
    set({ title: t, body: b });
    if (get().enabled && !isWeb) {
      await get().reschedule();
    }
  },

  cancelScheduled: async () => {
    if (isWeb) return;
    const cur = get().lastScheduledId;
    try {
      if (cur) {
        await Notifications.cancelScheduledNotificationAsync(cur);
      } else {
        // Fallback: cancella tutte (sicurezza in caso di id orfani)
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch {}
    await persist({ lastScheduledId: null });
    set({ lastScheduledId: null });
  },

  reschedule: async () => {
    if (isWeb) return null;
    const { hour, minute, title, body } = get();
    // Cancel before re-scheduling per evitare duplicati
    await get().cancelScheduled();
    try {
      await ensureAndroidChannel();
      // ─── Trigger DAILY: usato il formato CALENDAR repeats:true che è
      //     compatibile sia con expo-notifications 0.32 che con eventuali
      //     fallback su iOS/Android (su Android 13+ richiede POST_NOTIFICATIONS
      //     già richiesto in app.json + /requestPermissionsAsync). ───
      const trigger: any = Platform.OS === 'android'
        ? {
            // Android richiede il channelId nel trigger (non basta passarlo
            // alla `setNotificationChannelAsync`). Senza questo la notifica
            // verrebbe schedulata ma scartata silenziosamente sul canale di
            // default che ha priority=DEFAULT (no banner sopra).
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: 'marketmate-reminders',
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          };
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: title || DEFAULTS.title,
          body: body || DEFAULTS.body,
          sound: 'default',
          // Su Android, il channelId è settato anche nel content per
          // compatibilità con SDK pre-trigger.channelId.
          ...(Platform.OS === 'android' ? { channelId: 'marketmate-reminders' } : {}),
        } as any,
        trigger,
      });
      await persist({ lastScheduledId: id });
      set({ lastScheduledId: id });
      return id;
    } catch (e) {
      console.warn('[notif-reschedule] error', e);
      return null;
    }
  },
}));

// ═══ Helper: format HH:mm dato hour/minute ═══
export function formatHHmm(h: number, m: number): string {
  const hh = String(Math.max(0, Math.min(23, h))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, m))).padStart(2, '0');
  return `${hh}:${mm}`;
}
