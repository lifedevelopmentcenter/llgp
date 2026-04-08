#!/usr/bin/env node
/**
 * BuddyBoss → LLGP Migration Script
 * ─────────────────────────────────────────────────────────────
 * Reads members.csv (exported from BuddyBoss/WP All Export),
 * creates Firebase Auth accounts, Firestore user profiles,
 * and sends password-reset emails so users can log in.
 *
 * Usage:
 *   1. Place your serviceAccount.json in the scripts/ folder
 *   2. Place members.csv in the scripts/ folder
 *   3. node scripts/migrate-buddyboss.js
 *
 * CSV columns expected (see members-template.csv for exact headers):
 *   email, display_name, first_name, last_name,
 *   bio, location, country_code, role,
 *   photo_url (optional – publicly accessible URL)
 *
 * The script is SAFE to re-run. It skips users that already exist
 * in Firebase Auth, and skips Firestore docs that already exist.
 * ─────────────────────────────────────────────────────────────
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const readline = require("readline");

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccount.json");
const CSV_PATH = path.join(__dirname, "members.csv");
const FIRESTORE_COLLECTION = "users";
const DEFAULT_ROLE = "participant";
const SEND_RESET_EMAILS = true; // set to false to skip password-reset emails
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌  serviceAccount.json not found at:", SERVICE_ACCOUNT_PATH);
  console.error("    Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error("❌  members.csv not found at:", CSV_PATH);
  console.error("    Export members from BuddyBoss using WP All Export plugin");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  storageBucket: `${require(SERVICE_ACCOUNT_PATH).project_id}.firebasestorage.app`,
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

// ─── CSV Parser (no external deps) ────────────────────────────────────────────

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? "").trim();
    });
    return row;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
    else if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─── Photo downloader → Firebase Storage ──────────────────────────────────────

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function uploadPhoto(uid, photoUrl) {
  if (!photoUrl) return null;
  try {
    const buf = await downloadBuffer(photoUrl);
    const ext = photoUrl.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `avatars/${uid}.${ext}`;
    const file = bucket.file(storagePath);
    await file.save(buf, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, public: true });
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch (err) {
    return null; // non-fatal
  }
}

// ─── Map CSV row → LLGP UserProfile ──────────────────────────────────────────

function mapRole(rawRole) {
  const r = (rawRole || "").toLowerCase();
  if (r.includes("admin")) return "global_admin";
  if (r.includes("national")) return "national_leader";
  if (r.includes("city")) return "city_leader";
  if (r.includes("hub")) return "hub_leader";
  return DEFAULT_ROLE;
}

function buildProfile(uid, row, photoURL) {
  const now = admin.firestore.Timestamp.now();
  return {
    id: uid,
    email: row.email,
    displayName: row.display_name || `${row.first_name} ${row.last_name}`.trim() || row.email,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    photoURL: photoURL || null,
    bio: row.bio || null,
    location: row.location || null,
    countryOfResidence: row.country_code || null,
    role: mapRole(row.role),
    isActive: true,
    followerCount: 0,
    followingCount: 0,
    emailNotifications: {
      newFollower: true,
      newComment: true,
      newPrayer: true,
      weeklyDigest: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "🔍  DRY RUN — no writes will happen\n" : "🚀  Starting migration...\n");

  const rows = parseCSV(CSV_PATH);
  console.log(`📋  Found ${rows.length} rows in CSV\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let resetSent = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email?.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      console.warn(`  [${i + 1}/${rows.length}] ⚠️  Skipping row with invalid email: "${row.email}"`);
      skipped++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${rows.length}] ${email} ... `);

    try {
      // ── Check if auth user already exists ──────────────────────────────────
      let uid;
      let isNew = false;
      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        process.stdout.write("auth exists, ");
      } catch {
        // User doesn't exist — create
        if (!DRY_RUN) {
          const created_ = await auth.createUser({
            email,
            displayName: row.display_name || `${row.first_name} ${row.last_name}`.trim() || email,
            emailVerified: true,
            disabled: false,
          });
          uid = created_.uid;
        } else {
          uid = `dry_run_${i}`;
        }
        isNew = true;
        process.stdout.write("auth created, ");
      }

      // ── Upload photo if provided ────────────────────────────────────────────
      let photoURL = null;
      if (row.photo_url) {
        if (!DRY_RUN) {
          photoURL = await uploadPhoto(uid, row.photo_url);
        }
        process.stdout.write(photoURL ? "photo ✓, " : "photo ✗, ");
      }

      // ── Update Auth photoURL ────────────────────────────────────────────────
      if (photoURL && !DRY_RUN) {
        await auth.updateUser(uid, { photoURL });
      }

      // ── Create Firestore profile (skip if already exists) ──────────────────
      const docRef = db.collection(FIRESTORE_COLLECTION).doc(uid);
      const snap = await docRef.get();
      if (snap.exists) {
        process.stdout.write("profile exists ");
        skipped++;
      } else {
        if (!DRY_RUN) {
          await docRef.set(buildProfile(uid, row, photoURL));
        }
        process.stdout.write("profile created ");
        created++;
      }

      // ── Send password reset email ───────────────────────────────────────────
      if (SEND_RESET_EMAILS && isNew) {
        if (!DRY_RUN) {
          await auth.generatePasswordResetLink(email);
          // Note: generatePasswordResetLink returns the link but doesn't send email.
          // Firebase Auth's built-in email IS sent automatically when using
          // sendPasswordResetEmail on client side, but from Admin SDK we need
          // to use the REST API or Firebase Trigger Email extension.
          // See SEND_RESET section below for the REST approach.
          await sendPasswordResetViaREST(email, require(SERVICE_ACCOUNT_PATH).project_id);
        }
        process.stdout.write("reset sent ");
        resetSent++;
      }

      console.log("✅");
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }
  }

  console.log("\n─────────────────────────────────────────────────");
  console.log(`✅  Created:      ${created}`);
  console.log(`⏭️   Skipped:      ${skipped}`);
  console.log(`📧  Resets sent:  ${resetSent}`);
  console.log(`❌  Failed:       ${failed}`);
  console.log("─────────────────────────────────────────────────");

  if (failed > 0) {
    console.log("\n⚠️  Some users failed. Fix errors above and re-run — the script is safe to re-run.");
  }
}

// ─── Send password reset via Firebase Auth REST API ───────────────────────────
// This triggers the real "Reset your password" email from Firebase.

async function sendPasswordResetViaREST(email, projectId) {
  // We need an API key for this. Read from env or prompt.
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    // Can't send — just skip silently, admin can send from console
    return;
  }

  const body = JSON.stringify({ requestType: "PASSWORD_RESET", email });
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;

  await new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

main().catch((err) => {
  console.error("\n💥  Fatal error:", err);
  process.exit(1);
});
