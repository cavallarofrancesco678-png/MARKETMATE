# 📱 MarketMate — Pacchetto Submission Google Play Store

> **Versione**: 3.9.0 (build 1)
> **Package**: `it.tvscavallaro.marketmate`
> **Categoria principale**: Business
> **Categoria secondaria**: Productivity
> **Lingua principale**: Italiano (IT)
> **Paesi di rilascio**: Solo Italia (espandibile poi)

---

## 1️⃣ Identità app (Play Console → Imposta app)

| Campo | Valore |
|---|---|
| **Nome app** | `MarketMate` |
| **Descrizione breve** *(max 80 char)* | `Il gestionale degli ambulanti: mercati, fiere, bilancio e AI di settore.` *(78 char)* |
| **Categoria** | Business |
| **Tag** | Productivity, Finance, Tools |
| **Email di contatto** | `oldmemoriesshirt@gmail.com` *(o la tua email business)* |
| **Sito web** | `https://marketmate.app` *(o la tua URL)* |
| **Privacy Policy URL** | `https://marketmateapp.info/privacy-policy` |

---

## 2️⃣ Descrizione completa (max 4000 char) — Copia incolla in IT

```
MarketMate è il gestionale pensato apposta per gli ambulanti italiani: chi vive di mercati settimanali, fiere stagionali e vendite su area pubblica. Niente più quaderno, niente più Excel: tutto in un'unica app, ordinato, semplice e privato.

🛒 GESTIONE GIORNATA
Registri ogni giornata di mercato in 30 secondi: incassi, scontrino medio, spese del banco, collaboratori. Lo storico ti racconta com'è andato il mese, il trimestre, l'anno — confronto automatico con l'anno precedente.

🗓️ AGENDA MERCATI E FIERE
Imposta i mercati settimanali (Magenta lunedì, Bareggio mercoledì, Cernusco sabato…), aggiungi fiere stagionali e ordini fornitori. Calendario con marker per festività nazionali e chiusure scolastiche regionali (Lombardia, Veneto, Sicilia… ognuno con il proprio calendario).

⛽ CARBURANTE E TRAGITTI
Calcolo automatico del costo carburante per ogni tragitto andata-ritorno. Storico rifornimenti con KPI mensili: quanto stai spendendo, dove conviene fare benzina, quanto pesa la trasferta sul ricavo.

📊 STATISTICHE PROFESSIONALI
Bilancio realistico mensile: lordo - costi - INPS forfettario - tassa IRPEF. Grafici a barre, tendenze, picchi e cali. Esportazione PDF per il commercialista.

🤖 ASSISTENTE AI "BUONGIORNO"
L'unica AI italiana addestrata sul mondo del commercio ambulante. Ogni mattina ti dà:
• Meteo preciso del mercato di oggi e domani
• Andamento vendite vs lo stesso giorno dell'anno scorso
• Costo carburante e bilancio realistico
• Aggiornamenti su bandi, normative e convenzioni Confcommercio/FIVA/ASCO della tua provincia
Non rispondi a domande generiche: l'AI è scopata SOLO sul tuo settore.

📅 CALENDARIO FISCALE
Scadenze IRPEF, INPS, IVA e fattura elettronica integrate. Promemoria automatici prima della scadenza.

🏛️ CONFORMITÀ ITALIANA
GDPR-compliant. PIN di accesso. Dati cifrati. Nessuna pubblicità, nessun tracking di terze parti, nessun cookie.

📈 CRESCI COL TEMPO
MarketMate impara dalle tue abitudini: più dati inserisci, più l'AI diventa precisa nei consigli. Cambia il modo in cui gestisci la tua attività su strada.

💎 ABBONAMENTO PRO (opzionale)
La versione gratuita copre tutte le funzioni base. Pro sblocca:
• Sincronizzazione cloud sicura
• Backup automatici giornalieri
• AI illimitata (vs 10 messaggi/giorno gratuiti)
• Esportazione PDF avanzata
• Supporto prioritario

⚠️ MarketMate non è un'app generica per piccoli imprenditori: è LO strumento per chi sta dietro a un banco di mercato. Provala — non te ne pentirai.
```

