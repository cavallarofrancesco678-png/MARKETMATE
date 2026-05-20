/**
 * ═══════════════════════════════════════════════════════════════
 *  CALCOLI FINANZIARI — Single Source of Truth (Round 64)
 * ═══════════════════════════════════════════════════════════════
 *
 *  L'utente segnalava un drift continuo fra:
 *    1. UTILE (Home, calcolato in /app/frontend/app/home/index.tsx)
 *    2. NETTO (Statistiche, calcolato in /app/frontend/app/home/stats.tsx)
 *
 *  Le formule erano simili ma divergenti (es. spese fisse calcolate
 *  come / (48 × workdays) vs annuali × (daysInPeriod/365), plateatici proratati
 *  in modo diverso, ecc.). Questo modulo centralizza la matematica
 *  in modo che entrambe le schermate la usino identicamente.
 *
 *  REGOLE GUIDA (rispetto richieste utente):
 *    • Una giornata "lavorativa" = giornata in cui inPiazza !== false
 *    • SPESE RIPARTITE (CUSTOM/WEEKLY/MONTHLY) **NON** vanno sottratte
 *      dall'Utile giornaliero (Home) — sono distribuite sull'intero
 *      periodo che le contiene (Stats).
 *    • Le DAILY (default) sono sottratte interamente nel giorno
 *      di acquisto.
 *    • Le "spese fisse" (assicurazioni, bollo, commercialista, ecc.)
 *      sono annuali ⇒ proratate al giorno con la formula:
 *          quotaGG = (importoAnnuo) / (48 * giorniLavorativiInSettimana)
 *      dove `giorniLavorativiInSettimana` è il numero di entry agenda
 *      con `lavorativo=true` (fallback 6 se nessuna).
 *    • PLATEATICO: se p_giornaliero > 0 → usa quello;
 *      altrimenti se p_annuo > 0 → p_annuo / (48 * giorniLavorativi).
 *      Solo il plateatico del MERCATO DI OGGI viene sommato.
 *    • CARBURANTE: km del giorno × 0.20 €/km (fallback fisso).
 * ═══════════════════════════════════════════════════════════════
 */

export type DeductionMode = 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY';

export interface AgendaItem {
  giorno: string;
  mercato: string;
  km: number;
  p_giornaliero: number;
  p_annuo: number;
  is_plat_annuo?: boolean;
  lavorativo: boolean;
  mediaScontrino?: number;
}

export interface SpesaAnnuaItem {
  voce: string;
  importo: number;
}

export interface GiornataLike {
  data: Date | string;
  mercato?: string;
  km?: number;
  lordo?: number;
  contanti?: number;
  pos?: number;
  spese_extra?: number;
  dettaglio_staff?: Record<string, number>;
  dettaglio_invenduto?: Record<string, number>;
  dettaglio_fornitori?: Record<string, number>;
  dettaglio_fornitori_deduction?: Record<string, DeductionMode>;
  dettaglio_spese_extra?: Record<string, number>;
  inPiazza?: boolean;
}

export interface CtxCalcolo {
  agenda: AgendaItem[];
  speseAnnue: SpesaAnnuaItem[];
  /** Costo fisso €/km usato per il carburante della giornata. Default 0.20 */
  costoPerKm?: number;
  /** Flag macro per escludere intere categorie dal calcolo. */
  exclude?: Partial<Record<
    'speseFisse' | 'collaboratori' | 'speseExtra' | 'fornitori' | 'invenduto' | 'carburante',
    boolean
  >>;
}

/** Numero di giorni di mercato/settimana dichiarati lavorativi in agenda. */
export function getWorkingDaysPerWeek(agenda: AgendaItem[]): number {
  const lav = (Array.isArray(agenda) ? agenda : []).filter((m) => !!m?.lavorativo).length;
  return lav > 0 ? lav : 6;
}

/** Quota giornaliera proratata delle spese annue per UNA singola giornata. */
export function quotaGiornalieraSpeseAnnue(
  speseAnnue: SpesaAnnuaItem[],
  agenda: AgendaItem[],
): number {
  const gg = getWorkingDaysPerWeek(agenda);
  return (speseAnnue || []).reduce((s, sp) => s + (Number(sp?.importo) || 0) / (48 * gg), 0);
}

/** Trova il mercato per il giorno della settimana di `data` (0=Lun..6=Dom). */
export function getMercatoDelGiorno(data: Date, agenda: AgendaItem[]): AgendaItem | undefined {
  if (!Array.isArray(agenda) || agenda.length === 0) return undefined;
  // agenda è 0=LUN..6=DOM. getDay(): 0=DOM..6=SAB. Riconvertiamo.
  const idx = (data.getDay() + 6) % 7;
  return agenda[idx];
}

/** Plateatico giornaliero del mercato di una data specifica. */
export function plateaticoGiornaliero(data: Date, agenda: AgendaItem[]): number {
  const merc = getMercatoDelGiorno(data, agenda);
  if (!merc) return 0;
  if (Number(merc.p_giornaliero) > 0) return Number(merc.p_giornaliero) || 0;
  if (Number(merc.p_annuo) > 0) {
    const gg = getWorkingDaysPerWeek(agenda);
    return Math.round(((Number(merc.p_annuo) || 0) / (48 * gg)) * 100) / 100;
  }
  return 0;
}

