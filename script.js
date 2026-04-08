let timerInterval;
let seconds = 0;
let isRunning = false;
let myChart = null;

// Initial Default Categories
let categories = JSON.parse(localStorage.getItem('trackerCategories')) || [
    { name: 'Reading', color: '#4CAF50' },
    { name: 'Exercising', color: '#2196F3' }
];

// UI ELEMENTS
const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStopBtn');
const categorySelect = document.getElementById('categorySelect');
const activityList = document.getElementById('activityList');

// 1. MANAGE ACTIVITIES
function renderActivities() {
    categorySelect.innerHTML = '';
    activityList.innerHTML = '';
    
    categories.forEach((cat, index) => {
        // Add to dropdown
        let option = new Option(cat.name, cat.name);
        categorySelect.add(option);
        
        // Add to management list
        let li = document.createElement('li');
        li.className = 'activity-item';
        li.innerHTML = `
            <span><span style="color:${cat.color}">●</span> ${cat.name}</span>
            <span class="delete-link" onclick="deleteActivity(${index})">Delete</span>
        `;
        activityList.appendChild(li);
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
        renderActivities();
    }
}

function deleteActivity(index) {
    categories.splice(index, 1);
    renderActivities();
}

function updateButtonColor() {
    const selectedName = categorySelect.value;
    const activeCat = categories.find(c => c.name === selectedName);
    if (activeCat) {
        startStopBtn.style.backgroundColor = activeCat.color;
    }
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

// 3. DATA HANDLING
function saveTimeData(category, duration) {
    if (duration < 1) return;
    let data = JSON.parse(localStorage.getItem('timeTrackerData')) || [];
    data.push({ category, duration, date: new Date().toISOString() });
    localStorage.setItem('timeTrackerData', JSON.stringify(data));
    updateChart('week');
}

function clearAllData() {
    if(confirm("Delete all history?")) {
        localStorage.removeItem('timeTrackerData');
        updateChart('week');
    }
}

// 4. CHART LOGIC
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
        type: 'doughnut', // Changed to doughnut for a modern look
        data: {
            labels: Object.keys(totals),
            datasets: [{
                data: Object.values(totals),
                backgroundColor: Object.keys(totals).map(name => 
                    categories.find(c => c.name === name)?.color || '#ccc'
                )
            }]
        },
        options: { maintainAspectRatio: false }
    });
}

// INIT
startStopBtn.addEventListener('click', toggleTimer);
renderActivities();
updateChart('week');