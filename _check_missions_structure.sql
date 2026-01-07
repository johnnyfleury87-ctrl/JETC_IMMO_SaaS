-- VÉRIFIER LA STRUCTURE ET LES FK DE LA TABLE MISSIONS

-- 1. Structure de la table missions
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'missions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Toutes les FK de la table missions
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'missions'
  AND tc.constraint_type = 'FOREIGN KEY';
