-- =========================================================================
-- 02_rls_policies.sql
-- CONFIGURACIÓN DE POLÍTICAS DE SEGURIDAD (RLS) Y FUNCIÓN DE DESBLOQUEO
-- Sistema de Administración y Gestión de Vales (Entorno Demo)
-- =========================================================================
-- Ejecutar en el SQL Editor de Supabase después del seed.
-- Otorga permisos limpios de lectura/escritura a todas las tablas e instala
-- la función RPC de sincronización automática de calendario.
-- =========================================================================

-- 1. authorized_emails
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en authorized_emails" ON authorized_emails;
CREATE POLICY "Permitir todo a autenticados en authorized_emails"
ON authorized_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica authorized_emails" ON authorized_emails;
CREATE POLICY "Lectura publica authorized_emails"
ON authorized_emails FOR SELECT TO anon USING (true);

-- 2. user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en user_profiles" ON user_profiles;
CREATE POLICY "Permitir todo a autenticados en user_profiles"
ON user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica user_profiles" ON user_profiles;
CREATE POLICY "Lectura publica user_profiles"
ON user_profiles FOR SELECT TO anon USING (true);

-- 3. lideres
ALTER TABLE lideres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en lideres" ON lideres;
CREATE POLICY "Permitir todo a autenticados en lideres"
ON lideres FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica lideres" ON lideres;
CREATE POLICY "Lectura publica lideres"
ON lideres FOR SELECT TO anon USING (true);

-- 4. calendar_blocks
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en calendar_blocks" ON calendar_blocks;
CREATE POLICY "Permitir todo a autenticados en calendar_blocks"
ON calendar_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica calendar_blocks" ON calendar_blocks;
CREATE POLICY "Lectura publica calendar_blocks"
ON calendar_blocks FOR SELECT TO anon USING (true);

-- 5. daily_user_codes
ALTER TABLE daily_user_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en daily_user_codes" ON daily_user_codes;
CREATE POLICY "Permitir todo a autenticados en daily_user_codes"
ON daily_user_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica daily_user_codes" ON daily_user_codes;
CREATE POLICY "Lectura publica daily_user_codes"
ON daily_user_codes FOR SELECT TO anon USING (true);

-- 6. code_authorizations
ALTER TABLE code_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en code_authorizations" ON code_authorizations;
CREATE POLICY "Permitir todo a autenticados en code_authorizations"
ON code_authorizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica code_authorizations" ON code_authorizations;
CREATE POLICY "Lectura publica code_authorizations"
ON code_authorizations FOR SELECT TO anon USING (true);

-- 7. qr_registrations
ALTER TABLE qr_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en qr_registrations" ON qr_registrations;
CREATE POLICY "Permitir todo a autenticados en qr_registrations"
ON qr_registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica qr_registrations" ON qr_registrations;
CREATE POLICY "Lectura publica qr_registrations"
ON qr_registrations FOR SELECT TO anon USING (true);

-- 8. solicitudes_desbloqueo
ALTER TABLE solicitudes_desbloqueo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en solicitudes_desbloqueo" ON solicitudes_desbloqueo;
CREATE POLICY "Permitir todo a autenticados en solicitudes_desbloqueo"
ON solicitudes_desbloqueo FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica solicitudes_desbloqueo" ON solicitudes_desbloqueo;
CREATE POLICY "Lectura publica solicitudes_desbloqueo"
ON solicitudes_desbloqueo FOR SELECT TO anon USING (true);

-- 9. vales_contingencia_manual
ALTER TABLE vales_contingencia_manual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en vales_contingencia_manual" ON vales_contingencia_manual;
CREATE POLICY "Permitir todo a autenticados en vales_contingencia_manual"
ON vales_contingencia_manual FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica vales_contingencia_manual" ON vales_contingencia_manual;
CREATE POLICY "Lectura publica vales_contingencia_manual"
ON vales_contingencia_manual FOR SELECT TO anon USING (true);

-- 10. support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en support_tickets" ON support_tickets;
CREATE POLICY "Permitir todo a autenticados en support_tickets"
ON support_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir insercion y lectura publica support_tickets" ON support_tickets;
CREATE POLICY "Permitir insercion y lectura publica support_tickets"
ON support_tickets FOR ALL TO anon USING (true) WITH CHECK (true);

-- =========================================================================
-- FUNCIÓN RPC: Desbloqueo automático de vales al expirar fechas
-- =========================================================================
CREATE OR REPLACE FUNCTION update_user_status_by_calendar_blocks()
RETURNS jsonb AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_disabled_count INTEGER := 0;
    v_enabled_count INTEGER := 0;
    v_cleaned_dates INTEGER := 0;
BEGIN
    UPDATE user_profiles
    SET habilitado = false
    WHERE email IN (
        SELECT DISTINCT user_email
        FROM calendar_blocks
        WHERE user_email IS NOT NULL
        AND v_today BETWEEN fecha_inicio AND fecha_termino
    )
    AND (habilitado = true OR habilitado IS NULL);
    GET DIAGNOSTICS v_disabled_count = ROW_COUNT;

    UPDATE user_profiles up
    SET habilitado = true
    WHERE up.habilitado = false
    AND NOT EXISTS (
        SELECT 1
        FROM calendar_blocks cb
        WHERE cb.user_email = up.email
        AND v_today BETWEEN cb.fecha_inicio AND cb.fecha_termino
    )
    AND EXISTS (
        SELECT 1
        FROM calendar_blocks cb
        WHERE cb.user_email = up.email
        AND cb.fecha_termino < v_today
    );
    GET DIAGNOSTICS v_enabled_count = ROW_COUNT;

    UPDATE user_profiles
    SET vales_disabled_from = NULL,
        vales_disabled_to = NULL,
        habilitado = true
    WHERE vales_disabled_to IS NOT NULL
    AND vales_disabled_to < v_today
    AND NOT EXISTS (
        SELECT 1
        FROM calendar_blocks cb
        WHERE cb.user_email = user_profiles.email
        AND v_today BETWEEN cb.fecha_inicio AND cb.fecha_termino
    );
    GET DIAGNOSTICS v_cleaned_dates = ROW_COUNT;

    RETURN jsonb_build_object(
        'deshabilitados_hoy', v_disabled_count,
        'habilitados_automaticamente', v_enabled_count,
        'fechas_limpiadas', v_cleaned_dates
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
