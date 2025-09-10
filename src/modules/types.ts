// Shared types and interfaces for the MCP server

export interface WeatherData {
  temp: number;
  condition: string;
}

export interface ServerConfig {
  name: string;
  version: string;
  port: string | number;
}

export interface SSEHeaders {
  "content-type": string;
  "cache-control": string;
  connection: string;
}

export type OperationType = "add" | "subtract" | "multiply" | "divide";
