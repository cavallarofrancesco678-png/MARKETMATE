/**
 * ═══════════════════════════════════════════════════════════════════════
 *  proporzionaleFornitori.ts — Algoritmo di distribuzione costo merce
 * ═══════════════════════════════════════════════════════════════════════
 *
 * REGOLA UTENTE (Ordine di Lavoro 2026-05-09, opzione 1A):
 *   "L'app non divide il costo per il numero di giorni (es. 500€/6 giorni).
 *    L'app ricalcola il costo giornaliero (Costo Merce) basandosi sul
 *    coefficiente di RICARICO MEDIO FORNITORE … e proporzionalmente al
 *    LORDO (Incasso Totale) registrato per quel giorno."
 *
 *   "Il totale delle spese merci a fine periodo sarà esatto e
 *    corrisponderà alla fattura pagata."
 *
 * FORMULA SCELTA (1A — distribuzione esatta):
 *   per ogni giornata `g` del periodo:
 *     costoMerce_g = (lordo_g / Σ_lordi_periodo) × FATTURA_PERIODO
 *
 * Proprietà:
 *   - Σ(costoMerce_g) = FATTURA_PERIODO  → totale esatto della fattura
 *   - giorni con lordo alto ricevono PIÙ costo → margine % stabile
 *   - giorni con lordo zero ricevono COSTO ZERO → no detrazioni
 *   - se Σ_lordi = 0 → fallback uguale ripartizione su giorni "in piazza"
 *
 * ENTITÀ DEL PERIODO:
 *   - WEEKLY → ISO week (lunedì-domenica) della giornata
 *   - MONTHLY → mese di calendario della giornata
 *   - DAILY → il singolo giorno (no spalmatura)
 *
 * Il `ricaricoMedio` del fornitore NON entra in questa formula; serve solo
 * come driver per i prezzi di vendita suggeriti nel SupplierSettings
 * (prodotto-per-prodotto). La distribuzione del costo si basa SOLO sul
 * lordo effettivo e sull'importo della fattura.
 */

import type { Giornata } from '../store/appStore';

