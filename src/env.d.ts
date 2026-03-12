declare global {
  interface Env {
    MCP_COOKIE_ENCRYPTION_KEY: string;
    CLOUDFLARE_CLIENT_ID: string;
    CLOUDFLARE_CLIENT_SECRET: string;
  }
}

export {};
