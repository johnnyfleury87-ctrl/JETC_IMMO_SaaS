# AUDIT RÉFÉRENCES SCHÉMA AUTH - JETC_IMMO_SaaS

## 📊 RÉSUMÉ EXÉCUTIF

**Erreur détectée** : `ERROR: 42P01: relation "auth_users" does not exist`

**Cause** : Références à une table inexistante `auth_users` au lieu du schéma Supabase correct `auth.users`

**Fichiers impactés** : 3 fichiers (15, 16, 21)
**Occurrences totales** : 26 références invalides

---

## 🔍 INVENTAIRE COMPLET

### ✅ **Références VALIDES** (à conserver)

| Fichier | Lignes | Référence | Usage | Statut |
|---------|--------|-----------|-------|--------|
| 04_users.sql | 13, 22 | `auth.users` | FK sur profiles.id | ✅ CORRECT |
| 09b_helper_functions.sql | 41, 50 | `auth.uid()` | RLS | ✅ CORRECT |
| 11_techniciens.sql | 20, 87, 175, 186, 197, 206, 214, 236 | `auth.users`, `auth.uid()` | FK + RLS | ✅ CORRECT |
| 13_missions.sql | 209, 222, 233, 258, 270, 281 | `auth.uid()` | RLS | ✅ CORRECT |
| 16_messagerie.sql | 25, 51 | `auth.users` | FK | ✅ CORRECT |
| 16_messagerie.sql | 469, 480 | `auth.uid()` | RLS | ✅ CORRECT |
| 18_rls.sql | Toutes | `auth.uid()` | RLS | ✅ CORRECT |
| 19_storage.sql | Toutes | `auth.uid()` | RLS | ✅ CORRECT |

---

### ❌ **Références INVALIDES** (à corriger)

#### **15_facturation.sql** - 12 occurrences

| Ligne | Référence actuelle | Correction requise | Contexte |
|-------|-------------------|-------------------|----------|
| 369 | `auth_users.entreprise_id` | `profiles` | RLS SELECT entreprise |
| 370 | `auth_users.role` | `profiles` | RLS SELECT entreprise |
| 379 | `auth_users.regie_id` | `profiles` | RLS SELECT régie |
| 380 | `auth_users.role` | `profiles` | RLS SELECT régie |
| 389 | `auth_users.role` | `profiles` | RLS SELECT admin_jtec |
| 398 | `auth_users.entreprise_id` | `profiles` | RLS INSERT entreprise |
| 399 | `auth_users.role` | `profiles` | RLS INSERT entreprise |
| 409 | `auth_users.entreprise_id` | `profiles` | RLS UPDATE entreprise |
| 410 | `auth_users.role` | `profiles` | RLS UPDATE entreprise |
| 414 | `auth_users.regie_id` | `profiles` | RLS UPDATE régie |
| 415 | `auth_users.role` | `profiles` | RLS UPDATE régie |
| 418 | `auth_users.role` | `profiles` | RLS UPDATE admin_jtec |

**Analyse** : 
- Table `auth_users` n'existe pas
- Les données (role, entreprise_id, regie_id) sont dans `profiles`
- Toutes les politiques RLS doivent utiliser `profiles` avec `WHERE id = auth.uid()`

---

#### **16_messagerie.sql** - 5 occurrences

| Ligne | Référence actuelle | Correction requise | Contexte |
|-------|-------------------|-------------------|----------|
| 105 | `JOIN auth_users au ON ...` | `JOIN profiles au ON ...` | Fonction get_mission_actors |
| 148 | `v_sender auth_users;` | `v_sender profiles;` | Variable dans send_message |
| 158 | `FROM auth_users WHERE user_id = ...` | `FROM profiles WHERE id = ...` | SELECT sender |
| 295 | `FROM auth_users WHERE role = 'admin_jtec'` | `FROM profiles WHERE role = 'admin_jtec'` | Système message |
| 427 | `FROM auth_users WHERE regie_id = ... OR locataire_id = ...` | `FROM profiles WHERE regie_id = ... OR locataire_id = ...` | Notifications |

