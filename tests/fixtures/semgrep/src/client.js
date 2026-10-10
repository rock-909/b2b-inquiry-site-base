/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars, no-duplicate-imports, no-undef -- Intentionally invalid scanner input; never executed. */
"use client";
// ruleid: client-no-server-env-or-pii
import { env } from "@/lib/env";
// ruleid: client-no-server-env-or-pii
import { sanitizeEmail as redact } from "@/lib/logger";
// ruleid: client-no-server-env-or-pii
import { sanitizeIP } from "@/lib/logger";
// ruleid: client-no-server-env-or-pii
const loaded = import("./env");
// ruleid: client-no-server-env-or-pii
sanitizeIP("fixture");
// ruleid: client-no-server-env-or-pii
logger.sanitizeEmail("fixture");
// ok: client-no-server-env-or-pii
const label = "sanitizeEmail";
// ok: client-no-server-env-or-pii
// sanitizeEmail("only a comment");
