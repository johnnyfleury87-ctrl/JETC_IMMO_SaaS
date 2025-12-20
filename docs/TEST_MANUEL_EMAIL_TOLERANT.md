# 🧪 GUIDE TEST MANUEL - Email Non-Bloquant

## ⚡ Test rapide (5 minutes)

### 1️⃣ Préparation
```bash
# Terminal 1 : Démarrer le serveur
cd /workspaces/JETC_IMMO_SaaS
npm start

# Terminal 2 : Observer les logs
tail -f logs/server.log  # ou simplement regarder Terminal 1
```

### 2️⃣ Créer une régie test

**URL :** http://localhost:3000/register.html

**Remplir le formulaire :**
- Nom agence : `Test Email Tolérant`
- Email : `test-tolerant@exemple.ch`
- Mot de passe : `Test1234!`
- Téléphone : `+41 22 123 45 67`
- Adresse : `Rue du Test 1, 1200 Genève`
- ✅ Cocher "J'accepte les CGU"

**Cliquer :** `Créer mon compte`

**Résultat attendu :**
- ✅ Message "Compte créé avec succès"
- ✅ Redirect vers `/login.html`
- ⚠️ Dans les logs serveur : `[EMAIL][NON-BLOQUANT]` (email de confirmation non envoyé)

---

### 3️⃣ Se connecter en admin

**URL :** http://localhost:3000/admin/dashboard.html

**Credentials admin :** (à adapter selon votre config)
- Email : `admin@jetc.ch`
- Mot de passe : `VotreMotDePasse`

**Vérifier :**
- ✅ Section "Demandes d'adhésion en attente"
- ✅ Voir la régie "Test Email Tolérant" avec statut "🟡 En attente"

---

### 4️⃣ Valider la régie

**Action :** Cliquer sur le bouton "✅ Valider" de la régie test

**Dans les logs serveur, vous DEVEZ voir :**
```log
[ADMIN/VALIDATION] Tentative validation régie: <uuid>
[ADMIN/VALIDATION] RPC valider_agence appelé
[ADMIN/VALIDATION] ✅ Validation réussie en BDD
[ADMIN/VALIDATION] Envoi email de validation...
[EMAIL][NON-BLOQUANT] Validation réussie mais email non envoyé: Missing credentials for 'PLAIN'
[ADMIN/VALIDATION] ⚠️ Validation réussie malgré échec email (SMTP non configuré?)
```

**Dans le dashboard admin :**
- ✅ La régie disparaît de "En attente"
- ✅ Message "Régie validée avec succès"
- ✅ Aucun crash, aucune erreur

---

### 5️⃣ Vérifier la base de données

**Option 1 : Via Supabase Dashboard**
```sql
SELECT 
  nom_agence,
  statut_validation,
  date_validation,
  admin_validateur_id
FROM regies
WHERE nom_agence = 'Test Email Tolérant';
```

**Résultat attendu :**
- `statut_validation` = `'valide'` ✅
- `date_validation` = `<timestamp récent>` ✅
- `admin_validateur_id` = `<uuid admin>` ✅

**Option 2 : Via psql**
```bash
psql $DATABASE_URL -c "SELECT nom_agence, statut_validation, date_validation FROM regies WHERE nom_agence = 'Test Email Tolérant';"
```

---

### 6️⃣ Tester l'accès dashboard régie

**URL :** http://localhost:3000/login.html

**Credentials régie :**
- Email : `test-tolerant@exemple.ch`
- Mot de passe : `Test1234!`

**Résultat attendu :**
- ✅ Connexion réussie
- ✅ Redirect vers `/regie/dashboard.html`
- ✅ Accès au dashboard régie (pas de blocage "En attente de validation")

---

### 7️⃣ Test refus (optionnel)

**Créer une 2e régie test** (répéter étape 2 avec `test-refus@exemple.ch`)

**Dans admin dashboard :**
- Cliquer "❌ Refuser" sur la nouvelle régie
- Saisir commentaire : `Test workflow refus sans SMTP`
- Valider

