/**
 * Reusable WebAuthn Authentication Module
 * Provides core authentication functionality without UI dependencies
 * 
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.authServiceUrl='https://authservice.sanjaysingh.net'] - The URL of the authentication service
 * @param {string} [options.storagePrefix='webauthn_'] - Prefix for localStorage keys to avoid conflicts
 */

// Default authentication service URL
const DEFAULT_AUTH_SERVICE_URL = 'https://authservice.sanjaysingh.net';

class AuthManager {
    constructor(options = {}) {
        // Support both old and new constructor signatures for backward compatibility
        if (typeof options === 'string') {
            // Legacy: constructor(authServiceUrl, storagePrefix)
            this.authServiceUrl = options;
            this.storagePrefix = arguments[1] || 'webauthn_';
        } else {
            // New: constructor({ authServiceUrl, storagePrefix })
            this.authServiceUrl = options.authServiceUrl || DEFAULT_AUTH_SERVICE_URL;
            this.storagePrefix = options.storagePrefix || 'webauthn_';
        }
        
        this.currentUser = null;
        this.authToken = null;
    }

    // Storage management
    saveAuthToStorage(token, user) {
        try {
            localStorage.setItem(`${this.storagePrefix}authToken`, token);
            localStorage.setItem(`${this.storagePrefix}currentUser`, JSON.stringify(user));
            return true;
        } catch (error) {
            console.warn('Failed to save auth to localStorage:', error);
            return false;
        }
    }

    loadAuthFromStorage() {
        try {
            const token = localStorage.getItem(`${this.storagePrefix}authToken`);
            const userString = localStorage.getItem(`${this.storagePrefix}currentUser`);
            
            if (token && userString) {
                const user = JSON.parse(userString);
                return { token, user };
            }
        } catch (error) {
            console.warn('Failed to load auth from localStorage:', error);
        }
        return null;
    }

    clearAuthFromStorage() {
        try {
            localStorage.removeItem(`${this.storagePrefix}authToken`);
            localStorage.removeItem(`${this.storagePrefix}currentUser`);
            return true;
        } catch (error) {
            console.warn('Failed to clear auth from localStorage:', error);
            return false;
        }
    }

