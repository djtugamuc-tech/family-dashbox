"use client";

/**
 * BYD — a NATIVE cloud driver (no Home Assistant).
 *
 * Unlike tesla/generic-ev (which read HA entities), this driver reads a small
 * local sidecar that wraps the maintained `pybyd` library (BYD cloud crypto +
 * "bangcle" + device fingerprint). The family's BYD account is connected once
 * in Settings → BYD; per-vehicle config is just which VIN to show.
 *
 * Because it owns its own rendering it can show the DM-i plug-in hybrid fully:
 * BOTH the EV battery (elec_percent / endurance_mileage) AND the fuel side
 * (oil_percent / oil_endurance) — which the EV-only generic-ev driver cannot.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { BatteryCharging, Car, Fuel, Gauge, Thermometer, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Vehicle } from "@/types/database";
import type { VehicleDriver } from "./types";
import { useBydSettings, useBydStatus, type BydReadings } from "@/hooks/use-byd";

export interface BydVehicleConfig {
  vin?: string;
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
const km = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)} km`);
const temp = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}°`);

function levelColor(v: number | null | undefined, text = true): string {
  const p = v ?? 0;
  const base = p > 60 ? "success" : p > 20 ? "warning" : "destructive";
  return `${text ? "text" : "bg"}-${base}`;
}

function Bar({ value, className }: { value: number | null | undefined; className: string }) {
  return (
    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
      />
    </div>
  );
}

function BydCard({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations("vehicles.drivers.byd");
  const config = (vehicle.config ?? {}) as BydVehicleConfig;
  const { data: settings } = useBydSettings();
  const { data: r, isLoading, error } = useBydStatus(config.vin);

  if (!settings?.connected) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t("notConnected")}{" "}
        <Link href="/settings/byd" className="text-primary underline">
          {t("connectCta")}
        </Link>
      </Card>
    );
  }
  if (!config.vin) {
    return <Card className="p-6 text-sm text-muted-foreground">{t("pickVehicle")}</Card>;
  }
  if (isLoading && !r) {
    return <Card className="p-6 text-sm text-muted-foreground">{t("loading")}</Card>;
  }
  if (error || !r) {
    return <Card className="p-6 text-sm text-muted-foreground">{t("unavailable")}</Card>;
  }

  const hasFuel = r.fuelPercent != null || r.fuelRangeKm != null;
  const minutes = r.minutesToFull ?? 0;
  const eta = minutes > 0 ? `~${Math.floor(minutes / 60)}h ${minutes % 60}min` : "";

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          {vehicle.image_url && (
            <img src={vehicle.image_url} alt={vehicle.nickname} className="w-full max-h-48 object-contain bg-muted/30" />
          )}
          <div className="p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-2xl font-display font-light truncate">{vehicle.nickname}</h2>
              <span className="text-xs text-muted-foreground truncate">{r.model}</span>
            </div>

            {/* EV battery */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={`text-4xl font-semibold ${levelColor(r.soc)}`}>{pct(r.soc)}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <BatteryCharging className="size-3.5" /> {t("evLabel")} · {km(r.evRangeKm)}
                  </p>
                </div>
                {r.charging ? (
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end text-energy-grid">
                      <Zap className="size-4" />
                      <span className="text-lg font-semibold">
                        {r.chargerPowerW != null ? `${(r.chargerPowerW / 1000).toFixed(1)} kW` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {eta ? `${t("charging")} · ${eta}` : t("charging")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">{t("notCharging")}</p>
                )}
              </div>
              <div className="mt-2">
                <Bar value={r.soc} className={levelColor(r.soc, false)} />
              </div>
            </div>

            {/* Fuel (DM-i) */}
            {hasFuel && (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold flex items-center gap-2">
                    <Fuel className="size-5 text-warning" /> {pct(r.fuelPercent)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("fuelLabel")} · {km(r.fuelRangeKm)}</p>
                </div>
                <div className="mt-2">
                  <Bar value={r.fuelPercent} className="bg-warning" />
                </div>
              </div>
            )}

            {r.totalRangeKm != null && (
              <p className="text-sm text-muted-foreground">
                {t("totalRange")}: <span className="font-semibold text-foreground">{km(r.totalRangeKm)}</span>
              </p>
            )}
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {(r.insideTempC != null || r.outsideTempC != null) && (
          <Card className="flex items-center gap-3 p-4">
            <Thermometer className="size-5 text-energy-consumption" />
            <div>
              <p className="text-xs text-muted-foreground">{t("temps")}</p>
              <p className="text-lg font-semibold">{temp(r.insideTempC)} / {temp(r.outsideTempC)}</p>
            </div>
          </Card>
        )}
        {r.odometerKm != null && (
          <Card className="flex items-center gap-3 p-4">
            <Gauge className="size-5 text-energy-grid" />
            <div>
              <p className="text-xs text-muted-foreground">{t("odometer")}</p>
              <p className="text-lg font-semibold">{km(r.odometerKm)}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function BydWidgetCard({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations("vehicles.drivers.byd");
  const config = (vehicle.config ?? {}) as BydVehicleConfig;
  const { data: settings } = useBydSettings();
  const { data: r } = useBydStatus(config.vin);

  if (!settings?.connected || !config.vin || !r) {
    return (
      <Card className="p-4">
        <div className="flex justify-center mb-2">
          <Car className="size-12 text-muted-foreground" />
        </div>
        <p className="text-xs text-center text-muted-foreground">{vehicle.nickname}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {vehicle.image_url ? (
        <img src={vehicle.image_url} alt={vehicle.nickname} className="w-full max-h-24 object-contain mb-2" />
      ) : (
        <div className="flex justify-center mb-2">
          <Car className="size-12 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-3xl font-bold ${levelColor(r.soc)}`}>
            {r.soc == null ? "—" : Math.round(r.soc)}
            <span className="text-base text-muted-foreground">%</span>
          </p>
          <p className="text-xs text-muted-foreground">{vehicle.nickname}</p>
        </div>
        <div className="text-right space-y-0.5">
          {r.charging ? (
            <div className="flex items-center gap-1 justify-end text-energy-grid">
              <Zap className="size-4" />
              <span className="text-sm font-semibold">{km(r.evRangeKm)}</span>
            </div>
          ) : (
            <p className="text-xl font-semibold">{km(r.evRangeKm)}</p>
          )}
          {r.fuelPercent != null && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <Fuel className="size-3" /> {pct(r.fuelPercent)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function BydConfigForm({
  vehicle,
  onConfigChange,
}: {
  vehicle: Vehicle;
  onConfigChange: (config: BydVehicleConfig) => void;
}) {
  const t = useTranslations("vehicles.drivers.byd");
  const config = (vehicle.config ?? {}) as BydVehicleConfig;
  const { data: settings } = useBydSettings();

  if (!settings?.connected) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("notConnected")}{" "}
        <Link href="/settings/byd" className="text-primary underline">
          {t("connectCta")}
        </Link>
      </p>
    );
  }

  const vehicles = settings.vehicles ?? [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("selectVehicle")}
      </h3>
      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
      ) : (
        <Select value={config.vin ?? ""} onValueChange={(vin) => onConfigChange({ ...config, vin })}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectVehicle")} />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.vin} value={v.vin}>
                {v.nickname || v.model} — {v.vin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export const bydDriver: VehicleDriver<BydVehicleConfig> = {
  id: "byd",
  displayNameKey: "byd",
  icon: Car,
  defaultConfig: {},
  Card: BydCard,
  WidgetCard: BydWidgetCard,
  ConfigForm: BydConfigForm,
  isConfigured: (c) => Boolean(c.vin),
};
