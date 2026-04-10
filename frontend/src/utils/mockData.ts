export function generateAllMockData() {
  const METEO_LABELS = ['SOLE', 'VAR', 'PIOGGIA', 'TEMP', 'VENTO'];
  const METEO_WEIGHTS = [0.45, 0.22, 0.18, 0.05, 0.10];

  const MERCATI = [
    { giorno: 'LUNEDI', mercato: 'Magenta', km: 45 },
    { giorno: 'MARTEDI', mercato: 'Rho', km: 30 },
    { giorno: 'MERCOLEDI', mercato: 'Abbiategrasso', km: 35 },
    { giorno: 'GIOVEDI', mercato: 'Novara', km: 60 },
    { giorno: 'VENERDI', mercato: 'Milano', km: 20 },
    { giorno: 'SABATO', mercato: 'Pavia', km: 50 },
    { giorno: 'DOMENICA', mercato: '', km: 0 },
  ];

  let seed = 42;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const pickWeather = () => {
    const r = rng();
    let cum = 0;
    for (let i = 0; i < METEO_WEIGHTS.length; i++) {
      cum += METEO_WEIGHTS[i];
      if (r <= cum) return METEO_LABELS[i];
    }
    return 'SOLE';
  };

  const collaboratori = [
    { nome: 'Rosario', costo: 80, costoAnnuo: 2000 },
    { nome: 'Davide', costo: 70, costoAnnuo: 1800 },
    { nome: 'Antonella', costo: 60, costoAnnuo: 1500 },
  ];

  const fornitori = [
    { nome: 'Panificio Rossi', prodotti: [
      { nome: 'Pane', prezzo: 2.50 },
      { nome: 'Pizze', prezzo: 3.00 },
      { nome: 'Focaccia', prezzo: 2.80 },
    ]},
    { nome: 'Oleificio Verde', prodotti: [
      { nome: 'Olive', prezzo: 4.50 },
      { nome: 'Olio', prezzo: 8.00 },
    ]},
    { nome: 'Dolciaria Bianchi', prodotti: [
      { nome: 'Dolci', prezzo: 5.00 },
      { nome: 'Biscotti', prezzo: 3.50 },
      { nome: 'Torte', prezzo: 6.00 },
    ]},
  ];

  const speseAnnue = [
    { voce: 'INPS', importo: 3600 },
    { voce: 'Suolo Pubblico', importo: 2400 },
    { voce: 'Assicurazione', importo: 1200 },
    { voce: 'Commercialista', importo: 800 },
  ];

  const agenda = MERCATI.map((m) => ({
    giorno: m.giorno,
    mercato: m.mercato,
    km: m.km,
    p_giornaliero: m.km > 0 ? 15 : 0,
    p_annuo: m.km > 0 ? 250 : 0,
    is_plat_annuo: true,
    lavorativo: m.km > 0,
    mediaScontrino: m.km > 0 ? 15 : 0,
  }));

  // Generate storico giornate - from Jan 1 to today
  const storicoGiornate: any[] = [];
  const now = new Date();
  const current = new Date(now.getFullYear(), 0, 1);

  const fieraNames = ['Fiera di Magenta', 'S. Martino Rho', 'Sagra Novara', 'Mercato Europeo Milano', 'Fiera Primavera'];
  const fieraDates = new Set<string>();
  for (let m = 0; m < 6; m++) {
    const day = 10 + Math.floor(rng() * 15);
    const d = new Date(now.getFullYear(), m, day);
    if (d <= now && d.getDay() !== 0) fieraDates.add(d.toDateString());
  }
  let fieraIdx = 0;

  while (current <= now) {
    const dayOfWeek = current.getDay();
    const isSunday = dayOfWeek === 0;
    const isFiera = fieraDates.has(current.toDateString());

    if (!isSunday) {
      const meteo = pickWeather();
      const wdIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mInfo = MERCATI[wdIdx];

      let wBonus = 1.0;
      if (meteo === 'SOLE') wBonus = 1.15;
      else if (meteo === 'PIOGGIA') wBonus = 0.75;
      else if (meteo === 'TEMP') wBonus = 0.6;
      else if (meteo === 'VENTO') wBonus = 0.85;

      const month = current.getMonth();
      const sBonus = 1 + (Math.sin((month - 1) * Math.PI / 6) * 0.15);
      const baseLordo = isFiera ? 800 + rng() * 300 : 350 + rng() * 250;
      const lordo = Math.round(baseLordo * wBonus * sBonus);
      const cashPct = 0.55 + rng() * 0.15;
      const contanti = Math.round(lordo * cashPct);
      const pos = lordo - contanti;
      const spese_extra = rng() > 0.6 ? Math.round(10 + rng() * 40) : 0;

      const dettaglio_staff: Record<string, number> = {};
      collaboratori.forEach((c) => {
        dettaglio_staff[c.nome] = rng() > 0.3 ? c.costo : 0;
      });
      const collabCost = Object.values(dettaglio_staff).reduce((s, v) => s + v, 0);

      const dettaglio_invenduto: Record<string, number> = {};
      fornitori.forEach((f) => {
        f.prodotti.forEach((p) => {
          const qty = rng() > 0.5 ? Math.round(rng() * 5 * 10) / 10 : 0;
          dettaglio_invenduto[p.nome] = Math.round(qty * p.prezzo);
        });
      });

      const dettaglio_fornitori: Record<string, number> = {};
      fornitori.forEach((f) => {
        dettaglio_fornitori[f.nome] = Math.round(40 + rng() * 120);
      });

      const netto = lordo - spese_extra - collabCost - Math.round(8000 / 300);
      const mercatoNome = isFiera ? fieraNames[fieraIdx % fieraNames.length] : mInfo.mercato || 'Mercato';

      storicoGiornate.push({
        data: new Date(current),
        mercato: mercatoNome,
        meteo,
        km: isFiera ? 30 + Math.round(rng() * 80) : mInfo.km,
        lordo, netto, contanti, pos, spese_extra,
        dettaglio_staff, dettaglio_invenduto, dettaglio_fornitori,
      });
      if (isFiera) fieraIdx++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Carburante
  seed = 123;
  const storicoCarburante: any[] = [];
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(rng() * 150);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    storicoCarburante.push({ data: d, euro: Math.round(40 + rng() * 50) });
  }

  return {
    collaboratori,
    fornitori,
    speseAnnue,
    agenda,
    storicoGiornate,
    storicoCarburante: storicoCarburante.sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime()),
    isConfigured: true,
    nomeAttivita: 'MarketMate Demo',
    nomeTitolare: 'Giuseppe Rossi',
    pin: '1234',
  };
}
