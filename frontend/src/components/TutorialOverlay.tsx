/**
 * TutorialOverlay — card modale fluttuante che guida l'utente passo-passo.
 * Supporta input inline che scrivono DIRETTAMENTE nello appStore in tempo reale.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/tutorialStore';
import { useAppStore } from '../store/appStore';

const { height: SCREEN_H } = Dimensions.get('window');

export const TutorialOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { active, stepIndex, nextStep, prevStep, skip, sampleLordo, sampleScontrini, setSampleLordo, setSampleScontrini } = useTutorialStore();
  const appStore = useAppStore();
  const pathname = usePathname();
  const step = TUTORIAL_STEPS[stepIndex];
  const total = TUTORIAL_STEPS.length;

  // Navigate to the step's route automatically if not already there
  useEffect(() => {
    if (!active || !step?.route) return;
    if (pathname !== step.route) {
      router.push(step.route as any);
    }
  }, [active, stepIndex, step?.route, pathname]);

  // Leggi il valore corrente dal store per i campi di input
  const currentFieldValue = (() => {
    if (!step) return '';
    if (step.type === 'input' && step.field) {
      return String((appStore as any)[step.field] || '');
    }
    if (step.type === 'input' && step.sampleField === 'lordo') return sampleLordo;
    if (step.type === 'input' && step.sampleField === 'scontrini') return sampleScontrini;
    return '';
  })();

  const setFieldValue = (val: string) => {
    if (!step) return;
    if (step.type === 'input' && step.field) {
      // Salva LIVE nello appStore tramite setConfig (persiste automaticamente)
      if (appStore.setConfig) {
        appStore.setConfig({ [step.field]: val } as any);
      } else {
        (useAppStore.setState as any)({ [step.field]: val });
        if (appStore.saveToStorage) appStore.saveToStorage();
      }
    } else if (step.sampleField === 'lordo') {
      setSampleLordo(val);
    } else if (step.sampleField === 'scontrini') {
      setSampleScontrini(val);
    }
  };

  const selectedSelectValue = (() => {
    if (!step || step.type !== 'select' || !step.field) return '';
    return String((appStore as any)[step.field] || '');
  })();

  const setSelectValue = (val: string) => {
    if (!step || step.type !== 'select' || !step.field) return;
    if (appStore.setConfig) {
      appStore.setConfig({ [step.field]: val } as any);
    } else {
      (useAppStore.setState as any)({ [step.field]: val });
      if (appStore.saveToStorage) appStore.saveToStorage();
    }
  };

  if (!active || !step) return null;

  const title = t(`${step.tKey}.title`);
  const body = t(`${step.tKey}.body`);
  const placeholder = t(`${step.tKey}.placeholder`, '');
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const iconName = (step.icon || 'information') as any;

  // ═══ Modalità COMPACT (bottom dock) per gli step in cui l'utente
  // deve interagire con la pagina sottostante (Settings, Notes, ecc.) ═══
  // Welcome, multi-input, done restano centrati come modal classico.
  const compactStepIds = new Set([
    'agenda_setup', 'fornitori_setup', 'collab_setup', 'spese_fisse_setup',
    'home_calendar', 'home_lordo', 'home_incasso', 'spese_extra_voci',
    'home_stats_box', 'home_salva', 'stats', 'buongiorno',
    'carburante_setup', 'notes_setup', 'backup_info',
  ]);
  const isCompact = compactStepIds.has(step.id);

  const Card = (
    <View style={isCompact ? s.cardCompact : s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${((stepIndex + 1) / total) * 100}%` }]} />
        </View>
        <View style={s.headerRow}>
          <Text style={s.progressTxt}>{t('tutorial.common.progress', { current: stepIndex + 1, total })}</Text>
          <TouchableOpacity onPress={skip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#5A7575" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ maxHeight: SCREEN_H * (isCompact ? 0.32 : 0.55) }} contentContainerStyle={{ padding: isCompact ? 14 : 18 }} keyboardShouldPersistTaps="handled">
        {!isCompact && (
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name={iconName} size={44} color="#1E7F85" />
          </View>
        )}
        <View style={isCompact ? { flexDirection: 'row', alignItems: 'flex-start', gap: 10 } : {}}>
          {isCompact && (
            <MaterialCommunityIcons name={iconName} size={28} color="#1E7F85" style={{ marginTop: 2 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.title, isCompact && { fontSize: 16, textAlign: 'left', marginBottom: 4 }]}>{title}</Text>
            <Text style={[s.body, isCompact && { fontSize: 12, textAlign: 'left', lineHeight: 17 }]}>{body}</Text>
          </View>
        </View>

        {/* Multi-field (input + select misti) */}
        {step.type === 'multi' && step.fields && (
          <View style={{ marginTop: 14, gap: 12 }}>
            {step.fields.map((f, idx) => {
              const curVal = String((appStore as any)[f.field] || '');
              const onChange = (v: string) => {
                if (appStore.setConfig) appStore.setConfig({ [f.field]: v } as any);
                else { (useAppStore.setState as any)({ [f.field]: v }); appStore.saveToStorage?.(); }
              };
              if (f.type === 'text') {
                return (
                  <View key={idx}>
                    <Text style={s.fieldLabel}>{f.labelKey ? t(f.labelKey) : ''}</Text>
                    <TextInput
                      style={s.input}
                      value={curVal}
                      onChangeText={onChange}
                      placeholder={f.placeholderKey ? t(f.placeholderKey) : ''}
                      placeholderTextColor="#B0B0A0"
                      keyboardType={f.keyboardType || 'default'}
                      autoCapitalize="words"
                      autoFocus={idx === 0}
                    />
                    {curVal.length > 0 && <Text style={s.savedHint}>✅ Salvato</Text>}
                  </View>
                );
              }
              return (
                <View key={idx}>
                  <Text style={s.fieldLabel}>{f.labelKey ? t(f.labelKey) : ''}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(f.options || []).map((opt) => {
                      const on = curVal === opt.value;
                      const lbl = opt.labelKey ? t(opt.labelKey) : (opt.label || opt.value);
                      return (
                        <TouchableOpacity key={opt.value} style={[s.pillOpt, on && s.pillOptOn]} onPress={() => onChange(opt.value)} activeOpacity={0.7}>
                          <Text style={[s.pillTxt, on && { color: '#FFF' }]}>{lbl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={[s.footer, isCompact && { paddingVertical: 8 }]}>
        <TouchableOpacity onPress={skip} style={s.skipBtn} activeOpacity={0.7}>
          <Text style={s.skipTxt}>{t('tutorial.common.skip')}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!isFirst && (
            <TouchableOpacity onPress={prevStep} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color="#1E7F85" />
              <Text style={s.backTxt}>{t('tutorial.common.back')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={nextStep} style={s.nextBtn} activeOpacity={0.7}>
            <Text style={s.nextTxt}>{isLast ? t('tutorial.common.finish') : t('tutorial.common.next')}</Text>
            {!isLast && <Ionicons name="chevron-forward" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ═══ COMPACT MODE: rendering come bottom-sheet absolute ═══
  // (l'utente può interagire con la pagina dietro al tutorial)
  if (isCompact) {
    return (
      <View pointerEvents="box-none" style={s.compactWrap}>
        <View pointerEvents="auto" style={s.compactDock}>
          {Card}
        </View>
      </View>
    );
  }

  // Modal centrato per: welcome, identita, logistica, done
  return (
    <Modal visible={active} transparent animationType="fade" onRequestClose={skip}>
      <View style={s.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kbWrap}>
          {Card}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 64, 64, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  kbWrap: { width: '100%', maxWidth: 420 },
  card: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  cardCompact: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 12, borderTopWidth: 4, borderTopColor: '#1E7F85' },
  compactWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', padding: 8, paddingBottom: 80 },
  compactDock: { width: '100%' },
  header: { paddingTop: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0EBE1', paddingBottom: 10 },
  progressBar: { height: 4, backgroundColor: '#E8E3D5', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1E7F85' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressTxt: { fontSize: 11, color: '#5A7575', fontWeight: '700', letterSpacing: 0.5 },
  iconWrap: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 10, letterSpacing: 0.3 },
  body: { fontSize: 14, color: '#5A7575', lineHeight: 20, textAlign: 'center' },
  input: { backgroundColor: '#F5EFDC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1A4040', borderWidth: 2, borderColor: '#1E7F85' },
  savedHint: { fontSize: 10, color: '#1E7F85', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  optBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5EFDC', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0D8C0' },
  optBtnOn: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  optTxt: { fontSize: 14, color: '#5A7575', fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#1A4040', marginBottom: 6, letterSpacing: 0.5 },
  pillOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F5EFDC', borderWidth: 1.5, borderColor: '#E0D8C0' },
  pillOptOn: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  pillTxt: { fontSize: 12, fontWeight: '700', color: '#5A7575' },
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D2691E', paddingVertical: 14, borderRadius: 12 },
  navBtnTxt: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  skipHint: { fontSize: 11, color: '#7A9090', textAlign: 'center', fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0EBE1', backgroundColor: '#FAFAF5' },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  skipTxt: { fontSize: 11, color: '#7A9090', fontWeight: '700', letterSpacing: 0.3 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#1E7F85' },
  backTxt: { fontSize: 12, color: '#1E7F85', fontWeight: '900', marginLeft: 2, letterSpacing: 0.5 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E7F85', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, gap: 4 },
  nextTxt: { fontSize: 13, color: '#FFF', fontWeight: '900', letterSpacing: 0.5 },
});
