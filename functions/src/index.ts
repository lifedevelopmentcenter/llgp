import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ─── Helper: send FCM to a user ────────────────────────────────────────────

async function sendToUser(
  uid: string,
  title: string,
  body: string,
  url: string
): Promise<void> {
  const tokensSnap = await db
    .collection("fcmTokens")
    .where("uid", "==", uid)
    .get();

  if (tokensSnap.empty) return;

  const tokens = tokensSnap.docs.map((d) => d.data().token as string);

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    webpush: {
      notification: { title, body, icon: "/next.svg" },
      fcmOptions: { link: `https://llgp.vercel.app${url}` },
    },
    data: { url },
  };

  const result = await messaging.sendEachForMulticast(message);

  // Remove stale tokens
  const staleTokens: string[] = [];
  result.responses.forEach((resp, i) => {
    if (!resp.success) staleTokens.push(tokens[i]);
  });
  await Promise.all(
    staleTokens.map((token) =>
      db
        .collection("fcmTokens")
        .where("token", "==", token)
        .get()
        .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
    )
  );
}

// ─── Trigger 1: New notification doc → push to recipient ──────────────────

export const onNotificationCreated = onDocumentCreated(
  "notifications/{notifId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { uid, title, body, url } = data as {
      uid: string;
      title: string;
      body: string;
      url: string;
    };

    if (!uid || !title) return;
    await sendToUser(uid, title, body || "", url || "/notifications");
  }
);

// ─── Trigger 2: New post → notify followers ────────────────────────────────

export const onPostCreated = onDocumentCreated(
  "posts/{postId}",
  async (event) => {
    const post = event.data?.data();
    if (!post || post.scope !== "global") return;

    const authorId = post.authorId as string;
    const authorName = post.authorName as string;
    const body = (post.body as string || "").slice(0, 80);
    const postId = event.params.postId;

    // Get followers of this author
    const followsSnap = await db
      .collection("follows")
      .where("followingId", "==", authorId)
      .limit(500)
      .get();

    if (followsSnap.empty) return;

    await Promise.all(
      followsSnap.docs.map((d) => {
        const followerId = d.data().followerId as string;
        if (followerId === authorId) return Promise.resolve();
        return sendToUser(
          followerId,
          `${authorName} posted`,
          body,
          `/dashboard?post=${postId}`
        );
      })
    );
  }
);

// ─── Trigger 3: New comment → notify post author ──────────────────────────

export const onCommentCreated = onDocumentCreated(
  "comments/{commentId}",
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    const { postId, authorId: commenterId, authorName: commenterName, body } = comment as {
      postId: string;
      authorId: string;
      authorName: string;
      body: string;
    };

    const postSnap = await db.collection("posts").doc(postId).get();
    if (!postSnap.exists) return;

    const postAuthorId = postSnap.data()?.authorId as string;
    if (!postAuthorId || postAuthorId === commenterId) return;

    await sendToUser(
      postAuthorId,
      `${commenterName} commented on your post`,
      (body || "").slice(0, 80),
      `/dashboard?post=${postId}`
    );
  }
);
