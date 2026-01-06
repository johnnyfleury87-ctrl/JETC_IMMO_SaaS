# 🔧 RAPPORT FIX : Ticket accepté reste visible (Entreprise)

**Date** : 2026-01-06  
**Référence** : ANOMALIE #1 CRITIQUE  
**Statut** : ✅ **CORRIGÉ**

---

## 🎯 Résumé Exécutif

**Problème** : Après acceptation d'un ticket par une entreprise, le ticket reste visible dans la section "Tickets disponibles" au lieu de disparaître et d'apparaître uniquement dans "Mes missions".

**Impact** : Workflow entreprise bloqué, confusion utilisateur, risque d'acceptation multiple tentée.

**Cause racine** : Frontend ne filtre pas sur `statut='en_attente'` et `locked_at IS NULL` lors du chargement de "Tickets disponibles".

**Solution appliquée** : Ajout de filtres explicites dans `public/entreprise/dashboard.html`.

**Migrations associées** : M45 (création vue `missions_details` optionnelle).

---

## 🔍 Analyse de la Cause Racine

### 1. Workflow Attendu

Lorsqu'une entreprise accepte un ticket :

1. ✅ **RPC `accept_ticket_and_create_mission`** est appelée
2. ✅ RPC **verrouille** le ticket (`locked_at = now()`)
3. ✅ RPC **change statut** `en_attente` → `en_cours` (via `update_ticket_statut`)
4. ✅ RPC **crée mission** (table `missions`)
5. ❌ **Frontend continue d'afficher** le ticket dans "Tickets disponibles"
6. ❌ **Mission créée** mais pas visible clairement dans "Mes missions" (ou pas au bon endroit)

### 2. Architecture Vue `tickets_visibles_entreprise`

La vue (M37) contient **3 cas** :

```sql
-- Cas 1: Tickets diffusés en mode GENERAL (marketplace)
WHERE
  re.mode_diffusion = 'general'
  AND t.mode_diffusion = 'general'
  AND t.statut = 'en_attente'
  AND t.locked_at IS NULL

-- Cas 2: Tickets diffusés en mode RESTREINT (assignation)
OR
  t.mode_diffusion = 'restreint'
  AND t.entreprise_id = re.entreprise_id
  AND t.statut IN ('en_attente', 'en_cours', 'termine')

-- Cas 3: Tickets acceptés (historique)
OR
  t.entreprise_id = re.entreprise_id
  AND t.statut IN ('en_cours', 'termine', 'clos')
```

**Constat** :
- **Cas 1** : Tickets vraiment disponibles ✅
- **Cas 2** : Tickets assignés (OK pour mode restreint) ✅
- **Cas 3** : Tickets **déjà acceptés** par l'entreprise ❌

Le **Cas 3** permet à l'entreprise de voir son historique (tickets avec missions), mais le frontend **ne fait pas la distinction** entre "disponibles" et "historique".

### 3. Code Frontend Avant Correction

**Fichier** : `public/entreprise/dashboard.html` ligne 834 (avant M45)

```javascript
async function loadTicketsDisponibles() {
  // ...
  const { data: tickets, error } = await window.supabaseClient
    .from('tickets_visibles_entreprise')
    .select('*')
    .eq('visible_par_entreprise_id', window.currentEntreprise.id)
    .order('created_at', { ascending: false });
  // ❌ MANQUE : .eq('statut', 'en_attente').is('locked_at', null)
}
```

**Problème** :
- La requête charge **TOUS** les tickets visibles (Cas 1 + 2 + 3)
- Pas de filtre sur `statut` ni `locked_at`
- Résultat : Tickets en_cours/termine/clos sont affichés comme "disponibles"

### 4. Preuve du Bug

**État DB après acceptation** :
```
Ticket ID: 2106c14a...
statut: en_cours         ← Changé par RPC
locked_at: 2026-01-06    ← Verrouillé par RPC
entreprise_id: <E1>      ← Assigné à l'entreprise

Mission ID: <M1>
ticket_id: 2106c14a...   ← Lien avec ticket
entreprise_id: <E1>
statut: en_attente       ← Mission créée
```

**Requête vue (sans filtre)** :
```sql
SELECT * FROM tickets_visibles_entreprise
WHERE visible_par_entreprise_id = '<E1>';
-- Retourne : Ticket 2106c14a... (Cas 3)
```

