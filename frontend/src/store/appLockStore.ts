/**
 * AppLockStore — gestisce il lock dell'app tramite PIN.
 *
 * Comportamento (Round 50, richiesta utente):
 *  - Lo STATO LOCK è PERSISTITO in storage (key LOCK_STATE_KEY).
 *  - Default (mai impostato) → `isLocked=false` (NO PIN al ritorno).
 *  - L'app chiede il PIN SOLO se l'utente ha esplicitamente premuto il
 *    pulsante POWER in Home → si setta `isLocked=true` + persist.
 *  - Cambi pagina interni, AppState background→foreground, app killate
 *    dal sistema operativo: NESSUN PIN richiesto se l'utente non ha
 *    cliccato il power.
 *
 * Il PIN è salvato in expo-secure-store (Keychain iOS / Keystore Android),
 * equivalente hardware di flutter_secure_storage.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_KEY = 'marketmate_pin_v1';
// Round 50: persistenza dello stato lock per evitare PIN forzato ad ogni
// kill dell'app da parte del sistema operativo.
const LOCK_STATE_KEY = 'marketmate_lock_state_v1';

interface AppLockState {
  isLocked: boolean;       // true = serve PIN prima di entrare in home
  hasPin: boolean;         // true se un PIN è stato salvato
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  unlock: () => void;       // chiamato dopo PIN corretto
  lock: () => void;         // chiamato quando utente clicca POWER
}

// Fallback per web (no SecureStore): usa localStorage
const storage = {
  get: async (k: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') return window.localStorage.getItem(k);
        return null;
      }
      return await SecureStore.getItemAsync(k);
    } catch { return null; }
  },
  set: async (k: string, v: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
        return;
      }
      await SecureStore.setItemAsync(k, v);
    } catch {}
  },
  del: async (k: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.removeItem(k);
        return;
      }
      await SecureStore.deleteItemAsync(k);
    } catch {}
  },
};

export const useAppLockStore = create<AppLockState>((set, get) => ({
  // Round 50: parte SBLOCCATO. L'hydrate leggerà eventuale flag persistito.
  isLocked: false,
  hasPin: false,
  isHydrated: false,

  hydrate: async () => {
    const pin = await storage.get(PIN_KEY);
    // Round 50: leggi stato lock persistito. Se mai impostato → false (sbloccato).
    const lockFlag = await storage.get(LOCK_STATE_KEY);
    const isLocked = lockFlag === '1';
    set({
      hasPin: !!(pin && pin.length >= 4),
      isLocked,
      isHydrated: true,
    });
  },

  setPin: async (pin: string) => {
    if (!pin || pin.length < 4) return;
    await storage.set(PIN_KEY, pin);
    set({ hasPin: true });
  },

  clearPin: async () => {
    await storage.del(PIN_KEY);
    set({ hasPin: false });
  },

  verifyPin: async (pin: string) => {
    const saved = await storage.get(PIN_KEY);
    return !!saved && saved === pin;
  },

  unlock: () => {
    // Round 50: rimuovi anche il flag persistito così al prossimo cold start
    // l'app si apre direttamente senza PIN.
    storage.del(LOCK_STATE_KEY).catch(() => {});
    set({ isLocked: false });
  },

  lock: () => {
    // Round 50: persisti il flag lock così che al riavvio dell'app venga
    // richiesto il PIN. Chiamato SOLO dal pulsante power esplicito.
    storage.set(LOCK_STATE_KEY, '1').catch(() => {});
    set({ isLocked: true });
  },
}));
