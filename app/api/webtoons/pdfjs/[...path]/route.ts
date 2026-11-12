import { readFile } from "node:fs/promises";
import path from "node:path";
import metadata from "pdfjs-dist/package.json";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
 const { path: parts } = await context.params;
 if (parts[0] !== metadata.version) return new Response(null, { status: 404 });
 let relative: string;
 if (parts.length === 2 && parts[1] === "worker") relative = "build/pdf.worker.min.mjs";
 else if (parts.length === 3 && ["cmaps", "standard_fonts", "wasm"].includes(parts[1]) && /^[a-zA-Z0-9_.-]+$/.test(parts[2]) && !parts[2].includes("..")) relative = parts[1] + "/" + parts[2];
 else return new Response(null, { status: 404 });
 try {
  const bytes = await readFile(path.join(process.cwd(), "node_modules/pdfjs-dist", relative));
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": relative.endsWith(".mjs") ? "text/javascript" : relative.endsWith(".wasm") ? "application/wasm" : "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
 } catch { return new Response(null, { status: 404 }); }
}
