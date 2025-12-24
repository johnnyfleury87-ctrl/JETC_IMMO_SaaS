# ⚡ QUICK START - Migrations Logements & Immeubles

**⏱️ 2 minutes chrono**

---

## 🎯 Commandes rapides

### 1. Backup (si données existantes)
```sql
CREATE TABLE logements_backup_20251224 AS SELECT * FROM logements;
CREATE TABLE immeubles_backup_20251224 AS SELECT * FROM immeubles;
```

### 2. Migration 1 - LOGEMENTS
📁 Copier-coller : `supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql`  
✅ Exécuter dans Supabase SQL Editor

### 3. Migration 2 - IMMEUBLES
📁 Copier-coller : `supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql`  
✅ Exécuter dans Supabase SQL Editor

### 4. Validation
```sql
-- Logements : 10 nouvelles colonnes
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'logements' 
AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                    'annee_construction', 'annee_renovation', 'type_chauffage', 
                    'description', 'proprietaire_id');
-- Résultat attendu : 10

-- Immeubles : npa existe, code_postal n'existe plus
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'immeubles' 
AND column_name IN ('code_postal', 'npa');
-- Résultat attendu : 1 ligne (npa)

-- Migration logs
SELECT COUNT(*) FROM migration_logs WHERE migration_name LIKE '20251224%';
-- Résultat attendu : 2
```

---

## ⚠️ RÈGLES CRITIQUES

1. **ORDRE** : LOGEMENTS → IMMEUBLES (obligatoire)
2. **NE PAS INVERSER** : code_postal sera renommé
3. **BACKUP** : Si données production existantes

---

## 🧪 Test rapide

```javascript
// /regie/immeubles.html
// ✅ Cocher "Créer les logements maintenant"
// Nombre : 5
// NPA : 1000 (4 chiffres)
// → Doit créer 1 immeuble + 5 logements
```

---

## 📚 Documentation complète

- [VALIDATION_FINALE_MIGRATIONS.md](./VALIDATION_FINALE_MIGRATIONS.md) - Synthèse
- [GUIDE_EXECUTION_MIGRATIONS_LOGEMENTS_IMMEUBLES.md](./GUIDE_EXECUTION_MIGRATIONS_LOGEMENTS_IMMEUBLES.md) - Pas à pas
- [AUDIT_PRE_MIGRATION_LOGEMENTS_IMMEUBLES.md](./AUDIT_PRE_MIGRATION_LOGEMENTS_IMMEUBLES.md) - Analyse technique
- [VALIDATION_POST_MIGRATION.sql](../supabase/migrations/VALIDATION_POST_MIGRATION.sql) - Requêtes SQL

---

**✅ C'EST TOUT !**