/** Costo carburante per la giornata: km giornata × €/km (default 0.20). */
export function carburanteGiornaliero(km: number, costoPerKm: number = 0.20): number {
  return Math.round((Number(km) || 0) * (Number(costoPerKm) || 0));
}

/** Somma collaboratori presenti in `dettaglio_staff`. */
export function totaleCollaboratoriGiornata(g: GiornataLike): number {
  if (!g.dettaglio_staff) return 0;
  return Object.values(g.dettaglio_staff).reduce((s, v) => s + (Number(v) || 0), 0);
}

/** Totale fornitori DAILY della giornata (esclude periodiche già spostate in spesePeriodiche). */
export function totaleFornitoriDailyGiornata(g: GiornataLike): number {
  if (!g.dettaglio_fornitori) return 0;
  const ded = g.dettaglio_fornitori_deduction || {};
  let tot = 0;
  Object.entries(g.dettaglio_fornitori).forEach(([k, v]) => {
    const nomeBase = k.replace(/__libera$/, '').replace(/__fattn$/, '').replace(/__liberaLabel$/, '');
    const mode: DeductionMode = (ded[nomeBase] as DeductionMode) || 'DAILY';
    if (mode === 'DAILY') tot += Number(v) || 0;
  });
  return tot;
}

/** Totale spese extra "DAILY" (le voci in `dettaglio_spese_extra`). */
export function totaleSpeseExtraGiornata(g: GiornataLike): number {
  if (g.dettaglio_spese_extra && Object.keys(g.dettaglio_spese_extra).length > 0) {
    return Object.values(g.dettaglio_spese_extra).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  return Number(g.spese_extra) || 0;
}

/** Totale invenduto (in valore €). */
export function totaleInvendutoGiornata(g: GiornataLike): number {
  if (!g.dettaglio_invenduto) return 0;
  // Il campo `totale` contiene l'importo aggregato; preferito al sum dei singoli.
  if (typeof g.dettaglio_invenduto.totale === 'number') return g.dettaglio_invenduto.totale;
  return Object.entries(g.dettaglio_invenduto)
    .filter(([k]) => k !== 'totale')
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
}

/**
 * Calcola l'UTILE/NETTO GIORNALIERO di una singola giornata.
 *  - Usato in Home (con la giornata "live" attualmente in editing)
 *  - Usato in Stats sommando su tutte le giornate del periodo
 *
 * NOTA: NON include le spese ripartite (CUSTOM/WEEKLY) — quelle vivono
 * in `store.spesePeriodiche` e vanno sottratte SOLO una volta a fine
 * periodo (vedi `aggregaSpesePeriodicheDelPeriodo` in stats.tsx).
 */
export function calcolaUtileGiornata(g: GiornataLike, ctx: CtxCalcolo): {
  lordo: number;
  speseFisse: number;
  collab: number;
  speseExtra: number;
  fornitoriDaily: number;
  invenduto: number;
  carburante: number;
  utile: number;
} {
  const inPiazza = g.inPiazza !== false;
  const dataObj = typeof g.data === 'string' ? new Date(g.data) : g.data;
  const lordo = Number(g.lordo) || 0;
  const exclude = ctx.exclude || {};

  // Spese fisse = annue/proratate + plateatico oggi (solo se in piazza)
  const speseFisse = inPiazza
    ? quotaGiornalieraSpeseAnnue(ctx.speseAnnue, ctx.agenda) + plateaticoGiornaliero(dataObj, ctx.agenda)
    : 0;
  const carburante = inPiazza ? carburanteGiornaliero(g.km || 0, ctx.costoPerKm ?? 0.20) : 0;
  const collab = totaleCollaboratoriGiornata(g);
  const speseExtra = totaleSpeseExtraGiornata(g);
  const fornitoriDaily = totaleFornitoriDailyGiornata(g);
  const invenduto = totaleInvendutoGiornata(g);

  let utile = lordo;
  if (!exclude.speseFisse) utile -= speseFisse;
  if (!exclude.carburante) utile -= carburante;
  if (!exclude.collaboratori) utile -= collab;
  if (!exclude.speseExtra) utile -= speseExtra;
  if (!exclude.fornitori) utile -= fornitoriDaily;
  if (!exclude.invenduto) utile -= invenduto;

  return {
    lordo,
    speseFisse,
    collab,
    speseExtra,
    fornitoriDaily,
    invenduto,
    carburante,
    utile: Math.round(utile),
  };
}

/**
 * Somma utili giornalieri di un periodo. Usato in Stats per il NETTO totale.
 * Le spese ripartite (spesePeriodiche) vanno sottratte separatamente dopo.
 */
export function calcolaUtilePeriodo(giornate: GiornataLike[], ctx: CtxCalcolo): number {
  return giornate.reduce((s, g) => s + calcolaUtileGiornata(g, ctx).utile, 0);
}
