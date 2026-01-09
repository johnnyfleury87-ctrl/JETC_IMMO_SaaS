# 🔍 ANALYSE IMPACTS M60 - AVANT CORRECTION

**Date:** 2026-01-09  
**Contexte:** Retour critique sur migration M60 avant exécution  

---

## 🚨 POINTS CRITIQUES IDENTIFIÉS

### 1. INITIALISATION PAR VILLE (BLOQUANT)

**Problème détecté:**
```sql
UPDATE regies 
SET currency = CASE 
  WHEN ville IN ('Lausanne', 'Genève', 'Zurich', ...) THEN 'CHF'
  WHEN ville IN ('Paris', 'Lyon', 'Marseille', ...) THEN 'EUR'
  ELSE 'EUR'
END
```

**Pourquoi c'est dangereux:**
- ❌ Supposition métier = futur bug assuré
- ❌ Une régie suisse peut gérer des biens en EUR
- ❌ Une régie française peut gérer des biens en CHF
- ❌ Aucune validation métier réelle
- ❌ Pas de traçabilité de la décision

**Impact actuel:**
- 2 régies dans la base
- Fleury_Teste (ville: NULL) → serait forcé en EUR
- Autre régie → détection automatique non fiable

**Statut:** ❌ À CORRIGER IMPÉRATIVEMENT

---

### 2. LIAISON entreprises → regies

**Méthode actuelle:**
```sql
UPDATE entreprises e
SET regie_id = (
  SELECT DISTINCT t.regie_id
  FROM missions m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE m.entreprise_id = e.id
  LIMIT 1
)
```

**Problèmes:**
- ⚠️ LIMIT 1 arbitraire si plusieurs régies
- ⚠️ Pas de garantie d'unicité
- ⚠️ Quelle régie si l'entreprise travaille pour plusieurs?
- ⚠️ Pas de validation de cohérence

**Données actuelles:**
```
2 entreprises:
- Perreti SA: aucune regie_id actuellement
- Toutpourtout: aucune regie_id actuellement
```

**Impact:**
- Déduction via missions existantes
- Risque: entreprise multi-régies → choix arbitraire

**Statut:** ⚠️ À DOCUMENTER ET SÉCURISER

---

### 3. RENOMMAGE montant_reel_chf → montant_reel

**Usages détectés dans le code:**

#### Frontend (HTML):
- `public/entreprise/dashboard.html` ligne 1979, 1983
  ```javascript
  .select('montant_reel_chf')
  if (data && data.montant_reel_chf)
  ```

#### Backend (RPC SQL):
- `_apply_m50_direct.js` ligne 191, 285, 317
  - RPC `generate_facture_from_mission`
  - Trigger `auto_generate_facture_on_mission_complete`
  - Vue `missions_factures_complet`

#### Migrations existantes:
- `supabase/migrations/20251226171000_m11_harmonize_missions_montant_chf.sql`
  - Migration qui a CRÉÉ montant_reel_chf
  - Contrainte CHECK `check_montant_reel_chf_positif`
  - Index `idx_missions_montant_reel_chf`

#### Test:
- `_test_workflow_facturation.js` ligne 219

**Impact critique:**
- ❌ Frontend CASSÉ après migration
- ❌ RPC CASSÉES après migration
- ❌ Contraintes/Index à renommer aussi
- ❌ Tests à adapter

**Statut:** 🔴 BLOQUANT - Migration en deux temps obligatoire

---

## 📊 ÉTAT ACTUEL DE LA BASE

### Régies (2)
```json
{
  "id": "ec0ad50b-7b27-45b3-aa6c-ab31d061e38f",
  "nom": "Fleury_Teste",
  "ville": null,
  "currency": null  // N'existe pas encore
}
```

### Entreprises (2)
```json
{
  "id": "6ff210bc-9985-457c-8851-4185123edb07",
  "nom": "Perreti SA",
  "ville": "Lausanne",
  "currency": null,  // N'existe pas encore
  "regie_id": null   // N'existe pas encore
}
```

### Missions (3)
```json
{
  "devise": "CHF",  // Existe déjà
  "montant_reel_chf": null
}
```

### Factures (3)
```json
{
  "montant_ht": 100,
  "taux_tva": 8.1,
  "montant_ttc": 110.1,
  "currency": null  // N'existe pas encore
}
```

---

## ✅ CE QUI EST BON

