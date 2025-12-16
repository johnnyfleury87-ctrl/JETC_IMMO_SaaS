/**
 * ÉTAPE 9 - Administration JTEC
 * 
 * Pilotage global de la plateforme :
 * - Vues SQL agrégées (sans données nominatives)
 * - Statistiques globales (régies, immeubles, logements, tickets)
 * - Accès strictement contrôlé (admin_jtec uniquement)
 * 
 * Principe RGPD : pas de données nominatives dans les vues admin
 */

-- =====================================================
-- 1. VUE STATS GLOBALES - RÉGIES
-- =====================================================

create or replace view admin_stats_regies as
select
  count(*) as total_regies,
  count(*) filter (where created_at >= current_date - interval '30 days') as regies_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as regies_7_jours,
  count(*) filter (where created_at >= current_date) as regies_aujourd_hui
from regies;

comment on view admin_stats_regies is 'Statistiques globales sur les régies (admin_jtec)';

-- =====================================================
-- 2. VUE STATS GLOBALES - IMMEUBLES
-- =====================================================

create or replace view admin_stats_immeubles as
select
  count(*) as total_immeubles,
  count(*) filter (where created_at >= current_date - interval '30 days') as immeubles_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as immeubles_7_jours,
  count(distinct regie_id) as regies_avec_immeubles,
  round(avg((select count(*) from immeubles i2 where i2.regie_id = i.regie_id)), 2) as moyenne_par_regie
from immeubles i;

comment on view admin_stats_immeubles is 'Statistiques globales sur les immeubles (admin_jtec)';

-- =====================================================
-- 3. VUE STATS GLOBALES - LOGEMENTS
-- =====================================================

create or replace view admin_stats_logements as
select
  count(*) as total_logements,
  count(*) filter (where created_at >= current_date - interval '30 days') as logements_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as logements_7_jours,
  count(distinct immeuble_id) as immeubles_avec_logements,
  round(avg((select count(*) from logements l2 where l2.immeuble_id = l.immeuble_id)), 2) as moyenne_par_immeuble
from logements l;

comment on view admin_stats_logements is 'Statistiques globales sur les logements (admin_jtec)';

-- =====================================================
-- 4. VUE STATS GLOBALES - LOCATAIRES
-- =====================================================

create or replace view admin_stats_locataires as
select
  count(*) as total_locataires,
  count(*) filter (where created_at >= current_date - interval '30 days') as locataires_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as locataires_7_jours,
  count(distinct logement_id) as logements_occupes
from locataires;

comment on view admin_stats_locataires is 'Statistiques globales sur les locataires (admin_jtec)';

-- =====================================================
-- 5. VUE STATS GLOBALES - TICKETS
-- =====================================================

create or replace view admin_stats_tickets as
select
  count(*) as total_tickets,
  count(*) filter (where created_at >= current_date - interval '30 days') as tickets_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as tickets_7_jours,
  count(*) filter (where created_at >= current_date) as tickets_aujourd_hui,
  count(*) filter (where statut = 'ouvert') as tickets_ouverts,
  count(*) filter (where statut = 'en_cours') as tickets_en_cours,
  count(*) filter (where statut = 'termine') as tickets_termines,
  count(*) filter (where statut = 'annule') as tickets_annules,
  count(*) filter (where priorite = 'haute') as tickets_priorite_haute,
  count(*) filter (where priorite = 'moyenne') as tickets_priorite_moyenne,
  count(*) filter (where priorite = 'basse') as tickets_priorite_basse,
  count(distinct regie_id) as regies_avec_tickets,
  round(avg(extract(epoch from (coalesce(updated_at, created_at) - created_at)) / 3600), 2) as duree_moyenne_heures
from tickets;

comment on view admin_stats_tickets is 'Statistiques globales sur les tickets (admin_jtec)';

-- =====================================================
-- 6. VUE STATS GLOBALES - ENTREPRISES
-- =====================================================

create or replace view admin_stats_entreprises as
select
  count(*) as total_entreprises,
  count(*) filter (where created_at >= current_date - interval '30 days') as entreprises_30_jours,
  count(*) filter (where created_at >= current_date - interval '7 days') as entreprises_7_jours,
  count(distinct re.regie_id) as regies_avec_entreprises,
  count(distinct re.entreprise_id) as entreprises_autorisees
from entreprises e
left join regies_entreprises re on re.entreprise_id = e.id;

comment on view admin_stats_entreprises is 'Statistiques globales sur les entreprises (admin_jtec)';

-- =====================================================
-- 7. VUE STATS PAR CATÉGORIE DE TICKETS
-- =====================================================

create or replace view admin_stats_tickets_categories as
select
  categorie,
  count(*) as total,
  count(*) filter (where statut = 'ouvert') as ouverts,
  count(*) filter (where statut = 'en_cours') as en_cours,
  count(*) filter (where statut = 'termine') as termines
