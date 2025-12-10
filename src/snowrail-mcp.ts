// src/snowrail-mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ==== MCP modes (core / advanced / internal) ==== //

type McpMode = "core" | "advanced" | "internal";

/**
 * Controla qué tools se exponen:
 * - core     → solo herramientas seguras/productivas para agentes IA.
 * - advanced → core + herramientas de bajo nivel (facilitator_*).
 * - internal → advanced + endpoints internos/webhooks/auth.
 */
const MCP_MODE: McpMode =
  (process.env.SNOWRAIL_MCP_MODE as McpMode) ?? "core";

const isAdvanced = MCP_MODE === "advanced" || MCP_MODE === "internal";
const isInternal = MCP_MODE === "internal";

/**
 * Tipos de entorno soportados (según contexto SnowRail)
 */
type SnowrailEnvironment = "development" | "staging" | "production";

/**
 * URLs base desde el contexto oficial snowrail-ai-context.json
 */
const BASE_URLS: Record<SnowrailEnvironment, string> = {
  development: "http://localhost:4000",
  staging: "https://staging-api.snowrail.xyz",
  production: "https://api.snowrail.xyz",
};

/**
 * Entorno por defecto (se puede sobreescribir con SNOWRAIL_ENV)
 */
const DEFAULT_ENV: SnowrailEnvironment =
  (process.env.SNOWRAIL_ENV as SnowrailEnvironment) ?? "staging";

/**
 * Env opcional para override explícito de la URL base:
 * SNOWRAIL_API_BASE
 */
const DEFAULT_BASE_URL =
  process.env.SNOWRAIL_API_BASE ?? BASE_URLS[DEFAULT_ENV];

const environmentSchema = z
  .enum(["development", "staging", "production"])
  .optional();

function resolveBaseUrl(
  environment?: SnowrailEnvironment,
  baseUrlOverride?: string
): string {
  if (baseUrlOverride) return baseUrlOverride;

  const env = environment ?? DEFAULT_ENV;
  const url = BASE_URLS[env] ?? DEFAULT_BASE_URL;

  if (!url) {
    throw new Error(
      "SnowRail API base URL not configured. Set SNOWRAIL_ENV or SNOWRAIL_API_BASE."
    );
  }

  return url;
}

type SnowrailFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  environment?: SnowrailEnvironment;
  baseUrlOverride?: string;
};

/**
 * Helper genérico para llamar a la API de SnowRail
 */
async function snowrailFetch(
  path: string,
  options: SnowrailFetchOptions = {}
): Promise<{ url: string; status: number; data: unknown }> {
  const {
    method = "GET",
    headers = {},
    body,
    environment,
    baseUrlOverride,
  } = options;

  const baseUrl = resolveBaseUrl(environment, baseUrlOverride);
  const url = `${baseUrl}${path}`;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  const init: RequestInit = {
    method,
    headers: finalHeaders,
  };

  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { url, status: res.status, data };
}

/**
 * Helper para formatear resultados como contenido MCP
 */
function toToolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Instancia del servidor MCP
 */
const server = new McpServer({
  name: "snowrail-mcp",
  version: "1.0.0",
});

// ==== CORE tools: productivo/mcp público para agentes IA ==== //

/**
 * 1) Health check: GET /health
 */
