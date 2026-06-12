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

