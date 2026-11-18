# Restaurar acceso de agentes + bucle del panel de marcas — v2.3

## Qué pasó (2 causas)

**1. `/api/auth/login` → 500 "Error al iniciar sesión. Intenta de nuevo."**
En el último despliegue se subió el `src/models/User.js` **de banco de pruebas**
(subconjunto sin métodos ni hooks). El controlador llama `user.compararPassword()`
→ `TypeError` → 500. Además ese archivo no tenía `verificado`, así que aunque el
método existiera, todos los logins habrían dado 403 "Debes verificar tu cuenta",
y el registro habría guardado contraseñas SIN hashear (sin `pre('save')`).

**2. Panel de marcas en bucle: "No pudimos cargar tu panel / Sin conexión"**
`marcas-api.js` construye las URL con `API_URL` tal cual. Si la página se abre
con `www.` y `API_URL` no lo tiene (o al revés), o va en `http://`/`localhost`,
el navegador BLOQUEA el fetch (CORS/mixed-content) → el fetch muere con
status 0 → "Sin conexión" → Reintentar recarga y vuelve a fallar. El login de
agentes no sufía de esto porque usa rutas relativas.

## Los 5 archivos y dónde va cada uno

| Archivo de este paquete | Ruta en tu repo |
|---|---|
| `User.js` | `src/models/User.js` |
| `auth.controller.js` | `src/controllers/auth.controller.js` |
| `email.js` | `src/utils/email.js` |
| `marcas-api.js` | `public/js/marcas-api.js` (donde tengas el JS público) |
| `marca-panel.html` | `public/pages/marca-panel.html` (donde tengas las páginas) |

- `User.js` es un **superset** production-ready: `compararPassword`, hook
  bcrypt en `pre('save')`, y TODOS los campos que el backend consume
  (verificación, 2FA, Stripe, KYB, etc.). No borra nada.
- `auth.controller.js` = tu versión corregida + `compararPasswordSegura()`
  (fix 20): aunque el modelo vuelva a quedar recortado, el login NO vuelve a
  dar 500.
- `email.js` = compatibilidad completa: las 5 funciones de banco + las 6 que
  exige auth (verificación, bienvenida, recuperación, alerta 2FA, KYB).
  Sin `EMAIL_USER/EMAIL_PASS` omite el envío con warning; no crashea.
- `marcas-api.js` v2.3 normaliza TODO al origen de la página (www↔desnudo,
  http→https, localhost en producción) y añade detalle al error de red.
  Verificación visual: consola muestra `[marcas-api] v2.3`.
- `marca-panel.html` v2.3: usa la URL normalizada en "continuar sesión".
  Verificación visual: consola muestra `[marca-panel] v2.3`.

## Pasos

1. Reemplaza los 5 archivos en tu repo (respeta las rutas de la tabla).
2. `git add` de los 5 + `git commit -m "fix: modelo User superset (login agentes) + marcas-api v2.3 mismo-origen"` + `git push`.
3. Espera el redeploy de Hostinger y confirma que el hash desplegado es el nuevo.
4. Ctrl+F5 (cache) en login.html y en el panel.
5. Prueba: iniciar sesión en `/pages/login.html` → debe entrar. Abrir el panel
   de marcas → debe cargar.

## Variables de entorno a verificar en Hostinger

- `JWT_SECRET` y `JWT_REFRESH_SECRET` — si faltan, el login responde 500 con
  `[auth] Configuracion de JWT ausente` en el log del servidor.
- `ORIGENES_PERMITIDOS` (o como lo llames en app.js) — incluye AMBOS:
  `https://somosvivemas.com` **y** `https://www.somosvivemas.com`.
- `EMAIL_USER` / `EMAIL_PASS` — para que lleguen códigos de verificación y
  enlaces de recuperación.
- Opcional `RESET_URL_TEMPLATE=https://somosvivemas.com/pages/TU-PAGINA.html?token={TOKEN}`
  si tu página de restablecer contraseña no es `/restablecer.html`.

## Notas

- Si alguien se registró durante la ventana en que el modelo estaba recortado,
  su contraseña quedó sin hashear: que use "¿Olvidaste tu contraseña?" o se la
  restableces desde admin.
- Los avisos CSP del console (report-only) NO son la causa de nada; son ruido.

## Si el panel de marcas aún fallara

Reporta exactamente: (1) la URL del navegador, (2) en DevTools → Network, la
petición en rojo: URL completa y estado, (3) el texto tras `(detalle:` en el
mensaje del panel. Con eso se cierra en una pasada.
