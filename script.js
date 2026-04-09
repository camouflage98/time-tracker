let timerInterval, startTime, isRunning = false;
let selectedCategory = null, myChart = null;

let categories = JSON.parse(localStorage.getItem('trackerCategories')) || [
    { name: 'Working', color: '#0000FF', goal: 4 },
    { name: 'Running', color: '#FF0000', goal: 1 },
    { name: 'Eating', color: '#4CAF50', goal: 1 }
];

const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStopBtn');

// 1. SELECTING ACTIVITY
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

// 2. THE TIMER
function toggleTimer() {
    if (isRunning) {
        const diff = Math.round((new Date() - startTime) / 1000);
        clearInterval(timerInterval);
        isRunning = false;
        startStopBtn.innerText = "Start";
        saveTimeData(selectedCategory.name, diff);
        display.innerText = "00:00:00";
    } else {
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

// 3. CHART & LEGEND
function updateChart(timeframe) {
    const data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    const cutoff = new Date();
    
    // Day logic: Filter data starting from 12:00 AM today
    if (timeframe === 'day') cutoff.setHours(0, 0, 0, 0);
    else if (timeframe === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (timeframe === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (timeframe === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);

    const totals = {};
    const todayTotals = {};
    const todayStr = new Date().toDateString();

    // Get a list of the names of your CURRENT categories
    const currentCategoryNames = categories.map(c => c.name);

    data.forEach(s => {
        const sDate = new Date(s.date);
        
        // ONLY add to the chart if the category still exists in your list
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
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        font: { size: 14, weight: 'bold' },
                        padding: 15
                    } 
                },
                datalabels: { display: false } 
            }
        }
    });

    // Update Goals Progress
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

// 4. MANAGEMENT (History & Settings)
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
        list.innerHTML += `<div class="activity-item">
            <span><small style="color:${cat.color}">●</small> ${cat.name} (${cat.goal}h goal)</span>
            <div>
                <span class="edit-link" onclick="editActivityGoal(${index})">Edit Goal</span>
                <span class="delete-link" onclick="deleteActivity(${index})">Delete</span>
            </div>
        </div>`;
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

function deleteSession(idx) {
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.splice(idx, 1);
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    renderHistory(); updateChart('week');
}

function updateButtonColor() { 
    if (selectedCategory) startStopBtn.style.backgroundColor = selectedCategory.color; 
}

function clearAllData() { 
    if(confirm("Clear everything?")) { 
        localStorage.removeItem('timeTrackerData'); 
        renderHistory(); updateChart('week'); 
    } 
}

window.onload = () => { renderActivityTiles(); renderActivities(); renderHistory(); updateChart('week'); };
startStopBtn.addEventListener('click', toggleTimer);
