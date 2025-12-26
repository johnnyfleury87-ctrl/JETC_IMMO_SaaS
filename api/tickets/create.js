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
    // === AUDIT A1: Logger l'environnement Vercel ===
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const vercelEnv = process.env.VERCEL_ENV || 'local';
    
    console.log('[AUDIT][ENV] SUPABASE_URL:', supabaseUrl);
    console.log('[AUDIT][ENV] SUPABASE_KEY_PREFIX:', supabaseKey.substring(0, 20) + '...');
    console.log('[AUDIT][ENV] VERCEL_ENV:', vercelEnv);

    // === AUDIT A2: Vérifier l'état du schéma vu par l'API ===
    try {
      const { data: debugData, error: debugError } = await supabaseAdmin
        .rpc('jtec_debug_schema');
      
      if (debugError) {
        console.error('[AUDIT][DB] Erreur RPC debug_schema:', debugError);
      } else {
        console.log('[AUDIT][DB] État du schéma:', JSON.stringify(debugData, null, 2));
      }
    } catch (debugErr) {
      console.error('[AUDIT][DB] Exception RPC debug_schema:', debugErr.message);
    }

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

        // INSERT direct - regie_id sera injecté par le trigger set_ticket_regie_id
        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert({
            titre,
            description,
            categorie,
            sous_categorie: sous_categorie || null,
            piece: piece || null,
            locataire_id: locataire.id,
            logement_id: locataire.logement_id
            // regie_id injecté automatiquement par trigger
          })
          .select()
          .single();
        
        if (ticketError) {
          console.error('[TICKET CREATE] Erreur INSERT:', ticketError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la création du ticket',
            error: ticketError.message
          }));
          return;
        }

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
