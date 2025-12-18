-- =====================================================
-- ÉTAPE 22B : RÉSOLUTION DÉPENDANCES DDL (VIEWS/RULES)
-- =====================================================
-- Correction CRITIQUE : ALTER TYPE impossible tant que vues dépendantes existent
-- PostgreSQL ERROR: cannot alter type of a column used by a view or rule
-- =====================================================
-- MÉTHODOLOGIE :
-- 1. DROP temporaire des vues dépendant de missions.statut
-- 2. ALTER missions.statut TEXT → mission_status ENUM
-- 3. RECRÉATION STRICTEMENT IDENTIQUE des vues
-- =====================================================

-- =====================================================
-- 1. DROP TRIGGERS DÉPENDANT DE missions.statut
-- =====================================================
-- Tous les triggers sur missions doivent être DROP avant ALTER TYPE
-- car PostgreSQL bloque si ANY trigger/rule dépend de la colonne

drop trigger if exists missions_updated_at on missions;
drop trigger if exists mission_status_change on missions;
drop trigger if exists mission_status_change_notification on missions;
drop trigger if exists technicien_assignment_notification on missions;

comment on schema public is 'Triggers temporairement supprimés pour ALTER TYPE';

-- =====================================================
-- 2. DROP VUES DÉPENDANT DE missions.statut
-- =====================================================

drop view if exists missions_details cascade;
drop view if exists missions_non_assignees cascade;
drop view if exists missions_avec_status cascade;
drop view if exists missions_en_retard cascade;
drop view if exists missions_stats cascade;
drop view if exists planning_technicien cascade;

comment on schema public is 'Vues temporairement supprimées pour ALTER TYPE';

-- =====================================================
-- 3. CONVERSION missions.statut TEXT → mission_status ENUM
-- =====================================================

alter table missions
  alter column statut drop default;

alter table missions
  alter column statut type mission_status
  using (
    case statut::text
      when 'planifiee' then 'en_attente'::mission_status
      when 'en_attente' then 'en_attente'::mission_status
      when 'en_cours' then 'en_cours'::mission_status
      when 'terminee' then 'terminee'::mission_status
      when 'validee' then 'validee'::mission_status
      when 'annulee' then 'annulee'::mission_status
      else 'en_attente'::mission_status
    end
  );

alter table missions
  alter column statut set default 'en_attente';

comment on column missions.statut is
'État officiel de la mission (exécution terrain) - ENUM mission_status';

-- =====================================================
-- 4. RECRÉATION VUES (STRICTEMENT IDENTIQUES)
-- =====================================================

-- Vue 1 : missions_non_assignees (17_views.sql)
create or replace view missions_non_assignees as
select
  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.created_at as mission_created_at,

  -- Ticket
  tk.id as ticket_id,
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,

  -- Entreprise
  ent.id as entreprise_id,
  ent.nom as entreprise_nom,

  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.ville as immeuble_ville,

  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone

from missions m
join tickets tk on m.ticket_id = tk.id
join entreprises ent on m.entreprise_id = ent.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where
  m.technicien_id is null
  and m.statut in ('en_attente', 'en_cours');

comment on view missions_non_assignees is
'JETC_IMMO - Missions en attente d'affectation à un technicien';

-- Vue 2 : missions_avec_status (14_intervention.sql)
create or replace view missions_avec_status as
select
  m.*,
  (
    m.date_intervention_prevue is not null 
    and m.date_intervention_prevue < now()
    and m.date_intervention_realisee is null
    and m.statut in ('en_attente', 'en_cours')
  ) as en_retard,
  case
    when m.date_intervention_prevue is not null 
         and m.date_intervention_prevue < now()
         and m.date_intervention_realisee is null
         and m.statut in ('en_attente', 'en_cours')
    then extract(epoch from (now() - m.date_intervention_prevue))/3600
    else 0
  end as heures_retard
from missions m;

comment on view missions_avec_status is 'Missions avec calcul dynamique du retard (temps réel)';

-- Vue 3 : missions_en_retard (14_intervention.sql)
create or replace view missions_en_retard as
select
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.created_at as mission_created_at,
  extract(epoch from (now() - m.date_intervention_prevue))/3600 as heures_retard,
  
  t.id as ticket_id,
  t.titre as ticket_titre,
  t.priorite as ticket_priorite,
  
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  
  tech.id as technicien_id,
  tech.nom as technicien_nom,
  tech.prenom as technicien_prenom,
  
  r.id as regie_id,
  r.nom as regie_nom
  
from missions m
join tickets t on m.ticket_id = t.id
join entreprises e on m.entreprise_id = e.id
left join techniciens tech on m.technicien_id = tech.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies r on imm.regie_id = r.id
where
  m.date_intervention_prevue is not null 
  and m.date_intervention_prevue < now()
  and m.date_intervention_realisee is null
  and m.statut in ('en_attente', 'en_cours')
order by m.date_intervention_prevue asc;

comment on view missions_en_retard is 'Missions dont la date prévue est dépassée (alertes)';

