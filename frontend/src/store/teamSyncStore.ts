/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Team Sync Store — Zustand store che gestisce l'auth cloud + sync dati
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Architettura:
 *  - Admin: al primo avvio auto-registra un account "device_<uuid>" sul
 *    backend con una password random (conservata in SecureStore).
 *    Da quel momento, ogni `saveToStorage()` dell'appStore triggera anche
 *    un sync push al cloud (debounced 5s).
 *
 *  - Collaboratore: entra tramite codice invito + password personale
 *    (join_by_code). Il token JWT e le credenziali (code, password) sono
 *    salvati in SecureStore per rilogin silenzioso al riavvio.
 *    All'avvio dell'app chiama /team/status per verificare di non essere
 *    stato revocato, e /sync/pull per scaricare i dati correnti.
 *
 *  - Quando un admin revoca un collaboratore, alla successiva chiamata di
 *    status o login_by_code il backend risponde 403 → l'app cancella tutto
 *    lo stato locale e riporta alla welcome.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ═══ ENV / URL ═══
const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const API = `${BACKEND_URL}/api`;

// ═══ Storage abstraction (SecureStore su mobile, AsyncStorage su web) ═══
// SecureStore non esiste su web, quindi fallback ad AsyncStorage (meno sicuro
// ma OK per sviluppo/preview). In produzione il flusso mobile usa SecureStore.
const SEC = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return await AsyncStorage.getItem(key);
      const v = await SecureStore.getItemAsync(key);
      return v;
    } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async deleteItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

// ═══ Chiavi SecureStore ═══
const K_TOKEN = 'mm_team_token';
const K_KIND = 'mm_team_kind';   // 'admin' | 'collab'
const K_DEVICE_ID = 'mm_device_id';
const K_ADMIN_PWD = 'mm_admin_pwd';
const K_COLLAB_CODE = 'mm_collab_code';
const K_COLLAB_PWD = 'mm_collab_pwd';
const K_ROLE = 'mm_role';        // owner | full | operativo

