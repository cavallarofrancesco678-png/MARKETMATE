# MarketMate — Costanti di Progetto (memoria permanente)

## 🌐 Dominio ufficiale del sito
**https://www.marketmateapp.info/**

Anche se l'app si chiama MarketMate, il dominio NON è `marketmate.info` (non disponibile).
Il dominio corretto è `marketmateapp.info` (con la "app" nel mezzo) e in versione completa è preceduto da `www.`.

## 📧 Email ufficiale di contatto
**contact@marketmateapp.info**

(stesso dominio del sito, ma senza il `www.`)

## 🏢 Titolare del trattamento dati (Data Controller)
**OLD MEMORIES SHIRT di Cavallaro Francesco** — Impresa Individuale
- Sede: Via Madonna Pellegrina 78, 20008 Bareggio (MI), Italia
- P.IVA: 14055260963
- C.F.: CVLFNC65E11F205G
- REA: MI-2759384 (Camera di Commercio Milano)
- Iscritta dal: 19/03/2025
- PEC: olmemories@pec.it (⚠️ verificare typo "olmemories" vs "oldmemories")
- Email contatti: contact@marketmateapp.info
- Foro competente: Milano

> ⚠️ **ATTENZIONE codice ATECO**: la ditta è iscritta per "commercio elettronico al dettaglio di abbigliamento" (ATECO 47.91.10 o simile). Per emettere fatture B2B SaaS dovrà aggiungere un ATECO secondario (consigliato **62.01.00** o **63.12.00**) tramite denuncia modificativa alla CCIAA di Milano. Da fare PRIMA del primo incasso Stripe.

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
