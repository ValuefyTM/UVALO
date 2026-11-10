import { resourceMeta } from "@/lib/oauth";
import { origin } from "@/lib/site";

/** Protected resource metadata (RFC 9728) of /api/mcp; also at /.well-known/oauth-protected-resource/api/mcp. */
export async function GET() {
  return Response.json(resourceMeta(await origin()), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}
