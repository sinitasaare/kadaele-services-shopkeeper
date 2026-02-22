import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import dataService from '../services/dataService';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const result = await dataService.login(email, password);
    
    if (result.success) {
      localStorage.setItem('user_email', email);
      onLoginSuccess(result.user);
    } else {
      setError(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    const result = await dataService.sendPasswordReset(email);
    
    if (result.success) {
      setMessage('Password reset email sent! Check your inbox.');
    } else {
      setError(result.error || 'Failed to send reset email');
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <img src="/kadaele-logo.png" alt="Kadaele Logo" className="login-logo" />
          <h1 className="app-title">Kadaele Services</h1>
          <h2 className="app-subtitle">Shopkeeper</h2>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
            />
          </div>
          <div className="input-group password-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input password-input"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button 
            type="button" 
            onClick={handleForgotPassword} 
            disabled={loading}
            className="forgot-password-btn"
          >
            Forgot Password?
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;