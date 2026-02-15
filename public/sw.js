// public/sw.js
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'Pesan Baru', body: 'Seseorang menyapa Anda!' };
    
    const options = {
        body: data.body,
        icon: '/icon.png', // Ganti dengan path logo Anda
        badge: '/badge.png',
        vibrate: [100, 50, 100],
        data: {
            url: self.location.origin
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
