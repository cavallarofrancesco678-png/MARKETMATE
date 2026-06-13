/**
 * Round 68 — Calendario italiano con festività nazionali e chiusure scolastiche
 * regionali. Usato in:
 *   • Calendari (Gas, Agenda, Home) — marker visivi 🔴 festa / 🟡 scuole chiuse
 *   • BuongiornoModal — pre-compilazione domande "calendario chiusure"
 *   • Backend AI — iniettato nel CONTESTO per analisi predittiva (impatto vendite)
 *
 * Le chiusure scolastiche sono per REGIONE (variano tra Lombardia, Veneto,
 * Sicilia, ecc.). Le date sono linee guida 2024-2027 estratte dai calendari
 * scolastici ufficiali delle Regioni. L'AI lato server avvisa comunque sempre
 * di verificare sul portale Regione di riferimento.
 */

export type DayMarker = {
  type: 'holiday' | 'school-closed' | 'patron' | null;
  name?: string;
  color?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO YYYY-MM-DD locale (timezone-safe) */
export const toIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calcolo Pasqua (Gauss/Meeus). Ritorna la data della domenica di Pasqua. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Festività nazionali italiane per un dato anno (date dinamiche per Pasqua). */
export function getItalianHolidays(year: number): { iso: string; name: string; type: 'holiday' }[] {
  const easter = easterSunday(year);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  return [
    { iso: `${year}-01-01`, name: 'Capodanno', type: 'holiday' },
    { iso: `${year}-01-06`, name: 'Epifania', type: 'holiday' },
    { iso: toIso(easter), name: 'Pasqua', type: 'holiday' },
    { iso: toIso(easterMonday), name: 'Pasquetta', type: 'holiday' },
    { iso: `${year}-04-25`, name: 'Festa della Liberazione', type: 'holiday' },
    { iso: `${year}-05-01`, name: 'Festa dei Lavoratori', type: 'holiday' },
    { iso: `${year}-06-02`, name: 'Festa della Repubblica', type: 'holiday' },
    { iso: `${year}-08-15`, name: 'Ferragosto', type: 'holiday' },
    { iso: `${year}-11-01`, name: 'Ognissanti', type: 'holiday' },
    { iso: `${year}-12-08`, name: 'Immacolata Concezione', type: 'holiday' },
    { iso: `${year}-12-25`, name: 'Natale', type: 'holiday' },
    { iso: `${year}-12-26`, name: 'Santo Stefano', type: 'holiday' },
  ];
}

/** Mappa città/comune → regione (sintetica, per ricerca veloce in-app).
 *  Per casi non mappati, l'AI lato server risolverà via geocoding. */
const CITY_TO_REGION: Record<string, string> = {
  // Lombardia
  'milano': 'Lombardia', 'monza': 'Lombardia', 'bergamo': 'Lombardia', 'brescia': 'Lombardia',
  'como': 'Lombardia', 'cremona': 'Lombardia', 'lecco': 'Lombardia', 'lodi': 'Lombardia',
  'mantova': 'Lombardia', 'pavia': 'Lombardia', 'sondrio': 'Lombardia', 'varese': 'Lombardia',
  // Piemonte
  'torino': 'Piemonte', 'asti': 'Piemonte', 'alessandria': 'Piemonte', 'biella': 'Piemonte',
  'cuneo': 'Piemonte', 'novara': 'Piemonte', 'vercelli': 'Piemonte', 'verbania': 'Piemonte',
  // Liguria
  'genova': 'Liguria', 'la spezia': 'Liguria', 'savona': 'Liguria', 'imperia': 'Liguria',
  // Veneto
  'venezia': 'Veneto', 'verona': 'Veneto', 'padova': 'Veneto', 'vicenza': 'Veneto',
  'treviso': 'Veneto', 'rovigo': 'Veneto', 'belluno': 'Veneto',
  // Friuli-Venezia Giulia
  'trieste': 'Friuli-Venezia Giulia', 'udine': 'Friuli-Venezia Giulia',
  'pordenone': 'Friuli-Venezia Giulia', 'gorizia': 'Friuli-Venezia Giulia',
  // Trentino-Alto Adige
  'trento': 'Trentino-Alto Adige', 'bolzano': 'Trentino-Alto Adige',
  // Emilia-Romagna
  'bologna': 'Emilia-Romagna', 'modena': 'Emilia-Romagna', 'parma': 'Emilia-Romagna',
  'reggio emilia': 'Emilia-Romagna', 'ferrara': 'Emilia-Romagna', 'forlì': 'Emilia-Romagna',
  'cesena': 'Emilia-Romagna', 'rimini': 'Emilia-Romagna', 'ravenna': 'Emilia-Romagna',
  'piacenza': 'Emilia-Romagna',
  // Toscana
  'firenze': 'Toscana', 'pisa': 'Toscana', 'siena': 'Toscana', 'lucca': 'Toscana',
  'livorno': 'Toscana', 'arezzo': 'Toscana', 'grosseto': 'Toscana', 'massa': 'Toscana',
  'prato': 'Toscana', 'pistoia': 'Toscana',
  // Marche
  'ancona': 'Marche', 'pesaro': 'Marche', 'macerata': 'Marche', 'ascoli piceno': 'Marche',
  'fermo': 'Marche',
  // Umbria
  'perugia': 'Umbria', 'terni': 'Umbria',
  // Lazio
  'roma': 'Lazio', 'frosinone': 'Lazio', 'latina': 'Lazio', 'rieti': 'Lazio', 'viterbo': 'Lazio',
  // Abruzzo
  "l'aquila": 'Abruzzo', 'pescara': 'Abruzzo', 'teramo': 'Abruzzo', 'chieti': 'Abruzzo',
  // Molise
  'campobasso': 'Molise', 'isernia': 'Molise',
  // Campania
  'napoli': 'Campania', 'salerno': 'Campania', 'caserta': 'Campania', 'avellino': 'Campania',
  'benevento': 'Campania',
  // Puglia
  'bari': 'Puglia', 'lecce': 'Puglia', 'foggia': 'Puglia', 'taranto': 'Puglia',
  'brindisi': 'Puglia', 'andria': 'Puglia',
  // Basilicata
  'potenza': 'Basilicata', 'matera': 'Basilicata',
  // Calabria
  'catanzaro': 'Calabria', 'cosenza': 'Calabria', 'reggio calabria': 'Calabria',
  'crotone': 'Calabria', 'vibo valentia': 'Calabria',
  // Sicilia
  'palermo': 'Sicilia', 'catania': 'Sicilia', 'messina': 'Sicilia', 'siracusa': 'Sicilia',
  'ragusa': 'Sicilia', 'trapani': 'Sicilia', 'agrigento': 'Sicilia', 'enna': 'Sicilia',
  'caltanissetta': 'Sicilia',
  // Sardegna
  'cagliari': 'Sardegna', 'sassari': 'Sardegna', 'oristano': 'Sardegna', 'nuoro': 'Sardegna',
  // Valle d'Aosta
  'aosta': "Valle d'Aosta",
};

export function resolveRegion(cityOrLocation: string | undefined | null): string | null {
  if (!cityOrLocation) return null;
  // Prendi solo la prima parte (es. "Milano, MI" → "milano")
  const norm = cityOrLocation.toLowerCase().split(',')[0].trim();
  return CITY_TO_REGION[norm] || null;
}

/**
 * Calendario scolastico per regione (semplificato — copre tutte le 20 regioni).
 * Per ogni anno scolastico (settembre→giugno) definisco le finestre di chiusura
 * UFFICIALI ricorrenti (vacanze natalizie, carnevale dove applicabile, pasquali,
 * estive). Sono linee guida medie: le scuole singole possono variare di 1-2 gg.
 *
 * Format ranges: array di {from: 'MM-DD', to: 'MM-DD', name: string} (relativi
 * all'anno; le finestre che attraversano fine anno si gestiscono con anno+1).
 */
type ClosureWindow = { fromMonth: number; fromDay: number; toMonth: number; toDay: number; name: string };

const COMMON_CHRISTMAS: ClosureWindow = { fromMonth: 12, fromDay: 23, toMonth: 1, toDay: 6, name: 'Vacanze natalizie' };
const COMMON_SUMMER_GENERIC: ClosureWindow = { fromMonth: 6, fromDay: 11, toMonth: 9, toDay: 11, name: 'Vacanze estive' };

/** Pasqua mobile: ritorna la finestra Giovedì Santo → Martedì di Pasqua. */
function easterClosure(year: number): ClosureWindow {
  const easter = easterSunday(year);
  const giov = new Date(easter); giov.setDate(easter.getDate() - 3);
  const mart = new Date(easter); mart.setDate(easter.getDate() + 2);
  return {
    fromMonth: giov.getMonth() + 1, fromDay: giov.getDate(),
    toMonth: mart.getMonth() + 1, toDay: mart.getDate(),
    name: 'Vacanze pasquali',
  };
}

/** Carnevale (per regioni che lo osservano): lunedì–martedì grasso. */
function carnivalClosure(year: number, days = 2): ClosureWindow {
  const easter = easterSunday(year);
  // Martedì grasso = 47 giorni prima di Pasqua
  const martedi = new Date(easter); martedi.setDate(easter.getDate() - 47);
  const lunedi = new Date(martedi); lunedi.setDate(martedi.getDate() - 1);
  const from = days >= 2 ? lunedi : martedi;
  return {
    fromMonth: from.getMonth() + 1, fromDay: from.getDate(),
    toMonth: martedi.getMonth() + 1, toDay: martedi.getDate(),
    name: 'Vacanze carnevale',
  };
}

/** Restituisce le finestre di chiusura per la regione + anno. */
export function getSchoolClosures(year: number, regione: string | null): ClosureWindow[] {
  const r = (regione || '').toLowerCase();
  const base: ClosureWindow[] = [
    COMMON_CHRISTMAS,
    easterClosure(year),
  ];

  // Estive: varia leggermente per regione (Sud chiude prima, Nord rientra prima)
  if (['sicilia', 'puglia', 'calabria', 'basilicata', 'campania', 'sardegna'].includes(r)) {
    base.push({ fromMonth: 6, fromDay: 8, toMonth: 9, toDay: 12, name: 'Vacanze estive' });
  } else if (['lombardia', 'piemonte', 'liguria', "valle d'aosta", 'veneto', 'friuli-venezia giulia', 'trentino-alto adige'].includes(r)) {
    base.push({ fromMonth: 6, fromDay: 8, toMonth: 9, toDay: 11, name: 'Vacanze estive' });
  } else {
    base.push(COMMON_SUMMER_GENERIC);
  }

  // Carnevale: tipicamente osservato in Veneto, Friuli, Trentino, Emilia (per
  // tradizione), e in molti calendari diocesani lombardi.
  if (['veneto', 'friuli-venezia giulia', 'trentino-alto adige', 'emilia-romagna', 'lombardia'].includes(r)) {
    base.push(carnivalClosure(year, 2));
  } else if (['piemonte', 'liguria', "valle d'aosta", 'toscana', 'umbria', 'marche', 'lazio'].includes(r)) {
    base.push(carnivalClosure(year, 1));
  }

  // Ponte 1° novembre + Immacolata: la scuola in genere chiude se cade vicino al weekend.
  // Lo trattiamo come singoli giorni di festa (già coperti dalle festività nazionali).

  return base;
}

/** Verifica se una data ricade in una finestra (gestisce wrap a fine anno). */
function dateInWindow(year: number, month: number, day: number, w: ClosureWindow): boolean {
  // Costruisci start e end (potrebbero spanare due anni se Natale)
  const from = new Date(w.fromMonth > w.toMonth ? year : year, w.fromMonth - 1, w.fromDay);
  const to = new Date(w.fromMonth > w.toMonth ? year + 1 : year, w.toMonth - 1, w.toDay);
  // Considera anche l'anno scolastico precedente (es. Natale '25 dura fino al 6 gen '26)
  const fromPrev = new Date(w.fromMonth > w.toMonth ? year - 1 : year, w.fromMonth - 1, w.fromDay);
  const toPrev = new Date(w.fromMonth > w.toMonth ? year : year, w.toMonth - 1, w.toDay);
  const target = new Date(year, month - 1, day);
  return (target >= from && target <= to) || (target >= fromPrev && target <= toPrev);
}

/**
 * Marker giornaliero: ritorna il "primo" indicatore rilevante per la data.
 * Priorità: festa nazionale > chiusura scolastica > nessuna.
 */
export function getDayMarker(date: Date, regione?: string | null): DayMarker {
  const year = date.getFullYear();
  const iso = toIso(date);

  // 1) Festa nazionale
  const holidays = getItalianHolidays(year);
  const h = holidays.find(x => x.iso === iso);
  if (h) return { type: 'holiday', name: h.name, color: '#D44343' }; // rosso

  // 2) Chiusura scolastica (può estendersi su due anni per Natale)
  const closures = [...getSchoolClosures(year, regione || null), ...getSchoolClosures(year - 1, regione || null)];
  for (const c of closures) {
    if (dateInWindow(year, date.getMonth() + 1, date.getDate(), c)) {
      // Escludi i weekend dalle "chiusure scolastiche" perché normalmente chiusi
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return { type: null };
      return { type: 'school-closed', name: c.name, color: '#D4A535' }; // giallo
    }
  }

  return { type: null };
}

/** Genera testo compatto per il blocco contestuale dell'AI. */
export function buildCalendarContextBlock(
  fromIso: string,
  toIso: string,
  regione: string | null,
): string {
  const lines: string[] = [];
  const from = new Date(fromIso + 'T00:00:00');
  const to = new Date(toIso + 'T00:00:00');
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return '';

  const years = new Set<number>();
  const cursor = new Date(from);
  while (cursor <= to) {
    years.add(cursor.getFullYear());
    cursor.setDate(cursor.getDate() + 1);
  }

  // Festività in range
  const allHolidays: { iso: string; name: string }[] = [];
  years.forEach(y => allHolidays.push(...getItalianHolidays(y)));
  const holInRange = allHolidays
    .filter(h => h.iso >= fromIso && h.iso <= toIso)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (holInRange.length > 0) {
    lines.push('Festività nazionali nel range:');
    holInRange.forEach(h => lines.push(`  • ${h.iso} → ${h.name}`));
  }

  // Chiusure scolastiche
  if (regione) {
    const allClosures: { from: string; to: string; name: string }[] = [];
    years.forEach(y => {
      getSchoolClosures(y, regione).forEach(c => {
        const yr = c.fromMonth > c.toMonth ? y : y;
        const start = new Date(yr, c.fromMonth - 1, c.fromDay);
        const end = new Date(c.fromMonth > c.toMonth ? yr + 1 : yr, c.toMonth - 1, c.toDay);
        allClosures.push({ from: toIso(start), to: toIso(end), name: c.name });
      });
    });
    const closuresInRange = allClosures
      .filter(c => !(c.to < fromIso || c.from > toIso))
      .sort((a, b) => a.from.localeCompare(b.from));
    if (closuresInRange.length > 0) {
      lines.push(`Chiusure scolastiche (${regione}):`);
      const seen = new Set<string>();
      closuresInRange.forEach(c => {
        const key = `${c.from}|${c.to}|${c.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`  • ${c.from} → ${c.to}: ${c.name}`);
      });
    }
  }

  return lines.length === 0 ? '' : lines.join('\n');
}
