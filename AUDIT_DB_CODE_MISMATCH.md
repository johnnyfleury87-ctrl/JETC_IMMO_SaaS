# 🔴 AUDIT DB ↔ CODE MISMATCH - Rapport Complet

**Date**: 27 décembre 2025  
**Criticité**: 🔴 BLOQUANT  
**Erreur déclenchée**: `42703: column regies.nom_agence does not exist`

---

## 🐛 ERREUR IDENTIFIÉE

### Symptôme
```javascript
PostgreSQL ERROR 42703:
column regies.nom_agence does not exist
HINT: Perhaps you meant to reference the column "regies.nom"
```

### Cause Racine
**Invention de nom de colonne sans vérification schéma**

J'ai codé `regies.nom_agence` en supposant que la colonne existait, **SANS consulter le schéma réel** via `supabase/Audit_supabase/03_columns.csv`.

---

## ✅ SCHÉMA RÉEL (TABLE `regies`)

**Source**: `supabase/Audit_supabase/03_columns.csv` lignes 555-571

| Position | Column Name | Data Type | Nullable | Default |
|----------|-------------|-----------|----------|---------|
| 1 | id | uuid | NO | uuid_generate_v4() |
| 2 | **nom** | text | NO | null |
| 3 | adresse | text | YES | null |
| 4 | code_postal | text | YES | null |
| 5 | ville | text | YES | null |
| 6 | telephone | text | YES | null |
| 7 | email | text | YES | null |
| 8 | siret | text | YES | null |
| 9 | nb_collaborateurs | integer | NO | 1 |
| 10 | nb_logements_geres | integer | NO | 0 |
| 11 | statut_validation | text | NO | 'en_attente' |
| 12 | date_validation | timestamptz | YES | null |
| 13 | admin_validateur_id | uuid | YES | null |
| 14 | commentaire_refus | text | YES | null |
| 15 | profile_id | uuid | YES | null |
| 16 | created_at | timestamptz | YES | now() |
| 17 | updated_at | timestamptz | YES | now() |

**✅ CONFIRMATION** : La colonne s'appelle **`nom`** (position 2), **PAS** `nom_agence`.

---

## 📂 FICHIERS CORRIGÉS

### 1. [public/regie/tickets.html](public/regie/tickets.html)

#### ❌ Ligne 688 (AVANT)
```javascript
.select('id, nom_agence')  // ❌ ERREUR 42703
```

#### ✅ Ligne 688 (APRÈS)
```javascript
.select('id, nom')  // ✅ Colonne réelle: 'nom' (pas 'nom_agence')
```

#### ❌ Ligne 707 (AVANT)
```javascript
document.getElementById('agenceName').textContent = regie.nom_agence;  // ❌ undefined
```

#### ✅ Ligne 707 (APRÈS)
```javascript
document.getElementById('agenceName').textContent = regie.nom;  // ✅ Colonne réelle
```

---

### 2. [supabase/migrations/M22.5.DEBUG_patch_raise_return.sql](supabase/migrations/M22.5.DEBUG_patch_raise_return.sql)

#### ❌ Ligne 146 (AVANT)
```sql
r.nom_agence AS regie_nom  -- ❌ ERREUR 42703
```

#### ✅ Ligne 146 (APRÈS)
```sql
r.nom AS regie_nom  -- ✅ Colonne réelle: 'nom' (pas 'nom_agence')
```

---

## 🔍 CHECK A→Z (DB → Code) - AUDIT COMPLET

### Table `regies` - Vérification exhaustive

| Champ en Base | Type | Utilisé dans Code | Fichier | Ligne | Status |
|---------------|------|-------------------|---------|-------|--------|
| id | uuid | ✅ regies.id | tickets.html | 688 | ✅ OK |
| **nom** | text | ❌ **nom_agence** | tickets.html | 688, 707 | ❌ **CORRIGÉ** |
| **nom** | text | ❌ **nom_agence** | M22.5.DEBUG | 146 | ❌ **CORRIGÉ** |
| profile_id | uuid | ✅ regies.profile_id | tickets.html | 689 | ✅ OK |
| adresse | text | ❌ Non utilisé | - | - | ⚠️ Potentiel |
| email | text | ❌ Non utilisé | - | - | ⚠️ Potentiel |
| telephone | text | ❌ Non utilisé | - | - | ⚠️ Potentiel |