**Analyse** :
- Fonction `get_mission_actors()` doit JOIN sur `profiles`
- Variable `v_sender` doit être de type `profiles`
- Tous les SELECT doivent cibler `profiles`
- **ATTENTION** : Les colonnes dans profiles sont différentes
  - `user_id` n'existe pas → utiliser `id`
  - `role`, `regie_id`, `locataire_id`, `entreprise_id` existent dans profiles ✅

---

#### **21_abonnements.sql** - 9 occurrences

| Ligne | Référence actuelle | Correction requise | Contexte |
|-------|-------------------|-------------------|----------|
| 346 | `FROM public.auth_users WHERE entreprise_id` | `FROM profiles WHERE entreprise_id` | Quota utilisateurs |
| 350 | `FROM public.auth_users WHERE regie_id` | `FROM profiles WHERE regie_id` | Quota utilisateurs |
| 565 | `FROM public.auth_users WHERE entreprise_id` | `FROM profiles WHERE entreprise_id` | Vue quotas_usage |
| 566 | `FROM public.auth_users WHERE regie_id` | `FROM profiles WHERE regie_id` | Vue quotas_usage |
| 659 | `FROM public.auth_users WHERE id = auth.uid()` | `FROM profiles WHERE id = auth.uid()` | RLS plans admin |
| 670 | `FROM public.auth_users WHERE id = auth.uid()` | `FROM profiles WHERE id = auth.uid()` | RLS abonnements admin |
| 680 | `FROM public.auth_users WHERE id = auth.uid() AND entreprise_id` | `FROM profiles WHERE id = auth.uid() AND entreprise_id` | RLS abonnements entreprise |
| 690 | `FROM public.auth_users WHERE id = auth.uid() AND regie_id` | `FROM profiles WHERE id = auth.uid() AND regie_id` | RLS abonnements régie |
| 700 | `FROM public.auth_users WHERE id = auth.uid()` | `FROM profiles WHERE id = auth.uid()` | RLS abonnements admin |

**Analyse** :
- Toutes les références à `public.auth_users` doivent devenir `profiles`
- Les RLS utilisent déjà `auth.uid()` ✅
- Les colonnes (`entreprise_id`, `regie_id`, `role`) existent dans profiles ✅

---

## 🛠️ CORRECTIONS REQUISES

### **1. Fichier : 15_facturation.sql**

**Stratégie** : Remplacer toutes les références `auth_users` par `profiles`

```sql
-- AVANT (ligne 369-370)
entreprise_id = (select entreprise_id from auth_users where user_id = auth.uid())
and (select role from auth_users where user_id = auth.uid()) = 'entreprise'

-- APRÈS
entreprise_id = (select entreprise_id from profiles where id = auth.uid())
and (select role from profiles where id = auth.uid()) = 'entreprise'
```

**Occurrences** : 12 lignes à corriger (369, 370, 379, 380, 389, 398, 399, 409, 410, 414, 415, 418)

**Changements** :
- `auth_users` → `profiles`
- `user_id = auth.uid()` → `id = auth.uid()`

---

### **2. Fichier : 16_messagerie.sql**

#### **A. Ligne 105 - JOIN dans fonction**
```sql
-- AVANT
join auth_users au on (
  au.entreprise_id = m.entreprise_id
  or ...
)

-- APRÈS
join profiles au on (
  au.entreprise_id = m.entreprise_id
  or ...
)
```

#### **B. Lignes 148, 158 - Type et SELECT**
```sql
-- AVANT
v_sender auth_users;
select * into v_sender from auth_users where user_id = p_sender_user_id;

-- APRÈS
v_sender profiles;
select * into v_sender from profiles where id = p_sender_user_id;
```

#### **C. Ligne 295 - Message système**
```sql
-- AVANT
(select user_id from auth_users where role = 'admin_jtec' limit 1)

-- APRÈS
(select id from profiles where role = 'admin_jtec' limit 1)
```

#### **D. Ligne 427 - Notifications**
```sql
-- AVANT
select user_id from auth_users 
where regie_id = NEW.regie_id or locataire_id = NEW.locataire_id

-- APRÈS
select id from profiles 
where regie_id = NEW.regie_id or locataire_id = NEW.locataire_id
```

**Occurrences** : 5 lignes (105, 148, 158, 295, 427)

