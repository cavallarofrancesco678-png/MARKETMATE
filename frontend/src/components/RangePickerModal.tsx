/**
 * RangePickerModal — Componente condiviso per la selezione periodo.
 *
 * Round 59: estratto dalla pagina Statistiche per uso condiviso in
 *   - Carburante (gas.tsx) → filtro periodo
 *   - SpeseExtraModal → ripartizione costo Fornitori (PERSONALIZZA)
 *   - SpeseExtraModal → ripartizione Spese Generiche (PERSONALIZZA)
 *
 * UX:
 *  • 5 bottoni di periodo: OGGI / SETT. / MESE / ANNO / PERS.
 *  • SETT./MESE/ANNO usano una data di riferimento navigabile (← →)
 *  • PERS. apre un MiniMonthCalendar in rangeMode (tap-tap per da/a)
 *  • OGGI: range = giorno selezionato (default oggi)
 *
 * Su onConfirm restituisce sempre { mode, from, to } in formato ISO YYYY-MM-DD
 * così il chiamante può filtrare il proprio array di dati senza ricalcolare.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MiniMonthCalendar } from './MiniMonthCalendar';

export type RangeMode = 'oggi' | 'sett' | 'mese' | 'anno' | 'pers';

export interface RangeResult {
  mode: RangeMode;
  from: string; // ISO YYYY-MM-DD
  to: string;   // ISO YYYY-MM-DD
  label: string; // etichetta umana da mostrare (es. "11/05 → 17/05")
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (r: RangeResult) => void;
  /** Modalità iniziale (default 'mese') */
  initialMode?: RangeMode;
  /** Per PERS.: range personalizzato preesistente */
  initialFrom?: string;
  initialTo?: string;
  /** Mostra/nasconde bottoni specifici. Default: tutti visibili. */
  enabledModes?: RangeMode[];
  /** Colore tema (default teal MarketMate) */
  themeColor?: string;
  /** Titolo modale (default "Scegli il periodo") */
  title?: string;
}

const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtBreve = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

/** Calcola from/to per la modalità richiesta a partire dalla data di riferimento. */
function computeRange(mode: RangeMode, ref: Date, customFrom?: string, customTo?: string): RangeResult {
  if (mode === 'oggi') {
    const iso = isoOf(ref);
    return { mode, from: iso, to: iso, label: fmtBreve(iso) };
  }
  if (mode === 'sett') {
    const dow = (ref.getDay() + 6) % 7;
    const lun = new Date(ref); lun.setDate(ref.getDate() - dow);
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
    return { mode, from: isoOf(lun), to: isoOf(dom), label: `${fmtBreve(isoOf(lun))} → ${fmtBreve(isoOf(dom))}` };
  }
  if (mode === 'mese') {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return {
      mode, from: isoOf(first), to: isoOf(last),
      label: `${MESI_BREVI[ref.getMonth()]} ${ref.getFullYear()}`,
    };
  }
  if (mode === 'anno') {
    const first = new Date(ref.getFullYear(), 0, 1);
    const last = new Date(ref.getFullYear(), 11, 31);
    return { mode, from: isoOf(first), to: isoOf(last), label: `${ref.getFullYear()}` };
  }
  // pers
  const from = customFrom || isoOf(ref);
  const to = customTo || isoOf(ref);
  return { mode, from, to, label: `${fmtBreve(from)} → ${fmtBreve(to)}` };
}

