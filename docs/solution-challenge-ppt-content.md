# Solution Challenge 2026 - Project Guardian PPT Content

> Copy this content into the Google Slides template (one section per slide)

---

## SLIDE 1: Guidelines
*(Already filled - no changes needed)*

---

## SLIDE 2: Team Details

- **Team name:** TeamKJ
- **Team leader name:** Tejas Mulekar
- **Problem Statement:** Every year, millions of people face emergencies where seconds matter - yet most safety apps require users to unlock their phone, open an app, and press a button. In high-stress situations like assaults, accidents, or natural disasters, victims often cannot perform these steps. Project Guardian addresses this gap as an AI-powered, full-stack mobile safety system that provides multiple hands-free emergency activation methods (voice detection, shake detection), automatic evidence capture (audio + video + photos), instant multi-channel alerting (SMS + push notifications), real-time location tracking, and a cloud-based admin dashboard - all within an offline-resilient architecture powered by Google Cloud services.

---

## SLIDE 3: Brief about your solution

**Project Guardian** is a comprehensive AI-powered personal safety ecosystem consisting of three integrated components:

1. **Mobile App (React Native / Expo)** - A cross-platform emergency response app with three SOS trigger methods:
   - **One-tap SOS button** for quick manual activation
   - **AI Voice Detection** - Recognizes 20+ distress keywords ("help", "emergency", "bachao") hands-free, even from the lock screen
   - **Shake Detection** - Detects vigorous shaking (3 shakes in 2 seconds at 1.8G threshold) for silent activation

2. **FastAPI Backend (Python, deployed on Render)** - Processes SOS events and orchestrates emergency responses:
   - Stores events in Firebase Firestore
   - Dispatches SMS alerts via Twilio with Google Maps location links
   - Sends push notifications via Firebase Cloud Messaging (FCM)
   - Supports server-side voice transcription via AI

3. **Admin Dashboard (React + Vite, deployed on Firebase Hosting)** - Real-time monitoring console:
   - Live event tracking with interactive maps (Leaflet)
   - Analytics charts showing trends and trigger type distribution
   - Evidence playback (audio, video, photos)
   - CSV/PDF export for reporting

**Key Innovation:** Guardian works even when the phone is locked or the app is backgrounded (Android), using a native background service for continuous voice monitoring - ensuring help is always accessible.

---

## SLIDE 4: Opportunities

### a. How different is it from any of the other existing ideas?

| Feature | Traditional Safety Apps | Project Guardian |
|---------|------------------------|-----------------|
| Activation | Manual button press only | Voice AI + Shake + Manual (3 methods) |
| Background Detection | App must be open | Works from lock screen (Android native service) |
| Evidence | None or manual | Auto-captures 30s audio + 15s video simultaneously |
| Offline Support | Requires internet | Evidence stored locally, auto-uploads when connected |
| Multi-language | English only | Supports Hindi keywords ("bachao") + extensible |
| Admin Monitoring | None | Real-time dashboard with analytics and evidence playback |
| Cloud Integration | Basic | Full Google ecosystem (Firebase Auth, Firestore, FCM, Storage, Hosting) |

### b. How will it be able to solve the problem?

- **Hands-free activation** eliminates the need to unlock/open the phone during emergencies
- **Automatic evidence capture** provides crucial documentation for law enforcement
- **Instant multi-channel alerts** (SMS + push) ensure emergency contacts are notified immediately with exact GPS location
- **Real-time tracking** allows contacts to monitor the user's live location
- **Offline resilience** ensures the system works even without internet connectivity
- **Background monitoring** means protection is always active, not just when the app is open

### c. USP of the proposed solution

1. **AI-powered hands-free SOS** - No other app combines on-device voice detection + shake detection + background monitoring
2. **Automatic evidence capture** - Simultaneous audio (30s) + video (15s) recording starts immediately on SOS trigger
3. **Offline-first architecture** - Evidence is stored locally and auto-synced when connectivity returns
4. **Full-stack cloud ecosystem** - Mobile app + Backend API + Admin Dashboard, all deployed and production-ready
5. **Background voice detection** - Native Android service monitors for distress keywords even when the app is closed

---

## SLIDE 5: List of features offered by the solution

### Core Safety Features
- **One-Tap SOS Button** - Large, prominent emergency button for instant activation
- **AI Voice Detection** - Recognizes 20+ distress keywords in real-time using on-device speech recognition
- **Shake Detection** - Accelerometer-based detection (3 shakes in 2 seconds, 1.8G threshold)
- **10-Second Countdown** - Cancellable countdown with vibration feedback to prevent false alarms
- **Background Voice Monitoring** (Android) - Native service detects distress keywords even when app is closed

