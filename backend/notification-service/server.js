const express = require('express');
const amqp = require('amqplib');
const cron = require('node-cron');
const admin = require('firebase-admin');
const app = express();

const PORT = process.env.PORT || 5002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'booking_queue';

// --- CLOUD DATABASE SETUP ---
// Make sure 'serviceAccountKey.json' is in backend/notification-service/
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("🔥 Firebase Cloud DB Connected");
} catch (e) {
    console.error("Firebase Init Failed (Check serviceAccountKey.json):", e.message);
}
const db = admin.firestore();

// --- RABBITMQ CONSUMER ---
async function startConsumer() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log('Waiting for messages in %s...', QUEUE_NAME);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                const booking = JSON.parse(msg.content.toString());
                console.log(`[PROCESSING] Received booking for Hotel ${booking.hotelId}`);

                try {
                    // 1. WRITE TO CLOUD DB
                    await db.collection('bookings').add({
                        ...booking,
                        status: 'Confirmed',
                        createdAt: new Date().toISOString()
                    });
                    console.log(`✅ Saved booking to Firestore!`);

                    // 2. CREATE/UPDATE HOTEL CAPACITY IN CLOUD DB (For Scheduler)
                    // We randomly assign a low capacity to trigger the alert for demo
                    await db.collection('hotels').doc(String(booking.hotelId)).set({
                        id: booking.hotelId,
                        capacityPercentage: Math.floor(Math.random() * 30) 
                    }, { merge: true });

                    // 3. NOTIFY USER
                    console.log(`[NOTIFICATION SERVICE] 📧 Email sent to User ${booking.userId}`);
                    
                } catch (err) {
                    console.error("❌ Database Write Failed:", err.message);
                }

                channel.ack(msg);
            }
        });
    } catch (e) { setTimeout(startConsumer, 5000); }
}
startConsumer();

// --- SCHEDULER (Nightly Task) ---
cron.schedule('* * * * *', async () => {
    console.log('--- 🌙 Nightly Cloud Capacity Check ---');
    try {
        const snapshot = await db.collection('hotels').get();
        if (snapshot.empty) return console.log("No hotel data in Cloud DB yet.");

        snapshot.forEach(doc => {
            const hotel = doc.data();
            if (hotel.capacityPercentage < 20) {
                console.warn(`[🚨 ALERT] Hotel ${hotel.id} is running low on capacity! (${hotel.capacityPercentage}%)`);
            }
        });
    } catch (error) { console.error("Scheduler DB Error:", error.message); }
});

app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));