/**
 * AppLockStore — gestisce il lock dell'app tramite PIN.
 *
 * Comportamento:
 *  - `isLocked=true` al cold start (primo avvio / ricarica app)
 *  - `isLocked=true` quando AppState passa da 'active' → 'background'/'inactive'
 *  - `isLocked=false` SOLO dopo un PIN corretto (unlock())
 *
 * Il PIN è salvato in expo-secure-store (Keychain iOS / Keystore Android),
 * equivalente hardware di flutter_secure_storage.
 *
 * La navigazione interna (cambio pagina dentro /home/*) NON triggera il lock.
 * Solo il passaggio dell'app in background lo richiede.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_KEY = 'marketmate_pin_v1';

interface AppLockState {
  isLocked: boolean;       // true = serve PIN prima di entrare in home
  hasPin: boolean;         // true se un PIN è stato salvato
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  unlock: () => void;       // chiamato dopo PIN corretto
  lock: () => void;         // chiamato quando app va in background
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
  isLocked: true,     // parte bloccato al cold start
  hasPin: false,
  isHydrated: false,

  hydrate: async () => {
    const pin = await storage.get(PIN_KEY);
    set({ hasPin: !!(pin && pin.length >= 4), isHydrated: true });
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

  unlock: () => set({ isLocked: false }),
  lock: () => set({ isLocked: true }),
}));