export const RangePickerModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
  initialMode = 'mese',
  initialFrom,
  initialTo,
  enabledModes = ['oggi', 'sett', 'mese', 'anno', 'pers'],
  themeColor = '#1E7F85',
  title = 'Scegli il periodo',
}) => {
  const [mode, setMode] = useState<RangeMode>(initialMode);
  const [ref, setRef] = useState<Date>(new Date());
  const [persFrom, setPersFrom] = useState<string>(initialFrom || '');
  const [persTo, setPersTo] = useState<string>(initialTo || '');

  // Reset interno quando il modal si apre con una nuova modalità iniziale
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setRef(new Date());
      setPersFrom(initialFrom || '');
      setPersTo(initialTo || '');
    }
  }, [visible, initialMode, initialFrom, initialTo]);

  const currentRange = useMemo(() => computeRange(mode, ref, persFrom, persTo), [mode, ref, persFrom, persTo]);

  const handleNavigate = (direction: -1 | 1) => {
    setRef((prev) => {
      const d = new Date(prev);
      if (mode === 'sett') d.setDate(d.getDate() + 7 * direction);
      else if (mode === 'mese') d.setMonth(d.getMonth() + direction);
      else if (mode === 'anno') d.setFullYear(d.getFullYear() + direction);
      else d.setDate(d.getDate() + direction); // OGGI
      return d;
    });
  };

  const handlePersTap = (iso: string) => {
    // Logica tap-tap: primo tap=from, secondo tap=to (riordinati se necessario)
    if (!persFrom || (persFrom && persTo)) {
      // Inizia un nuovo range
      setPersFrom(iso);
      setPersTo('');
    } else {
      // Completa il range
      if (iso < persFrom) {
        setPersTo(persFrom);
        setPersFrom(iso);
      } else {
        setPersTo(iso);
      }
    }
  };

  const handleConfirm = () => {
    if (mode === 'pers' && (!persFrom || !persTo)) {
      // Auto-completa: se solo un tap, usa stesso giorno
      if (persFrom && !persTo) {
        const r = computeRange('pers', ref, persFrom, persFrom);
        onConfirm(r);
        onClose();
        return;
      }
      // Se nessuno: usa oggi
      const todayIso = isoOf(new Date());
      onConfirm(computeRange('pers', ref, todayIso, todayIso));
      onClose();
      return;
    }
    onConfirm(currentRange);
    onClose();
  };

  // Pre-calcola i giorni evidenziati nel calendario PERS.
  const highlightedIsos = useMemo(() => {
    if (mode !== 'pers' || !persFrom) return [];
    const result: string[] = [persFrom];
    if (persTo && persTo !== persFrom) {
      // Aggiungi tutti i giorni tra from e to inclusi
      const f = new Date(persFrom + 'T00:00:00');
      const t = new Date(persTo + 'T00:00:00');
      const cur = new Date(f);
      while (cur <= t) {
        result.push(isoOf(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return result;
  }, [mode, persFrom, persTo]);

  const persHeader = useMemo(() => {
    if (!persFrom) return '📅 Tocca la data iniziale';
    if (persFrom && !persTo) return '📅 Tocca la data finale';
    return `📅 Range: ${fmtBreve(persFrom)} → ${fmtBreve(persTo)}`;
  }, [persFrom, persTo]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[st.container, { borderColor: themeColor }]}>
          <View style={st.header}>
            <Text style={st.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#5A7575" />
            </TouchableOpacity>
          </View>

          {/* Bottoni modalità */}
          <View style={st.modesRow}>
            {(['oggi', 'sett', 'mese', 'anno', 'pers'] as RangeMode[])
              .filter((m) => enabledModes.includes(m))
              .map((m) => {
                const isActive = mode === m;
                const label = m === 'oggi' ? 'Oggi' : m === 'sett' ? 'Sett.' : m === 'mese' ? 'Mese' : m === 'anno' ? 'Anno' : 'Pers.';
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMode(m)}
                    activeOpacity={0.7}
                    style={[
                      st.modeBtn,
                      { backgroundColor: isActive ? themeColor : '#F5EFDC', borderColor: isActive ? themeColor : '#E0D8C0' },
                    ]}
                  >
                    <Text style={[st.modeTxt, { color: isActive ? '#FFF' : '#5A7575' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>

          {/* Etichetta corrente + navigatori (no PERS.) */}
          {mode !== 'pers' && (
            <View style={st.navRow}>
              <TouchableOpacity onPress={() => handleNavigate(-1)} style={[st.navBtn, { backgroundColor: themeColor }]}>
                <Ionicons name="chevron-back" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={st.labelBox}>
                <Ionicons name="calendar" size={16} color={themeColor} />
                <Text style={st.labelTxt}>{currentRange.label}</Text>
              </View>
              <TouchableOpacity onPress={() => handleNavigate(1)} style={[st.navBtn, { backgroundColor: themeColor }]}>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* PERS.: calendario range */}
          {mode === 'pers' && (
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <Text style={st.persHeader}>{persHeader}</Text>
              <MiniMonthCalendar
                selectedDates={highlightedIsos}
                onToggleDate={handlePersTap}
                rangeMode={false}
                highlightedDates={highlightedIsos}
                themeColor={themeColor}
              />
              {persFrom && persTo && (
                <TouchableOpacity
                  onPress={() => { setPersFrom(''); setPersTo(''); }}
                  style={st.resetBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={14} color="#7A9090" />
                  <Text style={st.resetTxt}>Azzera selezione</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Bottoni azione */}
          <View style={st.actionsRow}>
            <TouchableOpacity onPress={onClose} style={[st.actionBtn, st.cancelBtn]} activeOpacity={0.7}>
              <Text style={st.cancelTxt}>ANNULLA</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={[st.actionBtn, { backgroundColor: themeColor }]} activeOpacity={0.7}>
              <Text style={st.confirmTxt}>CONFERMA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#F5F0E6',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A4040',
    letterSpacing: 0.5,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modeTxt: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0D8C0',
  },
  labelTxt: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A4040',
  },
  persHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A4040',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
  },
  resetTxt: {
    fontSize: 11,
    color: '#7A9090',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#E8E3D5',
  },
  cancelTxt: {
    color: '#5A7575',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  confirmTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default RangePickerModal;
