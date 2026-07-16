const socket = io(); // Connects to the WebSocket server pipeline automatically

let isLoginMode = true;
const API_URL = window.location.origin; // Dynamically targets localhost or your live Render link

// Check if token exists on load
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("token")) {
        showDashboard();
    }
});

// Toggle Auth Screens
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById("authTitle").innerText = isLoginMode ? "Login to Your Account" : "Register New Account";
    document.getElementById("authBtn").innerText = isLoginMode ? "Sign In" : "Sign Up";
    document.getElementById("toggleAuthText").innerHTML = isLoginMode ? 
        `Don't have an account? <span id="toggleAuth" onclick="toggleAuthMode()">Sign Up</span>` :
        `Already have an account? <span id="toggleAuth" onclick="toggleAuthMode()">Sign In</span>`;
}

// Handle Form Login / Registration
document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/register";

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();

        if (!result.success) return alert(result.error);

        if (isLoginMode) {
            localStorage.setItem("token", result.token); // Save authorization token badge
            showDashboard();
        } else {
            alert("Registration successful! Please login.");
            toggleAuthMode();
        }
    } catch (err) {
        alert("Authentication failed.");
    }
});

// Access Dashboard View
function showDashboard() {
    document.getElementById("authContainer").classList.add("hidden");
    document.getElementById("dashboardContainer").classList.remove("hidden");
    fetchLogs();
}

// Fetch Private Logs
async function fetchLogs() {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_URL}/api/logs`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await response.json();

        if (!result.success) {
            logout();
            return;
        }

        document.getElementById("logCount").innerText = result.count;
        const display = document.getElementById("logsDisplay");
        
        if (result.count === 0) {
            display.innerHTML = "<span style='color: #64748b;'>No items found in cloud database.</span>";
            return;
        }

        display.innerHTML = result.data.map(log => `
            <div class="log-item">
                <span style="color: #64748b;">[${new Date(log.createdAt).toLocaleTimeString()}]</span> ${log.text}
            </div>
        `).join("");

    } catch (err) {
        console.error(err);
    }
}

// Submit New Log Entry
document.getElementById("logForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const textInput = document.getElementById("logText");
    const text = textInput.value;

    try {
        // Anyone can post a log based on step 6 instructions, no auth header needed if kept open
        const response = await fetch(`${API_URL}/api/logs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        await response.json();
        textInput.value = "";
        fetchLogs(); // Reload lists
    } catch (err) {
        alert("Failed to submit entry.");
    }
});

// Clear Logs Completely
async function clearAllLogs() {
    if (!confirm("Are you sure you want to completely wipe the cloud logs?")) return;
    const token = localStorage.getItem("token");

    try {
        const response = await fetch(`${API_URL}/api/logs`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        await response.json();
        fetchLogs();
    } catch (err) {
        alert("Wipe failed.");
    }
}

// Log Out User
function logout() {
    localStorage.removeItem("token");
    document.getElementById("dashboardContainer").classList.add("hidden");
    document.getElementById("authContainer").classList.remove("hidden");
}


// Handle Browser File Upload Form
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById("fileInput");
    const statusDiv = document.getElementById("uploadStatus");
    statusDiv.innerText = "Uploading to cloud system...";

    // 1. Pack the file binary natively using FormData
    const formData = new FormData();
    formData.append("myFile", fileInput.files[0]);

    try {
        // 2. Ship the file to your backend architecture
        const response = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            body: formData // Let the browser handle content-type headers automatically for multipart data
        });
        const result = await response.json();

        if (result.success) {
            statusDiv.innerHTML = `<span style="color:#22c55e;">✅ Success! ${result.fileDetails.savedName} (${result.fileDetails.size}) saved.</span>`;
            fileInput.value = ""; // Empty out the picker
        } else {
            statusDiv.innerHTML = `<span style="color:#ef4444;">❌ Error: ${result.error}</span>`;
        }
    } catch (err) {
        statusDiv.innerHTML = `<span style="color:#ef4444;">❌ Network connection failed.</span>`;
    }
});

// Listen for 'logAdded' broadcast from the backend
socket.on('logAdded', (newLog) => {
    const display = document.getElementById("logsDisplay");
    const countSpan = document.getElementById("logCount");

    // If the box had a "No items found" placeholder, clear it out first
    if (countSpan.innerText === "0") {
        display.innerHTML = "";
    }

    // Increment log counter visually
    countSpan.innerText = parseInt(countSpan.innerText) + 1;

    // Insert the new log cleanly at the top of the logging block area
    const newLogHTML = `
        <div class="log-item" style="border-left: 3px solid #38bdf8; padding-left: 8px;">
            <span style="color: #64748b;">[${new Date(newLog.createdAt).toLocaleTimeString()}]</span> ${newLog.text}
        </div>
    `;
    display.insertAdjacentHTML('afterbegin', newLogHTML);
});
