const SuiteEngine = (() => {
    const API_BASE = window.location.origin;
    let currentApp = 'home';
    let managerOnline = false;
    let isRegisterMode = false;

    const host = window.location.hostname;
    const APPS = {
        'home': { name: 'Global Overview', path: 'Dashboard', url: null },
        'gaia': { name: 'GAIA AI', path: 'Asset Intelligence', url: `http://${host}:5001` },
        'petrosight': { name: 'PetroSight AI', path: 'Predictive Ops', url: `http://${host}:3005` },
        'omesham': { name: 'Omesham AI', path: 'Drilling Optimization', url: `http://${host}:3006` },
        'petweb': { name: 'PetWeb Finder', path: 'Data Retrieval', url: `http://${host}:3003` }
    };

    const init = () => {
        console.log("SuiteEngine: Initializing SSO master controller...");
        
        // Check local storage session
        const sessionStr = localStorage.getItem('petroone_sso_session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if (session && session.username && session.token) {
                    hideSSOOverlay();
                }
            } catch (e) {
                localStorage.removeItem('petroone_sso_session');
            }
        }

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

        // SSO Message Broker: Listen for session requests from child iframes (GAIA/Omesham/PetroSight)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'REQUEST_SSO_SESSION') {
                console.log(`SuiteEngine SSO: Received request from origin [${event.origin}]`);
                const activeSessionStr = localStorage.getItem('petroone_sso_session');
                const activeSession = activeSessionStr ? JSON.parse(activeSessionStr) : null;
                
                event.source.postMessage({
                    type: 'SSO_SESSION_RESPONSE',
                    session: activeSession
                }, event.origin);
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

    const toggleSSOMode = () => {
        isRegisterMode = !isRegisterMode;
        const emailContainer = document.getElementById('email-container');
        const submitBtn = document.getElementById('sso-submit-btn');
        const toggleBtn = document.getElementById('sso-toggle-btn');
        const toggleText = document.getElementById('sso-toggle-text');
        
        if (isRegisterMode) {
            emailContainer.style.display = 'flex';
            submitBtn.innerText = 'Register & Initialize Node';
            toggleBtn.innerText = 'Authenticate instead';
            toggleText.innerText = 'Already have access?';
        } else {
            emailContainer.style.display = 'none';
            submitBtn.innerText = 'Authenticate Node';
            toggleBtn.innerText = 'Request Access';
            toggleText.innerText = 'Need node access?';
        }
    };

    const handleSSOSubmit = async (event) => {
        if (event) event.preventDefault();
        
        const username = document.getElementById('sso-username').value;
        const password = document.getElementById('sso-password').value;
        const msgDiv = document.getElementById('sso-msg');
        
        msgDiv.className = 'sso-msg';
        msgDiv.style.display = 'none';

        if (isRegisterMode) {
            const email = document.getElementById('sso-email').value;
            try {
                const res = await fetch(`http://${host}:5001/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, email, password })
                });
                if (res.ok) {
                    showMsg('Node registered successfully! Authenticating...', 'success');
                    setTimeout(() => {
                        toggleSSOMode();
                        document.getElementById('sso-username').value = username;
                        document.getElementById('sso-password').value = password;
                        handleSSOSubmit();
                    }, 1200);
                } else {
                    showMsg('Registration failed. Username or email may exist.', 'error');
                }
            } catch (e) {
                showMsg('Error connecting to authentication node (GAIA AI).', 'error');
            }
        } else {
            try {
                const res = await fetch(`http://${host}:5001/api/auth/sso-verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    showMsg('Authentication verified. Syncing node...', 'success');
                    localStorage.setItem('petroone_sso_session', JSON.stringify({
                        username: data.user.username,
                        token: data.token
                    }));
                    setTimeout(() => {
                        hideSSOOverlay();
                        // Trigger hot load of active apps if selected
                        switchApp(currentApp);
                    }, 1000);
                } else {
                    showMsg(data.message || 'Invalid credentials.', 'error');
                }
            } catch (e) {
                showMsg('Error connecting to authentication node (GAIA AI).', 'error');
            }
        }
    };

    const showMsg = (text, type) => {
        const msgDiv = document.getElementById('sso-msg');
        msgDiv.innerText = text;
        msgDiv.className = `sso-msg ${type}`;
        msgDiv.style.display = 'block';
    };

    const hideSSOOverlay = () => {
        const overlay = document.getElementById('sso-overlay');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.remove('active'), 500);
    };

    const logout = () => {
        console.log("SuiteEngine: Clearing local and child sessions...");
        localStorage.removeItem('petroone_sso_session');
        
        // Refresh page to trigger login screen lock again
        window.location.reload();
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
                if (!frame.dataset.loaded) {
                    frame.src = APPS[appId].url;
                    frame.dataset.loaded = 'true';
                    
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

    return { init, switchApp, launchAll, toggleSSOMode, handleSSOSubmit, logout };
})();

window.addEventListener('DOMContentLoaded', SuiteEngine.init);
