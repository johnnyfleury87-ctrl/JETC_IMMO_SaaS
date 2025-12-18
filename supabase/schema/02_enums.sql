/**
 * TYPES ENUM
 * 
 * Définition de tous les types énumérés utilisés dans JETC_IMMO
 * 
 * Ordre d'exécution : 2
 * 
 * ⚠️ Ces types sont utilisés dans TOUTES les tables
 * Ne pas modifier sans mise à jour complète
 */

-- Rôles utilisateurs
create type user_role as enum (
  'locataire',
  'regie',
  'entreprise',
  'technicien',
  'proprietaire',
  'admin_jtec'
);

comment on type user_role is 'JETC_IMMO - Rôles utilisateurs (source de vérité unique)';

-- Types de plans d'abonnement
create type plan_type as enum (
  'essentiel',
  'pro',
  'premium'
);

comment on type plan_type is 'JETC_IMMO - Plans d''abonnement avec limites associées';

-- Statuts des tickets (COMPLET - toutes les valeurs nécessaires)
create type ticket_status as enum (
  'nouveau',       -- Ticket créé par locataire
  'ouvert',        -- Ticket validé par régie
  'en_attente',    -- En attente d'assignation
  'en_cours',      -- Mission en cours
  'termine',       -- Intervention terminée
  'clos',          -- Ticket clôturé et validé
  'annule'         -- Ticket annulé
);

comment on type ticket_status is 'JETC_IMMO - Cycle de vie complet d''un ticket (locataire → régie → entreprise → clôture)';

-- Statuts des missions (COMPLET - toutes les valeurs nécessaires)
create type mission_status as enum (
  'en_attente',    -- Mission créée, en attente
  'en_cours',      -- Mission en cours d'exécution
  'terminee',      -- Mission terminée par l'entreprise
  'validee',       -- Mission validée par la régie
  'annulee'        -- Mission annulée
);

comment on type mission_status is 'JETC_IMMO - Cycle de vie complet d''une mission (exécution opérationnelle)';