// ─────────────────────────────────────────────────────────────────────
// ISO Week helpers — usato per raggruppare le giornate WEEKLY
// ─────────────────────────────────────────────────────────────────────
export function isoWeekKey(d: Date | string): string {
  const date = d instanceof Date ? new Date(d) : new Date(d);
  // ISO: anno-W## (lunedì come primo giorno)
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // 0=Lun,…6=Dom
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = Math.ceil(((target.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(d: Date | string): string {
  const date = d instanceof Date ? new Date(d) : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────
// Tipo: voce fornitore con flag di periodicità
// ─────────────────────────────────────────────────────────────────────
export type DeductionMode = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface VoceFornitorePeriodo {
  /** Nome del fornitore (es. "Andrea Pane") */
  fornitore: string;
  /** Importo della fattura per il periodo (€) */
  importo: number;
  /** Modalità: DAILY = giorno singolo; WEEKLY = settimana; MONTHLY = mese */
  mode: DeductionMode;
  /** Data ANCORA: il giorno in cui l'utente ha registrato la fattura */
  data: Date;
}

// ─────────────────────────────────────────────────────────────────────
// CORE: distribuzione proporzionale di una singola fattura periodica
// ─────────────────────────────────────────────────────────────────────
/**
 * Distribuisce `importoFattura` sui giorni di `giornatePeriodo` in base al
 * loro `lordo`. Restituisce una mappa { 'YYYY-MM-DD': costoQuota }.
 *
 * @param giornatePeriodo  Giornate appartenenti al periodo (settimana o mese)
 * @param importoFattura   Importo totale della fattura (€)
 */
export function distribuisciFatturaProporzionalmente(
  giornatePeriodo: Giornata[],
  importoFattura: number
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(giornatePeriodo) || giornatePeriodo.length === 0 || importoFattura <= 0) {
    return out;
  }
  const lordoTotale = giornatePeriodo.reduce((acc, g) => acc + (g.lordo || 0), 0);

  if (lordoTotale > 0) {
    // ── Caso normale: distribuzione proporzionale al lordo ──
    giornatePeriodo.forEach((g) => {
      const k = new Date(g.data).toISOString().slice(0, 10);
      const quota = ((g.lordo || 0) / lordoTotale) * importoFattura;
      out[k] = (out[k] || 0) + quota;
    });
  } else {
    // ── Fallback: nessun lordo ancora → divisione equa SOLO sui giorni
    //    in cui l'utente è andato a lavoro (inPiazza). Se nemmeno
    //    inPiazza è valorizzato, dividi per tutti i giorni del periodo. ──
    const gioPiazza = giornatePeriodo.filter((g) => g.inPiazza !== false);
    const denom = gioPiazza.length > 0 ? gioPiazza.length : giornatePeriodo.length;
    const quota = importoFattura / denom;
    (gioPiazza.length > 0 ? gioPiazza : giornatePeriodo).forEach((g) => {
      const k = new Date(g.data).toISOString().slice(0, 10);
      out[k] = (out[k] || 0) + quota;
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// AGGREGATO: per tutte le giornate di un set, calcola il costo merce
// proporzionale considerando TUTTE le fatture WEEKLY e MONTHLY presenti.
// ─────────────────────────────────────────────────────────────────────
/**
 * Per ogni giornata, calcola la sua quota di costo merce sommando:
 *   - WEEKLY: distribuzione su tutti i giorni della stessa ISO week
 *   - MONTHLY: distribuzione su tutti i giorni dello stesso mese
 *   - DAILY: importo intero sulla giornata stessa
 *
 * Attenzione: una fattura "WEEKLY" può essere registrata in QUALUNQUE giorno
 * della settimana; lo distribuiamo comunque sull'intera settimana. Idem
 * "MONTHLY".
 *
 * @param tutteLeGiornate  Tutte le giornate disponibili nello storico
 * @returns Mappa: 'YYYY-MM-DD' → costoMerceProporzionaleTotale
 */
export function calcolaCostoMerceProporzionale(
  tutteLeGiornate: Giornata[]
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(tutteLeGiornate)) return out;

  // Indici per ricerca rapida
  const byWeek: Record<string, Giornata[]> = {};
  const byMonth: Record<string, Giornata[]> = {};
  tutteLeGiornate.forEach((g) => {
    const wk = isoWeekKey(g.data);
    const mo = monthKey(g.data);
    (byWeek[wk] = byWeek[wk] || []).push(g);
    (byMonth[mo] = byMonth[mo] || []).push(g);
  });

  // Estrai TUTTE le voci fornitore con la loro modalità di detrazione
  // e raggruppa per (fornitore, periodKey, mode) per evitare di
  // distribuire DUE volte la stessa fattura — l'utente potrebbe aver
  // re-inserito la stessa fattura su giornate diverse della stessa
  // settimana (in quel caso vince l'ULTIMA registrazione).
  type Bucket = { fornitore: string; mode: DeductionMode; periodKey: string; importo: number; data: Date };
  const buckets = new Map<string, Bucket>();

  tutteLeGiornate.forEach((g) => {
    const det = g.dettaglio_fornitori || {};
    const ded = g.dettaglio_fornitori_deduction || {};
    Object.entries(det).forEach(([nomeForn, importo]) => {
      const imp = Number(importo) || 0;
      if (imp <= 0) return;
      // Skippa le sotto-chiavi tecniche tipo "__libera"
      if (nomeForn.includes('__libera')) return;

      const mode: DeductionMode = (ded[nomeForn] as DeductionMode) || 'DAILY';
      let periodKey: string;
      if (mode === 'WEEKLY') periodKey = `${nomeForn}|W|${isoWeekKey(g.data)}`;
      else if (mode === 'MONTHLY') periodKey = `${nomeForn}|M|${monthKey(g.data)}`;
      else periodKey = `${nomeForn}|D|${new Date(g.data).toISOString().slice(0, 10)}`;

      const existing = buckets.get(periodKey);
      // Per WEEKLY/MONTHLY tieni la registrazione PIÙ RECENTE (ultima
      // ipotesi: la fattura definitiva è quella inserita per ultima)
      if (!existing || new Date(g.data).getTime() >= existing.data.getTime()) {
        buckets.set(periodKey, { fornitore: nomeForn, mode, periodKey, importo: imp, data: new Date(g.data) });
      }
    });
  });

  // Ora distribuisci ogni bucket
  buckets.forEach((b) => {
    if (b.mode === 'DAILY') {
      const k = new Date(b.data).toISOString().slice(0, 10);
      out[k] = (out[k] || 0) + b.importo;
      return;
    }
    const periodGiornate = b.mode === 'WEEKLY' ? byWeek[isoWeekKey(b.data)] : byMonth[monthKey(b.data)];
    if (!periodGiornate || periodGiornate.length === 0) return;
    const quote = distribuisciFatturaProporzionalmente(periodGiornate, b.importo);
    Object.entries(quote).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER UI: prezzo suggerito per un prodotto dato costo + ricarico %
// ─────────────────────────────────────────────────────────────────────
/**
 * @param costo €/unità  (es. 2.50)
 * @param ricaricoMedio % (es. 70)
 * @returns prezzo di vendita suggerito (es. 4.25)
 */
export function calcolaPrezzoSuggerito(costo: number, ricaricoMedio: number): number {
  const c = Number(costo) || 0;
  const r = Number(ricaricoMedio) || 0;
  if (c <= 0) return 0;
  return Math.round(c * (1 + r / 100) * 100) / 100;
}
