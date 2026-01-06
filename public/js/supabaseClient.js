/**
 * ======================================================
 * CLIENT SUPABASE FRONTEND (BROWSER) - CONFIGURATION DYNAMIQUE
 * ======================================================
 * Version browser-compatible (pas de module ES6)
 * Récupère config depuis window.__SUPABASE_ENV__ (injecté par serveur)
 * Charge depuis CDN et expose `window.supabase`
 * ======================================================
 */

(function() {
  'use strict';

  // 1️⃣ Récupérer configuration depuis window (injectée par le serveur)
  const config = window.__SUPABASE_ENV__ || {};
  const SUPABASE_URL = config.url;
  const SUPABASE_ANON_KEY = config.anonKey;

  // 2️⃣ Vérification
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[SUPABASE] Configuration manquante. Vérifier injection window.__SUPABASE_ENV__');
    console.error('[SUPABASE] Attendu: window.__SUPABASE_ENV__ = { url: "...", anonKey: "..." }');
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