### Autres Tables Utilisées - Vérification

#### Table `tickets` (12_tickets_focus.csv)
| Champ | Utilisé | Fichier | Status |
|-------|---------|---------|--------|
| id | ✅ .eq('id', ticketId) | tickets.html | ✅ OK |
| titre | ✅ ticket.titre | tickets.html | ✅ OK |
| description | ✅ ticket.description | tickets.html | ✅ OK |
| statut | ✅ ticket.statut | tickets.html | ✅ OK |
| priorite | ✅ ticket.priorite | tickets.html | ✅ OK |
| categorie | ✅ ticket.categorie | tickets.html | ✅ OK |
| sous_categorie | ✅ ticket.sous_categorie | tickets.html | ✅ OK |
| piece | ✅ ticket.piece | tickets.html | ✅ OK |
| plafond_intervention_chf | ✅ ticket.plafond | tickets.html | ✅ OK |
| locataire_id | ✅ t.locataire_id | M22.5 | ✅ OK |
| logement_id | ✅ t.logement_id | M22.5 | ✅ OK |
| regie_id | ✅ t.regie_id | M22.5 | ✅ OK |

#### Table `locataires` (Audit CSV)
| Champ | Utilisé | Fichier | Status |
|-------|---------|---------|--------|
| id | ✅ l.id | M22.5 | ✅ OK |
| nom | ✅ l.nom | M22.5 | ✅ OK |
| prenom | ✅ l.prenom | M22.5 | ✅ OK |
| profile_id | ✅ l.profile_id | M22.5 | ✅ OK |

#### Table `logements` (Audit CSV)
| Champ | Utilisé | Fichier | Status |
|-------|---------|---------|--------|
| id | ✅ lg.id | M22.5 | ✅ OK |
| numero | ✅ lg.numero | M22.5 | ✅ OK |
| immeuble_id | ✅ lg.immeuble_id | M22.5.DEBUG | ✅ OK |

#### Table `immeubles` (Audit CSV)
| Champ | Utilisé | Fichier | Status |
|-------|---------|---------|--------|
| id | ✅ i.id | M22.5.DEBUG | ✅ OK |
| adresse | ✅ i.adresse | M22.5.DEBUG | ✅ OK |

#### Table `profiles` (Audit CSV)
| Champ | Utilisé | Fichier | Status |
|-------|---------|---------|--------|
| id | ✅ p.id | tickets.html | ✅ OK |
| email | ✅ profile.email | tickets.html | ✅ OK |
| role | ✅ profile.role | tickets.html | ✅ OK |

---

## 🔍 CHECK Z→A (Code → DB) - Vérification Inverse

### Scanner complet `public/regie/*.html`

**Recherche** : `.select(`, `.eq(`, `.order(`, `.rpc(`

#### Fichier: [tickets.html](public/regie/tickets.html)

| Ligne | Code | Table Cible | Colonnes | Vérification | Status |
|-------|------|-------------|----------|--------------|--------|
| 655 | `.from('profiles').select('id, email, role')` | profiles | id, email, role | ✅ Existent | ✅ OK |
| 688 | `.from('regies').select('id, nom')` | regies | id, nom | ✅ **CORRIGÉ** | ✅ OK |
| 735 | `.rpc('get_tickets_list_regie', {p_statut})` | RPC | p_statut (enum) | ✅ Signature OK | ✅ OK |
| 895 | `.rpc('update_ticket_regie', {...})` | RPC | p_ticket_id, p_priorite, p_plafond | ✅ Signature OK | ✅ OK |

#### Fichier: [dashboard.html](public/regie/dashboard.html)

| Ligne | Code | Table Cible | Colonnes | Vérification | Status |
|-------|------|-------------|----------|--------------|--------|
| ~655 | `.from('profiles').select(...)` | profiles | id, email, role | ✅ Existent | ✅ OK |
| ~847 | `.rpc('get_tickets_dashboard_regie')` | RPC | Aucun param | ✅ Signature OK | ✅ OK |

---

## 🔍 RPC - Vérification Signatures

### 1. `get_tickets_list_regie(p_statut ticket_status)`

**Fichier**: M22.5_rpc_tickets_liste_detail_regie.sql ligne 11

**Paramètres** :
- `p_statut` : `ticket_status` (enum) ✅

