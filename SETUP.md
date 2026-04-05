# Leading Lights Global Platform — Setup Guide

## Prerequisites

- Node.js 18+
- A Firebase project (free Spark plan works for development)
- A Vercel account (for deployment)

---

## STEP 1 — Firebase Setup

### 1.1 Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Name it `llgp` (or any name you prefer)
4. Disable Google Analytics (optional)
5. Click **Create project**

### 1.2 Enable Authentication

1. In Firebase Console → **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method**, enable **Email/Password**
4. Save

### 1.3 Create Firestore Database

1. In Firebase Console → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (rules are provided)
4. Select your region (choose closest to your users — e.g. `europe-west1` for Europe/Africa)
5. Click **Enable**

### 1.4 Deploy Firestore Rules

Option A — Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
# Select your project, accept defaults
firebase deploy --only firestore:rules,firestore:indexes
```

Option B — Manual (paste into Firebase Console):
1. Go to Firestore → **Rules** tab
2. Copy the contents of `firestore.rules` and paste
3. Click **Publish**

### 1.5 Get Firebase Config

1. In Firebase Console → **Project settings** (gear icon)
2. Under **Your apps**, click **Add app → Web**
3. Register app as `llgp-web`
4. Copy the config object — you'll need these values

---

## STEP 2 — Local Development Setup

### 2.1 Install Dependencies

```bash
cd llgp
npm install
```

### 2.2 Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 2.3 Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

---

## STEP 3 — First-Time Setup (Admin Account)

### 3.1 Create Your Account

1. Open the app → click **Register**
2. Create an account with your email

### 3.2 Promote to Global Admin

Because the first user needs admin rights, do this via Firebase Console:

1. Go to Firebase Console → Firestore → `users` collection
2. Find your user document (by email or UID)
3. Edit the `role` field → change from `"participant"` to `"global_admin"`
4. Save

Now reload the app — you'll have full admin access.

### 3.3 Seed Initial Data

Once you're Global Admin, use the admin panels to:

1. **Nations & Cities** (`/admin/nations`) — Add your nations and cities
2. **Courses** (`/admin/courses`) — Create Venture 100 courses and LLGLI weeks
3. **Hubs** (`/hubs`) — Add your first hub

---

## STEP 4 — Vercel Deployment

### 4.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial LLGP platform"
git remote add origin https://github.com/YOUR_ORG/llgp.git
git push -u origin main
```

### 4.2 Deploy on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Under **Environment Variables**, add all 6 `NEXT_PUBLIC_FIREBASE_*` variables
4. Click **Deploy**

### 4.3 Add Vercel Domain to Firebase

1. After deployment, copy your Vercel URL (e.g. `llgp.vercel.app`)
2. Firebase Console → Authentication → **Settings** → **Authorized domains**
3. Add your Vercel domain
4. Also add any custom domain if you have one

---

## Architecture Overview

```
Global Admin
  └── National Leader (sees their nation)
        └── City Leader (sees their city)
              └── Hub Leader (sees their hub)
                    └── Participant (sees own data + community)
```

### Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | All user profiles + role assignments |
| `nations` | Country records |
| `cities` | City records linked to nations |
| `hubs` | Hub records with stats |
| `ventureCourses` | Venture 100 course modules |
| `ventureLessons` | Individual lessons within courses |
| `userProgress` | Per-user lesson completion |
| `llgliModules` | 6-week LLGLI programme weeks |
| `llgliSubmissions` | Participant assignment submissions |
| `monthlyReports` | Leader monthly reports |
| `resources` | File/link resource library |
| `announcements` | Global/national/city announcements |
| `testimonies` | Testimony & prayer wall posts |
| `comments` | Comments on testimonies/posts |
| `groups` | Community group spaces |
| `groupMembers` | Group membership records |
| `groupPosts` | Posts within groups |

### Phase 2 Collections (schema ready, UI pending)

| Collection | Purpose |
|---|---|
| `posts` | Social feed posts |
| `reactions` | Post reactions |
| `events` | Events system |
| `conversations` | DM conversation threads |
| `messages` | Individual messages |

---

## Feature Reference

| Route | Feature | Roles |
|---|---|---|
| `/dashboard` | Main dashboard | All |
| `/training` | Venture 100 course list | All |
| `/training/[courseId]` | Course detail + video player | All |
| `/incubator` | LLGLI week overview | All |
| `/incubator/[weekId]` | Week content + assignment | All |
| `/hubs` | Hub management | Leaders |
| `/reports` | Monthly reporting | Leaders |
| `/resources` | Resource library | All |
| `/community/directory` | Member directory | All |
| `/community/groups` | Group spaces | All |
| `/community/wall` | Testimony & Prayer wall | All |
| `/community/announcements` | Announcements | All |
| `/profile/[userId]` | Member profile | All |
| `/admin/users` | User management | Global Admin |
| `/admin/nations` | Nations & cities | Global Admin |
| `/admin/courses` | Course content management | Global Admin |

---

## Mobile Considerations

- All pages are mobile-first with responsive layouts
- Sidebar collapses to a slide-out drawer on mobile
- Modals slide up from the bottom on mobile (sheet pattern)
- Touch targets are sized ≥44px
- Minimal data fetching per page for slow connections

---

## Common Issues

**"Firebase: Error (auth/invalid-credential)"**
→ Check your `.env.local` values are correct, no trailing spaces.

**"Missing or insufficient permissions"**
→ Your Firestore rules haven't been deployed yet. Paste `firestore.rules` into the Firebase Console.

**Blank page after login**
→ Your user document exists in Auth but not in Firestore. Go to Firestore → create a document in `users` with your UID.

**Admin panel not showing**
→ Your `role` field in Firestore must be exactly `"global_admin"` (case sensitive).
