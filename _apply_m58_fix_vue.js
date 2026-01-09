// ============================================================
// APPLICATION M58 - Fix Vue tickets_visibles_entreprise
// ============================================================
// Date: 2026-01-09
// Objectif: Corriger vue pour tickets publics entreprise
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyM58() {
  console.log('🚀 APPLICATION MIGRATION M58\n');
  console.log('Objectif: Corriger vue tickets_visibles_entreprise\n');
  console.log('Bug: Vue filtre statut=ouvert mais tickets diffusés sont en_attente\n');
  console.log('='.repeat(60) + '\n');

  // ============================================================
  // 1. VÉRIFIER SI M58 DÉJÀ APPLIQUÉE
  // ============================================================
  console.log('1️⃣ Vérification état actuel...\n');
  
  const { data: existing } = await supabaseAdmin
    .from('supabase_migrations')
    .select('*')
    .eq('name', '20260109010003_m58_fix_vue_tickets_entreprise.sql')
    .maybeSingle();

  if (existing) {
    console.log('⚠️ M58 déjà appliquée le:', existing.executed_at);
    console.log('   Utiliser le rollback si nécessaire\n');
    return;
  }

  // ============================================================
  // 2. AFFICHER INSTRUCTIONS MANUELLES
  // ============================================================
  console.log('2️⃣ Migration à appliquer MANUELLEMENT\n');
  console.log('⚠️ La vue ne peut pas être modifiée via l\'API JavaScript\n');
  console.log('📋 PROCÉDURE:\n');
  console.log('1. Ouvrir Supabase Dashboard → SQL Editor');
  console.log('2. Ouvrir le fichier:');
  console.log('   supabase/migrations/20260109010003_m58_fix_vue_tickets_entreprise.sql\n');
  console.log('3. Copier TOUT le contenu du fichier');
  console.log('4. Coller dans SQL Editor');
  console.log('5. Cliquer RUN\n');
  console.log('6. Vérifier le message: ✅ M58: Vue tickets_visibles_entreprise corrigée\n');
  
  // ============================================================
  // 3. DIAGNOSTIC ACTUEL
  // ============================================================
  console.log('3️⃣ Diagnostic situation actuelle\n');

  // Tickets en attente
  const { data: ticketsEnAttente } = await supabaseAdmin
    .from('tickets')
    .select('id, titre, statut, mode_diffusion')
    .eq('mode_diffusion', 'general')
    .eq('statut', 'en_attente')
    .is('locked_at', null);

  console.log(`📊 Tickets publics (statut=en_attente): ${ticketsEnAttente?.length || 0}`);

  // Tickets ouverts (bug vue)
  const { data: ticketsOuverts } = await supabaseAdmin
    .from('tickets')
    .select('id, titre, statut, mode_diffusion')
    .eq('mode_diffusion', 'general')
    .eq('statut', 'ouvert')
    .is('locked_at', null);

  console.log(`📊 Tickets publics (statut=ouvert): ${ticketsOuverts?.length || 0}`);
  console.log('');

  if (ticketsEnAttente && ticketsEnAttente.length > 0 && (!ticketsOuverts || ticketsOuverts.length === 0)) {
    console.log('✅ Situation confirmée: Tickets en statut en_attente (pas ouvert)');
    console.log('   → La vue actuelle retourne 0 résultat (filtre sur ouvert)');
    console.log('   → M58 corrigera ce filtre pour en_attente\n');
  }

  // Entreprises concernées
  const { data: entreprises } = await supabaseAdmin
    .from('regies_entreprises')
    .select('entreprise_id, regie_id, mode_diffusion')
    .eq('mode_diffusion', 'general');

  console.log(`📊 Entreprises en mode general: ${entreprises?.length || 0}`);
  if (entreprises && entreprises.length > 0) {
    console.log('   Ces entreprises DEVRAIENT voir les tickets publics après M58\n');
  }

  // ============================================================
  // 4. TESTS POST-MIGRATION
  // ============================================================
  console.log('4️⃣ Tests à effectuer APRÈS application M58\n');
  console.log('A) Connexion entreprise en mode "general"');
  console.log('   → Onglet "Tickets disponibles"');
  console.log('   → DEVRAIT afficher les tickets (si liaison régie OK)\n');
  
  console.log('B) Connexion entreprise en mode "restreint"');
  console.log('   → Onglet "Tickets disponibles"');
  console.log('   → DEVRAIT être vide (sauf tickets assignés)\n');
  
  console.log('C) Vérification DB directe:');
  console.log('   SELECT COUNT(*) FROM tickets_visibles_entreprise');
  console.log('   WHERE visible_par_entreprise_id = \'<UUID_ENTREPRISE>\'');
  console.log('   AND statut = \'en_attente\';');
  console.log('   → Devrait retourner > 0 si mode=general\n');

  console.log('='.repeat(60));
  console.log('⚠️ APPLIQUER M58 MAINTENANT DANS SUPABASE SQL EDITOR');
  console.log('='.repeat(60) + '\n');
}

applyM58().catch(console.error);
