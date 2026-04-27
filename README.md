# ⚡ Forge — AI Fitness Coach

An AI-powered iOS fitness app that acts as a personal trainer, nutrition coach, and accountability partner. Built with React Native (Expo), Supabase, Apple HealthKit, and Apple Watch connectivity.

---

## What Forge Does

- **AI Coach with persistent memory** — learns your goals, struggles, preferences, and grows smarter every session
- **Apple Health sync** — reads steps, heart rate, sleep, workouts; writes meals and workouts back
- **Apple Watch connectivity** — sends workout instructions to your wrist, receives live heart rate updates
- **Calorie & macro tracking** — log food with plain-English AI parsing ("two scrambled eggs with avocado toast")
- **Personalized workouts** — the coach generates plans tailored to your equipment, level, and goals
- **Relationship bond system** — coaching depth grows across sessions (New → Building → Established → Deep Bond)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React Native via Expo SDK 52 |
| Language | TypeScript |
| Auth + DB | Supabase (Auth, Postgres, RLS) |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Health | Apple HealthKit (react-native-health) |
| Watch | WatchConnectivity (react-native-watch-connectivity) |
| State | Zustand |
| Navigation | React Navigation v7 |
| Animations | React Native Reanimated |
| Charts | Victory Native |
| Design | iOS 26 Liquid Glass inspired — light, layered, vibrant |

---

## Project Structure

```
forge-app/
├── App.tsx                          # Entry point, auth listener
├── app.json                         # Expo config + HealthKit entitlements
├── src/
│   ├── theme/index.ts               # Design system (colors, typography, spacing)
│   ├── types/index.ts               # All TypeScript types
│   ├── navigation/index.tsx         # Stack + Tab navigation
│   ├── store/index.ts               # Zustand global state
│   ├── services/
│   │   ├── supabase.ts              # Supabase client + auth helpers
│   │   ├── health.ts                # Apple HealthKit service
│   │   ├── watch.ts                 # Apple Watch connectivity
│   │   └── coach.ts                 # Claude AI + memory extraction
│   └── screens/
│       ├── Onboarding/              # 4-step onboarding (name, goal, level, days)
│       ├── Home/                    # Dashboard with health rings + quick actions
│       ├── Coach/                   # AI chat with persistent memory
│       ├── Nutrition/               # Calorie tracking with AI food parsing
│       ├── Workout/                 # Workout logging + active session
│       └── Progress/                # Charts and history
├── supabase/
│   └── migrations/
│       └── 001_initial.sql          # Full schema with RLS policies
└── docs/
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/forge-app.git
cd forge-app
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration:
   ```bash
   # Using Supabase CLI
   supabase db push
   # Or paste supabase/migrations/001_initial.sql into the SQL editor
   ```
3. Enable Apple OAuth in Supabase Auth > Providers > Apple
4. Copy your project URL and anon key

### 3. Anthropic API key

Get your key at [console.anthropic.com](https://console.anthropic.com)

### 4. Environment config

Update `app.json` extra fields:

```json
"extra": {
  "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
  "supabaseAnonKey": "YOUR_ANON_KEY",
  "anthropicApiKey": "sk-ant-..."
}
```

For production, use [Expo EAS Secrets](https://docs.expo.dev/build-reference/variables/) instead.

### 5. Run

```bash
npx expo run:ios
```

> HealthKit and WatchConnectivity require a real device. The simulator will not work for those features.

---

## Apple Watch App

The Watch app (not yet scaffolded in this repo) should be built in SwiftUI and use WatchConnectivity to:
- Receive workout instructions from the iPhone
- Send live heart rate and calorie updates back
- Display rest timers and next exercise info

See `src/services/watch.ts` for the message protocol.

---

## Memory System

Forge's AI memory works in two layers:

1. **Session context** — the full conversation history + user profile is sent with every Claude API call, so responses are always personalized.

2. **Background extraction** — every 3 user messages, a separate Claude call extracts new information (goals, injuries, wins, behavioral patterns) and merges it into the user's profile in Supabase. This happens silently in the background.

The profile includes 20+ dimensions: fitness level, goals, equipment, injuries, dietary restrictions, workout preferences, motivational style, struggles, wins, personal life details, and coach observations. The relationship stage (New → Building → Established → Deep Bond) upgrades automatically and changes how Forge talks to you.

---

## Design Philosophy

Inspired by iOS 26 Liquid Glass:
- **Light-first** — white and soft gradients, not dark moody UI
- **Layered depth** — blur, glass surfaces, soft shadows
- **Vibrant accents** — coral-orange brand color with teal and purple contrast
- **Content-forward** — UI recedes, your data is the hero
- **Instant clarity** — any screen should be understood in 2 seconds

---

## Roadmap

- [ ] Apple Watch SwiftUI companion app
- [ ] Barcode scanning for food logging
- [ ] Workout video library
- [ ] Social challenges and streak sharing
- [ ] Voice logging ("Hey Forge, I just ate a banana")
- [ ] Push notifications for workout reminders
- [ ] Progress photos with AI body composition analysis
- [ ] Sign In with Apple (Supabase OAuth)

---

## Contributing

PRs welcome. Run `npm run type-check` and `npm run lint` before submitting.
