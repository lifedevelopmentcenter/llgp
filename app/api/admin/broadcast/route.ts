import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (getApps().length) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    initAdmin();
    const { title, body } = await req.json();
    if (!title || !body) return NextResponse.json({ error: "title and body required" }, { status: 400 });

    const db = getFirestore();
    const snap = await db.collection("fcmTokens").get();
    const tokens = snap.docs.map(d => d.data().token as string).filter(Boolean);

    if (tokens.length === 0) return NextResponse.json({ sent: 0 });

    // Send in batches of 500 (FCM limit)
    const BATCH = 500;
    let sent = 0;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        webpush: { notification: { icon: "/icon-192.png" } },
      });
      sent += response.successCount;
    }

    return NextResponse.json({ sent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
