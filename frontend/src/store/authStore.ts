/**
 * Auth Store — gestisce login/register/token JWT per MarketMate.
 * Usa SecureStore (nativo) o AsyncStorage (web) per persistere il token.
 * 
 * Stato locale vs cloud:
 * - Se !isAuthenticated → l'app funziona in modalità LOCALE (come prima)
 * - Se isAuthenticated → modalità CLOUD con sync automatica al backend
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_BASE = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'marketmate_auth_token';
const USER_KEY = 'marketmate_auth_user';

export type UserRole = 'owner' | 'full' | 'operativo';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  account_owner_id: string;
  nome_attivita?: string;
  nome_titolare?: string;
  created_at?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  lastSyncAt: number | null;
  syncError: string | null;

  // Actions
  hydrate: () => Promise<void>;
  register: (email: string, password: string, nomeAttivita?: string, nomeTitolare?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  redeemInvite: (code: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  // Sync
  pull: () => Promise<any | null>;
  push: (data: any) => Promise<void>;
  // Collaborators
  listCollaborators: () => Promise<any[]>;
  listInvites: () => Promise<any[]>;
  createInvite: (role: 'full' | 'operativo') => Promise<{ code: string; role: string }>;
  revokeInvite: (code: string) => Promise<void>;
  removeCollaborator: (userId: string) => Promise<void>;
}

async function secureSet(key: string, value: string) {
  try {
    if (Platform.OS !== 'web') {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {}
  await AsyncStorage.setItem(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const SecureStore = await import('expo-secure-store');
      return await SecureStore.getItemAsync(key);
    }
  } catch {}
  return await AsyncStorage.getItem(key);
}

async function secureDel(key: string) {
  try {
    if (Platform.OS !== 'web') {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch {}
  await AsyncStorage.removeItem(key);
}

async function apiCall(path: string, opts: RequestInit = {}, token: string | null = null): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const detail = data?.detail || data?.message || `Errore ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  lastSyncAt: null,
  syncError: null,

  hydrate: async () => {
    try {
      const token = await secureGet(TOKEN_KEY);
      const userJson = await secureGet(USER_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ token, user, isAuthenticated: true });
        // Refresh in background (may fail if token expired)
        get().refreshMe().catch(() => {});
      }
    } catch (e) {
      console.warn('auth hydrate error', e);
    } finally {
      set({ isHydrated: true });
    }
  },

  register: async (email, password, nomeAttivita = '', nomeTitolare = '') => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nome_attivita: nomeAttivita, nome_titolare: nomeTitolare }),
    });
    await secureSet(TOKEN_KEY, res.access_token);
    await secureSet(USER_KEY, JSON.stringify(res.user));
    set({ token: res.access_token, user: res.user, isAuthenticated: true });
  },

  login: async (email, password) => {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await secureSet(TOKEN_KEY, res.access_token);
    await secureSet(USER_KEY, JSON.stringify(res.user));
    set({ token: res.access_token, user: res.user, isAuthenticated: true });
  },

  redeemInvite: async (code, email, password) => {
    const res = await apiCall('/auth/redeem_invite', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim().toUpperCase(), email, password }),
    });
    await secureSet(TOKEN_KEY, res.access_token);
    await secureSet(USER_KEY, JSON.stringify(res.user));
    set({ token: res.access_token, user: res.user, isAuthenticated: true });
  },

  logout: async () => {
    await secureDel(TOKEN_KEY);
    await secureDel(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, lastSyncAt: null });
  },

  refreshMe: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const user = await apiCall('/auth/me', {}, token);
      await secureSet(USER_KEY, JSON.stringify(user));
      set({ user });
    } catch (e: any) {
      // Token probabilmente scaduto
      if (String(e?.message || '').includes('scaduto') || String(e?.message || '').includes('401')) {
        await get().logout();
      }
    }
  },

  pull: async () => {
    const { token } = get();
    if (!token) return null;
    try {
      const res = await apiCall('/sync/pull', {}, token);
      set({ lastSyncAt: Date.now(), syncError: null });
      return res.data;
    } catch (e: any) {
      set({ syncError: String(e?.message || e) });
      return null;
    }
  },

  push: async (data) => {
    const { token } = get();
    if (!token) return;
    try {
      await apiCall('/sync/push', { method: 'POST', body: JSON.stringify({ data }) }, token);
      set({ lastSyncAt: Date.now(), syncError: null });
    } catch (e: any) {
      set({ syncError: String(e?.message || e) });
    }
  },

  listCollaborators: async () => {
    const { token } = get();
    if (!token) return [];
    return await apiCall('/auth/collaborators', {}, token);
  },

  listInvites: async () => {
    const { token } = get();
    if (!token) return [];
    return await apiCall('/auth/invites/list', {}, token);
  },

  createInvite: async (role) => {
    const { token } = get();
    if (!token) throw new Error('Non autenticato');
    return await apiCall('/auth/invites/create', { method: 'POST', body: JSON.stringify({ role }) }, token);
  },

  revokeInvite: async (code) => {
    const { token } = get();
    if (!token) return;
    await apiCall(`/auth/invites/${code}`, { method: 'DELETE' }, token);
  },

  removeCollaborator: async (userId) => {
    const { token } = get();
    if (!token) return;
    await apiCall(`/auth/collaborators/${userId}`, { method: 'DELETE' }, token);
  },
}));
