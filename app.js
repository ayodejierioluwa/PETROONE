const SuiteEngine = (() => {
    const API_BASE = window.location.origin;
    let currentApp = 'home';
    let managerOnline = false;

    const APPS = {
        'home': { name: 'Global Overview', path: 'Dashboard', url: null },
        'gaia': { name: 'GAIA AI', path: 'Asset Intelligence', url: 'http://localhost:5001' },
        'petrosight': { name: 'PetroSight AI', path: 'Predictive Ops', url: 'http://localhost:3005' },
        'omesham': { name: 'Omesham AI', path: 'Drilling Optimization', url: 'http://localhost:3006' },
        'petweb': { name: 'PetWeb Finder', path: 'Data Retrieval', url: 'http://localhost:3003' }
    };

    const init = () => {
        console.log("SuiteEngine: Initializing...");
        updateStatus();
        setInterval(updateStatus, 3000);
        
        // Loader timeout
        setTimeout(() => {
            document.getElementById('loader').style.opacity = '0';
            setTimeout(() => document.getElementById('loader').style.display = 'none', 500);
        }, 1200);

        // Focus Bridge: Listen for any mouse interaction on the main stage to help focus the iframe
        document.querySelector('.workspace').addEventListener('mousedown', () => {
            if (currentApp !== 'home') {
                const frame = document.getElementById(`frame-${currentApp}`);
                if (frame) setTimeout(() => frame.focus(), 10);
            }
        });
    };

    const updateStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/status`);
            const status = await res.json();
            managerOnline = true;
            
            document.getElementById('manager-status').innerText = 'OPERATIONAL';
            document.getElementById('manager-status').style.color = 'var(--accent-emerald)';

            Object.keys(status).forEach(appId => {
                const dot = document.getElementById(`dot-${appId}`);
                if (dot) {
                    dot.className = `status-indicator ${status[appId].running ? 'online' : 'offline'}`;
                }
            });
        } catch (e) {
            managerOnline = false;
            document.getElementById('manager-status').innerText = 'OFFLINE';
            document.getElementById('manager-status').style.color = '#ef4444';
        }
    };

    const switchApp = (appId) => {
        if (!APPS[appId]) return;
        console.log(`SuiteEngine: Switching to ${appId}`);

        // UI Updates
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navItem = document.getElementById(`nav-${appId}`);
        if (navItem) navItem.classList.add('active');

        document.getElementById('bread-path').innerText = APPS[appId].path;
        document.getElementById('bread-title').innerText = APPS[appId].name;

        const viewHome = document.getElementById('view-home');
        const viewApp = document.getElementById('view-app');

        if (appId === 'home') {
            viewHome.classList.add('active');
            viewApp.classList.remove('active');
            currentApp = 'home';
        } else {
            viewHome.classList.remove('active');
            viewApp.classList.add('active');
            
            // Hide all frames
            document.querySelectorAll('.suite-frame').forEach(f => f.classList.remove('active'));
            
            const frame = document.getElementById(`frame-${appId}`);
            if (frame) {
                frame.classList.add('active');
                
                // Only load the URL if it hasn't been loaded yet
                if (frame.src === 'about:blank' || frame.src.endsWith('about:blank')) {
                    frame.src = APPS[appId].url;
                    
                    // Focus injection after load
                    frame.onload = () => {
                        setTimeout(() => {
                            frame.focus();
                            console.log(`SuiteEngine: Focus pushed to ${appId}`);
                        }, 500);
                    };
                } else {
                    // Already loaded, just pull focus back
                    setTimeout(() => frame.focus(), 500);
                }
            }
            
            currentApp = appId;
        }
    };

    const launchAll = async () => {
        if (!managerOnline) {
            alert("Manager API is offline. Cannot initiate launch.");
            return;
        }

        const btn = document.getElementById('main-launch-btn');
        btn.innerText = "Initializing...";
        btn.disabled = true;

        const appIds = ['gaia', 'petrosight', 'omesham', 'petweb'];
        for (const id of appIds) {
            try {
                await fetch(`${API_BASE}/launch/${id}`);
                // Sequential wait to avoid CPU spike
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`Launch failed for ${id}:`, e);
            }
        }

        btn.innerText = "Suite Online";
        setTimeout(() => {
            btn.innerText = "Initialize Suite";
            btn.disabled = false;
        }, 5000);
    };

    return { init, switchApp, launchAll };
})();

window.addEventListener('DOMContentLoaded', SuiteEngine.init);
