// External dependencies
import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Internal modules
import { SSEElysiaTransport } from "./SSEElysiaTransport";

// Constants
const SERVER_CONFIG = {
  name: "bun-elysia-mcp-server",
  version: "1.0.0",
  port: process.env.PORT || 3001,
} as const;

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
} as const;

// Create MCP server
const server = new McpServer({
  name: SERVER_CONFIG.name,
  version: SERVER_CONFIG.version,
});

// Resource definitions
function setupResources() {
  // Static resource
  server.resource("config", "config://app", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: "This is the app configuration data",
      },
    ],
  }));

  // Dynamic resource with parameters
  server.resource(
    "user-profile",
    new ResourceTemplate("users://{userId}/profile", { list: undefined }),
    async (uri, { userId }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Profile data for user ${userId}: { name: "User ${userId}", email: "user${userId}@example.com" }`,
        },
      ],
    })
  );
}

// Tool definitions
function setupTools() {
  // Simple calculator tool
  server.tool(
    "calculate",
    {
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      a: z.number(),
      b: z.number(),
    },
    async ({ operation, a, b }) => {
      let result: number;

      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            return {
              content: [{ type: "text", text: "Error: Division by zero" }],
              isError: true,
            };
          }
          result = a / b;
          break;
      }

      return {
        content: [{ type: "text", text: String(result) }],
      };
    }
  );

  // Weather tool (mock)
  server.tool("get-weather", { city: z.string() }, async ({ city }) => {
    const mockWeatherData: Record<string, { temp: number; condition: string }> =
      {
        "new york": { temp: 22, condition: "Partly cloudy" },
        london: { temp: 18, condition: "Rainy" },
        tokyo: { temp: 26, condition: "Sunny" },
        sydney: { temp: 30, condition: "Clear" },
      };

    const cityLower = city.toLowerCase();
    const weather = mockWeatherData[cityLower] || {
      temp: 25,
      condition: "Unknown",
    };

    return {
      content: [
        {
          type: "text",
          text: `Weather in ${city}: ${weather.temp}°C, ${weather.condition}`,
        },
      ],
    };
  });
}

// Prompt definitions
function setupPrompts() {
  server.prompt(
    "introduce-yourself",
    { topic: z.string().optional() },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: topic
              ? `Please introduce yourself and tell me about ${topic}`
              : "Please introduce yourself",
          },
        },
      ],
    })
  );

  server.prompt("analyze-data", { data: z.string() }, ({ data }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please analyze this data and provide insights:\n\n${data}`,
        },
      },
    ],
  }));
}

// Store active transports by session ID
const transports = new Map<string, SSEElysiaTransport>();

// Error handling utilities
function createErrorResponse(
  message: string,
  status: number = 500,
  details?: any
) {
  return new Response(
    JSON.stringify({
      error: message,
      ...(details && { details }),
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Route handlers
function getServerInfo() {
  return {
    name: SERVER_CONFIG.name,
    version: SERVER_CONFIG.version,
    description: "Model Context Protocol server using Bun and Elysia",
    endpoints: {
      "/": "This info",
      "/sse": "SSE endpoint for MCP connections",
      "/messages": "Message endpoint for MCP clients",
    },
  };
}

async function handleSSEConnection(context: any) {
  console.log("SSE connection requested");

  try {
    // Set SSE headers
    Object.entries(SSE_HEADERS).forEach(([key, value]) => {
      context.set.headers[key] = value;
    });

    console.log("Headers set for SSE connection");

    // Create and store transport
    const transport = new SSEElysiaTransport("/messages", context);
    console.log(`Transport created with sessionId: ${transport.sessionId}`);

    transports.set(transport.sessionId, transport);
    console.log(`Transports map size: ${transports.size}`);

    // Connect to MCP server
    await server.connect(transport);
    console.log("Connected to MCP server");

    return context.response;
  } catch (error) {
    const transportError = error as Error;
    console.error("Transport/connection error:", transportError);
    console.error(transportError.stack);

    return createErrorResponse("Transport error", 500, {
      message: transportError.message,
      stack: transportError.stack,
    });
  }
}

async function handleMessage(context: any) {
  try {
    // Get session ID from query parameters
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get("sessionId");
    console.log("POST /messages Session ID:", sessionId);

    if (!sessionId || !transports.has(sessionId)) {
      return createErrorResponse("Invalid or missing session ID", 400);
    }

    // Get transport and handle message
    const transport = transports.get(sessionId)!;
    return transport.handlePostMessage(context);
  } catch (error) {
    console.error("Error handling message:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

// Create Elysia app with the Bun platform
const app = new Elysia()
  .use(
    staticPlugin({
      assets: "./public",
      prefix: "/",
    })
  )

  // Basic info route
  .get("/", getServerInfo)
  .get("/sse", handleSSEConnection)
  .post("/messages", handleMessage);

// Initialize MCP server components
function initializeServer() {
  setupResources();
  setupTools();
  setupPrompts();
}

// Start the server
function startServer() {
  initializeServer();

  app.listen(Number(SERVER_CONFIG.port), () => {
    console.log(`MCP server running at http://localhost:${SERVER_CONFIG.port}`);
    console.log(`- GET /sse for SSE connection`);
    console.log(`- POST /messages?sessionId=<ID> for messages`);
  });
}

// Start the server with Bun
startServer();
