/**
 * Route API : Création de tickets
 * POST /api/tickets/create
 * 
 * M18: Utilise la fonction RPC create_ticket_locataire
 * La RPC résout automatiquement locataire_id, logement_id, regie_id depuis auth.uid()
 * Plus de problème avec triggers + RLS + PostgREST
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Méthode non autorisée' }));
    return;
  }

  try {
    // === STEP A: Logger l'environnement Vercel ===
    console.log('[AUDIT][ENV] SUPABASE_URL=', process.env.SUPABASE_URL);
    console.log('[AUDIT][ENV] VERCEL_ENV=', process.env.VERCEL_ENV);
    console.log('[AUDIT][ENV] KEY_PREFIX=', (process.env.SUPABASE_SERVICE_ROLE_KEY||'').slice(0, 16));

    // Vérifier le token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token manquant' }));
      return;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token invalide' }));
      return;
    }

    // Vérifier que c'est un locataire
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'locataire') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Seuls les locataires peuvent créer des tickets' 
      }));
      return;
    }

    // Récupérer les données du formulaire
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { description, categorie, sous_categorie, piece, disponibilites } = JSON.parse(body);

        // Validation des champs obligatoires
        if (!description || !categorie) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Description et catégorie sont obligatoires' 
          }));
          return;
        }

        // Validation de la catégorie
        const categoriesValides = [
          'plomberie', 'electricite', 'chauffage', 'ventilation',
          'serrurerie', 'vitrerie', 'menuiserie', 'peinture', 'autre'
        ];
        if (!categoriesValides.includes(categorie)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Catégorie invalide' 
          }));
          return;
        }

        // Générer le titre automatiquement
        const titreCapitalized = categorie.charAt(0).toUpperCase() + categorie.slice(1);
        const titre = sous_categorie 
          ? `${titreCapitalized} // ${sous_categorie}`
          : titreCapitalized;

        // Validation des disponibilités
        if (!disponibilites || !Array.isArray(disponibilites) || disponibilites.length < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Au moins 1 créneau de disponibilité est obligatoire' 
          }));
          return;
        }

        // Valider chaque créneau
        for (let i = 0; i < disponibilites.length; i++) {
          const dispo = disponibilites[i];
          if (!dispo.date_debut || !dispo.date_fin || !dispo.preference) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              message: `Créneau ${i + 1} incomplet` 
            }));
            return;
          }
        }

        // Récupérer locataire_id et logement_id depuis le JWT
        const { data: locataire, error: locataireError } = await supabaseAdmin
          .from('locataires')
          .select('id, logement_id')
          .eq('profile_id', user.id)
          .single();

        if (locataireError || !locataire) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Fiche locataire non trouvée' 
          }));
          return;
        }

        if (!locataire.logement_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Vous devez être rattaché à un logement pour créer un ticket' 
          }));
          return;
        }

        // === STEP B: Test SELECT metadata (même client service_role) ===
        const r = await supabaseAdmin
          .from('tickets')
          .select('locataire_id')
          .limit(1);
        
        console.log('[AUDIT][POSTGREST_SELECT]', r.error ? r.error : 'OK');

        // === STEP D: Payload explicite + logs ===
        // INSERT direct - regie_id sera injecté par le trigger set_ticket_regie_id
        const insertPayload = {
          titre: titre,
          description: description,
          categorie: categorie,
          sous_categorie: sous_categorie || null,
          piece: piece || null,
          locataire_id: locataire.id,
          logement_id: locataire.logement_id
          // regie_id injecté automatiquement par trigger
        };

        console.log('[AUDIT][FINAL_PAYLOAD_KEYS]', Object.keys(insertPayload));
        console.log('[AUDIT][FINAL_PAYLOAD]', JSON.stringify(insertPayload, null, 2));

        // === STEP 4: Force schema public (explicite) ===
        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert(insertPayload)
          .select()
          .single();
        
        // === STEP 8: Diagnostic complet si erreur ===
        if (ticketError) {
          console.error('[TICKET CREATE] Erreur INSERT complète:', {
            message: ticketError.message,
            details: ticketError.details,
            hint: ticketError.hint,
            code: ticketError.code,
            error_full: JSON.stringify(ticketError, null, 2)
          });
          console.error('[TICKET CREATE] Payload utilisé:', JSON.stringify(insertPayload, null, 2));
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la création du ticket',
            error: ticketError.message,
            code: ticketError.code
          }));
          return;
        }

        console.log('[TICKET CREATE] INSERT réussi, ticket ID:', ticket.id);

        // Insérer les disponibilités
        const disponibilitesData = disponibilites.map(d => ({
          ticket_id: ticket.id,
          date_debut: d.date_debut,
          date_fin: d.date_fin,
          preference: d.preference
        }));

        await supabaseAdmin
          .from('tickets_disponibilites')
          .insert(disponibilitesData);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Ticket créé avec succès',
          ticket: ticket
        }));

      } catch (parseError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Données JSON invalides' 
        }));
      }
    });

  } catch (error) {
    console.error('Erreur serveur:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      message: 'Erreur serveur'
    }));
  }
};
