# MCP Server for Bun and Elysia

An implementation of the Model Context Protocol (MCP) server using Bun and the Elysia web framework. This project enables you to create high-performance MCP servers that expose resources, tools, and prompts to LLMs through a standardized interface.

## Features

- Server-Sent Events (SSE) transport implementation for Bun and Elysia
- Complete MCP protocol support with resources, tools, and prompts
- High-performance thanks to Bun's JavaScript runtime
- TypeScript support with proper type definitions
- Easy-to-use API for creating MCP-compatible servers

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Basic familiarity with TypeScript and Elysia

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mcp-server

# Install dependencies
bun install
```

## Usage

### Starting the server

```bash
# Start the server
bun start

# Start with hot reloading for development
bun dev
```

### Building for production

```bash
# Build for production
bun run build
```

This will create a minified Node.js-compatible build in the `dist` directory.

## Development

### Project Structure

- `src/index.ts` - Main entry point for the server
- `src/SSEElysiaTransport.ts` - SSE transport implementation for Bun and Elysia

### Creating an MCP Server

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SSEElysiaTransport } from "./SSEElysiaTransport";
import { Elysia } from "elysia";

// Create MCP server
const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0"
});

// Add resources, tools, and prompts
server.resource(
  "example",
  "example://resource",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "Example resource content"
    }]
  })
);

// Create Elysia app
const app = new Elysia()
  .get("/", () => "MCP Server")
  .get("/sse", async (context) => {
    try {
      // Create transport
      const transport = new SSEElysiaTransport("/messages", context);
      
      // Store transport
      const sessionId = transport.sessionId;
      // ... store transport in a map
      
      // Connect to MCP server
      await server.connect(transport);
      
      return;
    } catch (error) {
      // Handle error
    }
  })
  .post("/messages", async (context) => {
    // Handle incoming messages
  });

// Start server
app.listen(3001, () => {
  console.log("MCP Server running at http://localhost:3001");
});
```

## Debugging

You can debug your MCP server using the MCP Inspector tool and connect through sse

```bash
npx @modelcontextprotocol/inspector
```


This will open a web interface where you can:
- List available resources, tools, and prompts
- Test calling tools and retrieving resources
- Inspect the communication between the client and server

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.