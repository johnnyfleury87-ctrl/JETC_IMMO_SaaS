/**
 * VUES MÉTIER
 * 
 * Regroupement de toutes les vues dépendant de plusieurs tables
 * À exécuter APRÈS la création de toutes les tables (01-15)
 * 
 * Ordre d'exécution : 17
 * 
 * RÈGLES :
 * - Pas de SELECT *
 * - Noms de colonnes explicites et uniques
 * - Aucune logique de modification de données
 */

-- ============================================================
-- VUE : Tickets complets
-- ============================================================

create or replace view tickets_complets as
select
  -- Ticket
  t.id as ticket_id,
  t.titre,
  t.description,
  t.categorie,
  t.priorite,
  t.statut,
  t.created_at,
  t.updated_at,
  t.locataire_id,
  t.logement_id,
  t.regie_id,
  t.entreprise_id,

  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.email as locataire_email,
  loc.telephone as locataire_telephone,

  -- Logement
  log.numero as logement_numero,
  log.etage as logement_etage,

  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.code_postal as immeuble_code_postal,
  imm.ville as immeuble_ville,

  -- Régie
  reg.nom as regie_nom

from tickets t
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id;

comment on view tickets_complets is
'JETC_IMMO - Vue enrichie des tickets avec locataire, logement, immeuble et régie';

-- ============================================================
-- VUE : Tickets visibles par entreprise
-- ============================================================

create or replace view tickets_visibles_entreprise as
select
  -- Ticket
  t.id as ticket_id,
  t.titre,
  t.description,
  t.categorie,
  t.priorite,
  t.statut,
  t.created_at,
  t.updated_at,
  t.locataire_id,
  t.logement_id,
  t.regie_id,
  t.entreprise_id,

  -- Autorisation entreprise
  re.mode_diffusion,

  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,

  -- Logement
  log.numero as logement_numero,

  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,

  -- Régie
  reg.nom as regie_nom

from tickets t
join regies_entreprises re on t.regie_id = re.regie_id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id
where
  (
    re.mode_diffusion = 'general'
    and t.statut = 'ouvert'
  )
  or
  (
    re.mode_diffusion = 'restreint'
    and t.entreprise_id = re.entreprise_id
  );

comment on view tickets_visibles_entreprise is
'JETC_IMMO - Tickets visibles par entreprise selon les règles de diffusion';

-- ============================================================
-- VUE : Planning technicien
-- ============================================================

create or replace view planning_technicien as
select
  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.date_intervention_realisee,
  m.notes,
  m.created_at,
  m.updated_at,

  -- Technicien
  tech.id as technicien_id,
  tech.nom as technicien_nom,
  tech.prenom as technicien_prenom,

  -- Ticket
  tk.id as ticket_id,
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,

  -- Entreprise
  ent.id as entreprise_id,
  ent.nom as entreprise_nom,

  -- Logement
  log.numero as logement_numero,

  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.code_postal as immeuble_code_postal,
  imm.ville as immeuble_ville,

  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone

from missions m
left join techniciens tech on m.technicien_id = tech.id
join tickets tk on m.ticket_id = tk.id
join entreprises ent on m.entreprise_id = ent.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is not null;

comment on view planning_technicien is
'JETC_IMMO - Planning détaillé des techniciens';

-- ============================================================
-- VUE : Missions non assignées (dispatch)
-- ============================================================

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
'JETC_IMMO - Missions en attente d’affectation à un technicien';
