-- =========================================================================
-- SCRIPT DE AUTOMATIZACIÓN: DESBLOQUEO AUTOMÁTICO Y GESTIÓN DE BLOQUEOS
-- =========================================================================
-- Ejecuta este script en el SQL Editor de tu panel de Supabase.
--
-- Regla de Negocio:
-- Si un usuario es bloqueado del 10 al 12 de septiembre:
-- - Durante el 10, 11 y 12 de septiembre su estado es 'habilitado = false' (Bloqueado).
-- - El día 13 de septiembre (fecha_termino < v_today en hora de Chile), el sistema lo
--   desbloquea automáticamente pasando a 'habilitado = true'.
-- =========================================================================

-- 1. Habilitar extensión pg_cron si está disponible
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN Y DESBLOQUEO AUTOMÁTICO
CREATE OR REPLACE FUNCTION update_user_status_by_calendar_blocks()
RETURNS jsonb AS $$
DECLARE
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;
    v_disabled_count INTEGER := 0;
    v_enabled_count INTEGER := 0;
    v_cleaned_dates INTEGER := 0;
BEGIN
    -- A. DESHABILITAR usuarios con bloqueo activo HOY (según zona horaria de Chile)
    -- (v_today está entre fecha_inicio y fecha_termino inclusive)
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

    -- B. HABILITAR usuarios cuyos bloqueos ya expiraron
    -- (fecha_termino < v_today, ej: bloqueo hasta el 12, hoy es 13 o más)
    -- y que NO tengan ningún otro bloqueo activo para hoy
    UPDATE user_profiles up
    SET habilitado = true
    WHERE up.habilitado = false
    -- No tiene bloqueos activos hoy
    AND NOT EXISTS (
        SELECT 1
        FROM calendar_blocks cb
        WHERE cb.user_email = up.email
        AND v_today BETWEEN cb.fecha_inicio AND cb.fecha_termino
    )
    -- Pero sí tiene o tuvo un bloqueo en calendar_blocks que ya concluyó
    AND EXISTS (
        SELECT 1
        FROM calendar_blocks cb
        WHERE cb.user_email = up.email
        AND cb.fecha_termino < v_today
    );

    GET DIAGNOSTICS v_enabled_count = ROW_COUNT;

    -- C. Limpiar campos históricos vales_disabled_from / vales_disabled_to en user_profiles si ya expiraron
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
        'fechas_limpiadas', v_cleaned_dates,
        'fecha_chile', v_today,
        'ejecutado_el', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_user_status_by_calendar_blocks IS 'Actualiza automáticamente el estado habilitado según calendar_blocks en hora de Chile. Desbloquea al día siguiente de la fecha de término.';

-- 3. TRIGGER INMEDIATO AL INSERTAR O ACTUALIZAR BLOQUEO
CREATE OR REPLACE FUNCTION apply_calendar_block_on_change()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;
BEGIN
    -- Si la fecha de hoy en Chile cae dentro del rango de fechas del bloqueo, deshabilitar inmediatamente
    IF v_today BETWEEN NEW.fecha_inicio AND NEW.fecha_termino THEN
        UPDATE user_profiles
        SET habilitado = false
        WHERE email = NEW.user_email;
    -- Si el bloqueo ya expiró y no tiene otros activos, habilitar
    ELSIF v_today > NEW.fecha_termino THEN
        IF NOT EXISTS (
            SELECT 1 FROM calendar_blocks
            WHERE user_email = NEW.user_email
            AND v_today BETWEEN fecha_inicio AND fecha_termino
            AND id != NEW.id
        ) THEN
            UPDATE user_profiles
            SET habilitado = true
            WHERE email = NEW.user_email;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_apply_calendar_block_insert ON calendar_blocks;
CREATE TRIGGER trigger_apply_calendar_block_insert
    AFTER INSERT ON calendar_blocks
    FOR EACH ROW
    EXECUTE FUNCTION apply_calendar_block_on_change();

DROP TRIGGER IF EXISTS trigger_apply_calendar_block_update ON calendar_blocks;
CREATE TRIGGER trigger_apply_calendar_block_update
    AFTER UPDATE ON calendar_blocks
    FOR EACH ROW
    WHEN (OLD.fecha_inicio IS DISTINCT FROM NEW.fecha_inicio OR OLD.fecha_termino IS DISTINCT FROM NEW.fecha_termino)
    EXECUTE FUNCTION apply_calendar_block_on_change();

-- 4. TRIGGER INMEDIATO AL ELIMINAR BLOQUEO
CREATE OR REPLACE FUNCTION handle_calendar_block_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;
BEGIN
    -- Si no le quedan otros bloqueos activos hoy en Chile, habilitar al usuario
    IF NOT EXISTS (
        SELECT 1 FROM calendar_blocks
        WHERE user_email = OLD.user_email
        AND v_today BETWEEN fecha_inicio AND fecha_termino
        AND id != OLD.id
    ) THEN
        UPDATE user_profiles
        SET habilitado = true
        WHERE email = OLD.user_email;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_calendar_block_delete ON calendar_blocks;
CREATE TRIGGER trigger_handle_calendar_block_delete
    AFTER DELETE ON calendar_blocks
    FOR EACH ROW
    EXECUTE FUNCTION handle_calendar_block_on_delete();

-- 5. PROGRAMACIÓN CRON A LAS 00:01 (MEDIANOCHE EN HORA DE CHILE)
-- En UTC-3, medianoche (00:01 Chile) corresponde a las 03:01 UTC.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('update-user-status-by-blocks');
        PERFORM cron.schedule(
            'update-user-status-by-blocks',
            '1 3 * * *',
            'SELECT update_user_status_by_calendar_blocks();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible o permisos insuficientes, la sincronización se realizará vía aplicación web.';
END;
$$;

-- 6. Ejecutar una primera vez para sincronizar estado actual
SELECT update_user_status_by_calendar_blocks();
