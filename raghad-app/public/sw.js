/**
 * Service Worker لتطبيق رغد (PWA):
 * - استقبال إشعارات Web Push وعرضها على الجهاز.
 * - iOS 16.4+ من Safari (مثبّت كـ PWA) يدعم Web Push هنا.
 * - الضغط على الإشعار يفتح التطبيق أو يركّز نافذة مفتوحة.
 * - Cache-first لملفات الـ shell لضمان عمل التطبيق دون اتصال.
 */

const CACHE_NAME = 'raghad-v1';
const SHELL_ASSETS = ['/', '/index.html'];

// ── التثبيت: خزّن ملفات الـ shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {
        // إذا فشل التخزين (بيئة تطوير) نكمل التثبيت على أي حال
      })
    )
  );
  self.skipWaiting();
});

// ── التفعيل: احذف الكاشات القديمة وتولَّ التحكم فورًا ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first للـ API، cache-first للباقي ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // لا نخزّن طلبات API أو الـ chrome-extension
  if (
    url.pathname.startsWith('/v1') ||
    url.protocol === 'chrome-extension:' ||
    request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        // بدون اتصال: أرجع النسخة المخزّنة أو الصفحة الرئيسية
        return cached ?? (await cache.match('/')) ?? Response.error();
      }
    })
  );
});

// ── Web Push: استقبال الإشعار وعرضه ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'رغد', body: '', data: {} };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    if (event.data) payload = { title: 'رغد', body: event.data.text(), data: {} };
  }

  const options = {
    body: payload.body || '',
    lang: 'ar',
    dir: 'rtl',
    // tag: يمنع تكرار الإشعار بنفس المصدر
    tag: (payload.data && payload.data.tag) || payload.title,
    data: payload.data || {},
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    // renotify: true يضمن ظهور الاهتزاز حتى مع نفس الـ tag
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'رغد', options)
  );
});

// ── نقر الإشعار: فتح/تركيز التطبيق والتوجيه للشاشة المناسبة ─────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // ركّز على نافذة مفتوحة للتطبيق إن وُجدت
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl);
          return;
        }
      }

      // افتح نافذة جديدة
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// ── pushsubscriptionchange: أعد التسجيل عند تغيير الاشتراك ─────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? { userVisibleOnly: true, applicationServerKey: event.oldSubscription.options.applicationServerKey }
            : { userVisibleOnly: true }
        );
        // أبلغ التطبيق بالاشتراك الجديد عبر postMessage
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => {
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_RENEWED', subscription: subscription.toJSON() });
        });
      } catch {
        // فشل التجديد — سيُعاد التسجيل عند فتح التطبيق
      }
    })()
  );
});
