# SnowRail MCP Server

Servidor MCP que expone los endpoints de SnowRail (tesorería y orquestador de pagos en Avalanche) como herramientas utilizables por agentes compatibles con el Model Context Protocol.

## Requisitos

- Node.js >= 20
- pnpm (recomendado para manejar las dependencias declaradas en `pnpm-lock.yaml`)

## Instalación y uso

```bash
pnpm install         # instala dependencias
pnpm dev             # ejecuta el servidor MCP en modo desarrollo usando tsx
pnpm build           # compila a JavaScript (salida en dist/)
pnpm start           # corre la versión compilada
```

El servidor habla por STDIO (patrón recomendado para MCP) y se inicializa desde `src/snowrail-mcp.ts`.

## Variables de entorno

| Variable             | Por defecto | Descripción |
|----------------------|-------------|-------------|
| `SNOWRAIL_MCP_MODE`  | `core`      | Determina qué herramientas se registran. Valores válidos: `core`, `advanced`, `internal`. |
| `SNOWRAIL_ENV`       | `staging`   | Selecciona qué base URL usar (`development`, `staging`, `production`). |
| `SNOWRAIL_API_BASE`  | –           | URL absoluta para sobrescribir la base calculada con `SNOWRAIL_ENV`. |

La resolución final de la URL se maneja desde `resolveBaseUrl` y `snowrailFetch`, permitiendo override por tool mediante los parámetros `environment` o `baseUrl`.

## Modos y herramientas disponibles

Todas las herramientas retornan el resultado como contenido textual MCP (`text/json`). Los parámetros se validan con Zod antes de llamar al backend.

### Modo `core`

| Tool | Endpoint | Notas |
|------|----------|-------|
| `snowrail_health` | `GET /health` | Diagnóstico básico del backend. |
| `snowrail_agent_identity` | `GET /api/agent/identity` | Identidad del agente registrado. |
| `snowrail_agent_stats` | `GET /api/agent/stats` | Estadísticas del agente. |
| `snowrail_agent_activity` | `GET /api/agent/activity` | Historial de actividad. |
| `snowrail_treasury_balance` | `GET /api/treasury/balance` | Balance general de la tesorería. |
| `snowrail_payroll_execute` | `POST /api/payroll/execute` | Demo payroll protegido con header `X-PAYMENT`. |
| `snowrail_payroll_get_by_id` | `GET /api/payroll/:id` | Obtiene un payroll específico. |
| `snowrail_payment_process` | `POST /api/payment/process` | Flujo completo de pago a destinatario final (requiere `X-PAYMENT`). |
| `snowrail_treasury_test` | `POST /api/treasury/test` | Prueba controlada de tesorería (`X-PAYMENT`). |
| `snowrail_facilitator_health` | `GET /facilitator/health` | Salud del facilitador x402. |
| `snowrail_process_a2a` | `POST /process` | Mensajes Agent-to-Agent firmados (`X-PAYMENT`). |

### Modo `advanced`

Disponible cuando `SNOWRAIL_MCP_MODE` es `advanced` o `internal`.

| Tool | Endpoint | Notas |
|------|----------|-------|
| `snowrail_facilitator_validate` | `POST /facilitator/validate` | Valida tokens x402. |
| `snowrail_facilitator_verify` | `POST /facilitator/verify` | Verifica firmas EIP-3009. |
| `snowrail_facilitator_settle` | `POST /facilitator/settle` | Liquidación de pagos con `paymentProof`. |

### Modo `internal`

Disponible sólo cuando `SNOWRAIL_MCP_MODE=internal`. Suma herramientas sensibles y endpoints privados.

| Tool | Endpoint | Notas |
|------|----------|-------|
| `snowrail_x402_callback` | `POST /internal/x402/callback` | Simula callbacks del procesador x402. |
| `snowrail_auth_signup` | `POST /auth/signup` | Alta de cuentas para dashboard. |
| `snowrail_auth_login` | `POST /auth/login` | Login para obtener JWT. |
| `snowrail_auth_me` | `GET /auth/me` | Perfil autenticado vía `Authorization: Bearer`. |
| `snowrail_dashboard` | `GET /api/dashboard` | Panel interno protegido con JWT. |

## Arquitectura

- `src/snowrail-mcp.ts`: punto único de configuración.
- `McpServer` de `@modelcontextprotocol/sdk` registra herramientas con validaciones `zod`.
- `snowrailFetch` centraliza cabeceras, serialización y parsing de respuestas, devolviendo `{ url, status, data }` para que los clientes MCP vean el detalle completo.

## Puntos de integración

- Headers sensibles (`X-PAYMENT`, `Authorization`, `X-Callback-Secret`) se reciben como parámetros de las tools para mantener el servidor agnóstico al secreto real.
- El helper `toToolResult` normaliza la salida para que agentes MCP puedan mostrar los JSON crudos que vienen de SnowRail.

## Próximos pasos sugeridos

- Añadir pruebas automatizadas para `snowrailFetch`.
- Documentar ejemplos reales de payloads `messagePayload` y tokens `xPayment`.
