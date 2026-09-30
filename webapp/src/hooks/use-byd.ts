"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetting, useUpdateSetting, fetchSetting, queryKeys } from "./use-supabase-queries";
import { useFamilyStore } from "@/stores/family-store";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { createClient } from "@/lib/supabase/client";

export interface BydVehicleInfo {
  vin: string;
  model: string;
  nickname: string;
}

/** Non-secret connection state (the credentials live in integration_secrets). */
export interface BydSettings {
  connected?: boolean;
  accountLabel?: string;
  region?: string;
  autoPoll?: boolean;
  vehicles?: BydVehicleInfo[];
}

/** Normalized readings from the sidecar (BYD_MOCK or real pybyd). */
export interface BydReadings {
  vin: string;
  nickname: string;
  model: string;
  soc: number | null;
  evRangeKm: number | null;
  fuelPercent: number | null;
  fuelRangeKm: number | null;
  totalRangeKm: number | null;
  odometerKm: number | null;
  speedKmh: number | null;
  charging: boolean;
  chargingState: string | null;
  minutesToFull: number | null;
  chargerPowerW: number | null;
  insideTempC: number | null;
  outsideTempC: number | null;
  tyresKpa: { fl: number | null; fr: number | null; rl: number | null; rr: number | null };
  location: { lat: number; lon: number } | null;
  lastUpdated: string;
}

const DEFAULT_SETTINGS: BydSettings = { connected: false, region: "NL", autoPoll: true };

export function useBydSettings() {
  return useSetting<BydSettings>(SETTINGS_KEYS.byd, DEFAULT_SETTINGS);
}

export function useBydLogin() {
  const queryClient = useQueryClient();
  const { family } = useFamilyStore();

  return useMutation({
    mutationFn: async (input: { username: string; password: string; region?: string; pin?: string }) => {
      if (!family?.id) throw new Error("No family");
      const res = await fetch("/api/vehicles/byd/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, family_id: family.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "BYD login failed");
      }
      return res.json() as Promise<{ vehicles: BydVehicleInfo[] }>;
    },
    onSuccess: () => {
      // The /auth route already wrote the settings row (server-side); just
      // refresh the settings + status queries so the UI reflects the connection.
      if (family?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings(family.id, SETTINGS_KEYS.byd) });
      }
      queryClient.invalidateQueries({ queryKey: ["byd"] });
    },
  });
}

export function useBydLogout() {
  const queryClient = useQueryClient();
  const { family } = useFamilyStore();

  return useMutation({
    mutationFn: async () => {
      if (!family?.id) return;
      await fetch(`/api/vehicles/byd/auth?family_id=${family.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      if (family?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings(family.id, SETTINGS_KEYS.byd) });
      }
      queryClient.invalidateQueries({ queryKey: ["byd"] });
    },
  });
}

export function useBydStatus(vin?: string | null) {
  const { family } = useFamilyStore();
  const { data: settings } = useBydSettings();
  const connected = !!settings?.connected;

  return useQuery({
    queryKey: ["byd", "status", vin],
    queryFn: async (): Promise<BydReadings | null> => {
      if (!connected || !vin || !family?.id) return null;
      const res = await fetch(`/api/vehicles/byd?family_id=${family.id}&vin=${encodeURIComponent(vin)}`);
      if (!res.ok) throw new Error("Failed to fetch BYD status");
      const { readings } = await res.json();
      return readings as BydReadings;
    },
    enabled: connected && !!vin && !!family?.id,
    staleTime: 60 * 1000,
    // Scheduled poll every 5 min, honouring the "Auto poll" switch.
    refetchInterval: settings?.autoPoll === false ? false : 5 * 60 * 1000,
  });
}

export function useUpdateBydSettings() {
  const supabase = createClient();
  const updateSetting = useUpdateSetting();
  const queryClient = useQueryClient();
  const { family } = useFamilyStore();

  return useMutation({
    mutationFn: async (updates: Partial<BydSettings>) => {
      const current = family?.id
        ? await fetchSetting<BydSettings>(supabase, family.id, SETTINGS_KEYS.byd, DEFAULT_SETTINGS)
        : DEFAULT_SETTINGS;
      await updateSetting.mutateAsync({
        key: SETTINGS_KEYS.byd,
        value: { ...current, ...updates },
      });
    },
    onSuccess: () => {
      if (family?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings(family.id, SETTINGS_KEYS.byd) });
      }
    },
  });
}
