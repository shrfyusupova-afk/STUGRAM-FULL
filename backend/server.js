require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(cors());

// Google Auth Client ID
const GOOGLE_CLIENT_ID = "604321601052-jgeu69r9s6v87bnd7p16v4e8j3q85r00.apps.googleusercontent.com"; // Project Number asosida taxminiy format, lekin haqiqiysini Credentials bo'limidan olish kerak
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// MongoDB Atlas ulanish
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
    .then(() => console.log("[STUGRAM] MongoDB Atlas muvaffaqiyatli ulandi!"))
    .catch(err => {
        console.error("[STUGRAM] MongoDB ulanishda xatolik:", err.message);
        process.exit(1);
    });

// Routerlarni ulash
app.use('/api/auth', require('./routes/auth'));

// Google Login Endpoint
app.post('/api/auth/google', async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        // Bu yerda foydalanuvchini bazadan qidirish yoki yaratish mantiqi bo'ladi
        console.log("Google User:", payload.email);

        res.status(200).json({
            token: "JWT_TOKEN_HERE",
            user: {
                fullName: payload.name,
                username: payload.email.split('@')[0],
                identity: payload.email
            }
        });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(400).json({ message: "Google verification failed" });
    }
});

app.get('/', (req, res) => {
    res.send("STUGRAM API ishlayapti...");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[STUGRAM] Server barcha tarmoqlar uchun ochiq: http://0.0.0.0:${PORT}`);
});
