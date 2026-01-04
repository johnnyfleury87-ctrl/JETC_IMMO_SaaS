# MATRICE BLOCKERS — État / Cause / Fix

**Date:** 2026-01-04  
**Source:** Preuves DB réelles (ÉTAPE 1)

---

## BLOCKER #1: Column "disponibilite_id" does not exist

| Attribut | Valeur |
|----------|--------|
| **Gravité** | 🔴 CRITICAL (bloque acceptation ticket entreprise) |
| **Code erreur** | SQLSTATE 42703 |
| **Contexte** | RPC accept_ticket_and_create_mission() |
| **Preuve** | CSV 4_Colonnes: missions a 20 colonnes, `disponibilite_id` absente |
| **Cause racine** | Migration M42 créée 2026-01-04 mais NON appliquée en DB |
| **Impact** | Entreprise ne peut accepter ticket avec créneau horaire |
| **Fix minimal** | Appliquer migration M42: `ALTER TABLE missions ADD COLUMN disponibilite_id uuid` |
| **Rollback** | `ALTER TABLE missions DROP COLUMN disponibilite_id` |
| **Dépendances** | Table tickets_disponibilites (existe - confirmé CSV) |
| **Tests requis** | SELECT disponibilite_id FROM missions (doit réussir) |
| **Priorité** | 1 (FIX IMMÉDIAT) |

---

## BLOCKER #2: Mode diffusion invalide "general"

| Attribut | Valeur |
|----------|--------|
| **Gravité** | 🔴 CRITICAL (bloque acceptation ticket entreprise) |
| **Code erreur** | HTTP 400 (exception RPC) |
| **Contexte** | RPC accept_ticket_and_create_mission() ligne 71 |
| **Preuve** | Migration M05 lignes 49-71: IF mode='public' OR 'assigné' ELSE ERROR |
| **Cause racine** | RPC version M05 (obsolète) attend 'public'/'assigné', rejette 'general'/'restreint' |
| **Impact** | Entreprise ne peut accepter ticket avec mode_diffusion='general' |
| **Fix minimal** | Appliquer migration M41: remplace RPC avec terminologie 'general'/'restreint' |
| **Rollback** | Restaurer RPC version M05 (terminologie obsolète) |
| **Dépendances** | Aucune (remplacement RPC standalone) |
| **Tests requis** | Appel RPC avec ticket mode_diffusion='general' (doit réussir) |
| **Priorité** | 1 (FIX IMMÉDIAT) |

**⚠️ Incohérence M05:**  
RPC M05 ligne 49 teste `v_mode_diffusion = 'public'` (tickets)  
RPC M05 ligne 61 teste `mode_diffusion = 'general'` (regies_entreprises)  
→ Preuve migration partielle / incohérence terminologique

---

## BLOCKER #3: Enum ticket_status valeur "diffuse" invalide

| Attribut | Valeur |
|----------|--------|
| **Gravité** | 🟠 HIGH (bloque lecture tickets si valeur présente) |
| **Code erreur** | invalid input value for enum |
| **Contexte** | SELECT tickets.statut via Supabase JS |
| **Preuve** | CSV 4_Colonnes: statut type USER-DEFINED (enum ticket_status) |
| **Cause racine** | Code/UI utilise 'diffuse' (sans accent), enum contient probablement 'diffusé' |
| **Impact** | SELECT tickets échoue si donnée contient 'diffuse', INSERT 'diffuse' échoué |
| **Fix minimal** | **Option A:** Migration ADD VALUE 'diffuse' à enum<br>**Option B:** Corriger code pour utiliser valeur existante |
| **Rollback** | **Option A:** Impossible (PostgreSQL ne permet pas DROP enum value)<br>**Option B:** Restaurer code |
| **Dépendances** | Identifier valeurs enum réelles (requête pg_enum manuelle) |
| **Tests requis** | INSERT/SELECT ticket avec statut='diffuse' (doit réussir) |
| **Priorité** | 2 (FIX APRÈS #1 et #2) |

**⚠️ Décision requise:**  
Grep codebase pour identifier usage `'diffuse'` vs `'diffusé'` vs `'diffusee'`.  
Choisir standardisation (enum ou code).

---

## SYNTHÈSE PRIORITÉS

| Priorité | Blocker | Migration | Action immédiate |
|----------|---------|-----------|------------------|
| **1A** | disponibilite_id missing | M42 | Appliquer migration M42 (ALTER TABLE missions ADD COLUMN) |
| **1B** | mode_diffusion 'general' | M41 | Appliquer migration M41 (remplacer RPC) |
| **2** | enum 'diffuse' invalide | TBD | 1. Requête pg_enum manuelle<br>2. Grep codebase<br>3. Migration enum OU patch code |

**Actions séquentielles:**
1. ✅ ÉTAPE 1 terminée (preuves établies)
2. ⏳ ÉTAPE 2: Fix disponibilite_id (migration M42)
3. ⏳ ÉTAPE 3: Fix mode_diffusion (migration M41)
4. ⏳ ÉTAPE 4: Fix enum ticket_status (après investigation)
5. ⏳ ÉTAPE 5: Tests automatisés
6. ⏳ ÉTAPE 6: Recap final + archivage

---

## DÉPENDANCES MIGRATIONS

```
M42 (disponibilite_id)
├─ Dépend: Table tickets_disponibilites (✅ existe)
└─ Bloque: Acceptation ticket avec créneau

M41 (RPC harmonisation)
├─ Dépend: Aucune (standalone)
├─ Remplace: M05 (RPC obsolète)
└─ Bloque: Acceptation ticket mode='general'

M30/M35 (optionnel - contrainte CHECK)
├─ Dépend: M41 (RPC correcte d'abord)
└─ Améliore: Validation données + policies RLS
```

**Ordre application recommandé:**
1. M42 (disponibilite_id) - indépendant
2. M41 (RPC) - indépendant
3. M30/M35 (CHECK + policies) - optionnel après M41

---

**FIN MATRICE — STOP**
