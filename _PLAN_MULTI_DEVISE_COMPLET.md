# 🎯 PLAN COMPLET MULTI-DEVISE EUR/CHF

**Date:** 2026-01-09  
**Statut:** ÉTAPE 1 COMPLÉTÉE - Audit terminé  

---

## 📊 SYNTHÈSE DE L'AUDIT (ÉTAPE 1)

### ✅ État Actuel

**Tables analysées:** 6 (regies, entreprises, locataires, tickets, missions, factures)

#### Champs devise existants:
- ✅ `tickets.devise` (CHF détecté)
- ✅ `missions.devise` (CHF détecté)
- ❌ `factures` : **AUCUN champ devise** ⚠️
- ❌ `regies` : **AUCUN champ devise** ⚠️
- ❌ `entreprises` : **AUCUN champ devise** ⚠️
- ❌ `locataires` : **AUCUN champ devise** ⚠️

#### Champs monétaires:
- `missions.montant_reel_chf` (1 champ)
- `factures` (5 champs): `montant_ht`, `taux_tva`, `montant_tva`, `montant_ttc`, `montant_commission`

#### Relations hiérarchiques:
- ✅ locataires → regies
- ✅ tickets → locataires
- ✅ tickets → regies
- ✅ missions → tickets
- ✅ missions → entreprises
- ✅ factures → missions
- ✅ factures → entreprises
- ✅ factures → regies
- ❌ **entreprises → regies MANQUANTE** ⚠️
- ❌ **locataires → entreprises MANQUANTE**

### 🚨 PROBLÈMES IDENTIFIÉS

1. **CRITIQUE:** Factures sans champ devise
2. **CRITIQUE:** Regies sans champ devise (devrait être la source de vérité)
3. **BLOQUANT:** Pas de relation directe entreprises → regies
4. **IMPORTANT:** Champ `montant_reel_chf` codé en dur pour CHF
5. **IMPORTANT:** Pas de champ devise sur entreprises

---

## 🎯 PLAN D'ACTION DÉTAILLÉ

### ✅ ÉTAPE 1 - AUDIT [COMPLÉTÉE]

**Objectif:** Comprendre l'existant  
**Résultat:** Audit complet sauvegardé dans `_AUDIT_MULTI_DEVISE_ETAPE1_RESULTS.json`

---

### 📝 ÉTAPE 2 - MIGRATION MODÈLE DE DONNÉES

#### A. Ajouter les champs devise manquants

**Script SQL à créer:** `_M60_ADD_MULTI_DEVISE.sql`

```sql
-- Priorité 1: Ajouter devise sur REGIES (source de vérité)
ALTER TABLE regies 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR' CHECK (currency IN ('EUR', 'CHF'));

-- Priorité 2: Ajouter devise sur ENTREPRISES
ALTER TABLE entreprises 
ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('EUR', 'CHF'));

-- Priorité 3: Ajouter devise sur LOCATAIRES
ALTER TABLE locataires 
ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('EUR', 'CHF'));

-- Priorité 4: Ajouter devise sur FACTURES (critique!)
ALTER TABLE factures 
ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('EUR', 'CHF'));

-- Initialiser les valeurs par défaut basées sur les données existantes
UPDATE regies SET currency = 'CHF' WHERE ville IN ('Lausanne', 'Genève', 'Zurich');
UPDATE regies SET currency = 'EUR' WHERE currency IS NULL;
```

#### B. Ajouter la relation entreprises → regies

```sql
-- Ajouter la FK manquante
ALTER TABLE entreprises 
ADD COLUMN IF NOT EXISTS regie_id UUID REFERENCES regies(id);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_entreprises_regie_id ON entreprises(regie_id);
```

#### C. Renommer le champ montant_reel_chf

```sql
-- Renommer pour être agnostique de la devise
ALTER TABLE missions RENAME COLUMN montant_reel_chf TO montant_reel;

-- Le champ missions.devise existe déjà, donc ça reste cohérent
```

#### D. Créer des triggers de propagation

```sql
-- Trigger: Quand une entreprise est créée, hériter de la devise de la régie
CREATE OR REPLACE FUNCTION sync_entreprise_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_entreprise_currency
BEFORE INSERT OR UPDATE OF regie_id ON entreprises
FOR EACH ROW
EXECUTE FUNCTION sync_entreprise_currency();

-- Trigger: Quand un locataire est créé, hériter de la devise de la régie
CREATE OR REPLACE FUNCTION sync_locataire_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_locataire_currency
BEFORE INSERT OR UPDATE OF regie_id ON locataires
FOR EACH ROW
EXECUTE FUNCTION sync_locataire_currency();

-- Trigger: Facture hérite de la devise de la mission/régie
CREATE OR REPLACE FUNCTION sync_facture_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_facture_currency
BEFORE INSERT OR UPDATE OF regie_id ON factures
FOR EACH ROW
EXECUTE FUNCTION sync_facture_currency();
```

#### E. Validation des données existantes

```sql
-- Forcer la cohérence sur les données existantes
UPDATE entreprises e
SET currency = r.currency
FROM regies r
WHERE e.regie_id = r.id AND e.currency IS NULL;

UPDATE locataires l
SET currency = r.currency
FROM regies r
WHERE l.regie_id = r.id AND l.currency IS NULL;

UPDATE factures f
SET currency = r.currency
FROM regies r
WHERE f.regie_id = r.id AND f.currency IS NULL;
```