server.tool(
  "snowrail_health",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/health", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 2) Agent identity: GET /api/agent/identity
 */
server.tool(
  "snowrail_agent_identity",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/api/agent/identity", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 3) Agent stats: GET /api/agent/stats
 */
server.tool(
  "snowrail_agent_stats",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/api/agent/stats", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 4) Agent activity: GET /api/agent/activity
 */
server.tool(
  "snowrail_agent_activity",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/api/agent/activity", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 5) Treasury balance: GET /api/treasury/balance
 */
server.tool(
  "snowrail_treasury_balance",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/api/treasury/balance", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 6) Payroll demo: POST /api/payroll/execute
 *    Protegido por x402 (X-PAYMENT)
 */
server.tool(
  "snowrail_payroll_execute",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
    xPayment: z
      .string()
      .describe("Header X-PAYMENT (demo-token o autorización EIP-3009)"),
  },
  async ({ environment, baseUrl, xPayment }) => {
    const result = await snowrailFetch("/api/payroll/execute", {
      method: "POST",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
      headers: {
        "X-PAYMENT": xPayment,
      },
      body: {},
    });

    return toToolResult(result);
  }
);

/**
 * 7) Obtener payroll por ID: GET /api/payroll/:id
 */
server.tool(
  "snowrail_payroll_get_by_id",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
    payrollId: z.string().describe("ID del payroll, ej: pay_xxx"),
  },
  async ({ environment, baseUrl, payrollId }) => {
    const path = `/api/payroll/${encodeURIComponent(payrollId)}`;

    const result = await snowrailFetch(path, {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 8) Payment process: POST /api/payment/process
 *    Protegido por x402 (X-PAYMENT)
 */
server.tool(
  "snowrail_payment_process",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
    xPayment: z
      .string()
      .describe("Header X-PAYMENT (demo-token o autorización EIP-3009)"),
    recipientEmail: z.string().email(),
    amount: z.number().positive().describe("Monto en moneda fiat (ej: 100.0)"),
    currency: z.string().default("USD"),
    firstName: z.string(),
    lastName: z.string(),
    telephone: z.string().optional(),
    addressLine1: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    countryCode: z
      .string()
      .length(2)
      .describe("Código de país ISO 3166-1 alfa-2"),
    description: z.string().optional(),
  },
  async (args) => {
    const {
      environment,
      baseUrl,
      xPayment,
      recipientEmail,
      amount,
      currency,
      firstName,
      lastName,
      telephone,
      addressLine1,
      city,
      state,
      postalCode,
      countryCode,
      description,
    } = args;

    const body = {
      recipient: recipientEmail,
      amount,
      currency,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email_address: recipientEmail,
        telephone_number: telephone,
        mailing_address: {
          address_line1: addressLine1,
          city,
          state,
          postal_code: postalCode,
          country_code: countryCode,
        },
      },
      payment: {
        amount: Math.round(amount * 100),
        currency,
        recipient: recipientEmail,
        description: description ?? "SnowRail MCP payment",
      },
    };

    const result = await snowrailFetch("/api/payment/process", {
      method: "POST",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
      headers: {
        "X-PAYMENT": xPayment,
      },
      body,
    });

    return toToolResult(result);
  }
);

/**
 * 9) Treasury test: POST /api/treasury/test
 */
server.tool(
  "snowrail_treasury_test",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
    xPayment: z
      .string()
      .describe("Header X-PAYMENT (demo-token o autorización EIP-3009)"),
  },
  async ({ environment, baseUrl, xPayment }) => {
    const result = await snowrailFetch("/api/treasury/test", {
      method: "POST",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
      headers: {
        "X-PAYMENT": xPayment,
      },
      body: {},
    });

    return toToolResult(result);
  }
);

/**
 * 10) Facilitator health: GET /facilitator/health
 */
server.tool(
  "snowrail_facilitator_health",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
  },
  async ({ environment, baseUrl }) => {
    const result = await snowrailFetch("/facilitator/health", {
      method: "GET",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
    });

    return toToolResult(result);
  }
);

/**
 * 15) Process A2A (Agent-to-Agent): POST /process
 */
server.tool(
  "snowrail_process_a2a",
  {
    environment: environmentSchema,
    baseUrl: z.string().url().optional(),
    xPayment: z
      .string()
      .describe("Header X-PAYMENT (demo-token o autorización EIP-3009)"),
    messageType: z.string().describe("Tipo de mensaje, ej: 'payroll_request'"),
    messagePayload: z.string().describe("Payload del mensaje como JSON string"),
    agentId: z.string().optional().describe("ID del agente emisor"),
    agentName: z.string().optional().describe("Nombre del agente emisor"),
  },
  async ({ environment, baseUrl, xPayment, messageType, messagePayload, agentId, agentName }) => {
    let payload: unknown;
    try {
      payload = JSON.parse(messagePayload);
    } catch {
      payload = messagePayload;
    }

    const message: Record<string, unknown> = {
      type: messageType,
      payload,
    };

    if (agentId) {
      message.agent = {
        id: agentId,
        ...(agentName && { name: agentName }),
      };
    }

    const result = await snowrailFetch("/process", {
      method: "POST",
      environment: environment as SnowrailEnvironment | undefined,
      baseUrlOverride: baseUrl,
      headers: {
        "X-PAYMENT": xPayment,
      },
      body: { message },
    });

    return toToolResult(result);
  }
);

// ==== ADVANCED tools: sólo cuando SNOWRAIL_MCP_MODE=advanced|internal ==== //

if (isAdvanced) {
  /**
   * 16) Facilitator validate: POST /facilitator/validate
   */
  server.tool(
    "snowrail_facilitator_validate",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      payment: z.string().describe("Token de pago x402 a validar"),
    },
    async ({ environment, baseUrl, payment }) => {
      const result = await snowrailFetch("/facilitator/validate", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        body: { payment },
      });

      return toToolResult(result);
    }
  );

  /**
   * 17) Facilitator verify: POST /facilitator/verify
   *     Verifica firma EIP-3009
   */
  server.tool(
    "snowrail_facilitator_verify",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      from: z.string().describe("Dirección del firmante"),
      to: z.string().describe("Dirección del destinatario"),
      value: z.string().describe("Valor de la transferencia"),
      validAfter: z.string().describe("Timestamp válido después de"),
      validBefore: z.string().describe("Timestamp válido antes de"),
      nonce: z.string().describe("Nonce único para la firma"),
      signature: z.string().describe("Firma EIP-3009 completa"),
    },
    async ({ environment, baseUrl, from, to, value, validAfter, validBefore, nonce, signature }) => {
      const result = await snowrailFetch("/facilitator/verify", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        body: {
          from,
          to,
          value,
          validAfter,
          validBefore,
          nonce,
          signature,
        },
      });

      return toToolResult(result);
    }
  );

  /**
   * 18) Facilitator settle: POST /facilitator/settle
   */
  server.tool(
    "snowrail_facilitator_settle",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      paymentProof: z.string().describe("Prueba de pago x402"),
      meterId: z.string().describe("ID del meter asociado"),
    },
    async ({ environment, baseUrl, paymentProof, meterId }) => {
      const result = await snowrailFetch("/facilitator/settle", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        body: { paymentProof, meterId },
      });

      return toToolResult(result);
    }
  );
}

