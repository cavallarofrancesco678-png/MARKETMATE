/**
 * Feedback sonoro e aptico per MarketMate
 * - tapSound: suono leggero su ogni tocco
 * - successSound: suono di conferma salvataggio
 * - hapticTap: vibrazione leggera
 * - hapticSuccess: vibrazione di successo
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

let tapSoundObj: Audio.Sound | null = null;
let successSoundObj: Audio.Sound | null = null;

// Pre-generate tap sound as a very short sine-wave WAV (base64 encoded)
// 44100 Hz, mono, 16-bit, ~30ms duration
const TAP_WAV_B64 = 'UklGRmQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUAAAAAAAIAA/3/AfwCA/3+A//9/AICAAP9/gH8AgP9/gH//fwCAgAD/f4B/AID/f4B//38AgIAA/3+AfwCA';
const SUCCESS_WAV_B64 = 'UklGRoQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWAAAAAAAACAf/9/AID/f/9/gH+AAIAA/3//f4B/gACAAP9//3+Af4AAgAD/f/9/gH+AAIAA/3//f4B/gACAAP9//3+Af4AAgAAAAIB//38AgP9//3+Af4AAgAD/f/9/gH8=';

function b64toBlob(b64: string): string {
  if (Platform.OS === 'web') {
    return `data:audio/wav;base64,${b64}`;
  }
  return `data:audio/wav;base64,${b64}`;
}

async function loadSounds() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
  } catch (_e) {
    // Ignore on web
  }
}

// Initialize on first import
loadSounds();

/**
 * Play a soft tap sound + light haptic
 */
export async function playTap() {
  try {
    // Haptic first (instant feedback)
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // Play short tap sound
    const { sound } = await Audio.Sound.createAsync(
      { uri: b64toBlob(TAP_WAV_B64) },
      { shouldPlay: true, volume: 0.3 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (_e) {
    // Silently fail - sounds are non-critical
  }
}

/**
 * Play a success/save sound + medium haptic
 */
export async function playSuccess() {
  try {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: b64toBlob(SUCCESS_WAV_B64) },
      { shouldPlay: true, volume: 0.4 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (_e) {
    // Silently fail
  }
}

/**
 * Just haptic tap (no sound) - for very frequent interactions
 */
export function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * Just haptic success (no sound)
 */
export function hapticSuccess() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}