**Logs attendus :**
```log
[ADMIN/VALIDATION] Refus régie: <uuid>
[ADMIN/VALIDATION] RPC refuser_agence appelé
[ADMIN/VALIDATION] ✅ Refus enregistré en BDD
[ADMIN/VALIDATION] Envoi email de refus...
[EMAIL][NON-BLOQUANT] Refus enregistré mais email non envoyé: Missing credentials for 'PLAIN'
```

**BDD :**
- `statut_validation` = `'refuse'`
- `date_refus` = `<timestamp>`
- `commentaire_refus` = `'Test workflow refus sans SMTP'`

---

## ✅ Checklist de validation

### Comportement attendu (sans SMTP)

- [ ] Régie peut s'inscrire (email confirmation non envoyé)
- [ ] Admin voit régie en attente
- [ ] Admin peut valider → BDD mise à jour
- [ ] Logs montrent `[EMAIL][NON-BLOQUANT]`
- [ ] **AUCUN crash API**
- [ ] Frontend reçoit réponse 200 OK
- [ ] Régie peut se connecter et accéder dashboard
- [ ] Admin peut refuser → BDD mise à jour
- [ ] Commentaire refus enregistré

### Comportement NON attendu (erreurs)

- [ ] ❌ API crash avec "TypeError: Cannot read property..."
- [ ] ❌ Frontend reçoit erreur 500
- [ ] ❌ Régie reste en attente malgré validation
- [ ] ❌ `statut_validation` non mis à jour en BDD
- [ ] ❌ Impossibilité d'accès dashboard régie après validation

---

## 🔍 Debugging si problème

### Erreur "API crash"
```bash
# Vérifier les logs serveur
tail -f logs/server.log

# Chercher stack trace
grep -A 10 "Error:" logs/server.log
```

### Erreur "Régie reste en attente"
```sql
-- Vérifier le statut en BDD
SELECT * FROM regies WHERE nom_agence = 'Test Email Tolérant';

-- Vérifier logs RPC
SELECT * FROM logs_admin WHERE action LIKE '%valider_agence%';
```

### Erreur "Cannot connect to database"
```bash
# Vérifier connexion Supabase
grep SUPABASE_URL .env
curl $SUPABASE_URL/rest/v1/ -H "apikey: $SUPABASE_ANON_KEY"
```

---

## 📊 Logs de succès complets

### Validation réussie sans SMTP
```log
[2025-12-20 14:30:15] [ADMIN/VALIDATION] Requête reçue : action=validation, regie_id=abc123
[2025-12-20 14:30:15] [AUTH] Token Bearer valide pour admin@jetc.ch
[2025-12-20 14:30:15] [AUTH] Rôle vérifié : admin_jtec ✅
[2025-12-20 14:30:15] [ADMIN/VALIDATION] Tentative validation régie: abc123
[2025-12-20 14:30:15] [ADMIN/VALIDATION] RPC valider_agence appelé avec p_regie_id=abc123
[2025-12-20 14:30:16] [ADMIN/VALIDATION] ✅ Validation réussie en BDD
[2025-12-20 14:30:16] [ADMIN/VALIDATION] Envoi email de validation...
[2025-12-20 14:30:16] [EMAIL SERVICE] Tentative création transporter SMTP
[2025-12-20 14:30:16] [EMAIL SERVICE] ⚠️ Variables SMTP manquantes (SMTP_HOST, SMTP_USER, SMTP_PASS)
[2025-12-20 14:30:16] [EMAIL][NON-BLOQUANT] Validation réussie mais email non envoyé: Missing credentials for 'PLAIN'
[2025-12-20 14:30:16] [ADMIN/VALIDATION] ⚠️ Validation réussie malgré échec email (SMTP non configuré?)
[2025-12-20 14:30:16] [ADMIN/VALIDATION] Réponse 200 OK renvoyée au frontend
```

---

## 🚀 Étape suivante : Configuration SMTP

Une fois les tests manuels validés, configurez SMTP pour activer les emails :

```env
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@jetc.ch
SMTP_PASS=<your_app_password>  # Gmail App Password, pas mot de passe normal
EMAIL_FROM=noreply@jetc.ch
```

**Guide détaillé :** [docs/SMTP_SETUP.md](../docs/SMTP_SETUP.md)

---

**Temps estimé :** 5-10 minutes  
**Prérequis :** Serveur démarré, admin créé en BDD  
**Difficulté :** ⭐ Facile
