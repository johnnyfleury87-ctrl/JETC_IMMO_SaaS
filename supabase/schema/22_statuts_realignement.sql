-- =====================================================
-- ÉTAPE 20 : RÉALIGNEMENT OFFICIEL DES STATUTS
-- =====================================================
-- Date : 2025-12-16
-- Ordre d'exécution : 22
-- Objectif : Centraliser la logique métier des statuts
-- Source de vérité : Ce fichier définit LA logique officielle
--
-- RÈGLE ABSOLUE : Aucune transition de statut ne doit être
-- possible sans passer par les fonctions définies ici.
--
-- Ordre d'exécution : 20 (après toutes les tables)
-- =====================================================

-- =====================================================
-- 1. MISE À JOUR DES ENUMS (nouvelle logique métier)
-- =====================================================

-- Supprimer les anciens types (si nécessaire)
drop type if exists ticket_status cascade;
drop type if exists mission_status cascade;

-- TICKET_STATUS : cycle de vie d'un ticket (vue locataire/régie)
create type ticket_status as enum (
  'nouveau',      -- Ticket créé par le locataire, reçu par la régie
  'en_attente',   -- Régie a diffusé le ticket aux entreprises
  'en_cours',     -- Une entreprise a accepté le ticket
  'termine',      -- L'entreprise a terminé l'intervention
  'clos',         -- Régie a validé la fin du ticket
  'annule'        -- Ticket annulé
);

comment on type ticket_status is 'JETC_IMMO - Cycle de vie officiel d''un ticket (source métier principale, visible par le locataire)';

-- MISSION_STATUS : cycle de vie d'une mission (exécution opérationnelle)
create type mission_status as enum (
  'en_attente',   -- Mission créée après acceptation du ticket
  'en_cours',     -- Intervention démarrée
  'terminee',     -- Travaux terminés
  'validee',      -- Régie valide la mission
  'annulee'       -- Mission annulée
);

comment on type mission_status is 'JETC_IMMO - Cycle de vie officiel d''une mission (exécution opérationnelle)';

-- =====================================================
-- 2. MISE À JOUR TABLE TICKETS (ajout colonne si manquante)
-- =====================================================

-- Modifier la colonne statut pour utiliser le nouveau type
alter table tickets 
  alter column statut type ticket_status using 
    case statut::text
      when 'ouvert' then 'nouveau'::ticket_status
      when 'en_cours' then 'en_cours'::ticket_status
      when 'termine' then 'termine'::ticket_status
      when 'annule' then 'annule'::ticket_status
      else 'nouveau'::ticket_status
    end;

-- Valeur par défaut
alter table tickets
  alter column statut set default 'nouveau'::ticket_status;

-- =====================================================
-- 3. MISE À JOUR TABLE MISSIONS (ajout contraintes)
-- =====================================================

-- Modifier la colonne statut pour utiliser le nouveau type
alter table missions 
  alter column statut type mission_status using 
    case statut::text
      when 'en_attente' then 'en_attente'::mission_status
      when 'planifiee' then 'en_attente'::mission_status
      when 'en_cours' then 'en_cours'::mission_status
      when 'terminee' then 'terminee'::mission_status
      when 'validee' then 'validee'::mission_status
      when 'annulee' then 'annulee'::mission_status
      else 'en_attente'::mission_status
    end;

-- Supprimer l'ancienne contrainte CHECK si elle existe
alter table missions drop constraint if exists missions_statut_check;

-- =====================================================
-- 4. FONCTION CENTRALE : TRANSITION DE STATUT TICKET
-- =====================================================

create or replace function update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status,
  p_role user_role
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_statut_actuel ticket_status;
  v_transition_valide boolean := false;
  v_raison_refus text;
