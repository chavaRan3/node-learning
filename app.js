const express = require('express');
const mongoose = require('mongoose'); 
const path = require('path');
// 1. Load the dotenv package at the absolute top of the file
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
// Remove or keep urlencoded, but you MUST add this line:
app.use(express.json()); 
app.use(express.static('public'));

app.use(express.static('public'));

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
app.get('/api/logs', async (req, res) => {
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
        // Instead of req.body.userText from a form, we read from raw JSON data
        const { text } = req.body; 

        if (!text) {
            return res.status(400).json({ success: false, error: "Please add a text field" });
        }

        const newLog = new Log({ text });
        await newLog.save();

        res.status(201).json({
            success: true,
            data: newLog
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error saving log" });
    }
});

// 3. DELETE ALL LOGS: Uses the correct HTTP DELETE method instead of POST
app.delete('/api/logs', async (req, res) => {
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


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
