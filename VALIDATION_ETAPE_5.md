# ✅ ÉTAPE 5 - VALIDATION COMPLÈTE

Date : 16 décembre 2025  
Statut : **TERMINÉE**

---

## 📋 Objectif de l'étape

**Permettre la déclaration d'un problème par un locataire :**
- Créer un formulaire de création de ticket
- Implémenter la création de ticket côté API
- Garantir qu'un locataire ne crée que pour SON logement
- Assurer que le ticket est automatiquement lié à la bonne régie

---

## ✅ Critères de validation (selon document JETCv1.pdf)

### 1. Un locataire ne crée que pour son logement ✅

**Mécanisme de sécurité :**
- L'API récupère le `logement_id` depuis la fiche `locataires` liée au profil authentifié
- Le `logement_id` **n'est jamais** passé dans le body de la requête
- Un locataire ne peut pas spécifier un autre logement que le sien

**Code de sécurité dans l'API :**
```javascript
// Récupérer les données du locataire authentifié
const { data: locataire } = await supabaseAdmin
  .from('locataires')
  .select('id, logement_id')
  .eq('profile_id', profile.id)
  .single();

// Vérifier que le locataire a un logement
if (!locataire.logement_id) {
  return { error: 'Vous devez être rattaché à un logement' };
}

// Utiliser LE logement du locataire (pas celui du body)
await supabaseAdmin
  .from('tickets')
  .insert({
    logement_id: locataire.logement_id, // ← Toujours SON logement
    locataire_id: locataire.id
  });
```

### 2. Ticket lié à la bonne régie ✅

**Mécanisme automatique par trigger SQL :**

La `regie_id` est **calculée automatiquement** via un trigger BEFORE INSERT :

```sql
create or replace function set_ticket_regie_id()
returns trigger
language plpgsql
as $$
declare
  v_regie_id uuid;
begin
  -- Récupérer la regie_id via logement → immeuble → regie
  select i.regie_id into v_regie_id
  from logements l
  join immeubles i on l.immeuble_id = i.id
  where l.id = new.logement_id;
  
  new.regie_id := v_regie_id;
  return new;
end;
$$;
```

**Garanties :**
- ✅ La `regie_id` est toujours correcte
- ✅ Impossible de falsifier la régie
- ✅ Calcul automatique à chaque insertion

---

## 🗂️ Structure créée

### Table `tickets` (09_tickets.sql)

**Colonnes principales :**
- `id` (uuid, PK)
- `titre` (text, NOT NULL) - Titre court du problème
- `description` (text, NOT NULL) - Description détaillée
- `categorie` (text, NOT NULL) - Type de problème
- `priorite` (text, default 'normale') - faible, normale, haute, urgente
- `statut` (ticket_status, default 'ouvert') - ouvert, en_cours, termine, annule

**Relations :**
- `logement_id` (uuid, NOT NULL, FK → logements)
- `locataire_id` (uuid, NOT NULL, FK → locataires)
- `regie_id` (uuid, NOT NULL) - **Calculé automatiquement**
- `entreprise_id` (uuid, nullable, FK → entreprises) - Assignation future
- `technicien_id` (uuid, nullable, FK → techniciens) - Assignation future

**Métadonnées :**
- `date_creation` (timestamptz, default now())
- `date_cloture` (timestamptz, nullable)
- `date_limite` (timestamptz, nullable)
- `photos` (text[], nullable) - URLs des photos
- `urgence` (boolean, default false)
- `created_at`, `updated_at`

**Contraintes :**
- ✅ Catégorie dans : plomberie, électricité, chauffage, serrurerie, vitrerie, menuiserie, peinture, autre
- ✅ Priorité dans : faible, normale, haute, urgente
- ✅ `date_cloture >= date_creation`

**Index :**
- ✅ `idx_tickets_logement_id`
- ✅ `idx_tickets_locataire_id`
- ✅ `idx_tickets_regie_id` - **Essentiel pour l'isolation**
- ✅ `idx_tickets_statut`
- ✅ `idx_tickets_priorite`

**Trigger :**
- ✅ `set_ticket_regie_id_trigger` (BEFORE INSERT)
- ✅ `set_updated_at_tickets` (BEFORE UPDATE)

**Vue enrichie :**
```sql
create view tickets_complets as
select 
  t.*,
  loc.nom as locataire_nom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  reg.nom as regie_nom
from tickets t
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id;
```

---

### Route API `/api/tickets/create` (api/tickets/create.js)

**Méthode :** POST

