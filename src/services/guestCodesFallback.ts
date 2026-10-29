// Diccionario de respaldo de códigos de invitado para entorno Demo / Presentación
export interface GuestCodeInfo {
  nombre: string;
  empresa: string;
  issuer: string;
}

export const GUEST_CODES_FALLBACK: Record<string, GuestCodeInfo> = {
  "GUEST-1001-2026": {
    "nombre": "Carlos Mendoza",
    "empresa": "Empresa Alpha",
    "issuer": "lider.alpha@demo.com"
  },
  "GUEST-1002-2026": {
    "nombre": "Francisca Silva",
    "empresa": "Empresa Alpha",
    "issuer": "lider.alpha@demo.com"
  },
  "GUEST-1003-2026": {
    "nombre": "Rodrigo Morales",
    "empresa": "Empresa Beta",
    "issuer": "lider.beta@demo.com"
  },
  "GUEST-1004-2026": {
    "nombre": "Camila Soto",
    "empresa": "Empresa Beta",
    "issuer": "lider.beta@demo.com"
  },
  "GUEST-1005-2026": {
    "nombre": "Javier Rojas",
    "empresa": "Empresa Alpha",
    "issuer": "admin@demo.com"
  }
};
