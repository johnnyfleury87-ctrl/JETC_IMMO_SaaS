/**
 * Route API : Création de tickets
 * POST /api/tickets/create
 * 
 * M21: Utilise la fonction RPC create_ticket_locataire
 * CAUSE: PostgREST .insert() incompatible avec table métier (RLS + triggers)
 * SOLUTION: RPC SQL SECURITY DEFINER bypass PostgREST, triggers actifs
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Méthode non autorisée' }));
    return;
  }

  try {
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

        // === INSERT via RPC (bypass PostgREST incompatible) ===
        // PostgREST .insert() ne fonctionne pas avec cette table métier (RLS + triggers)
        // Solution définitive: RPC SQL SECURITY DEFINER
        const { data: ticketId, error: ticketError } = await supabaseAdmin.rpc(
          'create_ticket_locataire',
          {
            p_titre: titre,
            p_description: description,
            p_categorie: categorie,
            p_sous_categorie: sous_categorie || null,
            p_piece: piece || null,
            p_locataire_id: locataire.id,
            p_logement_id: locataire.logement_id
          }
        );
        
        if (ticketError) {
          console.error('[TICKET CREATE][RPC ERROR]', ticketError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la création du ticket',
            error: ticketError.message,
            code: ticketError.code
          }));
          return;
        }

        console.log('[TICKET CREATE] OK ticket_id=', ticketId);

        // Récupérer le ticket créé pour la réponse
        const { data: ticket, error: selectError } = await supabaseAdmin
          .from('tickets')
          .select()
          .eq('id', ticketId)
          .single();
        
        if (selectError) {
          console.error('[TICKET SELECT] Erreur:', selectError);
        }

        // Insérer les disponibilités
        const disponibilitesData = disponibilites.map(d => ({
          ticket_id: ticketId,
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
          ticket: ticket || { id: ticketId }
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
