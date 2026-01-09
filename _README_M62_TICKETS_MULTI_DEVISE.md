# 📊 PATCH M62 - Multi-devises tickets

## 🎯 Problème identifié

**Contrainte bloquante** : `check_devise_chf` sur table `tickets` 

```sql
-- Migration M01 (26 déc 2025)
ALTER TABLE tickets ADD CONSTRAINT check_devise_chf 
CHECK (devise = 'CHF');  -- ❌ Bloque tous les tickets EUR
```

Cette contrainte **empêche la création de tickets France** qui doivent utiliser `devise = 'EUR'`.

## ✅ Solution M62

Migration ciblée qui remplace la contrainte CHF-only par une contrainte multi-devises.

### Changement technique

| Avant M62 | Après M62 |
|-----------|-----------|
| `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| Contrainte: `check_devise_chf` | Contrainte: `check_devise_multi_pays` |

### Code SQL

```sql
-- 1. Supprimer contrainte CHF-only
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;

-- 2. Ajouter contrainte multi-devises
ALTER TABLE tickets ADD CONSTRAINT check_devise_multi_pays
CHECK (devise IN ('CHF', 'EUR'));
```

## 🚀 Application

### Fichier migration

```
supabase/migrations/20260109000003_m62_tickets_multi_devise.sql
```

### Procédure

1. **Ouvrir Dashboard Supabase**
   - SQL Editor → New Query

2. **Copier-coller le contenu de** [20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)

3. **Exécuter (RUN)**

4. **Vérifier le résultat**
   ```
   ✅ M62 OK: tickets.devise accepte CHF et EUR
   
   Total tickets : X
   Tickets CHF : X
   Tickets EUR : 0
   ```

### Test post-migration

```bash
node _test_m62_ticket_multi_devise.js
```

**Attendu** :
- ✅ Création ticket CHF → OK
- ✅ Création ticket EUR → OK  
- ✅ Création ticket USD → Rejeté (seuls CHF/EUR autorisés)

## 📋 Impact et compatibilité

### ✅ Ce qui fonctionne

- Tous les tickets CHF existants restent valides
- Aucune modification de données
- Workflow tickets/missions/factures inchangé
- Compatible avec architecture multi-pays (M61)

### ⚠️ Limitation actuelle

**Frontend tickets.html** :
- Affiche toujours "CHF" en dur dans le label "Plafond d'intervention (CHF)"
- Ne permet pas encore de choisir la devise au moment de la création

**Frontend à adapter ultérieurement** (hors scope M62) :
```html
<!-- Futur : Sélecteur devise -->
<label for="devise">Devise *</label>
<select id="devise" name="devise">
  <option value="CHF" selected>CHF (Suisse)</option>
  <option value="EUR">EUR (France)</option>
</select>
```

## 🔗 Dépendances

### Migrations liées

```
M61  → Immeubles/logements multi-pays (NPA)
M61b → Patch logements NPA
M62  → Tickets multi-devises (CE PATCH)
```

### Ordre d'application

1. ✅ M61 (immeubles/logements)
2. ✅ M61b (patch logements)
3. 🔴 **M62 (tickets devise)** ← À APPLIQUER

## 🎯 Cas d'usage

### Scénario Suisse (actuel - fonctionne)

```javascript
// Création ticket Suisse
{
  titre: "Fuite robinet",
  devise: "CHF",  // ✅ OK avant et après M62
  plafond_intervention_chf: 500
}
```

### Scénario France (bloqué AVANT M62, OK APRÈS)

```javascript
// Création ticket France
{
  titre: "Fuite robinet",
  devise: "EUR",  // ❌ Bloqué AVANT M62 → ✅ OK APRÈS M62
  plafond_intervention_chf: 500  // Note: nom colonne conservé pour rétro-compat
}
```

## 🔒 Sécurité

- ✅ Transaction atomique (BEGIN/COMMIT)
- ✅ Log migration dans `migration_logs`
- ✅ Validation post-migration avec compteurs
- ✅ IF EXISTS sur DROP (idempotent)

## ⏱️ Temps d'exécution

**< 1 seconde** (simple DROP + ADD constraint, pas de modification données)

## 📝 Notes techniques

### Pourquoi pas "devise_chf" BOOLEAN ?

Le modèle utilise `devise TEXT` avec contrainte CHECK, pas un booléen.

```sql
-- Colonne existante
devise TEXT DEFAULT 'CHF'

-- Ancienne contrainte (M01)
CHECK (devise = 'CHF')

-- Nouvelle contrainte (M62)
CHECK (devise IN ('CHF', 'EUR'))
```

### Pourquoi conserver "plafond_intervention_chf" ?

- Rétrocompatibilité : tout le code existant utilise ce nom
- Sémantique : dans le contexte France, on peut considérer que c'est "plafond_intervention_eur"
- Alternative future : renommer en `plafond_intervention` + colonne `devise` séparée

---

**Date** : 9 janvier 2026  
**Auteur** : Patch M62 Multi-pays  
**Durée** : < 1 seconde  
**Risque** : Minimal (contrainte uniquement, pas de données)
