// --- 1. TRACKER LOGIC ---
let timerInterval, startTime, isRunning = false;
let selectedCategory = null, myChart = null;

let categories = JSON.parse(localStorage.getItem('trackerCategories')) || [
    { name: 'Working', color: '#0000FF', goal: 4 },
    { name: 'Running', color: '#FF0000', goal: 1 },
    { name: 'Eating', color: '#4CAF50', goal: 1 }
];

const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStopBtn');

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 4500);
}

function renderActivityTiles() {
    const container = document.getElementById('activityTiles');
    container.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'activity-tile';
        if (selectedCategory?.name === cat.name) div.classList.add('selected');
        div.style.color = cat.color;
        div.innerText = cat.name;
        div.onclick = () => { 
            selectedCategory = cat; 
            renderActivityTiles(); 
            renderActivities(); 
            updateButtonColor(); 
        };
        container.appendChild(div);
    });
    if (!selectedCategory && categories.length > 0) { 
        selectedCategory = categories[0]; 
        renderActivityTiles(); 
    }
}

function toggleTimer() {
    if (isRunning) {
        const diff = Math.round((new Date() - startTime) / 1000);
        clearInterval(timerInterval);
        isRunning = false;
        startStopBtn.innerText = "Start";
        saveTimeData(selectedCategory.name, diff);
        display.innerText = "00:00:00";
    } else {
        if (!selectedCategory) return showToast("Select an activity first.");
        isRunning = true;
        startTime = new Date();
        startStopBtn.innerText = "Stop";
        timerInterval = setInterval(() => {
            const elapsed = Math.round((new Date() - startTime) / 1000);
            display.innerText = new Date(elapsed * 1000).toISOString().substr(11, 8);
        }, 1000);
    }
}

function addManualTime() {
    if (!selectedCategory) return showToast("Select an activity first.");
    const mins = prompt(`Add minutes for ${selectedCategory.name}?`);
    if (mins && !isNaN(mins)) saveTimeData(selectedCategory.name, parseInt(mins) * 60);
}

function saveTimeData(category, duration) {
    if (duration < 1) return;
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.push({ category, duration, date: new Date().toISOString() });
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    updateChart('week');
    renderHistory();
}

function formatDecimalToTime(decimal) {
    if (decimal <= 0) return "0:00";
    let totalMin = Math.round(decimal * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
}

// --- 2. CHART & GOALS ---
function updateChart(timeframe) {
    const data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    const cutoff = new Date();
    
    if (timeframe === 'day') cutoff.setHours(0, 0, 0, 0);
    else if (timeframe === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (timeframe === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (timeframe === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);

    const totals = {};
    const todayTotals = {};
    const todayStr = new Date().toDateString();
    const currentCategoryNames = categories.map(c => c.name);

    data.forEach(s => {
        const sDate = new Date(s.date);
        if (currentCategoryNames.includes(s.category)) {
            if (sDate >= cutoff) {
                totals[s.category] = (totals[s.category] || 0) + (s.duration / 3600);
            }
            if (sDate.toDateString() === todayStr) {
                todayTotals[s.category] = (todayTotals[s.category] || 0) + (s.duration / 3600);
            }
        }
    });

    const ctx = document.getElementById('timeChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(totals).map(name => `${name}: ${formatDecimalToTime(totals[name])}`),
            datasets: [{
                data: Object.values(totals),
                backgroundColor: Object.keys(totals).map(n => categories.find(c => c.name === n)?.color || '#ccc'),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            maintainAspectRatio: false,
            layout: { padding: 10 },
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 14, weight: 'bold' }, padding: 15 } }
            }
        }
    });

    const goalBox = document.getElementById('goalContainer');
    goalBox.innerHTML = '<h3>Today\'s Goals</h3>';
    categories.forEach(cat => {
        if (cat.goal > 0) {
            const current = todayTotals[cat.name] || 0;
            const percent = Math.min((current / cat.goal) * 100, 100);
            goalBox.innerHTML += `
                <div class="goal-item">
                    <div class="goal-label"><span>${cat.name}</span><span>${current.toFixed(1)} / ${cat.goal}h</span></div>
                    <div class="progress-bg"><div class="progress-fill" style="width:${percent}%; background:${cat.color}"></div></div>
                </div>`;
        }
    });
}

