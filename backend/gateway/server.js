const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// --- 1. INITIALIZE FIREBASE (Cloud & Local Support) ---
try {
    let serviceAccount;
    // Check if running in Cloud (Env Var) or Local (File)
    if (process.env.FIREBASE_KEY_BASE64) {
        // Decode the Base64 string back to JSON
        const buffer = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64');
        serviceAccount = JSON.parse(buffer.toString('utf-8'));
    } else {
        // Fallback for local development
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
}

// --- 2. AUTH MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Public Routes
    if (req.path.startsWith('/hotel/search') || req.path.startsWith('/hotel/predict') || req.path === '/login') {
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
        console.log("⛔ Blocked: Token Verification Failed");
        return res.status(403).json({ error: 'Forbidden: Invalid Cloud Token' });
    }
};

app.use(authMiddleware);

app.get('/login', (req, res) => res.json({ message: "Login Successful", token: "VALID_TEST_TOKEN" }));

// Proxy to Hotel Service
// CRITICAL: On Render, this must be the https URL of your Hotel Service
app.use('/hotel', createProxyMiddleware({
    target: process.env.HOTEL_SERVICE_URL || 'http://localhost:5001',
    changeOrigin: true,
    pathRewrite: { '^/hotel': '' }
}));

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});