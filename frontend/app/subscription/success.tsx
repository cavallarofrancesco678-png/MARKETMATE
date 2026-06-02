/**
 * Subscription Success — Round 68
 * Pagina di ritorno dopo checkout completato con successo.
 * Mostra conferma e fa refresh dello stato (il webhook avrà già aggiornato il backend).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';

export default function SubscriptionSuccess() {
  const { refreshStatus, status } = useSubscriptionStore();
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Polling: il webhook Stripe potrebbe impiegare 1-3s per arrivare
    const poll = async (attempts = 0) => {
      if (cancelled || attempts > 8) { setWaiting(false); return; }
      await refreshStatus();
      if (useSubscriptionStore.getState().status?.active) { setWaiting(false); return; }
      setTimeout(() => poll(attempts + 1), 1200);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.iconWrap}>
          {waiting ? (
            <ActivityIndicator size="large" color="#0E8A4E" />
          ) : (
            <Ionicons name="checkmark-circle" size={86} color="#0E8A4E" />
          )}
        </View>
        <Text style={s.title}>{waiting ? 'Conferma in corso…' : 'Pagamento completato!'}</Text>
        <Text style={s.subtitle}>
          {waiting
            ? 'Stiamo confermando il pagamento con Stripe.'
            : status?.plan === 'annual'
              ? 'Premium Annuale attivo. Grazie per aver scelto MarketMate!'
              : 'Premium Mensile attivo. Grazie per aver scelto MarketMate!'}
        </Text>
        {!waiting && (
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/home')}>
            <Text style={s.btnText}>VAI ALLA HOME</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF6' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  iconWrap: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A3535', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#5A7575', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  btn: { backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
});