### Structure validée:
- ✅ Ajout currency sur regies (source de vérité)
- ✅ Ajout currency sur entreprises
- ✅ Ajout currency sur locataires
- ✅ Ajout currency sur factures
- ✅ Ajout regie_id sur entreprises (FK nécessaire)
- ✅ Contraintes CHECK (EUR/CHF only)
- ✅ Index pour performances

### Triggers validés:
- ✅ Propagation automatique de la devise
- ✅ Validation de cohérence
- ✅ Principe de source de vérité (régie)

### Vue de contrôle:
- ✅ v_currency_coherence pour audit

---

## 🔧 CORRECTIONS NÉCESSAIRES

### 1. Supprimer initialisation par ville

**Remplacer par:**
```sql
-- Option A: Laisser NULL et forcer saisie manuelle
UPDATE regies SET currency = NULL WHERE currency IS NULL;
-- → Puis interface UI pour saisir

-- Option B: Valeur par défaut explicite documentée
UPDATE regies SET currency = 'CHF' WHERE currency IS NULL;
-- → Avec commentaire clair: "Par défaut CHF, à modifier manuellement si EUR"
```

**Recommandation:** Option B avec documentation claire

### 2. Sécuriser liaison entreprises → regies

**Améliorer la requête:**
```sql
-- Ajouter vérification d'unicité
WITH entreprise_regies AS (
  SELECT 
    e.id AS entreprise_id,
    t.regie_id,
    COUNT(DISTINCT t.regie_id) AS nb_regies
  FROM entreprises e
  JOIN missions m ON m.entreprise_id = e.id
  JOIN tickets t ON t.id = m.ticket_id
  GROUP BY e.id, t.regie_id
)
UPDATE entreprises e
SET regie_id = er.regie_id
FROM entreprise_regies er
WHERE e.id = er.entreprise_id
  AND er.nb_regies = 1;  -- Seulement si une seule régie

-- Log des entreprises multi-régies
SELECT e.nom, COUNT(DISTINCT t.regie_id) as nb_regies
FROM entreprises e
JOIN missions m ON m.entreprise_id = e.id
JOIN tickets t ON t.id = m.ticket_id
GROUP BY e.id, e.nom
HAVING COUNT(DISTINCT t.regie_id) > 1;
```

### 3. Renommage en deux temps

**Phase 1 - Ajouter nouvelle colonne:**
```sql
-- Créer colonne montant_reel (sans supprimer montant_reel_chf)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS montant_reel NUMERIC(10,2);

-- Copier les données
UPDATE missions SET montant_reel = montant_reel_chf WHERE montant_reel IS NULL;

-- Index sur nouvelle colonne
CREATE INDEX IF NOT EXISTS idx_missions_montant_reel ON missions(montant_reel);
```

**Phase 2 - Migration code (AVANT suppression colonne):**
- Adapter dashboard.html
- Adapter RPC
- Adapter tests
- Déployer code

**Phase 3 - Suppression ancienne colonne (APRÈS déploiement code):**
```sql
-- Supprimer contraintes et index
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_montant_reel_chf_positif;
DROP INDEX IF EXISTS idx_missions_montant_reel_chf;

-- Supprimer colonne
ALTER TABLE missions DROP COLUMN IF EXISTS montant_reel_chf;
```

---

## 📋 PLAN DE MIGRATION CORRIGÉ

### M60A - Structure + Données sûres (EXÉCUTABLE MAINTENANT)
1. Ajouter colonnes currency (regies, entreprises, locataires, factures)
2. Ajouter regie_id sur entreprises
3. Ajouter montant_reel (SANS supprimer montant_reel_chf)
4. Index
5. Triggers de propagation
6. Initialiser currency = 'CHF' par défaut (documenté)
7. Lier entreprises aux régies (avec vérification)
8. Vue de cohérence

### M60B - Migration code (AVANT suppression)
1. Adapter dashboard.html (montant_reel_chf → montant_reel)
2. Adapter RPC
3. Tests
4. Déploiement

### M60C - Nettoyage (APRÈS déploiement code)
1. Supprimer montant_reel_chf
2. Nettoyer contraintes/index obsolètes

---

## 🎯 VALIDATION FINALE REQUISE

Avant exécution M60A corrigée:
- [ ] Devise par défaut documentée (CHF justifié car projet Suisse)
- [ ] Lien entreprises/régies avec log des cas multi-régies
- [ ] montant_reel ajouté SANS casser montant_reel_chf
- [ ] Aucun code cassé par M60A seule
- [ ] Plan clair pour M60B et M60C

---

**Conclusion:** Migration M60 bonne dans le principe, mais à découper en 3 phases pour éviter toute régression.
