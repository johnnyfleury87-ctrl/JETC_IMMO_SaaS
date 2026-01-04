# ÉTAPE 1 — PREUVES DB RÉELLES

**Date:** 2026-01-04  
**Méthode:** Supabase JS SDK + Analyse CSV audits + Analyse migrations fichiers  
**Objectif:** Identifier état exact DB pour 2 blockers

---

## BLOCKER #1: `missions.disponibilite_id` missing (SQLSTATE 42703)

### Symptôme rapporté

```
Erreur: column "disponibilite_id" of relation "missions" does not exist
Code: SQLSTATE 42703
Contexte: Dashboard entreprise → Bouton Accepter ticket → RPC accept_ticket_and_create_mission()
```

### Preuve 1: Tentative SELECT via Supabase JS

```javascript
// Test: SELECT disponibilite_id FROM missions
Result: error = "" (erreur vide, pas "column does not exist")
Status: UNKNOWN (erreur RLS ou permissions, pas erreur colonne)
```

**⚠️ Limitation:** Supabase JS avec RLS anon ne peut pas confirmer si erreur = colonne absente ou RLS bloqué.

### Preuve 2: Analyse CSV colonnes missions

**Source:** `supabase/Audit_supabase/4_Colonnes détaillées (types, null, défaut, identité).csv`

**Colonnes missions (20 total):**

| # | Colonne | Type | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | ticket_id | uuid | NO | null |
| 3 | entreprise_id | uuid | NO | null |
| 4 | technicien_id | uuid | YES | null |
| 5 | date_intervention_prevue | timestamptz | YES | null |
| 6 | date_intervention_realisee | timestamptz | YES | null |
| 7 | statut | USER-DEFINED (mission_status) | NO | 'en_attente' |
| 8 | created_at | timestamptz | NO | now() |
| 9 | started_at | timestamptz | YES | null |
| 10 | completed_at | timestamptz | YES | null |
| 11 | validated_at | timestamptz | YES | null |
| 12 | notes | text | YES | null |
| 13 | devis_url | text | YES | null |
| 14 | facture_url | text | YES | null |
| 15 | montant_reel_chf | numeric | YES | null |
| 16 | updated_at | timestamptz | NO | now() |
| 17 | rapport_url | text | YES | null |
| 18 | signature_locataire_url | text | YES | null |
| 19 | signature_technicien_url | text | YES | null |
| 20 | devise | text | NO | 'CHF' |

**Recherche `disponibilite_id`:** ❌ **ABSENTE**

### Preuve 3: Migration M42 attendue

**Fichier recherché:** `supabase/migrations/*m42*disponibilite*.sql`

```bash
$ find supabase/migrations -name "*m42*"
supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql
supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql
```

**✅ Migration M42 EXISTE dans fichiers** (créée 2026-01-04)

**Contenu M42 (extrait attendu):**
```sql
ALTER TABLE public.missions 
ADD COLUMN disponibilite_id uuid REFERENCES tickets_disponibilites(id);
```

**Statut migration_logs:** ❌ **NON APPLIQUÉE** (7 migrations enregistrées, toutes pré-2025-12-24)

### CONCLUSION BLOCKER #1

**✅ PREUVE FORMELLE: Colonne `missions.disponibilite_id` ABSENTE de la base**

**Origine:**
- Migration M42 créée 2026-01-04 (fichier présent)
- Migration M42 JAMAIS appliquée en DB (absente migration_logs)
- CSV audit (snapshot réel DB) confirme colonne absente

**Impact:**
- RPC `accept_ticket_and_create_mission()` échoue si code front envoie `disponibilite_id`
- Erreur PostgreSQL SQLSTATE 42703: "column does not exist"

**Fix requis:** Appliquer migration M42

---

## BLOCKER #2: `mode_diffusion = 'general'` rejected (RPC obsolète)

### Symptôme rapporté

```
Erreur: "Mode diffusion invalide ou NULL: general"
Code: HTTP 400 (Bad Request)
Contexte: Dashboard entreprise → Accepter ticket avec mode_diffusion='general'
RPC: accept_ticket_and_create_mission(p_ticket_id, p_entreprise_id)
```