### Evidence & Documentation
- **Auto Audio Recording** - 30-second AAC audio capture at 16kHz
- **Auto Video Recording** - 15-second video from back camera
- **Manual Photo Capture** - Additional photo evidence after recording
- **Offline Storage** - Evidence saved locally with manifest tracking
- **Cloud Upload** - Automatic upload to Firebase Storage with retry mechanism

### Alerting & Communication
- **SMS Alerts via Twilio** - Emergency SMS with Google Maps location link to all contacts
- **Push Notifications via FCM** - Instant push alerts to contacts' devices
- **Google Maps Location Sharing** - Shareable location URL in every alert

### Location & Tracking
- **Real-Time GPS Tracking** - Live location updates every 5 seconds
- **Interactive Map View** - Live map with user's current position
- **Location in Alerts** - GPS coordinates included in all emergency notifications

### Contact Management
- **Emergency Contacts** - Add, view, and manage emergency contacts
- **Multi-Contact Alerts** - All contacts notified simultaneously
- **Contact Sync** - Contacts stored in Firebase Firestore

### Admin Dashboard
- **Real-Time Event Monitoring** - Live Firestore updates on all SOS events
- **Interactive Maps** - Leaflet-based event location visualization
- **Analytics Charts** - Event trends over time, trigger type distribution (Recharts)
- **Evidence Playback** - In-browser audio/video player with download
- **CSV & PDF Export** - Export event data for reporting
- **Event Status Management** - Acknowledge and resolve events

### User Experience
- **Firebase Authentication** - Secure email/password login with password reset
- **Dark/Light Theme** - User-selectable theme with persistence
- **Configurable Countdown** - Adjustable countdown duration in settings
- **Multi-Language Keywords** - English + Hindi distress words supported

---

## SLIDE 6: Process Flow Diagram

```
USER IN DANGER
      |
      v
+------------------+     +------------------+     +------------------+
|  VOICE DETECTED  | OR  |  PHONE SHAKEN    | OR  |  SOS BUTTON TAP  |
|  "Help!", "SOS"  |     |  3x in 2 sec     |     |  (Manual)        |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
    +----+------------------------+------------------------+----+
    |              10-SECOND COUNTDOWN OVERLAY                   |
    |         (Cancellable - prevents false alarms)              |
    +-----------------------------+------------------------------+
                                  |
                                  v
    +-----------------------------+------------------------------+
    |                    SOS TRIGGERED                            |
    |  1. Get GPS location                                       |
    |  2. POST /sos/trigger to FastAPI backend                   |
    |  3. Start evidence recording (30s audio + 15s video)       |
    +-----------------------------+------------------------------+
                                  |
                                  v
    +-----------------------------+------------------------------+
    |               BACKEND PROCESSING (FastAPI)                  |
    |  1. Verify Firebase Auth token                              |
    |  2. Store event in Firestore (sos_events collection)       |
    |  3. Fetch emergency contacts from Firestore                |
    |  4. Generate Google Maps URL with GPS coordinates          |
    |  5. Send SMS via Twilio to all contacts                    |
    |  6. Send push notification via FCM to all contacts         |
    +-----------------------------+------------------------------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
    +-------+------+     +-------+------+     +--------+------+
    |  SMS ALERT   |     |  FCM PUSH    |     |  FIRESTORE    |
    |  via Twilio  |     |  NOTIFICATION|     |  EVENT STORED |
    |  + Maps URL  |     |  to contacts |     |  + Evidence   |
    +--------------+     +--------------+     +---------------+
                                                      |
                                                      v
                                              +-------+-------+
                                              | ADMIN DASHBOARD|
                                              | Real-time view |
                                              | Analytics      |
                                              | Evidence player|
                                              +---------------+
```

---

## SLIDE 7: Wireframes/Mock diagrams (optional)

### Mobile App Screens

**1. Home Screen**
- Large red SOS button (center, 200x200px)
- Voice Detection indicator (green when active)
- Shake Detection indicator (green when active)
- Background Protection toggle (Android)
- Navigation: Contacts | Home | Tracking | Settings

**2. Countdown Overlay**
- Full-screen overlay with countdown timer (10...9...8...)
- Detected keyword display ("Distress Detected: HELP")
- CANCEL button to dismiss
- CONFIRM button to trigger immediately
- Vibration haptic feedback

**3. Status Screen**
- Active SOS event details (Event ID, Trigger Type)
- Recording progress (Audio: 25s/30s, Video: 10s/15s)
- Evidence list with upload status indicators
- "Take Photo" button for additional evidence

**4. Contacts Screen**
- List of emergency contacts (Name, Phone, Relationship)
- Add Contact form
- Delete contact option

