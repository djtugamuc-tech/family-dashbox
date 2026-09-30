import { NextRequest, NextResponse } from "next/server";
import { getMergedSetting } from "@/lib/integration-secrets";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { familyMatchesSession, requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

const SIDECAR = process.env.BYD_SIDECAR_URL || "http://byd-sidecar:8140";

interface BydStored {
  connected?: boolean;
  region?: string;
  credentials?: { username?: string; password?: string; region?: string; pin?: string };
}

// GET /api/vehicles/byd?family_id=X&vin=Y — poll one BYD vehicle via the sidecar.
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const familyId = request.nextUrl.searchParams.get("family_id");
  const vin = request.nextUrl.searchParams.get("vin");
  if (!familyId || !vin) {
    return NextResponse.json({ error: "family_id and vin required" }, { status: 400 });
  }
  if (!familyMatchesSession(auth.session, familyId)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const stored = await getMergedSetting<BydStored>(familyId, SETTINGS_KEYS.byd);
  const creds = stored?.credentials;
  if (!creds?.username || !creds?.password) {
    return NextResponse.json({ error: "BYD account not connected" }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${SIDECAR}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        region: creds.region || stored?.region || "NL",
        pin: creds.pin || null,
        vin,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "BYD sidecar unreachable" }, { status: 503 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[byd] status upstream error:", res.status, detail.slice(0, 200));
    return NextResponse.json({ error: "Failed to fetch BYD status" }, { status: 502 });
  }

  const readings = await res.json();
  return NextResponse.json({ readings });
}
