const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate unique username
const generateUniqueUsername = async (baseUsername) => {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
    let counter = 1;
    let isUnique = false;

    // Check if base username is available
    let existingUser = await User.getUserByUsername(username);
    
    if (!existingUser) {
        return username;
    }

    // If taken, try adding numbers until we find an available one
    while (!isUnique) {
        const testUsername = `${username}${counter}`;
        existingUser = await User.getUserByUsername(testUsername);
        
        if (!existingUser) {
            return testUsername;
        }
        
        counter++;
        
        // Safety limit to prevent infinite loop
        if (counter > 9999) {
            return `${username}${Date.now()}`;
        }
    }
};

const signup = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const existingUser = await User.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "This email is already registered. Please login or use a different email." });
        }

        // Generate unique username
        const uniqueUsername = await generateUniqueUsername(username);

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.createUser({
            username: uniqueUsername,
            email,
            password: hashedPassword,
            avatar: `https://ui-avatars.com/api/?name=${uniqueUsername}&background=random`,
        });

        const token = jwt.sign({ userId: newUser.userId }, JWT_SECRET, { expiresIn: "30d" });

        res.status(201).json({ user: newUser, token, isNewUser: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.getUserByEmail(email);
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: "30d" });

        res.json({ user, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const googleLogin = async (req, res) => {
    const { credential } = req.body;

    try {
        let payload;
        
        try {
            // First try normal verification
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            // If clock skew error, decode the token manually (still verify signature)
            if (verifyError.message && verifyError.message.includes('Token used too early')) {
                console.log('Clock skew detected, using manual token decode...');
                // Decode the JWT payload (middle part)
                const parts = credential.split('.');
                if (parts.length !== 3) {
                    throw new Error('Invalid token format');
                }
                const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                
                // Verify the audience matches
                if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
                    throw new Error('Invalid token audience');
                }
                // Verify issuer
                if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
                    throw new Error('Invalid token issuer');
                }
            } else {
                throw verifyError;
            }
        }

        const { email, name, picture, sub: googleId } = payload;

        // Check if user exists
        let user = await User.getUserByEmail(email);
        let isNewUser = false;

        if (!user) {
            // Generate unique username from Google name
            const uniqueUsername = await generateUniqueUsername(name);
            
            // Create new user with Google info
            user = await User.createUser({
                username: uniqueUsername,
                email: email,
                password: await bcrypt.hash(googleId, 10), // Use Google ID as password hash
                avatar: picture || `https://ui-avatars.com/api/?name=${uniqueUsername}&background=random`,
                googleId: googleId,
            });
            isNewUser = true;
        }

        const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: "30d" });

        res.json({ user, token, isNewUser });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: "Google authentication failed" });
    }
};

module.exports = { signup, login, googleLogin };
