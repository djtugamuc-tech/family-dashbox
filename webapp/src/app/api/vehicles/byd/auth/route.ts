import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertSecrets, deleteSecrets } from "@/lib/integration-secrets";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { familyMatchesSession, requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

// The BYD sidecar (pybyd wrapper) — internal docker service, or localhost for
// the host dev server. Never a user-supplied URL, so no SSRF guard needed.
const SIDECAR = process.env.BYD_SIDECAR_URL || "http://byd-sidecar:8140";

interface SidecarVehicle {
  vin: string;
  model: string;
  nickname: string;
}

// Connect a family's BYD account: validate creds against the sidecar, store
// them server-side (integration_secrets), and record the connection status.
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const { username, password, region, pin, family_id } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "username and password required" }, { status: 400 });
    }
    if (!family_id) {
      return NextResponse.json({ error: "family_id is required" }, { status: 400 });
    }
    if (!familyMatchesSession(auth.session, family_id)) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    // Validate against BYD via the sidecar (returns the account's vehicles).
    let res: Response;
    try {
      res = await fetch(`${SIDECAR}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, region: region || "NL", pin: pin || null }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return NextResponse.json(
        { error: "BYD sidecar unreachable — is the byd-sidecar container running?" },
        { status: 503 },
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "BYD login failed", detail: detail.slice(0, 300) },
        { status: res.status === 502 ? 401 : 502 },
      );
    }
    const { vehicles } = (await res.json()) as { vehicles: SidecarVehicle[] };

    // Store the full credential set server-only (SECRET_FIELDS["byd"] filters it).
    await upsertSecrets(family_id, SETTINGS_KEYS.byd, {
      credentials: { username, password, region: region || "NL", pin: pin || "" },
    });

    // Non-secret connection status for the settings UI (admin client — the
    // settings row is anon-readable, so it must NOT carry credentials).
    const supabase = createAdminClient();
    await (supabase as any).from("settings").upsert(
      {
        family_id,
        key: SETTINGS_KEYS.byd,
        value: {
          connected: true,
          accountLabel: username,
          region: region || "NL",
          autoPoll: true,
          // Non-secret: the account's VINs, so the vehicle config form can
          // offer a picker without re-logging in.
          vehicles,
        },
      },
      { onConflict: "family_id,key" },
    );

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("BYD auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

// Disconnect: wipe the stored credentials and clear the connection status.
export async function DELETE(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const family_id = request.nextUrl.searchParams.get("family_id");
  if (!family_id) {
    return NextResponse.json({ error: "family_id required" }, { status: 400 });
  }
  if (!familyMatchesSession(auth.session, family_id)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  await deleteSecrets(family_id, SETTINGS_KEYS.byd);
  const supabase = createAdminClient();
  await (supabase as any).from("settings").upsert(
    { family_id, key: SETTINGS_KEYS.byd, value: { connected: false } },
    { onConflict: "family_id,key" },
  );
  return NextResponse.json({ ok: true });
}