    // Token validation
    async validateToken(token, validationUrl) {
        try {
            const response = await fetch(validationUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // If token is valid, the request should succeed (or fail for other reasons but not 401)
            return response.status !== 401;
        } catch (error) {
            console.warn('Token validation failed:', error);
            return false;
        }
    }

    // Helper function to make authenticated API calls
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.authToken) {
            throw new Error('No authentication token available');
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.authToken}`
            }
        });

        if (response.status === 401) {
            // Token is invalid/expired, logout user
            console.warn('Token expired or invalid');
            this.logout();
            throw new Error('Session expired');
        }

        return response;
    }

    // WebAuthn credential ID format helper
    ensureCredentialIdIsString(credential) {
        if (credential.id && typeof credential.id !== 'string') {
            // If it's an ArrayBuffer, convert it to base64url
            if (credential.id instanceof ArrayBuffer) {
                const bytes = new Uint8Array(credential.id);
                credential.id = btoa(String.fromCharCode(...bytes))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
            }
        }
        return credential;
    }

    // Check WebAuthn support
    isWebAuthnSupported() {
        return !!(window.navigator && window.navigator.credentials && window.SimpleWebAuthnBrowser);
    }

    // Get user-friendly error messages for WebAuthn errors
    getWebAuthnErrorMessage(error, isRegistration = false) {
        const action = isRegistration ? 'creation' : 'login';
        const actionPastTense = isRegistration ? 'Register' : 'Login';

        switch (error.name) {
            case 'NotAllowedError':
                return `❌ Passkey ${action} cancelled`;
            case 'SecurityError':
                return '🔒 Security error';
            case 'NotSupportedError':
                return '❓ Passkeys not supported';
            case 'InvalidStateError':
                return isRegistration 
                    ? '⚠️ Passkey exists. Try login' 
                    : '⚠️ No passkeys found. Register first';
            case 'ConstraintError':
                return '🚫 Device not compatible';
            case 'AbortError':
                return '⏹️ Operation cancelled';
            default:
                return error.message || `${actionPastTense} failed`;
        }
    }

    // Registration flow
    async register(username) {
        if (!username || !username.trim()) {
            throw new Error('Username is required for registration');
        }

        if (!this.isWebAuthnSupported()) {
            throw new Error('WebAuthn is not supported in this browser');
        }

        try {
            // Step 1: Begin registration
            const beginResponse = await fetch(`${this.authServiceUrl}/auth/register/begin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim() })
            });

            if (!beginResponse.ok) {
                const error = await beginResponse.json();
                throw new Error(error.error || 'Registration failed');
            }

            const options = await beginResponse.json();

            // Step 2: Create credential using SimpleWebAuthn
            const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });
            
            // Ensure credential.id is a string (base64url format)
            this.ensureCredentialIdIsString(credential);

            // Step 3: Complete registration
            const completeResponse = await fetch(`${this.authServiceUrl}/auth/register/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential)
            });

            if (!completeResponse.ok) {
                const error = await completeResponse.json();
                throw new Error(error.error || 'Registration verification failed');
            }

            const result = await completeResponse.json();
            
            if (result.verified) {
                this.authToken = result.token;
                this.currentUser = result.user;
                this.saveAuthToStorage(this.authToken, this.currentUser);
                
                return {
                    success: true,
                    user: result.user,
                    token: result.token,
                    message: 'Registration successful!'
                };
            } else {
                throw new Error('Registration was not verified');
            }

        } catch (error) {
            console.error('Registration error:', error);
            throw new Error(this.getWebAuthnErrorMessage(error, true));
        }
    }

    // Login flow
    async login() {
        if (!this.isWebAuthnSupported()) {
            throw new Error('WebAuthn is not supported in this browser');
        }

        try {
            // Step 1: Begin authentication (usernameless)
            const beginResponse = await fetch(`${this.authServiceUrl}/auth/login/begin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // No username required for usernameless auth
            });

            if (!beginResponse.ok) {
                const error = await beginResponse.json();
                throw new Error(error.error || 'Authentication failed');
            }

            const options = await beginResponse.json();

            // Step 2: Get credential using SimpleWebAuthn
            const credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
            
            // Ensure credential.id is a string (base64url format)
            this.ensureCredentialIdIsString(credential);

            // Step 3: Complete authentication
            const completeResponse = await fetch(`${this.authServiceUrl}/auth/login/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential)
            });

            if (!completeResponse.ok) {
                const error = await completeResponse.json();
                throw new Error(error.error || 'Authentication verification failed');
            }

            const result = await completeResponse.json();
            
            if (result.verified) {
                this.authToken = result.token;
                this.currentUser = result.user;
                this.saveAuthToStorage(this.authToken, this.currentUser);
                
                return {
                    success: true,
                    user: result.user,
                    token: result.token,
                    message: `Welcome back, ${result.user.username}!`
                };
            } else {
                throw new Error('Authentication was not verified');
            }

        } catch (error) {
            console.error('Login error:', error);
            throw new Error(this.getWebAuthnErrorMessage(error, false));
        }
    }

    // Logout
    logout() {
        this.authToken = null;
        this.currentUser = null;
        this.clearAuthFromStorage();
        
        return {
            success: true,
            message: 'Logged out successfully'
        };
    }

    // Initialize authentication state
    async initialize(validationUrl) {
        const savedAuth = this.loadAuthFromStorage();
        
        if (savedAuth) {
            console.log('Found saved authentication, validating token...');
            const isValidToken = await this.validateToken(savedAuth.token, validationUrl);
            
            if (isValidToken) {
                // Restore authentication state
                this.authToken = savedAuth.token;
                this.currentUser = savedAuth.user;
                console.log('Authentication restored successfully');
                
                return {
                    authenticated: true,
                    user: this.currentUser,
                    token: this.authToken
                };
            } else {
                console.log('Saved token is invalid, clearing storage');
                this.clearAuthFromStorage();
            }
        }

        return {
            authenticated: false,
            user: null,
            token: null
        };
    }

    // Get current authentication state
    getAuthState() {
        return {
            authenticated: !!(this.authToken && this.currentUser),
            user: this.currentUser,
            token: this.authToken
        };
    }

    // Set storage prefix for multi-app usage
    setStoragePrefix(prefix) {
        this.storagePrefix = prefix;
    }
}

// Export for both ES6 modules and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
} else if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
} 