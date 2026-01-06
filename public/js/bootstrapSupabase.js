/**
 * ======================================================
 * BOOTSTRAP SUPABASE - UNIQUE ET STABLE
 * ======================================================
 * Responsabilité : Initialiser window.supabaseClient UNE FOIS
 * Utilisé par TOUTES les pages (login, techniciens, dashboard, etc.)
 * 
 * GARANTIES:
 * - window.supabase (lib CDN) n'est JAMAIS écrasé
 * - window.supabaseClient est TOUJOURS créé
 * - window.__SUPABASE_READY__ Promise pour attendre l'init
 * ======================================================
 */

(function() {
  'use strict';

  console.log('[BOOTSTRAP] Démarrage initialisation Supabase...');

  // Configuration
  const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

  // Vérifier configuration
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[BOOTSTRAP] ❌ Configuration Supabase manquante');
    window.__SUPABASE_READY__ = Promise.reject(new Error('Configuration Supabase manquante'));
    return;
  }

  console.log('[BOOTSTRAP] Configuration trouvée');
  console.log('[BOOTSTRAP] URL:', SUPABASE_URL.substring(0, 30) + '...');
  console.log('[BOOTSTRAP] Anon key present:', !!SUPABASE_ANON_KEY);
  console.log('[BOOTSTRAP] Supabase lib loaded:', typeof window.supabase !== 'undefined');

  /**
   * Initialiser le client Supabase
   * Appelé soit immédiatement, soit après chargement du DOM
   */
  function initializeSupabase() {
    console.log('[BOOTSTRAP] Tentative d\'initialisation...');
    
    // Vérifier que la lib CDN Supabase est chargée
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[BOOTSTRAP] ❌ Lib Supabase CDN non chargée');
      console.error('[BOOTSTRAP] Vérifier que <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> est présent');
      
      window.__SUPABASE_READY__ = Promise.reject(new Error('Lib Supabase CDN non chargée'));
      return false;
    }

    console.log('[BOOTSTRAP] Lib CDN détectée');

    try {
      // ✅ Créer le client dans une variable SÉPARÉE
      // NE PAS écraser window.supabase (qui est la lib CDN)
      const supabaseLib = window.supabase;
      const client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });

      // Vérifier que le client est valide
      if (!client || !client.auth || !client.auth.getSession) {
        console.error('[BOOTSTRAP] ❌ Client créé mais API auth manquante');
        window.__SUPABASE_READY__ = Promise.reject(new Error('Client Supabase invalide'));
        return false;
      }

      // ✅ Exposer le client dans window.supabaseClient
      window.supabaseClient = client;

      // ✅ Résoudre la promesse
      if (window.__SUPABASE_READY_RESOLVE__) {
        window.__SUPABASE_READY_RESOLVE__(client);
      }

      console.log('[BOOTSTRAP] ✅ Client initialisé avec succès');
      console.log('[BOOTSTRAP] window.supabaseClient.auth:', !!window.supabaseClient.auth);
      console.log('[BOOTSTRAP] window.supabaseClient.auth.getSession:', typeof window.supabaseClient.auth.getSession);
      console.log('[BOOTSTRAP] window.supabaseClient.auth.signInWithPassword:', typeof window.supabaseClient.auth.signInWithPassword);

      return true;
    } catch (error) {
      console.error('[BOOTSTRAP] ❌ Erreur lors de la création du client:', error);
      window.__SUPABASE_READY__ = Promise.reject(error);
      return false;
    }
  }

  // Créer la promesse AVANT toute tentative d'init
  window.__SUPABASE_READY__ = new Promise((resolve, reject) => {
    window.__SUPABASE_READY_RESOLVE__ = resolve;
    window.__SUPABASE_READY_REJECT__ = reject;
  });

  // Tentative d'initialisation immédiate
  if (document.readyState === 'loading') {
    // DOM pas encore chargé, attendre
    console.log('[BOOTSTRAP] DOM en chargement, attente DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[BOOTSTRAP] DOM chargé, initialisation...');
      initializeSupabase();
    });
  } else {
    // DOM déjà chargé, initialiser immédiatement
    console.log('[BOOTSTRAP] DOM déjà chargé, initialisation immédiate...');
    initializeSupabase();
  }

  // Timeout de sécurité : si pas prêt en 5 secondes, rejeter
  setTimeout(() => {
    if (!window.supabaseClient) {
      console.error('[BOOTSTRAP] ❌ TIMEOUT: Client non initialisé après 5 secondes');
      if (window.__SUPABASE_READY_REJECT__) {
        window.__SUPABASE_READY_REJECT__(new Error('Timeout initialisation Supabase'));
      }
    }
  }, 5000);

})();
