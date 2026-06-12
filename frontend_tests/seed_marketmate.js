// Seed data generator for MarketMate testing
// Returns a JSON string suitable for localStorage 'marketmate_data'

function todayIso(dt) {
  const d = new Date(dt);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function buildSeed() {
  const now = new Date();
  // Same DOW last year (anno precedente): pick a date in the same month, last occurrence of today's DOW in same month last year
  const dow = now.getDay();
  const monthIdx = now.getMonth();
  const yearPrev = now.getFullYear() - 1;
  // Find last occurrence of dow in (yearPrev, monthIdx)
  const lastDay = new Date(yearPrev, monthIdx + 1, 0).getDate();
  let dayPrev = lastDay;
  while (new Date(yearPrev, monthIdx, dayPrev).getDay() !== dow) dayPrev--;
  const datePrev = new Date(yearPrev, monthIdx, dayPrev, 12, 0, 0);

  const giornataPrev = {
    data: datePrev.toISOString(),
    mercato: 'Magenta',
    meteo: 'sole',
    km: 30,
    lordo: 800,
    netto: 700,
    contanti: 500,
    pos: 300,
    spese_extra: 0,
    dettaglio_staff: {},
    dettaglio_invenduto: {},
    dettaglio_fornitori: {},
  };

  const giornataToday = {
    data: todayIso(now),
    mercato: 'Magenta',
    meteo: 'sole',
    km: 30,
    lordo: 600,
    netto: 500,
    contanti: 300,
    pos: 300,
    spese_extra: 0,
    dettaglio_staff: {},
    dettaglio_invenduto: {},
    dettaglio_fornitori: {},
  };

  // Agenda: array of 7 with the same DOW set to 'Magenta'
  const giorniMap = ['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'];
  const giorni = ['LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO','DOMENICA'];
  const todayLabel = giorniMap[dow];
  const agenda = giorni.map((g) => ({
    giorno: g,
    mercato: g === todayLabel ? 'Magenta' : '',
    km: g === todayLabel ? 30 : 0,
    p_giornaliero: 0,
    p_annuo: 0,
    is_plat_annuo: true,
    lavorativo: g === todayLabel,
    mediaScontrino: 0,
  }));

  // Carburante: one in current month, one in previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10, 12, 0, 0);
  const storicoCarburante = [
    { data: todayIso(new Date(now.getFullYear(), now.getMonth(), 5, 12, 0, 0)), euro: 50 },
    { data: prevMonth.toISOString(), euro: 80 },
  ];

  return {
    isConfigured: true,
    lingua: 'Italiano',
    isAlimentare: true,
    nomeAttivita: 'Test',
    nomeTitolare: 'Mario',
    pin: '123456',
    emailRecupero: '',
    themeColor: '#D2691E',
    targetMensile: 3000,
    settore: 'Alimentare',
    tipoCarburante: 'diesel',
    phoneNumber: '',
    otpEnabled: false,
    speseFisseDisabilitate: [],
    speseAnnueDisabilitate: [],
    codiciInvito: [],
    currentRole: 'AMMINISTRATORE',
    joinedViaInviteCode: false,
    partenzaDa: 'Magenta',
    collaboratori: [],
    fornitori: [{ nome: 'TestForn', prodotti: [], ricaricoMedio: 70 }],
    agenda,
    speseAnnue: [],
    fiere: [],
    storicoGiornate: [giornataPrev, giornataToday],
    storicoCarburante,
    spesePeriodiche: [],
    appuntiAgenda: [],
    ordiniAgenda: [],
    storicoDiario: [],
    speseExtraTags: [],
    storicoScontrini: [],
    speseExtraSession: null,
  };
}

module.exports = { buildSeed };