---

### 📝 ÉTAPE 3 - MISE À JOUR FORMULAIRES UI

#### Fichiers à modifier:

1. **Formulaire Régie** (adhésion)
   - Ajouter sélecteur EUR/CHF
   - Par défaut: EUR
   - Requis, non modifiable après création

2. **Formulaire Entreprise**
   - Afficher devise héritée de la régie
   - Non éditable
   - Badge visuel clair

3. **Formulaire Locataire**
   - Afficher devise héritée de la régie
   - Non éditable

4. **Formulaire Facture**
   - Afficher devise héritée automatiquement
   - Symbole € ou CHF sur tous les montants
   - Format nombre adapté (virgule vs point)

5. **Liste/Tableaux**
   - Colonne "Devise" sur tous les tableaux de factures
   - Filtres par devise si pertinent

---

### 📝 ÉTAPE 4 - LOGIQUE FACTURATION

#### Fichiers à auditer:

- RPC `generer_facture`
- RPC `calculer_facture`
- Tout code calculant HT/TVA/TTC

#### Modifications:

```typescript
// Exemple: adaptation des calculs
interface FactureCalculs {
  currency: 'EUR' | 'CHF';
  montant_ht: number;
  taux_tva: number; // 20% pour EUR, 8.1% pour CHF
  montant_tva: number;
  montant_ttc: number;
}

function calculerFacture(montant_ht: number, currency: 'EUR' | 'CHF'): FactureCalculs {
  const taux_tva = currency === 'EUR' ? 20 : 8.1;
  const montant_tva = montant_ht * (taux_tva / 100);
  const montant_ttc = montant_ht + montant_tva;
  
  return {
    currency,
    montant_ht,
    taux_tva,
    montant_tva,
    montant_ttc
  };
}
```

---

### 📝 ÉTAPE 5 - RLS & SÉCURITÉ

#### Policies à vérifier/créer:

```sql
-- Policy: Interdire changement de devise sur factures
CREATE POLICY "factures_currency_immutable" ON factures
FOR UPDATE
USING (
  -- Vérifier que la devise ne change pas
  currency = (SELECT currency FROM factures WHERE id = factures.id)
);

-- Policy: Vérifier cohérence devise entreprise/régie
CREATE POLICY "entreprises_currency_match_regie" ON entreprises
FOR INSERT
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM regies r 
    WHERE r.id = regie_id 
    AND r.currency != entreprises.currency
  )
);
```

---

### 📝 ÉTAPE 6 - TESTS NON-RÉGRESSION

#### Scénarios à tester:

**Cas EUR:**
1. Créer régie EUR
2. Créer entreprise → doit hériter EUR
3. Créer locataire → doit hériter EUR
4. Créer ticket → devise EUR
5. Créer mission → devise EUR
6. Créer facture → devise EUR, TVA 20%

**Cas CHF:**
1. Créer régie CHF
2. Créer entreprise → doit hériter CHF
3. Créer locataire → doit hériter CHF
4. Créer ticket → devise CHF
5. Créer mission → devise CHF
6. Créer facture → devise CHF, TVA 8.1%

**Tests de sécurité:**
- Tenter de créer facture EUR sur mission CHF → doit échouer
- Tenter de modifier currency d'une facture → doit échouer

---

## 📋 CHECKLIST DE VALIDATION

### ÉTAPE 2
- [ ] Migration SQL créée et testée
- [ ] Champs currency ajoutés partout
- [ ] Relation entreprises → regies créée
- [ ] Triggers de propagation fonctionnels
- [ ] Données existantes migrées sans perte

### ÉTAPE 3
- [ ] Formulaire régie avec sélecteur devise
- [ ] Formulaires affichent devise héritée
- [ ] Symboles € / CHF corrects partout
- [ ] Formats de nombres adaptés

### ÉTAPE 4
- [ ] RPC calculs factures testés EUR
- [ ] RPC calculs factures testés CHF
- [ ] TVA correcte selon devise
- [ ] Aucun mélange de devises

### ÉTAPE 5
- [ ] Policies RLS créées
- [ ] Tests sécurité passés
- [ ] Impossibilité de changer devise

### ÉTAPE 6
- [ ] Scénario EUR complet testé
- [ ] Scénario CHF complet testé
- [ ] Aucune régression détectée
- [ ] Documentation utilisateur mise à jour

---

## 🚀 PROCHAINE ACTION

**État actuel:** ÉTAPE 1 ✅ COMPLÉTÉE

**Prochaine étape:** ÉTAPE 2 - Créer et exécuter la migration SQL

**Commande à exécuter:**
```bash
node _apply_m60_multi_devise.js
```

---

## 📝 NOTES IMPORTANTES

1. **Source de vérité:** La devise est définie au niveau RÉGIE
2. **Propagation:** Automatique via triggers
3. **Immutabilité:** Une fois créée, la devise ne peut pas changer
4. **Aucun mélange:** Impossible de mélanger EUR et CHF dans un flux
5. **TVA adaptative:** 20% pour EUR, 8.1% pour CHF
6. **Format affichage:** Adapter selon devise (1 234,56 € vs 1'234.56 CHF)