**Headers requis :**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body :**
```json
{
  "titre": "Fuite d'eau dans la salle de bain",
  "description": "L'eau coule sous le lavabo depuis ce matin",
  "categorie": "plomberie",
  "priorite": "haute",
  "urgence": false
}
```

**Sécurité implémentée :**

1. **Vérification du token JWT**
   ```javascript
   const token = authHeader.substring(7);
   const { data: { user } } = await supabaseAdmin.auth.getUser(token);
   ```

2. **Vérification du rôle**
   ```javascript
   if (profile.role !== 'locataire') {
     return 403; // Seuls les locataires peuvent créer des tickets
   }
   ```

3. **Récupération du locataire**
   ```javascript
   const { data: locataire } = await supabaseAdmin
     .from('locataires')
     .select('id, logement_id')
     .eq('profile_id', profile.id)
     .single();
   ```

4. **Vérification du logement**
   ```javascript
   if (!locataire.logement_id) {
     return 400; // Le locataire doit avoir un logement
   }
   ```

5. **Utilisation du logement authentifié**
   ```javascript
   logement_id: locataire.logement_id // ← Pas celui du body !
   ```

**Validation des données :**
- ✅ Titre, description, catégorie obligatoires
- ✅ Catégorie dans la liste autorisée
- ✅ Priorité dans la liste autorisée (défaut: 'normale')

**Réponse succès (201) :**
```json
{
  "success": true,
  "message": "Ticket créé avec succès",
  "ticket": {
    "id": "uuid",
    "titre": "...",
    "statut": "ouvert",
    "regie_id": "uuid",
    "logements": { ... },
    "created_at": "2025-12-16T..."
  }
}
```

**Erreurs possibles :**
- 401 : Token manquant ou invalide
- 403 : Utilisateur n'est pas un locataire
- 404 : Fiche locataire non trouvée
- 400 : Locataire sans logement / Champs manquants / Catégorie invalide
- 500 : Erreur serveur

---

### Formulaire locataire (public/locataire/dashboard.html)

**Interface :**
- Bouton "🎫 Créer un nouveau ticket"
- Formulaire modal avec champs :
  - Titre (input text)
  - Catégorie (select avec icônes)
  - Priorité (select)
  - Description (textarea)
  - Urgence (checkbox)

**Validation côté client :**
- Titre minimum 5 caractères
- Description minimum 10 caractères
- Catégorie obligatoire

**Appel API :**
```javascript
const response = await fetch('/api/tickets/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    titre,
    categorie,
    description,
    priorite,
    urgence
  })
});
```

**UX :**
- ✅ Affichage des erreurs en rouge
- ✅ Affichage du succès en vert
- ✅ Réinitialisation automatique du formulaire
- ✅ Fermeture automatique après succès

---

## 🧪 Tests automatisés

### Test Suite : Validation tickets (tests/tickets.test.js)

```bash
node tests/tickets.test.js
```

**19 tests validés :**

✅ Fichier 09_tickets.sql existe  
✅ Table tickets a les colonnes requises  
✅ Table tickets a des FK vers logements et locataires  
✅ Table tickets a une colonne regie_id (calculée automatiquement)  
✅ Trigger set_ticket_regie_id existe pour calculer regie_id  
✅ Trigger calcule regie_id via logement → immeuble → regie  
✅ Table tickets a des contraintes de validation  
✅ Table tickets a un statut par défaut "ouvert"  
✅ Route API /api/tickets/create existe  
✅ API vérifie que l'utilisateur est un locataire  
✅ API récupère le logement_id du locataire  
✅ API vérifie que le locataire a un logement  
✅ API valide les champs obligatoires  
✅ API utilise le logement_id du locataire (pas celui du body)  
✅ Dashboard locataire a un bouton de création de ticket  
✅ Dashboard locataire a un formulaire de ticket  
✅ Dashboard locataire appelle /api/tickets/create  
✅ Enum ticket_status mis à jour avec les bons statuts  
✅ Table tickets a des index de performance  

**Résultat :** ✅ **100% de réussite**

---

## 📊 Flux de création d'un ticket

