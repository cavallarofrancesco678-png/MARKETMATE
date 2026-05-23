# MarketMate
## L'app gestionale per ambulanti, fieristi e operatori dei mercati

---

### IL PROBLEMA

Migliaia di operatori italiani vivono di mercati settimanali, fiere e vendita ambulante.
Ogni giorno gestiscono **decine di transazioni in contanti**, **fornitori multipli**, **spese ricorrenti** e **trasferte**.

Eppure, **la stragrande maggioranza usa ancora carta e penna o, al massimo, un foglio Excel improvvisato**.

Risultato:
- Bilanci approssimativi, redditività reale sconosciuta
- Spese fisse "dimenticate" che erodono il profitto
- Impossibile capire se un mercato/fornitore è davvero conveniente
- Stress al commercialista per ricostruire i conti a fine anno

---

### LA SOLUZIONE

**MarketMate** è la prima app mobile (iOS + Android) pensata su misura per chi vive **giorno per giorno** tra mercati e fiere.

Una sola schermata, **30 secondi al giorno**, e l'attività è sotto controllo:
incasso, costi, utile reale, andamento storico, statistiche avanzate.

Nessun corso da fare. Nessun PC. Solo il telefono che hai già in tasca.

---

## COSA FA L'APP — Funzioni Principali

### 1. AGENDA SETTIMANALE INTELLIGENTE
- Tutti i giorni della settimana mappati: per ogni giorno il mercato di riferimento, i km da percorrere, il plateatico (giornaliero o annuo).
- Identifica automaticamente il mercato di **oggi**: l'app sa già dove sei, cosa stai facendo e quanto ti sta costando.
- Gestione **Fiere** separata dai mercati ricorrenti.

### 2. HOME GIORNALIERA "ONE-TAP"
- Inserisci il **lordo** della giornata (incasso totale) in 3 secondi.
- Separazione automatica **Contanti / POS** con calcolo immediato.
- **L'utile reale** del giorno viene calcolato in tempo reale, già al netto di:
  - Quota giornaliera spese fisse (assicurazione, bollo, commercialista, plateatici annuali pro-ratati)
  - Carburante (km mercato × €/km)
  - Eventuali collaboratori presenti
  - Spese fornitori "giornaliere"
  - Spese extra del giorno
  - Invenduto

### 3. SPESE RIPARTITE (la funzione esclusiva di MarketMate)
Concetto rivoluzionario: hai speso €200 di pane lunedì che vendi nell'arco di 7 giorni?
**MarketMate distribuisce automaticamente quel costo sui 7 giorni**, così l'utile giornaliero è realistico e non "distorto" dal singolo acquisto.

- Tre modalità: **Oggi** (default), **Settimanale** (Lun-Dom), **Personalizzata** (range a scelta).
- Funziona sia per fornitori che per voci generiche (es. "Dolci Palermo", "Acqua minerale", "Materiale stampa").
- Filtro automatico per periodo: vedi solo le spese rilevanti per la settimana/mese che stai analizzando.

### 4. GESTIONE FORNITORI COMPLETA
- Rubrica fornitori con prodotti, ricarico medio, modalità pagamento (Contanti / Fattura / Misto).
- Tracciamento **fatture in scadenza** con promemoria.
- Storico acquisti per fornitore: scopri chi ti fa risparmiare di più.

### 5. COLLABORATORI / STAFF
- Anagrafica completa con costo orario.
- Presenze giornaliere con un tocco.
- Calcolo automatico costo manodopera integrato nell'utile netto.

### 6. STATISTICHE AVANZATE
Filtri temporali professionali: **Oggi / Ieri / Settimana / Mese / Anno / Anno precedente / Personalizzato**.
Filtri per giorno della settimana (LUN, MAR, ...) e per Fiere.

