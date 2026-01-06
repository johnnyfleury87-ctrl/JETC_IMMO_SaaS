// Script pour vérifier les policies RLS en production
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log('🔍 VÉRIFICATION POLICIES RLS EN PRODUCTION\n');
  
  // Requête directe pour lire pg_policies
  const query = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles::text[],
      cmd,
      qual::text as using_clause,
      with_check::text as with_check_clause
    FROM pg_policies
    WHERE tablename IN ('missions', 'techniciens')
    ORDER BY tablename, policyname;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql_query', { 
      query_text: query 
    });
    
    if (error && error.message.includes('does not exist')) {
      // Créer fonction temporaire
      console.log('📝 Création fonction temporaire...');
      
      const createFn = `
        CREATE OR REPLACE FUNCTION exec_sql_query(query_text text)
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          result jsonb;
        BEGIN
          EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t'
          INTO result;
          RETURN result;
        END;
        $$;
      `;
      
      const { error: createError } = await supabase.rpc('exec', { 
        statement: createFn 
      });
      
      if (createError) {
        console.log('❌ Impossible de créer fonction:', createError.message);
        console.log('\n💡 SOLUTION MANUELLE:');
        console.log('   1. Aller sur Dashboard Supabase');
        console.log('   2. SQL Editor');
        console.log('   3. Exécuter:');
        console.log('');
        console.log(query);
        return;
      }
      
      // Réessayer
      const { data: data2, error: error2 } = await supabase.rpc('exec_sql_query', { 
        query_text: query 
      });
      
      if (error2) {
        console.log('❌ Erreur:', error2.message);
        return;
      }
      
      console.log('✅ Policies trouvées:\n');
      console.log(JSON.stringify(data2, null, 2));
      
    } else if (error) {
      console.log('❌ Erreur:', error.message);
      console.log('   Code:', error.code);
    } else {
      console.log('✅ Policies trouvées:\n');
      console.log(JSON.stringify(data, null, 2));
    }
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
    console.log('\n💡 La commande suivante doit être exécutée manuellement dans Dashboard Supabase:');
    console.log('');
    console.log(query);
  }
}

checkPolicies().catch(console.error);
