/**
 * CLIENT SUPABASE FRONTEND
 * 
 * ⚠️ RÈGLES STRICTES :
 * - Utilise UNIQUEMENT la clé ANON (publique)
 * - Ne JAMAIS utiliser la service_role_key ici
 * - Ce client est exposé au navigateur
 * - Toutes les opérations sensibles passent par les RLS
 */

import { createClient } from '@supabase/supabase-js';

// Vérification des variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE CLIENT] Variables d\'environnement manquantes');
  throw new Error('Configuration Supabase incomplète. Vérifier SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Création du client Supabase pour le frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

/**
 * Récupère l'utilisateur actuellement connecté
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('[SUPABASE CLIENT] Erreur récupération utilisateur:', error);
      return { user: null, error };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('[SUPABASE CLIENT] Exception:', error);
    return { user: null, error };
  }
}

/**
 * Vérifie si l'utilisateur est en MODE DEMO
 * @returns {boolean}
 */
export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('jetc_demo_mode') === 'true';
}

console.log('[SUPABASE CLIENT] Client frontend initialisé');
