/**
 * Round 71 — Feedback sonoro per MarketMate
 * 
 * - hapticTap: nessun suono (tocchi generici)
 * - playSuccess: SUONO AUDIO "cha-ching" per il tasto SALVA
 * 
 * Strategia:
 * - WEB → sintesi locale via Web Audio API (nessuna dipendenza di rete,
 *   nessun rischio di CDN bloccata). Doppia nota dolce A5 → E6.
 * - NATIVE (iOS/Android) → expo-audio con createAudioPlayer + CDN.
 *   Fallback silenzioso se il player non riesce a inizializzarsi.
 */
import { Platform } from 'react-native';

const SAVE_SOUND_URL = 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3';

/**
 * Nessun suono per tocchi generici
 */
export function hapticTap() {
  // Silenzioso (in passato qui c'era haptic, rimosso per minimal touch)
}

/**
 * Sintesi "ka-ching" via Web Audio API (solo web)
 */
function playWebSynthChime() {
  try {
    // @ts-ignore — AudioContext esiste solo lato web
    const AC = (typeof window !== 'undefined') && (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;

    // Nota 1: A5 (880 Hz) — attack 0.3s
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, now);
    o1.connect(g1); g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o1.start(now);
    o1.stop(now + 0.4);

    // Nota 2: E6 (1320 Hz) — sovrapposta dopo 80ms
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1320, now + 0.08);
    o2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.0001, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.28, now + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o2.start(now + 0.08);
    o2.stop(now + 0.5);
  } catch (_e) {
    // Sintesi fallita: silenzio
  }
}

/**
 * SUONO AUDIO per il tasto SALVA
 */
export async function playSuccess() {
  // Web: sintesi locale (reliable, no network)
  if (Platform.OS === 'web') {
    playWebSynthChime();
    return;
  }
  // Native: usa expo-audio (sostituto ufficiale di expo-av deprecato)
  try {
    const { createAudioPlayer } = require('expo-audio');
    const player = createAudioPlayer({ uri: SAVE_SOUND_URL });
    player.volume = 1.0;
    player.play();
    // Cleanup automatico dopo 1.5s (il "ding" dura <1s)
    setTimeout(() => {
      try { player.remove(); } catch { /* skip */ }
    }, 1500);
  } catch (_e) {
    // Fallback silenzioso
  }
}

// Legacy exports
export const playTap = hapticTap;
export const playNotification = hapticTap;
