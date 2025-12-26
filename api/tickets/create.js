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

    if (locataireError || !locataire) {
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
          titre, 
          description, 
          categorie,
          sous_categorie,
          piece,
          priorite,
          plafond_intervention_chf,
          disponibilites
        } = JSON.parse(body);

        // Validation des champs obligatoires
        if (!titre || !description || !categorie) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Titre, description et catégorie sont obligatoires' 
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

        // Validation de la priorité
        const prioritesValides = ['basse', 'normale', 'haute', 'urgente'];
        const prioriteFinale = priorite && prioritesValides.includes(priorite) 
          ? priorite 
          : 'normale';

        // Validation des disponibilités (3 créneaux obligatoires - M09)
        if (!disponibilites || !Array.isArray(disponibilites) || disponibilites.length !== 3) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: '3 créneaux de disponibilité sont obligatoires' 
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

        // Créer le ticket
        // ⚠️ M12 FIX: Ne PAS forcer statut='ouvert', laisser DEFAULT SQL 'nouveau'
        // La regie_id sera calculée automatiquement par le trigger SQL
        const ticketData = {
          titre,
          description,
          categorie,
          sous_categorie: sous_categorie || null,
          piece: piece || null,
          priorite: prioriteFinale,
          plafond_intervention_chf: plafond_intervention_chf || null,
          logement_id: locataire.logement_id,
          locataire_id: locataire.id
          // ✅ M12: Pas de statut forcé, DEFAULT SQL = 'nouveau'
        };

        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert(ticketData)
          .select('*')
          .single();

        if (ticketError) {
          console.error('Erreur création ticket:', ticketError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Erreur lors de la création du ticket',
            error: ticketError.message
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
