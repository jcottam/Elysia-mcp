import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SSEElysiaTransport } from "./SSEElysiaTransport"

// Create MCP server
const server = new McpServer({
  name: "bun-elysia-mcp-server",
  version: "1.0.0"
});

// Add resources
// Static resource
server.resource(
  "config",
  "config://app",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "This is the app configuration data"
    }]
  })
);

// Dynamic resource with parameters
server.resource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  async (uri, { userId }) => ({
    contents: [{
      uri: uri.href,
      text: `Profile data for user ${userId}: { name: "User ${userId}", email: "user${userId}@example.com" }`
    }]
  })
);

// Add tools
// Simple calculator tool
server.tool(
  "calculate",
  {
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number()
  },
  async ({ operation, a, b }) => {
    let result;
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
            isError: true
          };
        }
        result = a / b;
        break;
    }
    
    return {
      content: [{ type: "text", text: String(result) }]
    };
  }
);

// Weather tool (mock)
server.tool(
  "get-weather",
  { city: z.string() },
  async ({ city }) => {
    // This is a mock implementation
    const cities: { [key: string]: { temp: number; condition: string } } = {
      "new york": { temp: 22, condition: "Partly cloudy" },
      "london": { temp: 18, condition: "Rainy" },
      "tokyo": { temp: 26, condition: "Sunny" },
      "sydney": { temp: 30, condition: "Clear" }
    };
    
    const cityLower = city.toLowerCase();
    const weather = cities[cityLower] || { temp: 25, condition: "Unknown" };
    
    return {
      content: [{
        type: "text",
        text: `Weather in ${city}: ${weather.temp}°C, ${weather.condition}`
      }]
    };
  }
);

// Add prompts
server.prompt(
  "introduce-yourself",
  { topic: z.string().optional() },
  ({ topic }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: topic 
          ? `Please introduce yourself and tell me about ${topic}`
          : "Please introduce yourself"
      }
    }]
  })
);

server.prompt(
  "analyze-data",
  { data: z.string() },
  ({ data }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please analyze this data and provide insights:\n\n${data}`
      }
    }]
  })
);

// Store active transports by session ID
const transports = new Map();

// Create Elysia app with the Bun platform
const app = new Elysia()
  // Use Bun adapter explicitly
  .use(staticPlugin({
    assets: './public',
    prefix: '/'
  }))
  
  // Basic info route
  .get("/", () => ({
    name: "Bun Elysia MCP Server",
    version: "1.0.0",
    description: "Model Context Protocol server using Bun and Elysia",
    endpoints: {
      "/": "This info",
      "/sse": "SSE endpoint for MCP connections",
      "/messages": "Message endpoint for MCP clients"
    }
  }))
  .get("/sse", async (context) => {
    console.log("SSE connection requested");
    
    try {
      context.set.headers['content-type'] = 'text/event-stream';
      context.set.headers['cache-control'] = 'no-cache';
      context.set.headers['connection'] = 'keep-alive';
      
      console.log("Headers set for SSE connection");
      
      try {
        // Create the transport
        console.log("Creating transport");
        const {set, request} = context;
        const transport = new SSEElysiaTransport("/messages", context);
        console.log(`Transport created with sessionId: ${transport.sessionId}`);
        
        // Store the transport
        console.log("Storing transport in map");
        transports.set(transport.sessionId, transport);
        console.log(`Transports map size: ${transports.size}`);
        
        // Connect to MCP server
        console.log("Connecting to MCP server");
        await server.connect(transport);
        console.log("Connected to MCP server");
        
        console.log("SSE connection successful");
        // Return the response set by the transport
        return context.response;
      } catch (error) {
        const transportError = error as Error;
        console.error("Transport/connection error:", transportError);
        console.error(transportError.stack);
        
        // Try to send a proper error response
        return new Response(JSON.stringify({ 
          error: "Transport error", 
          message: transportError.message,
          stack: transportError.stack
        }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
    } catch (error) {
      const outerError = error as Error;
      console.error("Outer error in SSE handler:", outerError);
      console.error(outerError.stack);
      
      // Last resort error handler
      return new Response(JSON.stringify({ 
        error: "Server error", 
        message: outerError.message,
        stack: outerError.stack
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  })
// Handle messages
.post("/messages", async (context) => {
  try {
    // Get session ID
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get("sessionId");
    
    if (!sessionId || !transports.has(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing session ID" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get transport and handle message
    const transport = transports.get(sessionId);
    return transport.handlePostMessage(context);
  } catch (error) {
    console.error("Error handling message:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Start the server with Bun
const port = process.env.PORT || 3001;

app.listen(Number(port), () => {
  console.log(`MCP server running at http://localhost:${port}`);
  console.log(`- GET /sse for SSE connection`);
  console.log(`- POST /messages?sessionId=<ID> for messages`);
});