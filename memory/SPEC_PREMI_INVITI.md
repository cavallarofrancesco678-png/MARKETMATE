# 🎁 SPEC PREMI & INVITI — MarketMade

Specifica tecnica per il sistema di abbonamenti, referral e premi.
Da implementare quando le chiavi Stripe e gli account sono pronti.

---

## 1. Modello di Business

| Voce              | Valore                              |
| ----------------- | ----------------------------------- |
| Trial period      | **15 giorni gratis** per nuovi user |
| Piano mensile     | **€6,90 / mese**                    |
| Piano annuale     | **€69,00 / anno**                   |
| Codice convenzione| es. `UNION50` → annuale a **€50**   |

### Codice Convenzione
- Campo "Codice Convenzione" disponibile **prima** della registrazione (in onboarding o prima del primo pagamento).
- Esempio: `UNION50` → l'annuale passa da €69 a €50.
- Gestito da pannello admin (con sconto % o importo fisso) — **NON hardcoded**.

### Referral System
- Ogni utente ha un codice univoco (es. `MARC-A4F9X`).
- Il nuovo utente lo digita in fase di registrazione → i due account vengono collegati nel DB (`invitato_da`).
- (Future: link tipo `marketmade.app/invite?id=USER123` quando ci sarà dominio + deeplinking).

---

## 2. Logica di Premiazione

### Fase A — Mesi Gratis (max 12)
Per ogni utente presentato che paga un **abbonamento annuale**:
- L'invitante riceve **+1 mese gratuito**.
- Limite massimo: **12 mesi accumulabili**.

### Fase B — Buoni Carburante
Una volta raggiunti i 12 mesi gratis, per ogni nuovo iscritto annuale O rinnovo annuale di iscritti precedenti:
- L'invitante accumula **€6,90** nel "Salvadanaio Buoni".
- Soglia minima di riscatto: **€20,00**.

---

## 3. Schema Database (MongoDB)

### Collection: `users`
```json
{
  "id_utente": "uuid",
  "email": "string",
  "codice_referral_personale": "string univoco (es. MARC-A4F9X)",
  "invitato_da": "id_utente o null",
  "codice_convenzione_usato": "string o null (es. UNION50)",
  "mesi_bonus_accumulati": 0,
  "credito_buoni_carburante": 0.0,
  "data_scadenza_abbonamento": "ISO date",
  "stripe_customer_id": "string",
  "stripe_subscription_id": "string",
  "subscription_status": "trial|active|cancelled|past_due",
  "trial_end": "ISO date",
  "created_at": "ISO date"
}
```

### Collection: `convenzioni`
```json
{
  "codice": "UNION50",
  "tipo_sconto": "percent|fixed",
  "valore": 50.0,
  "applica_a": "annuale|mensile|entrambi",
  "attivo": true,
  "scadenza": "ISO date opzionale"
}
```

### Collection: `richieste_buoni`
```json
{
  "id": "uuid",
  "user_id": "id_utente",
  "importo": 20.0,
  "stato": "pending|approved|sent",
  "data_richiesta": "ISO date",
  "codice_buono_inviato": "string opzionale"
}
```

---

## 4. UI/UX — Stile Neomorphic Gold

### Palette
- **Sfondo**: Crema `#F5F0E6`
- **Card**: `#FBF6E8`
- **Accenti / Pulsanti**: Arancione/Oro `#E8A060`
- **Bordo enfasi**: `#E8A060` con boxShadow ambrato
- **Testo principale**: `#1A4040`
- **Testo secondario**: `#5A7575`

### Pagina "Premi & Inviti"
1. **Header**: Logo / nome attività + saldo abbonamento ("Pagato fino al [Data]")
2. **Card Codice Referral**:
   - Codice grande con effetto goffratura (neomorphic)
   - Pulsanti: `[Copia]` `[Condividi WhatsApp]` `[Condividi email]`
3. **Card Lista Amici**:
   - Es: "Marco — Abbonato (+1 mese)" / "Luca — In Prova"
   - Conteggio totale e quanti hanno completato il pagamento
4. **Card Mesi Bonus**:
   - Bar di progresso 0/12
   - "Hai accumulato X mesi gratis"
5. **Widget Salvadanaio**:
   - Visualizzazione credito €X / €20
   - Pulsante `[Richiedi Buono Carburante]` (attivo solo sopra soglia)
6. **Card Codice Convenzione**:
   - Inserimento testo `[Applica codice]`
   - Mostra se attualmente attivo

---

## 5. Notifiche In-App (banner)

