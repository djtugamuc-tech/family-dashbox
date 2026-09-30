"""BYD sidecar for Family Dashbox.

Wraps the maintained `pybyd` library (which owns the BYD cloud crypto,
"bangcle" app-hardening and device fingerprinting) behind a tiny local JSON API
that Kinboard's native `byd` vehicle driver reads. This is NOT Home Assistant —
just a single-purpose BYD poller on the local docker network.

Endpoints (localhost / docker-net only — never expose to the internet):
  GET  /health                -> {"ok": true, "mock": bool}
  POST /login  {username,password,region,pin?}          -> {"vehicles":[...]}
  POST /status {username,password,region,pin?,vin}      -> normalized readings

Set BYD_MOCK=1 to return sample Seal U DMi data without touching the network —
used to verify the whole Kinboard flow without a real BYD account.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MOCK = os.environ.get("BYD_MOCK", "0") == "1"

app = FastAPI(title="Family Dashbox BYD sidecar")


class LoginBody(BaseModel):
    username: str
    password: str
    region: str = "NL"
    pin: Optional[str] = None


class StatusBody(LoginBody):
    vin: str


# --------------------------------------------------------------------------
# Normalization — one shape for both mock and real, keyed by the BYD API field
# names (elec_percent, endurance_mileage, oil_percent, oil_endurance, ...).
# --------------------------------------------------------------------------
def _num(v: Any) -> Optional[float]:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def normalize(vin: str, name: str, model: str,
              rt: dict, charging: dict, gps: Optional[dict]) -> dict:
    soc = _num(rt.get("elec_percent"))
    ev_range = _num(rt.get("endurance_mileage"))
    fuel_pct = _num(rt.get("oil_percent"))
    fuel_range = _num(rt.get("oil_endurance"))
    total_range = None
    if ev_range is not None or fuel_range is not None:
        total_range = (ev_range or 0) + (fuel_range or 0)

    state = str(charging.get("charging_state") or charging.get("charge_state") or "").lower()
    is_charging = "charg" in state and "not" not in state and "un" not in state
    rh = _num(charging.get("remaining_hours"))
    rm = _num(charging.get("remaining_minutes"))
    minutes_to_full = None
    if rh is not None or rm is not None:
        minutes_to_full = int((rh or 0) * 60 + (rm or 0))

    loc = None
    if gps and gps.get("latitude") is not None and gps.get("longitude") is not None:
        loc = {"lat": _num(gps.get("latitude")), "lon": _num(gps.get("longitude"))}

    def tyre(k: str) -> Optional[float]:
        return _num(rt.get(k))

    return {
        "vin": vin,
        "nickname": name,
        "model": model,
        "soc": soc,
        "evRangeKm": ev_range,
        "fuelPercent": fuel_pct,
        "fuelRangeKm": fuel_range,
        "totalRangeKm": total_range,
        "odometerKm": _num(rt.get("total_mileage")),
        "speedKmh": _num(rt.get("speed")),
        "charging": is_charging,
        "chargingState": state or None,
        "minutesToFull": minutes_to_full,
        "chargerPowerW": _num(rt.get("gl")) if rt.get("gl") is not None else _num(rt.get("battery_power")),
        "insideTempC": _num(rt.get("temp_in_car")),
        "outsideTempC": _num(rt.get("temp_out_car")),
        "tyresKpa": {
            "fl": tyre("left_front_tire_pressure"),
            "fr": tyre("right_front_tire_pressure"),
            "rl": tyre("left_rear_tire_pressure"),
            "rr": tyre("right_rear_tire_pressure"),
        },
        "location": loc,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


# --------------------------------------------------------------------------
# Mock path
# --------------------------------------------------------------------------
_MOCK_VIN = "LGXCMOCKSEAL00001"


def _mock_vehicles() -> list[dict]:
    return [{"vin": _MOCK_VIN, "model": "Seal U DMi", "nickname": "BYD Seal U"}]


def _mock_status(vin: str) -> dict:
    rt = {
        "elec_percent": 62, "endurance_mileage": 48,
        "oil_percent": 70, "oil_endurance": 520,
        "total_mileage": 12450, "speed": 0,
        "temp_in_car": 21, "temp_out_car": 14, "gl": 3300,
        "left_front_tire_pressure": 230, "right_front_tire_pressure": 232,
        "left_rear_tire_pressure": 228, "right_rear_tire_pressure": 231,
    }
    charging = {"charging_state": "charging", "remaining_hours": 1, "remaining_minutes": 20}
    gps = {"latitude": 52.3702, "longitude": 4.8952}
    return normalize(vin, "BYD Seal U", "Seal U DMi", rt, charging, gps)


# --------------------------------------------------------------------------
# Real path — pybyd, with one cached client per username (sessions are pricey).
# pybyd is imported lazily so mock mode works even without it installed.
# --------------------------------------------------------------------------
_clients: dict[str, Any] = {}
_lock = asyncio.Lock()


async def _get_client(body: LoginBody):
    from pybyd import BydClient, BydConfig  # lazy

    async with _lock:
        client = _clients.get(body.username)
        if client is None:
            config = BydConfig(
                username=body.username,
                password=body.password,
                country_code=body.region or "NL",
                control_pin=body.pin or None,
                mqtt_enabled=False,  # poll over HTTP; no MQTT push needed for a dashboard
            )
            client = BydClient(config)
            await client.async_start()
            await client.login()
            _clients[body.username] = client
        return client


async def _drop_client(username: str) -> None:
    async with _lock:
        client = _clients.pop(username, None)
    if client is not None:
        try:
            await client.async_close()
        except Exception:
            pass


def _dump(obj: Any) -> dict:
    """pydantic model | dataclass | dict -> plain dict."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            pass
    return {k: getattr(obj, k) for k in dir(obj) if not k.startswith("_")}


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"ok": True, "mock": MOCK}


@app.post("/login")
async def login(body: LoginBody):
    if MOCK:
        return {"vehicles": _mock_vehicles()}
    try:
        client = await _get_client(body)
        vehicles = await client.get_vehicles()
        out = []
        for v in vehicles:
            d = _dump(v)
            out.append({
                "vin": d.get("vin") or d.get("VIN"),
                "model": d.get("model") or d.get("series_name") or d.get("name") or "BYD",
                "nickname": d.get("nickname") or d.get("name") or d.get("model") or "BYD",
            })
        return {"vehicles": out}
    except Exception as e:  # noqa: BLE001
        await _drop_client(body.username)
        raise HTTPException(status_code=502, detail=f"BYD login failed: {e}") from e


@app.post("/status")
async def status(body: StatusBody):
    if MOCK:
        return _mock_status(body.vin)
    try:
        client = await _get_client(body)
        rt = _dump(await client.get_vehicle_realtime(body.vin))
        try:
            charging = _dump(await client.get_charging_status(body.vin))
        except Exception:
            charging = {}
        gps = None
        try:
            gps = _dump(await client.get_gps_info(body.vin))
        except Exception:
            gps = None
        name = rt.get("nickname") or rt.get("name") or "BYD"
        model = rt.get("model") or rt.get("series_name") or "BYD"
        return normalize(body.vin, name, model, rt, charging, gps)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        await _drop_client(body.username)
        raise HTTPException(status_code=502, detail=f"BYD status failed: {e}") from e
