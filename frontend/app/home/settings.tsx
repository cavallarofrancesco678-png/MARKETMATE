import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Collaboratore, Fornitore, SpesaAnnua } from '../../src/store/appStore';
import { NeuBox, NeuInset } from '../../src/components/NeuBox';
import { Colors } from '../../src/theme/colors';

const COLORI_TEMA = [
  '#C5A059', // Gold
  '#E57373', // Red
  '#81C784', // Green
  '#64B5F6', // Blue
  '#BA68C8', // Purple
  '#FFB74D', // Orange
];

export default function SettingsScreen() {
  const {
    nomeAttivita,
    nomeTitolare,
    targetMensile,
    isAlimentare,
    themeColor,
    collaboratori,
    fornitori,
    agenda,
    speseAnnue,
    setConfig,
    addCollaboratore,
    removeCollaboratore,
    addFornitore,
    removeFornitore,
    updateAgenda,
    addSpesaAnnua,
    removeSpesaAnnua,
    resetAll,
  } = useAppStore();

  const activeColor = themeColor || Colors.primary;

  // Local state for editing
  const [localNomeAttivita, setLocalNomeAttivita] = useState(nomeAttivita);
  const [localNomeTitolare, setLocalNomeTitolare] = useState(nomeTitolare);
  const [localTarget, setLocalTarget] = useState(targetMensile.toString());
  const [localIsAlimentare, setLocalIsAlimentare] = useState(isAlimentare);

  // Modal states
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [showFornitoreModal, setShowFornitoreModal] = useState(false);
  const [showSpesaModal, setShowSpesaModal] = useState(false);
  const [showMercatoModal, setShowMercatoModal] = useState(false);
  const [selectedMercatoIndex, setSelectedMercatoIndex] = useState(0);

  // New item states
  const [newCollabNome, setNewCollabNome] = useState('');
  const [newCollabCosto, setNewCollabCosto] = useState('');
  const [newFornitoreNome, setNewFornitoreNome] = useState('');
  const [newSpesaVoce, setNewSpesaVoce] = useState('');
  const [newSpesaImporto, setNewSpesaImporto] = useState('');

  // Mercato edit state
  const [editMercato, setEditMercato] = useState('');
  const [editKm, setEditKm] = useState('');
  const [editPlatGG, setEditPlatGG] = useState('');
  const [editPlatAnnuo, setEditPlatAnnuo] = useState('');
  const [editLavorativo, setEditLavorativo] = useState(false);

  const handleSave = () => {
    setConfig({
      nomeAttivita: localNomeAttivita,
      nomeTitolare: localNomeTitolare,
      targetMensile: parseFloat(localTarget.replace(',', '.')) || 3000,
      isAlimentare: localIsAlimentare,
    });
    Alert.alert('Salvato!', 'Impostazioni salvate con successo');
  };

  const handleAddCollab = () => {
    if (!newCollabNome.trim()) return;
    addCollaboratore({
      nome: newCollabNome,
      costo: parseFloat(newCollabCosto.replace(',', '.')) || 0,
    });
    setNewCollabNome('');
    setNewCollabCosto('');
    setShowCollabModal(false);
  };

  const handleAddFornitore = () => {
    if (!newFornitoreNome.trim()) return;
    addFornitore({
      nome: newFornitoreNome,
      prodotti: [],
    });
    setNewFornitoreNome('');
    setShowFornitoreModal(false);
  };

  const handleAddSpesa = () => {
    if (!newSpesaVoce.trim()) return;
    addSpesaAnnua({
      voce: newSpesaVoce,
      importo: parseFloat(newSpesaImporto.replace(',', '.')) || 0,
    });
    setNewSpesaVoce('');
    setNewSpesaImporto('');
    setShowSpesaModal(false);
  };

  const openMercatoEdit = (index: number) => {
    const m = agenda[index];
    setSelectedMercatoIndex(index);
    setEditMercato(m.mercato);
    setEditKm(m.km.toString());
    setEditPlatGG(m.p_giornaliero.toString());
    setEditPlatAnnuo(m.p_annuo.toString());
    setEditLavorativo(m.lavorativo);
    setShowMercatoModal(true);
  };

  const handleSaveMercato = () => {
    const updated = [...agenda];
    updated[selectedMercatoIndex] = {
      ...updated[selectedMercatoIndex],
      mercato: editMercato,
      km: parseFloat(editKm.replace(',', '.')) || 0,
      p_giornaliero: parseFloat(editPlatGG.replace(',', '.')) || 0,
      p_annuo: parseFloat(editPlatAnnuo.replace(',', '.')) || 0,
      lavorativo: editLavorativo,
    };
    updateAgenda(updated);
    setShowMercatoModal(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset App',
      'Sei sicuro di voler cancellare tutti i dati?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetAll },
      ]
    );
  };

  const totaleAnnuo = speseAnnue.reduce((sum, s) => sum + s.importo, 0) +
    agenda.reduce((sum, m) => sum + m.p_annuo, 0);

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  const InputItem = ({ label, value, onChangeText, icon }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    icon: string;
  }) => (
    <View style={styles.inputItem}>
      <View style={styles.inputLabel}>
        <Ionicons name={icon as any} size={20} color={activeColor} />
        <Text style={styles.inputLabelText}>{label}</Text>
      </View>
      <NeuInset>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onBlur={handleSave}
        />
      </NeuInset>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>SETTING PRO</Text>

        {/* 1. IDENTITÀ */}
        <SectionTitle title="1. IDENTITÀ" />
        <NeuBox style={styles.section}>
          <InputItem
            label="Azienda"
            value={localNomeAttivita}
            onChangeText={setLocalNomeAttivita}
            icon="storefront"
          />
          <InputItem
            label="Titolare"
            value={localNomeTitolare}
            onChangeText={setLocalNomeTitolare}
            icon="person"
          />
        </NeuBox>

        {/* 2. OBIETTIVI */}
        <SectionTitle title="2. OBIETTIVI" />
        <NeuBox style={styles.section}>
          <InputItem
            label="Target Mensile €"
            value={localTarget}
            onChangeText={setLocalTarget}
            icon="trending-up"
          />
        </NeuBox>

        {/* 3. SETTORE */}
        <SectionTitle title="3. SETTORE" />
        <NeuBox style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {localIsAlimentare ? 'ALIMENTARE' : 'NON ALIMENTARE'}
            </Text>
            <Switch
              value={localIsAlimentare}
              onValueChange={(v) => {
                setLocalIsAlimentare(v);
                setConfig({ isAlimentare: v });
              }}
              trackColor={{ false: Colors.grey, true: activeColor }}
              thumbColor={Colors.white}
            />
          </View>
        </NeuBox>

        {/* 4. SQUADRA */}
        <SectionTitle title="4. SQUADRA COLLABORATORI" />
        {collaboratori.map((c) => (
          <NeuBox key={c.nome} style={styles.listItem}>
            <View style={styles.listItemContent}>
              <Ionicons name="person" size={20} color={activeColor} />
              <Text style={styles.listItemText}>{c.nome}</Text>
              <Text style={styles.listItemValue}>€{c.costo}/gg</Text>
            </View>
            <TouchableOpacity onPress={() => removeCollaboratore(c.nome)}>
              <Ionicons name="trash" size={20} color={Colors.rosso} />
            </TouchableOpacity>
          </NeuBox>
        ))}
        <TouchableOpacity onPress={() => setShowCollabModal(true)}>
          <NeuBox style={styles.addButton}>
            <Ionicons name="person-add" size={20} color={activeColor} />
            <Text style={[styles.addButtonText, { color: activeColor }]}>
              Nuovo Collaboratore
            </Text>
          </NeuBox>
        </TouchableOpacity>

        {/* 5. AGENDA */}
        <SectionTitle title="5. AGENDA MERCATI" />
        {agenda.map((m, i) => (
          <TouchableOpacity key={m.giorno} onPress={() => openMercatoEdit(i)}>
            <NeuBox style={styles.mercatoItem}>
              <View style={styles.mercatoHeader}>
                <Text style={[styles.mercatoGiorno, m.lavorativo && { color: activeColor }]}>
                  {m.giorno}
                </Text>
                {m.lavorativo && (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.verde} />
                )}
              </View>
              <Text style={styles.mercatoNome}>{m.mercato || 'Non impostato'}</Text>
              {m.mercato && (
                <Text style={styles.mercatoDetails}>
                  {m.km} km | Plat: €{m.p_giornaliero}/gg
                </Text>
              )}
            </NeuBox>
          </TouchableOpacity>
        ))}

        {/* 6. FORNITORI */}
        <SectionTitle title="6. FORNITORI" />
        {fornitori.map((f) => (
          <NeuBox key={f.nome} style={styles.listItem}>
            <View style={styles.listItemContent}>
              <Ionicons name="car" size={20} color={activeColor} />
              <Text style={styles.listItemText}>{f.nome}</Text>
            </View>
            <TouchableOpacity onPress={() => removeFornitore(f.nome)}>
              <Ionicons name="trash" size={20} color={Colors.rosso} />
            </TouchableOpacity>
          </NeuBox>
        ))}
        <TouchableOpacity onPress={() => setShowFornitoreModal(true)}>
          <NeuBox style={styles.addButton}>
            <Ionicons name="add-circle" size={20} color={activeColor} />
            <Text style={[styles.addButtonText, { color: activeColor }]}>
              Nuovo Fornitore
            </Text>
          </NeuBox>
        </TouchableOpacity>

        {/* 7. SPESE ANNUALI */}
        <SectionTitle title="7. SPESE ANNUALI" />
        <NeuBox style={styles.section}>
          {speseAnnue.map((s) => (
            <View key={s.voce} style={styles.spesaRow}>
              <Text style={styles.spesaVoce}>{s.voce}</Text>
              <Text style={styles.spesaImporto}>€{s.importo}</Text>
              <TouchableOpacity onPress={() => removeSpesaAnnua(s.voce)}>
                <Ionicons name="close-circle" size={20} color={Colors.rosso} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>TOTALE ANNUALE:</Text>
            <Text style={styles.totaleValue}>€ {totaleAnnuo.toFixed(0)}</Text>
          </View>
        </NeuBox>
        <TouchableOpacity onPress={() => setShowSpesaModal(true)}>
          <NeuBox style={styles.addButton}>
            <Ionicons name="card" size={20} color={activeColor} />
            <Text style={[styles.addButtonText, { color: activeColor }]}>
              Aggiungi Spesa
            </Text>
          </NeuBox>
        </TouchableOpacity>

        {/* 8. TEMA COLORE */}
        <SectionTitle title="8. TEMA COLORE" />
        <NeuBox style={styles.section}>
          <View style={styles.colorsRow}>
            {COLORI_TEMA.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setConfig({ themeColor: c })}
              >
                <View
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    themeColor === c && styles.colorSelected,
                  ]}
                >
                  {themeColor === c && (
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </NeuBox>

        {/* Reset */}
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <Text style={styles.resetText}>RESET COMPLETO APP</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODALS */}
      {/* Collaboratore Modal */}
      <Modal visible={showCollabModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuovo Collaboratore</Text>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Nome"
                value={newCollabNome}
                onChangeText={setNewCollabNome}
                style={styles.modalInputText}
              />
            </NeuInset>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Costo GG €"
                value={newCollabCosto}
                onChangeText={setNewCollabCosto}
                keyboardType="numeric"
                style={styles.modalInputText}
              />
            </NeuInset>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCollabModal(false)}>
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddCollab}>
                <Text style={[styles.modalConfirm, { color: activeColor }]}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>

      {/* Fornitore Modal */}
      <Modal visible={showFornitoreModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuovo Fornitore</Text>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Nome Fornitore"
                value={newFornitoreNome}
                onChangeText={setNewFornitoreNome}
                style={styles.modalInputText}
              />
            </NeuInset>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowFornitoreModal(false)}>
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddFornitore}>
                <Text style={[styles.modalConfirm, { color: activeColor }]}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>

      {/* Spesa Modal */}
      <Modal visible={showSpesaModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuova Spesa Annuale</Text>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Voce (es: Assicurazione)"
                value={newSpesaVoce}
                onChangeText={setNewSpesaVoce}
                style={styles.modalInputText}
              />
            </NeuInset>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Importo €"
                value={newSpesaImporto}
                onChangeText={setNewSpesaImporto}
                keyboardType="numeric"
                style={styles.modalInputText}
              />
            </NeuInset>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowSpesaModal(false)}>
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddSpesa}>
                <Text style={[styles.modalConfirm, { color: activeColor }]}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>

      {/* Mercato Edit Modal */}
      <Modal visible={showMercatoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <NeuBox style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {agenda[selectedMercatoIndex]?.giorno}
            </Text>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Nome Mercato"
                value={editMercato}
                onChangeText={setEditMercato}
                style={styles.modalInputText}
              />
            </NeuInset>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="KM A/R"
                value={editKm}
                onChangeText={setEditKm}
                keyboardType="numeric"
                style={styles.modalInputText}
              />
            </NeuInset>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Plateatico Giornaliero €"
                value={editPlatGG}
                onChangeText={setEditPlatGG}
                keyboardType="numeric"
                style={styles.modalInputText}
              />
            </NeuInset>
            <NeuInset style={styles.modalInput}>
              <TextInput
                placeholder="Plateatico Annuale €"
                value={editPlatAnnuo}
                onChangeText={setEditPlatAnnuo}
                keyboardType="numeric"
                style={styles.modalInputText}
              />
            </NeuInset>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Giorno Lavorativo</Text>
              <Switch
                value={editLavorativo}
                onValueChange={setEditLavorativo}
                trackColor={{ false: Colors.grey, true: activeColor }}
                thumbColor={Colors.white}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowMercatoModal(false)}>
                <Text style={styles.modalCancel}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveMercato}>
                <Text style={[styles.modalConfirm, { color: activeColor }]}>Salva</Text>
              </TouchableOpacity>
            </View>
          </NeuBox>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.marrone,
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
    marginTop: 20,
    marginBottom: 10,
  },
  section: {
    marginBottom: 10,
  },
  inputItem: {
    marginBottom: 15,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.marrone,
  },
  input: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
    padding: 5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.marrone,
  },
  listItemValue: {
    fontSize: 12,
    color: Colors.grey,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  mercatoItem: {
    marginBottom: 10,
  },
  mercatoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mercatoGiorno: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.grey,
  },
  mercatoNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  mercatoDetails: {
    fontSize: 12,
    color: Colors.grey,
  },
  spesaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  spesaVoce: {
    flex: 1,
    fontSize: 14,
    color: Colors.marrone,
  },
  spesaImporto: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
    marginRight: 10,
  },
  totaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.shadowDark,
    paddingTop: 10,
    marginTop: 10,
  },
  totaleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.marrone,
  },
  totaleValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.rosso,
  },
  colorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Colors.white,
  },
  resetButton: {
    marginTop: 30,
    padding: 15,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.rosso,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.marrone,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    marginBottom: 15,
  },
  modalInputText: {
    fontSize: 16,
    color: Colors.marrone,
    padding: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.grey,
    fontWeight: '600',
  },
  modalConfirm: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
