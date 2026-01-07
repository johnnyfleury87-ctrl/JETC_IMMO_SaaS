-- FIX: RÉASSIGNER LA MISSION À UN TECHNICIEN EXISTANT
-- Date: 7 janvier 2026

-- Vérifier les techniciens disponibles
SELECT id, email, role
FROM profiles
WHERE role = 'technicien';

-- Résultat attendu:
-- e5dc1c44-96b0-49fd-b18e-1b8f539df1a5 | tech@test.app
-- f4ca9426-73f9-4efa-850c-c660b5f86875 | jean@test.app

-- Réassigner la mission orpheline à tech@test.app
UPDATE missions
SET technicien_id = 'e5dc1c44-96b0-49fd-b18e-1b8f539df1a5'
WHERE id = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';

-- Vérifier le résultat
SELECT 
  m.id,
  m.technicien_id,
  p.email as technicien_email,
  m.statut,
  t.categorie,
  t.sous_categorie
FROM missions m
LEFT JOIN profiles p ON p.id = m.technicien_id
LEFT JOIN tickets t ON t.id = m.ticket_id
WHERE m.id = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';

-- Résultat attendu:
-- mission assignée à tech@test.app
-- categorie: plomberie
-- sous_categorie: Fuite d'eau
