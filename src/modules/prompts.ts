// Prompt definitions for the MCP server
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function setupPrompts(server: McpServer): void {
  setupIntroduceYourselfPrompt(server);
  setupAnalyzeDataPrompt(server);
}

function setupIntroduceYourselfPrompt(server: McpServer): void {
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
}

function setupAnalyzeDataPrompt(server: McpServer): void {
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
