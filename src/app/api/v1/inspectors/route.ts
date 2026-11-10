import { fail, inspectorByLegit, keyApi } from "@/lib/integration";

/** `?legit=<ANEVAR card>`: the UVALO account the inspections go to, and whether its phone app is connected. */
export async function GET(req: Request) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const who = await inspectorByLegit(a.db, new URL(req.url).searchParams.get("legit"));
  return who ? Response.json({ ok: true, inspector: who }) : fail("Nu există cont UVALO activ cu această legitimație.", 404);
}
