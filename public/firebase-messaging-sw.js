// Firebase Cloud Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

let messaging = null;

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && !messaging) {
    try {
      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const { title, body, icon } = payload.notification || {};
        self.registration.showNotification(title || "Leading Lights", {
          body: body || "",
          icon: icon || "/next.svg",
          badge: "/next.svg",
          data: payload.data,
        });
      });
    } catch (e) {
      // Already initialized or unsupported — non-fatal
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
