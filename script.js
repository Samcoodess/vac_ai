document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT SELECTORS ---
    const micBtn = document.getElementById('mic-btn');
    const statusDiv = document.getElementById('status');
    const logContainer = document.getElementById('log-container');
    const assetContainer = document.getElementById('asset-container');
    const commandListDiv = document.getElementById('command-list');
    const assetSelectionStatus = document.getElementById('asset-selection-status');
    const operatorImg = document.getElementById('operator-img-container');
    const aiImg = document.getElementById('ai-img-container');
    const themeToggle = document.getElementById('theme-toggle');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    let map, lightMapLayer, darkMapLayer;

    // --- THEME SETUP ---
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
            themeToggle.innerHTML = sunIcon;
            if (map && darkMapLayer) map.addLayer(darkMapLayer);
            if (map && lightMapLayer) map.removeLayer(lightMapLayer);
        } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
            themeToggle.innerHTML = moonIcon;
            if (map && lightMapLayer) map.addLayer(lightMapLayer);
            if (map && darkMapLayer) map.removeLayer(darkMapLayer);
        }
    };

    // --- SPEECH RECOGNITION SETUP ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
    } else {
        updateStatus('Speech recognition not supported.', 'error');
        if(micBtn) micBtn.disabled = true;
    }

    // --- ASSET & COMMAND DEFINITIONS ---
    const assets = [
        { id: 'drone-alpha', name: 'UAV-Alpha', type: 'drone', aliases: ['drone', 'alpha', 'uav'], capabilities: ['video_feed', 'temperature', 'movement', 'air_quality', 'battery_status'], location: {lat: 33.775, lon: -84.275, grid: 'GR 483-847'}, battery: 82 },
        { id: 'vehicle-rhino', name: 'UGV-Rhino', type: 'vehicle', aliases: ['vehicle', 'rhino', 'ugv'], capabilities: ['movement', 'cargo_status', 'ground_scan', 'fuel_status'], location: {lat: 33.772, lon: -84.278, grid: 'GR 482-845'}, fuel: 65 },
        { id: 'soldier-bravo', name: 'Operator-Bravo', type: 'soldier', aliases: ['soldier', 'bravo', 'operator'], capabilities: ['health_status', 'position', 'battery_status'], location: {lat: 33.774, lon: -84.279, grid: 'GR 483-846'}, battery: 95 },
        { id: 'sensor-grid-1', name: 'Sensor-Grid-1', type: 'sensor', aliases: ['sensor', 'grid'], capabilities: ['temperature', 'air_quality', 'seismic_activity', 'battery_status'], location: {lat: 33.776, lon: -84.272, grid: 'GR 484-848'}, battery: 100 },
    ];

    const commandMap = {
        'temperature': { capability: 'temperature', example: 'Get temperature reading', response: (asset) => `${asset.name} reporting: Ambient temperature is ${Math.floor(Math.random() * 15 + 18)}°C.` },
        'video': { capability: 'video_feed', example: 'Show me video feed', response: (asset) => `${asset.name}: Establishing encrypted video feed.` },
        'move': { capability: 'movement', example: 'Move to new position', response: (asset) => moveAsset(asset) },
        'cargo': { capability: 'cargo_status', example: 'Report cargo status', response: (asset) => `${asset.name}: Cargo bay is at ${Math.floor(Math.random() * 100)}% capacity.` },
        'health': { capability: 'health_status', example: 'Check health status', response: (asset) => `${asset.name}: Vitals are stable. No anomalies detected.` },
        'position': { capability: 'position', example: 'What is your position?', response: (asset) => `${asset.name}: Current grid reference is ${asset.location.grid}.` },
        'air quality': { capability: 'air_quality', example: 'Analyze air quality', response: (asset) => `${asset.name}: Air quality index is ${Math.floor(Math.random() * 30 + 10)} (Good).` },
        'scan': { capability: 'ground_scan', example: 'Perform ground scan', response: (asset) => `${asset.name}: Ground penetrating scan initiated. No anomalies detected.` },
        'seismic': { capability: 'seismic_activity', example: 'Detect seismic activity', response: (asset) => `${asset.name}: No significant seismic activity detected.` },
        'battery': { capability: 'battery_status', example: 'Report battery level', response: (asset) => `${asset.name} reports battery at ${asset.battery}%.` },
        'fuel': { capability: 'fuel_status', example: 'Check fuel status', response: (asset) => `${asset.name} reports fuel level at ${asset.fuel}%.` },
        'status report': { capability: null, example: 'Give status report', response: (asset) => `Generic status report requested from ${asset.name}.` },
    };

    // --- CORE FUNCTIONS ---
    const initializeUI = () => {
        // Map Setup
        map = L.map('map', { zoomControl: false }).setView([33.774, -84.275], 15);
        lightMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
        darkMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
        
        // Theme Setup
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);

        // Icons
        const icons = {
            drone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M12.0001 1.99999L22.0001 6.99999V17L12.0001 22L2.00006 17V6.99999L12.0001 1.99999ZM12.0001 12.8787L18.0711 9.34314L16.6569 8.63604L12.0001 11.1213L7.34321 8.63603L5.929 9.34314L12.0001 12.8787ZM12.0001 15.1213L5.929 11.5858L4.51478 12.2929L12.0001 16.5355L19.4854 12.2929L18.0711 11.5858L12.0001 15.1213Z"/></svg>`,
            vehicle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M20 17H22V19H2V17H4V11.7279C4 11.0273 4.34789 10.3835 4.90359 10.0112L11.0964 5.9888C11.6521 5.61651 12.3479 5.61651 12.9036 5.9888L19.0964 10.0112C19.6521 10.3835 20 11.0273 20 11.7279V17ZM6 17H18V12.0317L12 8.01885L6 12.0317V17Z M7 19H9V21H7V19Z M15 19H17V21H15V19Z" /></svg>`,
            soldier: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M12 14C9.23858 14 7 16.2386 7 19V21H17V19C17 16.2386 14.7614 14 12 14ZM12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" /></svg>`,
            sensor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7ZM12 9C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9Z" /></svg>`
        };

        // Populate UI
        commandListDiv.innerHTML = Object.values(commandMap).map(cmd => `<span>- ${cmd.example}</span>`).join('');
        assets.forEach(asset => {
            const assetDiv = document.createElement('div');
            assetDiv.id = asset.id;
            assetDiv.className = 'asset-card flex flex-col justify-between';
            const icon = icons[asset.type];
            const batteryHtml = asset.battery !== undefined ? `<div class="flex items-center" title="Battery"><div class="w-full progress-bar-bg rounded-full h-1.5"><div class="progress-bar h-1.5 rounded-full" style="width: ${asset.battery}%; background-color: var(--accent-secondary);"></div></div><span class="text-xs font-mono ml-2">${asset.battery}%</span></div>` : '';
            const fuelHtml = asset.fuel !== undefined ? `<div class="flex items-center" title="Fuel"><div class="w-full progress-bar-bg rounded-full h-1.5"><div class="progress-bar h-1.5 rounded-full" style="width: ${asset.fuel}%; background-color: var(--accent-yellow);"></div></div><span class="text-xs font-mono ml-2">${asset.fuel}%</span></div>` : '';
            assetDiv.innerHTML = `<div><div class="flex items-start justify-between mb-2"><div class="asset-icon">${icon}</div><div class="text-right"><h3 class="font-bold text-base">${asset.name}</h3><p class="text-sm capitalize" style="color: var(--text-secondary);">${asset.type}</p></div></div></div><div class="text-left text-sm space-y-2"><div class="flex items-center" title="Location"><span class="font-bold mr-2">GRID:</span><span class="font-mono asset-location">${asset.location.grid}</span></div>${batteryHtml}${fuelHtml}</div>`;
            assetContainer.appendChild(assetDiv);
            const markerIcon = L.divIcon({ html: `<div class="asset-icon marker-icon">${icon}</div>`, className: 'leaflet-div-icon', iconSize: [32, 32], iconAnchor: [16, 32] });
            asset.marker = L.marker([asset.location.lat, asset.location.lon], { icon: markerIcon }).addTo(map).bindPopup(`<b style="color:black; font-family: var(--font-main);">${asset.name}</b>`);
        });
        logMessage('System', 'VAC-AI initialized. Standing by for command.');
    };

    const moveAsset = (asset) => {
        asset.location.lat += (Math.random() - 0.5) * 0.002;
        asset.location.lon += (Math.random() - 0.5) * 0.002;
        asset.marker.setLatLng([asset.location.lat, asset.location.lon]);
        asset.location.grid = `GR ${Math.floor(482 + Math.random()*3)}-${Math.floor(845 + Math.random()*4)}`;
        const locationSpan = document.querySelector(`#${asset.id} .asset-location`);
        if (locationSpan) locationSpan.textContent = asset.location.grid;
        return `${asset.name} acknowledging. Relocating to new position.`;
    };

    const parseCommand = (commandText) => {
        let matchedIntent = null;
        let matchedAsset = null;

        // 1. Find the intent
        for (const keyword in commandMap) {
            if (commandText.includes(keyword)) {
                matchedIntent = { keyword, ...commandMap[keyword] };
                break;
            }
        }

        // 2. Find the asset
        for (const asset of assets) {
            const assetTerms = [asset.name.toLowerCase(), ...asset.aliases];
            if (assetTerms.some(term => commandText.includes(term))) {
                matchedAsset = asset;
                break;
            }
        }
        
        return { intent: matchedIntent, asset: matchedAsset };
    };

    const processCommand = (commandText) => {
        const lowerCommand = commandText.toLowerCase();
        logMessage('User', `"${commandText}"`);
        updateStatus('Processing...', 'info', true);

        const { intent, asset } = parseCommand(lowerCommand);

        if (!intent) {
            logMessage('System', `Command not recognized: "${commandText}"`, 'error');
            speakResponse("Command not recognized. Please try again.");
            return;
        }

        let targetAssets = [];
        if (asset) {
            // Asset was specified
            if (intent.capability && !asset.capabilities.includes(intent.capability)) {
                logMessage('System', `${asset.name} does not have capability: '${intent.capability}'.`, 'error');
                speakResponse(`Error: ${asset.name} cannot perform that action.`);
                return;
            }
            targetAssets.push(asset);
        } else {
            // No asset specified, find all with the capability
            targetAssets = intent.capability ? assets.filter(a => a.capabilities.includes(intent.capability)) : assets;
        }

        if (targetAssets.length > 0) {
            const assetNames = targetAssets.map(a => a.name).join(', ');
            logMessage('System', `CMD '${intent.keyword.toUpperCase()}' routed to: ${assetNames}.`);
            targetAssets.forEach((asset, index) => {
                setTimeout(() => {
                    highlightAsset(asset.id, true);
                    const assetResponse = intent.response(asset);
                    logMessage('Asset', assetResponse, asset.name);
                    speakResponse(assetResponse);
                    setTimeout(() => highlightAsset(asset.id, false), 2500);
                }, index * 300);
            });
        } else {
            logMessage('System', `No asset with capability: '${intent.capability}'.`, 'error');
            speakResponse(`Error: No asset can perform that action.`);
        }
    };

    // --- UI & HELPER FUNCTIONS ---
    const logMessage = (source, text, sourceName = '') => {
        const entry = document.createElement('div');
        const typeClass = { 'User': 'log-user', 'System': 'log-system', 'Asset': 'log-asset', 'error': 'log-error' }[source] || 'log-system';
        entry.className = `log-entry ${typeClass}`;
        const sourceColor = getComputedStyle(document.documentElement).getPropertyValue(`--accent-${typeClass.split('-')[1] || 'primary'}`).trim();
        entry.innerHTML = `<p class="font-bold text-sm" style="color: ${sourceColor};">${sourceName || source}</p><p>${text}</p>`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    };

    const updateStatus = (message, type = 'info') => {
        statusDiv.textContent = `STATUS: ${message.toUpperCase()}`;
    };

    const highlightAsset = (assetId, isActive) => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        // Highlight asset card and map marker
        const assetDiv = document.getElementById(assetId);
        if (assetDiv) assetDiv.classList.toggle('asset-glow', isActive);
        if (asset.marker && asset.marker._icon) asset.marker._icon.classList.toggle('marker-glow', isActive);

        // Highlight command input images based on asset type
        if (asset.type === 'drone' || asset.type === 'sensor') {
            if(aiImg) aiImg.classList.toggle('glow', isActive);
        } else if (asset.type === 'vehicle' || asset.type === 'soldier') {
            if(operatorImg) operatorImg.classList.toggle('glow', isActive);
        }

        if (isActive) {
            assetSelectionStatus.textContent = `${asset.name} SELECTED`;
            map.flyTo(asset.marker.getLatLng(), 16);
            asset.marker.openPopup();
        } else {
            setTimeout(() => {
                if (assetSelectionStatus.textContent === `${asset.name} SELECTED`) {
                    assetSelectionStatus.textContent = '';
                }
            }, 2000);
        }
    };

    const speakResponse = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            speechSynthesis.speak(utterance);
        }
    };

    // --- EVENT LISTENERS ---
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    if(micBtn && recognition) {
        micBtn.addEventListener('click', () => {
            micBtn.classList.add('listening');
            micBtn.querySelector('span').textContent = 'LISTENING...';
            recognition.start();
            updateStatus('Listening...', 'listening');
        });
        recognition.onresult = (event) => processCommand(event.results[0][0].transcript);
        recognition.onend = () => {
            micBtn.classList.remove('listening');
            micBtn.querySelector('span').textContent = 'AWAITING COMMAND';
            updateStatus('Standby');
            if (aiImg) aiImg.classList.remove('glow');
        };
        recognition.onerror = (event) => {
            logMessage('System', `Speech recognition error: ${event.error}`, 'error');
            updateStatus(`Error: ${event.error}`, 'error');
        };
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === `${target}-tab`);
                content.classList.toggle('hidden', content.id !== `${target}-tab`);
            });
        });
    });

    // --- INITIALIZE ---
    initializeUI();
});
