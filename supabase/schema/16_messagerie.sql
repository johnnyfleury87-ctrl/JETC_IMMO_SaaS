/**
 * ÉTAPE 14 – Messagerie & Notifications
 * 
 * Objectif : Communication et suivi entre acteurs
 * Contenu :
 *   - Messages par mission
 *   - Notifications automatiques
 * 
 * Critères :
 *   - Accès limité aux acteurs concernés
 *   - Notifications sur événements (changements statut, nouveaux messages)
 */

-- =====================================================
-- Table : messages
-- =====================================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  
  -- Contexte
  mission_id uuid not null references missions(id) on delete cascade,
  
  -- Expéditeur
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,  -- Nom de l'expéditeur (cache pour performance)
  sender_role text not null,  -- Role au moment de l'envoi
  
  -- Contenu
  content text not null,
  
  -- Type
  type text not null default 'message' check (type in ('message', 'system')),
  
  -- Métadonnées
  created_at timestamptz not null default now()
);

-- Index pour performance
create index idx_messages_mission on messages (mission_id, created_at desc);
create index idx_messages_sender on messages (sender_user_id);

-- =====================================================
-- Table : notifications
-- =====================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  
  -- Destinataire
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Type de notification
  type text not null check (type in (
    'new_message',
    'mission_status_change',
    'ticket_status_change',
    'mission_assigned',
    'facture_status_change',
    'new_ticket'
  )),
  
  -- Titre et contenu
  title text not null,
  message text not null,
  
  -- Lien vers l'objet concerné
  related_mission_id uuid references missions(id) on delete cascade,
  related_ticket_id uuid references tickets(id) on delete cascade,
  related_facture_id uuid references factures(id) on delete cascade,
  related_message_id uuid references messages(id) on delete cascade,
  
  -- Statut de lecture
  read boolean not null default false,
  read_at timestamptz,
  
  -- Métadonnées
  created_at timestamptz not null default now()
);

-- Index pour performance
create index idx_notifications_user on notifications (user_id, created_at desc);
create index idx_notifications_read on notifications (user_id, read, created_at desc);

-- =====================================================
-- Fonction : get_mission_actors
-- =====================================================

/**
 * Récupère tous les acteurs (user_ids) d'une mission
 * 
 * @param p_mission_id UUID de la mission
 * @return TABLE avec user_id et role
 */
create or replace function get_mission_actors(p_mission_id uuid)
returns table (user_id uuid, role text)
language plpgsql
security definer
as $$
begin
  return query
  select distinct au.id, au.role
  from missions m
    join tickets t on m.ticket_id = t.id
    join profiles au on (
      -- Entreprise
      au.entreprise_id = m.entreprise_id
      -- Technicien assigné
      or (m.technicien_id is not null and exists (
        select 1 from techniciens tech 
        where tech.id = m.technicien_id 
        and tech.profile_id = au.id
      ))
      -- Régie
      or au.regie_id = t.regie_id
      -- Locataire
      or au.locataire_id = t.locataire_id
    )
  where m.id = p_mission_id;
end;
$$;

-- =====================================================
-- Fonction : send_message
-- =====================================================

/**
 * Envoie un message sur une mission
 * Vérifie que l'utilisateur a accès à la mission
 * Crée des notifications pour les autres acteurs
 * 
 * @param p_mission_id UUID de la mission
 * @param p_sender_user_id UUID de l'expéditeur
 * @param p_content Contenu du message
 * @return Le message créé
 */
create or replace function send_message(
  p_mission_id uuid,
  p_sender_user_id uuid,
  p_content text
)
returns messages
language plpgsql
security definer
as $$
declare
  v_message messages;
  v_sender profiles;
  v_actor record;
  v_mission_ref text;
begin
  -- Vérifier que la mission existe
  if not exists (select 1 from missions where id = p_mission_id) then
    raise exception 'Mission non trouvée';
  end if;
  
  -- Récupérer les infos de l'expéditeur
  select * into v_sender from profiles where id = p_sender_user_id;
  
  if not found then
    raise exception 'Utilisateur non trouvé';
  end if;
  
  -- Vérifier que l'expéditeur est un acteur de la mission
  if not exists (
    select 1 from get_mission_actors(p_mission_id) 
    where user_id = p_sender_user_id
  ) then
    raise exception 'Accès refusé : vous n''êtes pas acteur de cette mission';
  end if;
  
  -- Créer le message
  insert into messages (
    mission_id,
    sender_user_id,
    sender_name,
    sender_role,
    content,
    type
  )
  values (
    p_mission_id,
    p_sender_user_id,
    coalesce(v_sender.nom, v_sender.prenom, 'Utilisateur'),
    v_sender.role,
    p_content,
    'message'
  )
  returning * into v_message;
  
  -- Récupérer la référence de la mission pour les notifications
  select reference into v_mission_ref from missions where id = p_mission_id;
  
  -- Créer des notifications pour les autres acteurs
  for v_actor in 
    select * from get_mission_actors(p_mission_id) 
    where user_id != p_sender_user_id
  loop
    insert into notifications (
      user_id,
      type,
      title,
      message,
      related_mission_id,
      related_message_id
    )
    values (
      v_actor.user_id,
      'new_message',
      'Nouveau message sur ' || v_mission_ref,
      v_sender.nom || ' : ' || left(p_content, 100),
      p_mission_id,
      v_message.id
    );
  end loop;
  
  return v_message;
