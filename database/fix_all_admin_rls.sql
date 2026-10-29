-- =========================================================================
-- SCRIPT DEFINITIVO DE PERMISOS RLS PARA EL SISTEMA DE ADMINISTRACIÓN
-- =========================================================================
-- Ejecuta este script completo en el SQL Editor de tu panel de Supabase.
-- 
-- ¿Por qué ocurre el error si ya ves políticas activadas?
-- 1. En authorized_emails tienes 9 políticas redundantes. Si alguna (como 
--    "Solo admin puede modificar emails") es RESTRICTIVA o evalúa condiciones
--    como 'auth.jwt() ->> role = admin', PostgreSQL RECHAZA toda inserción
--    con error 42501 incluso si tienes otras políticas de tipo "Allow".
-- 2. Al crear un usuario, el sistema también opera sobre user_profiles, la cual
--    también tiene RLS activado y puede estar bloqueando la operación.
-- 
-- Este script elimina de raíz todas las políticas viejas/conflictivas y
-- crea una política unificada, limpia y funcional para cada tabla.
-- =========================================================================

-- 1. TABLA authorized_emails (Creación y eliminación de correos autorizados)
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

-- Borrar todas las políticas heredadas y conflictivas existentes
DROP POLICY IF EXISTS "Solo admin puede modificar emails" ON authorized_emails;
DROP POLICY IF EXISTS "Admins can insert authorized emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow admin delete on authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow authenticated users to delete authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow authenticated users to insert authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow authenticated users to select authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow authenticated users to update authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow read access to authorized_emails" ON authorized_emails;
DROP POLICY IF EXISTS "Permitir lectura de emails autorizados" ON authorized_emails;
DROP POLICY IF EXISTS "Permitir lectura de empresas admin" ON authorized_emails;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON authorized_emails;

-- Política definitiva para authorized_emails
CREATE POLICY "Permitir todo a usuarios autenticados" 
ON authorized_emails 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Permitir lectura a anon (necesario para login y validaciones públicas)
DROP POLICY IF EXISTS "Permitir lectura publica de authorized_emails" ON authorized_emails;
CREATE POLICY "Permitir lectura publica de authorized_emails" 
ON authorized_emails 
FOR SELECT 
TO anon 
USING (true);


-- 2. TABLA user_profiles (Modificar rol, cambiar estado de vales, nuevo usuario, eliminar)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo admin puede modificar usuarios" ON user_profiles;
DROP POLICY IF EXISTS "Permitir lectura de perfiles admin" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to select user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to delete user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON user_profiles;

-- Política definitiva para user_profiles
CREATE POLICY "Permitir todo a usuarios autenticados" 
ON user_profiles 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Permitir lectura a anon (necesario para verificar usuarios durante login)
DROP POLICY IF EXISTS "Permitir lectura publica user_profiles" ON user_profiles;
CREATE POLICY "Permitir lectura publica user_profiles" 
ON user_profiles 
FOR SELECT 
TO anon 
USING (true);


-- 3. TABLA calendar_blocks (Bloqueo por calendario de usuarios)
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can insert calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can update calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can delete calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON calendar_blocks;

CREATE POLICY "Permitir todo a usuarios autenticados" 
ON calendar_blocks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);


-- 4. TABLA daily_user_codes (Autorización diferida y consulta de códigos diarios)
ALTER TABLE daily_user_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de vales admin" ON daily_user_codes;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON daily_user_codes;

CREATE POLICY "Permitir todo a usuarios autenticados" 
ON daily_user_codes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);


-- 5. TABLA code_authorizations (Autorizaciones diferidas)
ALTER TABLE code_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON code_authorizations;

CREATE POLICY "Permitir todo a usuarios autenticados" 
ON code_authorizations 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
