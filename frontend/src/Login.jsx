import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from './firebase-config'; // Import the config we just made

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        // 1. ASK FIREBASE TO LOG US IN
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. GET THE REAL SECURITY TOKEN
        const token = await user.getIdToken();

        console.log("Logged in with Firebase!", user.email);
        
        // 3. SEND TOKEN TO APP
        onLogin(token, user.email);
        
    } catch (err) {
        console.error(err);
        setError("Login Failed: Check email/password or your internet.");
    }
  };

  const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' },
    card: { background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px' },
    input: { width: '100%', padding: '10px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '5px' },
    btn: { width: '100%', padding: '12px', background: '#003580', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={{textAlign: 'center', color: '#003580'}}>Cloud Login</h2>
        {error && <p style={{color: 'red', fontSize: '14px'}}>{error}</p>}
        <input style={styles.input} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" style={styles.btn}>Sign In with Firebase</button>
      </form>
    </div>
  );
}
export default Login;