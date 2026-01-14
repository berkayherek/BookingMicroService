import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";

// Paste your Firebase Config here if you didn't copy the file, 
// OR import it if you copied firebase-config.js
import { auth } from './firebase-config'; 

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        
        // Strict Check: Only admin@hotels.com can enter
        if (userCredential.user.email !== 'admin@hotels.com') {
            setError("Access Denied: You are not an Admin.");
            return;
        }

        onLogin(token);
    } catch (err) {
        setError("Login Failed: " + err.message);
    }
  };

  return (
    <div style={{height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#222'}}>
      <form onSubmit={handleSubmit} style={{background: '#333', padding: '40px', borderRadius: '8px', color: 'white', width: '300px'}}>
        <h2 style={{textAlign: 'center'}}>🛡️ Admin Portal</h2>
        {error && <p style={{color: '#ff4444'}}>{error}</p>}
        <input style={{width: '100%', padding: '10px', marginBottom: '10px'}} placeholder="admin@hotels.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input style={{width: '100%', padding: '10px', marginBottom: '20px'}} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
        <button type="submit" style={{width: '100%', padding: '10px', background: '#d9534f', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}>Login</button>
      </form>
    </div>
  );
}
export default Login;