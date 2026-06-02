/**
 * Subscription Store — Round 68
 * ═══════════════════════════════════════════════════════════════
 * Gestisce lo stato dell'abbonamento Premium dell'utente.
 *
 *  State:
 *    • config: { publishableKey, priceMensile, priceAnnuale, isLiveMode }
 *    • status: { active, plan, status, currentPeriodEnd, cancelAtPeriodEnd }
 *    • loading: bool
 *
 *  Actions:
 *    • loadConfig()                — GET /api/stripe/config (pubblico)
 *    • refreshStatus()             — GET /api/stripe/subscription-status (richiede auth)
 *    • createCheckout(plan)        — POST /api/stripe/create-checkout-session → restituisce URL
 *    • createPortal()              — POST /api/stripe/create-portal-session → restituisce URL
 */
import { create } from 'zustand';
import { useAuthStore } from './authStore';

const API_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '') + '/api';

export type SubscriptionPlan = 'monthly' | 'annual';
export type SubscriptionStatusValue =
  | 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | 'unpaid' | null;

export interface StripeConfig {
  publishableKey: string;
  priceMensile: string;
  priceAnnuale: string;
  isLiveMode: boolean;
}

export interface SubscriptionStatus {
  active: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatusValue;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLiveMode: boolean;
}

interface SubscriptionState {
  config: StripeConfig | null;
  status: SubscriptionStatus | null;
  loadingConfig: boolean;
  loadingStatus: boolean;
  loadingCheckout: boolean;
  error: string | null;

  loadConfig: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  createCheckout: (plan: SubscriptionPlan) => Promise<string>; // returns URL
  createPortal: () => Promise<string>; // returns URL
}

async function apiCall(path: string, opts: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API_BASE + path, { ...opts, headers });
  if (!r.ok) {
    let errMsg = `HTTP ${r.status}`;
    try {
      const data = await r.json();
      errMsg = data?.detail || data?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return r.json();
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  config: null,
  status: null,
  loadingConfig: false,
  loadingStatus: false,
  loadingCheckout: false,
  error: null,

  loadConfig: async () => {
    if (get().config) return; // cache
    set({ loadingConfig: true, error: null });
    try {
      const data = await apiCall('/stripe/config', { method: 'GET' });
      set({
        config: {
          publishableKey: data.publishable_key,
          priceMensile: data.price_mensile,
          priceAnnuale: data.price_annuale,
          isLiveMode: data.is_live_mode,
        },
        loadingConfig: false,
      });
    } catch (e: any) {
      set({ loadingConfig: false, error: String(e.message || e) });
    }
  },

  refreshStatus: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ status: null });
      return;
    }
    set({ loadingStatus: true, error: null });
    try {
      const data = await apiCall('/stripe/subscription-status', { method: 'GET' }, token);
      set({
        status: {
          active: data.active,
          plan: data.plan,
          status: data.status,
          currentPeriodEnd: data.current_period_end,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          isLiveMode: data.is_live_mode,
        },
        loadingStatus: false,
      });
    } catch (e: any) {
      set({ loadingStatus: false, error: String(e.message || e) });
    }
  },

  createCheckout: async (plan) => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Devi essere autenticato per sottoscrivere');
    set({ loadingCheckout: true, error: null });
    try {
      const data = await apiCall(
        '/stripe/create-checkout-session',
        { method: 'POST', body: JSON.stringify({ plan }) },
        token,
      );
      set({ loadingCheckout: false });
      return data.url;
    } catch (e: any) {
      set({ loadingCheckout: false, error: String(e.message || e) });
      throw e;
    }
  },

  createPortal: async () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Devi essere autenticato');
    try {
      const data = await apiCall(
        '/stripe/create-portal-session',
        { method: 'POST', body: JSON.stringify({}) },
        token,
      );
      return data.url;
    } catch (e: any) {
      set({ error: String(e.message || e) });
      throw e;
    }
  },
}));
