// Server-only Langfuse singleton.
// Never import this in 'use client' components — LANGFUSE_SECRET_KEY
// is not exposed to the browser and the client will fail silently.
import Langfuse from "langfuse";

export const langfuse = new Langfuse({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_HOST,
});
