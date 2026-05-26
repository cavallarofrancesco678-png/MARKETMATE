import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { GoogleLoginButton } from '../../src/components/GoogleLoginButton';

export default function AuthLanding() {
  const [mode, setMode] = useState<'choice' | 'login' | 'register' | 'invite'>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeAtt, setNomeAtt] = useState('');
  const [nomeTit, setNomeTit] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const redeemInvite = useAuthStore((s) => s.redeemInvite);

  const doLogin = async () => {
    setErr(''); setBusy(true);
    try { await login(email.trim(), password); router.replace('/home'); }
    catch (e: any) { setErr(String(e?.message || 'Errore')); }
    finally { setBusy(false); }
  };
  const doRegister = async () => {
    setErr(''); setBusy(true);
    try { await register(email.trim(), password, nomeAtt.trim(), nomeTit.trim()); router.replace('/home'); }
    catch (e: any) { setErr(String(e?.message || 'Errore')); }
    finally { setBusy(false); }
  };
  const doRedeem = async () => {
    setErr(''); setBusy(true);
    try { await redeemInvite(code.trim().toUpperCase(), email.trim(), password); router.replace('/home'); }
    catch (e: any) { setErr(String(e?.message || 'Errore')); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => mode === 'choice' ? router.back() : setMode('choice')}>
            <Ionicons name="chevron-back" size={22} color="#1A4040" />
            <Text style={s.backTxt}>{mode === 'choice' ? 'Indietro' : 'Torna alle opzioni'}</Text>
          </TouchableOpacity>

          <View style={s.header}>
            <Text style={s.logo}>MarketMate</Text>
            <Text style={s.tagline}>Account cloud + multi-utente</Text>
          </View>

          {mode === 'choice' && (
            <View style={s.card}>
              <Text style={s.h2}>Scegli come accedere</Text>
              {/* Round 67 — Google OAuth come opzione principale e veloce */}
              <GoogleLoginButton
                onSuccess={() => router.replace('/home')}
                onError={(m) => setErr(m)}
              />
              <View style={s.divider}><Text style={s.dividerTxt}>oppure con email</Text></View>
              <TouchableOpacity style={s.primaryBtn} onPress={() => setMode('register')}>
                <Ionicons name="person-add" size={18} color="#FFF" />
                <Text style={s.primaryTxt}>CREA NUOVO ACCOUNT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={() => setMode('login')}>
                <Ionicons name="log-in" size={18} color="#1E7F85" />
                <Text style={s.secondaryTxt}>HO GIÀ UN ACCOUNT</Text>
              </TouchableOpacity>
              <View style={s.divider}><Text style={s.dividerTxt}>oppure</Text></View>
              <TouchableOpacity style={s.ghostBtn} onPress={() => setMode('invite')}>
                <Ionicons name="key" size={18} color="#B08050" />
                <Text style={s.ghostTxt}>HO UN CODICE INVITO</Text>
              </TouchableOpacity>
              <Text style={s.helpTxt}>Il codice invito ti viene dato dal titolare dell'account.</Text>
              {err ? <Text style={s.err}>{err}</Text> : null}
            </View>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'invite') && (
            <View style={s.card}>
              <Text style={s.h2}>
                {mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea account' : 'Usa codice invito'}
              </Text>

              {mode === 'register' && (
                <>
                  <Text style={s.label}>Nome attività</Text>
                  <TextInput style={s.input} placeholder="Es. Pane Forno Rossi" placeholderTextColor="#B0B0A0" value={nomeAtt} onChangeText={setNomeAtt} autoCapitalize="words" />
                  <Text style={s.label}>Il tuo nome</Text>
                  <TextInput style={s.input} placeholder="Es. Mario" placeholderTextColor="#B0B0A0" value={nomeTit} onChangeText={setNomeTit} autoCapitalize="words" />
                </>
              )}

              {mode === 'invite' && (
                <>
                  <Text style={s.label}>Codice invito</Text>
                  <TextInput style={[s.input, s.codeInput]} placeholder="Es. ABC123DE" placeholderTextColor="#B0B0A0" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={10} />
                </>
              )}

              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} placeholder="tua@email.com" placeholderTextColor="#B0B0A0" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

              <Text style={s.label}>Password {mode === 'login' ? '' : '(min. 6 caratteri)'}</Text>
              <TextInput style={s.input} placeholder="••••••" placeholderTextColor="#B0B0A0" value={password} onChangeText={setPassword} secureTextEntry />

              {err ? <Text style={s.err}>{err}</Text> : null}

              <TouchableOpacity style={s.primaryBtn} disabled={busy} onPress={mode === 'login' ? doLogin : mode === 'register' ? doRegister : doRedeem}>
                {busy ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={s.primaryTxt}>
                    {mode === 'login' ? 'ACCEDI' : mode === 'register' ? 'CREA ACCOUNT' : 'ACCEDI COME COLLABORATORE'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  content: { padding: 20, paddingBottom: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backTxt: { fontSize: 13, color: '#1A4040', fontWeight: '700', marginLeft: 2 },
  header: { alignItems: 'center', marginVertical: 24 },
  logo: { fontSize: 34, fontWeight: '900', color: '#1E7F85', letterSpacing: 1 },
  tagline: { fontSize: 12, color: '#5A7575', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  h2: { fontSize: 17, fontWeight: '900', color: '#1A4040', marginBottom: 16, letterSpacing: 0.5 },
  label: { fontSize: 11, fontWeight: '800', color: '#5A7575', marginTop: 10, marginBottom: 4, letterSpacing: 0.5 },
  input: { backgroundColor: '#F5EFDC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A4040' },
  codeInput: { fontSize: 18, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E7F85', paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  primaryTxt: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.8 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F5EFDC', paddingVertical: 14, borderRadius: 12, marginTop: 10, borderWidth: 1.5, borderColor: '#1E7F85' },
  secondaryTxt: { color: '#1E7F85', fontWeight: '900', fontSize: 14, letterSpacing: 0.8 },
  divider: { alignItems: 'center', marginTop: 12, marginBottom: 6 },
  dividerTxt: { fontSize: 11, color: '#7A9090', fontStyle: 'italic' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF8E7', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#B08050', borderStyle: 'dashed' },
  ghostTxt: { color: '#B08050', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
  helpTxt: { fontSize: 11, color: '#7A9090', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  err: { color: '#D46A6A', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
