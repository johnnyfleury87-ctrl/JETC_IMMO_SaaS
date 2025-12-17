/**
 * VUES MÉTIER
 * 
 * Regroupement de toutes les vues dépendant de plusieurs tables
 * À exécuter APRÈS la création de toutes les tables (01-15)
 * 
 * Ordre d'exécution : 17
 * 
 * RÈGLES :
 * - Toutes les tables nécessaires doivent exister (tickets, missions, entreprises, etc.)
 * - Les vues facilitent les requêtes métier complexes
 * - Elles peuvent être recréées sans impact sur les données
 */

-- ============================================================
-- VUE : Tickets complets
-- ============================================================
-- Vue enrichie des tickets avec toutes les informations contextuelles
-- Utilisée par : API tickets, interfaces locataire/régie

create or replace view tickets_complets as
select 
  t.*,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.email as locataire_email,
  log.numero as logement_numero,
  log.etage as logement_etage,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id;

comment on view tickets_complets is 'JETC_IMMO - Vue enrichie des tickets avec toutes les informations liées';

-- ============================================================
-- VUE : Tickets visibles par entreprise
-- ============================================================
-- Détermine quels tickets chaque entreprise peut voir selon ses autorisations
-- Mode général : tous les tickets ouverts de la régie
-- Mode restreint : seulement les tickets assignés à cette entreprise

create or replace view tickets_visibles_entreprise as
select 
  t.*,
  re.entreprise_id,
  re.mode_diffusion,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join regies_entreprises re on t.regie_id = re.regie_id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id
where 
  -- Mode général : tous les tickets ouverts de la régie
  (re.mode_diffusion = 'general' and t.statut = 'ouvert')
  or
  -- Mode restreint : seulement les tickets assignés à cette entreprise
  (re.mode_diffusion = 'restreint' and t.entreprise_id = re.entreprise_id);

comment on view tickets_visibles_entreprise is 'JETC_IMMO - Tickets visibles par chaque entreprise selon les autorisations';

-- ============================================================
-- VUE : Planning technicien
-- ============================================================
-- Affiche le planning de chaque technicien avec toutes les informations
-- de la mission, du ticket, du logement et du locataire

create or replace view planning_technicien as
select
  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.date_intervention_realisee,
  m.notes,
  
  -- Technicien
  t.id as technicien_id,
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  
  -- Ticket
  tk.id as ticket_id,
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,
  
  -- Entreprise
  e.nom as entreprise_nom,
  
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
left join techniciens t on m.technicien_id = t.id
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is not null;

comment on view planning_technicien is 'JETC_IMMO - Planning des techniciens avec toutes les informations nécessaires';

-- ============================================================
-- VUE : Missions non assignées (dispatch)
-- ============================================================
-- Liste les missions en attente d'assignation à un technicien
-- Utilisée par : Interface dispatch entreprise

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
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  
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
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is null
and m.statut in ('en_attente', 'en_cours');

comment on view missions_non_assignees is 'JETC_IMMO - Missions en attente d affectation à un technicien (dispatch)';