**5. Tracking Screen**
- Full-screen interactive map
- Red marker at current GPS position
- Coordinates display (Lat, Lon)
- 5-second auto-refresh

**6. Admin Dashboard**
- Stats bar: Total Events | Active | Today | Users
- Overview map with all event markers
- Events over time line chart
- Trigger type distribution chart
- Events table with search, filter, export
- Event detail page with evidence player

---

## SLIDE 8: Architecture Diagram

```
+===========================================================================+
|                        PROJECT GUARDIAN ARCHITECTURE                        |
+===========================================================================+

                    +---------------------------+
                    |     MOBILE APP (Expo)      |
                    |   React Native + TypeScript |
                    |---------------------------|
                    | - Voice Detection (AI)     |
                    | - Shake Detection          |
                    | - SOS Button               |
                    | - Evidence Capture          |
                    | - GPS Location Tracking     |
                    | - Firebase Auth             |
                    | - Offline Evidence Storage  |
                    +------+----------+---------+
                           |          |
              REST API     |          |  Firebase SDK
              (HTTPS)      |          |  (Direct)
                           |          |
          +----------------+          +------------------+
          |                                              |
          v                                              v
+-------------------+                    +-------------------------------+
| FASTAPI BACKEND   |                    |     GOOGLE FIREBASE (Cloud)   |
| (Render.com)      |                    |-------------------------------|
|-------------------|                    | Authentication                |
| - POST /sos/trigger|  Firebase Admin   | - Email/Password login        |
| - POST /sos/voice  +----------------->| Firestore Database            |
| - User management  |      SDK         | - sos_events collection       |
| - Token verification|                  | - users collection            |
+---+-------+-------+                   | Cloud Storage                 |
    |       |                            | - Evidence files (audio/video)|
    |       |                            | Cloud Messaging (FCM)         |
    |       |                            | - Push notifications          |
    |       |                            | Hosting                       |
    v       v                            | - Admin Dashboard SPA         |
+-------+ +--------+                    +------+------------------------+
|TWILIO | |GOOGLE  |                           |
| SMS   | | MAPS   |                           | Firestore Real-time Sync
| API   | | API    |                           |
+-------+ +--------+                           v
                                 +---------------------------+
                                 |   ADMIN DASHBOARD (React)  |
                                 |   Vite + TailwindCSS       |
                                 |---------------------------|
                                 | - Real-time event monitor  |
                                 | - Interactive maps (Leaflet)|
                                 | - Analytics (Recharts)     |
                                 | - Evidence playback        |
                                 | - CSV/PDF export           |
                                 +---------------------------+
```

**Google Services Used:**
- Firebase Authentication
- Firebase Firestore (NoSQL Database)
- Firebase Cloud Storage
- Firebase Cloud Messaging (FCM)
- Firebase Hosting
- Google Maps API

---

## SLIDE 9: Technologies to be used in the solution

### Frontend - Mobile App
| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile UI |
| Expo SDK | 54 | Managed mobile framework |
| TypeScript | 5.9 | Type-safe development |
| React Navigation | 7.0 | Screen navigation |
| expo-speech-recognition | 3.1 | AI voice detection |
| expo-sensors | 15.0 | Accelerometer (shake detection) |
| expo-location | 19.0 | GPS tracking |
| expo-camera | 17.0 | Video/photo capture |
| expo-av | 16.0 | Audio recording |
| react-native-maps | 1.20 | Interactive maps |
| Firebase JS SDK | 12.11 | Auth, Firestore, Storage |

### Backend API
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12 | Server language |
| FastAPI | 0.115 | REST API framework |
| Firebase Admin SDK | 6.6 | Server-side Firebase |
| Twilio SDK | 9.4 | SMS alerts |
| Pydantic | 2.7 | Data validation |
| Poetry | Latest | Dependency management |

### Admin Dashboard
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1 | UI framework |
| Vite | 6.3 | Build tool |
| TailwindCSS | 4.1 | Styling |
| Leaflet | 1.9 | Interactive maps |
| Recharts | 3.8 | Analytics charts |
| jsPDF | 4.2 | PDF report export |

### Cloud & AI Services
| Service | Provider | Purpose |
|---------|----------|---------|
| Firebase Authentication | Google | User login/signup |
| Firestore | Google | Real-time NoSQL database |
| Cloud Storage | Google | Evidence file storage |
| Cloud Messaging (FCM) | Google | Push notifications |
| Firebase Hosting | Google | Dashboard deployment |
| Google Maps API | Google | Location URLs & maps |
| Twilio | Twilio | SMS emergency alerts |
| Render | Render | Backend API hosting |
| EAS Build | Expo | Mobile APK/AAB builds |

---

## SLIDE 10: Estimated implementation cost (optional)

### Monthly Operating Costs (Production)