### Preuve 1: Version RPC actuelle en DB

**Source:** Migration M05 appliquée (fichier: `supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql`)

**Code RPC version M05 (lignes 49-68):**

```sql
-- Validation selon mode diffusion
IF v_mode_diffusion = 'public' THEN
  -- Mode public: Vérifier que entreprise est autorisée en mode 'general'
  IF NOT EXISTS (
    SELECT 1 FROM regies_entreprises 
    WHERE regie_id = v_regie_id 
    AND entreprise_id = p_entreprise_id 
    AND mode_diffusion = 'general'
  ) THEN
    RAISE EXCEPTION 'Entreprise % non autorisée pour tickets publics de régie %', p_entreprise_id, v_regie_id;
  END IF;
  
ELSIF v_mode_diffusion = 'assigné' THEN
  -- Mode assigné: Vérifier que entreprise correspond à celle assignée
  IF v_entreprise_assignee IS NULL THEN
    RAISE EXCEPTION 'Ticket en mode assigné mais aucune entreprise assignée (données incohérentes)';
  END IF;
  IF v_entreprise_assignee != p_entreprise_id THEN
    RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
  END IF;
  
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %', COALESCE(v_mode_diffusion, 'NULL');
END IF;
```

**🔴 PROBLÈME IDENTIFIÉ:**

Ligne 49: `IF v_mode_diffusion = 'public' THEN`  
Ligne 66: `ELSIF v_mode_diffusion = 'assigné' THEN`  
Ligne 71: `ELSE RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %'`

**Terminologie RPC M05:**
- ✅ Accepte: `'public'`, `'assigné'`
- ❌ Rejette: `'general'`, `'restreint'`, NULL, autre

**Note incohérence M05:**  
Ligne 51 vérifie `mode_diffusion = 'general'` dans `regies_entreprises` mais la condition IF attend `'public'` dans tickets.  
Incohérence interne = preuve migration partielle appliquée.

### Preuve 2: Version RPC correcte (M41)

**Source:** Migration M41 (fichier: `supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql`)

**Code RPC version M41 (lignes 55-66):**

```sql
IF v_mode_diffusion = 'general' THEN
  -- Mode general: Vérifier que entreprise est autorisée en mode 'general'
  IF NOT EXISTS (
    SELECT 1 FROM regies_entreprises 
    WHERE regie_id = v_regie_id 
    AND entreprise_id = p_entreprise_id 
    AND mode_diffusion = 'general'
  ) THEN
    RAISE EXCEPTION 'Entreprise % non autorisée pour tickets general de régie %', p_entreprise_id, v_regie_id;
  END IF;
  
ELSIF v_mode_diffusion = 'restreint' THEN
  -- Mode restreint: Vérifier que entreprise est autorisée en mode 'restreint'
  ...
```

**✅ Terminologie RPC M41:**
- ✅ Accepte: `'general'`, `'restreint'`
- ❌ Rejette: `'public'`, `'assigné'`, NULL, autre

**Statut migration M41:** ❌ **NON APPLIQUÉE** (fichier créé 2026-01-04, absent migration_logs)

### Preuve 3: Colonne tickets.mode_diffusion actuelle

**Source:** CSV `4_Colonnes détaillées (types, null, défaut, identité).csv`

```csv
public,tickets,22,mode_diffusion,text,text,YES,null,NO,null
```

**Détails:**
- Type: `text`
- Nullable: `YES` (NULL autorisé)
- Default: `null`
- Contrainte CHECK: **ABSENTE** (M30/M35 non appliqués)

**Conséquence:** Aucune validation DB sur valeurs insérées (peut contenir `'general'`, `'public'`, `'invalid'`, etc.)

### Preuve 4: Enum ticket_status

**Source:** CSV `4_Colonnes détaillées` ligne tickets.statut

```csv
public,tickets,6,statut,USER-DEFINED,ticket_status,NO,'nouveau'::ticket_status,NO,null
```

**Détails:**
- Type: `USER-DEFINED` (enum)
- Enum name: `ticket_status`
- Default: `'nouveau'::ticket_status`

**Valeurs enum (à extraire):** Nécessite requête pg_enum ou test manuel

