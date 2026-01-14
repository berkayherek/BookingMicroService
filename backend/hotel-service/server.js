const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const { createClient } = require('redis');
const amqp = require('amqplib');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5001;
const REDIS_URL = process.env.REDIS_URL; // Required for Render
const RABBITMQ_URL = process.env.RABBITMQ_URL; // Required for Render
const QUEUE_NAME = 'booking_queue';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5004'; 

// --- HELPER FUNCTION ---
function isDateOverlap(startA, endA, startB, endB) {
    return (startA < endB && endA > startB);
}

// --- 1. FIREBASE SETUP (Cloud Compatible) ---
let db = null;
try {
    let serviceAccount;
    if (process.env.FIREBASE_KEY_BASE64) {
        const buffer = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64');
        serviceAccount = JSON.parse(buffer.toString('utf-8'));
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    db = admin.firestore();
    console.log("🔥 Firebase: Connected Successfully!");
} catch (error) {
    console.warn("⚠️  WARNING: Could not connect to Firebase.");
    console.warn(error.message);
}

// --- 2. REDIS SETUP (Robust) ---
let redisClient = null;
if (REDIS_URL) {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.warn('⚠️ Redis Client Warning:', err.message));
    (async () => { try { await redisClient.connect(); console.log("✅ Redis: Connected"); } catch (e) {} })();
} else {
    console.log("⚠️ No REDIS_URL provided. Caching disabled.");
}

// --- 3. RABBITMQ SETUP ---
let channel = null;
async function connectQueue() {
    if (!RABBITMQ_URL) return console.log("⚠️ No RABBITMQ_URL provided. Notifications disabled.");
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('✅ RabbitMQ: Connected');
    } catch (error) {
        console.log("RabbitMQ Retrying...", error.message);
        setTimeout(connectQueue, 5000);
    }
}
connectQueue();

// --- ROUTES ---

// SEARCH (With Redis Cache)
app.get('/search', async (req, res) => {
    const { location } = req.query;
    const cacheKey = `search:${location ? location.toLowerCase() : 'all'}`;

    try {
        if (redisClient && redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        }

        if (!db) return res.json([]);

        const snapshot = await db.collection('hotels').get();
        let hotels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (location) {
            const searchStr = location.toLowerCase();
            hotels = hotels.filter(h => 
                (h.location && h.location.toLowerCase().includes(searchStr)) || 
                (h.name && h.name.toLowerCase().includes(searchStr))
            );
        }

        if (redisClient && redisClient.isOpen) await redisClient.setEx(cacheKey, 60, JSON.stringify(hotels)); 
        res.json(hotels);

    } catch (err) {
        console.error("Search Error:", err);
        res.json([]);
    }
});

// ADMIN: GET BOOKINGS
app.get('/admin/bookings', async (req, res) => {
    const { hotelId } = req.query;
    if (!db) return res.json([]);
    if (!hotelId) return res.status(400).json({ error: "Hotel ID required" });

    try {
        const snapshot = await db.collection('bookings')
            .where('hotelId', '==', hotelId)
            .get();

        let bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        bookings.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        res.json(bookings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ADMIN: GET HOTELS
app.get('/admin/hotels', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const snapshot = await db.collection('hotels').get();
        const hotels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(hotels);
    } catch (e) {
        res.json([]);
    }
});

// ADMIN: CREATE HOTEL
app.post('/admin/hotels', async (req, res) => {
    try {
        const { name, location, exactLocation, description, basePrice, rooms } = req.body;
        if (!db) throw new Error("Database not connected");

        const newId = Date.now().toString();
        const newHotelData = {
            id: newId, name, location, exactLocation, description,
            basePrice: Number(basePrice), rooms: rooms || [],
            updatedAt: new Date().toISOString()
        };

        await db.collection('hotels').doc(newId).set(newHotelData);
        if(redisClient && redisClient.isOpen) await redisClient.flushAll(); 
        res.json({ success: true, hotel: newHotelData });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ADMIN: UPDATE HOTEL
app.put('/admin/hotels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, exactLocation, description, basePrice, rooms } = req.body;
        if (!db) throw new Error("Database not connected");

        await db.collection('hotels').doc(id).update({
            name, location, exactLocation, description,
            basePrice: Number(basePrice), rooms: rooms || [],
            updatedAt: new Date().toISOString()
        });

        if(redisClient && redisClient.isOpen) await redisClient.flushAll(); 
        res.json({ success: true, message: "Hotel Updated" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ML PREDICTION
app.post('/predict', async (req, res) => {
    const { basePrice, date, roomType } = req.body;
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, { basePrice, date, roomType }, { timeout: 3000 });
        res.json(response.data);
    } catch (error) {
        res.json({ predictedPrice: basePrice, reason: "ML Unavailable" });
    }
});

// USER HISTORY
app.get('/bookings/user', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId || !db) return res.json([]);
    try {
        const snapshot = await db.collection('bookings')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Could not fetch history" });
    }
});

// BOOKING (TRANSACTIONAL)
app.post('/book', async (req, res) => {
    const { hotelId, roomType, startDate, endDate, guestCount, totalPrice } = req.body;
    const userId = req.headers['x-user-id'] || 'guest';
    if (!db) return res.status(500).json({ error: "DB Unavailable" });

    const hotelRef = db.collection('hotels').doc(String(hotelId));
    
    try {
        await db.runTransaction(async (t) => {
            const hotelDoc = await t.get(hotelRef);
            if (!hotelDoc.exists) throw new Error("Hotel not found");
            const hotelData = hotelDoc.data();
            const room = hotelData.rooms.find(r => r.type === roomType);
            
            if (!room) throw new Error("Room type not found");

            // Overlap Check
            const bookingsSnapshot = await t.get(
                db.collection('bookings')
                  .where('hotelId', '==', hotelId)
                  .where('roomType', '==', roomType)
            );

            let overlappingBookings = 0;
            bookingsSnapshot.forEach(doc => {
                const b = doc.data();
                if (isDateOverlap(startDate, endDate, b.startDate, b.endDate)) overlappingBookings++;
            });

            if ((Number(room.count) - overlappingBookings) <= 0) throw new Error("SOLD_OUT");

            const bookingData = {
                hotelId, userId, roomType, startDate, endDate, guestCount, totalPrice,
                hotelName: hotelData.name, status: 'CONFIRMED', createdAt: new Date().toISOString()
            };
            
            const bookingRef = db.collection('bookings').doc();
            t.set(bookingRef, bookingData);

            if (channel) channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(bookingData)));
        });

        if(redisClient && redisClient.isOpen) await redisClient.flushAll(); 
        res.json({ success: true, message: "Booking Confirmed" });

    } catch (error) {
        const status = error.message === "SOLD_OUT" ? 409 : 500;
        res.status(status).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Hotel Service running on port ${PORT}`));