/**
 * ÉTAPE 13 – Facturation
 * 
 * Objectif : Générer les factures pour les missions validées
 * Contenu :
 *   - Table factures (1 mission = 1 facture)
 *   - Calcul des commissions JTEC
 *   - Statuts de facturation (brouillon, envoyee, payee)
 *   - Visibilité par rôle
 * 
 * Critères :
 *   - 1 mission = 1 facture (UNIQUE constraint)
 *   - Visibilité correcte par rôle
 *   - Calcul automatique commission JTEC
 */

-- =====================================================
-- Table : factures
-- =====================================================

create table if not exists factures (
  id uuid primary key default gen_random_uuid(),
  
  -- Références
  mission_id uuid not null unique references missions(id) on delete restrict,
  entreprise_id uuid not null references entreprises(id) on delete restrict,
  regie_id uuid not null references regies(id) on delete restrict,
  
  -- Numérotation
  numero text not null unique,
  
  -- Montants
  montant_ht decimal(10,2) not null check (montant_ht >= 0),
  taux_tva decimal(5,2) not null default 20.00 check (taux_tva >= 0 and taux_tva <= 100),
  montant_tva decimal(10,2) generated always as (montant_ht * taux_tva / 100) stored,
  montant_ttc decimal(10,2) generated always as (montant_ht + (montant_ht * taux_tva / 100)) stored,
  
  -- Commission JTEC (calculée sur HT)
  taux_commission decimal(5,2) not null default 10.00 check (taux_commission >= 0 and taux_commission <= 100),
  montant_commission decimal(10,2) generated always as (montant_ht * taux_commission / 100) stored,
  
  -- Statut
  statut text not null default 'brouillon' check (statut in ('brouillon', 'envoyee', 'payee', 'annulee')),
  
  -- Dates
  date_emission date not null default current_date,
  date_echeance date not null,
  date_envoi timestamptz,
  date_paiement timestamptz,
  
  -- Informations additionnelles
  notes text,
  
  -- Métadonnées
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour performance
create index idx_factures_mission on factures (mission_id);
create index idx_factures_entreprise on factures (entreprise_id);
create index idx_factures_regie on factures (regie_id);
create index idx_factures_statut on factures (statut);
create index idx_factures_date_emission on factures (date_emission);
create index idx_factures_numero on factures (numero);

-- Trigger pour updated_at
create trigger factures_updated_at
  before update on factures
  for each row
  execute function handle_updated_at();

-- =====================================================
-- Fonction : generate_facture_from_mission
-- =====================================================

/**
 * Génère une facture pour une mission validée
 * 
 * @param p_mission_id UUID de la mission
 * @param p_montant_ht Montant HT de la facture
 * @param p_date_echeance Date d'échéance de paiement
 * @param p_taux_tva Taux de TVA (par défaut 20%)
 * @param p_taux_commission Taux de commission JTEC (par défaut 10%)
 * @return La facture créée
 */
create or replace function generate_facture_from_mission(
  p_mission_id uuid,
  p_montant_ht decimal,
  p_date_echeance date default current_date + interval '30 days',
  p_taux_tva decimal default 20.00,
  p_taux_commission decimal default 10.00
)
returns factures
language plpgsql
security definer
as $$
declare
  v_mission record;
  v_facture factures;
  v_numero text;
  v_year text;
  v_seq int;
begin
  -- Vérifier que la mission existe et est validée
  select * into v_mission from missions where id = p_mission_id;
  
  if not found then
    raise exception 'Mission non trouvée';
  end if;
  
  if v_mission.statut != 'validee' then
    raise exception 'La mission doit être validée pour générer une facture';
  end if;
  
  -- Vérifier qu'aucune facture n'existe déjà
  if exists (select 1 from factures where mission_id = p_mission_id) then
    raise exception 'Une facture existe déjà pour cette mission';
  end if;
  
  -- Générer le numéro de facture (format: FAC-YYYY-NNNN)
  v_year := to_char(current_date, 'YYYY');
  
  select coalesce(max(
    case 
      when numero ~ '^FAC-[0-9]{4}-[0-9]+$' 
      then cast(substring(numero from 'FAC-[0-9]{4}-([0-9]+)') as int)
      else 0
    end
  ), 0) + 1
  into v_seq
  from factures
  where numero like 'FAC-' || v_year || '-%';
  
  v_numero := 'FAC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  
  -- Créer la facture
  insert into factures (
    mission_id,
    entreprise_id,
    regie_id,
    numero,
    montant_ht,
    taux_tva,
    taux_commission,
    date_echeance
  )
  values (
    p_mission_id,
    v_mission.entreprise_id,
    (select regie_id from tickets where id = v_mission.ticket_id),
    v_numero,
    p_montant_ht,
    p_taux_tva,
    p_taux_commission,
    p_date_echeance
  )
  returning * into v_facture;
  
  return v_facture;
end;
$$;

-- =====================================================
-- Fonction : update_facture_status
-- =====================================================

/**
 * Met à jour le statut d'une facture
 * 
 * @param p_facture_id UUID de la facture
 * @param p_nouveau_statut Nouveau statut
 * @return La facture mise à jour
 */
create or replace function update_facture_status(
  p_facture_id uuid,
  p_nouveau_statut text
)
returns factures
language plpgsql
security definer
as $$
declare
  v_facture factures;
  v_ancien_statut text;
begin
  -- Récupérer la facture
  select * into v_facture from factures where id = p_facture_id;
  
  if not found then
    raise exception 'Facture non trouvée';
  end if;
  
  v_ancien_statut := v_facture.statut;
  
  -- Vérifier que le nouveau statut est valide
  if p_nouveau_statut not in ('brouillon', 'envoyee', 'payee', 'annulee') then
    raise exception 'Statut invalide: %', p_nouveau_statut;
  end if;
  
  -- Vérifier les transitions autorisées
  if v_ancien_statut = 'annulee' then
    raise exception 'Impossible de modifier une facture annulée';
  end if;
  
  if v_ancien_statut = 'payee' and p_nouveau_statut != 'payee' then
    raise exception 'Impossible de modifier une facture déjà payée';
  end if;
  
  -- Valider la séquence logique
  if v_ancien_statut = 'brouillon' and p_nouveau_statut = 'payee' then
    raise exception 'Une facture doit être envoyée avant d''être marquée comme payée';
  end if;
  
  -- Mettre à jour la facture
  update factures
  set statut = p_nouveau_statut,
      date_envoi = case when p_nouveau_statut = 'envoyee' and date_envoi is null then now() else date_envoi end,
      date_paiement = case when p_nouveau_statut = 'payee' and date_paiement is null then now() else date_paiement end
  where id = p_facture_id
  returning * into v_facture;
  
  return v_facture;
end;
$$;

-- =====================================================
-- Fonction : cancel_facture
-- =====================================================

/**
 * Annule une facture (si pas encore payée)
 * 
 * @param p_facture_id UUID de la facture
 * @param p_raison Raison de l'annulation
 * @return La facture annulée
 */
create or replace function cancel_facture(
  p_facture_id uuid,
  p_raison text default null
)
returns factures
language plpgsql
security definer
as $$
declare
  v_facture factures;
begin
  -- Récupérer la facture
  select * into v_facture from factures where id = p_facture_id;
  
  if not found then
    raise exception 'Facture non trouvée';
  end if;
  
  -- Vérifier qu'elle n'est pas payée
  if v_facture.statut = 'payee' then
    raise exception 'Impossible d''annuler une facture déjà payée';
  end if;
  
  if v_facture.statut = 'annulee' then
    raise exception 'Facture déjà annulée';
  end if;
  
  -- Annuler la facture
  update factures
  set statut = 'annulee',
      notes = coalesce(notes || E'\n\nAnnulation: ' || p_raison, 'Annulation: ' || p_raison)
  where id = p_facture_id
  returning * into v_facture;
  
  return v_facture;
end;
$$;

-- =====================================================
-- Vue : factures_stats
-- =====================================================

/**
 * Statistiques de facturation par entreprise
 */
create or replace view factures_stats as
select
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  count(*) as total_factures,
  count(*) filter (where f.statut = 'brouillon') as factures_brouillon,
  count(*) filter (where f.statut = 'envoyee') as factures_envoyees,
  count(*) filter (where f.statut = 'payee') as factures_payees,
  count(*) filter (where f.statut = 'annulee') as factures_annulees,
  
  -- Montants
  coalesce(sum(f.montant_ht) filter (where f.statut != 'annulee'), 0) as ca_ht_total,
  coalesce(sum(f.montant_ttc) filter (where f.statut != 'annulee'), 0) as ca_ttc_total,
  coalesce(sum(f.montant_commission) filter (where f.statut != 'annulee'), 0) as commissions_jtec_total,
  
  -- Montants payés
  coalesce(sum(f.montant_ht) filter (where f.statut = 'payee'), 0) as ca_ht_paye,
  coalesce(sum(f.montant_ttc) filter (where f.statut = 'payee'), 0) as ca_ttc_paye,
  coalesce(sum(f.montant_commission) filter (where f.statut = 'payee'), 0) as commissions_jtec_payees,
  
  -- Montants en attente
  coalesce(sum(f.montant_ttc) filter (where f.statut in ('brouillon', 'envoyee')), 0) as ca_en_attente,
  
  -- Taux
  case 
    when count(*) filter (where f.statut != 'annulee') > 0
    then round(
      count(*) filter (where f.statut = 'payee')::decimal 
      / count(*) filter (where f.statut != 'annulee') * 100, 
      2
    )
    else 0
  end as taux_paiement,
  
  -- Délai moyen de paiement (en jours)
  round(
    avg(extract(epoch from (f.date_paiement - f.date_emission))/86400)
    filter (where f.statut = 'payee'),
    1
  ) as delai_moyen_paiement_jours
  
from entreprises e
  left join factures f on e.id = f.entreprise_id
group by e.id, e.nom;

-- =====================================================
-- Vue : factures_commissions_jtec
-- =====================================================

/**
 * Vue des commissions JTEC à percevoir
 */
create or replace view factures_commissions_jtec as
select
  f.id as facture_id,
  f.numero,
  f.date_emission,
  f.statut,
  e.nom as entreprise_nom,
  r.nom as regie_nom,
  f.montant_ht,
  f.montant_ttc,
  f.taux_commission,
  f.montant_commission,
  case 
    when f.statut = 'payee' then 'percue'
    when f.statut = 'annulee' then 'annulee'
    else 'en_attente'
  end as statut_commission
from factures f
  join entreprises e on f.entreprise_id = e.id
  join regies r on f.regie_id = r.id
order by f.date_emission desc;

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

alter table factures enable row level security;

-- Politique pour entreprises : voient uniquement leurs factures
create policy factures_entreprise_select
  on factures
  for select
  to authenticated
  using (
    entreprise_id = (select entreprise_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'entreprise'
  );

-- Politique pour régies : voient les factures des missions sur leurs biens
create policy factures_regie_select
  on factures
  for select
  to authenticated
  using (
    regie_id = (select regie_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'regie'
  );

-- Politique pour admin JTEC : voient toutes les factures
create policy factures_admin_jtec_all
  on factures
  for all
  to authenticated
  using (
    (select role from profiles where id = auth.uid()) = 'admin_jtec'
  );

-- Politique INSERT : seules les entreprises peuvent créer leurs factures
create policy factures_entreprise_insert
  on factures
  for insert
  to authenticated
  with check (
    entreprise_id = (select entreprise_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'entreprise'
  );

-- Politique UPDATE : entreprises et régies peuvent mettre à jour le statut
create policy factures_update
  on factures
  for update
  to authenticated
  using (
    (
      entreprise_id = (select entreprise_id from profiles where id = auth.uid())
      and (select role from profiles where id = auth.uid()) = 'entreprise'
    )
    or
    (
      regie_id = (select regie_id from profiles where id = auth.uid())
      and (select role from profiles where id = auth.uid()) = 'regie'
    )
    or
    (select role from profiles where id = auth.uid()) = 'admin_jtec'
  );

-- =====================================================
-- Trigger : notification changement statut facture
-- =====================================================

create or replace function notify_facture_status_change()
returns trigger
language plpgsql
as $$
begin
  if OLD.statut is distinct from NEW.statut then
    perform pg_notify('facture_status_change', json_build_object(
      'facture_id', NEW.id,
      'numero', NEW.numero,
      'ancien_statut', OLD.statut,
      'nouveau_statut', NEW.statut,
      'entreprise_id', NEW.entreprise_id,
      'regie_id', NEW.regie_id
    )::text);
  end if;
  return NEW;
end;
$$;

create trigger facture_status_change_trigger
  after update on factures
  for each row
  execute function notify_facture_status_change();

-- =====================================================
-- Grants
-- =====================================================

grant select on factures to authenticated;
grant insert on factures to authenticated;
grant update on factures to authenticated;
grant select on factures_stats to authenticated;
grant select on factures_commissions_jtec to authenticated;
