#!/usr/bin/env node
/**
 * BuddyBoss → LLGP Migration Script
 * ─────────────────────────────────────────────────────────────
 * Reads buddyboss.csv (exported from BuddyBoss/WordPress),
 * creates Firebase Auth accounts, Firestore user profiles,
 * and sends password-reset emails so users can set a new password.
 *
 * Usage:
 *   1. Place serviceAccount.json in scripts/
 *   2. node scripts/migrate-buddyboss.js [--dry-run] [--skip-reset]
 *
 * Flags:
 *   --dry-run          Show what would happen without writing anything
 *   --skip-reset       Import accounts but do NOT send password reset emails
 *   --send-resets-only Skip account creation, only send reset emails to existing users
 * ─────────────────────────────────────────────────────────────
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccount.json");
const CSV_PATH = path.join(__dirname, "buddyboss.csv");
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "";
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_RESET = process.argv.includes("--skip-reset");
const SEND_RESETS_ONLY = process.argv.includes("--send-resets-only");

// Only import users with these roles (filters out spam accounts)
const VALID_ROLES = ["subscriber", "bbp_participant", "group_leader", "administrator", "editor", "author"];

// Spam detection: skip rows where bio contains these patterns
const SPAM_PATTERNS = [
  /https?:\/\//i, // bios with URLs = usually spam
  /casino|poker|slot|psychic|clairvoyant|fortune|escort|cbd|crypto|bitcoin/i,
];

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌  serviceAccount.json not found at:", SERVICE_ACCOUNT_PATH);
  console.error("    Download from Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""); // strip BOM
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

// ─── Role mapping ─────────────────────────────────────────────────────────────

function mapRole(rawRoles) {
  const r = (rawRoles || "").toLowerCase();
  if (r.includes("administrator")) return "global_admin";
  if (r.includes("national_leader")) return "national_leader";
  if (r.includes("city_leader")) return "city_leader";
  if (r.includes("hub_leader") || r.includes("group_leader")) return "hub_leader";
  return "participant";
}

// ─── Spam check ───────────────────────────────────────────────────────────────

function isSpam(row) {
  // Must have at least one valid role
  const roles = (row.roles || "").toLowerCase();
  const hasValidRole = VALID_ROLES.some((r) => roles.includes(r));
  if (!hasValidRole) return true;

  // Email must look real
  const email = row.user_email || "";
  if (!email.includes("@") || !email.includes(".")) return true;

  // Skip clearly fake domains
  if (/\.(toobeo|zaols|wound|label|xyz123)\./i.test(email)) return true;

  // Bio spam patterns
  const bio = row.description || "";
  if (SPAM_PATTERNS.some((p) => p.test(bio))) return true;

  return false;
}

// ─── Build Firestore profile ──────────────────────────────────────────────────

function buildProfile(uid, row) {
  const now = admin.firestore.Timestamp.now();
  const displayName =
    row.display_name ||
    `${row.first_name} ${row.last_name}`.trim() ||
    row.user_login ||
    row.user_email;

  return {
    id: uid,
    email: row.user_email,
    displayName,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    photoURL: null, // not in this export — users set their own
    bio: row.description || null,
    role: mapRole(row.roles),
    isActive: true,
    followerCount: 0,
    followingCount: 0,
    emailNotifications: {
      newFollower: true,
      newComment: true,
      newPrayer: true,
      weeklyDigest: true,
    },
    migratedFrom: "buddyboss",
    buddybossId: row.ID || null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Send password reset email via Firebase REST API ─────────────────────────

async function sendPasswordReset(email) {
  if (!FIREBASE_API_KEY) return false;
  const body = JSON.stringify({ requestType: "PASSWORD_RESET", email });
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode === 200));
      }
    );
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (SEND_RESETS_ONLY) {
    console.log("\n📧  SEND RESETS ONLY — skipping account creation\n");
  } else {
    console.log(DRY_RUN ? "\n🔍  DRY RUN — no writes will happen\n" : "\n🚀  Starting BuddyBoss → LLGP migration...\n");
  }
  if (!FIREBASE_API_KEY && !SKIP_RESET) {
    console.log("⚠️  FIREBASE_API_KEY not set — password reset emails will be skipped.");
    console.log("   Set it with: export FIREBASE_API_KEY=your_web_api_key\n");
  }

  const rows = parseCSV(CSV_PATH);
  console.log(`📋  Total rows in CSV: ${rows.length}`);

  const valid = rows.filter((r) => !isSpam(r));
  const spamCount = rows.length - valid.length;
  console.log(`🚫  Filtered as spam/test accounts: ${spamCount}`);
  console.log(`✅  Valid members to import: ${valid.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let resetSent = 0;

  for (let i = 0; i < valid.length; i++) {
    const row = valid[i];
    const email = row.user_email.toLowerCase().trim();
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${valid.length}] ${email.padEnd(40)} `);

    try {
      // ── Check/create Auth user ────────────────────────────────────────────
      let uid;
      let isNew = false;

      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        process.stdout.write("auth:exists  ");
      } catch {
        if (SEND_RESETS_ONLY) {
          // Account doesn't exist yet — skip in resets-only mode
          console.log("  ⏭️  no account yet");
          skipped++;
          continue;
        }
        if (!DRY_RUN) {
          const displayName =
            row.display_name ||
            `${row.first_name} ${row.last_name}`.trim() ||
            email;
          const newUser = await auth.createUser({
            email,
            displayName,
            emailVerified: false,
            disabled: false,
          });
          uid = newUser.uid;
        } else {
          uid = `dry_${i}`;
        }
        isNew = true;
        process.stdout.write("auth:created ");
      }

      // ── Check/create Firestore profile ────────────────────────────────────
      if (!SEND_RESETS_ONLY) {
        const docRef = db.collection("users").doc(uid);
        const snap = await docRef.get();
        if (snap.exists) {
          process.stdout.write("profile:exists  ");
          skipped++;
        } else {
          if (!DRY_RUN) {
            await docRef.set(buildProfile(uid, row));
          }
          process.stdout.write("profile:created ");
          created++;
        }
      }

      // ── Send password reset ───────────────────────────────────────────────
      if (!SKIP_RESET && (isNew || SEND_RESETS_ONLY) && !DRY_RUN) {
        const sent = await sendPasswordReset(email);
        process.stdout.write(sent ? "reset:sent" : "reset:skipped");
        if (sent) resetSent++;
      }

      console.log("  ✅");
    } catch (err) {
      console.log(`  ❌  ${err.message}`);
      failed++;
    }
  }

  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`✅  Profiles created:     ${created}`);
  console.log(`⏭️   Already existed:      ${skipped}`);
  console.log(`🚫  Spam/filtered:        ${spamCount}`);
  console.log(`📧  Reset emails sent:    ${resetSent}`);
  console.log(`❌  Errors:               ${failed}`);
  console.log("─────────────────────────────────────────────────────────\n");

  if (!FIREBASE_API_KEY && !SKIP_RESET && created > 0) {
    console.log("📧  To send password reset emails, run:");
    console.log(`    FIREBASE_API_KEY=your_key node scripts/migrate-buddyboss.js --skip-reset`);
    console.log("    (then run a separate reset-only pass with the API key set)\n");
  }

  if (failed > 0) {
    console.log("⚠️   Some users failed. Fix errors above and re-run — the script skips existing users.\n");
  }
}

main().catch((err) => {
  console.error("\n💥  Fatal:", err.message);
  process.exit(1);
});
