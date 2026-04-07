# Settings Screen

## Summary

Add a Settings screen accessible from the ProfileMenu dropdown. Consolidates scattered controls and adds customization for voice detection keywords and countdown duration, synced to the native background service.

## Sections

### 1. Voice Detection
- **Trigger Keywords** — editable list with add/remove. Default: help, help me, save me, emergency, bachao, bacha, madad, sos. Stored in AsyncStorage key `@guardian_keywords`. Synced to native SharedPreferences via `GuardianServiceModule.setKeywords()`.
- **Countdown Duration** — segmented control: 5s / 10s / 15s / 20s. Default: 10s. Stored in AsyncStorage key `@guardian_countdown_duration`. Synced to native SharedPreferences via `GuardianServiceModule.setCountdownDuration()`.
- **Background Protection** — toggle (duplicated from HomeScreen for discoverability). Uses existing `useBackgroundProtection` hook.

### 2. Appearance
- **Dark / Light Mode** — toggle using existing `useTheme().toggleTheme()`.

### 3. Account
- **Email** — read-only display from `useAuth().user.email`.
- **Sign Out** — button calling `useAuth().signOut()`.

## Files

### New
- `mobile/src/screens/SettingsScreen.tsx` — the screen with all sections above
- `mobile/src/hooks/useSettings.ts` — hook to read/write keywords and countdown duration from AsyncStorage, and sync to native service

### Modified
- `mobile/src/navigation/RootNavigator.tsx` — add `Settings` to `AppStackParamList` and `AppStack.Screen`
- `mobile/src/components/ProfileMenu.tsx` — add "Settings" menu item that navigates to Settings screen
- `mobile/modules/guardian-service/index.ts` — export new `setKeywords` and `setCountdownDuration` methods
- `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianServiceModule.kt` — add `setKeywords(keywords: List<String>)` and `setCountdownDuration(seconds: Int)` async functions
- `mobile/modules/guardian-service/android/src/main/java/com/guardian/sos/GuardianForegroundService.kt` — read keywords and countdown duration from SharedPreferences instead of hardcoded constants

## Native Service Changes

### GuardianServiceModule.kt
- `setKeywords(keywords: String)` — receives JSON array string, saves to SharedPreferences key `distress_keywords`
- `setCountdownDuration(seconds: Int)` — saves to SharedPreferences key `countdown_duration_seconds`

### GuardianForegroundService.kt
- `DISTRESS_KEYWORDS` reads from SharedPreferences `distress_keywords` (falls back to hardcoded defaults)
- `COUNTDOWN_DURATION_MS` reads from SharedPreferences `countdown_duration_seconds` (falls back to 10)

## Data Flow

```
SettingsScreen → useSettings hook → AsyncStorage (JS side)
                                  → GuardianServiceModule.setKeywords() → SharedPreferences (native)
                                  → GuardianServiceModule.setCountdownDuration() → SharedPreferences (native)

GuardianForegroundService reads SharedPreferences on keyword check / countdown start
```

## Edge Cases
- Keywords list empty: show warning, don't allow saving empty list
- Service not running when settings change: settings saved to SharedPreferences, applied on next service start
- Default values: if SharedPreferences has no custom values, use hardcoded defaults
