// Tool definitions for the MCP server
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OperationType } from "./types.js";

export function setupTools(server: McpServer): void {
  setupCalculatorTool(server);
  setupWeatherTool(server);
}

function setupCalculatorTool(server: McpServer): void {
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
}

function setupWeatherTool(server: McpServer): void {
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
