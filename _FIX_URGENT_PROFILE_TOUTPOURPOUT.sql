-- FIX URGENT: Corriger entreprise_id du profile toutpourtout
-- Date: 2026-01-09
-- Problème: profiles.entreprise_id pointe vers lui-même au lieu de entreprises.id

-- Corriger le profile pour pointer vers la vraie entreprise
UPDATE profiles
SET entreprise_id = '898b4b8b-e7aa-4bd4-9390-b489519c7f19'
WHERE email = 'toutpourtout@test.app';

-- Vérification
SELECT 
  p.id AS profile_id,
  p.email,
  p.entreprise_id,
  e.nom AS entreprise_nom
FROM profiles p
LEFT JOIN entreprises e ON e.id = p.entreprise_id
WHERE p.email = 'toutpourtout@test.app';

-- ✅ Après ce fix, la policy RLS fonctionnera:
-- EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.entreprise_id = factures.entreprise_id)
-- 
-- Profile 91126ecf... (auth.uid)
--   → profiles.entreprise_id = 898b4b8b...
--   → factures.entreprise_id = 898b4b8b...
--   → MATCH! ✅