begin
  -- 1. Récupérer le statut actuel
  select statut into v_statut_actuel
  from tickets
  where id = p_ticket_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Ticket non trouvé'
    );
  end if;
  
  -- 2. Vérifier si la transition est valide selon le rôle
  case v_statut_actuel
    -- Depuis 'nouveau'
    when 'nouveau' then
      if p_nouveau_statut = 'en_attente' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie diffuse le ticket
      elsif p_nouveau_statut = 'annule' and p_role in ('regie', 'locataire', 'admin_jtec') then
        v_transition_valide := true;  -- Locataire ou régie annule
      else
        v_raison_refus := 'Transition nouveau → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'en_attente'
    when 'en_attente' then
      if p_nouveau_statut = 'en_cours' and p_role in ('entreprise', 'admin_jtec') then
        v_transition_valide := true;  -- Entreprise accepte (via fonction accept_ticket)
      elsif p_nouveau_statut = 'annule' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie annule
      else
        v_raison_refus := 'Transition en_attente → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'en_cours'
    when 'en_cours' then
      if p_nouveau_statut = 'termine' and p_role in ('entreprise', 'admin_jtec') then
        v_transition_valide := true;  -- Entreprise termine
      elsif p_nouveau_statut = 'annule' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie annule
      else
        v_raison_refus := 'Transition en_cours → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'termine'
    when 'termine' then
      if p_nouveau_statut = 'clos' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie clôture
      else
        v_raison_refus := 'Transition termine → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'clos' ou 'annule' : aucune transition possible
    when 'clos' then
      v_raison_refus := 'Un ticket clos ne peut plus changer de statut';
    when 'annule' then
      v_raison_refus := 'Un ticket annulé ne peut plus changer de statut';
    
    else
      v_raison_refus := 'Statut actuel inconnu : ' || v_statut_actuel;
  end case;
  
  -- 3. Si transition invalide, retourner erreur
  if not v_transition_valide then
    return jsonb_build_object(
      'success', false,
      'error', v_raison_refus,
      'statut_actuel', v_statut_actuel,
      'statut_demande', p_nouveau_statut,
      'role', p_role
    );
  end if;
  
  -- 4. Effectuer la transition
  update tickets
  set 
    statut = p_nouveau_statut,
    updated_at = now(),
    date_cloture = case when p_nouveau_statut in ('clos', 'annule') then now() else date_cloture end
  where id = p_ticket_id;
  
  return jsonb_build_object(
    'success', true,
    'ancien_statut', v_statut_actuel,
    'nouveau_statut', p_nouveau_statut
  );
end;
$$;

comment on function update_ticket_statut is 'FONCTION CENTRALE : Gère toutes les transitions de statut des tickets avec contrôle par rôle';

-- =====================================================
-- 5. FONCTION CENTRALE : TRANSITION DE STATUT MISSION
-- =====================================================

