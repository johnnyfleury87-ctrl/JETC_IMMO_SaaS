/**
 * Migration M23 : Correction schema fonction notify_new_ticket
 * 
 * ERREUR: M22 corrigeait la fonction mais le schéma 16_messagerie.sql contenait
 * toujours l'ancienne version avec NEW.numero
 * 
 * CORRECTION: Mettre à jour supabase/schema/16_messagerie.sql
 */

-- Cette migration est documentaire uniquement
-- La fonction a déjà été corrigée dans M22
-- Ce fichier sert à tracer la correction du schéma source

SELECT 'Migration M23: Schéma 16_messagerie.sql corrigé manuellement' AS status;
