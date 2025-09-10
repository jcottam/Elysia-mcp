// External dependencies
import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Internal modules
import { SSEElysiaTransport } from "./SSEElysiaTransport";
import { setupResources, setupTools, setupPrompts } from "./modules";
import type { ServerConfig, SSEHeaders } from "./modules";

// Constants
const SERVER_CONFIG: ServerConfig = {
  name: "bun-elysia-mcp-server",
  version: "1.0.0",
  port: process.env.PORT || 3001,
};

const SSE_HEADERS: SSEHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
};

// Create MCP server
const server = new McpServer({
  name: SERVER_CONFIG.name,
  version: SERVER_CONFIG.version,
});

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

function startServer() {
  // Initialize MCP server modules
  setupResources(server);
  setupTools(server);
  setupPrompts(server);

  app.listen(Number(SERVER_CONFIG.port), () => {
    console.log(`MCP server running at http://localhost:${SERVER_CONFIG.port}`);
    console.log(`- GET /sse for SSE connection`);
    console.log(`- POST /messages?sessionId=<ID> for messages`);
  });
}

// Start the server with Bun
startServer();
