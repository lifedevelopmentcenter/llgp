# BuddyBoss → LLGP Migration

## Step 1 — Export from BuddyBoss

1. In WordPress admin, install **WP All Export** (free plugin)
2. Go to **All Export → New Export → Users**
3. Map these fields in the export:
   - `email` → User Email
   - `display_name` → Display Name
   - `first_name` → First Name
   - `last_name` → Last Name
   - `bio` → BuddyPress field: "About Me" (or similar)
   - `location` → BuddyPress field: "Location" / "City"
   - `country_code` → BuddyPress field: "Country" (use 2-letter ISO code e.g. NG, KE, GH)
   - `role` → User Role (Administrator → global_admin, etc.)
   - `photo_url` → Profile Photo URL (check "Use full URL")
4. Export as **CSV**
5. Rename the file to `members.csv` and put it in the `scripts/` folder

See `members-template.csv` for the exact column headers needed.

---

## Step 2 — Get your Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project
2. Click the **gear icon** → **Project Settings**
3. Click the **Service Accounts** tab
4. Click **Generate new private key** → Download JSON
5. Rename the file to `serviceAccount.json`
6. Place it in the `scripts/` folder

> ⚠️ NEVER commit serviceAccount.json to git. It is already in .gitignore.

---

## Step 3 — Set your Firebase Web API Key (for password reset emails)

Find your Web API Key in Firebase Console → Project Settings → General → Web API Key.

Then run:
```bash
export FIREBASE_API_KEY="AIzaSy..."
```

Or add it to your shell profile. Without this, migration still works but password reset emails won't send automatically — you can send them manually from Firebase Auth Console afterwards.

---

## Step 4 — Test with dry run

```bash
cd /path/to/llgp
node scripts/migrate-buddyboss.js --dry-run
```

This runs without writing anything. Check the output for any email errors or malformed rows.

---

## Step 5 — Run the migration

```bash
node scripts/migrate-buddyboss.js
```

Output per user:
- `auth created, profile created ✅` — new user fully imported
- `auth exists, profile exists` — already migrated, safely skipped
- `photo ✓` — profile photo downloaded and uploaded to Firebase Storage
- `photo ✗` — photo URL failed (user can upload their own later)
- `reset sent` — password reset email sent to user

The script is **safe to re-run** — it skips existing users.

---

## Step 6 — Manual password reset (if FIREBASE_API_KEY wasn't set)

In Firebase Console → Authentication → Users:
1. Click the **⋮** menu next to each user
2. Click **Send password reset email**

Or use the Firebase CLI:
```bash
firebase auth:export users.json
# Then for each user, send reset via console
```

---

## Role Mapping

| BuddyBoss Role | LLGP Role |
|---|---|
| administrator | global_admin |
| national_leader (custom) | national_leader |
| city_leader (custom) | city_leader |
| hub_leader (custom) | hub_leader |
| subscriber / member | participant |

If your BuddyBoss roles use different names, edit the `mapRole()` function in `migrate-buddyboss.js`.

---

## After Migration

1. **Assign nations/cities** — Go to Admin → Members and set nationId/cityId for each user
2. **Approve leaders** — Set roles for national/city/hub leaders
3. **Verify photos** — Check a few profiles in the app
4. **Test login** — Have a test user click their password reset link and log in
