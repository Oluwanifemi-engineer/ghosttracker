# Firebase FCM Setup — Free Push Notifications

Firebase Cloud Messaging (FCM) lets Magneetar wake up phones in Doze mode to deliver commands (lock, siren, capture). The free tier handles 50,000 notifications/day — more than enough.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Project name: `Magneetar`
4. Disable Google Analytics (not needed)
5. Click **"Create project"**

## Step 2: Add Android App

1. In the Firebase console, click **"Add app"** → **Android**
2. Android package name: `com.magneetar.app`
3. App nickname: `Magneetar`
4. Click **"Register app"**

## Step 3: Download google-services.json

1. Firebase will generate a `google-services.json` file
2. Download it
3. Place it at: `android-app/app/google-services.json`

This file is already in `.gitignore` — it will never be committed.

## Step 4: Create Service Account Key (for server)

1. In Firebase console → **Project Settings** (gear icon)
2. Go to **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Save the downloaded JSON file as: `server/firebase-key.json`

This file is already in `.gitignore`.

## Step 5: Configure the Server

1. Edit `server/.env`:
```bash
MT_FIREBASE_KEY=./firebase-key.json
```

2. Restart the server:
```bash
cd ~/magneetar && docker compose restart server
```

3. Verify Firebase initialized:
```bash
docker logs magneetar-server | grep -i firebase
# Should see: "Firebase FCM initialized successfully"
```

## Step 6: Configure the Android App

The `google-services.json` file automatically configures the app. No code changes needed.

Build the app:
```bash
cd android-app
./gradlew assembleSideloadRelease
```

## How It Works

```
Dashboard clicks "Lock"
  → Server tries WebSocket (device might be offline)
  → Server tries SMS relay (might not be configured)
  → Server sends FCM high-priority data message
  → Android wakes from Doze mode
  → MagneetarMessagingService receives the command
  → Executes lock, siren, or capture
  → Sends acknowledgment back to server
```

## Free Tier Limits

| Feature | Free Limit | Magneetar Usage |
|---------|-----------|-----------------|
| Notifications/day | 50,000 | ~200 (10 devices × 20 commands) |
| Topics | 2,000 | 1 (command channel) |
| Messaging | Unlimited | N/A |
| Storage | 1 GB | N/A |
| Bandwidth | 10 GB/month | ~100 MB |

**You will never hit the free tier limits.**

## Troubleshooting

**FCM token not registering:**
```bash
# Check Android logs for FCM token
adb logcat | grep -i "fcm\|firebase\|messaging"
```

**Server not sending FCM:**
```bash
# Check server logs
docker logs magneetar-server | grep -i "fcm\|firebase"
```

**Notifications not arriving:**
- Ensure the app has notification permission (Android 13+)
- Check battery optimization is disabled for Magneetar
- Verify `google-services.json` is in the right place
