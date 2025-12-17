/**
 * EXTENSIONS POSTGRESQL
 * 
 * Extensions nécessaires pour le projet JETC_IMMO
 * 
 * Ordre d'exécution : 1
 */

-- Extension pour générer des UUID v4
create extension if not exists "uuid-ossp";

-- Extension pour les fonctions de cryptographie
create extension if not exists "pgcrypto";

-- Confirmation
comment on extension "uuid-ossp" is 'JETC_IMMO - Génération UUID';
comment on extension "pgcrypto" is 'JETC_IMMO - Cryptographie';
