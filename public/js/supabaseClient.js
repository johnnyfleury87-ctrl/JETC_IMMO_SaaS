/**
 * ======================================================
 * CLIENT SUPABASE FRONTEND (BROWSER)
 * ======================================================
 * Version browser-compatible (pas de module ES6)
 * Initialise le client depuis le CDN Supabase
 * ======================================================
 */

(function() {
  'use strict';

  // Configuration
  const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

  // Vérification config
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[SUPABASE] ❌ Configuration manquante');
    return;
  }

  console.log('[SUPABASE] Configuration détectée');

  // Initialisation du client
  function initSupabase() {
    // Vérifier que le CDN a chargé la bibliothèque
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      console.error('[SUPABASE] ❌ CDN non chargé - window.supabase.createClient introuvable');
      console.error('[SUPABASE] Assurez-vous que le script CDN est présent AVANT supabaseClient.js');
      return;
    }

    console.log('[SUPABASE] ✅ CDN détecté, création du client...');

    try {
      // Créer l'instance du client Supabase
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });

      // Remplacer window.supabase par l'instance du client
      window.supabase = client;

      console.log('[SUPABASE] ✅ Client initialisé avec succès');
      console.log('[SUPABASE] Type:', typeof window.supabase);
      console.log('[SUPABASE] Méthodes disponibles:', Object.keys(window.supabase).slice(0, 5));

    } catch (error) {
      console.error('[SUPABASE] ❌ Erreur lors de la création du client:', error);
    }
  }

  // Exécuter l'initialisation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    // DOM déjà chargé, exécuter immédiatement
    initSupabase();
  }
})();