**Changements** :
- `auth_users` → `profiles`
- `user_id` → `id`
- Type de variable : `auth_users` → `profiles`

---

### **3. Fichier : 21_abonnements.sql**

**Stratégie** : Remplacer toutes les références `public.auth_users` par `profiles`

```sql
-- AVANT (ligne 346)
FROM public.auth_users
WHERE entreprise_id = p_entreprise_id

-- APRÈS
FROM profiles
WHERE entreprise_id = p_entreprise_id
```

**Occurrences** : 9 lignes (346, 350, 565, 566, 659, 670, 680, 690, 700)

**Changements** :
- `public.auth_users` → `profiles`
- Pas de changement de colonnes (entreprise_id, regie_id, role existent)

---

## 📋 VALIDATION FINALE

### Checklist après corrections :

- [ ] 15_facturation.sql : 0 occurrence `auth_users` (actuellement 12)
- [ ] 16_messagerie.sql : 0 occurrence `auth_users` (actuellement 5)
- [ ] 21_abonnements.sql : 0 occurrence `auth_users` (actuellement 9)
- [ ] Test : `grep -r "auth_users" *.sql` → aucun résultat
- [ ] Toutes les références `auth.uid()` conservées ✅
- [ ] Toutes les FK vers `auth.users` conservées ✅
- [ ] Migrations 01→23 exécutables sans erreur schéma auth

### Références valides après correction :

1. **FK vers auth.users** : profiles(id), techniciens(profile_id), messages(sender_user_id), notifications(user_id) ✅
2. **Fonction auth.uid()** : Utilisée dans toutes les politiques RLS ✅
3. **Table profiles** : Contient role, entreprise_id, regie_id, locataire_id ✅

---

## 🎯 RÉSUMÉ ACTIONS

| Fichier | Occurrences | Type erreur | Action |
|---------|-------------|-------------|--------|
| **15_facturation.sql** | 12 | `auth_users` au lieu de `profiles` | Remplacer + changer `user_id` → `id` |
| **16_messagerie.sql** | 5 | `auth_users` au lieu de `profiles` | Remplacer + changer type variable + `user_id` → `id` |
| **21_abonnements.sql** | 9 | `public.auth_users` au lieu de `profiles` | Remplacer seulement nom table |
| **TOTAL** | **26** | Références invalides | **3 fichiers à corriger** |

---

## ✅ ARCHITECTURE CORRECTE SUPABASE

```
┌─────────────────────────────────────────┐
│ Schéma: auth (géré par Supabase)       │
├─────────────────────────────────────────┤
│ • auth.users (table système)            │
│   - id: uuid (PK)                       │
│   - email: text                         │
│   - ...                                 │
│                                         │
│ • auth.uid() (fonction système)         │
│   - Retourne: uuid de l'utilisateur    │
└─────────────────────────────────────────┘
              ↓ FK
┌─────────────────────────────────────────┐
│ Schéma: public (notre application)     │
├─────────────────────────────────────────┤
│ • profiles                              │
│   - id: uuid FK → auth.users(id)       │
│   - role: text (admin_jtec, regie...)  │
│   - entreprise_id: uuid                 │
│   - regie_id: uuid                      │
│   - locataire_id: uuid                  │
│   - email: text                         │
│   - nom: text                           │
│   - ...                                 │
│                                         │
│ ❌ auth_users N'EXISTE PAS              │
└─────────────────────────────────────────┘
```

### Usage correct :

```sql
-- ✅ CORRECT - FK vers auth.users
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id)
);

-- ✅ CORRECT - RLS avec auth.uid()
CREATE POLICY ma_policy ON ma_table
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_jtec'
  )
);

-- ❌ INCORRECT - auth_users n'existe pas
SELECT * FROM auth_users;

-- ❌ INCORRECT - user_id n'existe pas dans profiles
SELECT * FROM profiles WHERE user_id = auth.uid();
```

---

**Date audit** : 2025-12-17
**Fichiers analysés** : 23 (01_extensions.sql → 23_trigger_prevent_escalation.sql)
**Références totales** : 150+ occurrences de "auth"
**Références invalides** : 26 occurrences dans 3 fichiers