**Colonnes retournées** :
```sql
id, titre, description, statut, priorite, categorie, sous_categorie, 
piece, created_at, plafond_intervention_chf, 
locataire_nom, locataire_prenom, logement_numero
```

**Jointures** :
- `tickets t` → OK
- `locataires l` ON `l.id = t.locataire_id` → OK (FK existe)
- `logements lg` ON `lg.id = t.logement_id` → OK (FK existe)

**Frontend attend** : `ticket.titre`, `ticket.description`, `ticket.locataire_nom` → ✅ Cohérent

---

### 2. `get_ticket_detail_regie(p_ticket_id uuid)`

**Fichier**: M22.5_rpc_tickets_liste_detail_regie.sql ligne 77

**Paramètres** :
- `p_ticket_id` : `uuid` ✅

**Colonnes retournées** :
21 colonnes incluant relations complètes (locataire, logement, profile)

**Jointures** :
- `tickets t` → OK
- `locataires l` → OK
- `profiles p` → OK
- `logements lg` → OK

**Frontend attend** : Pas encore utilisé (modal détail à implémenter) → ⚠️ À vérifier

---

### 3. `update_ticket_regie(p_ticket_id, p_priorite, p_plafond)`

**Fichier**: M22.5_rpc_tickets_liste_detail_regie.sql ligne 173

**Paramètres** :
- `p_ticket_id` : `uuid` ✅
- `p_priorite` : `text` ✅
- `p_plafond_intervention_chf` : `numeric` ✅

**UPDATE colonnes** :
- `tickets.priorite` → Existe (12_tickets_focus.csv) ✅
- `tickets.plafond_intervention_chf` → Existe ✅
- `tickets.updated_at` → Existe ✅

**Frontend appel** : tickets.html ligne 895 → ✅ Paramètres cohérents

---

### 4. `get_tickets_dashboard_regie()`

**Fichier**: M22_rpc_regie_dashboard_tickets.sql ligne 11

**Paramètres** : Aucun ✅

**Colonnes retournées** :
```sql
count_nouveau, count_en_attente, count_en_cours, count_termine
```

**Frontend attend** : dashboard.html récupère `data.count_nouveau` → ✅ Cohérent

---

## 📊 INCOHÉRENCES DÉTECTÉES

### ❌ Incohérence 1 : `regies.nom_agence` n'existe pas
- **Fichiers** : tickets.html (2 occurrences), M22.5.DEBUG (1 occurrence)
- **Colonne réelle** : `regies.nom`
- **Status** : ✅ **CORRIGÉ**

### ⚠️ Incohérence 2 : Alias incomplets
- **Problème** : Les RPC utilisent des alias (ex: `r.nom AS regie_nom`) mais le frontend n'accède jamais à `regie_nom`
- **Impact** : Faible (colonnes non utilisées)
- **Action** : À documenter pour évolutions futures

### ⚠️ Incohérence 3 : RPC `get_ticket_detail_regie` non utilisé
- **Problème** : Fonction créée mais frontend ne l'appelle jamais (modal détail ticket absent)
- **Impact** : Moyen (code mort)
- **Action** : Implémenter modal OU supprimer RPC

---

## 🛡️ PROCÉDURE OBLIGATOIRE À L'AVENIR

### ✅ CHECK A→Z (DB → Code) - AVANT TOUTE MODIFICATION

**Pour CHAQUE table utilisée** :

1. **Exporter schéma réel** :
   ```bash
   grep "^public,TABLE_NAME," supabase/Audit_supabase/03_columns.csv
   ```

2. **Lister colonnes attendues** dans le code (grep `.select(`)

3. **Vérifier correspondance** :
   - Nom exact (case-sensitive)
   - Type PostgreSQL vs JS (uuid/text/numeric/enum)
   - FK pour jointures possibles

4. **Produire tableau** :
   | Champ Base | Type | Utilisé Code | Fichier | Status |
   |------------|------|--------------|---------|--------|

---

### ✅ CHECK Z→A (Code → DB) - APRÈS TOUTE MODIFICATION

**Scanner tout `public/**/*.html` et migrations** :

1. **Trouver tous** :
   ```bash
   grep -rn "\.select\|\.eq\|\.order\|\.rpc" public/
   ```

2. **Pour chaque occurrence** :
   - Extraire table ciblée
   - Extraire colonnes utilisées
   - Vérifier existence dans `03_columns.csv`

