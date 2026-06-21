# MarketMate - PRD (Product Requirements Document)

## Panoramica
MarketMate è un'app mobile per ambulanti e venditori ai mercati italiani. Permette di gestire la giornata lavorativa, tracciare incassi, spese, collaboratori, carburante e avere un assistente AI.

## Funzionalità Principali

### 1. Login & Onboarding
- Login con PIN + OTP opzionale
- Wizard di configurazione (6 step): telefono, lingua, settore, identità, sicurezza, completamento
- Supporto multilingua (IT, EN, FR, DE, ES, PT)

### 2. Dashboard Principale (Home)
- Tracciamento giornaliero: lordo, utile, contanti, POS
- Meteo del giorno
- Gestione collaboratori (presenze)
- Spese fisse giornaliere (calcolate da annuali)
- Spese extra (per fornitore)
- Invenduto/Perdita (per prodotto)
- Grafico storico mercato (mese/anno/anno precedente)
- Toggle Mercato/Fiera
- Pulsante "Buongiorno" con AI assistant

### 3. Agenda
- Calendario settimanale mercati
- Appunti e ordini per data
- Diario giornaliero

### 4. Gas (Carburante)
- Ricerca distributori economici (Italia/Francia)
- Calcolo distanze tra città
- Storico rifornimenti
- Costo per km

### 5. Statistiche
- Grafici incassi per periodo
- Confronto mercati
- Media scontrino
- Analisi OCR chiusura fiscale

### 6. Impostazioni
- Gestione collaboratori e fornitori
- Spese annue
- Agenda settimanale mercati
- Configurazione carburante
- Reset dati
- Seed dati demo

## Architettura Tecnica

### Frontend
- Expo SDK 54 con Router
- Zustand per state management
- AsyncStorage per persistenza locale
- react-native-svg per grafici
- i18next per internazionalizzazione
- Neumorphic design con palette menta/teal

### Backend (FastAPI)
- AI Chat con GPT-4.1-mini (Emergent LLM Key)
- OCR analisi scontrini
- Ricerca prezzi carburante (API Italia/Francia)
- Calcolo distanze (Nominatim + Haversine)
- MongoDB per dati

### Integrazioni
- OpenAI GPT-4.1-mini via Emergent LLM Key (chat + OCR)
- Nominatim (OpenStreetMap) per geocoding
- API prezzi carburante Italia/Francia
- Stripe Subscriptions (LIVE keys attive — NO transazioni di test!)
- Emergent Auth (Google OAuth), Expo Push Notifications

## Round 73 (Giu 2026) — FIX DEFINITIVO Fatture (input dedicato) ✅
**Reclamo utente (ancora):** "metto il numero fattura e quello rimane, ma non rimane l'importo. In STATISTICHE resta solo l'importo dell'ultima fattura che segno".

**Root cause identificata:** il form della giornata ha UN solo input `numero+importo` per fornitore per giorno. Se l'utente inserisce 2 fatture stesso giorno (o cambia numero rapidamente), l'importo viene sovrascritto prima che l'autosave possa registrare la prima.

**Fix UI dedicato — `AddFatturaModal`:**
1. Nuovo componente `/app/frontend/src/components/AddFatturaModal.tsx`:
   - Form completo: fornitore (con dropdown rubrica), numero fattura, importo, data emissione, periodo from/to, scadenza, modo pagamento (fattura/contanti/misto), note
   - Crea **un record indipendente** in `fattureLog` via `addFattura`/`updateFattura`
   - Cliccando un record esistente → modalità modifica con pulsante elimina
2. Card "FATTURE" in stats.tsx **ora sempre visibile** con:
   - Pulsante "+ Aggiungi nuova fattura" prominente
   - Lista singole fatture cliccabili per modifica (raggruppate per fornitore con totale)
   - Empty state quando log vuoto
3. Backfill automatico già implementato in Round 73 precedente (storicoGiornate + spesePeriodiche → fattureLog)

**Risultato:** ora l'utente registra ogni fattura tramite modal dedicato. NESSUN overwriting possibile, ogni record è un'entità separata e immutabile. Stats accumula correttamente. Modifica/Cancella esplicite.

## Round 72 (Giu 2026) — Bugfix utente CRITICO pre-lancio — COMPLETATO ✅
**Problema:** "in STATISTICHE appare solo l'importo dell'ultima fattura segnata. Lo stesso accade in NOTE, dove anche la data non è quella corretta"

**Causa radice:** il tracciamento fatture era legato al `fornitoriInfo` di ogni `Giornata` (1 numeroFattura per fornitore per giorno) → soggetto a overwriting e perdita dati cross-giornata.