from tickets
group by categorie
order by total desc;

comment on view admin_stats_tickets_categories is 'Répartition des tickets par catégorie (admin_jtec)';

-- =====================================================
-- 8. VUE STATS PAR PRIORITÉ DE TICKETS
-- =====================================================

create or replace view admin_stats_tickets_priorites as
select
  priorite,
  count(*) as total,
  count(*) filter (where statut = 'ouvert') as ouverts,
  count(*) filter (where statut = 'en_cours') as en_cours,
  count(*) filter (where statut = 'termine') as termines
from tickets
group by priorite
order by 
  case 
    when priorite = 'haute' then 1
    when priorite = 'moyenne' then 2
    when priorite = 'basse' then 3
  end;

comment on view admin_stats_tickets_priorites is 'Répartition des tickets par priorité (admin_jtec)';

-- =====================================================
-- 9. VUE STATS TEMPORELLES - ÉVOLUTION
-- =====================================================

create or replace view admin_stats_evolution as
select
  date_trunc('day', created_at) as jour,
  'regies' as type,
  count(*) as nombre
from regies
where created_at >= current_date - interval '30 days'
group by date_trunc('day', created_at)

union all

select
  date_trunc('day', created_at) as jour,
  'immeubles' as type,
  count(*) as nombre
from immeubles
where created_at >= current_date - interval '30 days'
group by date_trunc('day', created_at)

union all

select
  date_trunc('day', created_at) as jour,
  'logements' as type,
  count(*) as nombre
from logements
where created_at >= current_date - interval '30 days'
group by date_trunc('day', created_at)

union all

select
  date_trunc('day', created_at) as jour,
  'tickets' as type,
  count(*) as nombre
from tickets
where created_at >= current_date - interval '30 days'
group by date_trunc('day', created_at)

order by jour desc, type;

comment on view admin_stats_evolution is 'Évolution des créations sur 30 jours (admin_jtec)';

-- =====================================================
-- 10. POLICY RLS SUR LES VUES (admin_jtec uniquement)
-- =====================================================

-- Note: Les vues héritent des RLS des tables sous-jacentes
-- Mais on peut ajouter des policies explicites si besoin

-- Fonction helper pour vérifier si l'utilisateur est admin_jtec
create or replace function is_admin_jtec()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin_jtec'
  );
$$;

comment on function is_admin_jtec is 'Vérifie si l''utilisateur connecté est admin_jtec';

-- =====================================================
-- 11. VUE CONSOLIDÉE - DASHBOARD ADMIN
-- =====================================================

create or replace view admin_dashboard as
select
  (select total_regies from admin_stats_regies) as total_regies,
  (select regies_30_jours from admin_stats_regies) as regies_30_jours,
  (select total_immeubles from admin_stats_immeubles) as total_immeubles,
  (select immeubles_30_jours from admin_stats_immeubles) as immeubles_30_jours,
  (select total_logements from admin_stats_logements) as total_logements,
  (select logements_30_jours from admin_stats_logements) as logements_30_jours,
  (select total_locataires from admin_stats_locataires) as total_locataires,
  (select locataires_30_jours from admin_stats_locataires) as locataires_30_jours,
  (select total_tickets from admin_stats_tickets) as total_tickets,
  (select tickets_30_jours from admin_stats_tickets) as tickets_30_jours,
  (select tickets_ouverts from admin_stats_tickets) as tickets_ouverts,
  (select tickets_en_cours from admin_stats_tickets) as tickets_en_cours,
  (select tickets_termines from admin_stats_tickets) as tickets_termines,
  (select total_entreprises from admin_stats_entreprises) as total_entreprises,
  (select entreprises_30_jours from admin_stats_entreprises) as entreprises_30_jours;

comment on view admin_dashboard is 'Vue consolidée pour le dashboard admin (admin_jtec)';

-- =====================================================
-- 12. INDEX POUR PERFORMANCE DES VUES
-- =====================================================

-- Index sur les dates de création pour les filtres temporels
create index if not exists idx_regies_created_at on regies(created_at);
create index if not exists idx_immeubles_created_at on immeubles(created_at);
create index if not exists idx_logements_created_at on logements(created_at);
create index if not exists idx_locataires_created_at on locataires(created_at);
create index if not exists idx_tickets_created_at on tickets(created_at);
create index if not exists idx_entreprises_created_at on entreprises(created_at);

-- Index sur les statuts et priorités pour les filtres
create index if not exists idx_tickets_statut on tickets(statut);
create index if not exists idx_tickets_priorite on tickets(priorite);
create index if not exists idx_tickets_categorie on tickets(categorie);
