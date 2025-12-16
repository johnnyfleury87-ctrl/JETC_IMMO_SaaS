const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * GET /api/abonnements/access/:module
 * Vérifie si l'utilisateur actuel a accès au module spécifié
 * Retourne { access: true/false, plan: {...} }
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
        // Extraire le nom du module depuis l'URL
        const urlParts = req.url.split('/');
        const moduleIndex = urlParts.findIndex(part => part === 'access') + 1;
        const moduleName = urlParts[moduleIndex];

        if (!moduleName) {
            return res.status(400).json({ error: 'Nom du module requis dans l\'URL' });
        }

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

        // Admin JTEC a accès à tout
        if (authUser.role === 'admin_jtec') {
            return res.status(200).json({
                access: true,
                reason: 'Admin JTEC - accès total',
                module: moduleName
            });
        }

        // Vérifier l'accès via RPC
        const { data: hasAccess, error: accessError } = await supabase.rpc('check_access_module', {
            p_module_name: moduleName,
            p_entreprise_id: authUser.entreprise_id || null,
            p_regie_id: authUser.regie_id || null
        });

        if (accessError) {
            console.error('Erreur check_access_module:', accessError);
            return res.status(500).json({ error: accessError.message });
        }

        // Récupérer le plan actuel pour info
        const { data: planInfo, error: planError } = await supabase.rpc('get_current_plan', {
            p_entreprise_id: authUser.entreprise_id || null,
            p_regie_id: authUser.regie_id || null
        });

        if (planError) {
            console.error('Erreur get_current_plan:', planError);
        }

        res.status(200).json({
            access: hasAccess,
            module: moduleName,
            plan: planInfo && planInfo.length > 0 ? planInfo[0] : null
        });

    } catch (error) {
        console.error('Erreur check access:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
