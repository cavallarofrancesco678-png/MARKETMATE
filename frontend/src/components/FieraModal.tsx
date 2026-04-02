import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  luogo: string;
  setLuogo: (v: string) => void;
  km: string;
  setKm: (v: string) => void;
  plateatico: string;
  setPlateatico: (v: string) => void;
}

export const FieraModal: React.FC<Props> = ({
  visible, onClose, luogo, setLuogo, km, setKm, plateatico, setPlateatico,
}) => (
  <Modal visible={visible} transparent animationType="slide">
    <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={st.container}>
        <View style={st.handle} />
        <Text style={st.title}>DETTAGLI FIERA</Text>

        <View style={st.field}>
          <Ionicons name="location" size={18} color="#1E7F85" />
          <View style={st.fieldInner}>
            <Text style={st.label}>Luogo Fiera</Text>
            <TextInput
              style={st.input}
              placeholder="Es: Magenta, Milano..."
              placeholderTextColor="#B0B0A0"
              value={luogo}
              onChangeText={setLuogo}
            />
          </View>
        </View>

        <View style={st.field}>
          <Ionicons name="car" size={18} color="#1E7F85" />
          <View style={st.fieldInner}>
            <Text style={st.label}>Km Andata/Ritorno</Text>
            <TextInput
              style={st.input}
              placeholder="0"
              placeholderTextColor="#B0B0A0"
              keyboardType="numeric"
              value={km}
              onChangeText={setKm}
              selectTextOnFocus
            />
          </View>
        </View>

        <View style={st.field}>
          <Ionicons name="receipt" size={18} color="#1E7F85" />
          <View style={st.fieldInner}>
            <Text style={st.label}>Plateatico ({'\u20AC'})</Text>
            <TextInput
              style={st.input}
              placeholder="0"
              placeholderTextColor="#B0B0A0"
              keyboardType="numeric"
              value={plateatico}
              onChangeText={setPlateatico}
              selectTextOnFocus
            />
          </View>
        </View>

        <TouchableOpacity style={st.confirmBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={st.confirmTxt}>CONFERMA</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  container: {
    backgroundColor: '#D8EDE5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#B0C4BC', borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 16, fontWeight: '900', color: '#1A4040',
    textAlign: 'center', letterSpacing: 1.5, marginBottom: 20,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EDE8DA', borderRadius: 14, padding: 14,
    marginBottom: 12,
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  fieldInner: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', color: '#5A7575', marginBottom: 4 },
  input: {
    fontSize: 16, fontWeight: '800', color: '#1A3535',
    padding: 0, minHeight: 24,
  },
  confirmBtn: {
    backgroundColor: '#1E7F85', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
    // @ts-ignore
    boxShadow: '6px 6px 16px rgba(15,55,60,0.55), -4px -4px 12px rgba(45,120,125,0.35)',
  },
  confirmTxt: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