// ═══ Utility ═══
function randomDeviceId(): string {
  return 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function randomPassword(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// ═══ Tipi ═══
type TeamKind = 'admin' | 'collab' | null;
type RoleBackend = 'owner' | 'full' | 'operativo';

interface TeamSyncState {
  kind: TeamKind;         // tipo di account cloud su questo dispositivo
  token: string | null;   // JWT
  role: RoleBackend | null;
  accountOwnerId: string | null;
  userId: string | null;
  syncInProgress: boolean;
  lastPushAt: number;
  lastPullAt: number;
  revoked: boolean;       // true se il collab è stato revocato dall'admin
  errorMsg: string;

  // ═══ API ═══
  loadFromSecureStore: () => Promise<void>;

  // Admin
  adminRegister: (args: { nomeAttivita?: string; nomeTitolare?: string }) => Promise<boolean>;
  adminLoginSilent: () => Promise<boolean>;

  // Collaboratore
  collabJoin: (code: string, password: string) => Promise<{ ok: boolean; error?: string; data?: any; role?: RoleBackend }>;
  collabLoginSilent: () => Promise<{ ok: boolean; data?: any; revoked?: boolean }>;

  // Sync dati
  pushData: (data: any) => Promise<boolean>;
  pullData: () => Promise<any | null>;

  // Gestione collaboratori (admin)
  listCollaborators: () => Promise<Array<{ id: string; code: string; role: string; joined_at: string }>>;
  listInvites: () => Promise<Array<{ code: string; role: string; used_by?: string | null }>>;
  createInvite: (role: 'full' | 'operativo') => Promise<string | null>;
  revokeCollaborator: (userId: string) => Promise<boolean>;
  revokeInvite: (code: string) => Promise<boolean>;

  // Logout / reset
  logout: () => Promise<void>;
}

let _syncTimer: any = null;
let _pollTimer: any = null;

export const useTeamSyncStore = create<TeamSyncState>((set, get) => ({
  kind: null,
  token: null,
  role: null,
  accountOwnerId: null,
  userId: null,
  syncInProgress: false,
  lastPushAt: 0,
  lastPullAt: 0,
  revoked: false,
  errorMsg: '',

  loadFromSecureStore: async () => {
    try {
      const [token, kind, role] = await Promise.all([
        SEC.getItem(K_TOKEN),
        SEC.getItem(K_KIND),
        SEC.getItem(K_ROLE),
      ]);
      if (token) {
        set({ token, kind: (kind as TeamKind) || null, role: (role as RoleBackend) || null });
      }
    } catch {}
  },

  // ─── ADMIN ─────────────────────────────────────────────────────────
  adminRegister: async ({ nomeAttivita = '', nomeTitolare = '' }) => {
    if (!BACKEND_URL) return false;
    try {
      let deviceId = await SEC.getItem(K_DEVICE_ID);
      let password = await SEC.getItem(K_ADMIN_PWD);
      if (!deviceId) {
        deviceId = randomDeviceId();
        await SEC.setItem(K_DEVICE_ID, deviceId);
      }
      if (!password) {
        password = randomPassword();
        await SEC.setItem(K_ADMIN_PWD, password);
      }
      const r = await fetch(`${API}/team/admin_register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, password, nome_attivita: nomeAttivita, nome_titolare: nomeTitolare }),
      });
      if (r.status === 409) {
        // already registered on this device → silent login
        return await get().adminLoginSilent();
      }
      if (!r.ok) {
        set({ errorMsg: `HTTP ${r.status}` });
        return false;
      }
      const j = await r.json();
      await SEC.setItem(K_TOKEN, j.access_token);
      await SEC.setItem(K_KIND, 'admin');
      await SEC.setItem(K_ROLE, 'owner');
      set({
        token: j.access_token, kind: 'admin', role: 'owner',
        accountOwnerId: j.user.account_owner_id, userId: j.user.id, errorMsg: '',
      });
      return true;
    } catch (e: any) {
      set({ errorMsg: String(e?.message || e) });
      return false;
    }
  },

  adminLoginSilent: async () => {
    if (!BACKEND_URL) return false;
    try {
      const deviceId = await SEC.getItem(K_DEVICE_ID);
      const password = await SEC.getItem(K_ADMIN_PWD);
      if (!deviceId || !password) return false;
      const r = await fetch(`${API}/team/admin_login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, password }),
      });
      if (!r.ok) { set({ errorMsg: `Login fallito HTTP ${r.status}` }); return false; }
      const j = await r.json();
      await SEC.setItem(K_TOKEN, j.access_token);
      await SEC.setItem(K_KIND, 'admin');
      await SEC.setItem(K_ROLE, 'owner');
      set({
        token: j.access_token, kind: 'admin', role: 'owner',
        accountOwnerId: j.user.account_owner_id, userId: j.user.id, errorMsg: '',
      });
      return true;
    } catch (e: any) {
      set({ errorMsg: String(e?.message || e) });
      return false;
    }
  },

  // ─── COLLABORATORE ────────────────────────────────────────────────
  collabJoin: async (code, password) => {
    if (!BACKEND_URL) return { ok: false, error: 'Backend non configurato' };
    try {
      const r = await fetch(`${API}/team/join_by_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return { ok: false, error: j.detail || `HTTP ${r.status}` };
      }
      const j = await r.json();
      await SEC.setItem(K_TOKEN, j.access_token);
      await SEC.setItem(K_KIND, 'collab');
      await SEC.setItem(K_ROLE, j.user.role);
      await SEC.setItem(K_COLLAB_CODE, code.trim().toUpperCase());
      await SEC.setItem(K_COLLAB_PWD, password);
      set({
        token: j.access_token, kind: 'collab', role: j.user.role,
        accountOwnerId: j.user.account_owner_id, userId: j.user.id, errorMsg: '',
      });
      // Subito fai pull dei dati del team
      const data = await get().pullData();
      return { ok: true, data, role: j.user.role };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },

  collabLoginSilent: async () => {
    if (!BACKEND_URL) return { ok: false };
    try {
      const code = await SEC.getItem(K_COLLAB_CODE);
      const password = await SEC.getItem(K_COLLAB_PWD);
      if (!code || !password) return { ok: false };
      const r = await fetch(`${API}/team/login_by_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      if (r.status === 403) {
        // REVOCATO
        set({ revoked: true });
        return { ok: false, revoked: true };
      }
      if (!r.ok) return { ok: false };
      const j = await r.json();
      await SEC.setItem(K_TOKEN, j.access_token);
      await SEC.setItem(K_KIND, 'collab');
      await SEC.setItem(K_ROLE, j.user.role);
      set({
        token: j.access_token, kind: 'collab', role: j.user.role,
        accountOwnerId: j.user.account_owner_id, userId: j.user.id, errorMsg: '',
      });
      const data = await get().pullData();
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false };
    }
  },

  // ─── SYNC DATI ─────────────────────────────────────────────────────
  pushData: async (data) => {
    const { token } = get();
    if (!token || !BACKEND_URL) return false;
    try {
      set({ syncInProgress: true });
      const r = await fetch(`${API}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });
      set({ syncInProgress: false, lastPushAt: Date.now() });
      if (r.status === 401 || r.status === 403) {
        // token scaduto o utente revocato
        set({ revoked: r.status === 403 });
        return false;
      }
      return r.ok;
    } catch {
      set({ syncInProgress: false });
      return false;
    }
  },

  pullData: async () => {
    const { token } = get();
    if (!token || !BACKEND_URL) return null;
    try {
      set({ syncInProgress: true });
      const r = await fetch(`${API}/sync/pull`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ syncInProgress: false, lastPullAt: Date.now() });
      if (r.status === 403) { set({ revoked: true }); return null; }
      if (!r.ok) return null;
      const j = await r.json();
      return j.data || null;
    } catch {
      set({ syncInProgress: false });
      return null;
    }
  },

  // ─── GESTIONE COLLABORATORI (admin) ──────────────────────────────
  listCollaborators: async () => {
    const { token } = get();
    if (!token || !BACKEND_URL) return [];
    try {
      const r = await fetch(`${API}/team/collaborators_detailed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },

  listInvites: async () => {
    const { token } = get();
    if (!token || !BACKEND_URL) return [];
    try {
      const r = await fetch(`${API}/auth/invites/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },

  createInvite: async (role) => {
    const { token } = get();
    if (!token || !BACKEND_URL) return null;
    try {
      const r = await fetch(`${API}/auth/invites/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j.code as string;
    } catch { return null; }
  },

  revokeCollaborator: async (userId) => {
    const { token } = get();
    if (!token || !BACKEND_URL) return false;
    try {
      const r = await fetch(`${API}/auth/collaborators/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.ok;
    } catch { return false; }
  },

  revokeInvite: async (code) => {
    const { token } = get();
    if (!token || !BACKEND_URL) return false;
    try {
      const r = await fetch(`${API}/auth/invites/${code}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.ok;
    } catch { return false; }
  },

  logout: async () => {
    await Promise.all([
      SEC.deleteItem(K_TOKEN),
      SEC.deleteItem(K_KIND),
      SEC.deleteItem(K_COLLAB_CODE),
      SEC.deleteItem(K_COLLAB_PWD),
      SEC.deleteItem(K_ROLE),
    ]);
    set({ token: null, kind: null, role: null, accountOwnerId: null, userId: null, revoked: false });
  },
}));

// ═══════════════════════════════════════════════════════════════════════
//  debouncedPush — da chiamare dopo ogni modifica dati nell'appStore.
//  Marca SUBITO _localChangeAt per attivare la finestra anti-rollback nel
//  pull, così pull pendenti non sovrascrivono modifiche locali appena fatte.
// ═══════════════════════════════════════════════════════════════════════
export function scheduleTeamSyncPush(getData: () => any) {
  _localChangeAt = Date.now();
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    const st = useTeamSyncStore.getState();
    if (!st.token) return;
    try {
      const data = getData();
      if (data) await st.pushData(data);
    } catch {}
  }, 5000);  // 5 sec debounce
}

// ═══════════════════════════════════════════════════════════════════════
//  Mapping ruolo backend → ruolo UI frontend
// ═══════════════════════════════════════════════════════════════════════
export function roleBackendToUi(role: RoleBackend | null): 'AMMINISTRATORE' | 'MANAGER' | 'UTENTE' {
  if (role === 'owner' || role === 'full') return role === 'owner' ? 'AMMINISTRATORE' : 'MANAGER';
  return 'UTENTE';
}

// ═══════════════════════════════════════════════════════════════════════
//  startBackgroundPull — pull periodico ogni 30 sec mentre l'app è attiva
//  (sync inverso: ricevere i dati inseriti dall'altro lato).
//  applyMerge: callback che riceve i dati cloud e fa il merge nello store locale.
//  ANTI-ROLLBACK: se ci sono modifiche locali recenti (push appena programmato
//  o appena fatto entro PUSH_DEBOUNCE_MS+5000), il pull viene saltato per non
//  rischiare di sovrascrivere modifiche non ancora arrivate al cloud.
// ═══════════════════════════════════════════════════════════════════════
let _localChangeAt = 0;
export function markLocalChange() { _localChangeAt = Date.now(); }
// Allungato da 12s a 60s perché il debounce push è 5s e dopo serve tempo per
// che il backend lo abbia processato prima del prossimo pull, altrimenti il
// pull restituisce dati obsoleti (es. senza l'ultimo collaboratore aggiunto)
// e il merge potrebbe sovrascrivere il locale fresco.
const ANTI_ROLLBACK_WINDOW_MS = 60000;

export function startTeamBackgroundPull(applyMerge: (cloudData: any) => void, intervalMs = 30000) {
  stopTeamBackgroundPull();
  _pollTimer = setInterval(async () => {
    const st = useTeamSyncStore.getState();
    if (!st.token) return;
    // Se ho modifiche locali entro la finestra anti-rollback, salto il pull
    if (Date.now() - _localChangeAt < ANTI_ROLLBACK_WINDOW_MS) return;
    try {
      const data = await st.pullData();
      if (data) applyMerge(data);
    } catch {}
  }, intervalMs);
}

export function stopTeamBackgroundPull() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}
