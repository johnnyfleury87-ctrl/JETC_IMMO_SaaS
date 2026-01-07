# AUDIT FACTURATION - ÉTAPE 5

**Date** : 2026-01-07  
**Statut** : Audit terminé - Incohérence détectée  

---

## 📋 RÉSUMÉ

### Tables vérifiées

| Table | Existe | Enregistrements | Statut |
|-------|--------|-----------------|--------|
| `factures` | ✅ | 0 | OK - Prête à utiliser |
| `factures_commissions_jetc` | ❌ | - | N'existe PAS |
| `factures_lignes` | ✅ | 0 | OK |

---

## 🚨 INCOHÉRENCE CRITIQUE DÉTECTÉE

### PDF vs Schéma SQL

**PDF (ÉTAPE 6.1)** :
> "Admin applique commission JETC **2%**"

**Schéma SQL (`supabase/schema/15_facturation.sql`, ligne 39)** :
```sql
taux_commission decimal(5,2) not null default 10.00
```

**Résultat** : Le taux de commission est de **10%** au lieu de **2%**

---

## ✅ FLUX FACTURATION EXISTANT

### Structure de la table `factures`

La commission JETC est **intégrée directement** dans la table factures :

```sql
CREATE TABLE factures (
  id uuid,
  mission_id uuid UNIQUE,           -- 1 mission = 1 facture
  entreprise_id uuid,
  regie_id uuid,
  numero text UNIQUE,               -- Ex: FAC-2026-001
  
  montant_ht decimal(10,2),         -- Montant HT saisi
  taux_tva decimal(5,2) DEFAULT 20, -- TVA (défaut 20%)
  montant_tva GENERATED,            -- Calculé auto
  montant_ttc GENERATED,            -- Calculé auto
  
  taux_commission decimal DEFAULT 10.00,  -- ❌ DEVRAIT ÊTRE 2.00
  montant_commission GENERATED,     -- Calculé auto
  
  statut text,                      -- brouillon | envoyee | payee | annulee
  date_emission date,
  date_echeance date,
  date_envoi timestamptz,
  date_paiement timestamptz
);
```

### Workflow

1. **Mission terminée** (`statut = terminee`)
2. **Entreprise crée facture** :
   - Saisit `montant_ht`
   - Choisit `taux_tva` (défaut 20%)
   - `montant_ttc` calculé automatiquement
   - `montant_commission` calculé automatiquement (taux × montant_ht)
3. **Facture envoyée à régie** (`statut = envoyee`)
4. **Admin consolide** :
   - Voit toutes les factures
   - Commission JETC visible dans `montant_commission`

---

## 🔧 CORRECTION REQUISE

### Modifier le taux de commission de 10% → 2%

**Fichier** : `supabase/schema/15_facturation.sql`

**Ligne 39** :
```sql
-- AVANT
taux_commission decimal(5,2) not null default 10.00

-- APRÈS
taux_commission decimal(5,2) not null default 2.00
```

**Ligne 98** (dans la fonction) :
```sql
-- AVANT
p_taux_commission decimal default 10.00

-- APRÈS
p_taux_commission decimal default 2.00
```

### Migration SQL à appliquer

```sql
-- Mettre à jour le défaut pour les nouvelles factures
ALTER TABLE factures 
ALTER COLUMN taux_commission SET DEFAULT 2.00;

-- Mettre à jour les factures existantes (si elles existent)
UPDATE factures 
SET taux_commission = 2.00 
WHERE taux_commission = 10.00;
```

---

## ✅ FONCTIONNALITÉS EXISTANTES

### Fonction RPC : `generate_facture_from_mission`

**Paramètres** :
- `p_mission_id` : UUID de la mission
- `p_montant_ht` : Montant HT
- `p_date_echeance` : Date échéance (défaut +30 jours)
- `p_taux_tva` : Taux TVA (défaut 20%)
- `p_taux_commission` : Taux commission (défaut 10% ❌ → devrait être 2%)

**Ce qu'elle fait** :
1. Vérifie que la mission existe et est terminée
2. Récupère entreprise_id et regie_id
3. Génère le numéro de facture automatiquement
4. Crée la facture
5. Calcule automatiquement TVA + TTC + Commission

---

## 📊 INTERFACE ENTREPRISE

### Fonctionnalités à implémenter/vérifier

1. **Bouton "Créer facture"** :
   - Visible uniquement pour missions `statut = terminee`
   - Ouvre un formulaire

2. **Formulaire facture** :
   - Champs requis :
     - Montant HT (saisie manuelle)
     - Date échéance (sélecteur de date)
     - Taux TVA (pré-rempli 20%, modifiable)
   - Champs calculés auto :
     - Montant TVA
     - Montant TTC
     - Commission JETC 2%
   - Bouton "Enregistrer brouillon"
   - Bouton "Envoyer à la régie"

3. **Liste factures** :
   - Filtres par statut
   - Affichage : numéro, date, montant TTC, statut
   - Actions : voir PDF, modifier (si brouillon)

---

## 👁️ INTERFACE RÉGIE

### Fonctionnalités à implémenter/vérifier

1. **Réception factures** :
   - Liste des factures reçues (`statut = envoyee`)
   - Filtre par entreprise
   - Filtre par période

2. **Détail facture** :
   - Informations mission
   - Montants détaillés (HT, TVA, TTC)
   - Télécharger PDF
   - Marquer comme payée (si autorisé)

---

## 🔒 INTERFACE ADMIN JETC

### Fonctionnalités à implémenter/vérifier

1. **Dashboard commissions** :
   - Total commissions du mois en cours
   - Total commissions par régie
   - Total commissions par entreprise
   - Export CSV

2. **Consolidation mensuelle** :
   - Bouton "Générer rapport mensuel"
   - Affiche :
     - Nombre de factures
     - Total HT
     - Total commissions JETC
   - Export PDF/Excel

3. **Vue globale** :
   - Toutes les factures (tous statuts)
   - Graphiques : évolution mensuelle
   - Top 10 entreprises

---

## ✅ ACTIONS IMMÉDIATES

1. ✅ Corriger le taux de commission 10% → 2%
2. ⏳ Appliquer la migration SQL
3. ⏳ Tester la création de facture depuis l'interface entreprise
4. ⏳ Vérifier le calcul automatique
5. ⏳ Tester l'envoi à la régie

---

## 📝 FICHIERS À MODIFIER

| Fichier | Action | Priorité |
|---------|--------|----------|
| `supabase/schema/15_facturation.sql` | Changer default 10.00 → 2.00 | CRITIQUE |
| (Migration SQL à créer) | ALTER TABLE + UPDATE | CRITIQUE |

---

**Statut ÉTAPE 5** : ✅ Audit terminé - Correction requise (10% → 2%)

---

*Dernière mise à jour : 2026-01-07*