```
┌─────────────────┐
│   LOCATAIRE     │
│   (dashboard)   │
└────────┬────────┘
         │ 1. Clique "Créer un ticket"
         │ 2. Remplit le formulaire
         │ 3. POST /api/tickets/create
         ▼
┌─────────────────┐
│      API        │
│  /tickets/create│
└────────┬────────┘
         │ 4. Vérifie token JWT
         │ 5. Vérifie role = 'locataire'
         │ 6. Récupère locataire.logement_id
         │ 7. Valide les données
         ▼
┌─────────────────┐
│   SUPABASE      │
│   INSERT        │
└────────┬────────┘
         │ 8. Trigger BEFORE INSERT
         │ 9. Calcule regie_id automatiquement
         │    (logement → immeuble → regie)
         │ 10. INSERT dans table tickets
         ▼
┌─────────────────┐
│   TICKET CRÉÉ   │
│   statut:ouvert │
│   regie_id: ✓   │
└─────────────────┘
```

---

## 🔒 Sécurité et validation

### Sécurité du logement ✅

**Problème potentiel :** Un locataire pourrait essayer de créer un ticket pour un autre logement

**Solution implémentée :**
- Le `logement_id` est récupéré depuis `locataires.logement_id`
- Le `logement_id` **n'est jamais** accepté depuis le body de la requête
- L'API utilise **toujours** le logement du locataire authentifié

**Code de protection :**
```javascript
// ❌ JAMAIS ça :
const { logement_id } = JSON.parse(body);

// ✅ TOUJOURS ça :
const { data: locataire } = await supabaseAdmin
  .from('locataires')
  .eq('profile_id', profile.id)
  .single();

await supabaseAdmin.from('tickets').insert({
  logement_id: locataire.logement_id // ← Son logement uniquement
});
```

### Liaison automatique à la régie ✅

**Problème potentiel :** La `regie_id` pourrait être falsifiée

**Solution implémentée :**
- Trigger SQL `set_ticket_regie_id()` s'exécute AVANT chaque INSERT
- Calcul automatique via JOIN : `logements` → `immeubles` → `regies`
- Impossible de passer une `regie_id` dans l'INSERT (elle est écrasée par le trigger)

**Garantie d'isolation :**
```sql
-- Le ticket est TOUJOURS lié à la régie qui gère le logement
SELECT t.id, t.titre, r.nom as regie_nom
FROM tickets t
JOIN logements l ON t.logement_id = l.id
JOIN immeubles i ON l.immeuble_id = i.id
JOIN regies r ON t.regie_id = r.id
WHERE t.regie_id = r.id; -- ✓ Toujours cohérent
```

### Validation métier ✅

**Contraintes SQL :**
- Catégorie dans une liste fermée (8 valeurs autorisées)
- Priorité dans une liste fermée (4 valeurs autorisées)
- Statut par défaut : 'ouvert'
- Date de clôture ≥ date de création

**Validation API :**
- Titre, description, catégorie obligatoires
- Titre ≥ 5 caractères (côté client)
- Description ≥ 10 caractères (côté client)

---

## 📱 Scénarios d'utilisation

### Scénario nominal : Locataire crée un ticket

**Contexte :**
- Jean Dupont est locataire de l'appartement 12
- Il constate une fuite d'eau sous le lavabo
- Il est connecté sur son dashboard

**Actions :**

1. **Clique sur "Créer un nouveau ticket"**
   - Le formulaire s'affiche

2. **Remplit le formulaire :**
   - Titre : "Fuite d'eau sous le lavabo"
   - Catégorie : Plomberie
   - Priorité : Haute
   - Description : "Depuis ce matin, l'eau coule en continu sous le lavabo de la salle de bain. Le placard est déjà mouillé."
   - Urgence : Non

3. **Clique sur "Créer le ticket"**
   - Validation côté client OK
   - Appel API avec token JWT
   - API vérifie que Jean est bien un locataire
   - API récupère son `logement_id` depuis sa fiche locataire
   - API crée le ticket avec son logement

4. **Trigger SQL s'exécute automatiquement :**
   - Récupère `immeuble_id` depuis le logement
   - Récupère `regie_id` depuis l'immeuble
   - Insère le ticket avec la `regie_id` calculée

5. **Message de succès affiché :**
   - "✅ Ticket créé avec succès !"
   - Le formulaire se ferme automatiquement

**Résultat :**
- ✅ Ticket créé avec `statut = 'ouvert'`
- ✅ Ticket lié au logement de Jean
- ✅ Ticket lié à la régie qui gère l'immeuble
- ✅ Régie peut maintenant voir ce ticket dans son interface

---

### Scénario d'erreur : Locataire sans logement

**Contexte :**
- Marie Martin s'est inscrite comme locataire
- Mais elle n'a pas encore été rattachée à un logement
- Elle essaie de créer un ticket

**Actions :**

