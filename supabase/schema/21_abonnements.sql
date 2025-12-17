-- ============================================================================
-- ÉTAPE 15 : ABONNEMENTS & MODULES PAYANTS
-- ============================================================================
-- Ordre d'exécution : 21
-- Objectif : Activer le modèle économique avec plans, abonnements et contrôles
-- Critères : Accès selon plan, limites respectées
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE DES PLANS
-- ----------------------------------------------------------------------------
-- Définit les plans disponibles (Basic, Pro, Enterprise)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identité
    nom VARCHAR(50) UNIQUE NOT NULL CHECK (nom IN ('basic', 'pro', 'enterprise')),
    nom_affichage VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Tarification
    prix_mensuel DECIMAL(10, 2) NOT NULL CHECK (prix_mensuel >= 0),
    prix_annuel DECIMAL(10, 2) NOT NULL CHECK (prix_annuel >= 0),
    
    -- Limites et modules
    limite_missions_mois INTEGER CHECK (limite_missions_mois > 0 OR limite_missions_mois IS NULL), -- NULL = illimité
    limite_techniciens INTEGER CHECK (limite_techniciens > 0 OR limite_techniciens IS NULL),
    limite_utilisateurs INTEGER CHECK (limite_utilisateurs > 0 OR limite_utilisateurs IS NULL),
    
    -- Modules activés (JSON array de modules)
    modules_actifs JSONB DEFAULT '[]'::jsonb,
    
    -- Méta
    actif BOOLEAN DEFAULT true,
    ordre_affichage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.plans IS 'Plans d''abonnement disponibles (Basic, Pro, Enterprise)';
COMMENT ON COLUMN public.plans.limite_missions_mois IS 'Nombre max de missions par mois (NULL = illimité)';
COMMENT ON COLUMN public.plans.modules_actifs IS 'Array JSON des modules accessibles : ["facturation", "messagerie", "planning", "reporting"]';

-- ----------------------------------------------------------------------------
-- 2. TABLE DES ABONNEMENTS
-- ----------------------------------------------------------------------------
-- Abonnements actifs pour entreprises et régies
CREATE TABLE IF NOT EXISTS public.abonnements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Client (entreprise OU régie)
    entreprise_id UUID REFERENCES public.entreprises(id) ON DELETE CASCADE,
    regie_id UUID REFERENCES public.regies(id) ON DELETE CASCADE,
    
    -- Plan souscrit
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    
    -- Période
    type_periode VARCHAR(20) NOT NULL DEFAULT 'mensuel' CHECK (type_periode IN ('mensuel', 'annuel')),
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE NOT NULL,
    
    -- Statut
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'annule', 'expire')),
    
    -- Paiement
    montant_paye DECIMAL(10, 2) NOT NULL CHECK (montant_paye >= 0),
    date_prochain_paiement DATE,
    
    -- Usage (compteurs pour quotas)
    missions_ce_mois INTEGER DEFAULT 0 CHECK (missions_ce_mois >= 0),
    dernier_reset_quota DATE DEFAULT CURRENT_DATE,
    
    -- Méta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Contraintes
    CONSTRAINT abonnement_client_unique CHECK (
        (entreprise_id IS NOT NULL AND regie_id IS NULL) OR 
        (entreprise_id IS NULL AND regie_id IS NOT NULL)
    ),
    CONSTRAINT date_fin_apres_debut CHECK (date_fin > date_debut)
);

COMMENT ON TABLE public.abonnements IS 'Abonnements actifs pour entreprises et régies';
COMMENT ON COLUMN public.abonnements.missions_ce_mois IS 'Compteur de missions créées ce mois (reset le 1er de chaque mois)';
COMMENT ON CONSTRAINT abonnement_client_unique ON public.abonnements IS 'Un abonnement appartient soit à une entreprise soit à une régie';

