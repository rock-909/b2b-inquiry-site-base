/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars, no-duplicate-imports -- Intentionally invalid scanner input; never executed. */
// ruleid: critical-route-no-runtime-cache
import { cacheTag as tag } from "next/cache";
// ruleid: critical-route-no-runtime-cache
import "next/cache";
// ruleid: critical-route-no-runtime-cache
const cache = import("next/cache");
export async function GET() {
  // ruleid: critical-route-no-runtime-cache
  "use cache";
  return Response.json({ ok: true });
}
// ok: critical-route-no-runtime-cache
const text = "use cache";
// ok: critical-route-no-runtime-cache
// cacheTag("only a comment");
// prettier-ignore
// ruleid: critical-route-no-runtime-cache
async function cached() { "use cache: private"; return 1; }
// ok: critical-route-no-runtime-cache
/* "use cache: remote"; */