// ==== INTERNAL tools: sólo cuando SNOWRAIL_MCP_MODE=internal ==== //

if (isInternal) {
  /**
   * 19) Internal x402 callback: POST /internal/x402/callback
   */
  server.tool(
    "snowrail_x402_callback",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      callbackSecret: z.string().optional().describe("Header X-Callback-Secret (opcional)"),
      paymentIntentId: z.string().describe("ID del payment intent"),
      token: z.string().describe("Token de pago"),
      amount: z.string().describe("Monto del pago"),
      txHash: z.string().describe("Hash de la transacción onchain"),
      timestamp: z.string().optional().describe("Timestamp del callback"),
    },
    async ({ environment, baseUrl, callbackSecret, paymentIntentId, token, amount, txHash, timestamp }) => {
      const headers: Record<string, string> = {};
      if (callbackSecret) {
        headers["X-Callback-Secret"] = callbackSecret;
      }

      const result = await snowrailFetch("/internal/x402/callback", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        headers,
        body: {
          paymentIntentId,
          token,
          amount,
          txHash,
          ...(timestamp && { timestamp }),
        },
      });

      return toToolResult(result);
    }
  );

  /**
   * 20) Auth signup: POST /auth/signup
   */
  server.tool(
    "snowrail_auth_signup",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      email: z.string().email(),
      password: z.string().min(8),
      companyLegalName: z.string(),
      country: z.string().length(2).default("US"),
    },
    async ({ environment, baseUrl, email, password, companyLegalName, country }) => {
      const body = {
        email,
        password,
        companyLegalName,
        country,
      };

      const result = await snowrailFetch("/auth/signup", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        body,
      });

      return toToolResult(result);
    }
  );

  /**
   * 21) Auth login: POST /auth/login
   */
  server.tool(
    "snowrail_auth_login",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      email: z.string().email(),
      password: z.string().min(8),
    },
    async ({ environment, baseUrl, email, password }) => {
      const body = { email, password };

      const result = await snowrailFetch("/auth/login", {
        method: "POST",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        body,
      });

      return toToolResult(result);
    }
  );

  /**
   * 22) Auth me: GET /auth/me
   */
  server.tool(
    "snowrail_auth_me",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      jwtToken: z
        .string()
        .describe("JWT token retornado por /auth/login o /auth/signup"),
    },
    async ({ environment, baseUrl, jwtToken }) => {
      const result = await snowrailFetch("/auth/me", {
        method: "GET",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });

      return toToolResult(result);
    }
  );

  /**
   * 23) Dashboard: GET /api/dashboard
   */
  server.tool(
    "snowrail_dashboard",
    {
      environment: environmentSchema,
      baseUrl: z.string().url().optional(),
      jwtToken: z
        .string()
        .describe("JWT token retornado por /auth/login o /auth/signup"),
    },
    async ({ environment, baseUrl, jwtToken }) => {
      const result = await snowrailFetch("/api/dashboard", {
        method: "GET",
        environment: environment as SnowrailEnvironment | undefined,
        baseUrlOverride: baseUrl,
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });

      return toToolResult(result);
    }
  );
}

/**
 * Bootstrap: conectar por STDIO (patrón recomendado en la doc oficial MCP)
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("SnowRail MCP server failed to start:", err);
  process.exit(1);
});
