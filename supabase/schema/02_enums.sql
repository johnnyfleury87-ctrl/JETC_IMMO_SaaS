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

-- Statuts des tickets
create type ticket_status as enum (
  'ouvert',
  'en_cours',
  'termine',
  'annule'
);

comment on type ticket_status is 'JETC_IMMO - Cycle de vie d''un ticket d''intervention';

-- Statuts des missions
create type mission_status as enum (
  'en_attente',
  'planifiee',
  'en_cours',
  'terminee'
);

comment on type mission_status is 'JETC_IMMO - Cycle de vie d''une mission technique';