3. **Pour chaque RPC** :
   - Vérifier signature (params types)
   - Vérifier colonnes retournées
   - Vérifier jointures (FK existent)
   - Vérifier cohérence avec UI (frontend attend ces colonnes)

4. **Produire liste incohérences** avec correctifs

---

## 🚫 GARDE-FOUS AJOUTÉS

### 1. Interdiction de masquer erreurs SQL

**Règle** : Tout `catch` DOIT logger :
```javascript
console.error('[DEBUG] error.message:', error.message);
console.error('[DEBUG] error.code:', error.code);
console.error('[DEBUG] error.details:', error.details);
console.error('[DEBUG] error.hint:', error.hint);
console.error('[DEBUG] error complet:', JSON.stringify(error, null, 2));
```

**Appliqué dans** : tickets.html ligne 738

---

### 2. Pas de redirection sur erreur SQL simple

**Avant** :
```javascript
if (error) {
  await supabase.auth.signOut();  // ❌ Masque l'erreur
  window.location.href = '/login.html';
}
```

**Après** :
```javascript
if (error) {
  console.error('[DEBUG] ERREUR SQL:', error);
  // Afficher message utilisateur
  // NE PAS logout sauf erreur auth
}
```

**Appliqué dans** : tickets.html ÉTAPE 1.6

---

### 3. Validation schéma avant commit

**Checklist obligatoire** avant `git commit` de fichiers SQL/HTML :

- [ ] Vérifier schéma `03_columns.csv` pour TOUTES les tables utilisées
- [ ] Vérifier FK `06_foreign_keys.csv` pour TOUTES les jointures
- [ ] Tester requête SQL dans SQL Editor AVANT d'intégrer
- [ ] Logger erreurs complètes en console
- [ ] Ne jamais inventer de nom de colonne

---

## 📋 LIVRABLES

### ✅ Correctifs Appliqués

1. ✅ [public/regie/tickets.html](public/regie/tickets.html)
   - Ligne 688: `nom_agence` → `nom`
   - Ligne 707: `regie.nom_agence` → `regie.nom`

2. ✅ [supabase/migrations/M22.5.DEBUG_patch_raise_return.sql](supabase/migrations/M22.5.DEBUG_patch_raise_return.sql)
   - Ligne 146: `r.nom_agence` → `r.nom`

### ✅ Rapport Audit

- ✅ Schéma `regies` documenté (17 colonnes)
- ✅ Check A→Z complet (5 tables vérifiées)
- ✅ Check Z→A complet (2 fichiers HTML scannés)
- ✅ RPC signatures validées (4 fonctions)
- ✅ 3 incohérences identifiées (1 critique corrigée, 2 mineures documentées)

### ✅ Procédure Documentée

- ✅ Check A→Z (DB → Code) expliqué
- ✅ Check Z→A (Code → DB) expliqué
- ✅ 3 garde-fous ajoutés

---

## ✅ VALIDATION FINALE

### Test 1 : Plus d'erreur 42703

**Action** :
1. Appliquer patch DEBUG dans Supabase SQL Editor
2. Déployer tickets.html vers Vercel
3. Login régie → Aller sur `/regie/tickets.html`

**Résultat attendu** :
- [ ] ✅ Aucune erreur `42703` en console
- [ ] ✅ Aucune erreur `nom_agence` dans logs Supabase
- [ ] ✅ Console affiche `[REGIE][DEBUG] regie= {id: "...", nom: "..."}`

---

### Test 2 : Page stable (pas de déconnexion)

**Action** :
Rester sur `/regie/tickets.html` pendant 30 secondes

**Résultat attendu** :
- [ ] ✅ Pas de redirection login
- [ ] ✅ Pas de déconnexion automatique
- [ ] ✅ Logs DEBUG visibles en console

---

## 🛑 STOP CONDITION

**Je n'avance PAS tant que** :
1. ❌ Erreur 42703 non éliminée
2. ❌ Page régie tickets instable (déconnexion)
3. ❌ Logs console incomplets

**On avance SI** :
1. ✅ Erreur 42703 disparue
2. ✅ Page régie tickets reste stable 30s+
3. ✅ Logs console complets fournis

---

**Audit créé le** : 27 décembre 2025  
**Durée** : 20 minutes  
**Leçon apprise** : **TOUJOURS vérifier schéma AVANT de coder**
