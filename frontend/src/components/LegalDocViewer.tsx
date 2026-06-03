/**
 * Legal Document Viewer — Round 69
 * ════════════════════════════════════════════════════════════════
 * Componente generico per visualizzare Privacy / ToS / Cookie Policy in-app.
 * Carica l'HTML dal backend e lo renderizza tramite WebView (mobile) o
 * dangerouslySetInnerHTML (web).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface LegalDocProps {
  type: 'privacy' | 'terms' | 'cookies';
  title: string;
}

export const LegalDocViewer: React.FC<LegalDocProps> = ({ type, title }) => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/legal/${type}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        if (alive) setHtml(text);
      } catch (e: any) {
        if (alive) setError(String(e.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [type]);

  const openExternal = () => {
    const url = `${BACKEND}/api/legal/${type}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.headerBtn}>
          <Ionicons name="chevron-back" size={26} color="#1A3535" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={openExternal} style={st.headerBtn}>
          <Ionicons name="open-outline" size={22} color="#1A3535" />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#1E7F85" />
          <Text style={st.muted}>Caricamento…</Text>
        </View>
      )}

      {error && (
        <View style={st.center}>
          <Ionicons name="warning" size={32} color="#D62828" />
          <Text style={st.errText}>Impossibile caricare il documento.</Text>
          <Text style={st.muted}>{error}</Text>
          <TouchableOpacity onPress={openExternal} style={st.openBtn}>
            <Text style={st.openBtnText}>Apri nel browser</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        Platform.OS === 'web' ? (
          <View style={{ flex: 1, padding: 16, backgroundColor: '#FDFBF6' }}>
            <iframe
              srcDoc={html}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#FDFBF6' } as any}
              title={title}
            />
          </View>
        ) : (
          // Per mobile, evitiamo react-native-webview (dipendenza extra) usando il browser di sistema
          <View style={st.center}>
            <Ionicons name="document-text-outline" size={48} color="#1E7F85" />
            <Text style={st.docInfoTitle}>{title}</Text>
            <Text style={st.docInfo}>
              Per la migliore esperienza di lettura, apri il documento nel browser.
            </Text>
            <TouchableOpacity onPress={openExternal} style={st.openBtn}>
              <Ionicons name="open" size={16} color="#FFF" />
              <Text style={st.openBtnText}>APRI DOCUMENTO</Text>
            </TouchableOpacity>
            <Text style={[st.muted, { marginTop: 18 }]}>
              Ultimo aggiornamento: 2 giugno 2026 (v1.0)
            </Text>
          </View>
        )
      )}
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DCD5C4' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#1A3535', letterSpacing: 0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  muted: { color: '#7A9090', fontSize: 12, textAlign: 'center' },
  errText: { color: '#D62828', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  docInfoTitle: { fontSize: 18, fontWeight: '900', color: '#1A3535', marginTop: 8 },
  docInfo: { fontSize: 13, color: '#5A7575', textAlign: 'center', lineHeight: 19 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E7F85', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  openBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