-- Index
CREATE INDEX idx_abonnements_entreprise ON public.abonnements(entreprise_id) WHERE entreprise_id IS NOT NULL;
CREATE INDEX idx_abonnements_regie ON public.abonnements(regie_id) WHERE regie_id IS NOT NULL;
CREATE INDEX idx_abonnements_statut ON public.abonnements(statut);
CREATE INDEX idx_abonnements_date_fin ON public.abonnements(date_fin) WHERE statut = 'actif';

-- ----------------------------------------------------------------------------
-- 3. FONCTION : Créer un abonnement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_abonnement(
    p_plan_id UUID,
    p_entreprise_id UUID DEFAULT NULL,
    p_regie_id UUID DEFAULT NULL,
    p_type_periode VARCHAR DEFAULT 'mensuel'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_date_fin DATE;
    v_montant DECIMAL(10, 2);
    v_abonnement_id UUID;
BEGIN
    -- Vérifier que plan existe
    SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND actif = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan introuvable ou inactif';
    END IF;
    
    -- Vérifier qu'un seul client est fourni
    IF (p_entreprise_id IS NULL AND p_regie_id IS NULL) OR 
       (p_entreprise_id IS NOT NULL AND p_regie_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Fournir entreprise_id OU regie_id (pas les deux)';
    END IF;
    
    -- Calculer date de fin et montant
    IF p_type_periode = 'mensuel' THEN
        v_date_fin := CURRENT_DATE + INTERVAL '1 month';
        v_montant := v_plan.prix_mensuel;
    ELSIF p_type_periode = 'annuel' THEN
        v_date_fin := CURRENT_DATE + INTERVAL '1 year';
        v_montant := v_plan.prix_annuel;
    ELSE
        RAISE EXCEPTION 'Type de période invalide (mensuel ou annuel)';
    END IF;
    
    -- Créer l'abonnement
    INSERT INTO public.abonnements (
        entreprise_id,
        regie_id,
        plan_id,
        type_periode,
        date_debut,
        date_fin,
        statut,
        montant_paye,
        date_prochain_paiement
    ) VALUES (
        p_entreprise_id,
        p_regie_id,
        p_plan_id,
        p_type_periode,
        CURRENT_DATE,
        v_date_fin,
        'actif',
        v_montant,
        v_date_fin
    )
    RETURNING id INTO v_abonnement_id;
    
    RETURN v_abonnement_id;
END;
$$;

COMMENT ON FUNCTION public.create_abonnement IS 'Crée un nouvel abonnement pour une entreprise ou régie';

-- ----------------------------------------------------------------------------
-- 4. FONCTION : Récupérer le plan actuel d'un client
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_plan(
    p_entreprise_id UUID DEFAULT NULL,
    p_regie_id UUID DEFAULT NULL
)
RETURNS TABLE(
    abonnement_id UUID,
    plan_id UUID,
    plan_nom VARCHAR,
    statut VARCHAR,
    date_fin DATE,
    limite_missions_mois INTEGER,
    limite_techniciens INTEGER,
    limite_utilisateurs INTEGER,
    modules_actifs JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        p.id,
        p.nom,
        a.statut,
        a.date_fin,
        p.limite_missions_mois,
        p.limite_techniciens,
        p.limite_utilisateurs,
        p.modules_actifs
    FROM public.abonnements a
    JOIN public.plans p ON a.plan_id = p.id
    WHERE 
        (p_entreprise_id IS NOT NULL AND a.entreprise_id = p_entreprise_id) OR
        (p_regie_id IS NOT NULL AND a.regie_id = p_regie_id)
    AND a.statut = 'actif'
    ORDER BY a.created_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_current_plan IS 'Récupère le plan actif actuel d''une entreprise ou régie';

-- ----------------------------------------------------------------------------
-- 5. FONCTION : Vérifier l'accès à un module
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_access_module(
    p_module_name VARCHAR,
    p_entreprise_id UUID DEFAULT NULL,
    p_regie_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_modules_actifs JSONB;
    v_statut VARCHAR;
BEGIN
    -- Récupérer le plan actuel
    SELECT 
        p.modules_actifs,
        a.statut
    INTO v_modules_actifs, v_statut
    FROM public.abonnements a
    JOIN public.plans p ON a.plan_id = p.id
    WHERE 
        (p_entreprise_id IS NOT NULL AND a.entreprise_id = p_entreprise_id) OR
        (p_regie_id IS NOT NULL AND a.regie_id = p_regie_id)
    AND a.statut = 'actif'
    ORDER BY a.created_at DESC
    LIMIT 1;
    
    -- Si pas d'abonnement actif
    IF NOT FOUND OR v_statut != 'actif' THEN
        RETURN false;
    END IF;
    
    -- Vérifier si module dans la liste
    RETURN v_modules_actifs ? p_module_name;
END;
$$;

COMMENT ON FUNCTION public.check_access_module IS 'Vérifie si un client a accès à un module spécifique';

-- ----------------------------------------------------------------------------
-- 6. FONCTION : Vérifier les quotas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_quota(
    p_quota_type VARCHAR, -- 'missions', 'techniciens', 'utilisateurs'
    p_entreprise_id UUID DEFAULT NULL,
    p_regie_id UUID DEFAULT NULL
)
RETURNS TABLE(
    quota_atteint BOOLEAN,
    limite INTEGER,
    utilisation INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_abonnement RECORD;
    v_utilisation INTEGER;
BEGIN
    -- Récupérer le plan et l'abonnement
    SELECT 
        a.id as abonnement_id,
        a.missions_ce_mois,
        a.dernier_reset_quota,
        p.limite_missions_mois,
        p.limite_techniciens,
        p.limite_utilisateurs
    INTO v_abonnement
    FROM public.abonnements a
    JOIN public.plans p ON a.plan_id = p.id
    WHERE 
        (p_entreprise_id IS NOT NULL AND a.entreprise_id = p_entreprise_id) OR
        (p_regie_id IS NOT NULL AND a.regie_id = p_regie_id)
    AND a.statut = 'actif'
    ORDER BY a.created_at DESC
    LIMIT 1;
    
    -- Si pas d'abonnement
    IF NOT FOUND THEN
        RETURN QUERY SELECT true, 0, 0;
        RETURN;
    END IF;
    
    -- Missions
    IF p_quota_type = 'missions' THEN
        -- Reset quota si nouveau mois
        IF v_abonnement.dernier_reset_quota < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN
            UPDATE public.abonnements 
            SET missions_ce_mois = 0, dernier_reset_quota = CURRENT_DATE
            WHERE id = v_abonnement.abonnement_id;
            v_utilisation := 0;
        ELSE
            v_utilisation := v_abonnement.missions_ce_mois;
        END IF;
        
        -- NULL = illimité
        IF v_abonnement.limite_missions_mois IS NULL THEN
            RETURN QUERY SELECT false, NULL::INTEGER, v_utilisation;
        ELSE
            RETURN QUERY SELECT 
                v_utilisation >= v_abonnement.limite_missions_mois,
                v_abonnement.limite_missions_mois,
                v_utilisation;
        END IF;
        RETURN;
    END IF;
    
    -- Techniciens
    IF p_quota_type = 'techniciens' THEN
        SELECT COUNT(*) INTO v_utilisation
        FROM public.techniciens
        WHERE (p_entreprise_id IS NOT NULL AND entreprise_id = p_entreprise_id);
        
        IF v_abonnement.limite_techniciens IS NULL THEN
            RETURN QUERY SELECT false, NULL::INTEGER, v_utilisation;
        ELSE
            RETURN QUERY SELECT 
                v_utilisation >= v_abonnement.limite_techniciens,
                v_abonnement.limite_techniciens,
                v_utilisation;
        END IF;
        RETURN;
    END IF;
    
    -- Utilisateurs
    IF p_quota_type = 'utilisateurs' THEN
        IF p_entreprise_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_utilisation
            FROM public.auth_users
            WHERE entreprise_id = p_entreprise_id;
        ELSIF p_regie_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_utilisation
            FROM public.auth_users
            WHERE regie_id = p_regie_id;
        END IF;
        
        IF v_abonnement.limite_utilisateurs IS NULL THEN
            RETURN QUERY SELECT false, NULL::INTEGER, v_utilisation;
        ELSE
            RETURN QUERY SELECT 
                v_utilisation >= v_abonnement.limite_utilisateurs,
                v_abonnement.limite_utilisateurs,
                v_utilisation;
        END IF;
        RETURN;
    END IF;
    
    -- Type inconnu
    RAISE EXCEPTION 'Type de quota invalide: %', p_quota_type;
END;
$$;

COMMENT ON FUNCTION public.check_quota IS 'Vérifie si un quota est atteint (missions, techniciens, utilisateurs)';

-- ----------------------------------------------------------------------------
-- 7. FONCTION : Incrémenter le compteur de missions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_mission_quota(
    p_entreprise_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_abonnement_id UUID;
BEGIN
    -- Trouver l'abonnement actif
    SELECT id INTO v_abonnement_id
    FROM public.abonnements
    WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Incrémenter le compteur
        UPDATE public.abonnements
        SET missions_ce_mois = missions_ce_mois + 1,
            updated_at = now()
        WHERE id = v_abonnement_id;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_mission_quota IS 'Incrémente le compteur de missions du mois pour une entreprise';

-- ----------------------------------------------------------------------------
-- 8. FONCTION : Changer de plan (upgrade/downgrade)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_plan(
    p_abonnement_id UUID,
    p_nouveau_plan_id UUID,
    p_prorata BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ancien_abonnement RECORD;
    v_nouveau_plan RECORD;
    v_nouveau_abonnement_id UUID;
    v_jours_restants INTEGER;
    v_nouvelle_date_fin DATE;
BEGIN
    -- Récupérer l'ancien abonnement
    SELECT * INTO v_ancien_abonnement
    FROM public.abonnements
    WHERE id = p_abonnement_id
    AND statut = 'actif';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Abonnement introuvable ou inactif';
    END IF;
    
    -- Récupérer le nouveau plan
    SELECT * INTO v_nouveau_plan
    FROM public.plans
    WHERE id = p_nouveau_plan_id
    AND actif = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nouveau plan introuvable ou inactif';
    END IF;
    
    -- Calculer la nouvelle date de fin
    v_jours_restants := v_ancien_abonnement.date_fin - CURRENT_DATE;
    IF v_jours_restants < 0 THEN
        v_jours_restants := 0;
    END IF;
    
    IF v_ancien_abonnement.type_periode = 'mensuel' THEN
        v_nouvelle_date_fin := CURRENT_DATE + INTERVAL '1 month';
    ELSE
        v_nouvelle_date_fin := CURRENT_DATE + INTERVAL '1 year';
    END IF;
    
    -- Annuler l'ancien abonnement
    UPDATE public.abonnements
    SET statut = 'annule',
        updated_at = now()
    WHERE id = p_abonnement_id;
    
    -- Créer le nouvel abonnement
    INSERT INTO public.abonnements (
        entreprise_id,
        regie_id,
        plan_id,
        type_periode,
        date_debut,
        date_fin,
        statut,
        montant_paye,
        date_prochain_paiement,
        missions_ce_mois,
        dernier_reset_quota
    ) VALUES (
        v_ancien_abonnement.entreprise_id,
        v_ancien_abonnement.regie_id,
        p_nouveau_plan_id,
        v_ancien_abonnement.type_periode,
        CURRENT_DATE,
        v_nouvelle_date_fin,
        'actif',
        CASE 
            WHEN v_ancien_abonnement.type_periode = 'mensuel' 
            THEN v_nouveau_plan.prix_mensuel
            ELSE v_nouveau_plan.prix_annuel
        END,
        v_nouvelle_date_fin,
        v_ancien_abonnement.missions_ce_mois, -- Conserver le compteur
        v_ancien_abonnement.dernier_reset_quota
    )
    RETURNING id INTO v_nouveau_abonnement_id;
    
    RETURN v_nouveau_abonnement_id;
END;
$$;

COMMENT ON FUNCTION public.change_plan IS 'Change le plan d''un abonnement (upgrade/downgrade)';

-- ----------------------------------------------------------------------------
-- 9. VUE : Statistiques des abonnements
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.abonnements_stats AS
SELECT
    p.nom as plan_nom,
    p.nom_affichage,
    COUNT(a.id) as nombre_abonnements,
    COUNT(a.id) FILTER (WHERE a.statut = 'actif') as abonnements_actifs,
    COUNT(a.id) FILTER (WHERE a.type_periode = 'mensuel') as abonnements_mensuels,
    COUNT(a.id) FILTER (WHERE a.type_periode = 'annuel') as abonnements_annuels,
    SUM(CASE 
        WHEN a.statut = 'actif' AND a.type_periode = 'mensuel' 
        THEN p.prix_mensuel 
        ELSE 0 
    END) as mrr_mensuel, -- Monthly Recurring Revenue
    SUM(CASE 
        WHEN a.statut = 'actif' AND a.type_periode = 'annuel' 
        THEN p.prix_annuel / 12 
        ELSE 0 
    END) as mrr_annuel,
    SUM(CASE 
        WHEN a.statut = 'actif' AND a.type_periode = 'mensuel' 
        THEN p.prix_mensuel 
        ELSE 0 
    END) + SUM(CASE 
        WHEN a.statut = 'actif' AND a.type_periode = 'annuel' 
        THEN p.prix_annuel / 12 
        ELSE 0 
    END) as mrr_total
FROM public.plans p
LEFT JOIN public.abonnements a ON p.id = a.plan_id
GROUP BY p.id, p.nom, p.nom_affichage, p.ordre_affichage
ORDER BY p.ordre_affichage;

COMMENT ON VIEW public.abonnements_stats IS 'Statistiques des abonnements par plan avec MRR';

-- ----------------------------------------------------------------------------
-- 10. VUE : Usage des quotas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.quotas_usage AS
SELECT
    COALESCE(e.nom, r.nom) as client_nom,
    CASE 
        WHEN a.entreprise_id IS NOT NULL THEN 'entreprise'
        ELSE 'regie'
    END as client_type,
    p.nom as plan_nom,
    a.statut,
    
    -- Missions
    a.missions_ce_mois as missions_utilisees,
    p.limite_missions_mois as missions_limite,
    CASE 
        WHEN p.limite_missions_mois IS NULL THEN 0
        WHEN a.missions_ce_mois >= p.limite_missions_mois THEN 100
        ELSE ROUND((a.missions_ce_mois::DECIMAL / p.limite_missions_mois) * 100, 2)
    END as missions_pourcentage,
    
    -- Techniciens
    (SELECT COUNT(*) FROM public.techniciens WHERE entreprise_id = a.entreprise_id) as techniciens_utilises,
    p.limite_techniciens as techniciens_limite,
    
    -- Utilisateurs
    CASE 
        WHEN a.entreprise_id IS NOT NULL THEN (SELECT COUNT(*) FROM public.auth_users WHERE entreprise_id = a.entreprise_id)
        ELSE (SELECT COUNT(*) FROM public.auth_users WHERE regie_id = a.regie_id)
    END as utilisateurs_utilises,
    p.limite_utilisateurs as utilisateurs_limite,
    
    a.date_fin,
    a.date_fin - CURRENT_DATE as jours_restants
    
FROM public.abonnements a
JOIN public.plans p ON a.plan_id = p.id
LEFT JOIN public.entreprises e ON a.entreprise_id = e.id
LEFT JOIN public.regies r ON a.regie_id = r.id
WHERE a.statut = 'actif'
ORDER BY a.date_fin;

COMMENT ON VIEW public.quotas_usage IS 'Vue de l''utilisation des quotas par client';

-- ----------------------------------------------------------------------------
-- 11. TRIGGER : Mettre à jour updated_at sur plans
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_plan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_plan_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_plan_updated_at();

-- ----------------------------------------------------------------------------
-- 12. TRIGGER : Mettre à jour updated_at sur abonnements
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_abonnement_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_abonnement_updated_at
    BEFORE UPDATE ON public.abonnements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_abonnement_updated_at();

-- ----------------------------------------------------------------------------
-- 13. TRIGGER : Incrémenter quota missions lors de création
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_quota_on_mission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Incrémenter le quota si c'est une entreprise
    IF NEW.entreprise_id IS NOT NULL THEN
        PERFORM public.increment_mission_quota(NEW.entreprise_id);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_increment_quota_mission
    AFTER INSERT ON public.missions
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_quota_on_mission();

COMMENT ON TRIGGER trigger_increment_quota_mission ON public.missions IS 'Incrémente le compteur de missions lors de création';

-- ----------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;

-- Plans : visible par tous (lecture seule sauf admin_jtec)
CREATE POLICY plans_select_all ON public.plans
    FOR SELECT
    USING (true);

CREATE POLICY plans_admin_all ON public.plans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users
            WHERE id = auth.uid()
            AND role = 'admin_jtec'
        )
    );

-- Abonnements : admin_jtec voit tout, client voit le sien
CREATE POLICY abonnements_select_admin ON public.abonnements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users
            WHERE id = auth.uid()
            AND role = 'admin_jtec'
        )
    );

CREATE POLICY abonnements_select_entreprise ON public.abonnements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users
            WHERE id = auth.uid()
            AND entreprise_id = abonnements.entreprise_id
        )
    );

CREATE POLICY abonnements_select_regie ON public.abonnements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users
            WHERE id = auth.uid()
            AND regie_id = abonnements.regie_id
        )
    );

