-- =====================================================
-- ÉTAPE 12 : Intervention & clôture
-- =====================================================
-- Objectif : Cycle de vie complet de la mission
-- Critères :
--   - Démarrage mission
--   - Gestion retards
--   - Rapport d'intervention
--   - Signatures
--   - Statuts cohérents
--   - Données complètes

-- =====================================================
-- 1. Ajout colonnes à missions
-- =====================================================

alter table missions
add column if not exists rapport_url text default null;

alter table missions
add column if not exists signature_locataire_url text default null;

alter table missions
add column if not exists signature_technicien_url text default null;

alter table missions
add column if not exists en_retard boolean generated always as (
  date_intervention_prevue is not null 
  and date_intervention_prevue < now()
  and date_intervention_realisee is null
  and statut in ('en_attente', 'en_cours')
) stored;

-- Commentaires
comment on column missions.rapport_url is 'URL du rapport d''intervention (Storage)';
comment on column missions.signature_locataire_url is 'URL de la signature du locataire (validation intervention)';
comment on column missions.signature_technicien_url is 'URL de la signature du technicien (validation intervention)';
comment on column missions.en_retard is 'Indicateur de retard (calculé automatiquement)';

-- =====================================================
-- 2. Fonction pour démarrer une mission
-- =====================================================

