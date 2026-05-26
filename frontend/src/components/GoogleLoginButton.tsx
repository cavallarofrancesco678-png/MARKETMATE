/**
 * GoogleLoginButton — Round 67
 * ═══════════════════════════════════════════════════════════════
 * Bottone "Accedi con Google" che usa il flusso OAuth via Emergent Auth.
 *
 *   Flusso:
 *   1. Click → genera redirect_url (mobile: deep link, web: origin URL)
 *   2. Apre `https://auth.emergentagent.com/?redirect=...` in WebBrowser
 *   3. L'utente completa il login Google nel browser
 *   4. Emergent torna a redirect_url con `#session_id=...` nella URL
 *   5. Estraiamo `session_id`, chiamiamo Emergent `oauth/session-data`
 *      per ottenere `session_token`
 *   6. Passiamo `session_token` al nostro backend → riceviamo JWT MarketMate
 *
 *   Funziona su:
 *   - iOS / Android (Expo Go + standalone) tramite WebBrowser
 *   - Web preview (window.location.href redirect + parse al rientro)
 *
 *   Note: chiama una sola Emergent API endpoint (`/auth/v1/env/oauth/session-data`)
 *   che ritorna { id, email, name, picture, session_token }.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  TouchableOpacity, Text, View, ActivityIndicator, StyleSheet, Platform, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

WebBrowser.maybeCompleteAuthSession();

const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/';
const EMERGENT_SESSION_DATA_URL = 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data';

interface Props {
  onSuccess?: () => void;
  onError?: (err: string) => void;
  /** Stile compatto (versione settings vs onboarding). */
  compact?: boolean;
}

export const GoogleLoginButton: React.FC<Props> = ({ onSuccess, onError, compact }) => {
  const [loading, setLoading] = useState(false);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  // Anti-doppio-trigger su web (mount + URL parse)
  const handledRef = useRef<string | null>(null);

  /* ═══ Estrazione session_id da una URL ═══
     Cerca sia in hash (#session_id=...) sia in query (?session_id=...). */
  const parseSessionId = (url: string): string | null => {
    if (!url) return null;
    try {
      // Hash fragment
      const hashIdx = url.indexOf('#session_id=');
      if (hashIdx >= 0) {
        const v = url.substring(hashIdx + '#session_id='.length).split('&')[0];
        return decodeURIComponent(v);
      }
      // Query param
      const qIdx = url.indexOf('?session_id=');
      if (qIdx >= 0) {
        const v = url.substring(qIdx + '?session_id='.length).split('&')[0];
        return decodeURIComponent(v);
      }
      const qIdx2 = url.indexOf('&session_id=');
      if (qIdx2 >= 0) {
        const v = url.substring(qIdx2 + '&session_id='.length).split('&')[0];
        return decodeURIComponent(v);
      }
    } catch {}
    return null;
  };

  /* ═══ Step 2/3 — Scambia session_id per session_token su Emergent ═══ */
  const completeLogin = useCallback(async (sessionId: string) => {
    if (handledRef.current === sessionId) return;
    handledRef.current = sessionId;
    setLoading(true);
    try {
      const r = await fetch(EMERGENT_SESSION_DATA_URL, {
        headers: { 'X-Session-ID': sessionId },
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Emergent ${r.status}: ${text || 'errore sconosciuto'}`);
      }
      const data = await r.json();
      const sessionToken = data?.session_token;
      if (!sessionToken) throw new Error('session_token non ricevuto da Emergent');
      // Login lato MarketMate (genera JWT nostro)
      await loginWithGoogle(sessionToken);
      // Pulizia URL su web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
      }
      onSuccess?.();
    } catch (e: any) {
      const msg = String(e?.message || e || 'Errore login Google');
      console.warn('[GoogleLogin] error', msg);
      onError?.(msg);
      if (!onError) Alert.alert('Login fallito', msg);
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, onSuccess, onError]);

  /* ═══ Auto-rilevamento session_id al mount (web cold start + mobile deep link) ═══ */
  useEffect(() => {
    let alive = true;
    let subscription: any = null;
    (async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web: parse url al mount
        const sid = parseSessionId(window.location.href);
        if (sid) completeLogin(sid);
      } else {
        // Mobile: cold start (app riaperta da link)
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const sid = parseSessionId(initialUrl);
            if (sid && alive) completeLogin(sid);
          }
        } catch {}
        // Mobile: link a runtime
        subscription = Linking.addEventListener('url', (e: any) => {
          const sid = parseSessionId(e?.url || '');
          if (sid && alive) completeLogin(sid);
        });
      }
    })();
    return () => {
      alive = false;
      try { subscription?.remove?.(); } catch {}
    };
  }, [completeLogin]);

  /* ═══ Step 1 — Apri il flusso OAuth ═══ */
  const handlePress = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      let redirectUrl: string;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Su web: torna alla root dell'app (deve essere una route esistente)
        redirectUrl = window.location.origin + '/';
      } else {
        // Mobile: deep link "marketmate://auth" (Expo Go: exp://...)
        redirectUrl = Linking.createURL('auth');
      }
      const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web: redirect diretto (no WebBrowser su web)
        window.location.href = authUrl;
        return; // dopo il redirect ritorneremo qui con #session_id=...
      }

      // Mobile: apri sessione browser auth
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const sid = parseSessionId(result.url);
        if (sid) {
          await completeLogin(sid);
          return;
        }
      }
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // utente ha annullato — nessun errore
        setLoading(false);
        return;
      }
      throw new Error('Login annullato o non riuscito');
    } catch (e: any) {
      const msg = String(e?.message || e || 'Errore login Google');
      console.warn('[GoogleLogin] press error', msg);
      onError?.(msg);
      if (!onError) Alert.alert('Login fallito', msg);
      setLoading(false);
    }
  }, [loading, onError, completeLogin]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.85}
      style={[st.btn, compact && st.btnCompact, loading && st.btnDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#1A3535" />
      ) : (
        <View style={st.row}>
          {/* Icona Google "G" multicolore stilizzata via testo (no asset esterno) */}
          <View style={st.gIcon}>
            <Text style={st.gIconText}>G</Text>
          </View>
          <Text style={[st.label, compact && st.labelCompact]}>
            Accedi con Google
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const st = StyleSheet.create({
  btn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCD5C4',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  btnCompact: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F1F1F1',
    alignItems: 'center', justifyContent: 'center',
  },
  gIconText: { fontSize: 13, fontWeight: '900', color: '#4285F4' },
  label: { fontSize: 15, fontWeight: '700', color: '#1A3535', letterSpacing: 0.3 },
  labelCompact: { fontSize: 14 },
});