CREATE POLICY abonnements_admin_all ON public.abonnements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users
            WHERE id = auth.uid()
            AND role = 'admin_jtec'
        )
    );

-- ----------------------------------------------------------------------------
-- 15. GRANTS
-- ----------------------------------------------------------------------------

-- Plans
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

-- Abonnements
GRANT SELECT ON public.abonnements TO authenticated;
GRANT ALL ON public.abonnements TO service_role;

-- Vues
GRANT SELECT ON public.abonnements_stats TO authenticated;
GRANT SELECT ON public.quotas_usage TO authenticated;

-- Fonctions
GRANT EXECUTE ON FUNCTION public.create_abonnement TO service_role;
GRANT EXECUTE ON FUNCTION public.get_current_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_access_module TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_quota TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_mission_quota TO service_role;
GRANT EXECUTE ON FUNCTION public.change_plan TO service_role;

-- ----------------------------------------------------------------------------
-- 16. DONNÉES INITIALES : Plans par défaut
-- ----------------------------------------------------------------------------

INSERT INTO public.plans (nom, nom_affichage, description, prix_mensuel, prix_annuel, limite_missions_mois, limite_techniciens, limite_utilisateurs, modules_actifs, ordre_affichage)
VALUES 
    (
        'basic',
        'Plan Basic',
        'Pour petites entreprises - limité à 10 missions/mois',
        49.00,
        490.00, -- 2 mois gratuits sur l'annuel
        10,
        3,
        5,
        '["facturation"]'::jsonb,
        1
    ),
    (
        'pro',
        'Plan Pro',
        'Pour entreprises moyennes - 50 missions/mois',
        149.00,
        1490.00,
        50,
        10,
        20,
        '["facturation", "messagerie", "planning"]'::jsonb,
        2
    ),
    (
        'enterprise',
        'Plan Enterprise',
        'Pour grandes entreprises - illimité',
        499.00,
        4990.00,
        NULL, -- Illimité
        NULL,
        NULL,
        '["facturation", "messagerie", "planning", "reporting", "api"]'::jsonb,
        3
    )
ON CONFLICT (nom) DO NOTHING;

-- ============================================================================
-- FIN ÉTAPE 15
-- ============================================================================
