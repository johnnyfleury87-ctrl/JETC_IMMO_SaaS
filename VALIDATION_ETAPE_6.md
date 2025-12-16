# ✅ VALIDATION ÉTAPE 6 - Diffusion des tickets aux entreprises

**Date** : 2025  
**Statut** : ✅ **VALIDÉE** (21/21 tests réussis)

---

## 📋 Objectifs de l'ÉTAPE 6

Mettre en place le système de **diffusion des tickets** aux entreprises de maintenance :
- Gérer les entreprises autorisées par régie
- Implémenter les **modes de diffusion** (général vs restreint)
- Contrôler la visibilité des tickets par entreprise
- Garantir la sécurité : entreprise non autorisée = aucun ticket visible

---

## 🗂️ Structure créée

### 1. Table `entreprises`

Stocke les entreprises de maintenance avec leurs spécialités.

**Fichier** : `supabase/schema/10_entreprises.sql`

**Colonnes** :
- `id` (uuid, PK)
- `nom` (text, unique)
- `siret` (text)
- `email` (text avec validation)
- `telephone` (text)
- `specialites` (text[]) - tableau de spécialités
- `profile_id` (uuid, FK → profiles)
- `created_at` (timestamp)

**Contraintes** :
- ✅ FK vers `profiles` (compte utilisateur)
- ✅ Nom unique (`unique_entreprise_nom`)
- ✅ Email validé (`check_email_format`)
- ✅ Index sur `profile_id`

---

### 2. Table `regies_entreprises`

Table de liaison : quelles entreprises sont **autorisées** par quelles régies, avec leur **mode de diffusion**.

**Fichier** : `supabase/schema/10_entreprises.sql`

**Colonnes** :
- `id` (uuid, PK)
- `regie_id` (uuid, FK → regies)
- `entreprise_id` (uuid, FK → entreprises)
- `mode_diffusion` (text) : `'general'` ou `'restreint'`
- `created_at` (timestamp)

**Contraintes** :
- ✅ FK vers `regies` et `entreprises`
- ✅ Contrainte unique sur `(regie_id, entreprise_id)` - une entreprise ne peut être autorisée qu'une fois par régie
- ✅ Check sur `mode_diffusion` : uniquement `'general'` ou `'restreint'`
- ✅ Index sur `regie_id` et `entreprise_id`

---

### 3. Vue `tickets_visibles_entreprise`

Vue intelligente qui calcule les tickets visibles pour chaque entreprise selon :
1. Les **autorisations** (table `regies_entreprises`)
2. Le **mode de diffusion** :
   - **Mode général** : tous les tickets `ouvert` de la régie
   - **Mode restreint** : uniquement les tickets assignés à l'entreprise

**Fichier** : `supabase/schema/10_entreprises.sql`