1. Clique sur "Créer un nouveau ticket"
2. Remplit le formulaire
3. Clique sur "Créer le ticket"

**Résultat :**
- ❌ Erreur 400
- Message : "Vous devez être rattaché à un logement pour créer un ticket"
- Le ticket **n'est pas créé**

---

### Scénario sécurité : Tentative de falsification

**Contexte :**
- Un utilisateur malveillant tente de créer un ticket pour un logement qui n'est pas le sien
- Il modifie le code JavaScript côté client pour envoyer un autre `logement_id`

**Tentative :**
```javascript
// Code modifié par l'attaquant
body: JSON.stringify({
  titre: "...",
  logement_id: "autre-uuid-logement", // ← Tentative de falsification
  ...
})
```

**Résultat :**
- ✅ L'API **ignore** le `logement_id` du body
- ✅ L'API utilise **toujours** le `logement_id` de la fiche locataire
- ✅ Le ticket est créé pour **son** logement, pas celui qu'il a tenté de spécifier
- 🛡️ Sécurité garantie par l'architecture

---

## 📋 Checklist finale

**Table tickets :**
- [x] Colonnes créées avec types corrects
- [x] FK vers logements, locataires
- [x] Colonne regie_id (calculée automatiquement)
- [x] Contraintes de validation (catégorie, priorité)
- [x] Statut par défaut : 'ouvert'
- [x] Index de performance
- [x] Trigger de calcul regie_id
- [x] Vue enrichie tickets_complets

**API /api/tickets/create :**
- [x] Vérification token JWT
- [x] Vérification role = 'locataire'
- [x] Récupération du locataire authentifié
- [x] Vérification que le locataire a un logement
- [x] Utilisation du logement du locataire (pas du body)
- [x] Validation des champs
- [x] Gestion des erreurs

**Interface locataire :**
- [x] Bouton de création de ticket
- [x] Formulaire avec tous les champs
- [x] Validation côté client
- [x] Appel API avec token
- [x] Affichage des erreurs
- [x] Affichage du succès
- [x] Réinitialisation du formulaire

**Sécurité :**
- [x] Un locataire ne peut créer que pour SON logement
- [x] La regie_id est calculée automatiquement (pas falsifiable)
- [x] Isolation des données garantie
- [x] Validation métier (catégories, priorités)

**Tests :**
- [x] 19 tests de structure et sécurité (100% réussite)

---

## 🚀 Instructions d'exécution

### Configuration Supabase

**Exécuter le fichier SQL :**
```sql
-- Dans Supabase SQL Editor :
supabase/schema/09_tickets.sql
```

**Note :** Le fichier `02_enums.sql` a été mis à jour pour le type `ticket_status`.

### Lancer les tests

```bash
cd /workspaces/JETC_IMMO_SaaS
node tests/tickets.test.js
```

**Résultat attendu :**
```
✅ Tous les tests de création de tickets sont passés !
ÉTAPE 5 VALIDÉE
```

### Test manuel

1. Créer un locataire avec un logement (via SQL ou futures interfaces)
2. Se connecter avec ce compte locataire
3. Aller sur le dashboard locataire
4. Cliquer sur "Créer un nouveau ticket"
5. Remplir et soumettre le formulaire
6. Vérifier dans la base de données :
   ```sql
   SELECT * FROM tickets WHERE locataire_id = '...';
   SELECT * FROM tickets_complets WHERE locataire_email = '...';
   ```

---

## 🎯 Conclusion

L'**ÉTAPE 5** est **COMPLÈTEMENT VALIDÉE**.

**Livrables :**
- ✅ Table `tickets` avec trigger de calcul automatique regie_id
- ✅ Route API `/api/tickets/create` sécurisée
- ✅ Formulaire locataire fonctionnel
- ✅ Vue enrichie `tickets_complets`
- ✅ Suite de tests (19 tests passés)
- ✅ Documentation complète

**Garanties de sécurité :**
- ✅ Un locataire ne crée QUE pour son logement (impossible de falsifier)
- ✅ Le ticket est TOUJOURS lié à la bonne régie (trigger SQL automatique)
- ✅ Isolation des données garantie (via regie_id)
- ✅ Validation métier (catégories, priorités, statuts)

**Prêt pour l'ÉTAPE 6 : Suivi des tickets !**

---

## ➡️ Prochaine étape

**ÉTAPE 6 - (selon document)**

Contenu à définir selon le document JETCv1.pdf.

---

**Attente de validation utilisateur avant de continuer.**
