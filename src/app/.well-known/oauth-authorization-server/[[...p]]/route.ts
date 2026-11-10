import { authServerMeta } from "@/lib/oauth";
import { origin } from "@/lib/site";

/** OAuth discovery (RFC 8414) for the MCP clients; also at /.well-known/oauth-authorization-server/api/mcp. */
export async function GET() {
  return Response.json(authServerMeta(await origin()), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}
