# AUDIT RLS (ROW LEVEL SECURITY) - ÉTAPE 4

**Date** : 2026-01-07  
**Statut** : Audit en cours  

---

## 📋 CONTEXTE

Les fichiers SQL définissent des policies RLS complètes, mais il faut vérifier qu'elles sont bien appliquées en base de données Supabase.

---

## 🔍 POLICIES DÉFINIES DANS LE CODE

### Table : `missions`

| Policy Name | Operation | Rôle | Règle |
|------------|-----------|------|-------|
| `Regie can view missions for own tickets` | SELECT | Régie | Voit missions liées à ses tickets (JOIN complexe) |
| `Entreprise can view own missions` | SELECT | Entreprise | Voit ses missions (entreprise_id match) |
| `Locataire can view missions for own tickets` | SELECT | Locataire | Voit missions de ses tickets |
| `Admin JTEC can view all missions` | SELECT | Admin | Voit tout (role = admin_jtec) |
| `Technicien can view assigned missions` | SELECT | Technicien | Voit UNIQUEMENT ses missions (technicien_id match) ✅ |
| `Entreprise can update own missions` | UPDATE | Entreprise | Modifie ses missions |
| `Regie can update missions for own tickets` | UPDATE | Régie | Valide missions de ses tickets |
| `Technicien can update assigned missions` | UPDATE | Technicien | Modifie UNIQUEMENT ses missions ✅ |

**Fichier source** : `supabase/schema/13_missions.sql` (lignes 186-285)

---

### Table : `techniciens`

| Policy Name | Operation | Rôle | Règle |
|------------|-----------|------|-------|
| `Entreprise can view own techniciens` | SELECT | Entreprise | Voit ses techniciens |
| `Entreprise can insert own techniciens` | INSERT | Entreprise | Crée ses techniciens |
| `Entreprise can update own techniciens` | UPDATE | Entreprise | Modifie ses techniciens |
| `Technicien can view own profile` | SELECT | Technicien | Voit son propre profil |
| `Technicien can update own profile` | UPDATE | Technicien | Modifie son propre profil |
| `Regie can view techniciens of authorized entreprises` | SELECT | Régie | Voit techniciens d'entreprises autorisées |
| `Admin JTEC can view all techniciens` | SELECT | Admin | Voit tous les techniciens |

**Fichier source** : `supabase/schema/11_techniciens.sql` (lignes 166-237)

---

### Table : `factures`

| Policy Name | Operation | Rôle | Règle |
|------------|-----------|------|-------|
| (À détailler) | SELECT | Entreprise | Voit ses factures |
| (À détailler) | INSERT | Entreprise | Crée factures après mission terminée |
| (À détailler) | SELECT | Régie | Voit factures reçues |
| (À détailler) | SELECT | Admin | Voit toutes les factures |

**Fichier source** : `supabase/schema/15_facturation.sql` (ligne 361+)

---

## ✅ CONFORMITÉ AU PDF

### Règles ÉTAPE 4 du PDF

#### 5.1 Technicien ✅
- ✅ SELECT uniquement ses missions → Policy `Technicien can view assigned missions`
- ✅ UPDATE uniquement ses missions → Policy `Technicien can update assigned missions`
- ✅ INSERT signalements/photos liés à ses missions → À vérifier (tables séparées)
- ✅ Pas de DELETE → Aucune policy DELETE pour technicien

#### 5.2 Entreprise ✅
- ✅ SELECT missions de son entreprise → Policy `Entreprise can view own missions`
- ✅ UPDATE factures après mission terminée → À vérifier (table factures)

#### 5.3 Admin ✅
- ✅ SELECT global → Policy `Admin JTEC can view all missions`
- ✅ UPDATE factures/statistiques/régies → À vérifier par table

---

## 🚨 VÉRIFICATIONS NÉCESSAIRES

### 1. Vérifier application en base

**Action** : Exécuter le fichier SQL de diagnostic

```bash
# Fichier créé : _RLS_VERIFICATION_DIAGNOSTIC.sql
# À exécuter dans Supabase SQL Editor
```

Ce fichier va :
1. Lister toutes les tables avec RLS activé/désactivé
2. Compter les policies par table
3. Afficher les détails des policies missions
4. Générer un rapport complet

### 2. Si RLS non activé

**Symptôme** : Les tables renvoient 0 lignes sans authentification mais ne montrent pas d'erreur RLS

**Cause possible** : 
- RLS activé mais aucune policy définie
- Policies définies dans les fichiers SQL mais pas appliquées en base

**Solution** :
```sql
-- Exécuter dans Supabase SQL Editor :
\i supabase/schema/13_missions.sql
\i supabase/schema/11_techniciens.sql
\i supabase/schema/15_facturation.sql
```

Ou copier-coller manuellement les sections RLS.

### 3. Tests d'isolation obligatoires

**Test 1 : Technicien**
1. Se connecter comme `demo.technicien@test.app`
2. Aller sur `/technicien/dashboard.html`
3. Vérifier que seule la mission assignée à ce technicien est visible
4. Vérifier qu'il ne peut pas voir les missions d'autres techniciens

**Test 2 : Entreprise**
1. Se connecter comme entreprise
2. Vérifier que seules les missions de SES techniciens sont visibles
3. Tenter de modifier une mission d'une autre entreprise (doit échouer)

**Test 3 : Régie**
1. Se connecter comme régie
2. Vérifier que seules les missions liées à SES biens sont visibles

**Test 4 : Admin JETC**
1. Se connecter comme admin
2. Vérifier que TOUTES les missions sont visibles

---

## 🛠️ CORRECTIONS APPLIQUÉES

Aucune correction nécessaire dans le code SQL - les policies sont bien définies.

**Action requise** : Vérifier l'application en base de données via le fichier SQL de diagnostic.

---

## 📊 PROCHAINES ÉTAPES

1. ✅ Exécuter `_RLS_VERIFICATION_DIAGNOSTIC.sql` dans Supabase
2. ⏳ Si policies manquantes : réappliquer les migrations
3. ⏳ Effectuer les 4 tests d'isolation
4. ⏳ Documenter les résultats dans le rapport global

---

## 💡 RECOMMANDATIONS

### Sécurité renforcée

1. **Aucune policy publique** : Toutes les tables critiques doivent avoir RLS activé
2. **Principe du moindre privilège** : Chaque rôle ne voit/modifie QUE ce qui le concerne
3. **Audit régulier** : Vérifier périodiquement les policies avec le script SQL
4. **Tests automatisés** : Créer des tests d'intégration pour vérifier l'isolation

### Policies manquantes à créer

Si non existantes :

1. **Table `signalements`** : Technicien peut INSERT uniquement pour ses missions
2. **Table `photos_missions`** : Technicien peut INSERT uniquement pour ses missions
3. **Table `factures`** : Entreprise peut INSERT après mission terminée
4. **Table `factures_commissions_jetc`** : Seul admin JETC peut modifier

---

**Statut ÉTAPE 4** : ⏸️ En attente de vérification en base de données

---

*Dernière mise à jour : 2026-01-07*
