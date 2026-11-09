# Entrega · estado y pasos

El repositorio público de entrega es [Ro-draque/medpulse-paperclip](https://github.com/Ro-draque/medpulse-paperclip). Quedan pendientes el enlace de Vercel y la grabación de Loom.

1. **GitHub.** Para actualizar la entrega, revisá la lista generada por `node scripts/audit-release.mjs` y publicá solo los archivos permitidos. Las carpetas locales de ejecución, las credenciales y las exportaciones privadas quedan fuera del repositorio.
2. **Vercel:** iniciá sesión en [Vercel](https://vercel.com/new), conectá GitHub, seleccioná el repositorio y usá la raíz del proyecto y **Other** como framework. El archivo vercel.json ya indica el build y el directorio dist/dashboard. El dashboard estático no necesita tokens. Tras desplegar, abrir la URL con el acceso del evaluador y comprobar el recibo HTTP de MED-22 y la revisión de MED-6.
3. **Loom:** iniciá sesión en [Loom](https://www.loom.com/), elegí pantalla y micrófono, seguí el [guion de 2:20](LOOM-SCRIPT.md) y verificá permisos del enlace en otra sesión. No grabar paneles con claves, archivos locales sensibles, teléfonos ni tokens.
4. Agregá las tres URLs al README y verificá que sean accesibles para el evaluador. La versión entregable no depende de conectar Meta o completar pruebas reales.

Antes de publicar: `node --test scripts/*.test.mjs`, `node scripts/build-dashboard.mjs`, `node scripts/audit-release.mjs`. El dashboard se sirve como sitio estático: no accede a la base de Paperclip ni permite ejecutar envíos.
