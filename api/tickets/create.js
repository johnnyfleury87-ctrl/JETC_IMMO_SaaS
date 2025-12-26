/**
 * Route API : Création de tickets
 * POST /api/tickets/create
 * 
 * Permet à un locataire de créer un ticket pour son logement
 * 
 * SÉCURITÉ :
 * - Vérification du token JWT
 * - Vérification que l'utilisateur est un locataire
 * - Vérification que le locataire crée le ticket pour SON logement
 * - La regie_id est calculée automatiquement par le trigger SQL
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Méthode non autorisée' }));
    return;
  }

  try {
    // Récupérer le token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token manquant' }));
      return;
    }

    const token = authHeader.substring(7);

    // Vérifier le token et récupérer l'utilisateur
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token invalide' }));
      return;
    }

    // Récupérer le profil utilisateur
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Profil non trouvé' }));
      return;
    }

    // Vérifier que c'est bien un locataire
    if (profile.role !== 'locataire') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Seuls les locataires peuvent créer des tickets' 
      }));
      return;
    }

    // Récupérer les données du locataire
    const { data: locataire, error: locataireError } = await supabaseAdmin
      .from('locataires')
      .select('id, logement_id')
      .eq('profile_id', profile.id)
      .single();

    console.log('[TICKET CREATE] Locataire récupéré:', {
      locataire_id: locataire?.id,
      logement_id: locataire?.logement_id,
      profile_id: profile.id
    });

    if (locataireError || !locataire) {
      console.error('[TICKET CREATE] Erreur récupération locataire:', locataireError);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Fiche locataire non trouvée' 
      }));
      return;
    }

    // Vérifier que le locataire a un logement
    if (!locataire.logement_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Vous devez être rattaché à un logement pour créer un ticket' 
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
        const { 
          description, 
          categorie,
          sous_categorie,
          piece,
          disponibilites
        } = JSON.parse(body);

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

        // ✅ Générer le titre automatiquement : "Catégorie // Sous-catégorie"
        const titreCapitalized = categorie.charAt(0).toUpperCase() + categorie.slice(1);
        const titre = sous_categorie 
          ? `${titreCapitalized} // ${sous_categorie}`
          : titreCapitalized;

        // Validation des disponibilités (au moins 1 créneau obligatoire)
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
              message: `Créneau ${i + 1} incomplet (date_debut, date_fin, preference requis)` 
            }));
            return;
          }
        }

        // ✅ SÉCURITÉ : Récupérer regie_id depuis logement
        const { data: logement, error: logementError } = await supabaseAdmin
          .from('logements')
          .select('regie_id')
          .eq('id', locataire.logement_id)
          .single();

        console.log('[TICKET CREATE] Logement récupéré:', {
          logement_id: locataire.logement_id,
          regie_id: logement?.regie_id
        });

        if (logementError || !logement) {
          console.error('[TICKET CREATE] Erreur récupération logement:', logementError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la récupération du logement' 
          }));
          return;
        }

        // Créer le ticket
        // ⚠️ M12 FIX: Ne PAS forcer statut='ouvert', laisser DEFAULT SQL 'nouveau'
        // ⚠️ SÉCURITÉ: IDs viennent du JWT, pas du frontend
        const ticketData = {
          titre,
          description,
          categorie,
          sous_categorie: sous_categorie || null,
          piece: piece || null,
          locataire_id: locataire.id,
          logement_id: locataire.logement_id,
          regie_id: logement.regie_id
          // ✅ M12: Pas de statut forcé, DEFAULT SQL = 'nouveau'
          // ✅ SÉCURITÉ: priorite et plafond NULL (réservés à la régie)
        };

        console.log('[TICKET CREATE] Données à insérer:', JSON.stringify(ticketData, null, 2));
        console.log('[TICKET CREATE] Types:', {
          locataire_id_type: typeof ticketData.locataire_id,
          logement_id_type: typeof ticketData.logement_id,
          regie_id_type: typeof ticketData.regie_id
        });

        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert(ticketData)
          .select('*')
          .single();

        if (ticketError) {
          console.error('[TICKET CREATE] Erreur création ticket:', ticketError);
          console.error('[TICKET CREATE] Détails erreur:', {
            code: ticketError.code,
            message: ticketError.message,
            details: ticketError.details,
            hint: ticketError.hint
          });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la création du ticket',
            error: ticketError.message,
            code: ticketError.code
          }));
          return;
        }

        // Insérer les 3 disponibilités (M09)
        const disponibilitesData = disponibilites.map(d => ({
          ticket_id: ticket.id,
          date_debut: d.date_debut,
          date_fin: d.date_fin,
          preference: d.preference
        }));

        const { error: dispoError } = await supabaseAdmin
          .from('tickets_disponibilites')
          .insert(disponibilitesData);

        if (dispoError) {
          console.error('Erreur création disponibilités:', dispoError);
          // Ne pas bloquer, mais logger l'erreur
          console.warn('⚠️ Disponibilités non créées, mais ticket créé:', ticket.id);
        }

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
      message: 'Erreur serveur',
      error: error.message
    }));
  }
};
