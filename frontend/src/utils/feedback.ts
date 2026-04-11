/**
 * Feedback sonoro e aptico per MarketMate
 * - playTap: vibrazione leggera per ogni tocco
 * - playSuccess: suono di conferma salvataggio (diverso dal tap!)
 * - hapticTap: solo vibrazione leggera
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

/**
 * Play a soft tap - ONLY haptic, no audio (discreto)
 */
export async function playTap() {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (_e) {}
}

/**
 * Play a success/save sound - Haptic + Audio (suono diverso, più lungo)
 */
export async function playSuccess() {
  try {
    // Vibrazione di successo (diversa dal tap)
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    // Suono di conferma - doppio beep armonioso
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
    } catch (_e) {}
    
    // Genera un WAV programmaticamente con due toni ascendenti
    const sampleRate = 22050;
    const duration = 0.25; // 250ms
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // Due toni: 880Hz poi 1100Hz (ascendente, armonioso)
    const half = Math.floor(numSamples / 2);
    for (let i = 0; i < numSamples; i++) {
      const freq = i < half ? 880 : 1100;
      const t = i / sampleRate;
      const envelope = Math.min(1, Math.min(i / 200, (numSamples - i) / 400));
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.35 * envelope;
      view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
    }
    
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
    
    if (b64) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${b64}` },
        { shouldPlay: true, volume: 0.5 }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) sound.unloadAsync().catch(() => {});
      });
    }
  } catch (_e) {
    // Fallback: solo haptic
  }
}

/**
 * Just haptic tap (no sound) - per interazioni frequenti
 */
export function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * Suono notifica campanella
 */
export async function playNotification() {
  try {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
    } catch (_e) {}
    
    const sampleRate = 22050;
    const duration = 0.15;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // Singolo tono 660Hz breve
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, Math.min(i / 100, (numSamples - i) / 200));
      const sample = Math.sin(2 * Math.PI * 660 * t) * 0.3 * envelope;
      view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
    }
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
    
    if (b64) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${b64}` },
        { shouldPlay: true, volume: 0.4 }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) sound.unloadAsync().catch(() => {});
      });
    }
  } catch (_e) {}
}
