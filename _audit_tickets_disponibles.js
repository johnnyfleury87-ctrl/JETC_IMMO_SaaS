// ============================================================
// AUDIT DIAGNOSTIC - Tickets publics invisibles entreprise
// ============================================================
// Date: 2026-01-09
// Objectif: Vérifier DB + RLS pour tickets mode 'general'
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditTicketsDisponibles() {
  console.log('🔍 AUDIT TICKETS PUBLICS ENTREPRISE\n');

  // ============================================================
  // 1. VÉRIFICATION TICKETS PUBLICS
  // ============================================================
  console.log('1️⃣ TICKETS EN MODE "GENERAL" DISPONIBLES\n');
  
  const { data: ticketsPublics, error: errTickets } = await supabaseAdmin
    .from('tickets')
    .select('id, titre, statut, mode_diffusion, locked_at, regie_id')
    .eq('mode_diffusion', 'general')
    .eq('statut', 'en_attente')
    .is('locked_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  // Récupérer les noms de régies séparément
  const regieIds = [...new Set(ticketsPublics?.map(t => t.regie_id).filter(Boolean) || [])];
  const regiesMap = {};
  for (const regieId of regieIds) {
    const { data: regie } = await supabaseAdmin
      .from('profiles')
      .select('id, nom_entreprise')
      .eq('id', regieId)
      .eq('role', 'regie')
      .maybeSingle();
    if (regie) regiesMap[regieId] = regie.nom_entreprise || 'Sans nom';
  }

  if (errTickets) {
    console.error('❌ Erreur lecture tickets:', errTickets);
  } else {
    console.log(`✅ Trouvé ${ticketsPublics?.length || 0} ticket(s) public(s)\n`);
    ticketsPublics?.forEach(t => {
      console.log(`📋 Ticket: ${t.id}`);
      console.log(`   Titre: ${t.titre}`);
      console.log(`   Statut: ${t.statut}`);
      console.log(`   Mode: ${t.mode_diffusion}`);
      console.log(`   Locked: ${t.locked_at || 'Non'}`);
      console.log(`   Régie: ${regiesMap[t.regie_id] || 'Inconnue'} (${t.regie_id})`);
      console.log('');
    });
  }

  // ============================================================
  // 2. VÉRIFICATION ENTREPRISES + LIAISONS
  // ============================================================
  console.log('2️⃣ ENTREPRISES + LIAISONS RÉGIE\n');
  
  const { data: entreprises, error: errEntreprises } = await supabaseAdmin
    .from('entreprises')
    .select('id, nom')
    .order('created_at', { ascending: false })
    .limit(5);
  
  // Récupérer les profiles séparément
  const entreprisesWithProfiles = [];
  for (const e of entreprises || []) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', e.id)
      .maybeSingle();
    entreprisesWithProfiles.push({ ...e, profile });
  }

  if (errEntreprises) {
    console.error('❌ Erreur lecture entreprises:', errEntreprises);
  } else {
    console.log(`✅ Trouvé ${entreprisesWithProfiles?.length || 0} entreprise(s)\n`);
    for (const e of entreprisesWithProfiles || []) {
      console.log(`🏢 Entreprise: ${e.nom} (${e.id})`);
      console.log(`   Profile: ${e.profile?.email} (${e.profile?.id})`);
      
      // Vérifier liaison regies_entreprises
      const { data: liaison, error: errLiaison } = await supabaseAdmin
        .from('regies_entreprises')
        .select('*')
        .eq('entreprise_id', e.id);

      if (errLiaison) {
        console.error('   ❌ Erreur lecture liaison:', errLiaison);
      } else if (!liaison || liaison.length === 0) {
        console.log('   ⚠️ AUCUNE liaison dans regies_entreprises');
      } else {
        console.log(`   ✅ ${liaison.length} liaison(s) regies_entreprises:`);
        liaison.forEach(l => {
          console.log(`      - Régie: ${l.regie_id}`);
          console.log(`        Mode: ${l.mode_diffusion || 'non défini'}`);
          console.log(`        Statut: ${l.statut || 'actif'}`);
        });
      }
      console.log('');
    }
  }

  // ============================================================
  // 3. VÉRIFICATION POLICIES RLS
  // ============================================================
  console.log('3️⃣ POLICIES RLS SUR TABLE TICKETS\n');
  
  try {
    const { data: policies, error: errPolicies } = await supabaseAdmin
      .from('pg_policies')
      .select('schemaname, tablename, policyname, cmd, qual')
      .eq('tablename', 'tickets')
      .ilike('policyname', '%entreprise%')
      .order('policyname');

    if (errPolicies) {
      console.error('❌ Erreur lecture policies:', errPolicies);
    } else if (!policies || policies.length === 0) {
      console.log('⚠️ AUCUNE policy RLS trouvée pour entreprises sur tickets');
    } else {
      console.log(`✅ Trouvé ${policies.length} policy/ies:\n`);
      policies.forEach(p => {
        console.log(`📋 Policy: ${p.policyname}`);
        console.log(`   Command: ${p.cmd}`);
        console.log(`   Using: ${p.qual?.substring(0, 200)}...`);
        console.log('');
      });
    }
  } catch (err) {
    console.log('⚠️ Impossible de lire pg_policies (permissions insuffisantes)');
    console.log('   Vérification manuelle nécessaire dans Supabase Dashboard');
  }

  // ============================================================
  // 4. TEST SIMULATION ENTREPRISE
  // ============================================================
  console.log('4️⃣ SIMULATION REQUÊTE ENTREPRISE\n');
  
  if (entreprisesWithProfiles && entreprisesWithProfiles.length > 0) {
    const testEntreprise = entreprisesWithProfiles[0];
    console.log(`Test avec: ${testEntreprise.nom} (${testEntreprise.id})`);
    console.log(`Profile: ${testEntreprise.profile?.id}\n`);

    // Trouver les tickets que cette entreprise DEVRAIT voir
    const { data: ticketsAttendus, error: errAttendus } = await supabaseAdmin
      .from('tickets')
      .select('id, titre, mode_diffusion, statut, regie_id')
      .eq('mode_diffusion', 'general')
      .eq('statut', 'en_attente')
      .is('locked_at', null);

    console.log(`📊 Tickets publics totaux: ${ticketsAttendus?.length || 0}`);

    // Vérifier liaison
    const { data: liaisonTest } = await supabaseAdmin
      .from('regies_entreprises')
      .select('*')
      .eq('entreprise_id', testEntreprise.id);

    console.log(`📊 Liaison(s) regies_entreprises: ${liaisonTest?.length || 0}`);
    if (liaisonTest && liaisonTest.length > 0) {
      liaisonTest.forEach(l => {
        console.log(`   - Régie: ${l.regie_id}`);
        console.log(`     Mode diffusion: ${l.mode_diffusion || 'NON DÉFINI'}`);
        console.log(`     Statut: ${l.statut || 'actif'}`);
      });
      
      // Filtrer tickets de ces régies
      const regieIdsAutorisees = liaisonTest.map(l => l.regie_id);
      const ticketsAccessibles = ticketsAttendus?.filter(t => 
        regieIdsAutorisees.includes(t.regie_id)
      );
      console.log(`📊 Tickets accessibles (de régies autorisées): ${ticketsAccessibles?.length || 0}`);
    }
  }

  // ============================================================
  // 5. DIAGNOSTIC FINAL
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNOSTIC');
  console.log('='.repeat(60) + '\n');

  const diagnostics = [];

  if (!ticketsPublics || ticketsPublics.length === 0) {
    diagnostics.push('⚠️ Aucun ticket public disponible (normal si régie n\'a pas publié)');
  } else {
    diagnostics.push(`✅ ${ticketsPublics.length} ticket(s) public(s) en base`);
  }

  if (!entreprisesWithProfiles || entreprisesWithProfiles.length === 0) {
    diagnostics.push('❌ Aucune entreprise trouvée');
  } else {
    diagnostics.push(`✅ ${entreprisesWithProfiles.length} entreprise(s) en base`);
    
    // Vérifier liaisons
    let hasLiaison = false;
    for (const e of entreprisesWithProfiles || []) {
      const { data: l } = await supabaseAdmin
        .from('regies_entreprises')
        .select('*')
        .eq('entreprise_id', e.id);
      if (l && l.length > 0) {
        hasLiaison = true;
        break;
      }
    }
    if (!hasLiaison) {
      diagnostics.push('❌ AUCUNE liaison regies_entreprises trouvée');
    } else {
      diagnostics.push('✅ Liaisons regies_entreprises existent');
    }
  }

  diagnostics.forEach(d => console.log(d));

  console.log('\n' + '='.repeat(60) + '\n');
}

auditTicketsDisponibles().catch(console.error);