end;
$$;

-- =====================================================
-- Fonction : mark_notification_as_read
-- =====================================================

/**
 * Marque une notification comme lue
 * 
 * @param p_notification_id UUID de la notification
 * @param p_user_id UUID de l'utilisateur
 * @return La notification mise à jour
 */
create or replace function mark_notification_as_read(
  p_notification_id uuid,
  p_user_id uuid
)
returns notifications
language plpgsql
security definer
as $$
declare
  v_notification notifications;
begin
  -- Vérifier que la notification appartient à l'utilisateur
  select * into v_notification 
  from notifications 
  where id = p_notification_id and user_id = p_user_id;
  
  if not found then
    raise exception 'Notification non trouvée';
  end if;
  
  -- Marquer comme lue
  update notifications
  set read = true,
      read_at = now()
  where id = p_notification_id
  returning * into v_notification;
  
  return v_notification;
end;
$$;

-- =====================================================
-- Fonction : create_system_message
-- =====================================================

/**
 * Crée un message système (pour événements automatiques)
 * 
 * @param p_mission_id UUID de la mission
 * @param p_content Contenu du message système
 * @return Le message créé
 */
create or replace function create_system_message(
  p_mission_id uuid,
  p_content text
)
returns messages
language plpgsql
security definer
as $$
declare
  v_message messages;
begin
  insert into messages (
    mission_id,
    sender_user_id,
    sender_name,
    sender_role,
    content,
    type
  )
  values (
    p_mission_id,
    (select id from profiles where role = 'admin_jtec' limit 1),  -- Système
    'Système',
    'system',
    p_content,
    'system'
  )
  returning * into v_message;
  
  return v_message;
end;
$$;

-- =====================================================
-- Trigger : notification sur changement statut mission
-- =====================================================

create or replace function notify_mission_status_change_extended()
returns trigger
language plpgsql
as $$
declare
  v_actor record;
  v_mission_ref text;
begin
  if OLD.statut is distinct from NEW.statut then
    -- Récupérer la référence
    v_mission_ref := NEW.reference;
    
    -- Message système dans la messagerie
    perform create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    -- Notifications pour tous les acteurs
    for v_actor in select * from get_mission_actors(NEW.id)
    loop
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    end loop;
  end if;
  
  return NEW;
end;
$$;

create trigger mission_status_change_notification
  after update on missions
  for each row
  execute function notify_mission_status_change_extended();

-- =====================================================
-- Trigger : notification sur assignation technicien
-- =====================================================

create or replace function notify_technicien_assignment()
returns trigger
language plpgsql
as $$
declare
  v_tech_user_id uuid;
  v_mission_ref text;
  v_tech_nom text;
begin
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  if OLD.technicien_id is null and NEW.technicien_id is not null then
    -- Récupérer le user_id du technicien
    select user_id, nom into v_tech_user_id, v_tech_nom
    from techniciens
    where id = NEW.technicien_id;
    
    if v_tech_user_id is not null then
      v_mission_ref := NEW.reference;
      
      -- Message système
      perform create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      -- Notification pour le technicien
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    end if;
  end if;
  
  return NEW;
end;
$$;

create trigger technicien_assignment_notification
  after update on missions
  for each row
  execute function notify_technicien_assignment();

-- =====================================================
-- Trigger : notification sur nouveau ticket
-- =====================================================

create or replace function notify_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  -- Notifier la régie (via regie_id dans profiles)
  insert into notifications (
    user_id,
    type,
    title,
    message,
    related_ticket_id
  )
  select 
    p.id,
    'new_ticket',
    'Nouveau ticket créé',
    'Ticket #' || NEW.id || ' : ' || left(NEW.description, 100),
    NEW.id
  from profiles p
  where p.regie_id = NEW.regie_id;

  -- Notifier le locataire (via locataires.profile_id)
  insert into notifications (
    user_id,
    type,
    title,
    message,
    related_ticket_id
  )
  select 
    l.profile_id,
    'new_ticket',
    'Nouveau ticket créé',
    'Ticket #' || NEW.id || ' : ' || left(NEW.description, 100),
    NEW.id
  from locataires l
  where l.id = NEW.locataire_id;

  return NEW;
end;
$$;

create trigger new_ticket_notification
  after insert on tickets
  for each row
  execute function notify_new_ticket();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Messages : accessibles uniquement aux acteurs de la mission
alter table messages enable row level security;

create policy messages_access
  on messages
  for all
  to authenticated
  using (
    exists (
      select 1 from get_mission_actors(mission_id)
      where id = auth.uid()
    )
  );

-- Notifications : accessibles uniquement au destinataire
alter table notifications enable row level security;

create policy notifications_own
  on notifications
  for all
  to authenticated
  using (user_id = auth.uid());

-- =====================================================
-- Grants
-- =====================================================

grant select, insert on messages to authenticated;
grant select, update on notifications to authenticated;
