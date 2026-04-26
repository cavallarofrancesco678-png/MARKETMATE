/**
 * TutorialOverlay — card modale fluttuante che guida l'utente passo-passo.
 * Supporta input inline che scrivono DIRETTAMENTE nello appStore in tempo reale.
 *
 * UX Update (giugno 2025):
 *  - Niente icone dentro la card
 *  - Niente "tail" / freccia sul fumetto
 *  - Tipografia più grande, border-radius generoso, ombra morbida
 *  - In modalità COMPACT il pop-up si posiziona ADIACENTE al widget target
 *    (sopra o sotto in base alla posizione dell'anchor) usando le coordinate
 *    misurate via getBoundingClientRect, così non copre MAI l'elemento di riferimento.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/tutorialStore';
import { useAppStore } from '../store/appStore';
import { useTutorialLayoutStore } from '../store/tutorialLayoutStore';

const { height: SCREEN_H } = Dimensions.get('window');
const GAP_FROM_ANCHOR = 14; // gap fra widget e fumetto
const ANCHOR_TARGET_TOP = 140; // dove vogliamo che l'anchor finisca dopo lo scroll

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

  // ═══ Feedback aptico leggero ad ogni cambio step ═══
  useEffect(() => {
    if (!active) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
  }, [stepIndex, active]);

  // ═══ AUTO-SCROLL all'anchor + memo posizione per il posizionamento adiacente ═══
  // Doppia strategia:
  //   - WEB: usa `document.querySelector` + scrollIntoView + getBoundingClientRect
  //   - NATIVE (Android/iOS): usa il registry di ref (tutorialLayoutStore),
  //     `measureInWindow` per le coordinate e l'helper di scroll della pagina.
  const [anchorRect, setAnchorRect] = useState<{ top: number; bottom: number; height: number } | null>(null);
  const anchorId = (step as any)?.anchorId as string | undefined;
  const anchorRefs = useTutorialLayoutStore((s) => s.anchorRefs);
  const scrollHelpers = useTutorialLayoutStore((s) => s.scrollHelpers);
  const currentRoute = (step as any)?.route as string | undefined;

  useEffect(() => {
    if (!active || !anchorId) { setAnchorRect(null); return; }
    let cancelled = false;

    if (Platform.OS === 'web') {
      // ────── WEB ──────
      const tryFind = (attemptsLeft: number) => {
        if (cancelled) return;
        try {
          const el: any = (typeof document !== 'undefined') && document.querySelector(`[data-testid="${anchorId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
            requestAnimationFrame(() => {
              if (cancelled) return;
              const r = el.getBoundingClientRect();
              setAnchorRect({ top: r.top, bottom: r.bottom, height: r.height });
              setTimeout(() => {
                if (cancelled) return;
                const r2 = el.getBoundingClientRect();
                setAnchorRect({ top: r2.top, bottom: r2.bottom, height: r2.height });
              }, 250);
            });
            return;
          }
        } catch {}
        if (attemptsLeft > 0) setTimeout(() => tryFind(attemptsLeft - 1), 100);
      };
      setAnchorRect(null);
      tryFind(12);
    } else {
      // ────── NATIVE (Android/iOS) ──────
      const tryFind = async (attemptsLeft: number): Promise<void> => {
        if (cancelled) return;
        const refMap = useTutorialLayoutStore.getState().anchorRefs;
        const ref = refMap[anchorId];
        const helperMap = useTutorialLayoutStore.getState().scrollHelpers;
        const helper = currentRoute ? helperMap[currentRoute] : undefined;

        if (ref && ref.current) {
          // 1. scrolla la ScrollView della pagina così che l'anchor finisca a ANCHOR_TARGET_TOP
          if (helper) {
            try { await helper(ref, ANCHOR_TARGET_TOP); } catch {}
          }
          // 2. misura la posizione attuale on-screen
          const node: any = ref.current;
          if (cancelled) return;
          if (node.measureInWindow) {
            node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
              if (cancelled) return;
              setAnchorRect({ top: y, bottom: y + h, height: h });
              // doppio check dopo che l'animazione di scroll si è assestata
              setTimeout(() => {
                if (cancelled) return;
                const node2: any = useTutorialLayoutStore.getState().anchorRefs[anchorId]?.current;
                node2?.measureInWindow?.((_x2: number, y2: number, _w2: number, h2: number) => {
                  if (cancelled) return;
                  setAnchorRect({ top: y2, bottom: y2 + h2, height: h2 });
                });
              }, 200);
            });
          }
          return;
        }
        if (attemptsLeft > 0) {
          setTimeout(() => tryFind(attemptsLeft - 1), 120);
        }
      };
      setAnchorRect(null);
      tryFind(15);
    }

    return () => { cancelled = true; };
  }, [active, stepIndex, anchorId, currentRoute, anchorRefs, scrollHelpers]);

  // ═══ Misurazione card per evitare uscire fuori schermo ═══
  const [cardH, setCardH] = useState<number>(220);

  // Determina dove dockare il bubble:
  //   regola: PREFERISCI sempre BELOW (sotto l'anchor) — è la modalità più
  //   leggibile (l'utente legge top-to-bottom) — UNLESS lo spazio sotto è
  //   insufficiente, allora dock ABOVE.
  const winH = (Platform.OS === 'web' && typeof window !== 'undefined') ? window.innerHeight : SCREEN_H;
  const dockBelow: boolean | null = (() => {
    if (!anchorRect) return null;
    const spaceBelow = winH - anchorRect.bottom - 8;
    const spaceAbove = anchorRect.top - 8;
    const needed = cardH + GAP_FROM_ANCHOR;
    if (spaceBelow >= needed) return true;       // c'è spazio sotto → preferisci sotto
    if (spaceAbove >= needed) return false;      // sotto non basta ma sopra sì → sopra
    // Né sopra né sotto basta: scegli quello con più spazio
    return spaceBelow >= spaceAbove;
  })();

  // Calcolo top assoluto: sempre ADIACENTE all'anchor
  const adjacentTop: number | null = (() => {
    if (!anchorRect || dockBelow == null) return null;
    if (dockBelow) {
      // bubble subito sotto l'anchor
      const proposed = anchorRect.bottom + GAP_FROM_ANCHOR;
      const maxTop = Math.max(8, winH - cardH - 8);
      return Math.min(Math.max(8, proposed), maxTop);
    } else {
      // bubble subito sopra l'anchor
      const proposed = anchorRect.top - cardH - GAP_FROM_ANCHOR;
      return Math.max(8, proposed);
    }
  })();

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

  if (!active || !step) return null;

  const title = t(`${step.tKey}.title`);
  const body = t(`${step.tKey}.body`);
  const placeholder = t(`${step.tKey}.placeholder`, '');
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  // ═══ Modalità COMPACT (fumetto adiacente al widget) ═══
  // Welcome, multi-input, done restano centrati come modal classico.
  const compactStepIds = new Set([
    'settings_intro', 'agenda_setup', 'fornitori_setup', 'collab_setup', 'spese_fisse_setup',
    'home_calendar', 'home_lordo', 'home_incasso', 'spese_extra_voci',
    'home_stats_box', 'home_salva', 'stats', 'buongiorno',
    'carburante_setup', 'notes_setup',
  ]);
  const isCompact = compactStepIds.has(step.id);

  const Card = (
    <View
      style={isCompact ? s.cardCompact : s.card}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h && Math.abs(h - cardH) > 4) setCardH(h);
      }}
    >
      {/* Header (progress + close) */}
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

      <ScrollView
        style={{ maxHeight: SCREEN_H * (isCompact ? 0.40 : 0.55) }}
        contentContainerStyle={{ padding: isCompact ? 18 : 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.title, isCompact && s.titleCompact]}>{title}</Text>
        <Text style={[s.body, isCompact && s.bodyCompact]}>{body}</Text>

        {/* Multi-field (input + select misti) */}
        {step.type === 'multi' && step.fields && (
          <View style={{ marginTop: 16, gap: 12 }}>
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
                  <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 4 }}>
                    {(f.options || []).map((opt) => {
                      const on = curVal === opt.value;
                      const lbl = opt.labelKey ? t(opt.labelKey) : (opt.label || opt.value);
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.pillOpt, { flex: 1, paddingHorizontal: 4 }, on && s.pillOptOn]}
                          onPress={() => onChange(opt.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.pillTxt, { textAlign: 'center', fontSize: 11 }, on && { color: '#FFF' }]} numberOfLines={1}>{lbl}</Text>
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
      <View style={s.footer}>
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

  // ═══ COMPACT MODE ═══
  if (isCompact) {
    // Se abbiamo le coordinate dell'anchor → posizioniamo il fumetto ADIACENTE.
    // Altrimenti fallback: dock in basso.
    const useAdjacent = adjacentTop != null;
    const adjacentStyle = useAdjacent
      ? { position: 'absolute' as const, top: adjacentTop as number, left: 8, right: 8 }
      : { position: 'absolute' as const, bottom: 70, left: 8, right: 8 };

    // ═══ FIX CRITICO WEB: usiamo position:fixed così il fumetto resta
    // ancorato al viewport e non scorre con la pagina (su web RN→absolute scroll-segue) ═══
    const wrapStyle: any = Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }
      : s.compactWrap;

    return (
      <View pointerEvents="box-none" style={wrapStyle}>
        <View pointerEvents="auto" style={adjacentStyle}>
          {Card}
        </View>
      </View>
    );
  }

  // Modal centrato per: welcome, logistica, done
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
  kbWrap: { width: '100%', maxWidth: 460 },

  /* ═══ Card "comic" stile fumetto ═══ */
  card: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
    borderWidth: 2,
    borderColor: '#1E7F85',
  },
  cardCompact: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
    borderWidth: 2,
    borderColor: '#1E7F85',
  },

  compactWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  header: { paddingTop: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0EBE1', paddingBottom: 10 },
  progressBar: { height: 4, backgroundColor: '#E8E3D5', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1E7F85' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressTxt: { fontSize: 11, color: '#5A7575', fontWeight: '700', letterSpacing: 0.5 },

  title: { fontSize: 22, fontWeight: '900', color: '#1A4040', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },
  titleCompact: { fontSize: 21, textAlign: 'left', marginBottom: 10, fontWeight: '900', lineHeight: 26 },
  body: { fontSize: 15, color: '#3A5555', lineHeight: 22, textAlign: 'center' },
  bodyCompact: { fontSize: 16, textAlign: 'left', lineHeight: 23, color: '#3A5555' },

  input: { backgroundColor: '#F5EFDC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1A4040', borderWidth: 2, borderColor: '#1E7F85' },
  savedHint: { fontSize: 11, color: '#1E7F85', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#1A4040', marginBottom: 6, letterSpacing: 0.5 },
  pillOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F5EFDC', borderWidth: 1.5, borderColor: '#E0D8C0' },
  pillOptOn: { backgroundColor: '#1E7F85', borderColor: '#1E7F85' },
  pillTxt: { fontSize: 12, fontWeight: '700', color: '#5A7575' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0EBE1', backgroundColor: '#FAFAF5' },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  skipTxt: { fontSize: 11, color: '#7A9090', fontWeight: '700', letterSpacing: 0.3 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#1E7F85' },
  backTxt: { fontSize: 12, color: '#1E7F85', fontWeight: '900', marginLeft: 2, letterSpacing: 0.5 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E7F85', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, gap: 4 },
  nextTxt: { fontSize: 13, color: '#FFF', fontWeight: '900', letterSpacing: 0.5 },
});
