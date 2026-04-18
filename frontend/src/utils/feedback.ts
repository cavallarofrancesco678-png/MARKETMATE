/**
 * Feedback sonoro per MarketMate
 * - hapticTap: nessun suono (tocchi generici)
 * - playSuccess: SUONO AUDIO "ding" per SALVA (volume massimo)
 */
import { useAudioPlayer } from 'expo-audio';

const SAVE_SOUND_URL = 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3';

// Pre-cache: niente, il suono si carica al primo uso

/**
 * Nessun suono per tocchi generici
 */
export function hapticTap() {
  // Silenzioso
}

/**
 * SUONO AUDIO "ding" per il tasto SALVA — volume massimo
 */
export async function playSuccess() {
  try {
    // Use expo-audio (modern API, replaces deprecated expo-av)
    const { Audio } = require('expo-av');
    const { sound } = await Audio.Sound.createAsync(
      { uri: SAVE_SOUND_URL },
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (_e) {
    // Fallback silenzioso
  }
}

// Legacy exports
export const playTap = hapticTap;
export const playNotification = hapticTap;
