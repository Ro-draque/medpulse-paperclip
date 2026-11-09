# Centro privado de aprobaciones

## Inicio en Windows

1. Desde la raíz del repositorio, iniciá Paperclip con `./scripts/paperclip.ps1 run` si todavía no está activo. Se requiere Paperclip 2026.1106.0 en `http://127.0.0.1:3100`, modo `local_trusted`, y Node 24.11 o posterior.
2. En una instalación nueva, ejecutá una sola vez `./scripts/setup-approvals.ps1` desde PowerShell. Genera tres contraseñas aleatorias y prepara la carpeta privada con acceso exclusivo de tu usuario de Windows. En la instalación de la demo ya se ejecutó. No copies ni compartas el archivo.
3. Desde la raíz ejecutá `node scripts/approvals-server.mjs`. Abrí [Revisión humana](http://127.0.0.1:4174/#review) en el mismo equipo.
4. Elegí Valentina Demo (`valentina`), Martín Demo (`martin`) o Sofía Demo (`sofia`). Consultá tu contraseña en `%LOCALAPPDATA%\MEDPULSE-Approvals\credenciales-demo.txt`. Usá «Cerrar sesión» antes de prestar el equipo o cambiar de persona.
5. Leé el borrador vigente, revisá su imagen y destino y elegí «Aprobar borrador» o «Solicitar cambios». El comentario es opcional. El ID aparece cuando Paperclip confirma la decisión. Sofía Demo, la cuenta de Gerencia, puede consultar el historial con la identidad, el rol, la revisión y la referencia de cada decisión.
6. Si la operación queda sin confirmación, usá «Conciliar con Paperclip». Esto solo consulta. Si no hay prueba suficiente o la versión cambió durante la escritura, el bloqueo sigue activo y requiere revisión manual. La aprobación es editorial. Solicitar cambios devuelve la tarea al ejecutor configurado en Paperclip.

## Reproducción aislada

`node --test scripts/approvals.test.mjs` prueba permisos, sesiones, revisiones y fallos controlados. Para una prueba real, con el centro iniciado, ejecutá `node scripts/approvals-create-demos.mjs`. Anotá los dos IDs impresos y pasalos en ese orden a `node scripts/verify-approvals-demo.mjs ID_WHATSAPP ID_INSTAGRAM`. El verificador se niega a operar sobre las tres campañas originales y coteja sus estados y revisiones antes y después.

En la ejecución del 9 de noviembre de 2026, MED-23 registró aprobación de Valentina (decisión `0b83210d-712d-40fc-a2b1-84099df78cf8`) y MED-24 registró el pedido de cambios de Martín (decisión `9b93f869-6f92-4c6a-ae36-ec2a77d51586`). Se verificó el inicio de sesión de Sofía y se consultaron MED-6, MED-15 y MED-20, que siguieron pendientes con sus revisiones originales.

## Límites

- Las contraseñas se verifican mediante scrypt con sal individual. SQLite guarda los hashes, los límites de intentos, las sesiones y la auditoría fuera del repositorio. El archivo privado de entrega contiene las contraseñas demo para que la operadora pueda consultarlas. Las tres cuentas tienen permiso de revisión.
- El puerto 4174 escucha exclusivamente en loopback. El centro de Vercel usa sesiones separadas y una función que se comunica con el centro anfitrión por un túnel autenticado. Las decisiones remotas se limitan a los ensayos. La base y las credenciales permanecen en el anfitrión. [Acceso desde Vercel](../README.md#acceso-empleados)
- Paperclip registra como `local-board`. La identidad demo se verifica y registra en MEDPULSE. La API local de Paperclip en modo confiable sigue siendo accesible para otros procesos con acceso a la máquina.
- La API de decisión de Paperclip carece de una precondición atómica por revisión. El centro serializa sus propias operaciones, verifica la versión antes y después y bloquea resultados ambiguos. Si alguien edita o decide directamente en Paperclip durante la operación, podría existir una decisión en Paperclip que MEDPULSE marque como conflicto. Evitá operar desde ambas interfaces a la vez.
- El centro no invoca adaptadores de WhatsApp ni Instagram. La configuración de los adaptadores y las evidencias existentes se conservan.
