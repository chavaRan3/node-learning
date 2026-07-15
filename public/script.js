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
