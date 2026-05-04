/**
 * Permission Gating per i 3 ruoli — MarketMate
 *
 * AMMINISTRATORE = creatore/responsabile legale, controllo totale.
 * MANAGER        = operatività quotidiana, sola scrittura, NIENTE modifiche storiche
 *                  e niente sezioni di configurazione/finanza.
 * UTENTE         = inserimento base (home/carburante/note proprie), niente altro.
 *
 * Tutto il gating UI legge `currentRole` dal appStore tramite l'hook qui sotto.
 */
import { useAppStore } from '../store/appStore';
import type { RuoloUtente } from '../store/appStore';

export interface Permissions {
  role: RuoloUtente;
  isAmm: boolean;
  isManager: boolean;
  isUtente: boolean;

  // Sezioni / tab visibili
  canSeeStats: boolean;        // tab "stats"
  canSeeSettings: boolean;     // tab "settings"
  canSeePremi: boolean;        // tab "premi"
  canSeeAgenda: boolean;       // tab "agenda" (note + ordini + diario): tutti
  canSeeGas: boolean;          // tab "gas": tutti
  canSeeHome: boolean;         // tab "home": tutti

  // Azioni protette
  canEditHistory: boolean;     // modificare/sovrascrivere giornate già salvate (storico)
  canDeleteHistory: boolean;   // eliminare voci storiche
  canEditConfig: boolean;      // modificare nome, lingua, agenda mercati, fornitori, collab, fiere
  canSeeRewards: boolean;      // accesso pagina Premi/Abbonamenti
  canEditFuelHistory: boolean; // modificare/eliminare rifornimenti passati
  canManageInvites: boolean;   // generare/disattivare codici invito
}

export function usePermissions(): Permissions {
  const role = useAppStore((s) => s.currentRole);
  const isAmm = role === 'AMMINISTRATORE';
  const isManager = role === 'MANAGER';
  const isUtente = role === 'UTENTE';

  return {
    role,
    isAmm,
    isManager,
    isUtente,

    // Tabs
    canSeeHome: true,
    canSeeGas: true,
    canSeeAgenda: true,
    canSeeStats: isAmm || isManager,
    canSeeSettings: isAmm,
    canSeePremi: isAmm,

    // Azioni
    canEditHistory: isAmm,
    canDeleteHistory: isAmm,
    canEditConfig: isAmm,
    canSeeRewards: isAmm,
    canEditFuelHistory: isAmm,
    canManageInvites: isAmm,
  };
}

/**
 * Versione non-React (helper sincrono per logiche fuori dai componenti).
 */
export function getPermissions(): Permissions {
  const role = useAppStore.getState().currentRole;
  const isAmm = role === 'AMMINISTRATORE';
  const isManager = role === 'MANAGER';
  const isUtente = role === 'UTENTE';

  return {
    role, isAmm, isManager, isUtente,
    canSeeHome: true,
    canSeeGas: true,
    canSeeAgenda: true,
    canSeeStats: isAmm || isManager,
    canSeeSettings: isAmm,
    canSeePremi: isAmm,
    canEditHistory: isAmm,
    canDeleteHistory: isAmm,
    canEditConfig: isAmm,
    canSeeRewards: isAmm,
    canEditFuelHistory: isAmm,
    canManageInvites: isAmm,
  };
}

/**
 * Etichetta human-readable del ruolo (per banner/indicatori).
 */
export function roleLabel(role: RuoloUtente): string {
  switch (role) {
    case 'AMMINISTRATORE': return 'Amministratore';
    case 'MANAGER': return 'Manager';
    case 'UTENTE': return 'Utente';
    default: return 'Utente';
  }
}
