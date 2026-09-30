"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Car, AlertCircle, Mail, Lock, Loader2, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IntegrationStatusBanner } from "@/components/integration-status-banner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SecretField } from "@/components/settings/secret-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBydSettings, useBydLogin, useBydLogout, useUpdateBydSettings } from "@/hooks/use-byd";

const REGIONS = ["NL", "DE", "FR", "GB", "ES", "IT", "BE", "AT", "PL", "SE", "NO", "DK", "PT"];

export default function BydSettingsPage() {
  const t = useTranslations("settings.byd");
  const { data: settings, isLoading } = useBydSettings();
  const login = useBydLogin();
  const logout = useBydLogout();
  const update = useUpdateBydSettings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("NL");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const isConnected = !!settings?.connected;
  const vehicles = settings?.vehicles ?? [];

  const handleLogin = async () => {
    if (!username || !password) return;
    setError("");
    try {
      await login.mutateAsync({ username, password, region, pin: pin || undefined });
      setDialogOpen(false);
      setUsername("");
      setPassword("");
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loginFailed"));
    }
  };

  if (isLoading) {
    return (
      <main id="main-content" className="min-h-page p-4 pt-16 md:p-8 md:pt-20 relative safe-area-inset">
        <div className="relative z-10 max-w-2xl mx-auto">
          <PageHeader icon={Car} title={t("title")} subtitle={t("subtitle")} className="mb-8" />
          <Card className="p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-10 w-full mb-3" />
            <Skeleton className="h-10 w-32" />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-page p-4 pt-16 md:p-8 md:pt-20 relative safe-area-inset">
      <div className="relative z-10 max-w-2xl mx-auto">
        <PageHeader icon={Car} title={t("title")} subtitle={t("subtitle")} className="mb-8" />

        <IntegrationStatusBanner
          connected={isConnected}
          icon={<Car className="size-6" strokeWidth={1.75} />}
          serviceName={t("accountTitle")}
          connectedLabel={t("connectedBadge")}
          connectedSubtitle={settings?.accountLabel ?? undefined}
          onConnect={() => setDialogOpen(true)}
          onDisconnect={isConnected ? () => logout.mutateAsync() : undefined}
          connectLabel={t("loginButton")}
          disconnectLabel={t("disconnectButton")}
          disconnectedTitle={t("notConnectedTitle")}
          disconnectedBody={t("notConnectedDescription")}
          className="mb-6"
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("loginDialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label>{t("emailLabel")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t("emailPlaceholder")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <SecretField
                id="byd-password"
                label={t("passwordLabel")}
                icon={Lock}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                showLabel={t("showPassword")}
                hideLabel={t("hidePassword")}
              />
              <div className="flex flex-col gap-2">
                <Label>{t("regionLabel")}</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("pinLabel")}</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={t("pinPlaceholder")}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("pinHint")}</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="size-4" />
                  {error}
                </div>
              )}

              <Button className="w-full" onClick={handleLogin} disabled={!username || !password || login.isPending}>
                {login.isPending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" />{t("loginSubmitting")}</>
                ) : (
                  t("loginSubmit")
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">{t("loginSecurityHint")}</p>
            </div>
          </DialogContent>
        </Dialog>

        {isConnected && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
              <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">{t("vehiclesHeading")}</h2>
              <Card className="p-4">
                {vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
                ) : (
                  <ul className="space-y-2">
                    {vehicles.map((v) => (
                      <li key={v.vin} className="flex items-center gap-3 text-sm">
                        <Car className="size-4 text-primary shrink-0" />
                        <span className="font-medium">{v.nickname || v.model}</span>
                        <span className="text-muted-foreground font-mono text-xs">{v.vin}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground mt-3">{t("addVehicleHint")}</p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <Label className="font-medium">{t("autoPollLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("autoPollDescription")}</p>
                </div>
                <Switch
                  aria-label={t("autoPollDescription")}
                  checked={settings?.autoPoll ?? true}
                  onCheckedChange={(checked) => update.mutateAsync({ autoPoll: checked })}
                />
              </Card>
            </motion.div>
          </>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-6 p-4 rounded-xl bg-warning/5 border border-warning/10">
          <div className="flex gap-3">
            <AlertCircle className="size-5 text-warning shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-warning mb-1">{t("infoHeading")}</p>
              <p className="text-muted-foreground">{t("infoDescription")}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
