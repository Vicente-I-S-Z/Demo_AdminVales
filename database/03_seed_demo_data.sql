-- =========================================================================
-- 03_seed_demo_data.sql
-- POBLADO DE DATOS FICTICIOS PARA DEMOSTRACIÓN Y PRESENTACIÓN ACADÉMICA
-- Sistema de Administración y Gestión de Vales (Entorno Demo)
-- =========================================================================
-- Ejecutar en el SQL Editor de Supabase.
-- =========================================================================

-- =========================================================================
-- PASO 1: LIBERACIÓN TOTAL DE RESTRICCIONES 'NOT NULL' EN TODAS LAS TABLAS
-- Elimina de raíz cualquier error 23502 (NOT NULL) en TODAS las columnas secundarias.
-- =========================================================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Quitar la restricción NOT NULL de cualquier columna que no sea Primary Key
    -- en las 10 tablas del sistema para asegurar compatibilidad total con datos demo
    FOR r IN 
        SELECT c.table_name, c.column_name 
        FROM information_schema.columns c
        LEFT JOIN (
            SELECT kcu.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name 
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY' 
              AND tc.table_schema = 'public'
        ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
        WHERE c.table_schema = 'public'
          AND pk.column_name IS NULL
          AND c.is_nullable = 'NO'
          AND c.table_name IN (
              'solicitudes_desbloqueo', 'support_tickets', 'vales_contingencia_manual', 
              'qr_registrations', 'code_authorizations', 'daily_user_codes', 
              'calendar_blocks', 'lideres', 'user_profiles', 'authorized_emails'
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL;', r.table_name, r.column_name);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;

    -- Asegurar existencia de fecha_bloqueada en solicitudes_desbloqueo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'solicitudes_desbloqueo' AND column_name = 'fecha_bloqueada'
    ) THEN
        ALTER TABLE public.solicitudes_desbloqueo ADD COLUMN fecha_bloqueada DATE DEFAULT CURRENT_DATE;
    END IF;

    -- Asegurar fecha_codigo en code_authorizations con valor por defecto
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'code_authorizations' AND column_name = 'fecha_codigo'
    ) THEN
        ALTER TABLE public.code_authorizations ALTER COLUMN fecha_codigo SET DEFAULT CURRENT_DATE;
    ELSE
        ALTER TABLE public.code_authorizations ADD COLUMN IF NOT EXISTS fecha_codigo DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- =========================================================================
-- PASO 2: LIMPIEZA DE TABLAS
-- =========================================================================
TRUNCATE TABLE solicitudes_desbloqueo, support_tickets, vales_contingencia_manual, 
               qr_registrations, code_authorizations, daily_user_codes, 
               calendar_blocks, lideres, user_profiles, authorized_emails RESTART IDENTITY CASCADE;

-- =========================================================================
-- PASO 3: INSERCIÓN DE DATOS DEMO
-- =========================================================================

-- 1. authorized_emails (Lista blanca institucional)
INSERT INTO authorized_emails (email, empresa, created_at) VALUES
('admin@demo.com', 'Empresa Alpha', NOW() - INTERVAL '60 days'),
('lider.alpha@demo.com', 'Empresa Alpha', NOW() - INTERVAL '58 days'),
('lider.beta@demo.com', 'Empresa Beta', NOW() - INTERVAL '58 days'),
('juan.perez@demo.com', 'Empresa Alpha', NOW() - INTERVAL '50 days'),
('maria.gonzalez@demo.com', 'Empresa Alpha', NOW() - INTERVAL '45 days'),
('carlos.tapia@demo.com', 'Empresa Alpha', NOW() - INTERVAL '42 days'),
('ana.martinez@demo.com', 'Empresa Alpha', NOW() - INTERVAL '40 days'),
('pedro.soto@demo.com', 'Empresa Alpha', NOW() - INTERVAL '38 days'),
('lucia.rojas@demo.com', 'Empresa Alpha', NOW() - INTERVAL '35 days'),
('diego.morales@demo.com', 'Empresa Alpha', NOW() - INTERVAL '30 days'),
('claudia.silva@demo.com', 'Empresa Beta', NOW() - INTERVAL '50 days'),
('javier.castillo@demo.com', 'Empresa Beta', NOW() - INTERVAL '45 days'),
('valentina.herrera@demo.com', 'Empresa Beta', NOW() - INTERVAL '40 days'),
('felipe.espinoza@demo.com', 'Empresa Beta', NOW() - INTERVAL '36 days'),
('camila.torres@demo.com', 'Empresa Beta', NOW() - INTERVAL '32 days'),
('matias.valenzuela@demo.com', 'Empresa Beta', NOW() - INTERVAL '28 days'),
('constanza.munoz@demo.com', 'Empresa Beta', NOW() - INTERVAL '25 days'),
('ignacio.bravo@demo.com', 'Empresa Alpha', NOW() - INTERVAL '20 days'),
('fernanda.carrasco@demo.com', 'Empresa Beta', NOW() - INTERVAL '15 days'),
('roberto.vargas@demo.com', 'Empresa Alpha', NOW() - INTERVAL '10 days');