*Caratteri: ~2700 / 4000 max ✅*

---

## 3️⃣ Note di rilascio v3.9.0 (max 500 char)

```
🎉 MarketMate 3.9.0 — versione di lancio!
• Calendario fiscale italiano completo (IRPEF, IVA, INPS)
• AI "Buongiorno" con calendario scolastico regionale
• Calcolo costi carburante andata/ritorno preciso
• Marker festività nazionali in agenda
• Suono ka-ching sui salvataggi
• 100% GDPR — zero pubblicità, zero tracking
Grazie per aver scelto MarketMate. Buon mercato! 🛒
```

*Caratteri: ~370 / 500 max ✅*

---

## 4️⃣ Privacy Policy & Termini

Già presenti come pagine statiche servite dal backend:
- **Privacy Policy**: `GET /api/legal/privacy` → ritorna HTML
- **Termini di Servizio**: `GET /api/legal/terms`

⚠️ **AZIONE RICHIESTA**: prima del submit Google Play vuole un URL HTTPS pubblico per la Privacy Policy. Opzioni:
- (a) Pubblicare le 2 pagine sul tuo sito (più professionale)
- (b) Usare temporaneamente l'URL del backend Emergent

Se non hai un dominio, andiamo con (b) e dopo il primo deploy migriamo.

---

## 5️⃣ Data Safety form (Google Play obbligatorio)

| Sezione | Risposta |
|---|---|
| **Raccogliete dati utente?** | ✅ Sì |
| **Condividete dati con terze parti?** | ✅ Sì (solo Stripe per pagamenti) |
| **Crittografia dati in transito** | ✅ Sì (HTTPS/TLS) |
| **Possibilità di cancellare i dati** | ✅ Sì (in-app dalle Impostazioni) |
| **Approvato per Families Policy** | ❌ No (audience 18+) |

### Categorie dati raccolti

| Tipo dato | Raccolto | Condiviso | Obbligatorio | Finalità |
|---|---|---|---|---|
| **Nome** | ✅ | ❌ | Opzionale | Funzionalità app, account |
| **Indirizzo email** | ✅ | ❌ | Necessario | Account, comunicazioni |
| **ID utente** | ✅ | ❌ | Necessario | Account |
| **Cronologia acquisti in-app** | ✅ | ✅ (Stripe) | Necessario | Gestione abbonamento |
| **Dati pagamento** | ❌ *(gestiti da Stripe direttamente)* | — | — | — |
| **Posizione approssimativa** | ✅ | ❌ | Opzionale | Meteo del mercato |
| **Posizione precisa** | ❌ | — | — | — |
| **Interazioni app** | ✅ | ❌ | Necessario | Analisi prodotto |
| **Diagnostica crash** | ✅ | ❌ | Necessario | Stabilità app |
| **Dati di business dell'utente** *(vendite, spese, fornitori, AGENDA)* | ✅ | ❌ | Necessario | Funzionalità core |

### Pratiche sicurezza
- ✅ I dati sono crittografati in transito (HTTPS)
- ✅ Gli utenti possono richiedere la cancellazione dei dati
- ✅ Politica conforme alle Family Policy: l'app NON è rivolta a minori

---

## 6️⃣ Content Rating (questionario IARC)

Quando Google Play apre il questionario IARC rispondi così:

