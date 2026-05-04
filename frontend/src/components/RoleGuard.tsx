/**
 * RoleGuard — Renderizza un placeholder se l'utente corrente non ha il permesso richiesto.
 *
 * Uso:
 *   <RoleGuard allow={(p) => p.canSeeSettings}>
 *     ...contenuto della pagina...
 *   </RoleGuard>
 *
 * Quando il permesso manca mostra un messaggio amichevole con icona,
 * spiegando che la sezione è riservata, e un pulsante per tornare in Home.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions, roleLabel, type Permissions } from '../utils/permissions';

interface Props {
  allow: (p: Permissions) => boolean;
  children: React.ReactNode;
  /** Messaggio personalizzato (default: "Sezione riservata all'amministratore") */
  message?: string;
  /** Etichetta opzionale del titolo (default: "Accesso limitato") */
  title?: string;
}

export const RoleGuard: React.FC<Props> = ({ allow, children, message, title }) => {
  const perms = usePermissions();
  if (allow(perms)) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <View style={st.container}>
        <View style={st.iconWrap}>
          <Ionicons name="lock-closed" size={56} color="#1E7F85" />
        </View>
        <Text style={st.title}>{title || 'Accesso limitato'}</Text>
        <Text style={st.message}>
          {message || 'Questa sezione è riservata all\u2019amministratore dell\u2019app.'}
        </Text>
        <View style={st.roleBadge}>
          <Ionicons name="person-circle-outline" size={16} color="#5A8A85" />
          <Text style={st.roleText}>Stai usando il profilo: {roleLabel(perms.role)}</Text>
        </View>
        <TouchableOpacity
          style={st.btn}
          onPress={() => {
            try { router.replace('/home'); } catch {}
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="home" size={18} color="#FFF" />
          <Text style={st.btnText}>Torna alla Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E6' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8EDE5',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A3A3A',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#3F5E5C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 4,
    marginBottom: 24,
  },
  roleText: {
    fontSize: 13,
    color: '#5A8A85',
    fontWeight: '600',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E7F85',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 220,
  },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
