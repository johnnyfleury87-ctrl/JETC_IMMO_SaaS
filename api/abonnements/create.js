const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/abonnements/create
 * Crée un nouvel abonnement pour une entreprise ou régie
 * Réservé aux admin_jtec
 */
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Vérifier le token et le rôle
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Vérifier que c'est un admin_jtec
        const { data: authUser, error: roleError } = await supabase
            .from('auth_users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (roleError || !authUser || authUser.role !== 'admin_jtec') {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs JTEC' });
        }

        // Extraire les données
        const { plan_id, entreprise_id, regie_id, type_periode } = req.body;

        // Validation
        if (!plan_id) {
            return res.status(400).json({ error: 'plan_id requis' });
        }

        if (!entreprise_id && !regie_id) {
            return res.status(400).json({ error: 'entreprise_id ou regie_id requis' });
        }

        if (entreprise_id && regie_id) {
            return res.status(400).json({ error: 'Fournir entreprise_id OU regie_id (pas les deux)' });
        }

        if (type_periode && !['mensuel', 'annuel'].includes(type_periode)) {
            return res.status(400).json({ error: 'type_periode doit être "mensuel" ou "annuel"' });
        }

        // Appeler la fonction RPC
        const { data, error } = await supabase.rpc('create_abonnement', {
            p_plan_id: plan_id,
            p_entreprise_id: entreprise_id || null,
            p_regie_id: regie_id || null,
            p_type_periode: type_periode || 'mensuel'
        });

        if (error) {
            console.error('Erreur create_abonnement:', error);
            return res.status(400).json({ error: error.message });
        }

        // Récupérer l'abonnement créé
        const { data: abonnement, error: fetchError } = await supabase
            .from('abonnements')
            .select(`
                *,
                plan:plans(*),
                entreprise:entreprises(id, nom),
                regie:regies(id, nom)
            `)
            .eq('id', data)
            .single();

        if (fetchError) {
            console.error('Erreur fetch abonnement:', fetchError);
            return res.status(500).json({ error: 'Erreur lors de la récupération de l\'abonnement' });
        }

        res.status(201).json({ abonnement });

    } catch (error) {
        console.error('Erreur create abonnement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
