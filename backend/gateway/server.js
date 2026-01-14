const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// --- CRITICAL: DEFINE PORT 5000 ---
const PORT = process.env.PORT || 5000;

app.use(cors());

// --- 1. INITIALIZE FIREBASE (Safe Mode) ---
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Gateway: Firebase Admin Initialized");
} catch (e) { 
    console.error("❌ Gateway Error: serviceAccountKey.json missing or invalid.");
    console.error("   (You must copy the JSON key file into backend/gateway/ folder)");
}

// --- 2. AUTH MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // A. Public Routes (Pass through)
    // We allow /hotel/search AND /hotel/predict (for the ML part)
    if (req.path.startsWith('/hotel/search') || req.path.startsWith('/hotel/predict') || req.path === '/login') {
        return next();
    }

    // B. Check if Header Exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("⛔ Blocked: No Token");
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // ... inside authMiddleware ...

    const token = authHeader.split(' ')[1];

    // --- REAL CLOUD VERIFICATION ONLY ---
    try {
        // Gateway asks Firebase: "Is this token valid?"
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // If yes, Firebase gives us the User ID
        req.headers['x-user-id'] = decodedToken.uid;
        req.headers['x-user-email'] = decodedToken.email;
        
        // SIMPLE ADMIN CHECK (Hardcoded for demo)
        if (decodedToken.email === 'admin@hotels.com') {
             req.headers['x-user-role'] = 'ADMIN';
        } else {
             req.headers['x-user-role'] = 'USER';
        }

        next();
    } catch (error) {
        console.log("⛔ Blocked: Token Verification Failed", error.message);
        return res.status(403).json({ error: 'Forbidden: Invalid Cloud Token' });
    }
};

app.use(authMiddleware);

// --- ROUTES ---
app.get('/login', (req, res) => res.json({ message: "Login Successful", token: "VALID_TEST_TOKEN" }));

// Proxy to Hotel Service (Running on 5001)
app.use('/hotel', createProxyMiddleware({
    target: process.env.HOTEL_SERVICE_URL || 'http://localhost:5001',
    changeOrigin: true,
    pathRewrite: { '^/hotel': '' }
}));

// --- ADD THIS TO backend/hotel-service/server.js ---

// ADMIN: GET BOOKINGS FOR A SPECIFIC HOTEL
app.get('/admin/bookings', async (req, res) => {
    const { hotelId } = req.query;
    
    // Safety check
    if (!db) return res.json([]);
    if (!hotelId) return res.status(400).json({ error: "Hotel ID required" });

    try {
        // Fetch bookings for this hotel
        const snapshot = await db.collection('bookings')
            .where('hotelId', '==', hotelId)
            .get(); // Firestore allows filtering, but ordering might require an index. Let's sort in JS.

        let bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by Start Date (Newest first)
        bookings.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        res.json(bookings);
    } catch (e) {
        console.error("Fetch Bookings Error:", e);
        res.status(500).json({ error: e.message });
    }
});
// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});