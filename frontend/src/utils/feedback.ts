/**
 * Feedback sonoro e aptico per MarketMate
 * - hapticTap: vibrazione leggera per tocchi generici
 * - playSuccess: suono UNICO di conferma salvataggio (singolo tono ascendente)
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Vibrazione leggera per tocchi generici
 */
export function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * Suono UNICO di conferma salvataggio — vibrazione forte di successo
 * Diverso da hapticTap (che è leggero)
 */
export async function playSuccess() {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (_e) {}
}

// Legacy exports per compatibilità
export const playTap = hapticTap;
export const playNotification = hapticTap;