// --- 3. VOICE ENGINE (GEMINI CONNECTOR WITH SAFE LOCAL STORAGE) ---
async function sendToAI(transcript) {
    // 1. Fetch key directly from your browser's secure memory
    let apiKey = localStorage.getItem('vireo_gemini_key');
    
    // 2. If it is your first time using it, prompt you to paste it in
    if (!apiKey) {
        apiKey = prompt("Please enter your Gemini API Key (this will be saved safely inside your browser's local storage):");
        if (apiKey) {
            localStorage.setItem('vireo_gemini_key', apiKey);
        } else {
            showToast("API Key is required to use voice commands.");
            return;
        }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const categoryNames = categories.map(c => c.name).join(", ");

    const promptText = `
        You are a smart controller for a time tracker named Vireo.
        The user said: "${transcript}".
        
        The current active categories are: [${categoryNames}].
        Your job is to match the spoken input to one of these actions: "add_time", "start_timer", "stop_timer".

        Rules:
        - If "add_time", extract the correct category and duration in minutes.
        - If the category mentioned is a close match to an active category, match it exactly.
        - Respond ONLY with a raw, valid JSON object following this exact schema. No Markdown wrapper.
        
        {
            "action": "add_time" | "start_timer" | "stop_timer",
            "category": "String (must match one of active categories exactly)",
            "duration_minutes": number
        }
    `;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            const msg = data.error.message || "Unknown error";
            const status = data.error.status || "";
            console.error("Gemini API error:", data.error);
            // Only clear the key when the key itself is the problem
            if (status === "INVALID_ARGUMENT" || status === "PERMISSION_DENIED" || status === "UNAUTHENTICATED" || /API key/i.test(msg)) {
                localStorage.removeItem('vireo_gemini_key');
                showToast("Invalid API Key. Please re-enter it.");
            } else {
                showToast(`Gemini error: ${msg}`);
            }
            return;
        }

        const candidate = data.candidates?.[0];
        if (!candidate?.content) {
            const blockReason = data.promptFeedback?.blockReason;
            showToast(blockReason ? `Blocked: ${blockReason}` : "No response from AI. Try again.");
            return;
        }

        const responseText = candidate.content.parts[0].text.replace(/```json|```/g, '').trim();
        const command = JSON.parse(responseText);

        executeAICommand(command, transcript);
    } catch (e) {
        console.error(e);
        showToast("Failed to process command.");
    }
}

function executeAICommand(command, transcript) {
    if (command.action === "add_time") {
        const seconds = command.duration_minutes * 60;
        saveTimeData(command.category, seconds);
        console.log(`Heard: "${transcript}" -> ${command.duration_minutes}m to ${command.category}`);
        showToast(`Heard "${transcript}" - Logged ${command.duration_minutes}m to ${command.category}!`);
    }
    else if (command.action === "start_timer") {
        const cat = categories.find(c => c.name.toLowerCase() === command.category.toLowerCase());
        if (cat) {
            selectedCategory = cat;
            renderActivityTiles();
            updateButtonColor();
            if (!isRunning) toggleTimer();
            showToast(`Started ${cat.name} timer!`);
        }
    } 
    else if (command.action === "stop_timer") {
        if (isRunning) {
            toggleTimer();
            showToast("Timer stopped and logged!");
        } else {
            showToast("No active timer to stop.");
        }
    }
}

function listenToVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast("Speech engine unsupported.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; 
    const voiceBtn = document.getElementById('voiceBtn');

    recognition.onstart = () => { voiceBtn.innerText = "🎙️ Listening..."; };
    recognition.onerror = (e) => {
        voiceBtn.innerText = "🎙️ Voice Command";
        console.error("Speech recognition error:", e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            showToast("Mic access denied. Enable it in Settings > Safari > Microphone.");
        } else if (e.error === 'no-speech') {
            showToast("Didn't hear anything. Try again.");
        } else if (e.error === 'audio-capture') {
            showToast("No microphone found.");
        } else {
            showToast(`Voice error: ${e.error}`);
        }
    };
    recognition.onresult = (e) => {
        voiceBtn.innerText = "🎙️ Voice Command";
        sendToAI(e.results[0][0].transcript);
    };
    recognition.start();
}

// --- 4. DATA MANAGEMENT ---
function renderHistory() {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    const log = document.getElementById('historyLog');
    log.innerHTML = '';
    [...data].reverse().slice(0, 10).forEach((s, i) => {
        const actualIdx = data.length - 1 - i;
        const time = new Date(s.duration * 1000).toISOString().substr(11, 8);
        log.innerHTML += `<div class="activity-item">
            <span><strong>${s.category}</strong> (${new Date(s.date).toLocaleDateString()})<br>${time}</span>
            <span class="delete-link" onclick="deleteSession(${actualIdx})">Remove</span>
        </div>`;
    });
}

function renderActivities() {
    const list = document.getElementById('activityList');
    list.innerHTML = '';
    categories.forEach((cat, index) => {
        const li = document.createElement('li');
        li.className = 'activity-item';
        li.innerHTML = `
            <span><small style="color:${cat.color}">●</small> ${cat.name} (${cat.goal}h)</span>
            <div>
                <span class="edit-link" onclick="editActivityGoal(${index})">Edit</span>
                <span class="delete-link" onclick="deleteActivity(${index})">Delete</span>
            </div>`;
        list.appendChild(li);
    });
    localStorage.setItem('trackerCategories', JSON.stringify(categories));
    updateButtonColor();
}

function editActivityGoal(index) {
    const newGoal = prompt(`Enter new goal (hours) for ${categories[index].name}:`, categories[index].goal);
    if (newGoal !== null && !isNaN(newGoal)) {
        categories[index].goal = parseFloat(newGoal);
        renderActivities();
        updateChart('week');
    }
}

function addActivity() {
    const name = document.getElementById('newActivityName').value;
    const color = document.getElementById('newActivityColor').value;
    const goal = parseFloat(document.getElementById('newActivityGoal').value) || 0;
    if (name) {
        categories.push({ name, color, goal });
        document.getElementById('newActivityName').value = '';
        document.getElementById('newActivityGoal').value = '';
        renderActivityTiles(); renderActivities(); updateChart('week');
    }
}

function deleteActivity(index) {
    if(confirm("Delete activity?")) { 
        categories.splice(index, 1); 
        if (categories.length > 0) selectedCategory = categories[0]; 
        else selectedCategory = null;
        renderActivityTiles(); renderActivities(); updateChart('week'); 
    }
}

// Custom resetting tool for Local Storage Key just in case you ever want to update your Key
function resetSavedAPIKey() {
    localStorage.removeItem('vireo_gemini_key');
    showToast("Saved API Key has been removed.");
}

function deleteSession(idx) {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.splice(idx, 1);
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    renderHistory(); updateChart('week');
}

function updateButtonColor() { 
    if (selectedCategory && startStopBtn) {
        startStopBtn.style.backgroundColor = selectedCategory.color;
        startStopBtn.style.color = "#ffffff";
    } 
}

function clearAllData() { 
    if(confirm("Clear everything? This will delete all history. This cannot be undone.")) { 
        localStorage.removeItem('timeTrackerData'); 
        renderHistory(); updateChart('week'); 
    } 
}

// --- 5. INITIALIZE APP ---
window.onload = () => { 
    renderActivityTiles(); 
    renderActivities(); 
    renderHistory(); 
    updateChart('week'); 
};
startStopBtn.addEventListener('click', toggleTimer);
