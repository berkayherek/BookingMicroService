const express = require('express');
const amqp = require('amqplib');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = 'booking_queue';

// --- CLOUD DATABASE SETUP ---
let db = null;
try {
    let serviceAccount;
    if (process.env.FIREBASE_KEY_BASE64) {
        const buffer = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64');
        serviceAccount = JSON.parse(buffer.toString('utf-8'));
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log("🔥 Firebase Cloud DB Connected");
} catch (e) {
    console.error("Firebase Init Failed:", e.message);
}

// --- RABBITMQ CONSUMER ---
async function startConsumer() {
    if (!RABBITMQ_URL) return console.log("⚠️ No RabbitMQ URL. Consumer disabled.");
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log('Waiting for messages in %s...', QUEUE_NAME);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                const booking = JSON.parse(msg.content.toString());
                console.log(`[PROCESSING] Received booking for Hotel ${booking.hotelId}`);

                if (db) {
                    // Update Capacity for Scheduler Check (Randomly set low to simulate usage)
                    await db.collection('hotels').doc(String(booking.hotelId)).set({
                        id: booking.hotelId,
                        capacityPercentage: Math.floor(Math.random() * 30) 
                    }, { merge: true });
                    
                    console.log(`[NOTIFICATION] 📧 Email sent to User ${booking.userId}`);
                }
                channel.ack(msg);
            }
        });
    } catch (e) { setTimeout(startConsumer, 5000); }
}
startConsumer();

// --- SCHEDULER ---
cron.schedule('* * * * *', async () => {
    if (!db) return;
    console.log('--- 🌙 Nightly Cloud Capacity Check ---');
    try {
        const snapshot = await db.collection('hotels').get();
        snapshot.forEach(doc => {
            const hotel = doc.data();
            if (hotel.capacityPercentage < 20) {
                console.warn(`[🚨 ALERT] Hotel ${hotel.id} is running low on capacity! (${hotel.capacityPercentage}%)`);
            }
        });
    } catch (error) { console.error("Scheduler Error:", error.message); }
});

app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));