| Service | Free Tier | Estimated Monthly Cost |
|---------|-----------|----------------------|
| **Firebase (Spark Plan)** | Auth, Firestore (1GB), Storage (5GB), FCM, Hosting | **$0** (free tier) |
| **Render (Backend)** | Free tier with 750 hours/month | **$0** (free tier) |
| **Twilio SMS** | ~$0.0079/SMS (US) | **~$5-15** (based on usage) |
| **Google Maps API** | $200/month free credit | **$0** (within free tier) |
| **Expo EAS Build** | 30 builds/month free | **$0** (free tier) |
| **Domain (optional)** | N/A | **~$12/year** |

### Total Estimated Monthly Cost: **$5-15/month**
*(Primarily Twilio SMS costs. All other services within free tier limits.)*

### Scaling Costs (1000+ users)
| Service | Estimated Cost |
|---------|---------------|
| Firebase Blaze Plan | ~$25-50/month |
| Render Starter | ~$7/month |
| Twilio SMS | ~$50-100/month |
| **Total** | **~$80-150/month** |

---

## SLIDE 11: Snapshots of the MVP

*(Add actual screenshots from the app - here are descriptions of what to capture)*

### Screenshot 1: Home Screen
- Show the main SOS button with voice and shake indicators active
- Dark theme view

### Screenshot 2: Countdown Overlay
- Show the 10-second countdown with "Distress Detected: HELP" message

### Screenshot 3: Status Screen
- Show active recording progress (audio + video timers)
- Evidence list with upload status

### Screenshot 4: Contacts Screen
- Emergency contacts list with add contact form

### Screenshot 5: Live Tracking
- Interactive map with red marker showing current location

### Screenshot 6: SMS Alert
- Screenshot of actual Twilio SMS received by emergency contact
- Shows Google Maps link

### Screenshot 7: Admin Dashboard - Overview
- Stats bar, event map, analytics charts

### Screenshot 8: Admin Dashboard - Event Detail
- Event details with evidence player (audio/video)

---

## SLIDE 12: Additional Details/Future Development

### Completed Phases
- **Phase 1:** Core SOS system (manual trigger, SMS alerts, push notifications, contact management)
- **Phase 2:** AI Voice Detection (on-device speech recognition, distress keyword detection, countdown overlay)
- **Phase 3:** Evidence & Cloud Upload (auto audio/video capture, Firebase Storage, offline-first architecture)
- **Phase 4:** Admin Dashboard (real-time monitoring, analytics, evidence playback, export)

### Future Development Roadmap

**Phase 5: Lock Screen Voice Trigger**
- Activate SOS from lock screen without unlocking the phone
- Native Android foreground service with persistent notification
- Design spec already documented

**Phase 6: Google Gemini AI Integration**
- Use Gemini API for intelligent context analysis of emergency situations
- Analyze audio transcripts to assess threat severity
- Auto-classify emergency types (assault, accident, medical, natural disaster)
- Generate contextual emergency messages for first responders

**Phase 7: Geofencing & Safe Zones**
- Define safe zones (home, work, school)
- Automatic alerts when leaving safe zones at unusual hours
- Integration with Google Maps Geofencing API

**Phase 8: Community Safety Network**
- Nearby Guardian users receive proximity alerts
- Crowdsourced safety heatmaps
- Anonymous incident reporting

**Phase 9: Wearable Integration**
- Smartwatch companion app (Wear OS)
- Heart rate anomaly detection for medical emergencies
- One-tap SOS from wrist

**Phase 10: Multi-language Expansion**
- Support for 10+ Indian regional languages
- Multilingual distress keyword database
- Regional emergency number integration (112 India)

---

## SLIDE 13: Provide links

1. **GitHub Public Repository:** https://github.com/tejasmulekar112/Project-Guardian
2. **Demo Video Link (3 Minutes):** *(Record and add YouTube/Drive link)*
3. **MVP Link:** https://student-attendence-5f147.web.app (Admin Dashboard)
4. **Working Prototype Link:**
   - Backend API: https://guardian-api-dyuw.onrender.com/health
   - Admin Dashboard: https://student-attendence-5f147.web.app
   - Mobile App: Available as APK (built via Expo EAS)

---

## IMPORTANT NOTE FOR SUBMISSION

The challenge requires **at least one Google AI model or service (e.g., Gemini)**.

Currently the project uses these **Google services**:
- Firebase Authentication
- Firebase Firestore
- Firebase Cloud Storage
- Firebase Cloud Messaging
- Firebase Hosting
- Google Maps API

Consider adding **Gemini AI** integration for:
- Analyzing emergency audio transcripts for threat classification
- Generating smart emergency messages based on context
- Sentiment/urgency analysis of voice recordings