-- Vue 4 : missions_stats (14_intervention.sql)
create or replace view missions_stats as
select
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  
  -- Compteurs par statut
  count(*) filter (where m.statut = 'en_attente') as missions_en_attente,
  count(*) filter (where m.statut = 'en_cours') as missions_en_cours,
  count(*) filter (where m.statut = 'terminee') as missions_terminees,
  count(*) filter (where m.statut = 'validee') as missions_validees,
  count(*) filter (where m.statut = 'annulee') as missions_annulees,
  count(*) as missions_total,
  
  -- Retards (calcul dynamique)
  count(*) filter (
    where m.date_intervention_prevue is not null 
      and m.date_intervention_prevue < now()
      and m.date_intervention_realisee is null
      and m.statut in ('en_attente', 'en_cours')
  ) as missions_en_retard,
  
  -- Délais moyens (en heures)
  avg(extract(epoch from (m.started_at - m.created_at))/3600) 
    filter (where m.started_at is not null) as delai_moyen_demarrage_heures,
  avg(extract(epoch from (m.completed_at - m.started_at))/3600) 
    filter (where m.completed_at is not null) as duree_moyenne_intervention_heures,
  avg(extract(epoch from (m.validated_at - m.completed_at))/3600) 
    filter (where m.validated_at is not null) as delai_moyen_validation_heures,
  
  -- Taux de signatures
  count(*) filter (where m.signature_technicien_url is not null and m.signature_locataire_url is not null) as missions_signees,
  round(
    100.0 * count(*) filter (where m.signature_technicien_url is not null and m.signature_locataire_url is not null) / 
    nullif(count(*) filter (where m.statut in ('terminee', 'validee')), 0),
    2
  ) as taux_signature

from entreprises e
left join missions m on e.id = m.entreprise_id
group by e.id, e.nom
order by missions_total desc;

comment on view missions_stats is 'Statistiques agrégées des missions par entreprise (KPI opérationnels)';

-- Vue 5 : planning_technicien (17_views.sql)
create or replace view planning_technicien as
select
  -- Technicien
  tech.id as technicien_id,
  tech.nom as technicien_nom,
  tech.prenom as technicien_prenom,
  tech.telephone as technicien_telephone,

  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.date_intervention_realisee,
  m.created_at as mission_created_at,

  -- Ticket
  tk.id as ticket_id,
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,

  -- Entreprise
  ent.id as entreprise_id,
  ent.nom as entreprise_nom,

  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.ville as immeuble_ville,

  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone

from techniciens tech
join missions m on tech.id = m.technicien_id
join tickets tk on m.ticket_id = tk.id
join entreprises ent on m.entreprise_id = ent.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where
  m.statut in ('en_attente', 'en_cours')
order by
  tech.id,
  m.date_intervention_prevue asc nulls last;

comment on view planning_technicien is
'JETC_IMMO - Planning des missions par technicien';

-- Vue 6 : missions_details (13_missions.sql)
create or replace view missions_details as
select
  m.id as mission_id,
  m.ticket_id,
  m.entreprise_id,
  m.statut as mission_statut,
  m.created_at as mission_created_at,
  m.started_at,
  m.completed_at,
  m.validated_at,
  m.notes,
  m.devis_url,
  m.facture_url,
  m.montant,
  
  -- Informations ticket
  t.titre as ticket_titre,
  t.description as ticket_description,
  t.categorie as ticket_categorie,
  t.priorite as ticket_priorite,
  t.statut as ticket_statut,
  t.locked_at as ticket_locked_at,
  
  -- Informations entreprise
  e.nom as entreprise_nom,
  e.siret as entreprise_siret,
  
  -- Informations locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  
  -- Informations logement
  log.numero as logement_numero,
  
  -- Informations immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  
  -- Informations régie
  r.nom as regie_nom
  
from missions m
join tickets t on m.ticket_id = t.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies r on imm.regie_id = r.id;

comment on view missions_details is 'Vue complète des missions avec toutes les informations associées';

-- =====================================================
-- 5. RECRÉATION TRIGGERS (STRICTEMENT IDENTIQUES)
-- =====================================================

-- Trigger 1 : missions_updated_at (13_missions.sql)
create trigger missions_updated_at
before update on missions
for each row
execute function update_missions_updated_at();

-- Trigger 2 : mission_status_change (14_intervention.sql)
create trigger mission_status_change
after update on missions
for each row
when (old.statut is distinct from new.statut)
execute function notify_mission_status_change();

comment on function notify_mission_status_change is 'Notifie les changements de statut des missions';

-- Trigger 3 : mission_status_change_notification (16_messagerie.sql)
create trigger mission_status_change_notification
  after update on missions
  for each row
  execute function notify_mission_status_change_extended();

-- Trigger 4 : technicien_assignment_notification (16_messagerie.sql)
create trigger technicien_assignment_notification
  after update on missions
  for each row
  execute function notify_technicien_assignment();

-- =====================================================
-- FIN DU FICHIER
-- =====================================================
