# GUVIO

Social mobile app built with **React Native + Expo**, featuring an interactive **3D globe** to explore posts by city and country, a real-time social feed powered by **Supabase**, and a polished mobile-first UI with light/dark themes.

## ✨ Features

- 🌍 **3D globe navigation** — search any city or country and the globe rotates to it, filtering the feed by location
- 📰 **Real-time social feed** — new posts and likes sync live through Supabase Realtime channels
- 👗 **Wardrobe** — personal collection view on each profile
- 👤 **Profiles** — your own profile, public profiles and profile search
- 💬 **Direct messages**
- ➕ **Create hub** — publish new posts with images from the device gallery
- 🌤️ **Local weather** for the selected city
- 🔔 **Local notifications**
- 🌗 **Light / dark theme** and a custom liquid-style bottom navigation
- 💾 **Offline-first storage** — posts cached locally and synced to the cloud

## 🧰 Tech stack

| Area | Tools |
|---|---|
| Framework | React Native 0.81 · Expo SDK 54 · React 19 |
| Language | TypeScript |
| 3D | Three.js · React Three Fiber · expo-gl |
| Backend | Supabase (auth + realtime) |
| Storage | AsyncStorage |
| Other | expo-notifications · expo-image-picker · expo-blur · Lucide icons |

## 📁 Project structure

```
src/
├── components/   # UI: Globe3D, HomeFeed, WardrobeView, DirectView, ProfileViews...
├── context/      # App theme (light/dark)
├── data/         # Mock data for feed and profiles
├── services/     # Supabase sync, realtime, auth, storage, weather, notifications
└── styles/
```

## 🚀 Running locally

**Requirements:** Node.js 18+ and the [Expo Go](https://expo.dev/go) app on your phone.

```bash
git clone https://github.com/whoistavs/guvio-app.git
cd guvio-app
npm install
cp .env.example .env   # optional: add your Supabase URL and anon key
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

| Script | What it does |
|---|---|
| `npm start` | Start Expo |
| `npm run lan` | Start on your local network |
| `npm run iphone` | Start with a tunnel (useful on restricted networks) |
| `npm run web` | Run in the browser |
| `npm run check` | Type-check with TypeScript |

## ⚙️ Environment variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

Both are optional — without them the app runs with local data only.

## 👤 Author

**Octavio Rodrigues Schwab** — mobile developer
[GitHub](https://github.com/whoistavs) · [LinkedIn](https://www.linkedin.com/in/octavio-schwab) · [Schwab Studio](https://schwabstudio.com.br)
