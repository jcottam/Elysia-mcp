// External dependencies
import { randomUUID } from "crypto";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  JSONRPCMessageSchema,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "elysia";

export class SSEElysiaTransport implements Transport {
  // Private properties
  private readonly _sessionId: string;
  private _isConnected = false;
  private readonly _encoder = new TextEncoder();
  private readonly _stream: ReadableStream<Uint8Array>;
  private _controller!: ReadableStreamDefaultController<Uint8Array>;

  // Event handlers
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    private readonly _endpoint: string,
    private readonly _ctx: Context
  ) {
    this._sessionId = randomUUID();

    this._stream = new ReadableStream({
      start: (controller) => {
        this._controller = controller;
      },
      cancel: () => {
        this._isConnected = false;
        this.onclose?.();
      },
    });
  }

  async start(): Promise<void> {
    this.log("Starting transport");

    // Prevent duplicate starts
    if (this._isConnected) {
      this.log("Already started");
      return;
    }

    try {
      this._setupResponse();
      this._markAsConnected();
      this._sendEndpointEvent();
    } catch (error) {
      this._handleError("Error starting transport", error);
      throw error;
    }
  }

  private _setupResponse(): void {
    this._ctx.response = new Response(this._stream);
  }

  private _markAsConnected(): void {
    this._isConnected = true;
    this.log("Transport connected");
  }

  private _sendEndpointEvent(): void {
    const endpointUrl = `${encodeURI(this._endpoint)}?sessionId=${
      this._sessionId
    }`;
    this._sendEvent("endpoint", endpointUrl);
    this.log("Endpoint event sent");
  }

  private _sendEvent(event: string, data: string): void {
    if (!this._isConnected) {
      this.log("Cannot send event, not connected", "error");
      return;
    }

    try {
      const eventData = `event: ${event}\ndata: ${data}\n\n`;
      this._controller.enqueue(this._encoder.encode(eventData));
    } catch (error) {
      this._handleError("Error sending event", error);
    }
  }

  private _handleError(message: string, error: unknown): void {
    this.log(message, "error");
    this._isConnected = false;
    this.onerror?.(error instanceof Error ? error : new Error(String(error)));
  }

  private log(message: string, level: "info" | "error" = "info"): void {
    const prefix = `[Transport:${this._sessionId}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  async handlePostMessage(ctx: Context): Promise<Response> {
    this.log("Received message");

    if (!this._isConnected) {
      this.log("Not connected", "error");
      return this._createErrorResponse("SSE connection not established", 500);
    }

    try {
      await this.handleMessage(ctx.body);
      return this._createSuccessResponse();
    } catch (error) {
      this.log("Error handling message", "error");
      return this._createErrorResponse(String(error), 400);
    }
  }

  private _createErrorResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  private _createSuccessResponse(): Response {
    return new Response(JSON.stringify({ success: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  }

  async handleMessage(message: unknown): Promise<void> {
    this.log("Parsing message");

    let parsedMessage: JSONRPCMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      this.log("Invalid message format", "error");
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    this.log("Forwarding message to handler");
    this.onmessage?.(parsedMessage);
  }

  async close(): Promise<void> {
    this.log("Closing transport");
    this._isConnected = false;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.log("Sending message");

    if (!this._isConnected) {
      this.log("Not connected", "error");
      throw new Error("Not connected");
    }

    this._sendEvent("message", JSON.stringify(message));
  }

  // Public getter
  get sessionId(): string {
    return this._sessionId;
  }
}
