/**
 * Subscription Cancel — Round 68
 * Pagina di ritorno se l'utente annulla il checkout Stripe.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function SubscriptionCancel() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Ionicons name="close-circle" size={86} color="#D46A6A" />
        <Text style={s.title}>Pagamento annullato</Text>
        <Text style={s.subtitle}>
          Nessun addebito effettuato. Puoi riprovare quando vuoi.
        </Text>
        <TouchableOpacity style={s.btnPrimary} onPress={() => router.replace('/subscription')}>
          <Text style={s.btnPrimaryText}>RIPROVA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnGhost} onPress={() => router.replace('/home')}>
          <Text style={s.btnGhostText}>Torna alla home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF6' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A3535', textAlign: 'center', marginTop: 16, marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#5A7575', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  btnPrimary: { backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 10 },
  btnPrimaryText: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  btnGhost: { padding: 12 },
  btnGhostText: { fontSize: 13, color: '#1E7F85', fontWeight: '700' },
});