-- 2. user_profiles (Perfiles de usuarios y administradores)
INSERT INTO user_profiles (email, nombre, apellidos, empresa, rol, habilitado, vales_disabled_from, vales_disabled_to, created_at) VALUES
('admin@demo.com', 'Administrador', 'General TI', 'Empresa Alpha', 'admin', TRUE, NULL, NULL, NOW() - INTERVAL '60 days'),
('lider.alpha@demo.com', 'Carlos', 'Mendoza Fuentes', 'Empresa Alpha', 'lider', TRUE, NULL, NULL, NOW() - INTERVAL '58 days'),
('lider.beta@demo.com', 'Francisca', 'Silva Orellana', 'Empresa Beta', 'lider', TRUE, NULL, NULL, NOW() - INTERVAL '58 days'),
('juan.perez@demo.com', 'Juan Pablo', 'Pérez Garrido', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '50 days'),
('maria.gonzalez@demo.com', 'María Paz', 'González Leiva', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '45 days'),
('carlos.tapia@demo.com', 'Carlos Alberto', 'Tapia Miranda', 'Empresa Alpha', 'usuario', FALSE, CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days', NOW() - INTERVAL '42 days'),
('ana.martinez@demo.com', 'Ana Victoria', 'Martínez Cifuentes', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '40 days'),
('pedro.soto@demo.com', 'Pedro Ignacio', 'Soto Reyes', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '38 days'),
('lucia.rojas@demo.com', 'Lucía Andrea', 'Rojas Navarro', 'Empresa Alpha', 'usuario', FALSE, NULL, NULL, NOW() - INTERVAL '35 days'),
('diego.morales@demo.com', 'Diego Alejandro', 'Morales Pavez', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '30 days'),
('claudia.silva@demo.com', 'Claudia Irene', 'Silva Bravo', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '50 days'),
('javier.castillo@demo.com', 'Javier Andrés', 'Castillo Loyola', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '45 days'),
('valentina.herrera@demo.com', 'Valentina Sol', 'Herrera Díaz', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '40 days'),
('felipe.espinoza@demo.com', 'Felipe Eduardo', 'Espinoza Pinto', 'Empresa Beta', 'usuario', FALSE, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', NOW() - INTERVAL '36 days'),
('camila.torres@demo.com', 'Camila Belén', 'Torres Acuña', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '32 days'),
('matias.valenzuela@demo.com', 'Matías Agustín', 'Valenzuela Rivas', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '28 days'),
('constanza.munoz@demo.com', 'Constanza Francisca', 'Muñoz Toledo', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '25 days'),
('ignacio.bravo@demo.com', 'Ignacio José', 'Bravo Vera', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '20 days'),
('fernanda.carrasco@demo.com', 'Fernanda Ignacia', 'Carrasco Vidal', 'Empresa Beta', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '15 days'),
('roberto.vargas@demo.com', 'Roberto Hernán', 'Vargas Salazar', 'Empresa Alpha', 'usuario', TRUE, NULL, NULL, NOW() - INTERVAL '10 days');

-- 3. lideres (Nómina de líderes de cuadrilla para autorizaciones)
INSERT INTO lideres (numero_lider, nombre, email, created_at) VALUES
('1', 'Carlos Mendoza Fuentes', 'lider.alpha@demo.com', NOW() - INTERVAL '58 days'),
('2', 'Francisca Silva Orellana', 'lider.beta@demo.com', NOW() - INTERVAL '58 days'),
('3', 'Rodrigo Morales Sepúlveda', 'lider.alpha@demo.com', NOW() - INTERVAL '30 days');

-- 4. calendar_blocks (Bloqueos de calendario de vales)
INSERT INTO calendar_blocks (user_email, fecha_inicio, fecha_termino, descripcion, created_by, created_at) VALUES
('carlos.tapia@demo.com', CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days', 'Vacaciones Legales 1er Período', NULL, NOW() - INTERVAL '1 day'),
('felipe.espinoza@demo.com', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'Permiso Administrativo / Capacitación', NULL, NOW() - INTERVAL '3 days'),
('maria.gonzalez@demo.com', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '4 days', 'Licencia Médica Curativa', NULL, NOW() - INTERVAL '12 days'),
('lucia.rojas@demo.com', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '14 days', 'Comisión de Servicios en Faena Norte', NULL, NOW() - INTERVAL '2 days');

-- 5. daily_user_codes (Códigos diarios y códigos de invitado GUEST)
INSERT INTO daily_user_codes (user_email, auth_user_id, codigo_diario, fecha_generacion, hora_generacion, is_used, fecha_uso, created_at, updated_at, qr_data, user_name, empresa, nombre_invitado, apellido_invitado) VALUES
-- Códigos de Hoy
('juan.perez@demo.com', NULL, 'JUAPE-00101-TODAY', CURRENT_DATE, NOW() - INTERVAL '3 hours', TRUE, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', '{"dailyCode":"JUAPE-00101-TODAY","email":"juan.perez@demo.com","app":"ValesDemo"}', 'Juan Pablo', 'Empresa Alpha', NULL, NULL),
('maria.gonzalez@demo.com', NULL, 'MARGO-00102-TODAY', CURRENT_DATE, NOW() - INTERVAL '2 hours', FALSE, NULL, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', '{"dailyCode":"MARGO-00102-TODAY","email":"maria.gonzalez@demo.com","app":"ValesDemo"}', 'María Paz', 'Empresa Alpha', NULL, NULL),
('claudia.silva@demo.com', NULL, 'CLASI-00103-TODAY', CURRENT_DATE, NOW() - INTERVAL '4 hours', TRUE, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', '{"dailyCode":"CLASI-00103-TODAY","email":"claudia.silva@demo.com","app":"ValesDemo"}', 'Claudia Irene', 'Empresa Beta', NULL, NULL),
('valentina.herrera@demo.com', NULL, 'VALHE-00104-TODAY', CURRENT_DATE, NOW() - INTERVAL '1 hour', FALSE, NULL, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', '{"dailyCode":"VALHE-00104-TODAY","email":"valentina.herrera@demo.com","app":"ValesDemo"}', 'Valentina Sol', 'Empresa Beta', NULL, NULL),
('lider.alpha@demo.com', NULL, 'GUEST-1001-2026', CURRENT_DATE, NOW() - INTERVAL '5 hours', TRUE, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour 30 minutes', '{"dailyCode":"GUEST-1001-2026","generatedBy":"lider.alpha@demo.com","empresa":"Empresa Alpha","app":"ValesDemo"}', 'Carlos Mendoza', 'Empresa Alpha', 'Carlos', 'Mendoza'),
('lider.beta@demo.com', NULL, 'GUEST-1003-2026', CURRENT_DATE, NOW() - INTERVAL '3 hours', FALSE, NULL, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', '{"dailyCode":"GUEST-1003-2026","generatedBy":"lider.beta@demo.com","empresa":"Empresa Beta","app":"ValesDemo"}', 'Francisca Silva', 'Empresa Beta', 'Rodrigo', 'Morales'),

-- Códigos Históricos para Cierre Mensual y Estadísticas (Mes Actual y Pasado)
('juan.perez@demo.com', NULL, 'JUAPE-00091-2026', CURRENT_DATE - INTERVAL '1 day', NOW() - INTERVAL '1 day 4 hours', TRUE, NOW() - INTERVAL '1 day 2 hours', NOW() - INTERVAL '1 day 4 hours', NOW() - INTERVAL '1 day 2 hours', '{"dailyCode":"JUAPE-00091-2026"}', 'Juan Pablo', 'Empresa Alpha', NULL, NULL),
('maria.gonzalez@demo.com', NULL, 'MARGO-00092-2026', CURRENT_DATE - INTERVAL '1 day', NOW() - INTERVAL '1 day 5 hours', TRUE, NOW() - INTERVAL '1 day 3 hours', NOW() - INTERVAL '1 day 5 hours', NOW() - INTERVAL '1 day 3 hours', '{"dailyCode":"MARGO-00092-2026"}', 'María Paz', 'Empresa Alpha', NULL, NULL),
('claudia.silva@demo.com', NULL, 'CLASI-00093-2026', CURRENT_DATE - INTERVAL '2 days', NOW() - INTERVAL '2 days 4 hours', TRUE, NOW() - INTERVAL '2 days 2 hours', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 2 hours', '{"dailyCode":"CLASI-00093-2026"}', 'Claudia Irene', 'Empresa Beta', NULL, NULL),
('pedro.soto@demo.com', NULL, 'PEDSO-00094-2026', CURRENT_DATE - INTERVAL '3 days', NOW() - INTERVAL '3 days 4 hours', TRUE, NOW() - INTERVAL '3 days 2 hours', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 2 hours', '{"dailyCode":"PEDSO-00094-2026"}', 'Pedro Ignacio', 'Empresa Alpha', NULL, NULL),
('diego.morales@demo.com', NULL, 'DIEMO-00095-2026', CURRENT_DATE - INTERVAL '4 days', NOW() - INTERVAL '4 days 4 hours', TRUE, NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 2 hours', '{"dailyCode":"DIEMO-00095-2026"}', 'Diego Alejandro', 'Empresa Alpha', NULL, NULL),
('javier.castillo@demo.com', NULL, 'JAVCA-00096-2026', CURRENT_DATE - INTERVAL '5 days', NOW() - INTERVAL '5 days 4 hours', TRUE, NOW() - INTERVAL '5 days 2 hours', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 2 hours', '{"dailyCode":"JAVCA-00096-2026"}', 'Javier Andrés', 'Empresa Beta', NULL, NULL),
('camila.torres@demo.com', NULL, 'CAMTO-00097-2026', CURRENT_DATE - INTERVAL '6 days', NOW() - INTERVAL '6 days 4 hours', TRUE, NOW() - INTERVAL '6 days 2 hours', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 2 hours', '{"dailyCode":"CAMTO-00097-2026"}', 'Camila Belén', 'Empresa Beta', NULL, NULL),
('matias.valenzuela@demo.com', NULL, 'MATVA-00098-2026', CURRENT_DATE - INTERVAL '7 days', NOW() - INTERVAL '7 days 4 hours', TRUE, NOW() - INTERVAL '7 days 2 hours', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 2 hours', '{"dailyCode":"MATVA-00098-2026"}', 'Matías Agustín', 'Empresa Beta', NULL, NULL),
('constanza.munoz@demo.com', NULL, 'CONMU-00099-2026', CURRENT_DATE - INTERVAL '8 days', NOW() - INTERVAL '8 days 4 hours', TRUE, NOW() - INTERVAL '8 days 2 hours', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 2 hours', '{"dailyCode":"CONMU-00099-2026"}', 'Constanza Francisca', 'Empresa Beta', NULL, NULL),
('roberto.vargas@demo.com', NULL, 'ROBVA-00100-2026', CURRENT_DATE - INTERVAL '9 days', NOW() - INTERVAL '9 days 4 hours', TRUE, NOW() - INTERVAL '9 days 2 hours', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 2 hours', '{"dailyCode":"ROBVA-00100-2026"}', 'Roberto Hernán', 'Empresa Alpha', NULL, NULL);

-- 6. code_authorizations (Autorizaciones diferidas activadas)
INSERT INTO code_authorizations (codigo_diario, fecha_codigo, is_authorized, created_at) VALUES
('JUAPE-00101-TODAY', CURRENT_DATE, TRUE, NOW() - INTERVAL '1 hour'),
('GUEST-1001-2026', CURRENT_DATE, TRUE, NOW() - INTERVAL '2 hours'),
('JUAPE-00091-2026', CURRENT_DATE - INTERVAL '1 day', TRUE, NOW() - INTERVAL '1 day');

-- 7. qr_registrations (Validaciones registradas en restaurantes de convenio)
INSERT INTO qr_registrations (qr_code, date, time, restaurante, created_at) VALUES
('JUAPE-00101-TODAY', CURRENT_DATE, '13:15:20', 'Casino Central', NOW() - INTERVAL '1 hour'),
('CLASI-00103-TODAY', CURRENT_DATE, '13:40:15', 'Cafetería Gourmet', NOW() - INTERVAL '2 hours'),
('GUEST-1001-2026', CURRENT_DATE, '14:02:10', 'Bistró Express', NOW() - INTERVAL '1 hour 30 minutes'),
('JUAPE-00091-2026', CURRENT_DATE - INTERVAL '1 day', '13:20:00', 'Casino Central', NOW() - INTERVAL '1 day 2 hours'),
('MARGO-00092-2026', CURRENT_DATE - INTERVAL '1 day', '13:35:10', 'Cafetería Gourmet', NOW() - INTERVAL '1 day 3 hours'),
('CLASI-00093-2026', CURRENT_DATE - INTERVAL '2 days', '12:55:40', 'Casino Central', NOW() - INTERVAL '2 days 2 hours'),
('PEDSO-00094-2026', CURRENT_DATE - INTERVAL '3 days', '13:10:05', 'Restaurante Don Pedro', NOW() - INTERVAL '3 days 2 hours'),
('DIEMO-00095-2026', CURRENT_DATE - INTERVAL '4 days', '13:45:12', 'Casino Central', NOW() - INTERVAL '4 days 2 hours'),
('JAVCA-00096-2026', CURRENT_DATE - INTERVAL '5 days', '14:10:30', 'Bistró Express', NOW() - INTERVAL '5 days 2 hours'),
('CAMTO-00097-2026', CURRENT_DATE - INTERVAL '6 days', '13:05:18', 'Cafetería Gourmet', NOW() - INTERVAL '6 days 2 hours'),
('MATVA-00098-2026', CURRENT_DATE - INTERVAL '7 days', '13:30:25', 'Casino Central', NOW() - INTERVAL '7 days 2 hours'),
('CONMU-00099-2026', CURRENT_DATE - INTERVAL '8 days', '13:12:44', 'Restaurante Don Pedro', NOW() - INTERVAL '8 days 2 hours'),
('ROBVA-00100-2026', CURRENT_DATE - INTERVAL '9 days', '12:48:32', 'Casino Central', NOW() - INTERVAL '9 days 2 hours');

-- 8. vales_contingencia_manual (Vales físicos de respaldo)
INSERT INTO vales_contingencia_manual (nombre_trabajador, empresa, restaurante, fecha_consumo, notas, created_at) VALUES
('Ignacio José Bravo Vera', 'Empresa Alpha', 'Casino Central', CURRENT_DATE - INTERVAL '2 days', 'Corte de energía eléctrica en lector QR de recepción', NOW() - INTERVAL '2 days'),
('Fernanda Ignacia Carrasco Vidal', 'Empresa Beta', 'Casino Central', CURRENT_DATE - INTERVAL '3 days', 'Falla de cobertura de red móvil en punto de consumo', NOW() - INTERVAL '3 days'),
('Diego Alejandro Morales Pavez', 'Empresa Alpha', 'Cafetería Gourmet', CURRENT_DATE - INTERVAL '5 days', 'Equipo móvil en reparación con servicio técnico', NOW() - INTERVAL '5 days');

-- 9. solicitudes_desbloqueo (Solicitudes de supervisores pendientes de revisión)
INSERT INTO solicitudes_desbloqueo (numero_lider, user_email, fecha_bloqueada, justificacion, created_at) VALUES
('1', 'carlos.tapia@demo.com', CURRENT_DATE, 'Colaborador fue reasignado de urgencia a faena operativa por reemplazo de turno extraordinario.', NOW() - INTERVAL '4 hours'),
('2', 'felipe.espinoza@demo.com', CURRENT_DATE - INTERVAL '1 day', 'Capacitación presencial finalizó antes de lo previsto; colaborador retoma funciones operativas hoy.', NOW() - INTERVAL '1 day'),
('1', 'lucia.rojas@demo.com', CURRENT_DATE + INTERVAL '7 days', 'Cancelación de viaje programado por condiciones climáticas adversas en faena norte.', NOW() - INTERVAL '2 days');

-- 10. support_tickets (Incidencias y tickets de mesa de ayuda TI)
INSERT INTO support_tickets (ticket_code, sistema_origen, titulo, descripcion, categoria, prioridad, estado, reportado_por, reportado_por_nombre, solucion, resuelto_por, fecha_resolucion, created_at, updated_at) VALUES
('TK-2026-1001', 'vales_admin', 'Dificultad en lectura de código en Casino Central', 'El escáner del punto de validación no reconoce el brillo de pantalla en teléfonos de turnos de tarde.', 'codigos_qr', 'alta', 'abierto', 'juan.perez@demo.com', 'Juan Pablo Pérez', NULL, NULL, NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('TK-2026-1002', 'vales_admin', 'Solicitud de bloqueo por feriado compensatorio', 'Requerimos programar el bloqueo de vales para 4 colaboradores que tendrán descanso el próximo viernes.', 'vales_bloqueos', 'media', 'en_revision', 'lider.alpha@demo.com', 'Carlos Mendoza', NULL, NULL, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),
('TK-2026-1003', 'vales_admin', 'Validación de planilla de cierre mensual GDH', 'Confirmación de las columnas de contingencia y porcentajes asignados en la exportación Excel.', 'cierre_mensual', 'baja', 'resuelto', 'admin@demo.com', 'Administrador General', 'Se verificó la conciliación de fórmulas en ExcelJS; todas las validaciones cuadran al 100%.', 'admin@demo.com', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 hours');
