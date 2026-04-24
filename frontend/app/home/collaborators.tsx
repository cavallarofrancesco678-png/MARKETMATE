import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Share as RNShare } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function CollaboratorsScreen() {
  const { user, listCollaborators, listInvites, createInvite, revokeInvite, removeCollaborator } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [newRole, setNewRole] = useState<'full' | 'operativo'>('operativo');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const [c, i] = await Promise.all([listCollaborators(), listInvites()]);
      setCollaborators(c || []);
      setInvites((i || []).filter((x: any) => !x.used_by));
    } catch (e: any) { setErr(String(e?.message || 'Errore caricamento')); }
    finally { setBusy(false); }
  }, [listCollaborators, listInvites]);

  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== 'owner') {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color="#1A4040" /></TouchableOpacity>
          <Text style={s.title}>COLLABORATORI</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ color: '#5A7575', fontSize: 14, textAlign: 'center' }}>Solo il titolare dell'account può gestire i collaboratori.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totaleUtenti = 1 + collaborators.length + invites.length;
  const puoInvitare = totaleUtenti < 3;

  const handleCreate = async () => {
    setBusy(true); setErr('');
    try {
      const inv = await createInvite(newRole);
      await load();
      // Subito dopo la creazione, suggerisci di condividere
      const msg = `Usa questo codice per unirti al mio account MarketMate:\n\n${inv.code}\n\nScarica MarketMate e scegli "Ho un codice invito".`;
      if (Platform.OS === 'web') {
        try { await navigator.clipboard.writeText(inv.code); Alert.alert('Codice copiato', `Il codice ${inv.code} è stato copiato negli appunti.`); } catch {}
      } else {
        try { await RNShare.share({ message: msg }); } catch {}
      }
    } catch (e: any) { setErr(String(e?.message || 'Errore')); }
    finally { setBusy(false); }
  };

  const handleRevoke = async (code: string) => {
    const doRevoke = async () => { try { await revokeInvite(code); await load(); } catch (e: any) { Alert.alert('Errore', String(e?.message || 'Errore')); } };
    if (Platform.OS === 'web') { if (window.confirm(`Revocare il codice ${code}?`)) await doRevoke(); }
    else Alert.alert('Revoca codice', `Sei sicuro di voler revocare il codice ${code}?`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Revoca', style: 'destructive', onPress: doRevoke }]);
  };

  const handleRemoveCollab = async (c: any) => {
    const doRemove = async () => { try { await removeCollaborator(c.id); await load(); } catch (e: any) { Alert.alert('Errore', String(e?.message || 'Errore')); } };
    if (Platform.OS === 'web') { if (window.confirm(`Rimuovere ${c.email}?`)) await doRemove(); }
    else Alert.alert('Rimuovi collaboratore', `${c.email}\n\nNon potrà più accedere ai dati dell'account.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Rimuovi', style: 'destructive', onPress: doRemove }]);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color="#1A4040" /></TouchableOpacity>
        <Text style={s.title}>COLLABORATORI</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Banner stato */}
        <View style={s.banner}>
          <Ionicons name="people" size={20} color="#1E7F85" />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>{totaleUtenti} / 3 persone</Text>
            <Text style={s.bannerSub}>Il tuo account può essere usato da un massimo di 3 persone (tu + 2 collaboratori).</Text>
          </View>
        </View>

        {/* Crea nuovo invito */}
        <View style={s.card}>
          <Text style={s.cardTitle}>+ INVITA UN COLLABORATORE</Text>
          <Text style={s.cardHint}>Scegli il ruolo e genera un codice da inviare.</Text>

          <View style={s.roleRow}>
            {[
              { key: 'operativo' as const, label: 'OPERATIVO', desc: 'Solo inserimento giornata' },
              { key: 'full' as const, label: 'FULL', desc: 'Accesso completo (come titolare)' },
            ].map((r) => {
              const on = newRole === r.key;
              return (
                <TouchableOpacity key={r.key} style={[s.roleBtn, on && s.roleBtnOn]} onPress={() => setNewRole(r.key)} activeOpacity={0.7}>
                  <Text style={[s.roleTxt, on && { color: '#FFF' }]}>{r.label}</Text>
                  <Text style={[s.roleDesc, on && { color: '#E3F5EF' }]}>{r.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[s.primaryBtn, !puoInvitare && { opacity: 0.5 }]} disabled={!puoInvitare || busy} onPress={handleCreate}>
            {busy ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="key" size={16} color="#FFF" />
                <Text style={s.primaryTxt}>GENERA CODICE INVITO</Text>
              </>
            )}
          </TouchableOpacity>
          {!puoInvitare && <Text style={s.hintWarn}>⚠️ Limite di 3 persone raggiunto. Rimuovi un collaboratore o revoca un codice per crearne uno nuovo.</Text>}
          {err ? <Text style={s.err}>{err}</Text> : null}
        </View>

        {/* Codici attivi non usati */}
        {invites.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>CODICI IN ATTESA</Text>
            {invites.map((inv) => (
              <View key={inv.code} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.code}>{inv.code}</Text>
                  <Text style={s.rowSub}>Ruolo: {inv.role === 'full' ? 'FULL' : 'OPERATIVO'}</Text>
                </View>
                <TouchableOpacity onPress={async () => {
                  const msg = `Usa questo codice per unirti al mio account MarketMate:\n\n${inv.code}`;
                  if (Platform.OS === 'web') { try { await navigator.clipboard.writeText(inv.code); Alert.alert('Copiato', `Codice ${inv.code}`); } catch {} }
                  else { try { await RNShare.share({ message: msg }); } catch {} }
                }} style={s.iconBtn}>
                  <Ionicons name="share-social" size={18} color="#1E7F85" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRevoke(inv.code)} style={s.iconBtn}>
                  <Ionicons name="close-circle" size={22} color="#D46A6A" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Collaboratori attivi */}
        {collaborators.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>COLLABORATORI ATTIVI</Text>
            {collaborators.map((c) => (
              <View key={c.id} style={s.row}>
                <Ionicons name="person-circle" size={28} color="#5A7575" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A4040' }}>{c.email}</Text>
                  <Text style={s.rowSub}>Ruolo: {c.role === 'full' ? 'FULL' : 'OPERATIVO'}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveCollab(c)} style={s.iconBtn}>
                  <Ionicons name="trash" size={18} color="#D46A6A" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {collaborators.length === 0 && invites.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#7A9090', fontStyle: 'italic', marginTop: 20, fontSize: 13 }}>
            Nessun collaboratore ancora invitato.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0D8C0' },
  title: { fontSize: 14, fontWeight: '900', color: '#1A4040', letterSpacing: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E3F5EF', padding: 14, borderRadius: 12, marginBottom: 14 },
  bannerTitle: { fontSize: 15, fontWeight: '900', color: '#1E7F85' },
  bannerSub: { fontSize: 11, color: '#5A7575', marginTop: 2 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 12, fontWeight: '900', color: '#1A4040', letterSpacing: 1, marginBottom: 6 },
  cardHint: { fontSize: 11, color: '#7A9090', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0D8C0', backgroundColor: '#F5EFDC', alignItems: 'center' },
  roleBtnOn: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  roleTxt: { fontSize: 12, fontWeight: '900', color: '#5A7575', letterSpacing: 0.5 },
  roleDesc: { fontSize: 9, color: '#7A9090', marginTop: 3, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E7F85', paddingVertical: 12, borderRadius: 10 },
  primaryTxt: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EBE1' },
  code: { fontSize: 18, fontWeight: '900', color: '#1E7F85', letterSpacing: 3 },
  rowSub: { fontSize: 11, color: '#7A9090', marginTop: 2 },
  iconBtn: { padding: 6 },
  hintWarn: { fontSize: 11, color: '#D4A017', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  err: { color: '#D46A6A', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
