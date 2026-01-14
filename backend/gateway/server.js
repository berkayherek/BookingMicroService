const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config(); // <--- Make sure this is here

const app = express();

// Render sets PORT to 10000 automatically
const PORT = process.env.PORT || 5000;

app.use(cors());

// --- 1. INITIALIZE FIREBASE (Cloud & Local Support) ---
try {
    let serviceAccount;
    // Check if running in Cloud (Env Var)
    if (process.env.FIREBASE_KEY_BASE64) {
        console.log("🔹 Attempting to decode Firebase Key from Env Var...");
        const buffer = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64');
        serviceAccount = JSON.parse(buffer.toString('utf-8'));
    } else {
        // Fallback for local development
        console.log("🔹 Attempting to read serviceAccountKey.json from file...");
        serviceAccount = require('./serviceAccountKey.json');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    console.log("✅ Gateway: Firebase Admin Initialized");
} catch (e) { 
    console.error("❌ Gateway Error: Firebase Key missing or invalid.");
    console.error("   Ensure FIREBASE_KEY_BASE64 is set in Render Environment Variables.");
    console.error("   Error details:", e.message);
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
        // Only log this if it's NOT a health check
        if (req.path !== '/') console.log("⛔ Blocked: No Token for path", req.path);
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        req.headers['x-user-id'] = decodedToken.uid;
        req.headers['x-user-email'] = decodedToken.email;
        
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

// Health Check for Render
app.get('/', (req, res) => res.send('Gateway Running'));

// Proxy to Hotel Service
app.use('/hotel', createProxyMiddleware({
    // IMPORTANT: On Render, this must be the HTTPS URL of your Hotel Service
    target: process.env.HOTEL_SERVICE_URL || 'http://localhost:5001',
    changeOrigin: true,
    pathRewrite: { '^/hotel': '' }
}));

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});