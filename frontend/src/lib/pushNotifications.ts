/**
 * Push Notifications — Round 69
 * ═══════════════════════════════════════════════════════════════
 * Gestione dei Push Token Expo per consentire al server di inviare
 * notifiche remote (es. invito a team, conferma pagamento, scadenze).
 *
 * Architettura:
 *   1. App chiede permessi push (richiesto dal sistema iOS/Android)
 *   2. Otteniamo un "Expo Push Token" (ExponentPushToken[xxx])
 *   3. Lo inviamo al backend → /api/auth/push-token
 *   4. Backend lo salva nell'utente
 *   5. Quando serve inviare un push, backend chiama l'API Expo Push:
 *      https://exp.host/--/api/v2/push/send (gratuito, no Firebase chiave)
 *
 * Funziona su iOS, Android, Web (Web: solo log, no notifiche push reali).
 * NON richiede Firebase: Expo gestisce APNs (iOS) e FCM (Android) internamente.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

const STORAGE_KEY = 'mm_push_token_v1';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/**
 * Registra il device per push notifications.
 * Restituisce il token Expo Push (ExponentPushToken[xxx]) o null.
 * Idempotente: se chiamata più volte, evita doppi network call.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Web: no push reali, ritorna null silenziosamente
  if (Platform.OS === 'web') return null;
  // Simulator: getExpoPushToken non funziona su simulatori iOS
  if (!Device.isDevice) {
    console.log('[Push] Skipping: not on a physical device');
    return null;
  }

  try {
    // Step 1: verifica permessi
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    // Step 2: ottieni Expo Push Token
    // L'API richiede il projectId di Expo (preso da app.json/eas.json)
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )).data;

    // Step 3: persisti localmente
    await AsyncStorage.setItem(STORAGE_KEY, token);

    // Step 4: invia al backend SE l'utente è loggato
    const authToken = useAuthStore.getState().token;
    if (authToken) {
      try {
        await fetch(`${BACKEND}/api/auth/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            push_token: token,
            platform: Platform.OS,
            device_name: Device.modelName || 'unknown',
          }),
        });
        console.log('[Push] Token inviato al backend');
      } catch (e) {
        console.warn('[Push] Errore invio token al backend:', e);
        // Non bloccante: il token resta in AsyncStorage e verrà reinviato al
        // prossimo registerForPushNotifications.
      }
    }

    return token;
  } catch (e) {
    console.warn('[Push] Errore registrazione push:', e);
    return null;
  }
}

/** Restituisce il token in cache (o null se mai registrato). */
export async function getCachedPushToken(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

/** Cancella il token in cache (es. al logout). */
export async function clearCachedPushToken(): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
}
