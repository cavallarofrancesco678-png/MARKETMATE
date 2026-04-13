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
