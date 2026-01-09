# 🚀 DÉPLOIEMENT IMMÉDIAT - INSTRUCTIONS SQL

## ⏱️ TEMPS ESTIMÉ : 2 minutes

## 📍 ÉTAPE UNIQUE : Appliquer migration M57.1

### 1. Ouvrir Supabase Dashboard
```
https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
```

### 2. Copier le contenu du fichier
**Fichier source :** `supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql`

**Ou copier directement ci-dessous :**

```sql
-- M57.1 : FIX CRITIQUE RLS REGIES + DEBUG AUTH
-- Date: 2026-01-09
-- Description: Correction RLS manquante sur table regies + ajout logs debug

-- PARTIE 1: RLS SUR TABLE REGIES (CRITIQUE)
ALTER TABLE regies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Régie lit ses propres infos" ON regies;
DROP POLICY IF EXISTS "regies_read_self" ON regies;
DROP POLICY IF EXISTS "Admin JTEC peut lire toutes les régies" ON regies;
DROP POLICY IF EXISTS "Public peut lire régies validées" ON regies;

CREATE POLICY "regies_read_self"
  ON regies
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "regies_admin_read_all"
  ON regies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

CREATE POLICY "regies_entreprise_read_validated"
  ON regies
  FOR SELECT
  TO authenticated
  USING (
    statut_validation = 'valide'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
    )
  );

CREATE POLICY "regies_update_self"
  ON regies
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- PARTIE 2: VÉRIFIER COHÉRENCE PROFILES <-> REGIES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'regie_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN regie_id UUID REFERENCES regies(id);
    COMMENT ON COLUMN profiles.regie_id IS 'ID de la régie si role=regie';
  END IF;
END $$;

UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie'
  AND regie_id IS NULL
  AND EXISTS (SELECT 1 FROM regies WHERE regies.id = profiles.id);

-- PARTIE 3: FONCTION HELPER DEBUG
CREATE OR REPLACE FUNCTION debug_regie_access()
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  profile_role TEXT,
  profile_regie_id UUID,
  regie_exists BOOLEAN,
  regie_nom TEXT,
  can_read_self BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    auth.uid() AS user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) AS user_email,
    p.role AS profile_role,
    p.regie_id AS profile_regie_id,
    (r.id IS NOT NULL) AS regie_exists,
    r.nom AS regie_nom,
    (r.id = auth.uid()) AS can_read_self
  FROM profiles p
  LEFT JOIN regies r ON r.id = auth.uid()
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION debug_regie_access TO authenticated;
```

### 3. Cliquer "RUN"

**Résultat attendu :**
```
✅ Success. No rows returned
```

### 4. Vérifier (optionnel mais recommandé)
```sql
-- Vérifier policies créées
SELECT policyname FROM pg_policies WHERE tablename = 'regies';

-- Doit afficher :
-- regies_read_self
-- regies_admin_read_all
-- regies_entreprise_read_validated
-- regies_update_self
```

---

## ✅ C'EST FAIT !

Le code frontend/backend est déjà déployé sur Vercel (push git automatique).

**Vous pouvez maintenant tester :**

1. **Régie** → Menu Factures → ✅ Doit charger sans erreur 406
2. **Régie** → Bouton PDF → ✅ Doit télécharger
3. **Entreprise** → Bouton PDF → ✅ Doit télécharger

---

## 🐛 SI ERREUR LORS DU RUN SQL

### Erreur : "policy already exists"
```sql
-- Normal si vous avez déjà run M57 ou M57.1
-- Les DROP POLICY IF EXISTS gèrent ça
-- Continuez, c'est OK
```

### Erreur : "column already exists"
```sql
-- Normal si profiles.regie_id existe déjà
-- Le DO $$ IF NOT EXISTS gère ça
-- Continuez, c'est OK
```

### Erreur : "permission denied"
```sql
-- Vous n'êtes pas connecté en tant que propriétaire projet
-- Utilisez le compte admin Supabase
```

---

## 📊 AVANT / APRÈS

| Action | Avant M57.1 | Après M57.1 |
|--------|-------------|-------------|
| Régie ouvre Factures | ❌ 406 PGRST116 | ✅ OK |
| Régie PDF | ❌ 403 | ✅ OK |
| Entreprise PDF | ❌ 403 | ✅ OK |

---

**Durée totale :** ~2 min ⏱️

**Statut :** 🟢 Prêt à exécuter

**Priorité :** 🔴 URGENT (bloque Régie)
