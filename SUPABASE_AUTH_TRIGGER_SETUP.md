# Configuration Trigger Auth Supabase - Étape Manuelle Obligatoire

## 🚨 Contexte Technique

**Problème** : Supabase Cloud **interdit** la création de triggers sur la table `auth.users` via SQL Editor pour des raisons de sécurité et de permissions.

**Erreur rencontrée** lors de l'exécution SQL :
```
ERROR: 42501: must be owner of relation users
```

**Raison** : Le schéma `auth` est géré par Supabase et les droits `OWNER` ne sont pas accessibles aux utilisateurs, même avec un service_role.

**Solution** : Le trigger doit être créé **manuellement** via l'interface Supabase Dashboard.

---

## ⚙️ Configuration Requise

### Trigger à créer : `on_auth_user_created`

Ce trigger est **essentiel** au fonctionnement de JETC_IMMO :
- Il crée automatiquement un profil dans `public.profiles` pour chaque nouvel utilisateur
- Il initialise le rôle par défaut à `regie` (point d'entrée métier)
- Il garantit la cohérence entre `auth.users` et `profiles`

**Sans ce trigger, l'inscription utilisateur échouera.**

---

## 📋 Instructions Étape par Étape

### 1. Accéder au Supabase Dashboard

1. Connectez-vous à [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet JETC_IMMO_SaaS
3. Dans le menu latéral, naviguez vers **Database**

### 2. Créer le Trigger via l'Interface

#### Option A : Via Database Webhooks (Recommandé)

1. Dans le menu **Database**, cliquez sur **Database Webhooks**
2. Cliquez sur **Create a new hook**
3. Configurez les paramètres suivants :

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `on_auth_user_created` |
| **Table** | `auth.users` |
| **Events** | ☑️ Insert |
| **Type** | `postgres_function` |
| **Postgres Function** | `public.handle_new_user` |

4. Cliquez sur **Create webhook**

#### Option B : Via SQL Editor avec Supabase CLI

Si vous avez accès à Supabase CLI avec les droits appropriés :

```bash
supabase db remote commit
```

Puis créez le trigger via le migration file généré.

**Note** : Cette méthode nécessite un accès administrateur complet au projet Supabase.

---

## 🔍 Vérification de la Configuration

### Test 1 : Vérifier l'existence du trigger

Dans le **SQL Editor**, exécutez :

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
  AND event_object_schema = 'auth'
  AND event_object_table = 'users';
```

**Résultat attendu** : Une ligne avec :
- `trigger_name` : `on_auth_user_created`
- `event_manipulation` : `INSERT`
- `event_object_table` : `users`
- `action_statement` : `EXECUTE FUNCTION public.handle_new_user()`

### Test 2 : Vérifier la fonction

```sql
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';
```

**Résultat attendu** : Une fonction de type `FUNCTION` retournant `trigger`.

### Test 3 : Tester le workflow complet

1. Créez un compte test via votre interface d'inscription
2. Dans le **SQL Editor**, vérifiez que le profil a été créé :

```sql
SELECT 
  p.id,
  p.email,
  p.role,
  p.language,
  p.created_at
FROM public.profiles p
WHERE p.email = 'test@example.com';
```

**Résultat attendu** :
- Une ligne avec le profil correspondant
- `role` = `regie`
- `language` = `fr`
- `created_at` proche de l'heure de création du compte

---

## 🛠️ Dépannage

### Erreur : "function public.handle_new_user() does not exist"

**Cause** : Le fichier `04_users.sql` n'a pas été exécuté correctement.

**Solution** :
1. Vérifiez que les fichiers SQL ont été exécutés dans l'ordre :
   - `01_extensions.sql`
   - `02_enums.sql`
   - `04_users.sql`
2. Ré-exécutez `04_users.sql` dans le SQL Editor
3. Recréez le trigger via l'interface

### Erreur : "relation auth.users does not exist"

**Cause** : Problème de schéma ou de permissions.

**Solution** : Contactez le support Supabase, votre projet pourrait avoir un problème de configuration.

### Le profil n'est pas créé lors de l'inscription

**Diagnostic** :

1. Vérifiez que le trigger existe (Test 1)
2. Vérifiez les logs dans **Database** → **Database Logs**
3. Recherchez les erreurs contenant `handle_new_user`

**Solutions possibles** :
- Le trigger n'a pas été créé → Suivre les instructions ci-dessus
- Erreur dans la fonction → Vérifier les logs, corriger `04_users.sql`
- Problème RLS → Vérifier que `public.profiles` autorise les INSERT depuis la fonction

---

## 📌 Récapitulatif Technique

### SQL Équivalent (Non Exécutable dans Supabase Cloud)

```sql
-- ⚠️ CE CODE NE FONCTIONNE PAS dans Supabase SQL Editor
-- Il est fourni uniquement à titre de référence

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row 
  execute function public.handle_new_user();
```

### Fonction Appelée

La fonction `public.handle_new_user()` est définie dans `04_users.sql` :

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, language, is_demo)
  values (
    new.id,
    new.email,
    'regie',
    coalesce(new.raw_user_meta_data->>'language', 'fr'),
    false
  );
  return new;
end;
$$;
```

---

## ✅ Checklist Installation

- [ ] Fichiers SQL exécutés dans l'ordre (01, 02, 04)
- [ ] Fonction `public.handle_new_user()` créée avec succès
- [ ] Trigger `on_auth_user_created` créé via Supabase Dashboard
- [ ] Test 1 réussi (trigger existe dans information_schema)
- [ ] Test 2 réussi (fonction existe)
- [ ] Test 3 réussi (profil créé automatiquement à l'inscription)

---

## 📚 Références

- [Supabase Auth Schema](https://supabase.com/docs/guides/auth/auth-schema)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [PostgreSQL Triggers Documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)

---

**Date de création** : 2025-12-17  
**Dernière mise à jour** : 2025-12-17  
**Statut** : ✅ Configuration manuelle obligatoire documentée
