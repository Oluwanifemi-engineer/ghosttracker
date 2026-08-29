# Magneetar Mobile App — Architecture Analysis

## Research Sources
- Life360 (4.6★, 23M+ downloads) — Family location sharing
- Google Find Hub (4.2★, 1.6B+ downloads) — Device location/lock/wipe
- Cerberus (4.3★) — Anti-theft with in-app controls
- Prey (3.3★, 62K reviews) — Device tracking and security

---

## What Top-Tier Apps Have (In-App)

### Life360 — Full In-App Dashboard
| Screen | Features |
|--------|----------|
| **Map View** | Real-time location of all circle members, device markers, battery status |
| **Circle Feed** | Activity timeline — arrivals, departures, speed alerts |
| **Member Details** | Individual device status, battery, last seen, location history |
| **Places** | Geofenced safe zones (home, school, work) with enter/exit alerts |
| **Commands** | Ring device, send location request |
| **Settings** | Notification preferences, location sharing toggles, account management |
| **Profile** | Account info, subscription, device management |

### Google Find Hub — Minimal but Complete
| Screen | Features |
|--------|----------|
| **Device List** | All registered devices with status (online/offline/battery) |
| **Map View** | Device location with accuracy circle |
| **Device Details** | Battery %, last seen, network, storage |
| **Actions** | Play Sound, Secure Device, Erase Device |
| **Settings** | Account, notifications |

### Cerberus — Feature-Rich In-App
| Screen | Features |
|--------|----------|
| **Device List** | All devices with status indicators |
| **Map View** | Real-time tracking with history |
| **Commands** | Lock, Wipe, Siren, Camera, Audio, Location |
| **Geofences** | Create/edit safe zones |
| **Alerts** | Theft detection, SIM change, low battery |
| **Settings** | Command preferences, notification channels |

---

## What Magneetar Currently Has (In-App)

| Screen | Features | Status |
|--------|----------|--------|
| **Onboarding** | Permissions setup | ✅ Working |
| **Home** | Nothing — just minimizes | ❌ Empty |
| **Map** | None in app | ❌ Missing |
| **Devices** | None in app | ❌ Missing |
| **Commands** | None in app | ❌ Missing |
| **Settings** | None in app | ❌ Missing |
| **Profile** | None in app | ❌ Missing |

**The app is 95% background service, 5% permissions screen.**

---

## What Magneetar Should Have (In-App)

### Architecture: Shared Core + Platform UI

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED CORE (KMM)                         │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ API Client   │ │ Auth Manager │ │ Data Models          │  │
│  │ (Retrofit)   │ │ (JWT/Refresh)│ │ (Kotlinx Serial)     │  │
│  └─────────────┘ └──────────────┘ └──────────────────────┘  │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Location     │ │ Command      │ │ Notification         │  │
│  │ Repository   │ │ Executor     │ │ Manager              │  │
│  └─────────────┘ └──────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Android │         │   iOS   │         │   Web   │
    │   UI    │         │   UI    │         │   UI    │
    └─────────┘         └─────────┘         └─────────┘
```

### Required Screens (Android)

#### 1. Auth Screen (Login/Signup)
- Email/password input
- No server URL field (hardcoded)
- Biometric login option
- "Forgot password" link
- Clean, professional design

#### 2. Home Dashboard (Main Screen)
- **Map view** — all devices on map with markers
- **Device cards** — bottom sheet showing:
  - Device name/model
  - Battery percentage
  - Online/offline status
  - Last seen timestamp
  - Quick actions (ring, lock, locate)
- **Circle members** — if in a circle, show all members
- **Alerts feed** — recent alerts (theft, SIM change, offline)

#### 3. Device Details Screen
- **Full-screen map** centered on device
- **Device info** — model, OS, app version, battery, network
- **Location history** — trail on map
- **Commands** — lock, siren, wipe, capture
- **Evidence** — photos, audio recordings
- **Settings** — alert preferences, notification channels

#### 4. Commands Screen
- **Quick actions** — one-tap buttons:
  - 🔊 Play Sound (siren)
  - 🔒 Lock Device
  - 📍 Locate (force location update)
  - 📸 Capture Photo
  - 🎤 Record Audio
  - ⚠️ Mark as Stolen
  - 🗑️ Erase Data (with confirmation)
- **Command history** — log of all commands sent
- **Delivery status** — sent, delivered, executed, failed

#### 5. Circles Screen
- **My Circles** — list of circles I'm in
- **Circle Details** — members, shared devices, invite code
- **Create Circle** — name, invite members
- **Join Circle** — enter invite code
- **Member Management** — remove members, change roles

#### 6. Alerts Screen
- **Alert Feed** — chronological list of all alerts:
  - Theft detected
  - SIM changed
  - Device offline
  - Geofence exit
  - Low battery
  - Command executed
- **Alert Settings** — configure which alerts to receive
- **Notification Channels** — SMS, push, email preferences

#### 7. Settings Screen
- **Account** — email, password, 2FA
- **Subscription** — plan details, upgrade
- **Devices** — manage registered devices
- **Notifications** — alert preferences per channel
- **Privacy** — data sharing, location history retention
- **About** — version, support, legal

#### 8. Profile Screen
- **User Info** — name, email, avatar
- **Device Count** — devices registered
- **Circle Count** — circles joined
- **Storage** — evidence storage used
- **Logout**

---

## Technical Implementation

### Android Architecture (MVVM + Compose)

```
app/
├── ui/
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   ├── SignupScreen.kt
│   │   └── AuthViewModel.kt
│   ├── home/
│   │   ├── HomeScreen.kt (map + device cards)
│   │   └── HomeViewModel.kt
│   ├── device/
│   │   ├── DeviceDetailScreen.kt
│   │   ├── DeviceCommandsScreen.kt
│   │   └── DeviceViewModel.kt
│   ├── circles/
│   │   ├── CirclesScreen.kt
│   │   ├── CircleDetailScreen.kt
│   │   └── CirclesViewModel.kt
│   ├── alerts/
│   │   ├── AlertsScreen.kt
│   │   └── AlertsViewModel.kt
│   ├── settings/
│   │   ├── SettingsScreen.kt
│   │   └── SettingsViewModel.kt
│   └── components/
│       ├── DeviceCard.kt
│       ├── AlertItem.kt
│       ├── CommandButton.kt
│       └── MapView.kt
├── data/
│   ├── api/
│   │   ├── MagneetarApi.kt (Retrofit)
│   │   ├── AuthInterceptor.kt
│   │   └── ApiResponse.kt
│   ├── repository/
│   │   ├── AuthRepository.kt
│   │   ├── DeviceRepository.kt
│   │   ├── CommandRepository.kt
│   │   └── CircleRepository.kt
│   └── model/
│       ├── User.kt
│       ├── Device.kt
│       ├── Command.kt
│       ├── Circle.kt
│       └── Alert.kt
├── service/
│   ├── TrackingService.kt (background)
│   ├── PersistenceService.kt (redundancy)
│   └── HealthCheckWorker.kt (WorkManager)
└── util/
    ├── TokenManager.kt
    ├── LocationHelper.kt
    └── NotificationHelper.kt
