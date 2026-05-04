import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RoleGuard } from '../../src/components/RoleGuard';

/**
 * 🎁 PREMI E INVITI — Pagina Placeholder
 *
 * Pagina in costruzione. La versione completa includerà:
 * - Codice referral personale + link condivisione (WhatsApp/Copia)
 * - Lista amici invitati con stato abbonamento
 * - Salvadanaio buoni carburante
 * - Calcolo mesi gratis accumulati
 * - Codici convenzione (es. UNION50)
 *
 * Specifica completa salvata in /app/memory/SPEC_PREMI_INVITI.md
 */
export default function PremiPage() {
  return (
    <RoleGuard
      allow={(p) => p.canSeePremi}
      message={'Premi e Inviti sono gestiti dall\u2019amministratore dell\u2019app.'}
    >
      <PremiPageInner />
    </RoleGuard>
  );
}

function PremiPageInner() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : insets.top;

  // Animazione gentle pulse sul pacco regalo
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Animazione sparkle (stelle che ruotano leggermente)
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(sparkleAnim, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotateInterp = sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={s.pageTitle}>PREMI & INVITI</Text>

        {/* ═══ HERO PACCO REGALO ═══ */}
        <View style={s.heroBox}>
          <View style={s.giftWrap}>
            {/* Sparkle decorativi */}
            <Animated.View style={[s.sparkle, s.sparkleTL, { transform: [{ rotate: rotateInterp }] }]}>
              <Ionicons name="star" size={18} color="#E8A060" />
            </Animated.View>
            <Animated.View style={[s.sparkle, s.sparkleTR, { transform: [{ rotate: rotateInterp }] }]}>
              <Ionicons name="star" size={14} color="#D4A555" />
            </Animated.View>
            <Animated.View style={[s.sparkle, s.sparkleBL, { transform: [{ rotate: rotateInterp }] }]}>
              <Ionicons name="star" size={12} color="#E8A060" />
            </Animated.View>

            {/* Pacco principale */}
            <Animated.View style={[s.giftCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="gift" size={64} color="#FFFFFF" />
            </Animated.View>
          </View>

          <Text style={s.heroTitle}>Prossimamente</Text>
          <Text style={s.heroSubtitle}>
            Invita i tuoi colleghi e guadagna mesi gratis e buoni carburante.
          </Text>
        </View>

        {/* ═══ CARDS DI ANTEPRIMA ═══ */}
        <Text style={s.sectionTitle}>COSA POTRAI FARE</Text>

        <View style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: '#E8A060' }]}>
            <Ionicons name="link" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Codice & Link Personale</Text>
            <Text style={s.cardDesc}>Invita amici via WhatsApp o copia il tuo codice unico.</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: '#1E7F85' }]}>
            <Ionicons name="people" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Lista Amici</Text>
            <Text style={s.cardDesc}>Vedi chi si è iscritto grazie a te e lo stato del loro abbonamento.</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: '#B85450' }]}>
            <Ionicons name="calendar-outline" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Mesi Gratis</Text>
            <Text style={s.cardDesc}>Per ogni amico abbonato annualmente, +1 mese gratis (max 12).</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: '#7A5E9B' }]}>
            <Ionicons name="wallet-outline" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Salvadanaio Buoni</Text>
            <Text style={s.cardDesc}>Dopo i 12 mesi, accumula €6,90 per amico in buoni carburante.</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: '#5A8A85' }]}>
            <Ionicons name="ticket-outline" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Codice Convenzione</Text>
            <Text style={s.cardDesc}>Usa codici partner (es. UNION50) per ottenere sconti sull'abbonamento.</Text>
          </View>
        </View>

        {/* ═══ FOOTER NOTA ═══ */}
        <View style={s.footerBox}>
          <Ionicons name="construct-outline" size={16} color="#8A7050" />
          <Text style={s.footerTxt}>
            Funzionalità in fase di sviluppo. Disponibile a breve.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E6',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Hero box
  heroBox: {
    backgroundColor: '#FBF6E8',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: '#E8A060',
    // @ts-ignore
    boxShadow: '0px 6px 20px rgba(232,160,96,0.25), inset 0px 1px 2px rgba(255,255,255,0.6)',
  },
  giftWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  giftCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E8A060',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '4px 6px 16px rgba(184,90,40,0.45), inset -2px -3px 8px rgba(0,0,0,0.15), inset 3px 4px 8px rgba(255,255,255,0.35)',
  },
  sparkle: { position: 'absolute' },
  sparkleTL: { top: 4, left: 8 },
  sparkleTR: { top: 12, right: 4 },
  sparkleBL: { bottom: 14, left: 4 },

  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#5A7575',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7A9090',
    letterSpacing: 2.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: '#FBF6E8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8DEC5',
    // @ts-ignore
    boxShadow: '0px 2px 8px rgba(155,140,110,0.15)',
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: 'inset -1px -1px 4px rgba(0,0,0,0.15), inset 1px 1px 3px rgba(255,255,255,0.3)',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A4040',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#5A7575',
    lineHeight: 16,
    fontWeight: '500',
  },

  // Footer
  footerBox: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F0E8D0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  footerTxt: {
    fontSize: 12,
    color: '#8A7050',
    fontWeight: '700',
    fontStyle: 'italic',
  },
});
