/**
 * ======================================================
 * CLIENT SUPABASE FRONTEND (BROWSER) - CONFIGURATION DYNAMIQUE
 * ======================================================
 * Version browser-compatible (pas de module ES6)
 * Charge config depuis /api/config puis initialise Supabase
 * ======================================================
 */

(function() {
  'use strict';

  // 1️⃣ Fonction pour charger configuration depuis API
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const config = await response.json();
      return config;
    } catch (error) {
      console.error('[SUPABASE] Erreur chargement config depuis /api/config:', error);
      return null;
    }
  }

  // 2️⃣ Fonction d'initialisation Supabase
  async function initSupabase() {
    console.log('[SUPABASE] Chargement configuration...');
    
    // Charger config depuis API
    const config = await loadConfig();
    
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('[SUPABASE] Configuration invalide ou manquante');
      console.error('[SUPABASE] Config reçue:', config);
      return;
    }
    
    const SUPABASE_URL = config.supabaseUrl;
    const SUPABASE_ANON_KEY = config.supabaseAnonKey;
    
    console.log('[SUPABASE] Configuration chargée:', SUPABASE_URL);

    // 3️⃣ Vérifier que le CDN Supabase est chargé
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[SUPABASE] CDN non chargé. Ajouter <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
      return;
    }

    // 4️⃣ Créer le client Supabase
    try {
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      
      console.log('[SUPABASE] Client initialisé ✅');
      
      // Déclencher événement personnalisé pour notifier que Supabase est prêt
      window.dispatchEvent(new Event('supabase:ready'));
      
    } catch (error) {
      console.error('[SUPABASE] Erreur initialisation client:', error);
    }
  }

  // 5️⃣ Démarrer l'initialisation quand DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();
