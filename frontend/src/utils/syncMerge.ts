/**
 * ═══════════════════════════════════════════════════════════════════════
 *  syncMerge.ts — utility condivise per il merge dei dati Cloud → Local
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Queste funzioni vengono usate da:
 *   - /app/index.tsx (silent admin login + pull all'avvio)
 *   - /app/home/index.tsx (polling 30s mentre l'utente naviga)
 *   - /app/welcome.tsx (collab join → primo pull dopo aver inserito codice)
 *
 * Strategia generale:
 *  - Per gli ARRAY: union per chiave (cloud aggiorna i record esistenti,
 *    locale tiene quelli non ancora pushati). Niente overwrite cieco.
 *  - Per gli oggetti tipo speseFisseAnnuali: spread merge cloud-wins.
 *  - Difensivo contro dati cloud corrotti (vecchio bug: array salvati
 *    come object con chiavi numeriche). Vedi `ensureArr`.
 */

// ─────────────────────────────────────────────────────────────────────
// Helper defensive: converte object→array se serve, evita .map() crash
// ─────────────────────────────────────────────────────────────────────
export function ensureArr(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    try {
      return Object.values(val).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────
// Helper: union-by-key generico — il cloud aggiorna i record esistenti,
// il locale conserva i record che non sono ancora arrivati al cloud.
// ─────────────────────────────────────────────────────────────────────
export function unionByKey<T = any>(
  cloudArr: any[] | undefined | null,
  localArr: any[] | undefined | null,
  keyOf: (x: any) => string
): T[] {
  const out = new Map<string, any>();
  (Array.isArray(localArr) ? localArr : []).forEach((x) => {
    try { out.set(keyOf(x), x); } catch {}
  });
  (Array.isArray(cloudArr) ? cloudArr : []).forEach((x) => {
    try { out.set(keyOf(x), x); } catch {}
  });
  return Array.from(out.values());
}

// ─────────────────────────────────────────────────────────────────────
// buildSyncMerge — calcola il delta merge da applicare allo store locale
// ─────────────────────────────────────────────────────────────────────
//
// Restituisce un oggetto `merge` con SOLO i campi presenti nel cloud
// (così se il cloud non ha mai pushato `fornitori` non sovrascriviamo
// quelli locali con []).
//
// `local` viene letto SOLO via getState() dallo store: la chiamata
// avviene dentro questa funzione tramite il parametro getter, così la
// logica di merge è 100% disaccoppiata da Zustand e testabile.
export interface SyncableState {
  storicoGiornate?: any[];
  collaboratori?: any[];
  fornitori?: any[];
  fiere?: any[];
  appuntiAgenda?: any[];
  ordiniAgenda?: any[];
  storicoCarburante?: any[];
  storicoScontrini?: any[];
  storicoDiario?: any[];
  codiciInvito?: any[];
  speseFisseAnnuali?: Record<string, any>;
  nomeAttivita?: string;
  nomeTitolare?: string;
  isAlimentare?: boolean;
  lingua?: string;
  dailyBrief?: any;
}

export function buildSyncMerge(cloudData: any, local: SyncableState): Partial<SyncableState> {
  if (!cloudData || typeof cloudData !== 'object') return {};
  const merge: Partial<SyncableState> = {};

  // ── storicoGiornate: union per data (giornata salvata UNA volta al giorno) ──
  if (cloudData.storicoGiornate !== undefined) {
    const cloudArr = ensureArr(cloudData.storicoGiornate);
    merge.storicoGiornate = unionByKey(
      cloudArr,
      local.storicoGiornate || [],
      (g: any) => {
        try {
          return new Date(g.data).toISOString().slice(0, 10);
        } catch {
          return String(g.data);
        }
      }
    );
  }

  // ── Array critici (utente li edita di frequente) — union per nome ──
  if (cloudData.collaboratori !== undefined)
    merge.collaboratori = unionByKey(
      ensureArr(cloudData.collaboratori),
      local.collaboratori || [],
      (x: any) => (x.nome || '').trim().toLowerCase()
    );

  if (cloudData.fornitori !== undefined)
    merge.fornitori = unionByKey(
      ensureArr(cloudData.fornitori),
      local.fornitori || [],
      (x: any) => (x.nome || '').trim().toLowerCase()
    );

  if (cloudData.fiere !== undefined)
    merge.fiere = unionByKey(
      ensureArr(cloudData.fiere),
      local.fiere || [],
      (x: any) => `${(x.nome || '').trim().toLowerCase()}|${x.data || ''}`
    );

  if (cloudData.appuntiAgenda !== undefined)
    merge.appuntiAgenda = unionByKey(
      ensureArr(cloudData.appuntiAgenda),
      local.appuntiAgenda || [],
      (x: any) => x.id || `${x.data}|${(x.testo || '').slice(0, 30)}`
    );

  if (cloudData.ordiniAgenda !== undefined)
    merge.ordiniAgenda = unionByKey(
      ensureArr(cloudData.ordiniAgenda),
      local.ordiniAgenda || [],
      (x: any) => x.id || `${x.data}|${(x.testo || '').slice(0, 30)}`
    );

  if (cloudData.storicoCarburante !== undefined)
    merge.storicoCarburante = unionByKey(
      ensureArr(cloudData.storicoCarburante),
      local.storicoCarburante || [],
      (x: any) => `${x.data || ''}|${x.litri || ''}|${x.euro || ''}`
    );

  if (cloudData.codiciInvito !== undefined)
    merge.codiciInvito = unionByKey(
      ensureArr(cloudData.codiciInvito),
      local.codiciInvito || [],
      (x: any) => x.codice || ''
    );

  // ── storicoDiario / storicoScontrini sono ARRAY nel modello ──
  if (cloudData.storicoDiario !== undefined)
    merge.storicoDiario = unionByKey(
      ensureArr(cloudData.storicoDiario),
      local.storicoDiario || [],
      (x: any) =>
        `${x.data ? new Date(x.data).toISOString().slice(0, 10) : ''}|${(x.testo || '').slice(0, 30)}`
    );

  if (cloudData.storicoScontrini !== undefined)
    merge.storicoScontrini = unionByKey(
      ensureArr(cloudData.storicoScontrini),
      local.storicoScontrini || [],
      (x: any) => `${x.mercato || ''}|${x.data || ''}|${x.numero || ''}`
    );

  // ── speseFisseAnnuali: oggetto Record — spread merge cloud-wins ──
  if (
    cloudData.speseFisseAnnuali &&
    typeof cloudData.speseFisseAnnuali === 'object' &&
    !Array.isArray(cloudData.speseFisseAnnuali)
  ) {
    merge.speseFisseAnnuali = {
      ...(local.speseFisseAnnuali || {}),
      ...cloudData.speseFisseAnnuali,
    };
  }

  return merge;
}
