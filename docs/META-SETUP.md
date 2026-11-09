# Pruebas oficiales de Meta · separadas de MED-6

El ejecutor local [meta-smoke.mjs](../scripts/meta-smoke.mjs) se probó con respuestas simuladas. No hay conexión de cuenta, envíos ni publicaciones reales verificados. No se usa desde Paperclip, Vercel ni el dashboard. No usa contraseñas, no copia sesiones y no toma destinatarios de la campaña sintética.

## WhatsApp Cloud API

1. Iniciá sesión personalmente en [Meta for Developers](https://developers.facebook.com/apps/). Creá o abrí una app de prueba con el caso de uso de WhatsApp. Entrá en **WhatsApp → API Setup** (puede figurar como **API Test**).
2. Seleccioná el **número de prueba provisto por Meta** como origen. En el campo de destinatarios agregá tu número personal y verificá el código en Meta. Tu número es el destinatario; no lo registres como remitente. No pulses **Send message**.
3. Copiá localmente el **Phone Number ID** del número de prueba y el token temporal con acceso a mensajería. La primera prueba usa la plantilla de Meta `hello_world` en `en_US`, no el mensaje de MED-6. [Ejemplo oficial de Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-13fca11d-873b-4db4-82d0-38e1ae5dbbe8).

## Instagram API con Facebook Login

1. Usá una cuenta de Instagram **profesional** (Business o Creator) que controles y vinculala a una página de Facebook que administres. Configurá Instagram API con Facebook Login en tu app Meta. Para la prueba, usá una cuenta y página propias, con el rol necesario en la app.
2. En [Graph API Explorer](https://developers.facebook.com/tools/explorer/) seleccioná tu app, iniciá sesión y solicitá `pages_show_list`, `pages_read_engagement`, `instagram_basic` e `instagram_content_publish`. Identificá tu página en `GET /me/accounts?fields=name,access_token,tasks,instagram_business_account`. Usá localmente el token de esa página y el ID de `instagram_business_account`. No compartas la respuesta completa. [Colección oficial de Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf).
3. Elegí un JPEG de prueba no sensible y alojalo en una URL HTTPS pública estable que controles. Meta necesita poder obtener el archivo. El caption sugerido es **“Prueba técnica de MEDPULSE: señales comerciales trazables y revisión humana. Demostración sin oferta de productos.”** Revisá la imagen y el texto antes de autorizar. Publicar en una cuenta profesional puede hacer visible la prueba a sus seguidores.

## Configuración local y revisión

Creá un archivo **meta.env** en una carpeta MEDPULSE dentro de **%LOCALAPPDATA%**, fuera de OneDrive y del repositorio. Completá solo el canal que estés probando. No pegues tokens ni tu número en el chat, Paperclip, GitHub o Vercel.

```dotenv
META_GRAPH_VERSION=
META_WA_TEST_PHONE_ID=
META_WA_TEST_RECIPIENT=
META_WA_ACCESS_TOKEN=
META_IG_USER_ID=
META_IG_PAGE_TOKEN=
META_IG_IMAGE_URL=
# META_IG_CAPTION=
MEDPULSE_META_ALLOW_LIVE=0
```

Usá la versión `vN.N` que figure en el ejemplo de tu panel Meta. Estos comandos solo guardan el plan local, sin llamadas a Meta:

```powershell
node --env-file="$env:LOCALAPPDATA\MEDPULSE\meta.env" scripts/meta-smoke.mjs whatsapp plan
node --env-file="$env:LOCALAPPDATA\MEDPULSE\meta.env" scripts/meta-smoke.mjs instagram plan
```

El plan guarda cuenta o destinatario, texto, destino y un ID que vence en una hora. La consola oculta el número completo. Avisá cuando hayas configurado un canal; revisaremos el plan exacto y te pediré autorización separada para ese único intento. Ejecutar requiere habilitación local de modo real y el ID del plan explícitamente aprobado. Un cambio de destino o texto invalida la autorización. Se conserva un recibo local por intento y no se reintenta automáticamente.

Para WhatsApp, un ID de mensaje indica que Meta aceptó la solicitud; la recepción se confirma en el teléfono o mediante el estado de entrega de un webhook. Para Instagram, el adaptador solo publica al confirmar que el contenedor está listo; devuelve su ID y el ID de la publicación para verificar en el perfil.
