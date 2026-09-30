# Family Dashbox — Design Analysis & Restyle Plan

Fork of **Kinboard** (MIT), restyled toward **Weekaroo** (MIT) + a Figma weather-card
reference. Functionality and layout of Kinboard are preserved; only the *look* changes.

> Status: Kinboard + Weekaroo extracted. **Figma card anatomy pending** (MCP auth).

---

## 1. Token comparison

| Token | Kinboard (current) | Weekaroo | Restyle target |
|---|---|---|---|
| **Mode** | Light-first + `.dark` + 12 month themes + 3 neutral palettes | Dark-only, 7 accent-hue variants | Keep Kinboard's dual mode + months; add Weekaroo shape language to both |
| **Display font** | Bricolage Grotesque | Inter (all) | Keep Bricolage for hero/titles |
| **Body font** | Hanken Grotesk | Inter | Keep Hanken (very close to Inter) |
| **Mono** | Space Mono | SF Mono | Keep Space Mono |
| **Base radius** | `--radius: 0.75rem` (12px) | 24px panels / 16–20px tiles / 999px pills | **Raise to `1rem` (16px)**; cards land ~20px via `2xl` |
| **Card bg (light)** | `43 54% 97%` (warm near-white) | — | Keep, add faint top highlight |
| **Card bg (dark)** | `33 15% 12%` | `rgba(8,18,16,.48)` glass | Keep opaque (ARM); add translucent-glass *feel* via border highlight |
| **Elevation** | `.elev-sm/md/lg`, warm `--shadow-rgb` | `0 18px 50px rgba(0,0,0,.28)` | Keep tokens; deepen `.elev-lg` slightly, add hover-lift |
| **Accent** | Monthly hue (June teal `192 75% 33%`) | Teal `#7dd3c7` = `171 52% 65%` | Add **"Lagune" teal palette/accent** as Weekaroo homage; months stay default |
| **Backdrop blur** | **Banned** (ARM kiosk GPU) | `blur(14px)` everywhere | **Do NOT introduce blur.** Fake glass with translucency + 1px inner highlight + elevation |
| **Person colors** | 10 curated (coral…clay) | calendar color on `border-left: 6px` | Adopt: colored left-accent on list/event items using person color |

### Weekaroo palette (reference)
```
--bg #08110f  --panel rgba(8,18,16,.48)  --panel-border rgba(255,255,255,.09)
--text #f6fbfa  --muted rgba(246,251,250,.72)
--accent #7dd3c7  --accent-strong #b6f3ea  --today rgba(125,211,199,.11)
event bg rgba(255,255,255,.06)  event border rgba(255,255,255,.08)
```

---

## 2. Card / tile anatomy (Weekaroo)

**Panel (outer card)** — `bg var(--panel)`, `1px var(--panel-border)`, radius **24px**,
shadow `0 18px 50px rgba(0,0,0,.28)`, (blur 14px — we skip).

**Nested tile** (weather detail, sun card, fact card, forecast card) —
`bg rgba(255,255,255,.06)`, `1px rgba(255,255,255,.08)`, radius **18–20px**, padding 14–18px.

**Event card** — radius **16px**, `bg var(--event)`, **`border-left: 6px solid <calendar/person color>`**,
hover `translateY(-1px)` + brighten + accent border. → *The signature interaction.*

**Day column** (week grid, 7 × `1fr`, gap 14px) — padding 18/16/16, `today` = accent gradient +
`border-color rgba(182,243,234,.28)`. Header: `day-name 1.34rem/800` in accent-strong, bottom divider.
Density variants shrink padding/gap as event count rises.

**Weather block (top bar)** — temp `3rem/700`; hero temp `4rem/800`; summary `1.1rem/600`.
Forecast cards: radius 20px; `today` = accent tint + inner ring; `selected` = stronger tint + 2px ring + shadow.

**Eyebrow label** — `uppercase, letter-spacing .16em, .72rem/700`. → maps to Kinboard's `.text-kiosk-label`.

**Universal hover** — `translateY(-1px…-2px)` + bg brighten + accent border-color. Apply to Kinboard cards.

---

## 3. Kinboard structure (where to change what)

- **Tokens / utilities**: `webapp/src/app/globals.css` — CSS vars (`:root`, `.dark`, `.theme-*`,
  `.palette-*`), `.elev-*`, `.accent-border-top`, `.icon-badge`, `.page-gradient`.
- **Radius / colors map**: `webapp/tailwind.config.ts` (radius derives from `--radius`).
- **Fonts**: `webapp/src/app/fonts.ts`.
- **Base Card**: `webapp/src/components/ui/card.tsx` — `rounded-2xl border bg-card elev-md` (all cards).
- **Widget wrapper**: `webapp/src/components/widget-card.tsx` — `.accent-border-top`, header icon-badge +
  `font-display` title, `CardContent p-4 gap-4` (12 of the grid widgets).
- **Widget grid**: inline in `webapp/src/app/page.tsx` (~L205): `grid-cols-1 sm:2 lg:4 2xl:5 …`.
- **Weather**: `webapp/src/components/widgets/weather.tsx`, `weather-modal.tsx`, `weather-map.tsx`.
- **Calendar day/week**: `webapp/src/components/calendar/month-view.tsx`, `week-view.tsx`, `event-pill.tsx`.
- **Notes/Messages/Countdown/Timers**: all exist as widgets (nothing to build — restyle only).
- **Theming runtime**: `webapp/src/hooks/use-theme-settings.ts` sets `.theme-<month>` / `.palette-*`
  on `<html>`; `next-themes` sets `.dark`.

### Constraints (must not break)
Realtime, offline shopping, i18n EN/DE/FR (`webapp/messages/*.json` parity), dark+light, month themes,
3 neutral palettes, **no backdrop-blur** on kiosk surfaces, wall portrait+landscape / tablet / phone.

---

## 4. Restyle order (implementation)
1. **Tokens** (globals.css + tailwind): radius → 16px, add Lagune teal palette, add glass-feel card highlight,
   hover-lift utility, deepen elevation slightly.
2. **Card primitive** (ui/card.tsx) + **widget-card.tsx**: radius, translucent highlight, hover lift.
3. **Card components**: weather (per Figma), calendar day tile (Weekaroo left-accent + today gradient),
   note, countdown, event-pill.
4. **Dashboard layout**: spacing/rhythm polish (keep grid breakpoints).

## 5. Figma weather-card reference — *pending MCP auth*
_To fill: card hierarchy, weather icons, gradient specs, layout of the weather dashboard cards._