Visualizzazioni:
- Lordo vs Netto con barra colorata
- Cash vs POS con percentuali
- Spese fisse vs straordinarie (grafico a torta)
- Top fornitori per spesa
- Andamento collaboratori
- Invenduto per categoria
- Statistica meteo (giorni di sole / pioggia / vento → impatto sull'incasso)

### 7. CALCOLO NETTO INTERATTIVO
Il **vero "cervello" di MarketMate**: un modal in cui l'utente vede l'incasso lordo e può **escludere/includere ogni categoria di costo** in tempo reale, capendo subito *"quanto guadagno davvero questa settimana SENZA contare il carburante? E SENZA i collaboratori?"*.

Ogni categoria ha un toggle iOS-style. Il NETTO finale si aggiorna live.

Sezioni indipendenti per:
- Spese Fisse | Collaboratori | Spese Extra | Fornitori Giornalieri
- **Fornitori a Spesa Ripartita** (dropdown collassabile)
- Invenduto | Gestione Carburante | Spese Ripartite (voci generiche)

### 8. ASSISTENTE AI INTEGRATO (GPT-4.1-mini)
- "Buongiorno" personalizzato che cita dati reali dell'attività (ultimo incasso, mercato di oggi, meteo previsto)
- L'utente può chiedere all'AI: *"Come miglioro l'incasso del sabato?"*, *"Mi conviene comprare ancora dal fornitore X?"*
- L'AI risponde leggendo i dati reali dell'app, non risposte generiche.
- Multilingua (Italiano + altre lingue di sistema).

### 9. METEO INTEGRATO (Open-Meteo)
- Previsione automatica del mercato di oggi/domani in base al codice postale di partenza.
- Statistica storica: "i giorni di pioggia incassi -30%" — l'app te lo dice.

### 10. COLLABORAZIONE TEAM (Hybrid Cloud Sync)
- Ogni titolare può invitare collaboratori tramite un **codice di invito a 6 caratteri**.
- Sincronizzazione automatica e bidirezionale tramite cloud sicuro.
- Ruoli differenziati: **Amministratore** (tutto) / **Collaboratore** (inserimento incassi e fornitori).
- I dati sono sempre disponibili offline grazie all'archiviazione locale + cloud.

### 11. PROMEMORIA E SCADENZE
- Agenda integrata: appunti, ordini fornitori, scadenze fatture.
- Notifiche push per scadenze (revisione, assicurazione, fatture in scadenza).

### 12. DIARIO DI BORDO
- Note libere giornaliere ("oggi pioveva, il mercato era mezzo vuoto")
- Storico completo navigabile: cosa è successo il 15 marzo dell'anno scorso?

### 13. PRIVACY & SICUREZZA
- Dati salvati **localmente** sul dispositivo (AsyncStorage cifrato).
- Sincronizzazione cloud opzionale e crittografata.
- Nessun dato venduto a terzi.
- PIN/biometria per accesso.

---

## POTENZIALITÀ — Dove può arrivare MarketMate

### A breve termine (già in roadmap)
1. **Sottoscrizioni Stripe**: piano Free (1 utente, dati locali) e Premium (multi-collaboratore, cloud sync illimitato, AI avanzata, export commercialista).
2. **Sistema referral & premi**: porta un amico, sblocca mesi gratis.
3. **Export PDF/Excel** automatico per il commercialista (registri IVA, prima nota).
4. **Riconoscimento OCR scontrini fornitori** (riattivabile su richiesta).
5. **Integrazione cassetto fiscale / Agenzia Entrate** per fattura elettronica passiva.

### A medio termine
- **Marketplace fornitori**: scopri fornitori della tua zona e confronta prezzi tra colleghi.
- **Benchmarking anonimo**: "operatori come te incassano in media €X il sabato — tu sei sopra/sotto la media".
- **AI predittiva**: l'app suggerisce in anticipo *"sabato pioverà, riduci ordine pane del 20%"*.
- **Modulo bilancio annuale** per chi è in regime semplificato.

### A lungo termine — la visione
MarketMate non è "un'app per gli ambulanti". È la **prima piattaforma SaaS verticale per il commercio itinerante in Italia**, un settore da decine di migliaia di operatori finora totalmente ignorato dal mondo digitale.

L'obiettivo è diventare lo **standard de facto** del settore, come Square e Toast lo sono per la ristorazione, e generare valore non solo dai canoni di sottoscrizione ma anche da:
- Insights aggregati e anonimizzati per associazioni di categoria
- Partnership con assicurazioni, fornitori di servizi POS, network di mercati
- Espansione cross-border (Spagna, Francia, Germania hanno gli stessi problemi)

---

## VANTAGGI COMPETITIVI

| Aspetto | App generaliste | MarketMate |
|---|---|---|
| Conosce il mondo "mercati"? | No | **Sì, nativamente** |
| Plateatico, fiere, km giornalieri | Da configurare a mano | **Pre-impostati** |
| Spese ripartite su periodo | Non esistono | **Esclusive MarketMate** |
| AI che conosce i tuoi dati reali | Generica | **Personalizzata** |
| Funziona offline | Raramente | **Sempre** |
| UI/UX per smartphone in piazza | Desktop-first | **Mobile-first** |
| Lingua / supporto Italia | Tradotto male | **Made in Italy** |

---

## DATI TECNICI

- **Piattaforme**: iOS + Android (single codebase Expo / React Native)
- **Backend**: FastAPI (Python) su cloud Kubernetes
- **Database**: MongoDB
- **AI**: GPT-4.1-mini via Emergent LLM Gateway
- **Meteo**: Open-Meteo (gratuito, illimitato)
- **Sicurezza**: AsyncStorage, JWT, HTTPS end-to-end
- **Tempo di sviluppo finora**: ~150 ore di engineering ad alta intensità
- **Linee di codice**: ~25.000 (frontend + backend)
- **Test coverage**: backend al 100% sugli endpoint critici

---

## CONCLUSIONE

MarketMate trasforma uno **smartphone** in **un commercialista in tasca** per chi vive del mercato.

In 30 secondi al giorno l'operatore sa:
- Quanto sta guadagnando **davvero**
- Quale giornata della settimana è più redditizia
- Quale fornitore gli sta erodendo i margini
- Quanto incasserà domani in base al meteo

**Per la prima volta**, il commercio ambulante italiano ha uno strumento digitale **fatto su misura per come lavora davvero**.

---

*MarketMate — Versione Beta — Maggio 2026*
*"Il tuo banco. I tuoi numeri. La tua libertà."*
