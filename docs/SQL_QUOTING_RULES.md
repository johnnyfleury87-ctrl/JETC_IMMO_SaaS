# Règles SQL - PostgreSQL Quoting et Bonnes Pratiques

**Date** : 2025-12-17  
**Contexte** : Migrations Supabase JETC_IMMO_SaaS

---

## 🚨 Problème Rencontré

### Erreur lors de l'exécution de `05_regies.sql`

```
ERROR: 42601: syntax error at or near "agence"
Ligne 47: comment on column regies.nom is 'Nom de l\'agence immobilière';
```

### Cause

PostgreSQL **n'accepte pas `\'` pour échapper les apostrophes** dans les chaînes SQL délimitées par des apostrophes simples.

---

## ✅ Règles SQL PostgreSQL

### 1. Échappement des Apostrophes

#### ❌ INCORRECT (syntaxe invalide)
```sql
comment on column regies.nom is 'Nom de l\'agence immobilière';
```

#### ✅ CORRECT - Option 1 : Double apostrophe
```sql
comment on column regies.nom is 'Nom de l''agence immobilière';
```

#### ✅ CORRECT - Option 2 : Dollar-quoting (recommandé)
```sql
comment on column regies.nom is $$Nom de l'agence immobilière$$;
```

### 2. Dollar-Quoting (`$$...$$`)

Le **dollar-quoting** est la méthode recommandée car :
- ✅ Pas besoin d'échapper les apostrophes
- ✅ Lisibilité maximale
- ✅ Évite les erreurs de syntaxe
- ✅ Supporte les caractères spéciaux

#### Syntaxe de base
```sql
-- Simple
comment on table users is $$Table des utilisateurs$$;

-- Avec apostrophes
comment on column users.name is $$Nom de l'utilisateur$$;

-- Avec guillemets
comment on column users.bio is $$Description avec "citations" et d'apostrophes$$;

-- Avec tags personnalisés (si $ dans le contenu)
comment on column prices.amount is $prix$Prix en $ (dollars)$prix$;
```

### 3. Autres Règles Importantes

#### Identifiants avec espaces ou caractères spéciaux
```sql
-- ❌ INCORRECT
create table user roles (...);

-- ✅ CORRECT
create table "user roles" (...);
-- Ou mieux : utiliser snake_case
create table user_roles (...);
```

#### Commentaires SQL
```sql
-- Commentaire sur une ligne
comment on table users is 'Description';

/* 
 * Commentaire
 * multi-lignes
 */
```

#### Chaînes multi-lignes
```sql
-- Avec dollar-quoting
comment on function calculate_price() is $$
  Calcule le prix d'un produit.
  
  Prend en compte :
  - Les taxes
  - Les remises
  - La TVA
$$;
```

---

## 📋 Corrections Appliquées

### Fichiers Modifiés

| Fichier | Lignes | Occurrences |
|---------|--------|-------------|
| `05_regies.sql` | 47, 49, 50, 51, 54 | 6 |
| `06_immeubles.sql` | 41, 43 | 2 |
| `08_locataires.sql` | 47 | 1 |
| `09_tickets.sql` | 48, 112 | 2 |
| `10_entreprises.sql` | 42, 43, 44, 81 | 4 |

**Total** : 5 fichiers, 16 occurrences corrigées

### Exemple de Correction

#### Avant (❌ erreur de syntaxe)
```sql
comment on column regies.nom is 'Nom de l\'agence immobilière';
comment on column regies.nb_collaborateurs is 'Nombre de collaborateurs dans l\'agence';
comment on column regies.admin_validateur_id is 'ID de l\'admin JTEC';
```

#### Après (✅ syntaxe correcte)
```sql
comment on column regies.nom is $$Nom de l'agence immobilière$$;
comment on column regies.nb_collaborateurs is $$Nombre de collaborateurs dans l'agence$$;
comment on column regies.admin_validateur_id is $$ID de l'admin JTEC$$;
```

---

## 🔍 Impact de l'Erreur

### Comportement PostgreSQL

Lorsqu'une **erreur de parsing** survient :

1. ✅ **Transaction annulée** : Aucune commande n'est exécutée
2. ✅ **État propre** : Aucune table/index/contrainte créée partiellement
3. ✅ **Pas de pollution** : Pas de risque "already exists" au re-run
4. ✅ **Rollback automatique** : PostgreSQL nettoie automatiquement

### Preuve

