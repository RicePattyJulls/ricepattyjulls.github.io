Hay aplicaciones donde no todo pasa por endpoints REST clásicos. A veces la lógica más interesante vive en canales en tiempo real: chats, notificaciones, webmail, dashboards, colas, eventos internos o sincronización de estado. Ahí entra WebSocket.

WebSocket es un canal de comunicación persistente entre cliente y servidor. A diferencia de HTTP normal, donde haces request → response y la conexión termina, WebSocket mantiene una conexión abierta y permite comunicación en ambos sentidos.

Se usa mucho para:

- Webmail en tiempo real.
- Chats.
- Notificaciones.
- IMAP/mailbox live updates.
- Dashboards.
- Eventos internos del frontend.

Socket.IO es una librería que puede usar WebSocket o fallback HTTP polling. En vez de trabajar solo con requests tradicionales, suele manejar eventos con una lógica parecida a esta:

```bash
emit("evento")
on("evento")
```

En pentest, revisar Socket.IO sirve para descubrir funcionalidades que no siempre aparecen como rutas REST visibles. Por ejemplo:

```text
imap_start_connection
imap_open_folder
imap_get_messages_list
send_message
delete_message
update_settings
```

Lo interesante no es solo encontrar eventos, sino validar si respetan autorización, ownership y permisos del usuario autenticado.

## 1. Enumerar eventos desde el frontend

Antes de conectarse al WebSocket, conviene mirar el JavaScript del frontend. Muchas aplicaciones SPA cargan bundles grandes donde viven rutas, eventos, nombres de funciones, endpoints y lógica cliente.

> Una SPA, o Single Page Application, es una aplicación web donde el navegador carga una página principal y luego usa JavaScript para renderizar vistas, llamar APIs y manejar rutas internas sin recargar toda la página. En pentest, revisar sus bundles JS puede revelar endpoints, rutas ocultas, eventos Socket.IO y flujos internos.

El comando más directo para empezar es buscar eventos emitidos por el frontend:

```bash
# Enumerar eventos Socket.IO emitidos por el frontend desde un bundle JavaScript
grep -oE 'emit\("[^"]*"' app.js | sort -u
```

También es útil buscar listeners definidos en el cliente:

```bash
# Enumerar listeners Socket.IO definidos en el frontend
grep -oE 'socket\.on\("[^"]*"' app.js | sort -u
```

La diferencia rápida:

```text
emit("evento")  → normalmente el cliente envía algo al servidor.
on("evento")    → normalmente el cliente escucha algo que viene del servidor.
```

## 2. Variables generales

Para mantenerlo reusable en entornos autorizados, puedes trabajar con variables genéricas.

```bash
# Definir variables generales del target autorizado
BASE_URL="https://example.test"
JWT="jwt_valido_del_usuario"
USER_EMAIL="usuario@example.test"
TARGET_EMAIL="target@example.test"
JS_FILE="app.js"
```

## 3. Descargar el bundle JavaScript principal

El primer objetivo es obtener el JavaScript que usa el frontend. Ahí puede aparecer el endpoint de Socket.IO, rutas API y nombres de eventos.

```bash
# Descargar el bundle JavaScript principal para analizar rutas y eventos
curl -s "$BASE_URL/static/js/app.js" -o "$JS_FILE"
```

## 4. Enumeración de rutas y eventos

Con el bundle descargado, la idea es buscar rutas relacionadas con Socket.IO, APIs internas y eventos emitidos o escuchados por el frontend.

```bash
# Buscar rutas relacionadas con Socket.IO dentro del JavaScript
grep -oE '"/api/[^"]*"' "$JS_FILE" | grep -i "socket" | sort -u

# Buscar todas las rutas API encontradas en el JavaScript
grep -oE '"/api/[^"]*"' "$JS_FILE" | sort -u

# Enumerar eventos Socket.IO que el frontend escucha desde el servidor
grep -oE 'socket\.on\("[^"]*"' "$JS_FILE" | sort -u

# Enumerar eventos que el frontend emite hacia el servidor
grep -oE 'emit\("[^"]*"' "$JS_FILE" | sort -u

# Filtrar solo eventos relacionados con IMAP, mail o mensajes
grep -oE 'emit\("[^"]*"' "$JS_FILE" | grep -iE "imap|mail|message|folder|send|delete|move|copy" | sort -u

# Extraer eventos IMAP de forma más limpia usando Python
python3 -c "import re; f=open('app.js','rb').read().decode('utf-8',errors='replace'); print('\n'.join(sorted(set(re.findall(r'emit\(\"(imap_[^\"]+)\"', f)))))"

# Buscar contexto alrededor de un evento específico
python3 -c "f=open('app.js','rb').read().decode('utf-8',errors='replace'); idx=f.find('imap_start_connection'); print(f[idx-300:idx+500])"

# Buscar referencias a flujo delegado o cambio de usuario
python3 -c "import re; f=open('app.js','rb').read().decode('utf-8',errors='replace'); [print(f[m.start()-200:m.start()+400]+'\n---') for m in re.finditer('delegate|loginAsUser|userPermissions', f, re.I)]"
```

