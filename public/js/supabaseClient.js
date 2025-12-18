/**
 * ======================================================
 * CLIENT SUPABASE FRONTEND (BROWSER)
 * ======================================================
 * Version browser-compatible (pas de module ES6)
 * Charge depuis CDN et expose `window.supabase`
 * ======================================================
 */

(function() {
  'use strict';

  // Configuration hardcodée (à remplacer par variables d'environnement Vercel)
  const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

  // Vérification
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[SUPABASE] Configuration manquante');
    return;
  }

  // Attendre que Supabase CDN soit chargé
  function initSupabase() {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      console.log('[SUPABASE] CDN chargé, création du client...');
      
      // Créer le client Supabase
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      
      console.log('[SUPABASE] Client initialisé ✅');
    } else {
      console.error('[SUPABASE] CDN non chargé, supabase.createClient introuvable');
    }
  }

  // Exécuter après le chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();
