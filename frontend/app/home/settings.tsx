import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, MercatoAgenda } from '../../src/store/appStore';

/* ─── REUSABLE INPUT MODAL ─── */
const InputModal = ({
  visible,
  title,
  hints,
  onSave,
  onClose,
  keyboardTypes,
}: {
  visible: boolean;
  title: string;
  hints: string[];
  onSave: (values: string[]) => void;
  onClose: () => void;
  keyboardTypes?: string[];
}) => {
  const [values, setValues] = useState<string[]>(hints.map(() => ''));
  const handleSave = () => {
    if (values.every((v) => v.trim() !== '')) {
      onSave(values);
      setValues(hints.map(() => ''));
      onClose();
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.modal}>
          <Text style={ms.modalTitle}>{title}</Text>
          {hints.map((h, i) => (
            <TextInput
              key={i}
              style={ms.modalInput}
              placeholder={h}
              placeholderTextColor="#A0A090"
              value={values[i]}
              onChangeText={(t) => {
                const nv = [...values];
                nv[i] = t;
                setValues(nv);
              }}
              keyboardType={
                (keyboardTypes?.[i] === 'numeric' ? 'numeric' : 'default') as any
              }
              autoFocus={i === 0}
            />
          ))}
          <View style={ms.modalBtns}>
            <TouchableOpacity onPress={onClose} style={ms.modalCancel}>
              <Text style={ms.modalCancelTxt}>ANNULLA</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={ms.modalSave}>
              <Text style={ms.modalSaveTxt}>SALVA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ─── SETTINGS PAGE ─── */
export default function SettingsPage() {
  const store = useAppStore();

  // Local state for dialogs
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    hints: string[];
    keyboardTypes?: string[];
    onSave: (values: string[]) => void;
  }>({ visible: false, title: '', hints: [], onSave: () => {} });

  // Expanded state for agenda days
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // Expanded state for fornitori
  const [expandedForn, setExpandedForn] = useState<number | null>(null);

  const showDialog1 = useCallback(
    (title: string, hint: string, onSave: (v: string) => void) => {
      setModalConfig({
        visible: true,
        title,
        hints: [hint],
        onSave: (vals) => onSave(vals[0]),
      });
    },
    []
  );

  const showDialog2 = useCallback(
    (
      title: string,
      h1: string,
      h2: string,
      onSave: (v1: string, v2: string) => void,
      keyboardTypes?: string[]
    ) => {
      setModalConfig({
        visible: true,
        title,
        hints: [h1, h2],
        keyboardTypes,
        onSave: (vals) => onSave(vals[0], vals[1]),
      });
    },
    []
  );

  const totalePlatAnnui = store.agenda.reduce(
    (s, m) => s + m.p_annuo,
    0
  );
  const totaleSpeseAnnue =
    store.speseAnnue.reduce((s, x) => s + x.importo, 0) + totalePlatAnnui;

  const lingue = ['Italiano', 'English', 'Español', 'Français', 'Deutsch'];

  const updateMercato = (idx: number, field: string, value: any) => {
    const updated = [...store.agenda];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-calc: if p_annuo changes, update p_giornaliero
    if (field === 'p_annuo') {
      updated[idx].p_giornaliero = Math.round(value / 48);
    }
    if (field === 'p_giornaliero') {
      updated[idx].p_annuo = Math.round(value * 48);
    }
    store.updateAgenda(updated);
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>IMPOSTAZIONI</Text>

      {/* ─── 1. LINGUA ─── */}
      <Text style={s.secTitle}>1. LINGUA</Text>
      <View style={s.card}>
        <View style={s.langRow}>
          {lingue.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => store.setConfig({ lingua: l })}
              style={[s.langBtn, store.lingua === l && s.langBtnOn]}
            >
              <Text
                style={[
                  s.langBtnTxt,
                  store.lingua === l && { color: '#FFF' },
                ]}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── 2. IDENTITÀ ─── */}
      <Text style={s.secTitle}>2. IDENTITÀ</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.itemRow}
          onPress={() =>
            showDialog1('Modifica Azienda', 'Nome Azienda', (v) =>
              store.setConfig({ nomeAttivita: v })
            )
          }
        >
          <Ionicons name="storefront" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>Azienda</Text>
            <Text style={s.itemVal}>{store.nomeAttivita}</Text>
          </View>
          <Ionicons name="create-outline" size={18} color="#7A9090" />
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity
          style={s.itemRow}
          onPress={() =>
            showDialog1('Modifica Titolare', 'Nome Titolare', (v) =>
              store.setConfig({ nomeTitolare: v })
            )
          }
        >
          <Ionicons name="person" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>Titolare</Text>
            <Text style={s.itemVal}>
              {store.nomeTitolare || '---'}
            </Text>
          </View>
          <Ionicons name="create-outline" size={18} color="#7A9090" />
        </TouchableOpacity>
      </View>

      {/* ─── 3. OBIETTIVI ─── */}
      <Text style={s.secTitle}>3. OBIETTIVI</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.itemRow}
          onPress={() =>
            showDialog1(
              'Target Mensile',
              'Importo €',
              (v) =>
                store.setConfig({
                  targetMensile: parseFloat(v.replace(',', '.')) || 0,
                })
            )
          }
        >
          <Ionicons name="trending-up" size={20} color="#1E7F85" />
          <View style={s.itemInfo}>
            <Text style={s.itemLabel}>Target Mensile</Text>
            <Text style={s.itemVal}>€{store.targetMensile}</Text>
          </View>
          <Ionicons name="create-outline" size={18} color="#7A9090" />
        </TouchableOpacity>
      </View>

      {/* ─── 4. SETTORE ─── */}
      <Text style={s.secTitle}>4. SETTORE</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>
            {store.isAlimentare ? 'ALIMENTARE' : 'NON ALIMENTARE'}
          </Text>
          <Switch
            value={store.isAlimentare}
            onValueChange={(v) => store.setConfig({ isAlimentare: v })}
            trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* ─── 5. SQUADRA COLLABORATORI ─── */}
      <Text style={s.secTitle}>5. SQUADRA COLLABORATORI</Text>
      {store.collaboratori.map((c, i) => (
        <View key={i} style={s.card}>
          <View style={s.itemRow}>
            <Ionicons name="person-circle" size={22} color="#1E7F85" />
            <View style={s.itemInfo}>
              <Text style={s.itemVal}>{c.nome}</Text>
              <Text style={[s.itemLabel, { color: '#1E7F85' }]}>
                Costo GG: €{c.costo}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                showDialog2(
                  'Modifica Staff',
                  'Nome',
                  'Costo €',
                  (n, cost) => {
                    const updated = [...store.collaboratori];
                    updated[i] = {
                      nome: n,
                      costo: parseFloat(cost.replace(',', '.')) || 0,
                    };
                    store.setConfig({ collaboratori: updated });
                  },
                  ['default', 'numeric']
                )
              }
            >
              <Ionicons name="create-outline" size={18} color="#7A9090" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => store.removeCollaboratore(c.nome)}
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#D46A6A" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          showDialog2(
            'Nuovo Collaboratore',
            'Nome',
            'Costo GG €',
            (n, c) =>
              store.addCollaboratore({
                nome: n,
                costo: parseFloat(c.replace(',', '.')) || 0,
              }),
            ['default', 'numeric']
          )
        }
      >
        <Ionicons name="person-add" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>Nuovo Collaboratore</Text>
      </TouchableOpacity>

      {/* ─── 6. AGENDA MERCATI ─── */}
      <Text style={s.secTitle}>6. AGENDA MERCATI</Text>
      {store.agenda.map((m, idx) => {
        const isOpen = expandedDay === idx;
        return (
          <View key={idx} style={s.card}>
            <TouchableOpacity
              style={s.agendaHeader}
              onPress={() => setExpandedDay(isOpen ? null : idx)}
            >
              <TouchableOpacity
                onPress={() => updateMercato(idx, 'lavorativo', !m.lavorativo)}
                style={[s.checkbox, m.lavorativo && s.checkboxOn]}
              >
                {m.lavorativo && (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                )}
              </TouchableOpacity>
              <Text style={s.agendaDay}>{m.giorno}</Text>
              <Text style={s.agendaMarket}>
                {m.mercato || '---'}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#1E7F85"
              />
            </TouchableOpacity>
            {isOpen && (
              <View style={s.agendaBody}>
                <View style={s.divider} />
                <TouchableOpacity
                  style={s.agendaItem}
                  onPress={() =>
                    showDialog1('Mercato', 'Nome Mercato', (v) =>
                      updateMercato(idx, 'mercato', v)
                    )
                  }
                >
                  <Text style={s.itemLabel}>Mercato</Text>
                  <Text style={s.agendaVal}>
                    {m.mercato || '---'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.agendaItem}
                  onPress={() =>
                    showDialog1('KM A/R', 'Chilometri', (v) =>
                      updateMercato(
                        idx,
                        'km',
                        parseFloat(v.replace(',', '.')) || 0
                      )
                    )
                  }
                >
                  <Text style={s.itemLabel}>KM A/R</Text>
                  <Text style={s.agendaVal}>
                    {m.km || '---'}
                  </Text>
                </TouchableOpacity>
                <View style={s.switchRow}>
                  <Text style={s.itemLabel}>Tipo Plateatico</Text>
                  <Switch
                    value={m.is_plat_annuo}
                    onValueChange={(v) =>
                      updateMercato(idx, 'is_plat_annuo', v)
                    }
                    trackColor={{ false: '#C0D0C8', true: '#1E7F85' }}
                    thumbColor="#FFF"
                  />
                  <Text style={[s.itemLabel, { color: '#1E7F85', fontWeight: '800' }]}>
                    {m.is_plat_annuo ? 'Annuale' : 'Giornaliero'}
                  </Text>
                </View>
                {m.is_plat_annuo ? (
                  <TouchableOpacity
                    style={s.agendaItem}
                    onPress={() =>
                      showDialog1('Plateatico Annuo', 'Importo €', (v) =>
                        updateMercato(
                          idx,
                          'p_annuo',
                          parseFloat(v.replace(',', '.')) || 0
                        )
                      )
                    }
                  >
                    <Text style={s.itemLabel}>Plat. Annuo €</Text>
                    <Text style={s.agendaVal}>{m.p_annuo}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.agendaItem}
                    onPress={() =>
                      showDialog1(
                        'Plateatico Giornaliero',
                        'Importo €',
                        (v) =>
                          updateMercato(
                            idx,
                            'p_giornaliero',
                            parseFloat(v.replace(',', '.')) || 0
                          )
                      )
                    }
                  >
                    <Text style={s.itemLabel}>Plat. Giornaliero €</Text>
                    <Text style={s.agendaVal}>{m.p_giornaliero}</Text>
                  </TouchableOpacity>
                )}
                <Text style={s.agendaHint}>
                  {m.is_plat_annuo
                    ? `Incidenza GG: €${m.p_giornaliero}`
                    : `Totale Annuo: €${m.p_annuo}`}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* ─── 7. FORNITORI ─── */}
      <Text style={s.secTitle}>
        {store.isAlimentare ? '7. FORNITORI E PRODOTTI' : '7. FORNITORI'}
      </Text>
      {store.fornitori.map((f, fi) => {
        const isOpen = expandedForn === fi;
        return (
          <View key={fi} style={s.card}>
            <TouchableOpacity
              style={s.agendaHeader}
              onPress={() => setExpandedForn(isOpen ? null : fi)}
            >
              <Ionicons
                name="cube-outline"
                size={20}
                color="#1E7F85"
              />
              <Text style={[s.agendaDay, { flex: 1 }]}>{f.nome}</Text>
              <TouchableOpacity
                onPress={() => store.removeFornitore(f.nome)}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#D46A6A"
                />
              </TouchableOpacity>
              {store.isAlimentare && (
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#1E7F85"
                  style={{ marginLeft: 8 }}
                />
              )}
            </TouchableOpacity>
            {store.isAlimentare && isOpen && (
              <View style={s.agendaBody}>
                <View style={s.divider} />
                {f.prodotti.map((p, pi) => (
                  <View key={pi} style={s.prodRow}>
                    <Text style={s.itemVal}>{p.nome}</Text>
                    <Text style={[s.itemLabel, { color: '#1E7F85' }]}>
                      €{p.prezzo}/kg
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const updF = [...store.fornitori];
                        updF[fi] = {
                          ...updF[fi],
                          prodotti: updF[fi].prodotti.filter(
                            (_, idx) => idx !== pi
                          ),
                        };
                        store.setConfig({ fornitori: updF });
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#D46A6A"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={s.addBtnSmall}
                  onPress={() =>
                    showDialog2(
                      'Nuovo Prodotto',
                      'Nome',
                      'Prezzo KG',
                      (n, v) => {
                        const updF = [...store.fornitori];
                        updF[fi] = {
                          ...updF[fi],
                          prodotti: [
                            ...updF[fi].prodotti,
                            {
                              nome: n,
                              prezzo:
                                parseFloat(v.replace(',', '.')) || 0,
                            },
                          ],
                        };
                        store.setConfig({ fornitori: updF });
                      },
                      ['default', 'numeric']
                    )
                  }
                >
                  <Ionicons name="add" size={16} color="#1E7F85" />
                  <Text style={s.addBtnSmallTxt}>Nuovo Prodotto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          showDialog1('Nome Fornitore', 'Nome', (v) =>
            store.addFornitore({ nome: v, prodotti: [] })
          )
        }
      >
        <Ionicons name="cube" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>Nuovo Fornitore</Text>
      </TouchableOpacity>

      {/* ─── 8. SPESE ANNUALI ─── */}
      <Text style={s.secTitle}>8. SPESE ANNUALI</Text>
      <View style={s.card}>
        {store.speseAnnue.length === 0 &&
          totalePlatAnnui === 0 && (
            <Text style={s.emptyTxt}>
              Nessun costo inserito
            </Text>
          )}
        {store.speseAnnue.map((sp, i) => (
          <View key={i} style={s.spesaRow}>
            <Text style={s.spesaNome}>{sp.voce}</Text>
            <Text style={s.spesaVal}>€{sp.importo}</Text>
            <TouchableOpacity
              onPress={() => store.removeSpesaAnnua(sp.voce)}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color="#D46A6A"
              />
            </TouchableOpacity>
          </View>
        ))}
        {store.agenda
          .filter((m) => m.p_annuo > 0)
          .map((m, i) => (
            <View key={`p-${i}`} style={s.spesaRow}>
              <Text style={[s.spesaNome, { color: '#7A9090' }]}>
                Plat. Annuale {m.mercato}
              </Text>
              <Text style={[s.spesaVal, { color: '#7A9090' }]}>
                €{m.p_annuo}
              </Text>
              <View style={{ width: 24 }} />
            </View>
          ))}
        {(store.speseAnnue.length > 0 || totalePlatAnnui > 0) && (
          <>
            <View style={s.divider} />
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>TOTALE ANNUALE:</Text>
              <Text style={s.totalVal}>€{totaleSpeseAnnue}</Text>
            </View>
          </>
        )}
      </View>
      <TouchableOpacity
        style={s.addBtn}
        onPress={() =>
          showDialog2(
            'Spesa Annuale',
            'Voce',
            'Importo €',
            (n, v) =>
              store.addSpesaAnnua({
                voce: n,
                importo: parseFloat(v.replace(',', '.')) || 0,
              }),
            ['default', 'numeric']
          )
        }
      >
        <Ionicons name="card" size={18} color="#1E7F85" />
        <Text style={s.addBtnTxt}>Aggiungi Spesa</Text>
      </TouchableOpacity>

      {/* ─── SALVA TUTTO ─── */}
      <TouchableOpacity
        style={s.saveAll}
        onPress={() =>
          Alert.alert('Salvato!', 'Tutte le impostazioni sono state salvate.')
        }
      >
        <Ionicons name="save" size={18} color="#FFF" />
        <Text style={s.saveAllTxt}>SALVA TUTTO</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* ─── Input Modal ─── */}
      <InputModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        hints={modalConfig.hints}
        keyboardTypes={modalConfig.keyboardTypes}
        onSave={modalConfig.onSave}
        onClose={() =>
          setModalConfig((p) => ({ ...p, visible: false }))
        }
      />
    </ScrollView>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8EDE5' },
  content: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 30 },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A3535',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 20,
  },

  secTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A7575',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#EDE8DA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    // @ts-ignore
    boxShadow:
      '4px 4px 10px rgba(160,150,130,0.45), -3px -3px 8px rgba(255,255,250,0.9)',
  },

  divider: {
    height: 1,
    backgroundColor: '#D0C8B8',
    marginVertical: 10,
  },

  /* Item rows */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 11, color: '#7A9090', fontWeight: '600' },
  itemVal: { fontSize: 14, fontWeight: '700', color: '#1A3535' },

  /* Switch */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#1A3535' },

  /* Language */
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0DBC8',
    // @ts-ignore
    boxShadow:
      '2px 2px 6px rgba(155,145,125,0.4), -2px -2px 5px rgba(255,255,250,0.8)',
  },
  langBtnOn: {
    backgroundColor: '#1E7F85',
    // @ts-ignore
    boxShadow:
      '3px 3px 8px rgba(15,60,65,0.45), -2px -2px 5px rgba(45,120,125,0.3)',
  },
  langBtnTxt: { fontSize: 12, fontWeight: '700', color: '#4A3A2A' },

  /* Agenda */
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agendaDay: { fontSize: 13, fontWeight: '700', color: '#1A3535' },
  agendaMarket: {
    flex: 1,
    fontSize: 12,
    color: '#7A9090',
    textAlign: 'right',
    marginRight: 8,
  },
  agendaBody: { paddingTop: 4 },
  agendaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  agendaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E7F85',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  agendaHint: {
    fontSize: 11,
    color: '#7A9090',
    fontStyle: 'italic',
    marginTop: 4,
  },

  /* Checkbox */
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1E7F85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#1E7F85' },

  /* Prodotti */
  prodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },

  /* Add button */
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 4,
  },
  addBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E7F85',
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1E7F85',
    borderRadius: 8,
  },
  addBtnSmallTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E7F85',
  },

  /* Spese */
  spesaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  spesaNome: { flex: 1, fontSize: 13, color: '#1A3535' },
  spesaVal: { fontSize: 14, fontWeight: '700', color: '#1A3535', marginRight: 10 },
  emptyTxt: {
    fontSize: 12,
    color: '#7A9090',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: '800', color: '#1A3535' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#D46A6A' },

  /* Save All */
  saveAll: {
    backgroundColor: '#1A3535',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    // @ts-ignore
    boxShadow:
      '4px 4px 12px rgba(0,0,0,0.3), -2px -2px 6px rgba(50,80,80,0.2)',
  },
  saveAllTxt: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});

/* ─── MODAL STYLES ─── */
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#F0EDE5',
    borderRadius: 20,
    padding: 24,
    // @ts-ignore
    boxShadow: '0px 8px 30px rgba(0,0,0,0.25)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A3535',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#E0DBC8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A3535',
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E0DBC8',
    alignItems: 'center',
  },
  modalCancelTxt: { fontSize: 12, fontWeight: '700', color: '#7A9090' },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E7F85',
    alignItems: 'center',
  },
  modalSaveTxt: { fontSize: 12, fontWeight: '800', color: '#FFF' },
});
