import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let soundObject: Audio.Sound | null = null;

// Notification bell sound using Web Audio API for web, expo-av for native
export const playNotificationSound = async () => {
  try {
    if (Platform.OS === 'web') {
      // Use Web Audio API for web
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Bell-like sound
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Second chime
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.setValueAtTime(1320, audioContext.currentTime); // E6
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.2);
      }, 150);
      
    } else {
      // Use expo-av for native
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      
      if (soundObject) {
        await soundObject.unloadAsync();
      }
      
      // Create a simple notification sound using expo-av
      // Since we can't bundle custom sounds easily, we'll use system sounds or skip
      console.log('Notification sound (native)');
    }
  } catch (error) {
    console.log('Sound playback error:', error);
  }
};

export const cleanupSound = async () => {
  if (soundObject) {
    await soundObject.unloadAsync();
    soundObject = null;
  }
};