```

### Key Dependencies

```kotlin
// UI
implementation("androidx.compose.material3:material3:1.2.0")
implementation("androidx.navigation:navigation-compose:2.7.0")
implementation("com.google.android.gms:play-services-maps:18.2.0")
implementation("com.google.maps.android:maps-compose:4.3.0")

// Networking
implementation("com.squareup.retrofit2:retrofit:2.9.0")
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")

// Dependency Injection
implementation("io.insert-koin:koin-android:3.5.0")

// Background
implementation("androidx.work:work-runtime-ktx:2.9.0")
implementation("com.google.android.gms:play-services-location:21.3.0")

// Storage
implementation("androidx.datastore:datastore-preferences:1.0.0")
```

---

## Security: Mobile vs Web

### Web Dashboard
- Full access to all features
- Session-based auth (JWT in httpOnly cookies)
- No biometric required
- Trusted environment (user's own computer)

### Mobile App
- Biometric authentication required for sensitive actions
- Device-specific encryption for local storage
- Token rotation on app backgrounding
- Screenshot prevention on sensitive screens
- No sensitive data in notifications

### What Makes Magneetar Better Than Life360
| Feature | Life360 | Magneetar |
|---------|---------|-----------|
| Password to access dashboard | ❌ No | ✅ Yes (biometric + PIN) |
| Remote lock/wipe | ❌ No | ✅ Yes |
| Evidence capture | ❌ No | ✅ Yes (photo + audio) |
| Theft detection | ❌ No | ✅ Yes (Sentinel AI) |
| Offline commands | ❌ No | ✅ Yes (SMS relay) |
| Device Admin protection | ❌ No | ✅ Yes |
| Family circles | ✅ Yes | ✅ Yes |
| Real-time tracking | ✅ Yes | ✅ Yes |

---

## Implementation Priority

### Phase 1: Core Screens (Week 1)
1. Auth screen (login/signup)
2. Home screen with map
3. Device list with status cards
4. Basic commands (ring, lock, locate)

### Phase 2: Full Dashboard (Week 2)
5. Device details with history
6. Commands screen with all actions
7. Alerts feed
8. Settings screen

### Phase 3: Social Features (Week 3)
9. Circles screen
10. Circle details and management
11. Member location sharing
12. Invite/join flow

### Phase 4: Polish (Week 4)
13. Biometric authentication
14. Offline support
15. Push notifications
16. Performance optimization

---

## Conclusion

The current Magneetar Android app is a background service masquerading as a product. Top-tier apps like Life360 and Google Find Hub provide full in-app dashboards where users can:

1. **See all devices on a map** — not just in the web dashboard
2. **Send commands** — one-tap lock, siren, locate
3. **Manage circles** — create, join, invite
4. **View alerts** — theft detection, SIM change, offline
5. **Access settings** — notifications, privacy, account

The mobile app should be the PRIMARY interface, with the web dashboard as a SECONDARY option for detailed management. This is how Life360, Find My Device, and Cerberus all work.

**The app needs to go from "background service with permissions" to "full-featured mobile dashboard."**
