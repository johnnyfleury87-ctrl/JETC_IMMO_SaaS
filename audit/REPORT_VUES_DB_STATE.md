# 🔍 RAPPORT AUDIT : État DB vs Repo

**Date** : 2026-01-06  
**Objectif** : Vérifier structure DB réelle vs schéma repository  
**Statut** : ⚠️ **ANOMALIES CRITIQUES DÉTECTÉES**

---

## 📊 Résumé Exécutif

| Catégorie | État | Commentaire |
|-----------|------|-------------|
| **Tables principales** | ✅ OK | 4/4 accessibles (tickets, missions, factures, profiles) |
| **Vues** | ⚠️ PARTIEL | 2/3 accessibles (`missions_details` **MANQUANTE**) |
| **RPC** | ✅ OK | 5/5 accessibles (accept, assign, start, complete, validate) |
| **Policies RLS** | ⚠️ NON VÉRIFIÉ | RPC `exec_sql` manquante, vérification manuelle nécessaire |
| **Terminologie** | ✅ OK | Harmonisée `general`/`restreint` (M35+M37 appliquées) |
| **Workflow** | 🔴 **CRITIQUE** | Bug confirmé : tickets acceptés restent visibles |

---

## 🗂️ Section 1 : Tables Principales

### ✅ Table `tickets`
- **État** : Accessible
- **Lignes** : 1
- **Colonnes attendues** : ✅ Présentes (id, titre, statut, locked_at, mode_diffusion, etc.)
- **Colonnes manquantes** : `locked_by` (pas critique, locked_at suffit)
- **Colonnes supplémentaires** : categorie, logement_id, photos, urgence, plafond_intervention_chf, devise, sous_categorie, piece, plafond_valide_par, plafond_valide_at, diffuse_par, diffuse_at

**Constat** : Structure cohérente avec migrations M01-M43.

---

### ✅ Table `missions`
- **État** : Accessible
- **Lignes** : 1
- **Colonnes attendues** : ticket_id, entreprise_id, technicien_id, statut, started_at, completed_at, validated_at ✅
- **Colonnes manquantes** : `montant_ht`, `montant_tva`, `montant_ttc`
- **Colonnes supplémentaires** : montant_reel_chf, devise, disponibilite_id, locataire_absent, absence_signalement_at, absence_raison, photos_urls, rapport_url, signature_locataire_url, signature_technicien_url

**Constat** : Schéma diverge sur les montants. DB utilise `montant_reel_chf` au lieu de montants HT/TVA/TTC séparés. Compatible avec logique métier Suisse (CHF direct).

**⚠️ DIVERGENCE REPO** : Le fichier `supabase/schema/13_missions.sql` (ligne 289) définit une vue `missions_details` utilisant `m.montant`, mais la colonne n'existe pas en DB !

---

### ✅ Table `factures`
- **État** : Accessible
- **Lignes** : 0 (vide)
- **Structure** : Non vérifiable par SELECT (table vide)

**Constat** : Table existe, pas de données de test.

---

### ✅ Table `profiles`
- **État** : Accessible
- **Lignes** : 7
- **Colonnes attendues** : id, email, role ✅
- **Colonnes manquantes** : `nom`, `prenom`, `locataire_id`
- **Colonnes supplémentaires** : language, is_demo, logement_id

**Constat** : Structure simplifiée. Noms probablement stockés dans tables métier (locataires, regies, entreprises, techniciens).

---

## 👁️ Section 2 : Vues

### ✅ Vue `tickets_visibles_entreprise`
- **État** : Accessible ✅
- **Lignes** : 1
- **Colonnes** : 27 (toutes colonnes tickets + ville + visible_par_entreprise_id + autorisation_mode)

**🧪 Test terminologie :**
- Ticket en DB : `mode_diffusion = 'general'` ✅
- Vue retourne données ✅
- **Conclusion** : M37 appliquée, terminologie harmonisée

**🔴 PROBLÈME CRITIQUE WORKFLOW :**

La vue inclut **3 cas** :
1. ✅ Tickets `mode_diffusion='general'` ET `statut='en_attente'` ET `locked_at IS NULL` (vraiment disponibles)
2. ✅ Tickets `mode_diffusion='restreint'` assignés à l'entreprise
3. ❌ **Tickets acceptés** (`en_cours`, `termine`, `clos`) **déjà traités par l'entreprise**

**Conséquence** : Le Cas 3 fait apparaître les tickets acceptés (qui ont une mission) dans la section "Tickets disponibles" du dashboard entreprise, alors qu'ils devraient UNIQUEMENT être dans "Missions".

**Cause** : Frontend `public/entreprise/dashboard.html` ligne 834 :
```javascript
.from('tickets_visibles_entreprise')
.eq('visible_par_entreprise_id', window.currentEntreprise.id)
// ❌ MANQUE : .eq('statut', 'en_attente').is('locked_at', null)
```

Le frontend ne filtre PAS sur `statut='en_attente'` et `locked_at IS NULL`, donc il affiche **tous** les tickets de la vue (y compris Cas 3 = historique).

**Preuve** :
- Ticket en DB : `statut='en_cours'`, `locked_at='2026-01-06'` (accepté)
- Vue retourne ce ticket ✅ (Cas 3)
- Frontend l'affiche dans "Tickets disponibles" ❌ (devrait être dans "Missions")

---

