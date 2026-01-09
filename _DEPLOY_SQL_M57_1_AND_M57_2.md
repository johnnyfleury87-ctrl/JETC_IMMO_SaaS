# 🚀 DÉPLOIEMENT SQL - M57.1 + M57.2 (2 MIGRATIONS)

## ⏱️ TEMPS ESTIMÉ : 3 minutes

## 📋 ORDRE D'EXÉCUTION CRITIQUE

### ✅ Migration 1 : M57.1 - RLS REGIES
### ✅ Migration 2 : M57.2 - RLS FACTURES OWNERSHIP

**⚠️ NE PAS INVERSER L'ORDRE**

---

## 🔧 MIGRATION 1 : M57.1 - RLS REGIES

### Ouvrir Supabase SQL Editor
```
https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
```

### Copier-coller ce SQL :

```sql
-- M57.1 : FIX CRITIQUE RLS REGIES + DEBUG AUTH

ALTER TABLE regies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Régie lit ses propres infos" ON regies;
DROP POLICY IF EXISTS "regies_read_self" ON regies;
DROP POLICY IF EXISTS "Admin JTEC peut lire toutes les régies" ON regies;
DROP POLICY IF EXISTS "Public peut lire régies validées" ON regies;

CREATE POLICY "regies_read_self"
  ON regies FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "regies_admin_read_all"
  ON regies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

CREATE POLICY "regies_entreprise_read_validated"
  ON regies FOR SELECT TO authenticated
  USING (
    statut_validation = 'valide'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
    )
  );

CREATE POLICY "regies_update_self"
  ON regies FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
LANGUAGE sql SECURITY DEFINER
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

### Cliquer "RUN"

**✅ Résultat attendu :** `Success. No rows returned`

---

## 🔧 MIGRATION 2 : M57.2 - RLS FACTURES OWNERSHIP

### MÊME fenêtre SQL Editor (ou nouvelle)

### Copier-coller ce SQL :

```sql
-- M57.2 : FIX CRITIQUE RLS FACTURES - OWNERSHIP VIA PROFILES

DROP POLICY IF EXISTS "Entreprise voit ses factures" ON factures;
DROP POLICY IF EXISTS "Entreprise édite factures brouillon" ON factures;
DROP POLICY IF EXISTS "Entreprise insère ses factures" ON factures;
DROP POLICY IF EXISTS "Régie voit factures envoyées" ON factures;
DROP POLICY IF EXISTS "Régie traite factures" ON factures;

CREATE POLICY "factures_entreprise_select"
  ON factures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

CREATE POLICY "factures_entreprise_update"
  ON factures FOR UPDATE TO authenticated
  USING (
    statut = 'brouillon'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

CREATE POLICY "factures_entreprise_insert"
  ON factures FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

CREATE POLICY "factures_regie_select"
  ON factures FOR SELECT TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.regie_id = factures.regie_id
    )
  );

CREATE POLICY "factures_regie_update"
  ON factures FOR UPDATE TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.regie_id = factures.regie_id
    )
  );

CREATE POLICY "factures_admin_all"
  ON factures FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facture_lignes_select" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_insert" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_update" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_delete" ON facture_lignes;

CREATE POLICY "facture_lignes_select"
  ON facture_lignes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.entreprise_id = factures.entreprise_id
        )
        OR
        (
          factures.statut IN ('envoyee', 'payee', 'refusee')
          AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.regie_id = factures.regie_id
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin_jtec'
        )
      )
    )
  );

CREATE POLICY "facture_lignes_insert"
  ON facture_lignes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

CREATE POLICY "facture_lignes_update"
  ON facture_lignes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

CREATE POLICY "facture_lignes_delete"
  ON facture_lignes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

UPDATE profiles
SET entreprise_id = profiles.id
WHERE role = 'entreprise'
  AND entreprise_id IS NULL
  AND EXISTS (SELECT 1 FROM entreprises WHERE entreprises.id = profiles.id);

UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie'
  AND regie_id IS NULL
  AND EXISTS (SELECT 1 FROM regies WHERE regies.id = profiles.id);

CREATE OR REPLACE FUNCTION debug_facture_ownership(p_facture_id UUID)
RETURNS TABLE(
  facture_id UUID,
  facture_entreprise_id UUID,
  facture_regie_id UUID,
  user_id UUID,
  user_role TEXT,
  user_entreprise_id UUID,
  user_regie_id UUID,
  can_read BOOLEAN,
  can_update BOOLEAN
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    f.id AS facture_id,
    f.entreprise_id AS facture_entreprise_id,
    f.regie_id AS facture_regie_id,
    auth.uid() AS user_id,
    p.role AS user_role,
    p.entreprise_id AS user_entreprise_id,
    p.regie_id AS user_regie_id,
    (
      (p.entreprise_id = f.entreprise_id)
      OR
      (p.regie_id = f.regie_id AND f.statut IN ('envoyee', 'payee', 'refusee'))
      OR
      (p.role = 'admin_jtec')
    ) AS can_read,
    (
      (p.entreprise_id = f.entreprise_id AND f.statut = 'brouillon')
      OR
      (p.regie_id = f.regie_id AND f.statut IN ('envoyee', 'payee', 'refusee'))
      OR
      (p.role = 'admin_jtec')
    ) AS can_update
  FROM factures f
  CROSS JOIN profiles p
  WHERE f.id = p_facture_id
    AND p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION debug_facture_ownership TO authenticated;
```

### Cliquer "RUN"

**✅ Résultat attendu :** `Success. No rows returned`

---

## ✅ VÉRIFICATION (OPTIONNEL)

### Vérifier policies créées
```sql
-- Policies regies
SELECT policyname FROM pg_policies WHERE tablename = 'regies';
-- Attendu: regies_read_self, regies_admin_read_all, etc.

-- Policies factures
SELECT policyname FROM pg_policies WHERE tablename = 'factures';
-- Attendu: factures_entreprise_select, factures_regie_select, etc.
```

### Tester accès Régie
```sql
SELECT * FROM debug_regie_access();
-- can_read_self doit être true
```

### Tester ownership facture
```sql
-- Remplacer UUID par une vraie facture
SELECT * FROM debug_facture_ownership('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
-- can_read doit être true si propriétaire
```

---

## 🎉 C'EST FAIT !

**Vous pouvez maintenant tester :**

1. **Régie** → Menu Factures → ✅ Liste affichée
2. **Régie** → Bouton PDF → ✅ Téléchargement OK
3. **Entreprise** → Onglet Factures → ✅ Liste affichée
4. **Entreprise** → Bouton PDF → ✅ Téléchargement OK

---

## 🐛 SI ERREUR

### "policy already exists"
Normal, les DROP IF EXISTS gèrent ça. Continuez.

### "column already exists"
Normal, le DO $$ IF NOT EXISTS gère ça. Continuez.

### "permission denied"
Utilisez le compte admin Supabase.

### Factures toujours vides après migration
```sql
-- Vérifier synchronisation profiles
SELECT id, role, entreprise_id, regie_id FROM profiles;

-- Si NULL, forcer sync :
UPDATE profiles SET entreprise_id = id WHERE role = 'entreprise';
UPDATE profiles SET regie_id = id WHERE role = 'regie';
```

---

**Durée totale :** ~3 min ⏱️

**Statut :** 🔴 CRITIQUE - Exécuter maintenant

**Impact :** 🔥 BLOQUANT (Entreprise et Régie ne peuvent pas utiliser factures sans ces migrations)
