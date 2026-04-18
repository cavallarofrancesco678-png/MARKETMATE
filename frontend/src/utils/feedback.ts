/**
 * Feedback sonoro e aptico per MarketMate
 * - hapticTap: vibrazione leggera per tocchi generici
 * - playSaveSound: SUONO AUDIO reale per il tasto SALVA (diverso da tutto il resto)
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

/**
 * Vibrazione leggera per tocchi generici (nessun suono)
 */
export function hapticTap() {
  // No-op on web, light vibration on native would need expo-haptics
  // Keep lightweight - no sound
}

/**
 * SUONO AUDIO di conferma salvataggio
 * Riproduce un breve "ding" ascendente — DIVERSO da qualsiasi altra interazione
 */
export async function playSuccess() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3' },
      { shouldPlay: true, volume: 0.6 }
    );
    // Rilascia la risorsa dopo la riproduzione
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (_e) {
    // Fallback silenzioso se non riesce a riprodurre
  }
}

// Legacy exports per compatibilità
export const playTap = hapticTap;
export const playNotification = hapticTap;
