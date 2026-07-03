## Introducción

Durante una revisión de seguridad web es común encontrar cabeceras como:

```http
Access-Control-Allow-Origin: *
```

A primera vista puede parecer una mala configuración grave, porque el símbolo `*` significa que cualquier origen puede leer la respuesta desde el navegador. Sin embargo, esta cabecera por sí sola no siempre representa una vulnerabilidad explotable.

CORS no es un mecanismo de autenticación ni una protección contra ataques del lado servidor. CORS es una política del navegador que define qué sitios externos pueden leer respuestas de otro dominio mediante JavaScript.

Por eso, ver `Access-Control-Allow-Origin: *` no significa automáticamente que exista exposición de datos sensibles, robo de sesión o account takeover. Para que sea explotable, debe existir una combinación peligrosa: un origen atacante permitido, credenciales habilitadas y una respuesta con datos sensibles.

## Caso informativo: `Access-Control-Allow-Origin: *`

Un caso común es encontrar una respuesta como esta:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json

{"status":"public"}
```

Esto significa que cualquier origen puede leer esa respuesta desde el navegador.

Pero si el contenido es público, no autenticado y no contiene datos sensibles, normalmente esto queda como un hallazgo informativo.

Ejemplo:

```text
https://domain.com/api/public-status
```

Respuesta:

```json
{
  "status": "ok",
  "version": "1.0",
  "public": true
}
```

En este escenario no hay impacto real, porque cualquier usuario podría acceder a esa información directamente sin autenticarse.

Conclusión:

```text
Access-Control-Allow-Origin: * + datos públicos = normalmente informativo
```

## Ejemplo de CORS vulnerable

CORS significa Cross-Origin Resource Sharing. En simple, es una regla del navegador que decide si el JavaScript cargado desde un dominio puede leer respuestas de otro dominio.

En este ejemplo hay tres roles:

```text
Víctima  → usuario con sesión iniciada en domain.com
Atacante → controla attacker.example
Objetivo → domain.com, donde existe una API con datos del usuario
```

La víctima ya está autenticada en:

```text
https://domain.com
```

Luego abre una página controlada por el atacante:

```text
https://attacker.example
```

Esa página sirve su propio JavaScript malicioso desde `attacker.example`:

```html
<script>
fetch("https://domain.com/api/me", {
  credentials: "include"
})
.then(response => response.text())
.then(data => {
  console.log(data);
});
</script>
```

Ese JavaScript vive en `attacker.example`, pero intenta leer datos desde:

```text
https://domain.com/api/me
```

La petición puede llegar a `domain.com`, incluso con cookies si el navegador las incluye. Pero el punto clave es que el navegador revisa las cabeceras CORS devueltas por `domain.com` para decidir si el JavaScript de `attacker.example` puede leer la respuesta.

Un caso vulnerable ocurre cuando `domain.com` permite explícitamente el origen del atacante y además permite credenciales:

```http
GET /api/me HTTP/1.1
Host: domain.com
Origin: https://attacker.example
Cookie: session=USER_SESSION
```

Respuesta vulnerable:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://attacker.example
Access-Control-Allow-Credentials: true
Content-Type: application/json

{
  "email": "user@domain.com",
  "role": "admin"
}
```

Aquí sí existe riesgo, porque `domain.com` está diciendo:

```text
Permito que https://attacker.example lea esta respuesta autenticada.
```

Este abuso se vuelve relevante cuando se juntan estas condiciones: la víctima está autenticada en `domain.com`, abre una página controlada por el atacante en `attacker.example`, `domain.com` permite ese origen con `Access-Control-Allow-Origin: https://attacker.example`, responde con `Access-Control-Allow-Credentials: true` y la respuesta contiene datos sensibles. Con esa combinación, el navegador permitiría que el JavaScript de `attacker.example` lea información autenticada de la víctima.

## Por qué `*` suele ser solo informativo

La cabecera:

```http
Access-Control-Allow-Origin: *
```

significa que cualquier origen puede leer esa respuesta desde el navegador. Esto puede sonar peligroso, pero normalmente no permite leer datos privados de usuarios autenticados.

El caso que realmente interesa para un ataque CORS es cuando el servidor permite un origen específico controlado por el atacante y además permite credenciales:

```http
Access-Control-Allow-Origin: https://attacker.example
Access-Control-Allow-Credentials: true
```

Con esa combinación, si la víctima tiene sesión iniciada en `domain.com` y la respuesta contiene datos sensibles, el JavaScript cargado desde `attacker.example` podría leer la respuesta autenticada.

Por eso, `Access-Control-Allow-Origin: *` por sí solo normalmente no es suficiente para confirmar una vulnerabilidad. Lo importante es confirmar si una web externa puede leer datos sensibles autenticados.

## Diferencia entre informativo y vulnerable

La clave no es solo ver una cabecera CORS, sino confirmar si una web externa puede leer datos sensibles autenticados.

|Escenario|Lectura correcta|
|---|---|
|`Access-Control-Allow-Origin: *` en endpoint público|Normalmente informativo|
|`Access-Control-Allow-Origin: *` sin datos sensibles|No hay impacto demostrable|
|`Access-Control-Allow-Origin: https://attacker.example` + `Access-Control-Allow-Credentials: true`|Configuración peligrosa: el navegador permitiría lectura desde el origen atacante|
|Configuración peligrosa + respuesta con datos sensibles autenticados|Vulnerabilidad confirmada|
|Configuración peligrosa pero respuesta pública/sin datos sensibles|Riesgo bajo o sin impacto demostrable|

Resumen:

```text
ACAO: * = normalmente informativo.
ACAO específico para attacker.example + Credentials true = configuración peligrosa.
Configuración peligrosa + datos sensibles autenticados = vulnerabilidad confirmada.
```

## Prueba segura con `curl`

Una forma simple de revisar CORS es enviar un header `Origin` controlado y observar la respuesta.

```bash
curl -sk -D /tmp/cors_headers.txt -H "Origin: https://attacker.example" "https://domain.com/api/me" -o /tmp/cors_body.txt
grep -Ei 'access-control-allow-origin|access-control-allow-credentials|content-type|set-cookie|cache-control' /tmp/cors_headers.txt
head -c 500 /tmp/cors_body.txt
```

Resultado normalmente informativo:

```http
Access-Control-Allow-Origin: *
```

si la respuesta no contiene datos sensibles.

Resultado peligroso:

```http
Access-Control-Allow-Origin: https://attacker.example
Access-Control-Allow-Credentials: true
```

especialmente si el body contiene datos del usuario autenticado.

Ejemplo de body sensible:

```json
{
  "email": "user@domain.com",
  "role": "admin"
}
```

## Conclusión

`Access-Control-Allow-Origin: *` no es automáticamente una vulnerabilidad. Es una señal que debe analizarse con contexto.

La pregunta correcta no es:

```text
¿Existe Access-Control-Allow-Origin: *?
```

La pregunta correcta es:

```text
¿Una web externa puede leer datos sensibles autenticados?
```

Si solo existe `Access-Control-Allow-Origin: *` sobre contenido público, normalmente es informativo. Si `domain.com` permite un origen atacante específico con `Access-Control-Allow-Credentials: true` y devuelve datos sensibles del usuario autenticado, entonces sí existe una vulnerabilidad CORS real.