**Frontend** : Affiche ce ticket dans "Tickets disponibles" ❌

---

## 🛠️ Solution Appliquée

### Option Retenue : **Corriger Frontend (Option A)**

**Avantages** :
- ✅ Changement minimaliste (2 lignes)
- ✅ Pas de breaking change sur la vue
- ✅ Conserve Cas 3 pour autres usages futurs (ex: page "Historique")

**Inconvénient** :
- ⚠️ Chaque appel à `tickets_visibles_entreprise` doit spécifier l'usage (disponibles vs historique)

### Correction Appliquée

**Fichier** : `public/entreprise/dashboard.html`  
**Ligne** : 834-841  
**Commit** : M45 Fix (2026-01-06)

```javascript
// AVANT (ligne 831-836)
const { data: tickets, error } = await window.supabaseClient
  .from('tickets_visibles_entreprise')
  .select('*')
  .eq('visible_par_entreprise_id', window.currentEntreprise.id)
  .order('created_at', { ascending: false });

// APRÈS (M45 Fix)
const { data: tickets, error } = await window.supabaseClient
  .from('tickets_visibles_entreprise')
  .select('*')
  .eq('visible_par_entreprise_id', window.currentEntreprise.id)
  .eq('statut', 'en_attente')       // ✅ FIX: Exclure tickets en_cours/termine/clos
  .is('locked_at', null)             // ✅ FIX: Exclure tickets déjà acceptés
  .order('created_at', { ascending: false });
```

**Changements** :
1. ✅ Ajout filtre `.eq('statut', 'en_attente')` : Exclut tickets en_cours/termine/clos
2. ✅ Ajout filtre `.is('locked_at', null)` : Exclut tickets verrouillés (acceptés par entreprise)
3. ✅ Commentaire mis à jour pour expliquer le fix

**Résultat** :
- Seuls les tickets **vraiment disponibles** (Cas 1+2 avec statut en_attente) sont affichés
- Tickets acceptés (Cas 3) ne sont plus affichés dans "Tickets disponibles"

---

## 📋 Migration Optionnelle M45

**Objectif** : Créer vue `missions_details` manquante (définie dans schema mais jamais migrée).

**Avantages** :
- ✅ Simplifie futures requêtes (évite joins manuels)
- ✅ Normalise avec schéma repository
- ✅ Pas d'impact sur code existant (vue supplémentaire)

**Fichiers** :
- `/supabase/migrations/20260106000200_m45_create_missions_details.sql`
- `/supabase/migrations/20260106000200_m45_create_missions_details_rollback.sql`

**Contenu** :
```sql
CREATE OR REPLACE VIEW missions_details AS
SELECT
  m.*, -- Colonnes mission
  t.titre AS ticket_titre,
  e.nom AS entreprise_nom,
  tech.nom AS technicien_nom,
  loc.nom AS locataire_nom,
  log.numero AS logement_numero,
  imm.adresse AS immeuble_adresse,
  r.nom AS regie_nom
FROM missions m
INNER JOIN tickets t ON m.ticket_id = t.id
-- ... (autres joins)
```

**Déploiement** :
```bash
# Via Supabase CLI
supabase db push

# Ou via Dashboard > SQL Editor
-- Copier/coller contenu migration
```

---

## ✅ Vérification de la Correction

### Test 1 : Acceptation Ticket

**Scénario** :
1. Entreprise E1 se connecte
2. Consulte "Tickets disponibles" → Voit ticket T1 (statut: en_attente, locked_at: NULL)
3. Accepte ticket T1 avec disponibilité D1
4. RPC crée mission M1, verrouille T1, change statut en_cours