create or replace function update_mission_statut(
  p_mission_id uuid,
  p_nouveau_statut mission_status,
  p_role user_role
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_statut_actuel mission_status;
  v_ticket_id uuid;
  v_transition_valide boolean := false;
  v_raison_refus text;
begin
  -- 1. Récupérer le statut actuel et le ticket_id
  select statut, ticket_id
  into v_statut_actuel, v_ticket_id
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier si la transition est valide selon le rôle
  case v_statut_actuel
    -- Depuis 'en_attente'
    when 'en_attente' then
      if p_nouveau_statut = 'en_cours' and p_role in ('entreprise', 'technicien', 'admin_jtec') then
        v_transition_valide := true;  -- Entreprise/technicien démarre
      elsif p_nouveau_statut = 'annulee' and p_role in ('regie', 'entreprise', 'admin_jtec') then
        v_transition_valide := true;  -- Régie ou entreprise annule
      else
        v_raison_refus := 'Transition en_attente → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'en_cours'
    when 'en_cours' then
      if p_nouveau_statut = 'terminee' and p_role in ('entreprise', 'technicien', 'admin_jtec') then
        v_transition_valide := true;  -- Entreprise/technicien termine
      elsif p_nouveau_statut = 'annulee' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie annule
      else
        v_raison_refus := 'Transition en_cours → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'terminee'
    when 'terminee' then
      if p_nouveau_statut = 'validee' and p_role in ('regie', 'admin_jtec') then
        v_transition_valide := true;  -- Régie valide
      else
        v_raison_refus := 'Transition terminee → ' || p_nouveau_statut || ' non autorisée pour le rôle ' || p_role;
      end if;
    
    -- Depuis 'validee' ou 'annulee' : aucune transition possible
    when 'validee' then
      v_raison_refus := 'Une mission validée ne peut plus changer de statut';
    when 'annulee' then
      v_raison_refus := 'Une mission annulée ne peut plus changer de statut';
    
    else
      v_raison_refus := 'Statut actuel inconnu : ' || v_statut_actuel;
  end case;
  
  -- 3. Si transition invalide, retourner erreur
  if not v_transition_valide then
    return jsonb_build_object(
      'success', false,
      'error', v_raison_refus,
      'statut_actuel', v_statut_actuel,
      'statut_demande', p_nouveau_statut,
      'role', p_role
    );
  end if;
  
  -- 4. Effectuer la transition
  update missions
  set 
    statut = p_nouveau_statut,
    updated_at = now(),
    started_at = case when p_nouveau_statut = 'en_cours' and started_at is null then now() else started_at end,
    completed_at = case when p_nouveau_statut = 'terminee' then now() else completed_at end,
    validated_at = case when p_nouveau_statut = 'validee' then now() else validated_at end
  where id = p_mission_id;
  
  -- 5. SYNCHRONISATION AUTOMATIQUE : Mettre à jour le statut du ticket
  case p_nouveau_statut
    when 'en_cours' then
      -- Mission en_cours → Ticket en_cours (si pas déjà fait)
      update tickets set statut = 'en_cours', updated_at = now() where id = v_ticket_id and statut != 'en_cours';
    
    when 'terminee' then
      -- Mission terminee → Ticket termine
      update tickets set statut = 'termine', updated_at = now() where id = v_ticket_id;
    
    when 'validee' then
      -- Mission validee → Ticket clos
      update tickets set statut = 'clos', date_cloture = now(), updated_at = now() where id = v_ticket_id;
    
    when 'annulee' then
      -- Mission annulee → Ticket annule
      update tickets set statut = 'annule', date_cloture = now(), updated_at = now() where id = v_ticket_id;
    
    else
      null;  -- Pas de synchronisation pour les autres statuts
  end case;
  
  return jsonb_build_object(
    'success', true,
    'ancien_statut', v_statut_actuel,
    'nouveau_statut', p_nouveau_statut,
    'ticket_synchronise', true
  );
end;
$$;

comment on function update_mission_statut is 'FONCTION CENTRALE : Gère toutes les transitions de statut des missions avec synchronisation automatique du ticket';

-- =====================================================
-- 6. FONCTION : ACCEPTATION TICKET (mise à jour)
-- =====================================================

-- Remplacer la fonction existante pour utiliser la nouvelle logique
create or replace function accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ticket_regie_id uuid;
  v_is_authorized boolean;
  v_ticket_statut ticket_status;
  v_ticket_locked boolean;
  v_mission_id uuid;
  v_result jsonb;
begin
  -- 1. Vérifier que le ticket existe et récupérer son statut
  select 
    t.regie_id,
    t.statut,
    t.locked_at is not null
  into v_ticket_regie_id, v_ticket_statut, v_ticket_locked
  from tickets t
  where t.id = p_ticket_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Ticket non trouvé'
    );
  end if;
  
  -- 2. Vérifier que le ticket est en_attente (diffusé)
  if v_ticket_statut != 'en_attente' then
    return jsonb_build_object(
      'success', false,
      'error', 'Le ticket doit être en_attente pour être accepté (statut actuel: ' || v_ticket_statut || ')'
    );
  end if;
  
  -- 3. Vérifier que le ticket n'est pas déjà verrouillé
  if v_ticket_locked then
    return jsonb_build_object(
      'success', false,
      'error', 'Ce ticket est déjà verrouillé (une mission existe déjà)'
    );
  end if;
  
  -- 4. Vérifier que l'entreprise est autorisée
  select exists(
    select 1 
    from autorisations_entreprise
    where entreprise_id = p_entreprise_id
      and regie_id = v_ticket_regie_id
      and statut = 'active'
  ) into v_is_authorized;
  
  if not v_is_authorized then
    return jsonb_build_object(
      'success', false,
      'error', 'Entreprise non autorisée pour cette régie'
    );
  end if;
  
  -- 5. Créer la mission
  insert into missions (ticket_id, entreprise_id, statut)
  values (p_ticket_id, p_entreprise_id, 'en_attente')
  returning id into v_mission_id;
  
  -- 6. Verrouiller le ticket et changer son statut à 'en_cours'
  update tickets
  set 
    locked_at = now(),
    statut = 'en_cours',
    updated_at = now(),
    entreprise_id = p_entreprise_id
  where id = p_ticket_id;
  
  return jsonb_build_object(
    'success', true,
    'mission_id', v_mission_id,
    'ticket_statut', 'en_cours'
  );
end;
$$;

comment on function accept_ticket_and_create_mission is 'Accepte un ticket en_attente, crée une mission, verrouille le ticket et synchronise les statuts';

-- =====================================================
-- 7. TRIGGER : EMPÊCHER MODIFICATIONS DIRECTES
-- =====================================================

-- Trigger pour empêcher les modifications directes du statut de ticket
create or replace function prevent_direct_ticket_statut_update()
returns trigger
language plpgsql
as $$
begin
  -- Permettre les mises à jour via les fonctions officielles
  -- (détection via l'origine de l'appel - security definer)
  if current_setting('role', true) != 'postgres' and 
     old.statut is distinct from new.statut then
    raise exception 'INTERDIT : Utilisez update_ticket_statut() pour changer le statut';
  end if;
  
  return new;
end;
$$;

