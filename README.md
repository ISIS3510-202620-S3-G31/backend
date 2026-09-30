# Ark Backend & Firebase Infrastructure

Infrastructure as Code (IaC) and Security Rules repository for the **Ark** wellbeing application.

## 🚀 Overview

This repository contains the cloud infrastructure configuration and security policies deployed to Google Cloud / Firebase for:
- **Firebase Authentication:** User identity, token validation and session persistence.
- **Cloud Firestore:** Database security rules enforcing per-user data isolation.
- **Cloud Storage:** Storage bucket policies for user photos and assets with content-type verification.
- **Firebase Emulators:** Local emulator configuration for offline integration testing.

---

## 🔒 Security Architecture (`firestore.rules` & `storage.rules`)

1. **Principle of Least Privilege:**
   - Public read access is strictly limited to the immutable tools catalog (`/tools/{toolId}`).
   - All personal data paths (`/users/{userId}/*`) require active authentication and strict ownership verification (`request.auth.uid == userId`).
2. **Data Integrity & Privacy:**
   - Photos uploaded to Cloud Storage must match image content types and remain below 10MB in size.
   - Deletion and updates are restricted to the authenticated document owner.

---

## 🛠️ Deployment Instructions

### Prerequisites
- Node.js (v18+)
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Authenticate with Firebase
```bash
firebase login
```

### 2. Deploy Security Rules
```bash
# Deploy all rules and configurations
firebase deploy

# Or deploy specifically Firestore or Storage rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 3. Run Local Emulators (Optional for local testing)
```bash
firebase emulators:start
```
Emulator Suite UI will be accessible at `http://localhost:4000`.