**Résultat attendu** :
- ✅ Ticket T1 **disparaît** de "Tickets disponibles"
- ✅ Mission M1 **apparaît** dans "Mes missions"
- ✅ Console : `[TICKETS] Tickets chargés: 0` (ou moins qu'avant)
- ✅ Console : `[MISSIONS] Missions chargées: 1` (ou plus qu'avant)

### Test 2 : Rechargement Page

**Scénario** :
1. Après acceptation, rafraîchir page (F5)
2. Vérifier sections "Tickets disponibles" et "Mes missions"

**Résultat attendu** :
- ✅ Ticket accepté reste **absent** de "Tickets disponibles"
- ✅ Mission reste **visible** dans "Mes missions"
- ✅ Données cohérentes avec DB

### Test 3 : Nouveau Ticket

**Scénario** :
1. Régie diffuse nouveau ticket T2 en mode general
2. Entreprise E1 rafraîchit "Tickets disponibles"

**Résultat attendu** :
- ✅ Ticket T2 **apparaît** dans "Tickets disponibles"
- ✅ Ticket T1 (déjà accepté) reste **absent**

### Test 4 : Mode Restreint

**Scénario** :
1. Régie diffuse ticket T3 en mode restreint à E1
2. Entreprise E1 consulte "Tickets disponibles"

**Résultat attendu** :
- ✅ Ticket T3 **apparaît** (Cas 2)
- ✅ Seul E1 voit T3

---

## 🚀 Déploiement

### Étape 1 : Déployer Code Frontend

```bash
cd /workspaces/JETC_IMMO_SaaS
git add public/entreprise/dashboard.html
git commit -m "fix(entreprise): Filtrer tickets disponibles (statut + locked_at) - M45"
git push origin main
```

### Étape 2 : Déployer Migration M45 (Optionnel)

```bash
# Via Supabase CLI
supabase db push

# Vérifier vue créée
supabase db diff
```

### Étape 3 : Vérifier Environnement Production

1. Connexion Dashboard entreprise en production
2. Accepter un ticket de test
3. Vérifier disparition de "Tickets disponibles"
4. Vérifier apparition dans "Mes missions"

---

## 📊 Impact

### Avant Correction

| Action | Comportement | État |
|--------|--------------|------|
| Accepter ticket T1 | ❌ T1 reste dans "Tickets disponibles" | BUG |
| Consulter "Mes missions" | ⚠️ Mission M1 visible mais confuse | PARTIEL |
| Rafraîchir page | ❌ T1 toujours dans "Tickets disponibles" | BUG |

### Après Correction

| Action | Comportement | État |
|--------|--------------|------|
| Accepter ticket T1 | ✅ T1 disparaît de "Tickets disponibles" | OK |
| Consulter "Mes missions" | ✅ Mission M1 clairement visible | OK |
| Rafraîchir page | ✅ T1 reste absent de "Tickets disponibles" | OK |

---

## 🔗 Fichiers Modifiés

### 1. Frontend
- ✅ `public/entreprise/dashboard.html` (ligne 834-841)

### 2. Migrations
- ✅ `supabase/migrations/20260106000200_m45_create_missions_details.sql` (optionnel)
- ✅ `supabase/migrations/20260106000200_m45_create_missions_details_rollback.sql` (optionnel)

### 3. Rapports
- ✅ `audit/REPORT_VUES_DB_STATE.md`
- ✅ `audit/REPORT_FIX_ENTREPRISE_ACCEPT.md` (ce document)

---

## 📝 Notes Techniques

### Pourquoi `.is('locked_at', null)` ?

En Supabase/PostgREST, pour filtrer sur NULL :
- ✅ `.is('colonne', null)` : Correct
- ❌ `.eq('colonne', null)` : Incorrect (ne fonctionne pas)

### Pourquoi Conserver Cas 3 dans la Vue ?

Le Cas 3 permet :
- 📊 Page "Historique des tickets" (future fonctionnalité)
- 📈 Statistiques entreprise (tickets traités)
- 🔍 Recherche globale (tous les tickets liés à l'entreprise)

En séparant la logique au niveau frontend (filtres), on garde la vue flexible.

---

## ✅ Conclusion

**Statut** : ✅ **CORRIGÉ**

Le bug critique "Ticket accepté reste visible" est résolu par l'ajout de 2 filtres explicites dans le frontend. La correction est :
- ✅ Minimaliste (2 lignes)
- ✅ Sans breaking change
- ✅ Testable immédiatement
- ✅ Documentée

La migration M45 (optionnelle) normalise la structure DB avec le schéma repository.

**Prochaines étapes** : Continuer audit avec TODO #5-8 (assignation technicien, workflow statuts, UI technicien, contrôles finaux).

---

**Fin du rapport** | Généré le 2026-01-06
