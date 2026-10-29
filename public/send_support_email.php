<?php
/**
 * Relay de correo de Soporte TI (MODO DEMO)
 *
 * En esta versión de demostración las notificaciones por correo están desactivadas.
 * Este archivo no envía correos ni se conecta a servicios externos: solo responde
 * OK para mantener compatibilidad con el frontend.
 */

header('Content-Type: application/json; charset=utf-8');
http_response_code(200);

echo json_encode([
    'success' => true,
    'demo' => true,
    'message' => 'Modo demo: notificaciones por correo desactivadas.',
    'notifications' => ['admin' => false, 'user' => false],
]);
