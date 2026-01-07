/**
 * FIX FINAL: Créer technicien dans l'entreprise et assigner la mission
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function finalFix() {
  console.log('[FIX] CRÉATION TECHNICIEN DANS ENTREPRISE + ASSIGNATION\n');
  
  try {
    const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
    const entrepriseId = '6ff210bc-9985-457c-8851-4185123edb07';
    const email = 'demo.technicien@test.app';
    const password = 'Demo1234!';
    
    // 1. Récupérer le user créé précédemment ou en créer un nouveau
    console.log('=== ÉTAPE 1: Compte auth ===');
    const { data: users } = await supabase.auth.admin.listUsers();
    let user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('Création nouveau compte...');
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      
      if (authError) {
        console.error('❌ Erreur auth:', authError.message);
        return;
      }
      
      user = newUser.user;
    }
    
    console.log('✅ User:', user.email);
    console.log('   ID:', user.id);
    console.log('');
    
    // 2. MAJ profile avec entreprise_id
    console.log('=== ÉTAPE 2: Profile avec entreprise ===');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: email,
        role: 'technicien',
        entreprise_id: entrepriseId
      });
    
    if (profileError) {
      console.error('❌ Erreur profile:', profileError.message);
      return;
    }
    
    console.log('✅ Profile MAJ avec entreprise_id');
    console.log('');
    
    // 3. Assigner la mission
    console.log('=== ÉTAPE 3: Assignation mission ===');
    const { error: updateError } = await supabase
      .from('missions')
      .update({ technicien_id: user.id })
      .eq('id', missionId);
    
    if (updateError) {
      console.error('❌ Erreur assignation:', updateError.message);
      console.log('Détails:', updateError);
      return;
    }
    
    console.log('✅ Mission assignée!');
    console.log('');
    
    // 4. Vérification finale
    console.log('=== ÉTAPE 4: Vérification ===');
    const { data: verif } = await supabase
      .from('missions')
      .select(`
        id,
        technicien_id,
        statut,
        ticket:tickets(categorie, sous_categorie),
        profiles!missions_technicien_id_fkey(email, role)
      `)
      .eq('id', missionId)
      .single();
    
    if (verif.profiles) {
      console.log('✅ Mission vérifiée:');
      console.log('   Technicien:', verif.profiles.email);
      console.log('   Statut:', verif.statut);
      console.log('   Intervention:', verif.ticket?.categorie, '-', verif.ticket?.sous_categorie);
      console.log('');
      console.log('========== SUCCESS ==========');
      console.log('');
      console.log('🧪 TESTER MAINTENANT:');
      console.log('');
      console.log('   URL: http://localhost:3001/technicien/dashboard.html');
      console.log('   Email:', email);
      console.log('   Password:', password);
      console.log('');
      console.log('✅ La mission devrait s\'afficher avec:');
      console.log('   - Catégorie: Plomberie - Fuite d\'eau');
      console.log('   - Locataire: Lesage Pauline - 0698544232');
      console.log('   - Adresse: 12 Rue Victor Hugo, 1004 Lausanne');
      console.log('   - Code: 1234A');
    } else {
      console.log('⚠️ Relation profiles non trouvée dans la vérif');
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

finalFix();