Esta parte es la fase de lectura. No estás explotando nada todavía; estás entendiendo cómo habla el frontend con el backend en tiempo real.

## 5. Conectarse al endpoint Socket.IO

Cuando ya tienes el endpoint y un JWT válido, puedes abrir una conexión con `wscat`.

```bash
# Conectarse al endpoint Socket.IO usando un JWT válido
wscat -c "$BASE_URL/api/socket.io/?token=$JWT&EIO=4&transport=websocket"
```

Después del handshake inicial, Socket.IO suele requerir inicializar la sesión con `40`.

```bash
# Inicializar la sesión Socket.IO después del handshake inicial
40
```

## 6. Probar flujo IMAP normal del usuario autenticado

Primero conviene validar el comportamiento normal con tu propio usuario. Esto sirve como baseline: si tu usuario puede abrir su INBOX, listar mensajes o iniciar conexión IMAP, ya entiendes cómo debería verse un flujo válido.

```bash
# Iniciar conexión IMAP normal para el usuario autenticado
42["imap_start_connection",{"username":"usuario@example.test"}]

# Abrir la carpeta INBOX del usuario autenticado
42["imap_open_folder",{"folder":"INBOX"}]

# Listar la primera página de mensajes de INBOX
42["imap_get_messages_list",{"folder":"INBOX","page":1}]

# Mantener viva la conexión respondiendo al ping del servidor
3
```

Aquí la pregunta no es solo “¿funciona?”, sino “¿el backend liga correctamente el JWT con el usuario que se está pidiendo abrir?”.

## 7. Validar autorización en flujos delegados

Algunas aplicaciones permiten acciones delegadas: abrir recursos de otro usuario, actuar como delegado, revisar buzones compartidos o usar permisos heredados. Eso no es malo por sí mismo. Lo importante es que el servidor valide si tu sesión realmente tiene derecho a hacerlo.

```bash
# Probar conexión delegada hacia otro usuario, solo para validar autorización
42["imap_start_connection_delegate",{"username":"target@example.test"}]

# Probar conexión delegada incluyendo permisos enviados desde cliente
42["imap_start_connection_delegate",{"username":"target@example.test","userPermissions":"all"}]

# Intentar abrir INBOX del usuario objetivo para verificar control de acceso
42["imap_open_folder",{"folder":"INBOX","email":"target@example.test"}]

# Intentar listar mensajes del usuario objetivo para validar si hay IDOR o bloqueo correcto
42["imap_get_messages_list",{"folder":"INBOX","email":"target@example.test","page":1}]
```

La validación importante es esta:

```text
¿El servidor confía en el username/email enviado por el cliente?
¿O valida contra la identidad real del JWT?
```

Si el cliente puede elegir otro usuario y el backend procesa esa identidad sin autorización fuerte, puede existir un problema de ownership, IDOR o delegación mal implementada.

## 8. Cerrar la conexión IMAP

Después de la prueba, se puede cerrar o detener la conexión IMAP activa.

```bash
# Cerrar o detener la conexión IMAP activa
42["imap_stop_connection",{}]
```

## Idea clave

Socket.IO no es “solo frontend bonito”. Puede exponer operaciones sensibles en tiempo real. En un webmail, por ejemplo, esos eventos pueden mapear carpetas, mensajes, permisos, sesiones, delegaciones y acciones sobre buzones.

La mentalidad correcta no es buscar payloads raros, sino responder estas preguntas:

```text
¿Qué eventos existen?
¿Qué parámetros acepta cada evento?
¿El servidor valida ownership?
¿El JWT corresponde al usuario solicitado?
¿Se puede cambiar username/email desde el cliente?
¿Los permisos vienen del servidor o el cliente puede enviarlos?
¿Los errores revelan diferencias útiles?
```

## Defensive takeaways

```text
1. No confiar en username, email o permisos enviados desde el cliente.
2. Validar siempre la identidad del JWT en el backend.
3. Aplicar ownership checks por cada evento sensible.
4. Evitar que permisos como userPermissions sean controlables desde frontend.
5. Registrar eventos WebSocket sensibles igual que endpoints REST.
6. Alertar ante intentos de acceder a recursos de otros usuarios.
7. Revisar bundles JS como superficie pública, no como zona privada.
8. Usar errores genéricos cuando un evento falla por autorización.
```

Una API REST mal autorizada puede ser peligrosa. Un WebSocket mal autorizado también. La diferencia es que muchas veces el WebSocket queda fuera del checklist clásico, y ahí es donde aparecen los bugs interesantes.