| Evento                         | Messaggio                                                                  |
| ------------------------------ | -------------------------------------------------------------------------- |
| Amico abbonato                 | "🎉 Ottime notizie! Un tuo collega si è abbonato. Hai guadagnato 1 mese gratis!" |
| Soglia buono raggiunta         | "💰 Hai accumulato €[Tot]! Clicca per richiedere il tuo buono carburante." |
| Trial in scadenza (3gg prima)  | "⏳ Il tuo trial finisce tra 3 giorni. Sottoscrivi per continuare."         |
| Pagamento riuscito             | "✅ Pagamento confermato. Abbonamento valido fino al [Data]."              |
| Pagamento fallito              | "⚠️ Pagamento non riuscito. Aggiorna il metodo di pagamento."             |

### Notifiche Admin (su `/admin`)
- "L'utente [Nome] ha richiesto un buono da €[Tot]" → con CTA "Invia codice"

---

## 6. Endpoint Backend (FastAPI)

### Auth & Utenti
```
POST   /api/users/register          { email, password, codice_referral_invitante? }
POST   /api/users/login             { email, password }
GET    /api/users/me                → user data
POST   /api/users/apply-codice      { codice }   → applica convenzione
```

### Stripe
```
POST   /api/stripe/create-checkout-session  { plan: 'monthly'|'yearly' }
POST   /api/stripe/cancel-subscription
POST   /api/webhooks/stripe                  ← webhook handler
```

### Referral & Premi
```
GET    /api/referral/my-link        → { codice, link_completo, count_amici, mesi_bonus, credito_buoni }
GET    /api/referral/my-friends     → lista amici invitati con stato
POST   /api/referral/redeem-buono   { importo } → crea richiesta_buono
```

### Admin (protetto)
```
GET    /api/admin/richieste-buoni
POST   /api/admin/richieste-buoni/:id/approve { codice_buono }
GET    /api/admin/convenzioni
POST   /api/admin/convenzioni       { codice, tipo, valore, ... }
PATCH  /api/admin/convenzioni/:id   { attivo, valore, ... }
DELETE /api/admin/convenzioni/:id
```

---

## 7. Webhook Stripe — Eventi da gestire

| Event                                    | Azione                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| `customer.subscription.created`          | Setta stato `trial`/`active`, salva subscription id  |
| `customer.subscription.updated`          | Aggiorna stato e data scadenza                       |
| `customer.subscription.deleted`          | Stato `cancelled`                                    |
| `invoice.payment_succeeded` (annuale)    | Se utente ha `invitato_da`: incrementa mesi bonus o credito_buoni dell'invitante. Notifica banner. |
| `invoice.payment_failed`                 | Stato `past_due` + notifica utente                   |

---

## 8. Flow Utente (riassunto)

1. **Apertura app** → schermata onboarding con campo opzionale "Codice Convenzione" + "Codice Invito".
2. **Registrazione** → 15g trial automatico.
3. **Durante trial** → utente vede badge "Trial - X giorni rimanenti" in home/settings.
4. **Pagamento** → checkout Stripe (con sconto se codice convenzione applicato).
5. **Dopo pagamento annuale** → se aveva `invitato_da`: backend incrementa mesi bonus o credito buoni dell'invitante + notifica.
6. **Pagina Premi & Inviti** → utente vede link, lista amici, salvadanaio, scadenza.
7. **Richiesta buono** → quando salvadanaio ≥ €20, può cliccare "Richiedi Buono" → admin riceve notifica → admin invia codice manualmente.

---

## 9. Tecnologie da integrare

- **Stripe** (test mode prima): SDK `stripe` Python + `@stripe/stripe-react-native` per il client
- **MongoDB** (già presente): collections sopra
- **No push notifications** per ora — solo banner in-app (Phase 1)
- **Email opzionale** futura: SendGrid o Resend (per inviare codice buono all'utente automaticamente)

---

## 10. Ordine di implementazione consigliato

1. ✅ **Placeholder UI** (questo file + `/app/frontend/app/home/premi.tsx`)
2. 🟡 **Fase A** — DB schema users/convenzioni/richieste, endpoints referral mock (no Stripe)
3. 🟡 **Fase B** — UI completa pagina Premi & Inviti collegata ai mock
4. 🟡 **Fase C** — Integrazione Stripe + webhook
5. 🟡 **Fase D** — Pannello admin + notifiche in-app

---

## 11. Domande aperte da risolvere prima di iniziare

- [ ] Chiavi Stripe test (`sk_test_...`, `pk_test_...`)
- [ ] Pannello admin: login email/password OR ruolo SUPERADMIN nei roli esistenti?
- [ ] Codici convenzione: solo da pannello admin o anche hardcoded di base?
- [ ] Il piano €6,90/mese ha lo sconto convenzione? O solo annuale?
- [ ] Trial 15 giorni: chiediamo carta all'iscrizione o solo dopo? (impact su conversione)
- [ ] Codice buono carburante: come viene generato? Lista codici pre-caricati nel DB o input manuale dell'admin?
