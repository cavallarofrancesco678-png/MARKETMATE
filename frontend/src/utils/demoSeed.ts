/**
 * DEMO SEED DATA — "Il Panivendolo" di Francesco Cavallaro
 *
 * ⚠️ TEMPORANEO — versione personale per Francesco.
 * Questo file verrà rimosso quando l'utente lo chiederà.
 *
 * Caricato SOLO se lo storage è completamente vuoto (prima installazione).
 * Se l'utente ha già dati salvati, questo seed NON li sovrascrive MAI.
 *
 * PIN preimpostato: 000000 (l'utente può cambiarlo da Riconfigura App).
 */

export const DEMO_PIN = '000000';

export const DEMO_DATA: Record<string, any> = {
  isConfigured: true,
  lingua: 'Italiano',
  nomeAttivita: 'Il Panivendolo',
  nomeTitolare: 'Francesco',
  isAlimentare: true,
  pin: DEMO_PIN,
  emailRecupero: '',
  phoneNumber: '',
  otpEnabled: false,

  partenzaDa: '',
  costoPerKm: 0,
  tipoCarburante: 'gpl',
  targetMensile: 3000,
  themeColor: '#D2691E',
  speseFisseDisabilitate: ['plat_LUNEDÌ', 'plat_MARTEDÌ'],
  speseAnnueDisabilitate: [],

  agenda: [
    { giorno: 'LUNEDÌ', mercato: 'Magenta', km: 23.2, p_giornaliero: 15, p_annuo: 700, is_plat_annuo: true, lavorativo: false, mediaScontrino: 3.91 },
    { giorno: 'MARTEDÌ', mercato: "San Pietro All' Olmo ", km: 3.8, p_giornaliero: 17, p_annuo: 816, is_plat_annuo: false, lavorativo: false, mediaScontrino: 0 },
    { giorno: 'MERCOLEDÌ', mercato: 'Settimo Milanese ', km: 12.4, p_giornaliero: 15, p_annuo: 700, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
    { giorno: 'GIOVEDÌ', mercato: 'Parabiago ', km: 28.2, p_giornaliero: 13, p_annuo: 600, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
    { giorno: 'VENERDÌ', mercato: 'Cornaredo ', km: 8.6, p_giornaliero: 10, p_annuo: 500, is_plat_annuo: true, lavorativo: false, mediaScontrino: 5.52 },
    { giorno: 'SABATO', mercato: 'Sedriano ', km: 9.6, p_giornaliero: 15, p_annuo: 700, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
    { giorno: 'DOMENICA', mercato: '', km: 0, p_giornaliero: 0, p_annuo: 0, is_plat_annuo: true, lavorativo: false, mediaScontrino: 0 },
  ],

  collaboratori: [
    { nome: 'Antonella ', costo: 50, costoAnnuo: 0 },
    { nome: 'Niccolò ', costo: 45, costoAnnuo: 0 },
    { nome: 'Davide', costo: 70, costoAnnuo: 0 },
  ],

  fornitori: [
    { nome: 'Andrea Pane', prodotti: [
      { nome: 'Pane Andrea', prezzo: 2.5 },
      { nome: 'Pizza Andrea', prezzo: 6 },
    ] },
    { nome: 'Amata ', prodotti: [
      { nome: 'Pane Speciale ', prezzo: 6 },
      { nome: 'Pane Amata ', prezzo: 2.5 },
    ] },
    { nome: 'Pane Calabria ', prodotti: [
      { nome: 'Pane Calabria ', prezzo: 2.5 },
      { nome: 'Pane Olive Calabria ', prezzo: 7 },
      { nome: 'Pane Uva ', prezzo: 8 },
      { nome: 'Pizzeria Calabria ', prezzo: 0 },
    ] },
  ],

  speseAnnue: [
    { voce: 'Assicurazione Camion ', importo: 600 },
    { voce: 'Tessera Confcommercio ', importo: 200 },
  ],

  fiere: [
    { id: 'f_1777411712656_645', nome: 'Festa ciliegie ', luogo: 'Bareggio ', giorni: [], orarioInizio: '6', orarioFine: '15', km: 0, plateatico: 0, tipologia: 'Fiera', note: '', attiva: true, dateSpecifiche: ['2026-05-03'] },
  ],

  speseExtraTags: ['Caffè', 'Buste'],

  storicoGiornate: [
    { data: '2026-04-16T22:00:00.000Z', mercato: 'Cornaredo ', meteo: 'SOLE', km: 8.6, lordo: 700, netto: 115.22222222222217, contanti: 550, pos: 150, spese_extra: 500, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 0 }, dettaglio_fornitori: { 'Andrea Pane __libera': 200, 'Amata __libera': 50, 'Pane Calabria __libera': 250 }, dettaglio_spese_extra: {}, fornitoriInfo: {} },
    { data: '2026-04-18T12:02:04.293Z', mercato: 'Sedriano ', meteo: 'NUVOLO', km: 9.6, lordo: 1700, netto: 1397.2222222222222, contanti: 1479, pos: 221, spese_extra: 100, dettaglio_staff: { Davide: 70, 'Antonella ': 50, 'Niccolò ': 45 }, dettaglio_invenduto: { totale: 18, 'Pane Calabria  - Pane Calabria ': 18 }, dettaglio_fornitori: { 'Amata __libera': 100 }, dettaglio_spese_extra: {}, fornitoriInfo: {} },
    { data: '2026-04-19T22:00:00.000Z', mercato: 'Magenta', meteo: 'SOLE', km: 23.2, lordo: 450, netto: 84.72222222222223, contanti: 430, pos: 20, spese_extra: 280, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 7.5 }, dettaglio_fornitori: { 'Andrea Pane __libera': 180, 'Amata __libera': 50 }, dettaglio_spese_extra: { Buste: 50 }, fornitoriInfo: {} },
    { data: '2026-04-15T22:00:00.000Z', mercato: 'Parabiago ', meteo: 'NUVOLO', km: 28.2, lordo: 430, netto: 338.22222222222223, contanti: 400, pos: 30, spese_extra: 0, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 0 }, dettaglio_fornitori: {}, dettaglio_spese_extra: {}, fornitoriInfo: { 'Andrea Pane ': { numeroFattura: '', scadenza: '2026-04-30' } } },
    { data: '2026-04-20T22:00:00.000Z', mercato: "San Pietro All' Olmo ", meteo: 'SOLE', km: 3.8, lordo: 235, netto: 12.222222222222229, contanti: 235, pos: 0, spese_extra: 142, dettaglio_staff: { Davide: 50, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 10 }, dettaglio_fornitori: { 'Andrea Pane __libera': 130 }, dettaglio_spese_extra: { 'Caffè': 12 }, fornitoriInfo: {} },
    { data: '2026-04-22T07:46:30.897Z', mercato: 'Settimo Milanese ', meteo: 'NUVOLO', km: 12.4, lordo: 800, netto: 188, contanti: 672, pos: 128, spese_extra: 507, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 20, 'Pane Andrea - Andrea Pane ': 10, 'Pane Calabria  - Pane Calabria ': 10 }, dettaglio_fornitori: { 'Andrea Pane __libera': 200, 'Amata __libera': 50, 'Pane Calabria __libera': 220 }, dettaglio_spese_extra: { 'Caffè': 7, Buste: 30 }, fornitoriInfo: { 'Andrea Pane ': { numeroFattura: '', scadenza: '2026-04-23' } } },
    { data: '2026-04-10T22:00:00.000Z', mercato: 'Sedriano ', meteo: 'SOLE', km: 6.4, lordo: 0, netto: -18.363333333333333, contanti: 0, pos: 0, spese_extra: 0, dettaglio_staff: { Davide: 0, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 0 }, dettaglio_fornitori: {}, dettaglio_spese_extra: {} },
    { data: '2026-04-23T18:48:53.127Z', mercato: 'Parabiago ', meteo: 'PIOGGIA', km: 28.2, lordo: 510, netto: 95.22222222222223, contanti: 490, pos: 20, spese_extra: 307, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 16, 'Pane Andrea - Andrea Pane ': 10, 'Pizza Andrea - Andrea Pane ': 6 }, dettaglio_fornitori: { 'Andrea Pane __libera': 250, 'Amata __libera': 50 }, dettaglio_spese_extra: { 'Caffè': 7 }, fornitoriInfo: {} },
    { data: '2026-04-23T22:00:00.000Z', mercato: 'Cornaredo ', meteo: 'SOLE', km: 8.6, lordo: 870, netto: 229.3888888888888, contanti: 716, pos: 154, spese_extra: 537.8333333333334, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 18, 'Pizza Andrea - Andrea Pane ': 18 }, dettaglio_fornitori: { 'Andrea Pane __libera': 170, 'Amata __libera': 50, 'Pane Calabria __libera': 300 }, dettaglio_spese_extra: { Buste: 10.833333333333334, 'Caffè': 7 }, fornitoriInfo: {} },
    { data: '2026-04-24T22:00:00.000Z', mercato: 'Sedriano ', meteo: 'SOLE', km: 9.6, lordo: 1550, netto: 615.2222222222222, contanti: 1356, pos: 194, spese_extra: 777, dettaglio_staff: { Davide: 70, 'Antonella ': 50, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 18, 'Pane Calabria  - Pane Calabria ': 18 }, dettaglio_fornitori: { 'Andrea Pane __libera': 240, 'Pane Calabria __libera': 530 }, dettaglio_spese_extra: { 'Caffè': 7 }, fornitoriInfo: { 'Amata ': { numeroFattura: '', scadenza: '2026-04-30' }, 'Pane Calabria ': { numeroFattura: '', scadenza: '2026-04-30' }, 'Andrea Pane ': { numeroFattura: '', scadenza: '2026-04-27' } } },
    { data: '2026-04-26T22:00:00.000Z', mercato: 'Magenta', meteo: 'NUVOLO', km: 23.2, lordo: 550, netto: 207.22222222222217, contanti: 501, pos: 49, spese_extra: 265, dettaglio_staff: { Davide: 70, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 0, 'Pane Andrea - Andrea Pane ': 7.5 }, dettaglio_fornitori: { 'Andrea Pane __libera': 165, 'Amata __libera': 50 }, dettaglio_spese_extra: { Buste: 50 }, fornitoriInfo: {} },
    { data: '2026-04-28T07:34:29.773Z', mercato: "San Pietro All' Olmo ", meteo: 'NUVOLO', km: 3.8, lordo: 230, netto: 40, contanti: 227, pos: 3, spese_extra: 115, dettaglio_staff: { Davide: 50, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 25, 'Pane Andrea - Andrea Pane ': 25 }, dettaglio_fornitori: { 'Andrea Pane __libera': 115 }, dettaglio_spese_extra: {}, fornitoriInfo: {} },
    { data: '2026-04-26T20:44:03.086Z', mercato: '', meteo: 'SOLE', km: 0, lordo: 0, netto: 0, contanti: 0, pos: 0, spese_extra: 0, dettaglio_staff: { Davide: 0, 'Antonella ': 0, 'Niccolò ': 0 }, dettaglio_invenduto: { totale: 0 }, dettaglio_fornitori: {}, dettaglio_spese_extra: {}, fornitoriInfo: {} },
    { data: '2026-04-30T21:17:28.365Z', mercato: 'Parabiago ', meteo: 'NUVOLO', km: 28.2, lordo: 600, netto: 508.2222222222222, contanti: 550, pos: 50, spese_extra: 0, dettaglio_staff: { 'Antonella ': 0, 'Niccolò ': 0, Davide: 70 }, dettaglio_invenduto: { totale: 0 }, dettaglio_fornitori: {}, dettaglio_fornitori_deduction: {}, dettaglio_spese_extra: {}, fornitoriInfo: { 'Andrea Pane ': { numeroFattura: '123', scadenza: '' } } },
    { data: '2026-04-29T17:47:55.733Z', mercato: 'Settimo Milanese ', meteo: 'NUVOLO', km: 12.4, lordo: 840, netto: 525.2222222222222, contanti: 19, pos: 821, spese_extra: 0, dettaglio_staff: { 'Antonella ': 0, 'Niccolò ': 0, Davide: 70 }, dettaglio_invenduto: { totale: 25 }, dettaglio_fornitori: { 'Andrea Pane __libera': 200 }, dettaglio_fornitori_deduction: { 'Andrea Pane ': 'DAILY' }, dettaglio_spese_extra: {}, fornitoriInfo: { 'Andrea Pane ': { numeroFattura: '', scadenza: '2026-05-01' }, 'Amata ': { numeroFattura: '1234', scadenza: '2026-04-30' } } },
  ],

  storicoCarburante: [
    { data: '2026-04-13T10:00:00.000Z', euro: 20, nota: '' },
    { data: '2026-04-18T10:00:00.000Z', euro: 20, nota: '' },
    { data: '2026-04-20T10:00:00.000Z', euro: 20, nota: '' },
    { data: '2026-04-24T10:00:00.000Z', euro: 20, nota: '' },
    { data: '2026-04-27T17:18:02.035Z', euro: 28, nota: '' },
  ],

  appuntiAgenda: [],
  ordiniAgenda: [
    { data: '2026-04-30T10:00:00.000Z', testo: 'Amata  – Fatt. 1234 – €0' },
  ],
  storicoDiario: [],

  storicoScontrini: [
    { data: '2026-04-20T10:12:18.591Z', mercato: 'Magenta ', totale: 218.94, numScontrini: 56, mediaScontrino: 3.91 },
    { data: '2026-04-24T10:25:22.792Z', mercato: 'Cornaredo ', totale: 458.1, numScontrini: 83, mediaScontrino: 5.52 },
  ],

  codiciInvito: [
    { codice: 'ADM-XFH94J', tipo: 'AMMINISTRATORE', nome: 'Antonella ', attivo: true, dataCreazione: '2026-04-30T08:39:41.534Z' },
  ],
};
