// Resource definitions for the MCP server
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export function setupResources(server: McpServer): void {
  setupConfigResource(server);
  setupUserProfileResource(server);
}

function setupConfigResource(server: McpServer): void {
  server.resource("config", "config://app", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: "This is the app configuration data",
      },
    ],
  }));
}

function setupUserProfileResource(server: McpServer): void {
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