```sql
-- Fichier avec erreur de syntaxe
CREATE TABLE test (id INT);
COMMENT ON TABLE test IS 'Test d\'erreur'; -- ❌ ERREUR ICI
CREATE INDEX idx_test ON test(id);

-- Résultat :
-- ERROR: syntax error at or near "erreur"
-- 
-- Vérification :
SELECT * FROM test; -- ❌ ERROR: relation "test" does not exist
-- La table n'a jamais été créée
```

---

## 📚 Checklist de Migration SQL

Avant d'exécuter un fichier `.sql` dans Supabase SQL Editor :

### ✅ Vérifications Syntaxe

- [ ] **Apostrophes** : Utiliser `$$...$$` pour tous les COMMENT
- [ ] **Points-virgules** : Vérifier `;` à la fin de chaque instruction
- [ ] **Identifiants** : Pas d'espaces sans guillemets (`"..."`)
- [ ] **Mots-clés réservés** : Éviter `user`, `order`, `group` sans guillemets
- [ ] **Encodage** : UTF-8 pour les caractères accentués
- [ ] **Trailing spaces** : Pas d'espaces en fin de ligne avant `;`

### ✅ Vérifications Structure

- [ ] **Ordre des commandes** : CREATE avant ALTER/COMMENT
- [ ] **Dépendances** : Tables référencées existent
- [ ] **Types** : ENUM créés avant utilisation
- [ ] **Extensions** : `uuid_generate_v4()` nécessite `uuid-ossp`
- [ ] **Fonctions** : Déclarées avant triggers

### ✅ Vérifications Supabase

- [ ] **Pas de triggers sur `auth.*`** : Interdit dans Supabase Cloud
- [ ] **Pas de `CREATE SCHEMA`** : Schemas gérés par Supabase
- [ ] **RLS policies** : Utiliser `auth.uid()` et non `current_user`
- [ ] **Service role** : Vérifier permissions `SERVICE_ROLE_KEY`

---

## 🛠️ Outils de Validation

### Script de Validation SQL

```bash
#!/bin/bash
# validate-sql.sh

echo "🔍 Validation syntaxe SQL..."

# Vérifier les apostrophes échappées incorrectement
if grep -r "\\\\'" supabase/schema/*.sql; then
  echo "❌ ERREUR : Apostrophes échappées avec \\\' trouvées"
  echo "➡️  Utiliser \$\$...\$\$ à la place"
  exit 1
fi

# Vérifier les commentaires avec apostrophes
grep -r "comment on" supabase/schema/*.sql | grep -v '\$\$' | grep "'" | while read -r line; do
  if echo "$line" | grep -q "\\'"; then
    echo "⚠️  Apostrophe potentiellement problématique : $line"
  fi
done

echo "✅ Validation terminée"
```

### Utilisation

```bash
chmod +x validate-sql.sh
./validate-sql.sh
```

---

## 📖 Ressources

- [PostgreSQL String Constants](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS)
- [Dollar-Quoted String Constants](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-DOLLAR-QUOTING)
- [Supabase SQL Editor Best Practices](https://supabase.com/docs/guides/database/tables)

---

## 🔧 Commandes de Dépannage

### Vérifier les tables créées
```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

### Vérifier les commentaires existants
```sql
SELECT 
  c.table_name,
  c.column_name,
  pgd.description
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns c ON (
  pgd.objsubid = c.ordinal_position 
  AND c.table_schema = st.schemaname 
  AND c.table_name = st.relname
)
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.column_name;
```

### Nettoyer en cas d'erreur partielle (rare)
```sql
-- Lister les objets créés
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Supprimer si nécessaire
DROP TABLE IF EXISTS nom_table CASCADE;
```

---

## ✅ Résumé des Bonnes Pratiques

| Élément | ❌ À Éviter | ✅ Recommandé |
|---------|------------|---------------|
| **Apostrophes** | `'l\'agence'` | `$$l'agence$$` |
| **Guillemets** | `table name` | `"table name"` ou `table_name` |
| **Commentaires** | `/* nested /* comment */ */` | `-- Commentaire` |
| **Identifiants** | MAJUSCULES | snake_case |
| **Chaînes longues** | Échappement complexe | `$$...$$` |
| **Encodage** | ISO-8859-1 | UTF-8 |

---

**Auteur** : GitHub Copilot  
**Date** : 2025-12-17  
**Statut** : ✅ Appliqué au projet
