# TrackCare Offline - Mobile App (Expo React Native)

## About This Port

This is a React Native (Expo) port of the original TrackCare Offline web frontend (React + Vite + Tailwind + Electron). The goal was to keep **all functionality identical** while adapting the UI for mobile devices.

### What Changed

| Aspect | Web (Original) | Mobile (This) |
|---|---|---|
| Framework | React 18 + Vite | React Native (Expo SDK 54) |
| Navigation | react-router-dom (HashRouter) | @react-navigation/native-stack |
| Styling | Tailwind CSS + dark: prefix | React Native StyleSheet + ThemeContext color tokens |
| Token storage | localStorage | expo-secure-store (native keychain) |
| Form selects | HTML `<select>` | Custom Modal-based pickers |
| Episode list | HTML `<table>` | FlatList with card layout + pull-to-refresh |
| Patient history | Fixed sidebar panel | Full-screen slide-up modal |
| Language detection | Manual selection | expo-localization (auto-detect device language) |
| Backend URL | Hardcoded localhost:8000 | Configurable via `serverConfig.ts` |

### What Stayed the Same

- All API calls and endpoints (same backend)
- JWT authentication with refresh token flow
- All screens: Login, Episodes, New Episode, Clinical Note
- User settings, admin panel, user management
- Dark/light theme support
- Spanish/English translations (same files)
- RUT validation logic
- Connection status monitoring
- Sync status tracking
- Read-only mode handling

---

## Prerequisites

- **Node.js** 18+
- **Backend running** at `http://localhost:8000` (or configured URL)
- For **Expo Go**: [Expo Go app](https://expo.dev/go) installed on your phone
- For **Dev builds**: Android Studio (Android) or Xcode (iOS/macOS only)
- For **Production builds**: EAS CLI (`npm install -g eas-cli`) or local Android Studio/Xcode

---

## Running in Development

### Option 1: Expo Go (Quickest, No Native Build)

Expo Go is a pre-built app that loads your JS bundle. Best for rapid UI development.

```bash
# Install dependencies (if not done)
npm install

# Start the dev server
npx expo start
```

This shows a QR code in the terminal. Scan it with:
- **Android**: Expo Go app → scan QR
- **iOS**: Camera app → scan QR → opens Expo Go

> **Limitations**: Expo Go uses a fixed set of native modules. If you add a library that requires custom native code not included in Expo Go, you'll need a dev build instead.

### Option 2: Development Build (Full Native Access)

A dev build compiles the native code and installs a custom debug app on your device/emulator. Required when using native modules not in Expo Go, or to test the app in a closer-to-production environment.

**Android (emulator or connected device):**

```bash
# Generate native android/ folder (first time or after adding native deps)
npx expo prebuild

# Build and run on connected device/emulator
npx expo run:android
```

**iOS (macOS only):**

```bash
npx expo prebuild
npx expo run:ios
```

> **Tip**: If you hit build errors after updating packages, run `npx expo prebuild --clean` to regenerate the native folders from scratch.

### Dev Server Options

```bash
# Start with cache cleared
npx expo start -c

# Start and open Android emulator
npx expo start --android

# Start and open iOS simulator (macOS only)
npx expo start --ios

# Start web version
npx expo start --web
```

---

## Building for Production

### Option A: EAS Build (Cloud, Recommended)

[EAS Build](https://docs.expo.dev/build/introduction/) compiles the app in Expo's cloud. No local Android Studio/Xcode needed.

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo account
eas login

# Configure build (first time)
eas build:configure

# Build Android APK
eas build --platform android --profile preview

# Build Android AAB (for Play Store)
eas build --platform android --profile production

# Build iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

### Option B: Local Build

```bash
# Generate native project
npx expo prebuild --clean

# Android: open in Android Studio and build
# The project is in ./android/

# iOS (macOS only): open in Xcode
# The project is in ./ios/
```

For a local Android APK without Android Studio:

```bash
cd android
./gradlew assembleRelease
# APK is at: android/app/build/outputs/apk/release/app-release.apk
```

---

## Project Structure

```
App.tsx                          # Entry point: providers, navigation, backend check
src/
├── config/
│   ├── lang_es.ts               # Spanish translations
│   └── lang_en.ts               # English translations
├── contexts/
│   ├── ThemeContext.tsx          # Dark/light theme with color tokens
│   ├── LanguageContext.tsx       # i18n provider (ES/EN)
│   └── UserContext.tsx           # Current user state + read-only mode
├── hooks/
│   └── useConnectionStatus.ts   # Backend + central connectivity polling
├── lib/
│   ├── api.ts                   # Full API client with token refresh
│   ├── auth.ts                  # JWT storage (SecureStore + in-memory cache)
│   ├── serverConfig.ts          # Configurable backend URL
│   ├── rutValidation.ts         # Chilean RUT validation
│   └── timeAgo.ts               # Relative time formatting
├── navigation/
│   └── types.ts                 # RootStackParamList type definitions
├── screens/
│   ├── LoginScreen.tsx          # Login with info sidebar overlay
│   ├── EpisodesScreen.tsx       # Episode list with tabs + pull-to-refresh
│   ├── NewEpisodeScreen.tsx     # Create patient/episode form
│   └── ClinicalNoteScreen.tsx   # View episode + notes + create note
├── components/
│   ├── Header.tsx               # App header with nav, status, menus
│   ├── EpisodeRow.tsx           # Episode card for FlatList
│   ├── PatientHistoryModal.tsx  # Patient history (allergies, encounters, labs)
│   └── UserSettingsModal.tsx    # Settings + user management (admin)
└── types/
    └── index.ts                 # All shared TypeScript interfaces
```

---

## Troubleshooting

### `expo-dev-menu` Kotlin compilation error

If you see `'onDidCreateReactActivityDelegateNotification' overrides nothing`, the `expo-dev-client` version is mismatched with your Expo SDK. Fix with:

```bash
npx expo install --fix
npx expo prebuild --clean
```

### Backend not reachable from device

When running on a physical device, `localhost` refers to the phone itself. Use your computer's local IP instead. Update the server URL in the app's login screen or in `src/lib/serverConfig.ts`.

### Clean rebuild

```bash
npx expo prebuild --clean
npx expo start -c
```
