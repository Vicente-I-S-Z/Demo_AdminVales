-- =========================================================================
-- SCRIPT DE REPARACIÓN DE POLÍTICAS RLS PARA LA TABLA calendar_blocks
-- =========================================================================
-- Este script permite que los administradores autenticados desde la aplicación
-- web puedan insertar, consultar, actualizar y eliminar bloqueos sin que
-- Supabase bloquee la petición con el error 42501 (Unauthorized / RLS).
-- =========================================================================

-- 1. Asegurar que RLS esté activo en la tabla
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas restrictivas anteriores que fallaban por mayúsculas o vinculación de auth
DROP POLICY IF EXISTS "Admins can view all calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can insert calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can update calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Admins can delete calendar blocks" ON calendar_blocks;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON calendar_blocks;

-- 3. Crear política permisiva para administradores y usuarios autenticados
CREATE POLICY "Permitir todo a usuarios autenticados" 
ON calendar_blocks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