create or replace function start_mission(
  p_mission_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_statut text;
begin
  -- 1. Vérifier que la mission existe et récupérer son statut
  select statut into v_current_statut
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier que la mission est en_attente
  if v_current_statut != 'en_attente' then
    return jsonb_build_object(
      'success', false,
      'error', 'La mission doit être en_attente pour être démarrée (statut actuel: ' || v_current_statut || ')'
    );
  end if;
  
  -- 3. Démarrer la mission
  update missions
  set 
    statut = 'en_cours',
    started_at = now()
  where id = p_mission_id;
  
  return jsonb_build_object(
    'success', true
  );
end;
$$;

comment on function start_mission is 'Démarre une mission (transition en_attente → en_cours)';

-- =====================================================
-- 3. Fonction pour terminer une mission
-- =====================================================

create or replace function complete_mission(
  p_mission_id uuid,
  p_rapport_url text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_statut text;
  v_technicien_id uuid;
begin
  -- 1. Vérifier que la mission existe
  select statut, technicien_id 
  into v_current_statut, v_technicien_id
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier que la mission est en_cours
  if v_current_statut != 'en_cours' then
    return jsonb_build_object(
      'success', false,
      'error', 'La mission doit être en_cours pour être terminée (statut actuel: ' || v_current_statut || ')'
    );
  end if;
  
  -- 3. Vérifier qu'un technicien est assigné
  if v_technicien_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'La mission doit avoir un technicien assigné'
    );
  end if;
  
  -- 4. Terminer la mission
  update missions
  set 
    statut = 'terminee',
    completed_at = now(),
    date_intervention_realisee = now(),
    rapport_url = coalesce(p_rapport_url, rapport_url)
  where id = p_mission_id;
  
  return jsonb_build_object(
    'success', true
  );
end;
$$;

comment on function complete_mission is 'Termine une mission (transition en_cours → terminee)';

-- =====================================================
-- 4. Fonction pour valider une mission (régie)
-- =====================================================

create or replace function validate_mission(
  p_mission_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_statut text;
  v_signatures_complete boolean;
begin
  -- 1. Vérifier que la mission existe
  select 
    statut,
    (signature_locataire_url is not null and signature_technicien_url is not null)
  into v_current_statut, v_signatures_complete
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier que la mission est terminee
  if v_current_statut != 'terminee' then
    return jsonb_build_object(
      'success', false,
      'error', 'La mission doit être terminee pour être validée (statut actuel: ' || v_current_statut || ')'
    );
  end if;
  
  -- 3. Vérifier que les signatures sont présentes (optionnel mais recommandé)
  if not v_signatures_complete then
    return jsonb_build_object(
      'success', false,
      'error', 'Les signatures du locataire et du technicien sont requises',
      'warning', true
    );
  end if;
  
  -- 4. Valider la mission
  update missions
  set 
    statut = 'validee',
    validated_at = now()
  where id = p_mission_id;
  
  return jsonb_build_object(
    'success', true
  );
end;
$$;

comment on function validate_mission is 'Valide une mission (transition terminee → validee, par la régie)';

-- =====================================================
-- 5. Fonction pour annuler une mission
-- =====================================================

create or replace function cancel_mission(
  p_mission_id uuid,
  p_raison text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_statut text;
begin
  -- 1. Vérifier que la mission existe
  select statut into v_current_statut
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier que la mission n'est pas déjà validee
  if v_current_statut = 'validee' then
    return jsonb_build_object(
      'success', false,
      'error', 'Une mission validée ne peut pas être annulée'
    );
  end if;
  
  -- 3. Annuler la mission
  update missions
  set 
    statut = 'annulee',
    notes = coalesce(notes || E'\n\nRaison annulation: ' || p_raison, 'Raison: ' || p_raison)
  where id = p_mission_id;
  
  -- 4. Déverrouiller le ticket (pour permettre une nouvelle mission)
  update tickets
  set locked_at = null
  where id = (select ticket_id from missions where id = p_mission_id);
  
  return jsonb_build_object(
    'success', true
  );
end;
$$;

comment on function cancel_mission is 'Annule une mission et déverrouille le ticket';

-- =====================================================
-- 6. Vue pour missions en retard
-- =====================================================

create or replace view missions_en_retard as
select
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.created_at as mission_created_at,
  extract(epoch from (now() - m.date_intervention_prevue))/3600 as heures_retard,
  
  -- Technicien
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  t.telephone as technicien_telephone,
  
  -- Ticket
  tk.titre as ticket_titre,
  tk.priorite as ticket_priorite,
  tk.categorie as ticket_categorie,
  
  -- Entreprise
  e.nom as entreprise_nom,
  
  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.ville as immeuble_ville,
  
  -- Locataire
  loc.nom as locataire_nom,
  loc.telephone as locataire_telephone,
  
  -- Régie
  r.nom as regie_nom
  
from missions m
left join techniciens t on m.technicien_id = t.id
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies r on imm.regie_id = r.id
where m.en_retard = true
order by m.date_intervention_prevue asc;

comment on view missions_en_retard is 'Vue pour lister les missions en retard avec nombre d''heures de retard';

-- =====================================================
-- 7. Vue pour statistiques missions
-- =====================================================

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
  
  -- Retards
  count(*) filter (where m.en_retard = true) as missions_en_retard,
  
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
  ) as taux_signature_pct

from entreprises e
left join missions m on e.id = m.entreprise_id
group by e.id, e.nom
order by missions_total desc;

comment on view missions_stats is 'Statistiques des missions par entreprise';

-- =====================================================
-- 8. Index supplémentaires pour performance
-- =====================================================

create index if not exists idx_missions_en_retard on missions(en_retard) where en_retard = true;
create index if not exists idx_missions_completed_at on missions(completed_at);
create index if not exists idx_missions_validated_at on missions(validated_at);

-- =====================================================
-- 9. Trigger pour notifier changement statut
-- =====================================================

create or replace function notify_mission_status_change()
returns trigger
language plpgsql
as $$
begin
  -- Log simple du changement (pour audit)
  if old.statut is distinct from new.statut then
    raise notice 'Mission % : statut changé de % à %', new.id, old.statut, new.statut;
  end if;
  
  return new;
end;
$$;

create trigger mission_status_change
after update on missions
for each row
when (old.statut is distinct from new.statut)
execute function notify_mission_status_change();

comment on function notify_mission_status_change is 'Notifie les changements de statut des missions';
