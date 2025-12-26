# M12 – Correction API /tickets/create (Documentation)

## 📋 Contexte

Migration **M12** - Phase 3 (Sécurisation & Cohérence workflow)

**Type** : Documentation uniquement (pas de fichier SQL)

**Date** : 2025-12-26

---

## 🔴 Problème identifié

L'API `/api/tickets/create` force explicitement le statut `ouvert` lors de la création d'un ticket, **contournant le DEFAULT SQL** de la table `tickets`.

### État AVANT (code problématique)

```javascript
// Fichier : api/tickets/create.js (ou équivalent)

const { data, error } = await supabase
  .from('tickets')
  .insert({
    titre: req.body.titre,
    description: req.body.description,
    categorie: req.body.categorie,
    priorite: req.body.priorite,
    locataire_id: locataireId,
    logement_id: logementId,
    regie_id: regieId,
    statut: 'ouvert'  // ❌ ERREUR : Force le statut, ignore DEFAULT SQL
  })
  .select()
  .single();
```

**Conséquence** :
- Le ticket est créé directement en statut `ouvert`
- Le statut `nouveau` (DEFAULT SQL) n'est jamais utilisé
- Incohérence avec le workflow métier attendu :
  - `nouveau` : Ticket créé, pas encore traité par la régie
  - `ouvert` : Ticket validé et pris en charge par la régie

---

## ✅ Solution attendue

Supprimer la ligne `statut: 'ouvert'` et laisser PostgreSQL appliquer le DEFAULT SQL.

### État APRÈS (code corrigé)

```javascript
// Fichier : api/tickets/create.js (ou équivalent)

const { data, error } = await supabase
  .from('tickets')
  .insert({
    titre: req.body.titre,
    description: req.body.description,
    categorie: req.body.categorie,
    priorite: req.body.priorite,
    locataire_id: locataireId,
    logement_id: logementId,
    regie_id: regieId
    // ✅ PAS de statut : PostgreSQL applique DEFAULT 'nouveau'
  })
  .select()
  .single();
```

**Effet** :
- Le ticket est créé en statut `nouveau` (DEFAULT SQL)
- La régie voit le ticket et peut le valider (transition `nouveau` → `ouvert`)
- Workflow cohérent avec les règles métier

---

## 🔍 Fichiers concernés

Rechercher dans la codebase :

```bash
grep -r "statut.*:.*'ouvert'" api/tickets/
grep -r "statut.*:.*\"ouvert\"" api/tickets/
grep -r ".insert(" api/tickets/create*
```

**Fichiers probables** :
- `api/tickets/create.js`
- `src/services/ticketService.js`
- `src/api/tickets.js`

---

## ✅ Validation post-correction

### Test 1 : Création ticket via API (staging)

```bash
# POST /api/tickets/create
curl -X POST https://<staging-url>/api/tickets/create \
  -H "Authorization: Bearer <jwt_locataire>" \
  -H "Content-Type: application/json" \
  -d '{
    "titre": "Test M12",
    "description": "Validation statut nouveau",
    "categorie": "plomberie",
    "priorite": "normale"
  }'
```

**Attendu** :
- HTTP 200
- JSON retourné contient `"statut": "nouveau"` (pas "ouvert")

### Test 2 : Vérification directe SQL (staging)

```sql
-- Après création ticket via API
SELECT id, titre, statut, created_at 
FROM tickets 
WHERE titre = 'Test M12'
ORDER BY created_at DESC 
LIMIT 1;
```

**Attendu** : 1 ligne avec `statut = 'nouveau'`

### Test 3 : Transition régie nouveau → ouvert (staging)

```bash
# Régie valide le ticket
curl -X POST https://<staging-url>/api/tickets/<ticket_id>/validate \
  -H "Authorization: Bearer <jwt_regie>"
```

**Attendu** :
- HTTP 200
- Statut passe de `nouveau` → `ouvert`

---

## 📊 Impact

| Composant | Impact | Action requise |
|-----------|--------|----------------|
| **API create** | 🟡 Moyen | Supprimer `statut: 'ouvert'` |
| **Base de données** | ✅ Aucun | DEFAULT SQL déjà correct |
| **Frontend locataire** | ✅ Aucun | Affiche statut retourné par API |
| **Dashboard régie** | ✅ Positif | Voit tickets `nouveau` à traiter |
| **Tests E2E** | 🟡 Moyen | Adapter tests attendant `ouvert` |

---

## ⚠️ Risques résiduels

### 🟢 Faible : Tickets legacy en statut `ouvert`

**Contexte** : Tickets créés AVANT correction ont statut `ouvert` directement.

**Mitigation** : Acceptable, pas de migration data nécessaire. Les nouveaux tickets respectent le workflow.

### 🟢 Faible : Tests unitaires cassés

**Contexte** : Tests API qui vérifient `statut === 'ouvert'` après création échoueront.

**Mitigation** : Adapter tests pour vérifier `statut === 'nouveau'`.

---

## 🔗 Dépendances

- **Aucune migration SQL** requise
- Modification **code applicatif uniquement** (API/services)
- Pas d'impact sur PHASE 1/2/3 SQL

---

## 📌 Checklist correction

- [ ] Identifier fichier(s) API contenant `statut: 'ouvert'` à la création
- [ ] Supprimer ligne forçant statut
- [ ] Vérifier aucun autre endpoint ne force statut invalide
- [ ] Adapter tests unitaires API (attendu `nouveau` pas `ouvert`)
- [ ] Valider en staging (Test 1, 2, 3 ci-dessus)
- [ ] Déployer en production

---

**Fin documentation M12**
