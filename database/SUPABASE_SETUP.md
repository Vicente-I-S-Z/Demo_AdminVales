# 🚀 Guía de Configuración de Supabase (Entorno Demo)

Esta guía paso a paso te explica cómo crear un nuevo proyecto gratuito en **Supabase**, ejecutar el script para crear todas las tablas y poblar datos ficticios, y conectar el proyecto web para la presentación de tu informe de práctica.

---

## 📌 Paso 1: Crear nuevo proyecto en Supabase

1. Ingresa a [https://supabase.com](https://supabase.com) e inicia sesión (puedes usar tu cuenta de GitHub o correo personal).
2. En tu Dashboard, haz clic en **"New Project"**.
3. Selecciona tu organización y completa:
   - **Name:** `vales-admin-demo` (o el nombre que prefieras).
   - **Database Password:** Elige una contraseña segura y anótala.
   - **Region:** Selecciona `South America (São Paulo)` para menor latencia.
   - **Pricing Plan:** Free tier ($0).
4. Haz clic en **"Create new project"** y espera 1 a 2 minutos hasta que el proyecto esté activo.

---

## 📌 Paso 2: Crear el usuario Administrador en Supabase Auth

Para poder iniciar sesión en la web:
1. En el menú lateral izquierdo de tu proyecto Supabase, entra a **Authentication** > **Users**.
2. Haz clic en el botón verde **"Add user"** > **"Create user"**.
3. Ingresa los siguientes datos:
   - **User Email:** `admin@demo.com`
   - **User Password:** `Demo123456!` (o la clave que prefieras)
   - Marca la casilla **"Auto Confirm User?"** (para no requerir confirmación por correo).
4. Haz clic en **"Create user"**.

> 💡 **Nota:** La tabla `user_profiles` ya incluye a `admin@demo.com` con el rol `'admin'` en el script de datos ficticios, por lo que una vez creado en Auth podrás acceder de inmediato con todos los permisos.

---

## 📌 Paso 3: Ejecutar el Script SQL (1 solo clic)

1. En el menú lateral izquierdo de Supabase, entra a **SQL Editor**.
2. Haz clic en **"New query"**.
3. Abre el archivo:
   [`database/00_full_setup_and_seed.sql`](./00_full_setup_and_seed.sql)
4. Copia **todo su contenido**, pégalo en el editor SQL de Supabase y haz clic en el botón verde **"Run"** (o presiona `Ctrl + Enter`).
5. Verás el mensaje `Success. No rows returned`. ¡Listo! Las 10 tablas, funciones, políticas de seguridad RLS y datos ficticios ya estarán cargados.

*(Si prefieres ejecutarlo por partes, tienes los archivos `01_schema.sql`, `02_rls_policies.sql` y `03_seed_demo_data.sql`).*

---

## 📌 Paso 4: Conectar la aplicación con tu nuevo Supabase

1. En tu proyecto de Supabase, ve a **Project Settings** (ícono de engranaje abajo a la izquierda) > **API**.
2. Copia los siguientes valores:
   - **Project URL** (ej: `https://xyzcompany.supabase.co`)
   - **Project API keys** > `anon` / `public`
3. En la carpeta del proyecto demo `SistemaAdminWeb_Demo`:
   - Crea un archivo `.env` (puedes duplicar `.env.example`).
   - Pega tus claves:
     ```env
     VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
     VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
     ```

---

## 📌 Paso 5: Iniciar la Aplicación

Abre una terminal en `SistemaAdminWeb_Demo` y ejecuta:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor local
npm run dev
```

Abre tu navegador en `http://localhost:5173/login`:
- **Correo:** `admin@demo.com`
- **Contraseña:** `Demo123456!` (la que creaste en el Paso 2)

¡Ya tendrás el sistema funcionando al 100% con datos ficticios, sin logotipos confidenciales y listo para mostrar a tu profesor! 🎉
