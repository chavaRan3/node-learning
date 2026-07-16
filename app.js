const cors = require('cors');

// Place this right below your const app = express(); line


// ==========================================
// 1. MODULE IMPORTS & PACKAGES
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // This tells your backend to welcome incoming requests from React!


// ==========================================
// 2. EXPRESS MIDDLEWARE INTERCEPTORS
// ==========================================
app.use(express.json()); // Parses raw JSON data payloads
app.use(express.static('public')); // Serves our HTML dashboard folder

// ==========================================
// 3. DATABASE CONNECTION LOGIC
// ==========================================
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("Successfully connected to MongoDB Cloud!"))
    .catch(err => console.error("Database connection error:", err));

// ==========================================
// 4. AUTHENTICATION GATEKEEPER MIDDLEWARE
// ==========================================
const protect = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: "Access denied. No token provided." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ success: false, error: "Invalid token." });
    }
};

// ==========================================
// 5. MULTER FILE UPLOAD SETUP
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type. Only JPEG, JPG, and PNG are allowed!'), false);
    }
});

// ==========================================
// 6. MOUNT CLEAN MVC ROUTES
// ==========================================
// This imports the login/register paths we set up in Step 4
const authRoutes = require('./routes/authRoutes'); 

// This mounts them under the /api/auth prefix
app.use('/api/auth', authRoutes); 

// ==========================================
// 7. KEEP REMAINING IN-LINE APP ROUTES
// ==========================================
// (Note: To finish MVC completely, these logs/uploads models and routes 
// can eventually be moved into separate files too!)
const Log = require('./models/Log');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/logs', protect, async (req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error fetching logs" });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, error: "Please add a text field" });
        const newLog = new Log({ text });
        await newLog.save();
        io.emit('logAdded', newLog); // Socket broadcast
        res.status(201).json({ success: true, data: newLog });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error saving log" });
    }
});

app.delete('/api/logs', protect, async (req, res) => {
    try {
        await Log.deleteMany({});
        io.emit('logsCleared'); // Socket broadcast
        res.status(200).json({ success: true, message: "All logs cleared" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error clearing logs" });
    }
});

app.post('/api/upload', (req, res) => {
    upload.single('myFile')(req, res, (err) => {
        if (err instanceof multer.MulterError) return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        else if (err) return res.status(400).json({ success: false, error: err.message });
        if (!req.file) return res.status(400).json({ success: false, error: "Please select a file to upload." });
        res.status(200).json({ success: true, message: "File uploaded!", fileDetails: { savedName: req.file.filename } });
    });
});

// ==========================================
// 8. HTTP SERVER & SOCKET.IO RUN CORE
// ==========================================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    console.log(`📡 A user connected to live sync: ${socket.id}`);
    socket.on('disconnect', () => console.log(`🔌 User disconnected: ${socket.id}`));
});

server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

// 🔥 NEW UNPROTECTED PUBLIC ROUTE FOR REACT PRACTICE
app.get('/api/public-logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
});



module.exports = { app, server };
