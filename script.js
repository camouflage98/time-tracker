let timerInterval;
let seconds = 0;
let isRunning = false;
let myChart = null;

// Load Categories
let categories = JSON.parse(localStorage.getItem('trackerCategories')) || [
    { name: 'Reading', color: '#4CAF50' },
    { name: 'Exercising', color: '#2196F3' },
    { name: 'VFX Work', color: '#9C27B0' }
];

// Elements
const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStopBtn');
const categorySelect = document.getElementById('categorySelect');
const activityList = document.getElementById('activityList');
const historyLog = document.getElementById('historyLog');

// 1. CATEGORY MANAGEMENT
function renderActivities() {
    categorySelect.innerHTML = '';
    activityList.innerHTML = '';
    categories.forEach((cat, index) => {
        categorySelect.add(new Option(cat.name, cat.name));
        let li = document.createElement('div');
        li.className = 'activity-item';
        li.innerHTML = `<span><small style="color:${cat.color}">●</small> ${cat.name}</span>
                        <span class="delete-link" onclick="deleteActivity(${index})">Delete</span>`;
        activityList.appendChild(li);
    });
    localStorage.setItem('trackerCategories', JSON.stringify(categories));
    updateButtonColor();
}

function addActivity() {
    const name = document.getElementById('newActivityName').value.trim();
    const color = document.getElementById('newActivityColor').value;
    if (name) {
        categories.push({ name, color });
        document.getElementById('newActivityName').value = '';
        renderActivities();
    }
}

function deleteActivity(index) {
    if(confirm("Delete this category?")) {
        categories.splice(index, 1);
        renderActivities();
    }
}

function updateButtonColor() {
    const activeCat = categories.find(c => c.name === categorySelect.value);
    if (activeCat) startStopBtn.style.backgroundColor = activeCat.color;
}

// 2. TIMER LOGIC
function toggleTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        startStopBtn.innerText = "Start";
        saveTimeData(categorySelect.value, seconds);
        seconds = 0;
        display.innerText = "00:00:00";
    } else {
        isRunning = true;
        startStopBtn.innerText = "Stop";
        timerInterval = setInterval(() => {
            seconds++;
            display.innerText = new Date(seconds * 1000).toISOString().substr(11, 8);
        }, 1000);
    }
}

// 3. HISTORY & DATA
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
    historyLog.innerHTML = '';
    // Show most recent at the top
    [...data].reverse().forEach((session, revIdx) => {
        const actualIdx = data.length - 1 - revIdx;
        const time = new Date(session.duration * 1000).toISOString().substr(11, 8);
        const date = new Date(session.date).toLocaleDateString();
        
        let item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `<span><strong>${session.category}</strong> <small>(${date})</small><br>${time}</span>
                        <span class="delete-link" onclick="deleteSession(${actualIdx})">Remove</span>`;
        historyLog.appendChild(item);
    });
}

function deleteSession(index) {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.splice(index, 1);
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    renderHistory();
    updateChart('week');
}

function clearAllData() {
    if(confirm("This will erase all your history. Proceed?")) {
        localStorage.removeItem('timeTrackerData');
        renderHistory();
        updateChart('week');
    }
}

// 4. CHARTING
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
                backgroundColor: Object.keys(totals).map(n => categories.find(c => c.name === n)?.color || '#ccc')
            }]
        },
        options: { maintainAspectRatio: false }
    });
}

// Start
startStopBtn.addEventListener('click', toggleTimer);
renderActivities();
renderHistory();
updateChart('week');