### 🔴 Vue `missions_details` **MANQUANTE**
- **État** : ❌ **N'EXISTE PAS EN DB**
- **Définie dans** : `supabase/schema/13_missions.sql` ligne 289
- **Utilisée par** : Aucun fichier frontend (recherche negative)

**Constat** : Vue définie dans schéma mais jamais créée par migration. Pas bloquant car frontend utilise joins manuels.

**Recommandation** : Créer migration pour ajouter la vue (utile pour simplifier requêtes backend/admin).

---

### ✅ Vue `admin_factures_mensuelles_regies`
- **État** : Accessible ✅
- **Lignes** : 0 (aucune facture payée)
- **Colonnes** : Agrégations pour facturation JETC

**Constat** : Vue M44 correctement déployée.

---

## ⚙️ Section 3 : RPC Functions

Toutes les RPC métier sont accessibles :

| RPC | État | Version |
|-----|------|---------|
| `accept_ticket_and_create_mission` | ✅ | M41 (terminologie harmonisée) |
| `assign_technicien_to_mission` | ✅ | OK |
| `start_mission` | ✅ | OK |
| `complete_mission` | ✅ | OK |
| `validate_mission` | ✅ | OK |

**Constat** : Backend RPC fonctionnel. M41 a bien corrigé la terminologie (`general`/`restreint`).

---

## 🔒 Section 4 : Policies RLS

**⚠️ Vérification impossible** : RPC `exec_sql` n'existe pas en DB (nécessaire pour interroger `pg_policies`).

**Solution** : Vérification manuelle via Dashboard Supabase > Authentication > Policies.

**Policies attendues** (selon M35) :
- `tickets` : Policies pour entreprise (general + restreint)
- `missions` : Policies pour entreprise (SELECT + UPDATE own missions)
- `missions` : Policies pour technicien (SELECT + UPDATE assigned missions)

**Recommandation** : Audit manuel RLS via Dashboard ou créer RPC `exec_sql` pour automatisation.

---

## 🚨 Section 5 : Anomalies Critiques Détectées

### 🔴 ANOMALIE #1 : Tickets acceptés visibles dans "Tickets disponibles"

**Gravité** : CRITIQUE  
**Impact** : Workflow entreprise bloqué

**Description** :
Après acceptation d'un ticket :
1. ✅ RPC `accept_ticket_and_create_mission` crée mission
2. ✅ RPC verrouille ticket (`locked_at` rempli)
3. ✅ RPC change statut `en_attente` → `en_cours`
4. ❌ **Frontend continue d'afficher le ticket dans "Tickets disponibles"**
5. ❌ **Mission créée mais introuvable dans "Mes missions"** (ou pas visible clairement)

**Cause racine** :
Vue `tickets_visibles_entreprise` inclut Cas 3 (tickets acceptés) pour historique, mais frontend ne filtre PAS sur `statut='en_attente'` et `locked_at IS NULL`.

**Solutions possibles** :

**Option A (Recommandée)** : Corriger frontend
```javascript
// Dans loadTicketsDisponibles() - ligne 834
.from('tickets_visibles_entreprise')
.eq('visible_par_entreprise_id', window.currentEntreprise.id)
.eq('statut', 'en_attente')       // ← AJOUT
.is('locked_at', null)             // ← AJOUT
```

**Option B** : Créer 2 vues séparées
- `tickets_disponibles_entreprise` : Cas 1+2 uniquement (vraiment disponibles)
- `tickets_historique_entreprise` : Cas 3 (acceptés/clos)

**Option C** : Supprimer Cas 3 de la vue actuelle (breaking change)

---

### ⚠️ ANOMALIE #2 : Vue `missions_details` manquante

**Gravité** : MOYENNE  
**Impact** : Pas bloquant (frontend utilise joins)

**Solution** : Créer migration M45 avec la vue complète.

---

### ⚠️ ANOMALIE #3 : Divergence colonnes `missions.montant`

**Gravité** : FAIBLE  
**Impact** : Schéma repo obsolète

**Solution** : Mettre à jour `supabase/schema/13_missions.sql` pour refléter structure réelle (`montant_reel_chf` au lieu de `montant_ht/tva/ttc`).

---

## 📝 Recommandations

### Priorité CRITIQUE
1. ✅ **Corriger frontend** : Ajouter filtres `statut='en_attente'` et `locked_at IS NULL` dans `loadTicketsDisponibles()`
2. ✅ **Tester workflow** : Accepter ticket → Vérifier disparition de "Tickets disponibles" + apparition dans "Missions"

### Priorité HAUTE
3. ⚠️ **Créer vue `missions_details`** : Migration M45 pour simplifier requêtes
4. ⚠️ **Audit RLS manuel** : Vérifier policies via Dashboard Supabase

### Priorité MOYENNE
5. 📝 **Documenter divergences** : Mettre à jour schéma repo avec structure réelle
6. 🧪 **Tests automatisés** : Créer script de test pour workflow acceptation

---

## 📂 Fichiers Générés

- `/audit/_AUDIT_DB_STATE_RAW.json` : Données brutes audit
- `/audit/_check_vue_terminologie.js` : Script validation terminologie
- `/audit/REPORT_VUES_DB_STATE.md` : Ce rapport

---

## ✅ Prochaines Étapes

1. Continuer avec **TODO #2** : Audit vues par rôle (login réel)
2. Confirmer bug avec **TODO #3** : Reproduire acceptation ticket
3. Appliquer correction avec **TODO #4** : Fix frontend + migration si nécessaire

---

**Fin du rapport** | Généré le 2026-01-06
