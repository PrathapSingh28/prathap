// NeuroPredict Regional Outbreak Forecasting

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropzone = document.getElementById('dropzone');
    const forecastBtn = document.getElementById('forecast-btn');
    const loader = document.getElementById('loader');
    const regionSelector = document.getElementById('region-selector');
    
    const cardsContainer = document.getElementById('model-cards-container');
    const highlightPanel = document.getElementById('best-model-highlight');
    const trajectoryInsight = document.getElementById('trajectory-insight');
    
    let trendChart = null;
    let outbreakMap = null;
    let mapMarkers = [];

    // ML Models
    const MODELS = [
        { id: 'rf', name: 'Random Forest', desc: 'Superior non-linear temporal dynamics capturing.', color: '#10b981' },
        { id: 'dt', name: 'Decision Tree', desc: 'Step-wise outbreak threshold conditions.', color: '#f59e0b' },
        { id: 'knn', name: 'K-Nearest Neighbors', desc: 'Local sequence similarity detection.', color: '#0ea5e9' },
        { id: 'nb', name: 'Naive Bayes', desc: 'Fast independent probability baseline.', color: '#8b5cf6' }
    ];

    // Regions Base Configurations (Base active case counts)
    const REGIONS = {
        'downtown': { base: 120, volatility: 30, risk: 'high' },
        'industrial': { base: 80, volatility: 15, risk: 'medium' },
        'suburbs': { base: 20, volatility: 5, risk: 'low' },
        'university': { base: 90, volatility: 40, risk: 'high' }
    };

    let customDataset = null;

    // Render Initial State
    renderEmptyState();

    // Event Listeners
    const csvFileInput = document.getElementById('csv-file');
    const uploadStatus = document.getElementById('upload-status');

    // Drag and Drop integration
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(14, 165, 233, 0.1)';
    });
    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.background = '';
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        // Must be a CSV
        if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
            alert('File error: Please make sure you are uploading a valid .csv file.');
            return;
        }
        
        uploadStatus.textContent = "Loading file...";
        const reader = new FileReader();
        reader.onload = function(event) {
            const text = event.target.result;
            const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 0);
            if(rows.length < 2) {
                alert('Invalid dataset. File requires at least a header and some data.');
                return;
            }
            
            // Super simple parser: Find 'Cases' or just use column 2
            const headers = rows[0].split(',').map(h => h.toLowerCase().trim());
            let caseIndex = headers.findIndex(h => h.includes('case') || h.includes('count'));
            if(caseIndex === -1) caseIndex = 2; // Default to assumed column index

            // Extract history up to latest 14 entries
            let parsedHistory = [];
            for(let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if(cols.length > caseIndex && cols[caseIndex].trim() !== '') {
                    parsedHistory.push(parseFloat(cols[caseIndex]));
                }
            }

            if(parsedHistory.length === 0) {
                alert('Could not find numerical case data in the CSV. Make sure you have a "Cases" column.');
                return;
            }

            // Get last 14 days maximum
            if(parsedHistory.length > 14) parsedHistory = parsedHistory.slice(-14);
            
            customDataset = parsedHistory;
            uploadStatus.innerHTML = `<strong style="color:var(--success)">Loaded ${file.name} successfully! Click Forecast below.</strong>`;
            document.getElementById('region-selector').value = 'custom';
        };
        reader.onerror = function() {
            alert("There was an error reading the file.");
        };
        reader.readAsText(file);
    }

    forecastBtn.addEventListener('click', () => {
        const selectedRegion = regionSelector.value;
        startForecasting(selectedRegion);
    });

    function renderEmptyState() {
        cardsContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column:1/-1;">Awaiting regional temporal data to generate predictive dashboard...</p>';
        initEmptyChart();
        initEmptyGrid();
    }

    function startForecasting(regionKey) {
        // UI Transition
        forecastBtn.style.display = 'none';
        loader.style.display = 'flex';
        highlightPanel.classList.remove('active');
        document.getElementById('forecast').scrollIntoView({ behavior: 'smooth', block: 'start' });

        setTimeout(() => {
            if(regionKey === 'custom' && customDataset) {
                processCustomData(customDataset);
            } else {
                // Determine effective region (fallback to downtown if custom without dataset)
                const safeKey = REGIONS[regionKey] ? regionKey : 'downtown';
                processOutbreakData(safeKey);
            }
            
            loader.style.display = 'none';
            forecastBtn.style.display = 'flex';
            forecastBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rerun Simulation';
        }, 1800);
    }

    function processCustomData(history) {
        const lastHistoricalCaseCount = history[history.length - 1];
        
        // Determine implied risk from trend (simple subtraction check over last few days)
        const trendSlope = history.length > 3 ? history[history.length - 1] - history[0] : 0;
        const configRisk = trendSlope > 40 ? 'high' : (trendSlope > 10 ? 'medium' : 'low');
        
        runForecastEngine(history, lastHistoricalCaseCount, configRisk);
    }

    function processOutbreakData(regionKey) {
        const config = REGIONS[regionKey];
        
        // 1. Generate Past 14 Days Historical Data
        let history = [];
        let cur = config.base;
        for(let i=14; i>=1; i--) {
            history.push(Math.max(0, Math.round(cur + (Math.random() * config.volatility - config.volatility/2))));
            cur += (config.risk === 'high' ? 4 : (config.risk === 'medium' ? 1 : -1)); // Trend assumption
        }

        const lastHistoricalCaseCount = history[history.length - 1];
        runForecastEngine(history, lastHistoricalCaseCount, config.risk);
    }

    function runForecastEngine(history, lastHistoricalCaseCount, impliedRisk) {
        // 2. Generate Model Predictions for Next 7 Days
        const results = MODELS.map(model => {
            let f1, mae, predTotal = 0;
            let predictedTrend = [];
            
            let tempCur = lastHistoricalCaseCount;
            // Generate future step predictions with noise based on model strength
            for(let i=0; i<7; i++) {
                let step = tempCur;
                if(model.id === 'rf') { step += (impliedRisk === 'high' ? 6 : 1); }  
                else if (model.id === 'dt') { step += (Math.random() * 10 - 2); }
                else if (model.id === 'knn') { step += (impliedRisk === 'high' ? 4 : 0); }
                else { step += (Math.random() * 15 - 5); }
                
                step = Math.max(0, Math.round(step));
                predictedTrend.push(step);
                tempCur = step;
            }

            // Assign abstract metrics
            if(model.id === 'rf') { mae = 2.1 + Math.random(); f1 = 92 + Math.random()*5; } 
            else if (model.id === 'dt') { mae = 4.5 + Math.random(); f1 = 85 + Math.random()*5; }
            else { mae = 5.0 + Math.random()*2; f1 = 80 + Math.random()*10; }

            const expectedRise = predictedTrend[6] - lastHistoricalCaseCount;
            const predRisk = expectedRise > 20 ? 'high' : (expectedRise > 5 ? 'medium' : 'low');

            return {
                ...model,
                predictedTrend,
                expectedRise,
                predRisk,
                metrics: { mae: mae.toFixed(1), f1: (f1/100).toFixed(2) }
            };
        });

        results.sort((a, b) => parseFloat(b.metrics.f1) - parseFloat(a.metrics.f1)); // Sort by F1
        const bestModel = results[0];

        renderBestModel(bestModel, impliedRisk, lastHistoricalCaseCount);
        renderCards(results);
        renderTrendChart(history, bestModel.predictedTrend, results);
        renderCityGrid({ risk: impliedRisk });
    }

    function renderBestModel(model, impliedRisk, lastCases) {
        document.getElementById('best-model-name').textContent = model.name;
        document.getElementById('best-error').textContent = model.metrics.mae;
        document.getElementById('best-f1').textContent = model.metrics.f1;
        
        const resultEl = document.getElementById('best-prediction-result');
        
        let severityClass = 'neutral-risk';
        let outcomeMsg = 'Stable Conditions Expected';
        if (model.predRisk === 'high') { severityClass = 'high-risk'; outcomeMsg = "<i class='fa-solid fa-arrow-trend-up'></i> Severe Outbreak Expansion"; }
        else if (model.predRisk === 'low') { severityClass = 'low-risk'; outcomeMsg = "<i class='fa-solid fa-arrow-trend-down'></i> Subsiding Cases"; }

        resultEl.innerHTML = `
            <div class="result-label">7-Day Trajectory Forecast</div>
            <div class="result-value ${severityClass}">${outcomeMsg}</div>
        `;
        
        highlightPanel.classList.add('active');
        highlightPanel.style.borderColor = model.color;
    }

    function renderCards(results) {
        cardsContainer.innerHTML = '';
        results.forEach(res => {
            let riskColor = res.predRisk==='high' ? 'var(--danger)' : (res.predRisk==='low' ? 'var(--success)' : 'var(--warning)');
            
            const card = document.createElement('div');
            card.className = 'model-card';
            card.innerHTML = `
                <div class="model-name">${res.name} <i class="fa-solid fa-chart-area" style="color:${res.color}"></i></div>
                <div class="model-outcome" style="color:${riskColor}">
                    <span>Est. Rise: ${res.expectedRise > 0 ? '+' : ''}${res.expectedRise}</span>
                    <span style="text-transform:uppercase; font-size:0.8rem;">${res.predRisk} RISK</span>
                </div>
                <div class="model-stats">
                    <div class="stat-item"><label>MAE</label><span>${res.metrics.mae}</span></div>
                    <div class="stat-item"><label>F1-Score</label><span>${res.metrics.f1}</span></div>
                </div>
                <div class="model-desc">${res.desc}</div>
            `;
            cardsContainer.appendChild(card);
        });
    }

    function initEmptyChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: ['Past', 'Present', 'Future'], datasets: [] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { display:false }, x: { display:false } } }
        });
    }

    function renderTrendChart(history, bestFuture, allResults) {
        if(trendChart) trendChart.destroy();
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // Labels T-14 to T+7
        let labels = [];
        for(let i=14; i>=1; i--) labels.push(`T-${i}`);
        labels.push('Today');
        for(let i=1; i<=7; i++) labels.push(`T+${i}`);

        // Pad historical dataset
        let historicalPlot = [...history, ...Array(7).fill(null)];
        
        // Pad future dataset so it connects with 'Today'
        let futurePlot = [...Array(14).fill(null), history[history.length-1], ...bestFuture];

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Reported Cases (History)',
                        data: historicalPlot,
                        borderColor: '#94a3b8',
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 3
                    },
                    {
                        label: 'Predicted Cases (RF Best Model)',
                        data: futurePlot,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.2)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointBackgroundColor: '#0ea5e9'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, color: '#f8fafc',
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } }
                },
                plugins: { legend: { labels: { color: '#f8fafc' } } }
            }
        });

        trajectoryInsight.innerHTML = `Algorithms project a continued trajectory over the 7-day forecast horizon. Model consensus highlights spatial spread driven by population dynamics in the selected zone.`;
    }

    function initEmptyGrid() {
        if (!outbreakMap) {
            // Initialize map view centered generally around New York City
            outbreakMap = L.map('leaflet-map').setView([40.7128, -74.0060], 11);
            
            // Add extremely premium dark-mode map tiles (CartoDB Dark Matter)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }).addTo(outbreakMap);
        }
    }

    function renderCityGrid(config) {
        // Ensure map exists just in case
        initEmptyGrid();

        // Clear previous heatmap circles
        mapMarkers.forEach(m => outbreakMap.removeLayer(m));
        mapMarkers = [];
        
        let center = [40.7128, -74.0060]; // Base NYC

        // Slightly shift center based on region fake-names for a dynamic feel
        const regionKey = document.getElementById('region-selector').value;
        if(regionKey === 'suburbs') center = [40.8528, -73.9060]; // shifted North
        else if(regionKey === 'industrial') center = [40.6528, -74.1060]; // shifted West
        else if(regionKey === 'university') center = [40.7291, -73.9965]; // Closer to NYU

        
        const numHotspots = config.risk === 'high' ? 18 : (config.risk === 'medium' ? 8 : 3);
        
        // Distribute risk circles
        for(let i=0; i<numHotspots; i++) {
            // Random offset within the region to scatter the dots
            const latOffset = (Math.random() - 0.5) * 0.15;
            const lngOffset = (Math.random() - 0.5) * 0.15;
            
            // Randomize severity color depending on overall risk
            const isSevere = Math.random() > 0.4;
            const color = (isSevere && config.risk === 'high') ? '#ef4444' : 
                          (config.risk === 'low' ? '#10b981' : '#f59e0b');
            
            const circle = L.circle([center[0] + latOffset, center[1] + lngOffset], {
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                radius: 300 + Math.random() * 900 // Between 300m and 1200m radius
            }).addTo(outbreakMap);
            
            const severityLabel = color === '#ef4444' ? 'High' : (color === '#10b981' ? 'Low' : 'Medium');
            circle.bindPopup(`<b>Zone ${i+1}</b><br>Predicted Escapement Risk: ${severityLabel}`);
            
            mapMarkers.push(circle);
        }

        // Add a central bounding area ring
        const bounding = L.circle(center, {
            color: '#8b5cf6',
            fillColor: 'transparent',
            weight: 2,
            dashArray: '5, 5',
            radius: 8000
        }).addTo(outbreakMap);
        mapMarkers.push(bounding);

        // Smoothly fly map to the focus center
        outbreakMap.flyTo(center, 12, { animate: true, duration: 1.5 });
    }
});
