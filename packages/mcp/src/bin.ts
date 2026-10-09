import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';

// stdout carries the MCP protocol: anything else written there corrupts the stream.
// Diagnostics go to stderr.
const server = createServer();
await server.connect(new StdioServerTransport());
console.error('soroscope-mcp: ready (read-only; stdio)');
