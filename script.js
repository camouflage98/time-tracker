let timerInterval;
let startTime; 
let isRunning = false;
let selectedCategory = null;
let myChart = null;

// Categories
let categories = JSON.parse(localStorage.getItem('trackerCategories')) || [
    { name: 'Reading', color: '#4CAF50' },
    { name: 'Exercising', color: '#007AFF' },
    { name: 'VFX', color: '#5856D6' },
    { name: 'Birds', color: '#FF9500' }
];

const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStopBtn');

// 1. SELECTING ACTIVITY (TILE LOGIC)
function renderActivityTiles() {
    const container = document.getElementById('activityTiles');
    container.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'activity-tile';
        if (selectedCategory && selectedCategory.name === cat.name) {
            div.classList.add('selected');
        }
        div.style.color = cat.color;
        div.innerText = cat.name;
        div.onclick = () => {
            selectedCategory = cat;
            renderActivityTiles();
            renderActivities(); // Sync the delete list
            updateButtonColor();
        };
        container.appendChild(div);
    });
    
    if (!selectedCategory && categories.length > 0) {
        selectedCategory = categories[0];
        renderActivityTiles();
    }
}

// 2. THE TIMER (Locked Screen Proof)
function toggleTimer() {
    if (isRunning) {
        const endTime = new Date();
        const diffInSeconds = Math.round((endTime - startTime) / 1000);
        
        clearInterval(timerInterval);
        isRunning = false;
        startStopBtn.innerText = "Start";
        
        saveTimeData(selectedCategory.name, diffInSeconds);
        display.innerText = "00:00:00";
    } else {
        isRunning = true;
        startTime = new Date(); // Record exact moment of start
        startStopBtn.innerText = "Stop";
        
        timerInterval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.round((now - startTime) / 1000);
            display.innerText = new Date(elapsed * 1000).toISOString().substr(11, 8);
        }, 1000);
    }
}

// 3. MANUAL INPUT
function addManualTime() {
    const mins = prompt(`How many minutes of ${selectedCategory.name} to add?`);
    if (mins && !isNaN(mins)) {
        saveTimeData(selectedCategory.name, parseInt(mins) * 60);
    }
}

// 4. DATA LOGIC
function saveTimeData(category, duration) {
    if (duration < 1) return;
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.push({ category, duration, date: new Date().toISOString() });
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    updateChart('week');
    renderHistory();
}

function renderHistory() {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    const log = document.getElementById('historyLog');
    log.innerHTML = '';
    [...data].reverse().slice(0, 10).forEach((s, i) => {
        const actualIdx = data.length - 1 - i;
        const time = new Date(s.duration * 1000).toISOString().substr(11, 8);
        const date = new Date(s.date).toLocaleDateString();
        log.innerHTML += `<div class="activity-item">
            <span><strong>${s.category}</strong> (${date})<br>${time}</span>
            <span class="delete-link" onclick="deleteSession(${actualIdx})">Remove</span>
        </div>`;
    });
}

function deleteSession(idx) {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.splice(idx, 1);
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    renderHistory();
    updateChart('week');
}

// 5. CATEGORY SETTINGS
function renderActivities() {
    const list = document.getElementById('activityList');
    list.innerHTML = '';
    categories.forEach((cat, index) => {
        list.innerHTML += `<div class="activity-item">
            <span><small style="color:${cat.color}">●</small> ${cat.name}</span>
            <span class="delete-link" onclick="deleteActivity(${index})">Delete</span>
        </div>`;
    });
    localStorage.setItem('trackerCategories', JSON.stringify(categories));
    updateButtonColor();
}

function addActivity() {
    const name = document.getElementById('newActivityName').value;
    const color = document.getElementById('newActivityColor').value;
    if (name) {
        categories.push({ name, color });
        document.getElementById('newActivityName').value = '';
        renderActivityTiles();
        renderActivities();
    }
}

function deleteActivity(index) {
    if(confirm("Delete this category?")) {
        categories.splice(index, 1);
        selectedCategory = categories[0];
        renderActivityTiles();
        renderActivities();
    }
}

function updateButtonColor() {
    if (selectedCategory) startStopBtn.style.backgroundColor = selectedCategory.color;
}

function clearAllData() {
    if(confirm("Erase everything?")) {
        localStorage.removeItem('timeTrackerData');
        renderHistory();
        updateChart('week');
    }
}

// 6. CHART
function updateChart(timeframe) {
    const data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    const now = new Date();
    let cutoff = new Date();
    if (timeframe === 'week') cutoff.setDate(now.getDate() - 7);
    else if (timeframe === 'month') cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    const totals = {};
    data.forEach(s => {
        if (new Date(s.date) >= cutoff) {
            totals[s.category] = (totals[s.category] || 0) + (s.duration / 3600);
        }
    });

    const ctx = document.getElementById('timeChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(totals),
            datasets: [{
                data: Object.values(totals),
                backgroundColor: Object.keys(totals).map(n => categories.find(c => c.name === n)?.color || '#ccc'),
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// START
startStopBtn.addEventListener('click', toggleTimer);
renderActivityTiles();
renderActivities();
renderHistory();
updateChart('week');
