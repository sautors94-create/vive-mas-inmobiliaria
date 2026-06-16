# vive-mas-inmobiliaria — Checklist lanzamiento (1 julio)

## Objetivo
Lanzar la plataforma web nacional sin romper flujos existentes (ya funciona con `npm run dev`).

## Regla
Paso a paso: cada cambio se valida localmente antes de continuar.

---

## Fase 1 — “Seguro para producción” (prioridad máxima)
- [x] (1) Corregir `public/js/api.js` para que la API no apunte a `http://localhost:3000` (usar ruta relativa `/api`).
- [x] (2) Agregar manejo de expiración de sesión en frontend:
  - [x] Detectar `401`/token inválido al hacer requests
  - [x] Mostrar mensaje claro: “Tu sesión expiró, inicia sesión nuevamente”
  - [x] Limpiar estado (localStorage)
  - [x] Redirigir a `login.html`
- [x] (3) (Opcional, si no rompe) Intentar refrescar sesión automáticamente antes de reloguear usando `/api/auth/refresh`.
  - [x] Probar que refresh funciona con cookie `refreshToken` (httpOnly)

---

## Fase 2 — Seguridad y cuentas (planificado, posterior al lanzamiento)
- [x] (4) Login con teléfono O email (obligatorio al menos uno). (Backend + Front)
- [ ] (5) RFC + INE (KYC) — campos + subida de archivos + endpoints.
  - [x] Plan técnico aprobado
  - [ ] Implementar modelo User (rfc + kyc)
  - [ ] Implementar endpoint protegido POST /api/auth/kyc
  - [ ] Probar 401/400/200
- [ ] (6) 2FA en 2 pasos (OTP) — endpoints + pantallas + flujo.
- [ ] (7) Plan “Pro” => mantener “Próximamente” (no tocar reglas de cobro hoy).

---

## Fase 3 — Chatbots (antes del lanzamiento, para que no rompan)
- [x] (8) Revisar ambos chatbots existentes (frontend + backend) para:
  - [x] Que apunten a rutas correctas de API
  - [x] Que no fallen si la API URL cambia
  - [x] Manejo de errores UX (mensajes al usuario)
- [x] (9) Ajustes de calidad:
  - [x] Internacionalización básica ES/EN/PT
  - [ ] Mejorar prompts / respuestas
  - [ ] Limitar rate/consumo (si aplica)
  - [ ] Asegurar modo internacional en más pantallas

---

## Fase 4 — QA lanzamiento (check final)
- [ ] (10) Probar en local:
  - [x] `/health`
  - [x] rutas API principales y protegidas
  - [x] login por email/teléfono (400/401/200 + normalización)
  - [ ] UI visual completa (flujo login + expiración de sesión)
  - [ ] Registro + verificación end-to-end visual
  - [ ] Dashboard y rutas protegidas (admin/user) visual
- [ ] (11) Probar en “modo producción” (simulado):
  - [ ] Confirmar frontend + `/api` en entorno no-localhost.

---

## Evidencia reciente
- [x] Fase 2 avance: login por teléfono o email implementado y validado (400/401/200).
- [x] Prueba adicional: teléfonos con espacios/guiones normalizados y login exitoso (200).

## Fecha objetivo
- [ ] Lanzamiento: 1 de julio