**Colonnes retournées** :
- Toutes les colonnes de `tickets`
- `entreprise_id` (l'entreprise qui peut voir ce ticket)
- `mode_diffusion` (le mode appliqué)

**Logique SQL** :
```sql
-- Mode général : tous les tickets ouverts
WHERE re.mode_diffusion = 'general' AND t.statut = 'ouvert'

UNION

-- Mode restreint : tickets assignés uniquement
WHERE re.mode_diffusion = 'restreint' 
  AND t.entreprise_assignee_id = re.entreprise_id
```

---

## 🔌 API créée

### Route : `GET /api/tickets/entreprise`

Liste les tickets visibles par l'entreprise connectée.

**Fichier** : `api/tickets/entreprise.js`

**Sécurité** :
1. ✅ Vérifie que l'utilisateur est authentifié
2. ✅ Vérifie que `role = 'entreprise'`
3. ✅ Retourne 403 si ce n'est pas une entreprise

**Logique** :
1. Récupère l'`entreprise_id` depuis `profiles.id`
2. Interroge la vue `tickets_visibles_entreprise` avec filtre sur `entreprise_id`
3. Retourne un tableau vide si aucune autorisation

**Exemple de réponse** :
```json
{
  "tickets": [
    {
      "id": "uuid",
      "titre": "Fuite d'eau",
      "description": "...",
      "statut": "ouvert",
      "categorie": "plomberie",
      "priorite": "haute",
      "mode_diffusion": "general",
      "entreprise_id": "uuid-entreprise"
    }
  ]
}
```

---

## 🧪 Tests de validation

**Fichier** : `tests/diffusion.test.js`

### Résultats

✅ **21/21 tests réussis**

### Catégories testées

#### Structure SQL (11 tests)
1. ✅ Fichier 10_entreprises.sql existe
2. ✅ Table entreprises créée avec colonnes requises
3. ✅ Table entreprises a une FK vers profiles
4. ✅ Table regies_entreprises créée (table de liaison)
5. ✅ Table regies_entreprises a des FK vers regies et entreprises
6. ✅ Table regies_entreprises a une colonne mode_diffusion
7. ✅ Contrainte unique sur (regie_id, entreprise_id)
8. ✅ Contrainte check sur mode_diffusion
9. ✅ Table entreprises a des index de performance
10. ✅ Table entreprises a un nom unique
11. ✅ Table entreprises a une validation email

#### Vue tickets_visibles_entreprise (4 tests)
12. ✅ Vue tickets_visibles_entreprise créée
13. ✅ Vue utilise la table regies_entreprises
14. ✅ Vue gère le mode général (tous les tickets ouverts)
15. ✅ Vue gère le mode restreint (seulement tickets assignés)

#### API /api/tickets/entreprise (6 tests)
16. ✅ Route API /api/tickets/entreprise existe
17. ✅ API vérifie que l'utilisateur est une entreprise
18. ✅ API récupère l'entreprise depuis profile_id
19. ✅ API utilise la vue tickets_visibles_entreprise
20. ✅ API filtre par entreprise_id
21. ✅ API retourne un tableau vide si aucune autorisation

---

## 🔒 Garanties de sécurité

### 1. Entreprise non autorisée = aucun ticket visible
- ✅ Si `regies_entreprises` ne contient pas d'entrée, la vue retourne 0 ligne
- ✅ L'API retourne `[]` (tableau vide)

### 2. Mode général contrôlé
- ✅ Seuls les tickets `ouvert` sont visibles
- ✅ Seules les régies ayant autorisé l'entreprise sont incluses

### 3. Mode restreint sécurisé
- ✅ Seuls les tickets avec `entreprise_assignee_id = entreprise_id` sont visibles
- ✅ Pas de possibilité de voir les tickets d'autres entreprises

### 4. Isolation par régie
- ✅ Chaque entreprise ne voit que les tickets des régies qui l'ont autorisée
- ✅ Pas de fuite de données entre régies

---

## 📊 Schéma du système de diffusion

```
RÉGIE 1
  ├─ Autorisation 1 → Entreprise A (mode: general)
  │   └─ Voit : TOUS les tickets "ouvert" de Régie 1
  │
  └─ Autorisation 2 → Entreprise B (mode: restreint)
      └─ Voit : UNIQUEMENT les tickets assignés à Entreprise B

RÉGIE 2
  └─ Autorisation 3 → Entreprise A (mode: restreint)
      └─ Voit : UNIQUEMENT les tickets assignés à Entreprise A

Entreprise C (non autorisée)
  └─ Voit : RIEN
```

---

## 🎯 Critères de validation ÉTAPE 6

| Critère | Statut | Détails |
|---------|--------|---------|
| **Table entreprises créée** | ✅ | Avec spécialités, email, téléphone |
| **Table regies_entreprises créée** | ✅ | Liaison avec mode_diffusion |
| **Mode général implémenté** | ✅ | Tous les tickets ouverts visibles |
| **Mode restreint implémenté** | ✅ | Uniquement tickets assignés |
| **Vue tickets_visibles_entreprise** | ✅ | Calcule la visibilité automatiquement |
| **API GET /api/tickets/entreprise** | ✅ | Retourne les tickets filtrés |
| **Sécurité : entreprise non autorisée** | ✅ | Retourne tableau vide |
| **Contrainte unique (regie, entreprise)** | ✅ | Évite les doublons d'autorisation |
| **Check sur mode_diffusion** | ✅ | Uniquement 'general' ou 'restreint' |
| **Tests automatisés** | ✅ | 21 tests passés |

---

## 🚀 Prochaine étape

**ÉTAPE 7** : Interface entreprise (dashboard, liste des tickets, acceptation)

---

## 📝 Commandes de test

```bash
# Lancer les tests ÉTAPE 6
node tests/diffusion.test.js

# Résultat attendu
✅ 21/21 tests réussis
ÉTAPE 6 VALIDÉE
```

---

## 📅 Historique

- **ÉTAPE 0** : ✅ Initialisation (healthcheck, Supabase)
- **ÉTAPE 1** : ✅ Landing page multilingue
- **ÉTAPE 2** : ✅ Authentification (register, login, me)
- **ÉTAPE 3** : ✅ Profiles avec trigger automatique
- **ÉTAPE 4** : ✅ Structure immobilière (régies, immeubles, logements, locataires)
- **ÉTAPE 5** : ✅ Création de tickets par les locataires
- **ÉTAPE 6** : ✅ **Diffusion des tickets aux entreprises** ⬅ ACTUEL
- **ÉTAPE 7** : 🔜 À venir

---

**✅ ÉTAPE 6 COMPLÈTE ET VALIDÉE**