| Domanda | Risposta |
|---|---|
| **Categoria** | Reference / Educational / Business — *Business o Tools* |
| **Violenza** | No |
| **Linguaggio scurrile** | No |
| **Contenuti sessuali** | No |
| **Droghe/Alcol/Tabacco** | No |
| **Gambling / Gioco d'azzardo** | No |
| **Condivisione di posizione** | Sì *(meteo mercato)* |
| **Acquisti in-app** | Sì *(abbonamento Pro)* |
| **UGC (contenuti generati dagli utenti)** | No *(non c'è community/social)* |

**Risultato atteso**: PEGI 3 / ESRB Everyone / IARC Tutti gli utenti

---

## 7️⃣ Audience targeting

| Campo | Valore |
|---|---|
| **Età target** | 18+ |
| **App per famiglie** | ❌ No |
| **Annunci** | ❌ Nessuna pubblicità |
| **Promosso a minori** | ❌ No |

---

## 8️⃣ Account demo per il reviewer Google

```
Email:    demo.reviewer@marketmateapp.info
Password: MarketMate2026!
Tipo:     Account Pro pre-attivato (subscription valida fino al 2030-12-31)
PIN app:  1234 (il reviewer lo imposterà al primo avvio dell'app)
```

✅ **Account già creato nel DB di produzione** (script `/app/backend/scripts/seed_demo_reviewer.py`).
Login verificato il 22/06/2026 — `subscription.status = "active"`, `plan = "annual"`.

Note per il reviewer (campo "Istruzioni per il revisore"):
```
Hi reviewer,

This is a B2B productivity app for Italian street market vendors (commercianti ambulanti).

To test the app:
1. Open the app — the first screen is a Welcome flow. Pick a language → set up a 6-digit PIN (e.g. 1234)
2. After the PIN, go to Settings → "Sign in with email" and use the demo account below
3. The demo account has a pre-activated Pro subscription (valid until 2030), so all premium features (AI unlimited, cloud sync, advanced PDF export) are unlocked
4. Test screens: Home (daily sales entry), Stats (charts), Agenda (weekly markets), Carburante (fuel tracking), Buongiorno (AI assistant)

Demo login:
  Email:    demo.reviewer@marketmateapp.info
  Password: MarketMate2026!

All data is stored encrypted locally + optional encrypted cloud sync.
No ads, no tracking, no in-app purchases except the optional Pro subscription via Stripe (real payments — the demo account already has Pro so no card is required).

Privacy: https://marketmateapp.info/privacy-policy
Terms:   https://marketmateapp.info/terms-of-service

If you encounter any issue, please contact us at: contact@marketmateapp.info
```

---

## 9️⃣ Screenshot da uploadare

Già pronti in `/app/memory/store_screenshots/android/`:
1. `01_home.png` — Schermata Home con KPI
2. `02_stats.png` — Statistiche e grafici
3. `03_fornitori.png` — Gestione fornitori
4. `04_spese.png` — Spese periodiche
5. `05_ai.png` — AI Buongiorno
6. `06_calendar.png` — Agenda mercati
7. `07_security.png` — PIN e sicurezza
8. `08_premium.png` — Funzioni Pro

📐 **Formato Google Play**: ottimale 1080×1920 (phone). Se serve, generabile via tool dedicato.

---

## 🔟 Asset grafici uploadati

| Asset | File | Dimensioni |
|---|---|---|
| **Icona app** | `/app/frontend/assets/images/icon.png` | 1024×1024 ✅ |
| **Feature graphic** | `/app/memory/store_submission/google_play/feature_graphic_1024x500.png` | 1024×500 ✅ |
| **Screenshot phone** | `/app/memory/store_screenshots/android/*.png` | 8 immagini ✅ |

⚠️ Google Play vuole anche **almeno 2 screenshot tablet 7''** + **2 screenshot tablet 10''** se vuoi targetare anche i tablet. Per il primo rilascio, possiamo limitarci ai phone.

---

## ✅ Checklist finale pre-submit

- [ ] ATECO 62.01.00 + 58.29.00 aggiunti in CCIAA *(✅ fatto dall'utente)*
- [ ] Google Play Developer Account attivo *(✅ già iscritto)*
- [ ] Icona, feature graphic, screenshots caricati
- [ ] Descrizione breve + lunga (italiano)
- [ ] Note di rilascio
- [ ] Privacy Policy URL pubblico
- [ ] Data Safety form compilato
- [ ] Content rating IARC completato
- [ ] Audience target impostato
- [ ] Account demo creato e funzionante
- [ ] Categoria + email contatto compilati
- [ ] Bundle `.aab` (Android App Bundle) caricato → questo arriva dal pulsante **Publish** di Emergent
