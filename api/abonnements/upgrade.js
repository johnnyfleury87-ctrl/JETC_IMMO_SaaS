const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PUT /api/abonnements/:id/upgrade
 * Change le plan d'un abonnement (upgrade ou downgrade)
 * Réservé aux admin_jtec
 */
module.exports = async (req, res) => {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Extraire l'ID de l'abonnement depuis l'URL
        const urlParts = req.url.split('/');
        const idIndex = urlParts.findIndex(part => part === 'abonnements') + 1;
        const abonnementId = urlParts[idIndex];

        if (!abonnementId) {
            return res.status(400).json({ error: 'ID abonnement requis dans l\'URL' });
        }

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
        const { nouveau_plan_id, prorata } = req.body;

        // Validation
        if (!nouveau_plan_id) {
            return res.status(400).json({ error: 'nouveau_plan_id requis' });
        }

        // Appeler la fonction RPC
        const { data, error } = await supabase.rpc('change_plan', {
            p_abonnement_id: abonnementId,
            p_nouveau_plan_id: nouveau_plan_id,
            p_prorata: prorata !== undefined ? prorata : true
        });

        if (error) {
            console.error('Erreur change_plan:', error);
            return res.status(400).json({ error: error.message });
        }

        // Récupérer le nouvel abonnement créé
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
            return res.status(500).json({ error: 'Erreur lors de la récupération du nouvel abonnement' });
        }

        res.status(200).json({ 
            message: 'Plan changé avec succès',
            nouvel_abonnement: abonnement 
        });

    } catch (error) {
        console.error('Erreur upgrade abonnement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
