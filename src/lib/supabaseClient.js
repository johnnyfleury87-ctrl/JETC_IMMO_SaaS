/**
 * ======================================================
 * CLIENT SUPABASE FRONTEND
 * ======================================================
 * 
 * 🎯 OBJECTIF :
 * Client Supabase pour le navigateur (frontend)
 * 
 * 🔐 SÉCURITÉ :
 * - Utilise UNIQUEMENT la clé ANON (publique)
 * - Ne JAMAIS utiliser SUPABASE_SERVICE_ROLE_KEY ici
 * - Ce client est exposé au navigateur
 * - Toutes les opérations sont protégées par les Row Level Security (RLS)
 * 
 * 📍 VARIABLES D'ENVIRONNEMENT REQUISES :
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY : Clé publique (obligatoire)
 * - SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL : URL du projet
 * 
 * ⚠️ RÈGLES STRICTES :
 * - Toute modification de données doit respecter les RLS
 * - Les opérations admin passent par les routes /api/* backend
 * - Aucun bypass RLS possible depuis ce client
 * 
 * 📚 Documentation : https://supabase.com/docs/reference/javascript
 * ======================================================
 */

import { createClient } from '@supabase/supabase-js';

// ======================================================
// CONFIGURATION - Lecture variables d'environnement
// ======================================================

// 1️⃣ URL du projet Supabase
// Fallback : SUPABASE_URL si NEXT_PUBLIC_SUPABASE_URL absent
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

// 2️⃣ Clé publique ANON (exposée au navigateur)
// ✅ Cette clé est publique et protégée par RLS
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
