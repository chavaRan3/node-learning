const express = require('express');
const mongoose = require('mongoose'); 
const path = require('path');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 1. Load the dotenv package at the absolute top of the file
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
// Remove or keep urlencoded, but you MUST add this line:
app.use(express.json()); 
app.use(express.static('public'));

app.use(express.static('public'));


const multer = require('multer');

// Configure how and where files are saved
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files into the 'uploads' folder
    },
    filename: (req, file, cb) => {
        // Give the file a unique name using the current timestamp + original name
        cb(null, Date.now() + '-' + file.originalname);
    }
});


// Initialize the secured upload middleware
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 1. Limit size to exactly 2 Megabytes
    fileFilter: (req, file, cb) => {
        // 2. Read the file's mimetype to confirm it's an image
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true); // Accept the file
        } else {
            cb(new Error('Invalid file type. Only JPEG, JPG, and PNG are allowed!'), false); // Reject
        }
    }
});

// 1. IMPORT HTTP & SOCKET.IO (Add this near your other package imports)
const http = require('http');
const { Server } = require('socket.io');

// 2. CREATE THERMAL SERVER CORE WRAPPER (Put this right above your app.listen replacement)
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allows incoming dashboard clients to sync safely
});



// 2. Read the hidden variable using process.env
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("Successfully connected to MongoDB Cloud!"))
    .catch(err => console.error("Database connection error:", err));

// ... Leave all your remaining routes (app.post, app.get, etc.) exactly the same ...


// 2. DEFINE A SCHEMA & MODEL (This structures your database data)
const logSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

// DEFINE USER SCHEMA
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Guard Middleware
const protect = (req, res, next) => {
    // Look for the token in the request headers
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }

    try {
        // Verify the token using our secret key
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Attach user info to the request
        next(); // Let them pass to the route!
    } catch (err) {
        res.status(400).json({ success: false, error: "Invalid token." });
    }
};


// 3. GET ROUTE: Home Page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 4. POST ROUTE: Save data to MongoDB
app.post('/submit-form', async (req, res) => {
    try {
        const userSubmittedText = req.body.userText;

        // Save a new document into MongoDB
        const newLog = new Log({ text: userSubmittedText });
        await newLog.save();

        console.log(`Saved to MongoDB: ${userSubmittedText}`);
        res.send(`
            <h1>Success! Saved to Cloud Database.</h1>
            <br>
            <a href="/view-logs">📁 View All Saved Logs</a> | <a href="/">⬅️ Go Back</a>
        `);
    } catch (err) {
        res.status(500).send("Error saving data to database");
    }
});

// 5. GET ROUTE: Read data from MongoDB
app.get('/view-logs', async (req, res) => {
    try {
        // Fetch all logs from the database, newest first
        const logs = await Log.find().sort({ createdAt: -1 });

        if (logs.length === 0) {
            return res.send('<h1>No logs found in the database!</h1><a href="/">Go Back</a>');
        }

        // Format data into HTML strings
        const formattedLogs = logs.map(log => 
            `[${log.createdAt.toLocaleString()}] User Entry: ${log.text}`
        ).join('<br>');

        res.send(`
            <h1>Cloud Database Logs</h1>
            <div style="background: #eef; padding: 15px; border-radius: 5px; font-family: monospace;">
                ${formattedLogs}
            </div>
            <br>
            <form action="/clear-logs" method="POST" style="display:inline;">
                <button type="submit" style="background-color: #dc3545; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer;">🗑️ Clear Database</button>
            </form>
            | <a href="/">⬅️ Go Back to Form</a>
        `);
    } catch (err) {
        res.status(500).send("Error reading from database");
    }
});

// 6. POST ROUTE: Clear database logs
app.post('/clear-logs', async (req, res) => {
    try {
        // This deletes everything inside the logs collection
        await Log.deleteMany({});
        console.log("MongoDB collection cleared.");
        res.send('<h1>Database cleared successfully!</h1><a href="/">Go Back</a>');
    } catch (err) {
        res.status(500).send("Could not clear database");
    }
});

// 1. GET ALL LOGS: Returns an array of JSON objects
app.get('/api/logs', protect, async (req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 });
        // Send back data with a clean JSON structure and a 200 OK status
        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error fetching logs" });
    }
});

// 2. CREATE A LOG: Expects JSON input, saves it, and returns the created object
// We add express.json() middleware right after this to read raw JSON payloads
app.post('/api/logs', async (req, res) => {
    try {
        const { text } = req.body; 
        if (!text) return res.status(400).json({ success: false, error: "Please add a text field" });

        const newLog = new Log({ text });
        await newLog.save();

        // 🔥 LIVE SYNC BROADCAST: Send this entry to all connected browser windows instantly!
        io.emit('logAdded', newLog);

        res.status(201).json({ success: true, data: newLog });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error saving log" });
    }
});

// 3. DELETE ALL LOGS: Uses the correct HTTP DELETE method instead of POST
app.delete('/api/logs', protect, async (req, res) => {
    try {
        await Log.deleteMany({});
        res.status(200).json({
            success: true,
            message: "All database logs successfully cleared"
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error clearing logs" });
    }
});




// 1. REGISTER A NEW USER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ username });
        if (userExists) return res.status(400).json({ success: false, error: "User already exists" });

        // Scramble the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user to database
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ success: true, message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server registration error" });
    }
});

// 2. USER LOGIN (Generates the JWT Badge)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ success: false, error: "Invalid username or password" });

        // Compare entered password with hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, error: "Invalid username or password" });

        // Create and sign a JWT token that lasts for 1 hour
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ success: true, token });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server login error" });
    }
});


// Updated upload route with error handling middleware catch
app.post('/api/upload', (req, res) => {
    // Run the upload logic manually to intercept validation errors cleanly
    upload.single('myFile')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Handles native Multer errors like file too large
            return res.status(400).json({ success: false, error: `Upload error: ${err.message} (Max 2MB)` });
        } else if (err) {
            // Handles our custom fileFilter rejection error
            return res.status(400).json({ success: false, error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: "Please select a file to upload." });
        }

        res.status(200).json({
            success: true,
            message: "Image uploaded and secured successfully!",
            fileDetails: { savedName: req.file.filename, size: `${(req.file.size / 1024).toFixed(2)} KB` }
        });
    });
});




// 3. LISTEN FOR NEW SOCKET CONNECTIONS
io.on('connection', (socket) => {
    console.log(`📡 A user connected to live sync: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
    });
});

// 4. CHANGE APP.LISTEN TO SERVER.LISTEN (Replace your old app.listen block at the very bottom)
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

