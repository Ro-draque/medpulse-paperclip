# Evolución de MEDPULSE

MEDPULSE es hoy un prototipo local. Paperclip coordina tareas, Codex CLI ejecuta trabajo asistido por IA y el centro privado registra decisiones editoriales. El dashboard muestra evidencia exportada. La prueba de WhatsApp se ejecutó contra un simulador HTTP local.

## 1 Base para un piloto

- **Datos comerciales reales.** Integrar fuentes autorizadas de clientes, ventas e inventario. Definir qué sistema manda para cada dato y registrar el origen, alcance por canal y revocación de cada consentimiento.
- **Reglas e IA.** Resolver stock, fechas, puntuaciones y reglas de elegibilidad con lógica comprobable. Reservar la IA para resumir, interpretar información no estructurada y redactar propuestas con revisión humana.
- **Modelos mediante API.** Migrar gradualmente las tareas que necesitan IA desde Codex CLI a modelos accesibles mediante API, una interfaz que permite llamarlos desde el producto. Evaluar calidad, coste y trazabilidad en cada migración. Mantener Paperclip como coordinador si satisface los requisitos de operación y auditoría del piloto.

## 2 Operación e integraciones

- **Seguridad por empresa.** Incorporar cuentas individuales, permisos por rol, gestión de secretos y registros de auditoría. Aislar los datos de cada empresa y verificar ese aislamiento antes de incorporar clientes reales.
- **Ejecución en la nube.** Habilitar tareas programadas sin depender de una PC encendida. Incorporar monitoreo, alertas y presupuestos por agente, con límites de gasto y seguimiento de ejecuciones fallidas.
- **Canales oficiales.** Resolver el acceso al portafolio empresarial de Meta y configurar WhatsApp Cloud API e Instagram Graph API. Validar permisos y cuentas de prueba. Separar la aprobación editorial de la autorización de envío o publicación y registrar las respuestas de Meta.

## 3 Medición del piloto

Medir propuestas aprobadas, envíos o publicaciones confirmados, respuestas, cotizaciones y ventas atribuibles. Registrar también bajas, fallos y coste por resultado. Usar esos datos para decidir si ampliar el piloto.
