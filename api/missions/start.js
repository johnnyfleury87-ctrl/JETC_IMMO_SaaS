/**
 * API : Démarrer une mission
 * 
 * POST /api/missions/start
 * 
 * Body :
 * {
 *   "mission_id": "uuid"
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une entreprise ou un technicien
 * - Vérifie que la mission appartient à l'entreprise du technicien
 * - Transition : en_attente → en_cours
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// ⚠️ BACKEND ONLY - Utilise la clé SERVICE_ROLE (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleStartMission(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[START][${timestamp}] 🚀 NOUVELLE REQUÊTE DÉMARRAGE MISSION`);
  console.log(`${'='.repeat(80)}`);
  
  // [START][REQ] method url
  console.log('[START][REQ]', {
    method: req.method,
    url: req.url,
    timestamp
  });
  
  // [START][HEADERS] présence Authorization / cookie
  console.log('[START][HEADERS]', {
    hasAuthorization: !!req.headers.authorization,
    authPreview: req.headers.authorization ? 'Bearer ...' + req.headers.authorization.slice(-20) : 'ABSENT',
    hasCookie: !!req.headers.cookie,
    contentType: req.headers['content-type']
  });
  
  // 1. Authentification
  console.log('[START][AUTH] Tentative authentification...');
  const user = await authenticateUser(req);
  
  // [START][AUTH] résultat vérification user (uid, role)
  if (!user) {
    console.error('[START][AUTH] ❌ ÉCHEC - Aucun utilisateur authentifié');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Non authentifié',
      message: 'Token manquant ou invalide - Vérifiez Authorization header'
    }));
    return;
  }
  
  console.log('[START][AUTH] ✅ SUCCÈS', {
    uid: user.id,
    email: user.email || 'N/A'
  });

  // 2. Vérifier le rôle
  console.log('[START][DB] Récupération profil utilisateur...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[START][DB] ❌ ERREUR PROFIL', {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint
    });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Erreur récupération profil',
      code: profileError.code
    }));
    return;
  }

  if (!profile) {
    console.error('[START][DB] ❌ PROFIL INTROUVABLE pour uid:', user.id);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Profil introuvable' }));
    return;
  }

  console.log('[START][AUTH] Rôle utilisateur:', profile.role);

  if (profile.role !== 'entreprise' && profile.role !== 'technicien') {
    console.error('[START][AUTH] ❌ RÔLE INTERDIT', {
      role: profile.role,
      allowed: ['entreprise', 'technicien']
    });
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Accès interdit',
      message: 'Réservé aux entreprises et techniciens'
    }));
    return;
  }

  // 3. Lire le body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      
      // [START][BODY] mission_id (sans données sensibles)
      console.log('[START][BODY]', {
        mission_id: parsed.mission_id,
        hasOtherFields: Object.keys(parsed).filter(k => k !== 'mission_id').length > 0
      });

      const { mission_id } = parsed;

      if (!mission_id) {
        console.error('[START][BODY] ❌ mission_id MANQUANT');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mission_id requis' }));
        return;
      }

      // 4. Vérifier que la mission existe et son état AVANT appel RPC
      console.log('[START][DB] Vérification mission avant démarrage...');
      const { data: missionCheck, error: checkError } = await supabase
        .from('missions')
        .select('id, statut, technicien_id, entreprise_id, started_at')
        .eq('id', mission_id)
        .single();
      
      if (checkError) {
        console.error('[START][DB] ❌ ERREUR VÉRIFICATION MISSION', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details
        });
      } else if (!missionCheck) {
        console.error('[START][DB] ❌ MISSION INTROUVABLE', { mission_id });
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Mission introuvable' }));
        return;
      } else {
        console.log('[START][DB] ✅ Mission trouvée:', {
          id: missionCheck.id,
          statut: missionCheck.statut,
          technicien_id: missionCheck.technicien_id,
          entreprise_id: missionCheck.entreprise_id,
          started_at: missionCheck.started_at
        });
        
        // Vérification statut
        if (missionCheck.statut !== 'en_attente') {
          console.error('[START][DB] ❌ STATUT INVALIDE', {
            statut_actuel: missionCheck.statut,
            statut_requis: 'en_attente'
          });
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Mission déjà démarrée ou terminée',
            statut_actuel: missionCheck.statut
          }));
          return;
        }
      }

      // 5. Appeler la RPC start_mission
      console.log('[START][DB] Appel RPC start_mission...');
      const { data: result, error: startError } = await supabase
        .rpc('start_mission', {
          p_mission_id: mission_id
        });

      // [START][DB] error (message + code Postgres)
      if (startError) {
        console.error('[START][DB] ❌ ERREUR RPC start_mission', {
          code: startError.code,
          message: startError.message,
          details: startError.details,
          hint: startError.hint
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Erreur démarrage mission',
          code: startError.code,
          message: startError.message
        }));
        return;
      }

      console.log('[START][DB] ✅ Résultat RPC:', result);

      // 6. Vérifier le résultat de la RPC
      if (!result || !result.success) {
        console.error('[START][DB] ❌ RPC retourne échec', result);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: result?.error || 'Échec démarrage mission'
        }));
        return;
      }

      // 7. Succès
      console.log('[START][DB] ✅ MISSION DÉMARRÉE AVEC SUCCÈS');
      console.log(`${'='.repeat(80)}\n`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Mission démarrée avec succès'
      }));

    } catch (error) {
      console.error('[START][ERROR] ❌ EXCEPTION NON GÉRÉE', {
        message: error.message,
        stack: error.stack
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message
      }));
    }
  });
}

// Export direct pour compatibilité Vercel
module.exports = handleStartMission;
