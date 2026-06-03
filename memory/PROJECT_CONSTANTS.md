# MarketMate — Costanti di Progetto (memoria permanente)

## 🌐 Dominio ufficiale del sito
**https://www.marketmateapp.info/**

Anche se l'app si chiama MarketMate, il dominio NON è `marketmate.info` (non disponibile).
Il dominio corretto è `marketmateapp.info` (con la "app" nel mezzo) e in versione completa è preceduto da `www.`.

## 📧 Email ufficiale di contatto
**contact@marketmateapp.info**

(stesso dominio del sito, ma senza il `www.`)

## 🏢 Titolare del trattamento dati (Data Controller)
**T.V.S. di Cavallaro Francesco** (ditta individuale, da confermare con i dati ufficiali per pubblicazione)

Placeholder da completare nei documenti legali quando l'utente fornirà:
- Indirizzo completo della sede operativa
- Partita IVA o Codice Fiscale
- Città del foro competente

## 🏷️ Brand
- Nome app: **MarketMate** (con la M maiuscola sia per Market sia per Mate)
- Tagline: "Il tuo banco. I tuoi numeri. La tua libertà."

## 💳 Stripe
- Modalità: **LIVE** (chiavi reali, pagamenti reali)
- Piani:
  - **Premium Mensile**: €6,90 / mese — `price_1TXQQ8LlWv3ufh6QLDYxoaXm`
  - **Premium Annuale**: €69 / anno — `price_1TXQRvLlWv3ufh6QJik0Cz0r`

## 🔑 Auth provider
- **Emergent Auth** (Google OAuth gateway) — NO Firebase per scelta architetturale del 2 giugno 2026

## 🌍 Lingue supportate (verificate)
Italiano (primaria), Inglese, Francese, Tedesco, Spagnolo, Portoghese

## ⚙️ Endpoint pubblici
- `/api/legal/privacy` · `/api/legal/terms` · `/api/legal/cookies` (HTML stilizzati)
- `/api/legal/{doc}/md` (Markdown scaricabili)
- `/api/presentazione` (presentazione commerciale)
- `/api/stripe/config` (pubblico, no auth)