**Fix architetturale — `fattureLog` immutabile:**
1. Nuova interfaccia `Fattura` con campi: id, fornitore, numeroFattura, importo, modoPagamento, **dataEmissione** (giornata), **dataInserimento** (timestamp real), **periodoFrom/To** (riferimento custom), scadenza
2. Nuovo state `fattureLog: Fattura[]` (append-only) con persistenza AsyncStorage + sync cloud
3. Actions: `addFattura`, `upsertFatturaByKey` (dedup su fornitore+numero, preserva dataInserimento), `removeFattura`, `updateFattura`
4. Hook automatico in `handleSalva` di home/index.tsx: ogni fornitore con numeroFattura → upsert nel log
5. Stats: nuova card "FATTURE" arancione (#E89B4A) con TOT €, count, breakdown per fornitore — aggiornato in real-time
6. Agenda Tab Fatture: source primaria fattureLog + riga "📝 Inserita il GG/MM/AAAA · 📅 periodo GG/MM → GG/MM"
7. Agenda Tab Note: include fatture con `data = dataInserimento` (NON dataEmissione)
8. Fix critico aggiuntivo: `saveToStorage` mancava `fattureLog` nel dataToSave → reload perdeva tutto (trovato dal testing_agent + fixato)

**Testing:** 8 step end-to-end passati via testing_agent. Stats mostra TOT corretto, Agenda mostra tutte le fatture distinte, persistenza F5 verificata.

## Round 71 (Giu 2026) — Bugfix utente (1 issue) — COMPLETATO ✅
1. **Suono SALVA non si sentiva più**: causa = `feedback.ts` importava `expo-audio` (non installato) → modulo rotto al load; inoltre la CDN `freesound.org` era inaffidabile.
   - **Fix:** installato `expo-audio@1.1.1` (sostituto ufficiale di `expo-av` deprecato)
   - Riscrittto `feedback.ts`:
     - **WEB** → sintesi locale via Web Audio API (doppia nota A5→E6, "ka-ching" senza dipendenze di rete)
     - **NATIVE** → `expo-audio.createAudioPlayer` con CDN + cleanup automatico dopo 1.5s
   - Verificato in browser: AudioContext state `running`, sampleRate 44100 ✓

## Round 70 (Giu 2026) — Bugfix utente (2 issue) — COMPLETATI ✅
1. **AI dice "no chiusure scolastiche" anche se ci sono**: causa = `resolveRegion()` lato frontend ha solo i capoluoghi (Magenta/Bareggio non risolti) → contesto vuoto. Fix: portato il calcolo in backend (`build_calendar_context_block` in Python) che usa il geocoder per QUALSIASI città italiana. Sovrascrive sempre il blocco frontend.
2. **AI raddoppia i km del tragitto (22 → 44)**: causa = nessuna direttiva esplicita nel prompt. Fix: aggiunta sezione "KM — REGOLA CRITICA" con esempio numerico — "il campo km è GIÀ A/R, NON moltiplicare per 2".
3. Test pytest `test_ai_round70.py` (2 test passed): scuole Magenta + km non raddoppiati.
4. Totale backend: 24/25 passed (1 skip non correlato).

## Round 69 (Giu 2026) — Bugfix utente (4 issue) — COMPLETATI ✅
1. **Salvataggio Fatture verifica + FIX**: trovato bug — quando si riapriva una giornata salvata, il `pagamentoMode` (fattura/contanti/misto) non veniva ripristinato dalle chiavi presenti in `dettaglio_fornitori`. L'utente vedeva sempre "contanti" anche se aveva salvato "fattura". I dati erano CORRETTAMENTE salvati (chiave `nomeBase` = fattura, `nomeBase__libera` = contanti) ma l'UI non li mostrava. Fix in `home/index.tsx`: deriva il `pagamentoMode` dalle chiavi al load.
2. **Pulizia rifornimenti fantasma**: 
   - Cleanup automatico al boot: rimuove dallo storico qualunque rifornimento con `data > oggi`
   - Nuovo metodo store `clearCarburanteInRange(fromIso, toIso)`
   - Nuovo bottone "🗑️ Pulisci mese visualizzato" sotto al calendario Gas (con count + conferma)
   - Difesa in `addCarburante` lato store: blocca date future a livello di state
3. **AI deduzione provincia automatica**: 
   - Nuovo campo `mercati_lista` in ChatRequest (pipe-separated cities)
   - Nuova funzione `resolve_markets_list()` aggrega tutte le città configurate (agenda + fiere + partenza), trova la regione/provincia più frequente
   - Frontend invia automaticamente la lista da agenda settimanale + fiere + partenza
   - System prompt: regola INVIOLABILE — l'AI NON deve mai chiedere all'utente di configurare la provincia in Impostazioni
4. **Selezione bandi più accurata**: 
   - Sezione "FORMATO RISPOSTA BANDI/NORMATIVE" riscritta con direttive di accuratezza ("Meglio 3 voci solide che 5 vaghe")
   - 6 categorie concrete con convenzioni specifiche: FIVA-Confcommercio (RC ambulanti tariffa convenzionata, sconti carburante Eni/Q8/IP), ANVA-Confesercenti (formazione + IP/Tamoil), Camera di Commercio (digitalizzazione 40-50%, Punto Impresa Digitale gratis), Regione (fondo perduto €5-30k), ASCO/Unione Commercianti, INPS/Agenzia Entrate (forfettario, credito imposta registratore €100)
   - Direttiva "💡 Suggerimento extra" per convenzioni proattive anche se l'utente non chiede

## Round 68 (Giu 2026) — Bugfix utente (3 issue) — COMPLETATI ✅
1. **Carburante — conti sballati + giorni futuri**: causa unica = i giorni futuri erano cliccabili e creavano entry future che sommavano nel KPI.
   - Bloccato `handleDayPress` su giorni futuri (alert IT)
   - Difesa in profondità in `handleSaveDayRifornimento`
   - Freccia "→" disabilitata sui mesi >= corrente
   - Giorni futuri visualmente dimmati (opacity 0.35)
2. **Buongiorno AI — funzioni Unione Commercianti**: il system prompt ora ha sezione "MONITORAGGIO ISTITUZIONALE" come funzione PROATTIVA OBBLIGATORIA. Proposta bandi/normative come step 6 del saluto (non più sostituita dalla CTA). Quick-chip nel modal: "🏛️ Bandi & Normative", "📅 Feste & Scuole", "📊 Riepilogo mese".
3. **Calendario feste/chiusure scolastiche**: nuovo util `/app/frontend/src/utils/italianCalendar.ts` con:
   - 12 festività nazionali (Pasqua/Pasquetta calcolate dinamicamente)
   - Chiusure scolastiche per REGIONE (estive Nord/Centro/Sud differenziate, carnevale Nord, pasquali)
   - Mappa città→regione per top 60 città italiane
   - Marker visivi 🔴 festa / 🟡 scuole chiuse in calendari Gas + Agenda
   - Legenda contestuale "Festa nazionale" + "Scuole chiuse · {Regione}"
   - Blocco CALENDARIO_CONTESTUALE iniettato nel prompt AI per analisi predittive
4. **Test pytest backend** /app/backend/tests/test_ai_round68.py (3 passed) + /app/backend/tests/test_ai_limits.py (3 passed) — totale 20/20 passed.

## Round 67 (Giu 2026) — Fix richiesti dall'utente (COMPLETATI ✅)
1. **Carburante**: calendario mensile (sotto) ↔ filtro periodo (sopra) SINCRONIZZATI (`monthPeriodOf`, `goToMonth` in gas.tsx); somme KPI = mese mostrato. Verificato E2E.
2. **Statistiche — revisione totale**: 
   - BUG FIX: fatture fornitori con detrazione ripartita finivano sotto "Contanti" → ora classificate sotto "Fatturata" (salvataggio `pagamentoMode` + split `importoFattura`/`importoContanti` in spesePeriodiche; classificazione in fornitoriTotals).
   - BUG FIX: `fornitoriScadenze` non si ricalcolava navigando i mesi (mancava dataRiferimento nelle deps) → netto sbagliato nei mesi passati.
   - `chartLabels`/`groupData` (settimane S1-S5) e `giorniLavoroData` usano il mese navigato (dataRiferimento), conteggio giorni clampato a fine periodo.
   - Archivio note (agenda): importo fatture periodiche recuperato da spesePeriodiche (prima mostrava €0).
3. **Home grafico "anno prec."**: confronto SINGOLO mercato (ultimo stesso mese+giorno-settimana, 1 giornata vs 1 giornata, €0 se non tenuto), etichette con date e delta %. Verificato E2E (27/6/25 €800 vs 12/6/26 €600, −25%).
4. **IA "Buongiorno"**:
   - Limiti consumo: 10 msg/giorno + 100 msg/mese per device (collection `ai_usage`, device_id persistente `mm_device_id`); messaggio cortese + input disabilitato al raggiungimento. Budget ≈ €1/mese (14% di €6,90).
   - Solo temi app/attività: rifiuto standard per domande generiche (verificato).
   - Protocollo localizzazione: MERCATO_INFO JSON (città→regione/provincia via Open-Meteo geocoding con cache, `get_region_info`), calendario scolastico, monitoraggio bandi/ASCO con formato notizie e disclaimer anti-invenzione.
   - NOTA: la chiave universale Emergent NON supporta web search reale → l'IA usa conoscenza + fonti ufficiali da verificare (comunicato all'utente).
   - Test pytest: /app/backend/tests/test_ai_limits.py (3 passed).

### Note operative ambiente
- Metro gira in CI MODE (hot reload web DISABILITATO): dopo modifiche frontend serve `sudo supervisorctl restart expo`.
- Per test E2E: iniettare localStorage `marketmate_data` (vedi /app/frontend_tests/build_seed.py) e usare `dispatch_event('click')` (i click force di Playwright non azionano Pressability RN-web).

## Backlog / Prossimi task (Store Submission)
- P0: Feature Graphic 1024×500 per Google Play
- P0: Testi marketing (descrizioni, keywords ASO, release notes IT)
- P0: Account demo "MarketMate Pro" per i reviewer Apple/Google
- P1: Bozze Privacy Nutrition Labels (Apple) + Data Safety (Google)
- P1: Build EAS .ipa/.aab (BLOCCATO: servono Apple Team ID + Google Play Console dall'utente)
- BLOCKED (utente): codice ATECO da sistemare col commercialista prima di incassi LIVE Stripe

