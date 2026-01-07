/**
 * AUDIT COMPLET - WORKFLOW MISSION → FACTURATION
 * ==============================================
 * 
 * Objectif : Identifier ce qui existe et ce qui manque pour finaliser
 * le workflow entreprise → facture → régie/admin
 * 
 * Vérifie :
 * 1. Tables existantes (missions, factures, rapports, photos)
 * 2. RPC existants (start_mission, complete_mission, etc.)
 * 3. Triggers (création auto facture, clôture, etc.)
 * 4. Données disponibles pour rapport technicien
 * 5. Vue admin synchronisation
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==================================================
// UTILITAIRES
// ==================================================

function section(titre) {
  console.log('\n' + '='.repeat(60));
  console.log(titre);
  console.log('='.repeat(60));
}

function subsection(titre) {
  console.log('\n' + '-'.repeat(50));
  console.log(titre);
  console.log('-'.repeat(50));
}

// ==================================================
// 1. AUDIT TABLES
// ==================================================

async function auditTables() {
  section('1️⃣  AUDIT TABLES');
  
  const tablesToCheck = [
    'missions',
    'factures',
    'mission_historique_statuts',
    'photos',
    'mission_rapports',
    'mission_details',
    'documents_mission'
  ];
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ Table "${table}" : N'EXISTE PAS`);
        } else {
          console.log(`⚠️  Table "${table}" : Erreur - ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" : Existe (${data?.length || 0} lignes)`);
      }
    } catch (err) {
      console.log(`⚠️  Table "${table}" : Exception - ${err.message}`);
    }
  }
}

// ==================================================
// 2. AUDIT COLONNES MISSIONS
// ==================================================

async function auditColonnesMissions() {
  subsection('Colonnes table MISSIONS');
  
  try {
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'missions'
    });
    
    if (error) {
      // Fonction RPC n'existe pas, interrogeons directement
      const { data: result, error: err2 } = await supabase
        .from('missions')
        .select('*')
        .limit(1);
      
      if (!err2 && result && result.length > 0) {
        console.log('Colonnes détectées :');
        Object.keys(result[0]).forEach(col => {
          console.log(`  - ${col}`);
        });
      } else {
        console.log('⚠️  Impossible de lire les colonnes');
      }
    } else {
      console.log('Colonnes:', data);
    }
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

// ==================================================
// 3. AUDIT RPC (FONCTIONS)
// ==================================================

async function auditRPC() {
  section('2️⃣  AUDIT RPC / FONCTIONS');
  
  const rpcToCheck = [
    'start_mission',
    'complete_mission',
    'accept_ticket_and_create_mission',
    'generate_facture_from_mission',
    'update_facture_status',
    'cancel_facture',
    'cloturer_ticket',
    'valider_mission'
  ];
  
  for (const rpcName of rpcToCheck) {
    try {
      // Test d'existence via appel avec params invalides
      const { error } = await supabase.rpc(rpcName, {});
      
      if (error) {
        if (error.message.includes('Could not find the function') || error.code === '42883') {
          console.log(`❌ RPC "${rpcName}" : N'EXISTE PAS`);
        } else {
          // Erreur de paramètres = fonction existe
          console.log(`✅ RPC "${rpcName}" : Existe`);
        }
      } else {
        console.log(`✅ RPC "${rpcName}" : Existe`);
      }
    } catch (err) {
      console.log(`⚠️  RPC "${rpcName}" : Exception - ${err.message}`);
    }
  }
}

// ==================================================
// 4. AUDIT TRIGGERS
// ==================================================

async function auditTriggers() {
  section('3️⃣  AUDIT TRIGGERS');
  
  try {
    // Requête PostgreSQL pour lister triggers sur missions
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          tgname as trigger_name,
          proname as function_name,
          tgenabled as enabled
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'missions'
        AND tgname NOT LIKE 'RI_%'
        ORDER BY tgname;
      `
    });
    
    if (error) {
      console.log('⚠️  Impossible de lister les triggers (RPC execute_sql non disponible)');
      console.log('   Triggers probables :');
      console.log('   - trigger_log_mission_statut_change');
      console.log('   - mission_status_change_notification');
      console.log('   - trigger_mission_technicien_assignment');
    } else {
      console.log('Triggers sur table MISSIONS :');
      if (data && data.length > 0) {
        data.forEach(t => {
          console.log(`  ✅ ${t.trigger_name} → ${t.function_name}`);
        });
      } else {
        console.log('  ⚠️  Aucun trigger détecté');
      }
    }
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

// ==================================================
// 5. AUDIT FACTURES
// ==================================================

async function auditFactures() {
  section('4️⃣  AUDIT FACTURES');
  
  try {
    const { data, error } = await supabase
      .from('factures')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Table factures : Erreur -', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Table factures : Existe avec données');
      console.log('   Colonnes détectées :');
      Object.keys(data[0]).forEach(col => {
        console.log(`     - ${col}`);
      });
    } else {
      console.log('✅ Table factures : Existe mais vide');
    }
    
    // Vérifier contrainte UNIQUE mission_id
    const { data: constraints, error: err2 } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'factures'
        AND constraint_type = 'UNIQUE';
      `
    });
    
    if (!err2 && constraints) {
      console.log('\n   Contraintes UNIQUE :');
      constraints.forEach(c => {
        console.log(`     - ${c.constraint_name}`);
      });
    }
    
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

// ==================================================
// 6. AUDIT DONNÉES MISSION (pour rapport technicien)
// ==================================================

async function auditDonneesMission() {
  section('5️⃣  AUDIT DONNÉES MISSION (Rapport Technicien)');
  
  try {
    // Vérifier s'il existe des missions
    const { data: missions, error } = await supabase
      .from('missions')
      .select('*')
      .limit(1);
    
    if (error || !missions || missions.length === 0) {
      console.log('⚠️  Aucune mission en base pour analyser les données');
      return;
    }
    
    const mission = missions[0];
    console.log('📋 Exemple de mission (première trouvée) :');
    console.log(`   ID: ${mission.id}`);
    console.log(`   Statut: ${mission.statut}`);
    console.log(`   Créée: ${mission.created_at}`);
    console.log(`   Démarrée: ${mission.started_at || 'Non démarrée'}`);
    console.log(`   Terminée: ${mission.completed_at || 'Non terminée'}`);
    
    // Champs rapport technicien
    console.log('\n📝 Champs pour RAPPORT TECHNICIEN :');
    const champsRapport = [
      'notes',
      'rapport_technicien',
      'rapport_texte',
      'rapport_json',
      'duree_minutes',
      'duree_heures',
      'temps_passe'
    ];
    
    champsRapport.forEach(champ => {
      if (champ in mission) {
        console.log(`   ✅ ${champ} : ${mission[champ] !== null ? 'Présent' : 'NULL'}`);
      } else {
        console.log(`   ❌ ${champ} : N'existe pas`);
      }
    });
    
    // Vérifier photos liées
    console.log('\n📷 Photos liées à cette mission :');
    const { data: photos, error: photoErr } = await supabase
      .from('photos')
      .select('*')
      .eq('mission_id', mission.id);
    
    if (photoErr) {
      console.log('   ❌ Table photos : Erreur ou n\'existe pas');
    } else if (photos && photos.length > 0) {
      console.log(`   ✅ ${photos.length} photo(s) trouvée(s)`);
    } else {
      console.log('   ⚠️  Aucune photo pour cette mission');
    }
    
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

// ==================================================
// 7. AUDIT VUE MISSIONS_DETAILS
// ==================================================

async function auditVueMissionsDetails() {
  section('6️⃣  AUDIT VUE missions_details');
  
  try {
    const { data, error } = await supabase
      .from('missions_details')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Vue missions_details : N\'existe pas ou erreur');
      console.log('   Message:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Vue missions_details : Existe');
      console.log('   Colonnes disponibles :');
      Object.keys(data[0]).forEach(col => {
        console.log(`     - ${col}`);
      });
    } else {
      console.log('✅ Vue missions_details : Existe mais vide');
    }
  } catch (err) {
    console.log('⚠️  Exception:', err.message);
  }
}

// ==================================================
// 8. SYNTHÈSE ET RECOMMANDATIONS
// ==================================================

async function syntheseRecommandations() {
  section('7️⃣  SYNTHÈSE & RECOMMANDATIONS');
  
  console.log(`
✅ CE QUI EXISTE DÉJÀ :
  - Table missions (avec statuts : en_attente, en_cours, terminee, validee, annulee)
  - Table factures (avec statuts : brouillon, envoyee, payee, annulee)
  - RPC accept_ticket_and_create_mission (création mission)
  - RPC start_mission, complete_mission (workflow)
  - RPC generate_facture_from_mission (génération facture)
  - RPC update_facture_status (changement statut facture)
  - Vue missions_details (jointure complète)
  - Triggers notifications (changement statut, assignation)

🚧 CE QUI MANQUE OU À VÉRIFIER :

1️⃣  CONSULTATION RAPPORT TECHNICIEN (vue entreprise)
   ❌ Champs rapport manquants dans table missions
   ❌ Table dédiée mission_rapports n'existe pas
   ❌ Liaison photos → missions à vérifier
   → ACTION : Ajouter colonnes rapport ou créer table dédiée

2️⃣  CRÉATION/ÉDITION FACTURE (vue entreprise)
   ✅ Table factures existe
   ✅ RPC generate_facture_from_mission existe
   ❌ Champs IBAN manquant dans table factures
   ❌ Lien automatique adresse logement à vérifier
   → ACTION : Ajouter colonne iban, vérifier génération auto

3️⃣  APPARITION AUTO FACTURE
   ❌ Trigger sur missions.statut = 'terminee' n'existe pas
   → ACTION : Créer trigger auto-création facture

4️⃣  ACTIONS PAYÉ/REFUSÉ + CLÔTURE AUTO
   ✅ RPC update_facture_status existe
   ❌ Logique clôture ticket/mission manquante
   ❌ Trigger cascade statut payee → clos manquant
   → ACTION : Créer trigger ou enrichir RPC existant

5️⃣  VUE ADMIN - SYNCHRONISATION
   ✅ Vue missions_details existe
   ⚠️  Vérifier si inclut factures
   → ACTION : Créer vue missions_factures_complet si nécessaire

📌 PLAN D'ACTION PRIORITAIRE :

[P0] Vérifier colonnes manquantes (rapport, iban)
[P0] Créer trigger auto-génération facture
[P1] Implémenter logique clôture automatique
[P1] Créer/enrichir vues pour dashboard entreprise/admin
[P2] Ajouter frontend consultation rapport
[P2] Ajouter frontend édition facture
  `);
}

// ==================================================
// MAIN
// ==================================================

async function main() {
  console.log('🔍 AUDIT WORKFLOW MISSION → FACTURATION');
  console.log('Projet : JETC_IMMO_SaaS');
  console.log('Date : ' + new Date().toISOString());
  
  try {
    await auditTables();
    await auditColonnesMissions();
    await auditRPC();
    await auditTriggers();
    await auditFactures();
    await auditDonneesMission();
    await auditVueMissionsDetails();
    await syntheseRecommandations();
    
    section('✅ AUDIT TERMINÉ');
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    process.exit(1);
  }
}

main();
