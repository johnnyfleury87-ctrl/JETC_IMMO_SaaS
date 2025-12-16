const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * GET /api/abonnements/list
 * Liste les abonnements
 * - admin_jtec : voit tous les abonnements
 * - entreprise/regie : voit uniquement son abonnement
 */
module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Vérifier le token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Récupérer l'utilisateur
        const { data: authUser, error: roleError } = await supabase
            .from('auth_users')
            .select('role, entreprise_id, regie_id')
            .eq('id', user.id)
            .single();

        if (roleError || !authUser) {
            return res.status(403).json({ error: 'Utilisateur non trouvé' });
        }

        // Filtrage en fonction des query params
        const { statut, type_periode, limit = 20, offset = 0 } = req.query;

        // Construire la requête
        let query = supabase
            .from('abonnements')
            .select(`
                *,
                plan:plans(*),
                entreprise:entreprises(id, nom),
                regie:regies(id, nom)
            `, { count: 'exact' });

        // Filtres selon le rôle
        if (authUser.role !== 'admin_jtec') {
            // Client : filtre sur son entité
            if (authUser.entreprise_id) {
                query = query.eq('entreprise_id', authUser.entreprise_id);
            } else if (authUser.regie_id) {
                query = query.eq('regie_id', authUser.regie_id);
            } else {
                return res.status(403).json({ error: 'Aucun abonnement trouvé' });
            }
        }

        // Filtres optionnels
        if (statut) {
            query = query.eq('statut', statut);
        }

        if (type_periode) {
            query = query.eq('type_periode', type_periode);
        }

        // Pagination
        query = query
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data: abonnements, error, count } = await query;

        if (error) {
            console.error('Erreur list abonnements:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json({
            abonnements,
            count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Erreur list abonnements:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
