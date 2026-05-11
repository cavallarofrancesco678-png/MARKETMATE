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
export type DeductionMode = 'DAILY' | 'CUSTOM' | 'WEEKLY' | 'MONTHLY';

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
// AGGREGATO PER FORNITORE: per ogni fornitore, calcola la quota di
// costo merce distribuita su ciascun giorno. È la primitiva di base:
// il totale per-giorno (`calcolaCostoMerceProporzionale`) è la somma
// di tutte le mappe per-fornitore.
// ─────────────────────────────────────────────────────────────────────
/**
 * Restituisce mappa: { [nomeFornitore]: { 'YYYY-MM-DD': quotaGiornaliera } }.
 *
 * Usata da `stats.tsx` per:
 *   1. visualizzare, dentro l'espansione di ogni fornitore, la
 *      distribuzione "spese extra giornaliera" della sua fattura;
 *   2. addizionare ogni fornitore come voce a sé nell'areogramma
 *      "SPESE EXTRA" (l'utente le vede come spese del singolo fornitore).
 *
 * Le regole di periodicità (DAILY / CUSTOM / WEEKLY legacy / MONTHLY legacy)
 * sono identiche a `calcolaCostoMerceProporzionale`.
 */
export function calcolaCostoMerceProporzionalePerFornitore(
  tutteLeGiornate: Giornata[],
  fornitoriConfig?: Record<string, { mode?: 'DAILY' | 'CUSTOM'; days?: number; startDate?: string }>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!Array.isArray(tutteLeGiornate)) return out;

  // Bucket per evitare di distribuire DUE volte la stessa fattura
  type Bucket = { fornitore: string; mode: DeductionMode; periodKey: string; importo: number; data: Date; days?: number; startDate?: string };
  const buckets = new Map<string, Bucket>();

  // Pre-ordina le giornate per data (servirà per CUSTOM)
  const sortedGiornate = [...tutteLeGiornate].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  tutteLeGiornate.forEach((g) => {
    const det = g.dettaglio_fornitori || {};
    const ded = g.dettaglio_fornitori_deduction || {};
    const dedDays = g.dettaglio_fornitori_days || {};
    Object.entries(det).forEach(([nomeForn, importo]) => {
      const imp = Number(importo) || 0;
      if (imp <= 0) return;
      // Salta le sotto-chiavi tecniche tipo "__fattn", "__liberaLabel" che
      // non contengono importi reali ma solo metadati di UI.
      if (nomeForn.endsWith('__fattn') || nomeForn.endsWith('__liberaLabel')) return;

      // Normalizza il nome base: il modal salva CONTANTI come "Nome__libera"
      // e FATTURA come "Nome". La config (fornitoriConfig, ded, dedDays) usa
      // sempre il nome BASE senza suffisso. Round 39: estraiamo `nomeBase`
      // per la lookup, ma manteniamo `nomeForn` per la chiave del bucket
      // (così CONTANTI e FATTURA dello stesso fornitore generano due bucket
      // separati e i loro importi si SOMMANO correttamente sul fornitore).
      const nomeBase = nomeForn.replace(/__libera$/, '');

      const supplierCfg = fornitoriConfig?.[nomeBase];
      const rawMode = supplierCfg?.mode || (ded[nomeBase] as DeductionMode) || (ded[nomeForn] as DeductionMode) || 'DAILY';
      let mode: DeductionMode;
      let customDays: number | undefined;
      if (rawMode === 'DAILY') {
        mode = 'DAILY';
      } else if (rawMode === 'CUSTOM') {
        mode = 'CUSTOM';
        customDays = supplierCfg?.days || dedDays[nomeBase] || dedDays[nomeForn] || 7;
      } else if (rawMode === 'WEEKLY') {
        mode = 'CUSTOM';
        customDays = supplierCfg?.days || dedDays[nomeBase] || dedDays[nomeForn] || 7;
      } else {
        mode = 'CUSTOM';
        customDays = supplierCfg?.days || dedDays[nomeBase] || dedDays[nomeForn] || 30;
      }

      let periodKey: string;
      if (mode === 'CUSTOM') {
        periodKey = `${nomeForn}|C|${new Date(g.data).toISOString().slice(0, 10)}|${customDays || 7}`;
      } else {
        // DAILY (le legacy WEEKLY/MONTHLY sono state già normalizzate a CUSTOM sopra)
        periodKey = `${nomeForn}|D|${new Date(g.data).toISOString().slice(0, 10)}`;
      }

      const existing = buckets.get(periodKey);
      if (!existing || new Date(g.data).getTime() >= existing.data.getTime()) {
        // ⭐ Round 45 FIX architetturale: la PRIORITÀ dello startDate è:
        //   1. snapshot per-giornata `g.dettaglio_fornitori_startDate[nomeBase]`
        //      (settato al momento della registrazione della fattura — ogni
        //      fattura ha la SUA data di partenza indipendente)
        //   2. config per-supplier `supplierCfg.startDate` (default UI per
        //      nuove fatture — usato come fallback)
        //   3. data della giornata `g.data` (registrazione)
        // Prima vinceva sempre (2), il che faceva sì che cambiare la
        // startDate in Settings DISTRUGGESSE tutte le ripartizioni passate.
        const perGiornataStart = (g as any).dettaglio_fornitori_startDate?.[nomeBase];
        const effectiveStartDate = perGiornataStart || supplierCfg?.startDate;
        buckets.set(periodKey, {
          fornitore: nomeBase,
          mode,
          periodKey,
          importo: imp,
          data: new Date(g.data),
          days: customDays,
          startDate: effectiveStartDate,
        });
      }
    });
  });

  // Distribuisci ogni bucket sul giorno/periodo, accumulando per fornitore
  const addQuota = (forn: string, day: string, val: number) => {
    if (!out[forn]) out[forn] = {};
    out[forn][day] = (out[forn][day] || 0) + val;
  };

  buckets.forEach((b) => {
    if (b.mode === 'DAILY') {
      const k = new Date(b.data).toISOString().slice(0, 10);
      addQuota(b.fornitore, k, b.importo);
      return;
    }
    if (b.mode === 'CUSTOM') {
      const N = Math.max(1, Math.min(365, b.days || 7));
      // Round 39: usa la data di inizio configurata (se presente) altrimenti
      // fallback alla data di registrazione della fattura.
      const startTs = b.startDate
        ? new Date(b.startDate + 'T00:00:00').getTime()
        : new Date(b.data).getTime();
      const endTs = startTs + (N - 1) * 24 * 60 * 60 * 1000;
      const periodGiornate = sortedGiornate.filter((g) => {
        const t = new Date(g.data).getTime();
        return t >= startTs && t <= endTs;
      });
      if (periodGiornate.length === 0) {
        const k = new Date(b.data).toISOString().slice(0, 10);
        addQuota(b.fornitore, k, b.importo);
        return;
      }
      const quote = distribuisciFatturaProporzionalmente(periodGiornate, b.importo);
      Object.entries(quote).forEach(([k, v]) => addQuota(b.fornitore, k, v));
      return;
    }
    // Nessun altro mode possibile: WEEKLY/MONTHLY legacy sono stati normalizzati
    // a CUSTOM nel blocco di parsing iniziale.
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────
// AGGREGATO: per tutte le giornate di un set, calcola il costo merce
// proporzionale considerando TUTTE le fatture WEEKLY/MONTHLY/CUSTOM presenti.
// ─────────────────────────────────────────────────────────────────────
/**
 * Per ogni giornata, calcola la sua quota di costo merce sommando:
 *   - WEEKLY:  distribuzione su tutti i giorni della stessa ISO week
 *   - MONTHLY: distribuzione su tutti i giorni dello stesso mese
 *   - CUSTOM:  distribuzione su N giorni consecutivi a partire dalla
 *              data di registrazione (dove N viene da
 *              `fornitoriDeductionDays[fornitore]` se passato in input,
 *              altrimenti da `g.dettaglio_fornitori_days[fornitore]`).
 *   - DAILY:   importo intero sulla giornata stessa
 *
 * IMPORTANTE — Single source of truth:
 * Se viene passato `fornitoriConfig` (mappa `nome -> {mode, days}`),
 * questo prevale sui valori salvati nella singola giornata. Garantisce
 * che cambiando il periodo da 7 a 3 giorni in Settings/SpeseModal, TUTTE
 * le giornate (anche già salvate) vengano ricalcolate retroattivamente.
 *
 * @param tutteLeGiornate  Tutte le giornate disponibili nello storico
 * @param fornitoriConfig  Override per fornitore (preso da `store.fornitori`)
 * @returns Mappa: 'YYYY-MM-DD' → costoMerceProporzionaleTotale
 */
export function calcolaCostoMerceProporzionale(
  tutteLeGiornate: Giornata[],
  fornitoriConfig?: Record<string, { mode?: 'DAILY' | 'CUSTOM'; days?: number; startDate?: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  // Delega alla primitiva per-fornitore e somma per giornata.
  const perForn = calcolaCostoMerceProporzionalePerFornitore(tutteLeGiornate, fornitoriConfig);
  Object.values(perForn).forEach((daysMap) => {
    Object.entries(daysMap).forEach(([day, amount]) => {
      out[day] = (out[day] || 0) + amount;
    });
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