-- Note : Ce trigger est désactivé par défaut pour permettre les mises à jour via les fonctions
-- Pour l'activer en production :
-- create trigger enforce_ticket_statut_transition
--   before update on tickets
--   for each row
--   when (old.statut is distinct from new.statut)
--   execute function prevent_direct_ticket_statut_update();

-- =====================================================
-- 8. VUES : VISIBILITÉ PAR RÔLE
-- =====================================================

-- Vue : Tickets visibles par la régie
create or replace view tickets_regie as
select 
  t.*,
  l.adresse as logement_adresse,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  e.nom as entreprise_nom,
  m.statut as mission_statut,
  m.id as mission_id
from tickets t
join logements l on t.logement_id = l.id
join locataires loc on t.locataire_id = loc.id
left join entreprises e on t.entreprise_id = e.id
left join missions m on m.ticket_id = t.id;

comment on view tickets_regie is 'Vue régie : tous les tickets de leur périmètre avec infos mission';

-- Vue : Tickets visibles par les entreprises
create or replace view tickets_entreprise as
select 
  t.*,
  l.adresse as logement_adresse,
  m.statut as mission_statut,
  m.id as mission_id
from tickets t
join logements l on t.logement_id = l.id
left join missions m on m.ticket_id = t.id and m.entreprise_id = auth.uid()
where 
  -- Entreprise voit les tickets en_attente (diffusés) OU ses propres missions
  (t.statut = 'en_attente' and exists(
    select 1 from autorisations_entreprise ae
    where ae.entreprise_id = auth.uid()
      and ae.regie_id = t.regie_id
      and ae.statut = 'active'
  ))
  or t.entreprise_id = auth.uid();

comment on view tickets_entreprise is 'Vue entreprise : tickets en_attente (pool) et leurs propres tickets acceptés';

-- Vue : Tickets visibles par les locataires
create or replace view tickets_locataire as
select 
  t.*,
  l.adresse as logement_adresse,
  e.nom as entreprise_nom,
  case 
    when t.statut = 'nouveau' then 'En attente de traitement'
    when t.statut = 'en_attente' then 'En recherche d''entreprise'
    when t.statut = 'en_cours' then 'Intervention en cours'
    when t.statut = 'termine' then 'Travaux terminés'
    when t.statut = 'clos' then 'Ticket clôturé'
    when t.statut = 'annule' then 'Ticket annulé'
  end as statut_libelle
from tickets t
join logements l on t.logement_id = l.id
left join entreprises e on t.entreprise_id = e.id
where t.locataire_id in (
  select id from locataires where profile_id = auth.uid()
);

comment on view tickets_locataire is 'Vue locataire : leurs propres tickets avec libellés explicites';

-- =====================================================
-- 9. GRANTS : PERMISSIONS
-- =====================================================

-- Permissions sur les fonctions (toutes SECURITY DEFINER)
grant execute on function update_ticket_statut(uuid, ticket_status, user_role) to authenticated;
grant execute on function update_mission_statut(uuid, mission_status, user_role) to authenticated;
grant execute on function accept_ticket_and_create_mission(uuid, uuid) to authenticated;

-- Permissions sur les vues
grant select on tickets_regie to authenticated;
grant select on tickets_entreprise to authenticated;
grant select on tickets_locataire to authenticated;

-- =====================================================
-- 10. INDEX SUPPLÉMENTAIRES (performances)
-- =====================================================

create index if not exists idx_tickets_statut_regie on tickets(statut, regie_id);
create index if not exists idx_missions_statut_entreprise on missions(statut, entreprise_id);
create index if not exists idx_tickets_locked on tickets(locked_at) where locked_at is not null;

-- =====================================================
-- 11. DOCUMENTATION : MATRICE DE TRANSITIONS
-- =====================================================

comment on column tickets.statut is E'Statut du ticket - TRANSITIONS AUTORISÉES:\n'
  '• nouveau → en_attente (régie diffuse)\n'
  '• en_attente → en_cours (entreprise accepte)\n'
  '• en_cours → termine (entreprise termine)\n'
  '• termine → clos (régie valide)\n'
  '• * → annule (régie ou locataire)';

comment on column missions.statut is E'Statut de la mission - TRANSITIONS AUTORISÉES:\n'
  '• en_attente → en_cours (entreprise/technicien démarre)\n'
  '• en_cours → terminee (entreprise/technicien termine)\n'
  '• terminee → validee (régie valide)\n'
  '• * → annulee (régie ou entreprise)';

-- =====================================================
-- FIN DU RÉALIGNEMENT
-- =====================================================
-- Ce fichier constitue la SOURCE DE VÉRITÉ UNIQUE
-- pour la logique des statuts dans JETC_IMMO_SaaS
-- =====================================================
