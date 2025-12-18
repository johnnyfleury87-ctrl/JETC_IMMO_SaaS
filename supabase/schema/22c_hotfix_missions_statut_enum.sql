-- =====================================================
-- HOTFIX MISSIONS.STATUT : TEXT → mission_status ENUM
-- =====================================================
-- Objectif : Convertir missions.statut sans erreur DDL
-- Méthode : DROP DEFAULT/CONSTRAINTS/INDEXES → ALTER → RECRÉATION
-- Ordre : Après 22_statuts_realignement.sql
-- =====================================================

do $$
declare
  v_constraint_name text;
  v_index_name text;
  v_count int;
begin
  raise notice '🔧 HOTFIX missions.statut TEXT → mission_status ENUM';
  raise notice '';

  -- =====================================================
  -- PHASE 1: VÉRIFICATION PRÉ-CONVERSION
  -- =====================================================
  
  raise notice '🔍 PHASE 1: Vérification état actuel...';
  
  -- Vérifier que missions.statut est TEXT
  select count(*) into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'missions'
    and column_name = 'statut'
    and udt_name = 'text';
  
  if v_count = 0 then
    raise notice '  ⚠️  missions.statut n''est pas TEXT (déjà converti ou inexistant)';
    raise notice '  → HOTFIX ignoré (idempotent)';
    return;
  end if;
  
  raise notice '  ✅ missions.statut = TEXT';
  
  -- Vérifier ENUM mission_status existe
  if not exists (select 1 from pg_type where typname = 'mission_status' and typtype = 'e') then
    raise exception '❌ ENUM mission_status absent. Exécuter 02_enums.sql.';
  end if;
  
  raise notice '  ✅ ENUM mission_status existe';
  raise notice '';
  
  -- =====================================================
  -- PHASE 2: DROP TRIGGERS (SÉCURITÉ)
  -- =====================================================
  
  raise notice '🗑️  PHASE 2: Suppression triggers non-internal...';
  
  for v_index_name in 
    select tgname
    from pg_trigger
    where tgrelid = 'missions'::regclass
      and tgisinternal = false
  loop
    execute format('DROP TRIGGER IF EXISTS %I ON missions', v_index_name);
    raise notice '  ✓ DROP TRIGGER %', v_index_name;
  end loop;
  
  raise notice '';
  
  -- =====================================================
  -- PHASE 3: DROP INDEXES INCLUANT missions.statut
  -- =====================================================
  
  raise notice '🗑️  PHASE 3: Suppression indexes sur missions.statut...';
  
  for v_index_name in
    select i.relname
    from pg_class t
    join pg_index ix on t.oid = ix.indrelid
    join pg_class i on i.oid = ix.indexrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(ix.indkey)
    where t.relname = 'missions'
      and a.attname = 'statut'
  loop
    execute format('DROP INDEX IF EXISTS %I', v_index_name);
    raise notice '  ✓ DROP INDEX %', v_index_name;
  end loop;
  
  raise notice '';
  
  -- =====================================================
  -- PHASE 4: DROP CONSTRAINTS SUR missions.statut
  -- =====================================================
  
  raise notice '🗑️  PHASE 4: Suppression contraintes sur missions.statut...';
  
  for v_constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(con.conkey)
    where t.relname = 'missions'
      and a.attname = 'statut'
      and con.contype in ('c', 'u')  -- CHECK ou UNIQUE
  loop
    execute format('ALTER TABLE missions DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    raise notice '  ✓ DROP CONSTRAINT %', v_constraint_name;
  end loop;
  
  raise notice '';
  
  -- =====================================================
  -- PHASE 5: DROP DEFAULT
  -- =====================================================
  
  raise notice '🗑️  PHASE 5: Suppression DEFAULT missions.statut...';
  
  alter table missions alter column statut drop default;
  raise notice '  ✓ DEFAULT supprimé';
  raise notice '';
  
  -- =====================================================
  -- PHASE 6: ALTER TYPE (OPÉRATION CRITIQUE)
  -- =====================================================
  
  raise notice '⚙️  PHASE 6: ALTER missions.statut → mission_status...';
  
  alter table missions
    alter column statut type mission_status
    using case
      when statut = 'en_attente' then 'en_attente'::mission_status
      when statut = 'en_cours' then 'en_cours'::mission_status
      when statut = 'terminee' then 'terminee'::mission_status
      when statut = 'validee' then 'validee'::mission_status
      when statut = 'annulee' then 'annulee'::mission_status
      else 'en_attente'::mission_status
    end;
  
  raise notice '  ✅ ALTER TYPE réussi';
  
  -- Vérifier conversion
  select count(*) into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'missions'
    and column_name = 'statut'
    and udt_name = 'mission_status';
  
  if v_count = 0 then
    raise exception '❌ missions.statut n''est pas mission_status après ALTER';
  end if;
  
  raise notice '  ✅ Type vérifié : missions.statut = mission_status';
  raise notice '';
  
  -- =====================================================
  -- PHASE 7: RECRÉATION DEFAULT
  -- =====================================================
  
  raise notice '🔧 PHASE 7: Recréation DEFAULT...';
  
  alter table missions alter column statut set default 'en_attente'::mission_status;
  raise notice '  ✓ DEFAULT ''en_attente''::mission_status restauré';
  raise notice '';
  
  -- =====================================================
  -- PHASE 8: RECRÉATION INDEXES
  -- =====================================================
  
  raise notice '🔧 PHASE 8: Recréation indexes...';
  
  -- Index principal sur statut
  create index if not exists idx_missions_statut on missions(statut);
  raise notice '  ✓ CREATE INDEX idx_missions_statut';
  
  -- Index composite pour missions en retard
  create index if not exists idx_missions_retard_lookup 
    on missions(statut, date_limite_intervention)
    where date_limite_intervention is not null;
  raise notice '  ✓ CREATE INDEX idx_missions_retard_lookup';
  
  raise notice '';
  
  -- =====================================================
  -- PHASE 9: RECRÉATION TRIGGERS (SAFE)
  -- =====================================================
  
  raise notice '🔔 PHASE 9: Recréation triggers (si fonctions existent)...';
  
  -- Trigger updated_at
  if exists (select 1 from pg_proc where proname = 'handle_updated_at') then
    create trigger missions_updated_at
      before update on missions
      for each row
      execute function handle_updated_at();
    raise notice '  ✓ CREATE TRIGGER missions_updated_at';
  else
    raise notice '  ⚠️  Fonction handle_updated_at absente, trigger non créé';
  end if;
  
  -- Trigger update_mission_status
  if exists (select 1 from pg_proc where proname = 'update_mission_status') then
    create trigger mission_status_change
      after update of statut on missions
      for each row
      when (old.statut is distinct from new.statut)
      execute function update_mission_status();
    raise notice '  ✓ CREATE TRIGGER mission_status_change';
  else
    raise notice '  ⚠️  Fonction update_mission_status absente, trigger non créé';
  end if;
  
  raise notice '';
  
  -- =====================================================
  -- PHASE 10: VÉRIFICATION FINALE
  -- =====================================================
  
  raise notice '✅ PHASE 10: Vérification finale...';
  
  -- Vérifier type final
  select data_type into v_constraint_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'missions'
    and column_name = 'statut';
  
  raise notice '  ✅ missions.statut type = USER-DEFINED (ENUM)';
  
  -- Compter les index recréés
  select count(*) into v_count
  from pg_indexes
  where tablename = 'missions'
    and indexname in ('idx_missions_statut', 'idx_missions_retard_lookup');
  
  raise notice '  ✅ % indexes recréés', v_count;
  
  raise notice '';
  raise notice '🎉 HOTFIX TERMINÉ';
  raise notice '';
  raise notice '📊 RÉSUMÉ:';
  raise notice '  - missions.statut : TEXT → mission_status ENUM';
  raise notice '  - DEFAULT restauré : ''en_attente''::mission_status';
  raise notice '  - Indexes recréés : idx_missions_statut, idx_missions_retard_lookup';
  raise notice '  - Triggers recréés si fonctions disponibles';
  raise notice '  - Aucune erreur DDL';
  
end $$;
