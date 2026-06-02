/**
 * Subscription Screen — Round 68
 * ═══════════════════════════════════════════════════════════════
 * Schermata per:
 *  • Mostrare i piani disponibili (Free / Premium Mensile / Premium Annuale)
 *  • Avviare il checkout Stripe (apre URL in WebBrowser o redirect web)
 *  • Mostrare lo stato dell'abbonamento corrente
 *  • Aprire il Customer Portal per gestione abbonamento
 *
 * Accesso: solo utenti autenticati (Google login o email/password).
 * Solo OWNER può sottoscrivere (il backend rifiuta i collaboratori).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSubscriptionStore, type SubscriptionPlan } from '../../src/store/subscriptionStore';
import { useAuthStore } from '../../src/store/authStore';

const COLORS = {
  primary: '#1E7F85',
  accent: '#D2691E',
  bg: '#FDFBF6',
  card: '#FFFFFF',
  text: '#1A3535',
  muted: '#7A9090',
  border: '#DCD5C4',
  warning: '#D62828',
  success: '#0E8A4E',
};

export default function SubscriptionScreen() {
  const { config, status, loadingConfig, loadingCheckout, loadConfig, refreshStatus, createCheckout, createPortal } = useSubscriptionStore();
  const { user, isAuthenticated } = useAuthStore();
  const [busy, setBusy] = useState<SubscriptionPlan | 'portal' | null>(null);

  useEffect(() => {
    loadConfig();
    if (isAuthenticated) refreshStatus();
  }, [isAuthenticated]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!isAuthenticated) {
      Alert.alert('Login richiesto', 'Devi accedere prima di sottoscrivere un abbonamento.', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Accedi', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    if (user?.role !== 'owner') {
      Alert.alert('Solo per titolari', 'Solo il titolare dell\'account può sottoscrivere l\'abbonamento. Contatta il tuo amministratore.');
      return;
    }
    setBusy(plan);
    try {
      const url = await createCheckout(plan);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(url, Linking.createURL('subscription/success'));
        // Dopo redirect, il webhook avrà già aggiornato lo stato — facciamo refresh
        await refreshStatus();
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // Utente ha chiuso il checkout senza pagare
        }
      }
    } catch (e: any) {
      Alert.alert('Errore', String(e.message || e));
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy('portal');
    try {
      const url = await createPortal();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
        await refreshStatus();
      }
    } catch (e: any) {
      Alert.alert('Errore', String(e.message || e));
    } finally {
      setBusy(null);
    }
  };

  const isPremium = status?.active === true;
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Abbonamento Premium</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* BANNER MODALITÀ LIVE */}
        {config?.isLiveMode && (
          <View style={s.liveBanner}>
            <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
            <Text style={s.liveBannerText}>
              MODALITÀ LIVE — qualsiasi pagamento è reale.
            </Text>
          </View>
        )}

        {/* STATO CORRENTE */}
        {isPremium && (
          <View style={s.activeCard}>
            <View style={s.activeBadge}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={s.activeBadgeText}>PREMIUM ATTIVO</Text>
            </View>
            <Text style={s.activePlan}>
              Piano: {status?.plan === 'monthly' ? 'Mensile €6.90/mese' : 'Annuale €69/anno'}
            </Text>
            {periodEnd && (
              <Text style={s.activePeriod}>
                {status?.cancelAtPeriodEnd
                  ? `Si cancellerà il ${periodEnd}`
                  : `Prossimo rinnovo il ${periodEnd}`}
              </Text>
            )}
            <TouchableOpacity
              style={s.portalBtn}
              onPress={handlePortal}
              disabled={busy === 'portal'}
            >
              {busy === 'portal' ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="settings-outline" size={17} color="#FFF" />
                  <Text style={s.portalBtnText}>GESTISCI ABBONAMENTO</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={s.portalHint}>
              Nel portale puoi cambiare piano, aggiornare la carta o cancellare l'abbonamento.
            </Text>
          </View>
        )}

        {/* HERO */}
        {!isPremium && (
          <View style={s.hero}>
            <Text style={s.heroTitle}>Sblocca tutto il potenziale</Text>
            <Text style={s.heroSubtitle}>
              Statistiche avanzate • Cloud sync illimitato • Team collaborativo • AI personalizzata
            </Text>
          </View>
        )}

        {/* PIANI */}
        {!isPremium && (
          <>
            {/* Annuale — consigliato */}
            <View style={[s.planCard, s.planCardHighlight]}>
              <View style={s.planRibbon}>
                <Text style={s.planRibbonText}>RISPARMI 17%</Text>
              </View>
              <Text style={s.planName}>Premium Annuale</Text>
              <View style={s.priceRow}>
                <Text style={s.priceBig}>€69</Text>
                <Text style={s.priceUnit}>/anno</Text>
              </View>
              <Text style={s.planSub}>= €5.75/mese · 17% di sconto rispetto al mensile</Text>
              <View style={s.featuresList}>
                <Feature text="Tutti i piani Premium" />
                <Feature text="Sincronizzazione cloud illimitata" />
                <Feature text="Squadra collaboratori illimitata" />
                <Feature text="Statistiche AI avanzate" />
                <Feature text="Esporta dati PDF/Excel commercialista" />
                <Feature text="Supporto prioritario via email" />
              </View>
              <TouchableOpacity
                style={[s.subscribeBtn, s.subscribeBtnPrimary]}
                onPress={() => handleSubscribe('annual')}
                disabled={!!busy}
              >
                {busy === 'annual' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="diamond" size={18} color="#FFF" />
                    <Text style={s.subscribeBtnTextPrimary}>SOTTOSCRIVI €69/ANNO</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Mensile */}
            <View style={s.planCard}>
              <Text style={s.planName}>Premium Mensile</Text>
              <View style={s.priceRow}>
                <Text style={s.priceBig}>€6.90</Text>
                <Text style={s.priceUnit}>/mese</Text>
              </View>
              <Text style={s.planSub}>Cancella in qualsiasi momento.</Text>
              <View style={s.featuresList}>
                <Feature text="Sincronizzazione cloud illimitata" />
                <Feature text="Squadra collaboratori illimitata" />
                <Feature text="Statistiche AI avanzate" />
                <Feature text="Esporta dati PDF/Excel commercialista" />
              </View>
              <TouchableOpacity
                style={s.subscribeBtn}
                onPress={() => handleSubscribe('monthly')}
                disabled={!!busy}
              >
                {busy === 'monthly' ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                    <Text style={s.subscribeBtnText}>SOTTOSCRIVI €6.90/MESE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Piano free */}
            <View style={[s.planCard, s.planCardFree]}>
              <Text style={s.planNameFree}>Free (attuale)</Text>
              <View style={s.priceRow}>
                <Text style={s.priceBigFree}>€0</Text>
                <Text style={s.priceUnit}>/per sempre</Text>
              </View>
              <Text style={s.planSub}>Per uso personale, una sola attività.</Text>
              <View style={s.featuresList}>
                <Feature text="Tracciamento giornaliero" muted />
                <Feature text="Fino a 3 fornitori" muted />
                <Feature text="Statistiche base" muted />
              </View>
            </View>
          </>
        )}

        {/* FOOTER LEGAL */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Cancellabile in qualsiasi momento. Pagamento sicuro gestito da Stripe.
            {'\n'}Vedi <Text style={s.footerLink} onPress={() => router.push('/legal/terms' as any)}>Termini</Text> e{' '}
            <Text style={s.footerLink} onPress={() => router.push('/legal/privacy' as any)}>Privacy</Text>.
          </Text>
        </View>

        {loadingConfig && (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Feature: React.FC<{ text: string; muted?: boolean }> = ({ text, muted }) => (
  <View style={s.featureRow}>
    <Ionicons name="checkmark" size={16} color={muted ? COLORS.muted : COLORS.success} />
    <Text style={[s.featureText, muted && { color: COLORS.muted }]}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 16 : 6, paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: COLORS.text, letterSpacing: 0.3 },
  content: { padding: 16, paddingBottom: 60 },

  liveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFE9E5', borderRadius: 10, padding: 10, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  liveBannerText: { fontSize: 11, color: COLORS.warning, fontWeight: '700', flex: 1 },

  hero: { paddingVertical: 14, alignItems: 'center', marginBottom: 18 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  planCard: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
    // @ts-ignore
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  planCardHighlight: { borderColor: COLORS.primary, borderWidth: 2 },
  planCardFree: { borderColor: COLORS.border, backgroundColor: '#F5F1E8' },
  planRibbon: {
    position: 'absolute', top: -10, right: 14,
    backgroundColor: COLORS.accent, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  planRibbonText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

  planName: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  planNameFree: { fontSize: 15, fontWeight: '700', color: COLORS.muted, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  priceBig: { fontSize: 38, fontWeight: '900', color: COLORS.text },
  priceBigFree: { fontSize: 30, fontWeight: '800', color: COLORS.muted },
  priceUnit: { fontSize: 14, color: COLORS.muted, marginLeft: 4, fontWeight: '700' },
  planSub: { fontSize: 12, color: COLORS.muted, marginBottom: 16 },

  featuresList: { marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureText: { fontSize: 13, color: COLORS.text, flex: 1 },

  subscribeBtn: {
    backgroundColor: '#F5F1E8', borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  subscribeBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  subscribeBtnText: { fontSize: 13, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  subscribeBtnTextPrimary: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

  activeCard: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 22, marginBottom: 18,
    borderLeftWidth: 4, borderLeftColor: COLORS.success,
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(14,138,78,0.15)',
  },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  activeBadgeText: { fontSize: 12, fontWeight: '900', color: COLORS.success, letterSpacing: 1 },
  activePlan: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  activePeriod: { fontSize: 13, color: COLORS.muted, marginBottom: 16 },
  portalBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  portalBtnText: { fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 0.8 },
  portalHint: { fontSize: 11, color: COLORS.muted, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },

  footer: { marginTop: 14, paddingHorizontal: 8 },
  footerText: { fontSize: 11, color: COLORS.muted, textAlign: 'center', lineHeight: 17 },
  footerLink: { color: COLORS.primary, textDecorationLine: 'underline' },
});
