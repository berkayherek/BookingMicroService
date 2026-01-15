const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const admin = require('firebase-admin');
const cors = require('cors');
const fs = require('fs'); // Required for Secret Files
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// --- 1. INITIALIZE FIREBASE (Secret File Support) ---
try {
    let serviceAccount;
    const secretFilePath = '/etc/secrets/serviceAccountKey.json'; // Render default path

    // 1. Check Render Secret File
    if (fs.existsSync(secretFilePath)) {
        console.log("🔹 Gateway: Loading Firebase Key from Secret File...");
        serviceAccount = require(secretFilePath);
    } 
    // 2. Check Base64 Env Var (Fallback)
    else if (process.env.FIREBASE_KEY_BASE64) {
        console.log("🔹 Gateway: Loading Firebase Key from Base64...");
        const buffer = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64');
        serviceAccount = JSON.parse(buffer.toString('utf-8'));
    } 
    // 3. Check Local File (Dev Mode)
    else {
        console.log("🔹 Gateway: Loading Firebase Key from Local File...");
        serviceAccount = require('./serviceAccountKey.json');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    console.log("✅ Gateway: Firebase Admin Initialized");
} catch (e) { 
    console.error("❌ Gateway Error: Firebase Key missing.");
    console.error("   Details:", e.message);
}

// --- 2. AUTH MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Public Routes
    if (req.path.startsWith('/hotel/search') || req.path.startsWith('/hotel/predict') || req.path === '/login' || req.path === '/') {
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

// Routes
app.get('/login', (req, res) => res.json({ message: "Login Successful", token: "VALID_TEST_TOKEN" }));
app.get('/', (req, res) => res.send('Gateway Running'));

// Proxy to Hotel Service
app.use('/hotel', createProxyMiddleware({
    // Render Env Var or Localhost
    target: process.env.HOTEL_SERVICE_URL || 'http://localhost:5001',
    changeOrigin: true,
    pathRewrite: { '^/hotel': '' }
}));

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});