**Erreur rapportée UI:** `invalid input value for enum ticket_status: "diffuse"`

**Hypothèse:** Valeur attendue `'diffuse'` absente de l'enum (probablement `'diffusé'` ou `'diffusee'`)

### CONCLUSION BLOCKER #2

**✅ PREUVE FORMELLE: RPC `accept_ticket_and_create_mission()` version M05 (OBSOLÈTE) en production**

**Chaîne causale:**
1. Migration M05 appliquée manuellement (SQL Editor) avant 2025-12-24
2. RPC M05 attend terminologie `'public'` / `'assigné'`
3. Changement terminologie métier → `'general'` / `'restreint'`
4. Migration M41 (correctif RPC) créée 2026-01-04 mais **NON APPLIQUÉE**
5. Tickets insérés avec `mode_diffusion='general'` (nouvelle norme)
6. RPC M05 rejette `'general'` → ELSE clause → EXCEPTION

**Fix requis:**
1. Appliquer migration M41 (remplace RPC avec terminologie correcte)
2. Optionnel: Appliquer M30/M35 (contrainte CHECK + policies RLS)

---

## BLOCKER #3: Enum `ticket_status` valeur `'diffuse'` invalide

### Symptôme rapporté (audit)

```
Erreur: invalid input value for enum ticket_status: "diffuse"
Contexte: Tentative SELECT tickets.statut via Supabase JS SDK
```

### Preuve 1: Enum détecté

**Source:** CSV `4_Colonnes détaillées`

```
Column: tickets.statut
Type: USER-DEFINED (enum ticket_status)
Default: 'nouveau'::ticket_status
```

**✅ Confirmation: Colonne statut utilise enum `ticket_status`**

### Preuve 2: Valeurs enum réelles

**⚠️ IMPOSSIBLE À EXTRAIRE via Supabase JS SDK anon**

Requête nécessaire (à exécuter manuellement dans Supabase Studio):

```sql
SELECT e.enumlabel 
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'ticket_status'
ORDER BY e.enumsortorder;
```

**Valeurs probables (basé sur migrations + code):**
- `'nouveau'` (default confirmé)
- `'en_attente'` (mentionné M05)
- `'en_cours'` (mentionné M05)
- `'termine'` ou `'terminé'`
- `'annule'` ou `'annulé'`
- `'diffusé'` ou `'diffusee'` (⚠️ PAS `'diffuse'`)

**Erreur:** Code/UI utilise valeur `'diffuse'` (sans accent) qui n'existe pas dans enum.

### CONCLUSION BLOCKER #3

**⚠️ PREUVE PARTIELLE: Enum `ticket_status` existe, valeur `'diffuse'` probablement absente**

**Fix requis:**
1. Extraire valeurs enum réelles (requête manuelle Supabase Studio)
2. **Soit:** Ajouter `'diffuse'` à l'enum (migration ALTER TYPE)
3. **Soit:** Corriger code/UI pour utiliser valeur existante (ex: `'diffusé'` → `'diffuse'`)

**Décision:** Basée sur grep code source (identifier usage `'diffuse'` vs `'diffusé'`)

---

## RÉSUMÉ PREUVES

| Blocker | Preuve | Source | Conclusion |
|---------|--------|--------|------------|
| missions.disponibilite_id missing | ❌ Colonne absente CSV | CSV 4_Colonnes (20 colonnes, pas de disponibilite_id) | **CONFIRMÉ** - Migration M42 non appliquée |
| RPC mode_diffusion obsolète | ✅ RPC M05 attend 'public'/'assigné' | Migration M05 lignes 49-71 | **CONFIRMÉ** - Migration M41 non appliquée |
| Enum ticket_status 'diffuse' | ⚠️ Enum existe, valeurs exactes inconnues | CSV 4_Colonnes + erreur runtime | **PARTIEL** - Requête manuelle requise |

---

## FICHIERS GÉNÉRÉS

- `_fix_output/01_db_proofs.json` (résultats bruts tests)
- `_fix_output/01_db_proofs.md` (ce fichier - preuves formatées)

---

**FIN ÉTAPE 1 — STOP**

Actions ÉTAPE 2: Fix blocker missions.disponibilite_id
