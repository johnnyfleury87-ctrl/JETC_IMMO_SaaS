# INVENTAIRE BASE RÉELLE — À partir des CSV Audit (0-15)

**Date:** 2026-01-04
**Source:** `supabase/Audit_supabase/*.csv` (fichiers 0-15)
**Objectif:** État factuel de la base de données (pas d'interprétation)

---

## 0. 0_Info système et contexte.csv

**Lignes:** 1
**Colonnes:** audit_at, db, user, postgres_version, server_version, search_path

**Contenu complet:**

- audit_at=2026-01-04 13:56:32.909471+00,postgres,postgres,"PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit",17.6,"""\$user"", public, extensions"

## 1. 1_Extensions installées.csv

**Lignes:** 7
**Colonnes:** extname, extversion, schema

**Contenu complet:**

- extname=btree_gist | extversion=1.7 | schema=public
- extname=pg_graphql | extversion=1.5.11 | schema=graphql
- extname=pg_stat_statements | extversion=1.11 | schema=extensions
- extname=pgcrypto | extversion=1.3 | schema=extensions
- extname=plpgsql | extversion=1.0 | schema=pg_catalog
- extname=supabase_vault | extversion=0.3.1 | schema=vault
- extname=uuid-ossp | extversion=1.1 | schema=extensions

## 2. 2_Schémas utiles.csv

**Lignes:** 8
**Colonnes:** schema

**Contenu complet:**

- schema=auth
- schema=extensions
- schema=graphql
- schema=graphql_public
- schema=public
- schema=realtime
- schema=storage
- schema=vault

## 3. 3_Tables (par schéma).csv

**Lignes:** 52
**Colonnes:** schemaname, tablename, tableowner

**Aperçu (10/52 lignes):**

- schemaname=auth | tablename=audit_log_entries | tableowner=supabase_auth_admin
- schemaname=auth | tablename=flow_state | tableowner=supabase_auth_admin
- schemaname=auth | tablename=identities | tableowner=supabase_auth_admin
- schemaname=auth | tablename=instances | tableowner=supabase_auth_admin
- schemaname=auth | tablename=mfa_amr_claims | tableowner=supabase_auth_admin
- schemaname=auth | tablename=mfa_challenges | tableowner=supabase_auth_admin
- schemaname=auth | tablename=mfa_factors | tableowner=supabase_auth_admin
- schemaname=auth | tablename=oauth_authorizations | tableowner=supabase_auth_admin
- schemaname=auth | tablename=oauth_client_states | tableowner=supabase_auth_admin
- schemaname=auth | tablename=oauth_clients | tableowner=supabase_auth_admin

... et 42 lignes supplémentaires

## 4. 4_Colonnes détaillées (types, null, défaut, identité).csv

**Lignes:** 795
**Colonnes:** table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default, is_identity, identity_generation

**Aperçu (10/795 lignes):**

- table_schema=auth | table_name=audit_log_entries | ordinal_position=1 | column_name=instance_id | data_type=uuid | udt_name=uuid | is_nullable=YES | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=audit_log_entries | ordinal_position=2 | column_name=id | data_type=uuid | udt_name=uuid | is_nullable=NO | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=audit_log_entries | ordinal_position=3 | column_name=payload | data_type=json | udt_name=json | is_nullable=YES | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=audit_log_entries | ordinal_position=4 | column_name=created_at | data_type=timestamp with time zone | udt_name=timestamptz | is_nullable=YES | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=audit_log_entries | ordinal_position=5 | column_name=ip_address | data_type=character varying | udt_name=varchar | is_nullable=NO | column_default=''::character varying | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=flow_state | ordinal_position=1 | column_name=id | data_type=uuid | udt_name=uuid | is_nullable=NO | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=flow_state | ordinal_position=2 | column_name=user_id | data_type=uuid | udt_name=uuid | is_nullable=YES | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=flow_state | ordinal_position=3 | column_name=auth_code | data_type=text | udt_name=text | is_nullable=NO | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=flow_state | ordinal_position=4 | column_name=code_challenge_method | data_type=USER-DEFINED | udt_name=code_challenge_method | is_nullable=NO | column_default=null | is_identity=NO | identity_generation=null
- table_schema=auth | table_name=flow_state | ordinal_position=5 | column_name=code_challenge | data_type=text | udt_name=text | is_nullable=NO | column_default=null | is_identity=NO | identity_generation=null

... et 785 lignes supplémentaires

## 5. 5_Contraintes (PK, FK, UNIQUE, CHECK).csv

**Lignes:** 456
**Colonnes:** table_schema, table_name, constraint_name, constraint_type, column_name, foreign_table_schema, foreign_table_name, foreign_column_name

**Aperçu (10/456 lignes):**

- table_schema=auth | table_name=audit_log_entries | constraint_name=16494_16525_2_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=audit_log_entries | constraint_name=16494_16525_5_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=audit_log_entries | constraint_name=audit_log_entries_pkey | constraint_type=PRIMARY KEY | column_name=id | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_11_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_1_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_3_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_4_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_5_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=16494_16883_6_not_null | constraint_type=CHECK | column_name=null | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null
- table_schema=auth | table_name=flow_state | constraint_name=flow_state_pkey | constraint_type=PRIMARY KEY | column_name=id | foreign_table_schema=null | foreign_table_name=null | foreign_column_name=null

... et 446 lignes supplémentaires

## 6. 6_Index (y compris uniques + définition).csv

**Lignes:** 304
**Colonnes:** schema_name, table_name, index_name, is_unique, is_primary, index_def

**Aperçu (10/304 lignes):**

- schema_name=auth | table_name=audit_log_entries | index_name=audit_log_entries_pkey | is_unique=true | is_primary=true | index_def=CREATE UNIQUE INDEX audit_log_entries_pkey ON auth.audit_log_entries USING btree (id)
- schema_name=auth | table_name=audit_log_entries | index_name=audit_logs_instance_id_idx | is_unique=false | is_primary=false | index_def=CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id)
- schema_name=auth | table_name=flow_state | index_name=flow_state_created_at_idx | is_unique=false | is_primary=false | index_def=CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC)
- schema_name=auth | table_name=flow_state | index_name=flow_state_pkey | is_unique=true | is_primary=true | index_def=CREATE UNIQUE INDEX flow_state_pkey ON auth.flow_state USING btree (id)
- schema_name=auth | table_name=flow_state | index_name=idx_auth_code | is_unique=false | is_primary=false | index_def=CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code)
- schema_name=auth,flow_state,idx_user_id_auth_method,false,false,"CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method)"
- schema_name=auth | table_name=identities | index_name=identities_email_idx | is_unique=false | is_primary=false | index_def=CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops)
- schema_name=auth | table_name=identities | index_name=identities_pkey | is_unique=true | is_primary=true | index_def=CREATE UNIQUE INDEX identities_pkey ON auth.identities USING btree (id)
- schema_name=auth,identities,identities_provider_id_provider_unique,true,false,"CREATE UNIQUE INDEX identities_provider_id_provider_unique ON auth.identities USING btree (provider_id, provider)"
- schema_name=auth | table_name=identities | index_name=identities_user_id_idx | is_unique=false | is_primary=false | index_def=CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id)

... et 294 lignes supplémentaires

## 7. 7_RLS activé ou pas (par table).csv

**Lignes:** 51
**Colonnes:** schema_name, table_name, rls_enabled, rls_forced

**Aperçu (10/51 lignes):**

- schema_name=auth | table_name=audit_log_entries | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=flow_state | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=identities | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=instances | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=mfa_amr_claims | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=mfa_challenges | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=mfa_factors | rls_enabled=true | rls_forced=false
- schema_name=auth | table_name=oauth_authorizations | rls_enabled=false | rls_forced=false
- schema_name=auth | table_name=oauth_client_states | rls_enabled=false | rls_forced=false
- schema_name=auth | table_name=oauth_clients | rls_enabled=false | rls_forced=false

... et 41 lignes supplémentaires

## 8. 8_Policies RLS (LE plus important).csv

**Lignes:** 315
**Colonnes:** schemaname, tablename, policyname, permissive, roles, cmd, using_expression, with_check_expression

**Aperçu (10/315 lignes):**

- schemaname=public,abonnements,abonnements_admin_all,PERMISSIVE,{public},ALL,"(EXISTS ( SELECT 1
- schemaname=   FROM profiles
- schemaname=  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin_jtec'::user_role))))",null
- schemaname=public,abonnements,abonnements_select_admin,PERMISSIVE,{public},SELECT,"(EXISTS ( SELECT 1
- schemaname=   FROM profiles
- schemaname=  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin_jtec'::user_role))))",null
- schemaname=public,abonnements,abonnements_select_entreprise,PERMISSIVE,{public},SELECT,"(EXISTS ( SELECT 1
- schemaname=   FROM profiles
- schemaname=  WHERE ((profiles.id = auth.uid()) AND (profiles.entreprise_id = abonnements.entreprise_id))))",null
- schemaname=public,abonnements,abonnements_select_regie,PERMISSIVE,{public},SELECT,"(EXISTS ( SELECT 1

... et 305 lignes supplémentaires

## 9. 9_Fonctions_RPC (définitions complètes).csv

**Lignes:** 5961
**Colonnes:** schema, function_name, args, returns, language, security_definer, volatility, function_def;

**Aperçu (10/5961 lignes):**

- schema=auth,email,,text,sql,false,s,"CREATE OR REPLACE FUNCTION auth.email();
- schema= RETURNS text;
- schema= LANGUAGE sql;
- schema= STABLE;
- schema=AS $function$;
- schema=  select ;
- schema=  coalesce(;
- schema=    nullif(current_setting('request.jwt.claim.email' | function_name= true) | args= '') | returns=;
- schema=    (nullif(current_setting('request.jwt.claims' | function_name= true) | args= '')::jsonb ->> 'email');
- schema=  )::text;

... et 5951 lignes supplémentaires

## 10. 10_Triggers (et fonctions liées).csv

**Lignes:** 31
**Colonnes:** schema_name, table_name, trigger_name, trigger_def, function_name

**Aperçu (10/31 lignes):**

- schema_name=public | table_name=abonnements | trigger_name=trigger_abonnement_updated_at | trigger_def=CREATE TRIGGER trigger_abonnement_updated_at BEFORE UPDATE ON abonnements FOR EACH ROW EXECUTE FUNCTION update_abonnement_updated_at() | function_name=update_abonnement_updated_at
- schema_name=public | table_name=entreprises | trigger_name=set_updated_at_entreprises | trigger_def=CREATE TRIGGER set_updated_at_entreprises BEFORE UPDATE ON entreprises FOR EACH ROW EXECUTE FUNCTION handle_updated_at() | function_name=handle_updated_at
- schema_name=public | table_name=factures | trigger_name=facture_status_change_trigger | trigger_def=CREATE TRIGGER facture_status_change_trigger AFTER UPDATE ON factures FOR EACH ROW EXECUTE FUNCTION notify_facture_status_change() | function_name=notify_facture_status_change
- schema_name=public | table_name=factures | trigger_name=factures_updated_at | trigger_def=CREATE TRIGGER factures_updated_at BEFORE UPDATE ON factures FOR EACH ROW EXECUTE FUNCTION handle_updated_at() | function_name=handle_updated_at
- schema_name=public | table_name=immeubles | trigger_name=set_updated_at_immeubles | trigger_def=CREATE TRIGGER set_updated_at_immeubles BEFORE UPDATE ON immeubles FOR EACH ROW EXECUTE FUNCTION handle_updated_at() | function_name=handle_updated_at
- schema_name=public | table_name=locataires | trigger_name=set_updated_at_locataires | trigger_def=CREATE TRIGGER set_updated_at_locataires BEFORE UPDATE ON locataires FOR EACH ROW EXECUTE FUNCTION handle_updated_at() | function_name=handle_updated_at
- schema_name=public | table_name=logements | trigger_name=set_updated_at_logements | trigger_def=CREATE TRIGGER set_updated_at_logements BEFORE UPDATE ON logements FOR EACH ROW EXECUTE FUNCTION handle_updated_at() | function_name=handle_updated_at
- schema_name=public | table_name=missions | trigger_name=mission_status_change | trigger_def=CREATE TRIGGER mission_status_change AFTER UPDATE ON missions FOR EACH ROW WHEN (old.statut IS DISTINCT FROM new.statut) EXECUTE FUNCTION notify_mission_status_change() | function_name=notify_mission_status_change
- schema_name=public | table_name=missions | trigger_name=mission_status_change_notification | trigger_def=CREATE TRIGGER mission_status_change_notification AFTER UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION notify_mission_status_change_extended() | function_name=notify_mission_status_change_extended
- schema_name=public | table_name=missions | trigger_name=missions_updated_at | trigger_def=CREATE TRIGGER missions_updated_at BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_missions_updated_at() | function_name=update_missions_updated_at

... et 21 lignes supplémentaires

## 11. 11_Views (définition).csv

**Lignes:** 98
**Colonnes:** schemaname, viewname, definition;

**Aperçu (10/98 lignes):**

- schemaname=extensions,pg_stat_statements," SELECT userid,;
- schemaname=    dbid | viewname=;
- schemaname=    toplevel | viewname=;
- schemaname=    queryid | viewname=;
- schemaname=    query | viewname=;
- schemaname=    plans | viewname=;
- schemaname=    total_plan_time | viewname=;
- schemaname=    min_plan_time | viewname=;
- schemaname=    max_plan_time | viewname=;
- schemaname=    mean_plan_time | viewname=;

... et 88 lignes supplémentaires

## 13. 13_Séquences.csv

**Lignes:** 2
**Colonnes:** sequence_schema, sequence_name, data_type, start_value, minimum_value, maximum_value, increment, cycle_option

**Contenu complet:**

- sequence_schema=auth | sequence_name=refresh_tokens_id_seq | data_type=bigint | start_value=1 | minimum_value=1 | maximum_value=9223372036854775807 | increment=1 | cycle_option=NO
- sequence_schema=graphql | sequence_name=seq_schema_version | data_type=integer | start_value=1 | minimum_value=1 | maximum_value=2147483647 | increment=1 | cycle_option=YES

## 14. 14_Privilèges sur tables (qui a quoi).csv

**Lignes:** 1370
**Colonnes:** grantee, table_schema, table_name, privilege_type

**Aperçu (10/1370 lignes):**

- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=DELETE
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=INSERT
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=REFERENCES
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=SELECT
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=TRIGGER
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=TRUNCATE
- grantee=postgres | table_schema=auth | table_name=audit_log_entries | privilege_type=UPDATE
- grantee=postgres | table_schema=auth | table_name=flow_state | privilege_type=DELETE
- grantee=postgres | table_schema=auth | table_name=flow_state | privilege_type=INSERT
- grantee=postgres | table_schema=auth | table_name=flow_state | privilege_type=REFERENCES

... et 1360 lignes supplémentaires

## 15. 15_Privilèges sur fonctions.csv

**Lignes:** 1546
**Colonnes:** grantee, routine_schema, routine_name, privilege_type

**Aperçu (10/1546 lignes):**

- grantee=PUBLIC | routine_schema=auth | routine_name=email | privilege_type=EXECUTE
- grantee=PUBLIC | routine_schema=auth | routine_name=jwt | privilege_type=EXECUTE
- grantee=postgres | routine_schema=auth | routine_name=jwt | privilege_type=EXECUTE
- grantee=PUBLIC | routine_schema=auth | routine_name=role | privilege_type=EXECUTE
- grantee=PUBLIC | routine_schema=auth | routine_name=uid | privilege_type=EXECUTE
- grantee=PUBLIC | routine_schema=extensions | routine_name=armor | privilege_type=EXECUTE
- grantee=PUBLIC | routine_schema=extensions | routine_name=armor | privilege_type=EXECUTE
- grantee=dashboard_user | routine_schema=extensions | routine_name=armor | privilege_type=EXECUTE
- grantee=dashboard_user | routine_schema=extensions | routine_name=armor | privilege_type=EXECUTE
- grantee=postgres | routine_schema=extensions | routine_name=armor | privilege_type=EXECUTE

... et 1536 lignes supplémentaires
