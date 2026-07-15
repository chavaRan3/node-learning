const express = require('express');
const fs = require('fs'); 
// Import Node's built-in Path module to handle folder paths cleanly
const path = require('path'); 
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 1. MODIFIED POST ROUTE: Finds and displays the file path
app.post('/submit-form', (req, res) => {
    const userSubmittedText = req.body.userText;
    const dataToSave = `User Entry: ${userSubmittedText}\n`;

    fs.appendFile('log.txt', dataToSave, (err) => {
        if (err) return res.status(500).send("Server Error");
        
        // Find the absolute system directory where log.txt is saved
        const fileDirectory = path.resolve(__dirname);
        const fullFilePath = path.join(fileDirectory, 'log.txt');

        console.log(`Saved to log.txt at: ${fullFilePath}`);

        // Send a response showing the success and the exact directory path
        res.send(`
            <h1>Success! Message Saved.</h1>
            <p><strong>File Directory Location on your Mac:</strong><br> <code>${fileDirectory}</code></p>
            <p><strong>Full File Path:</strong><br> <code>${fullFilePath}</code></p>
            <br>
            <a href="/view-logs">📁 View All Saved Logs</a> | <a href="/">⬅️ Go Back</a>
        `);
    });
});

// 2. NEW GET ROUTE: Reads the file and displays it on a webpage
// MODIFIED ROUTE: Displays logs along with a delete form
app.get('/view-logs', (req, res) => {
    fs.readFile('log.txt', 'utf8', (err, data) => {
        if (err || !data) {
            return res.send('<h1>No logs found yet!</h1><a href="/">Go Back</a>');
        }
        
        const formattedLogs = data.replace(/\n/g, '<br>');
        
        res.send(`
            <h1>Saved Logs</h1>
            <div style="background: #eef; padding: 15px; border-radius: 5px; font-family: monospace;">
                ${formattedLogs}
            </div>
            <br>
            <!-- Form to trigger log clearing -->
            <form action="/clear-logs" method="POST" style="box-shadow:none; padding:0; display:inline;">
                <button type="submit" style="background-color: #dc3545;">🗑️ Clear All Logs</button>
            </form>
            | <a href="/">⬅️ Go Back to Form</a>
        `);
    });
});


// NEW ROUTE: Deletes log.txt when requested
app.post('/clear-logs', (req, res) => {
    fs.unlink('log.txt', (err) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).send("Could not clear logs");
        }
        console.log("log.txt was successfully deleted.");
        res.send('<h1>Logs cleared successfully!</h1><a href="/">Go Back</a>');
    });
});


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
