let currentExplorerPath = '';
let charts = {};
// Usa caminho relativo ou absoluto dependendo da origem
const API_BASE = (window.location.hostname === 'localhost' || window.location.protocol === 'file:') 
    ? 'http://localhost:3000' 
    : '';

const SERVER_SPECS = {
    "100.79.145.95": {
        cpu: "Intel Core I7 11700",
        gpu: "RTX 3080 GALAX 10GB",
        mobo: "Z590 V20 PRO COLORFUL",
        ramTotalGB: 48,
        ramDetails: "48GB (2x16/2x8) KINGSTON/TGROUP 2667 CL15",
        psu: "Corsair RM750 750W GOLD",
        gpuTotalVram: 10
    },
    "100.65.93.99": {
        cpu: "RYZEN 7 3700X",
        gpu: "RX 580 8GB MLLSE",
        mobo: "B450 BIOSTAR",
        ramTotalGB: 24,
        ramDetails: "24GB (1x8 e 1x16) HYPERX 2133mhz",
        psu: "Thermaltake 600W 80PLUS",
        gpuTotalVram: 8
    }
};

// ==========================================
// SISTEMA DE LOGIN
// ==========================================
function performLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');

    fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            localStorage.setItem('vigi_token', data.token);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'block';
            fetchData();
        } else {
            err.style.display = 'block';
        }
    }).catch(e => {
        err.innerText = "Erro de conexão: " + e.message;
        err.style.display = 'block';
    });
}

// Suporte para tecla Enter no Login
document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('login-pass');
    if (passInput) {
        passInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performLogin();
        });
    }
});

function getAuthHeaders() {
    return { 'Authorization': `Bearer ${localStorage.getItem('vigi_token')}` };
}

// ==========================================
// DASHBOARD & HARDWARE
// ==========================================
async function fetchData() {
    const btn = document.getElementById('btn-refresh');
    const icon = btn.querySelector('i');
    if (!document.isAutoRefreshing) icon.classList.add('rotating');
    document.isAutoRefreshing = true;

    try {
        const response = await fetch(`${API_BASE}/api/status`, { headers: getAuthHeaders() });
        if (response.status === 401) {
            localStorage.removeItem('vigi_token');
            window.location.reload();
            return;
        }
        
        const data = await response.json();
        const loader = document.getElementById('loader-main');
        if (loader) loader.style.display = 'none';
        const sGrid = document.getElementById('servers-container');
        if (sGrid) sGrid.style.display = 'grid';
        
        updateServers(data);
    } catch (error) {
        console.error('Erro na API:', error);
        const container = document.getElementById('servers-container');
        if (container) container.innerHTML = '<div style="text-align:center; padding: 3rem; color: var(--accent-danger);"><i class="ph ph-warning" style="font-size:3rem;"></i><p>Sistema Offline ou Erro de Conexão.</p></div>';
    } finally {
        icon.classList.remove('rotating');
        setTimeout(fetchData, 2000);
    }
}

function formatGB(value) {
    if (value === undefined || value === null) return '0 GB';
    const num = Number(value);
    if (num > 1000) return (num / 1024).toFixed(1) + ' TB';
    return num.toFixed(1) + ' GB';
}

function initOrUpdateChart(serverId, type, value, color) {
    const canvasId = `chart-${type}-${serverId}`;
    if (!charts[canvasId]) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: { datasets: [{ data: [value, 100 - value], backgroundColor: [color, 'rgba(255, 255, 255, 0.05)'], borderWidth: 0, borderRadius: 5 }] },
            options: { responsive: true, cutout: '75%', animation: { duration: 500, easing: 'easeOutQuart' }, plugins: { tooltip: { enabled: false } } }
        });
    } else {
        charts[canvasId].data.datasets[0].data = [value, 100 - value];
        charts[canvasId].update();
    }
}

function updateServers(servers) {
    const serversContainer = document.getElementById('servers-container');
    const mobilesContainer = document.getElementById('mobiles-container');
    if (serversContainer) serversContainer.innerHTML = '';
    if (mobilesContainer) mobilesContainer.innerHTML = '';

    servers.forEach(server => {
        if (server.type === 'mobile') {
            const mCard = document.createElement('div');
            mCard.className = 'mobile-card';
            const icon = server.name.toLowerCase().includes('iphone') ? 'ph-apple-logo' : 'ph-android-logo';
            mCard.innerHTML = `
                <div class="mobile-info">
                    <i class="ph ${icon}"></i>
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 500;">${server.name}</h3>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">${server.ip}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="status-badge ${server.status}">
                        <div class="status-dot"></div>
                        ${server.status.toUpperCase()}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--accent-primary); margin-top: 0.5rem;">Ping: ${server.ping}</div>
                </div>
            `;
            if (mobilesContainer) mobilesContainer.appendChild(mCard);
            return;
        }

        const specs = SERVER_SPECS[server.ip] || {};
        const cpuText = specs.cpu || server.cpuModel || "Processador";
        const gpuText = specs.gpu || server.gpuName || "GPU";
        const moboText = specs.mobo || "Placa Mãe Desconhecida";
        const psuText = specs.psu || "Fonte Desconhecida";
        const ramTotalTrue = specs.ramTotalGB || server.ramTotalGB || 0;
        const ramUsedTrueGB = ((server.ramUsage / 100) * ramTotalTrue).toFixed(1);
        const ramDetailsText = specs.ramDetails || server.ramTypeSpeed || "Memória RAM";
        
        // VRAM
        const gpuVramTotal = specs.gpuTotalVram || 0;
        const vramText = parseFloat(server.gpuVramUsedGB) > 0 ? `${server.gpuVramUsedGB} GB / ${gpuVramTotal} GB em Uso` : "Aguardando VRAM...";

        const statusClass = server.status === 'online' ? 'online' : (server.status === 'erro_permissao' ? 'warning' : 'offline');
        const statusText = server.status.toUpperCase();
        
        let existingCard = document.getElementById(`server-card-${server.id}`);
        if (!existingCard) {
            const card = document.createElement('div');
            card.className = 'server-card';
            card.id = `server-card-${server.id}`;
            if (serversContainer) serversContainer.appendChild(card);
            existingCard = card;
        }

        let disksHtml = '';
        server.disks.forEach(disk => {
            const freeGB = disk.totalGB - disk.usedGB;
            const percentUsed = (disk.usedGB / disk.totalGB) * 100;
            let colorClass = percentUsed > 90 ? 'danger' : (percentUsed > 75 ? 'warning' : '');
            disksHtml += `
                <div class="disk-card" onclick="openExplorer('\\\\\\\\${server.ip}\\\\${disk.letter}')">
                    <div class="disk-card-header">
                        <h3><i class="ph ph-hard-drives"></i> Disco ${disk.letter}:\\</h3>
                    </div>
                    <div class="disk-progress-container"><div class="disk-progress-bar ${colorClass}" style="width: ${percentUsed}%"></div></div>
                    <div class="disk-stats"><span>Livre: ${formatGB(freeGB)}</span><span>${percentUsed.toFixed(0)}%</span></div>
                </div>`;
        });

        existingCard.innerHTML = `
            <div class="server-header">
                <div class="server-title">
                    <i class="ph ph-hard-drive"></i>
                    <div>
                        <h2>${server.name}</h2>
                        <span>${server.ip} | Ping: ${server.ping}</span>
                    </div>
                </div>
                <div class="status-badge ${statusClass}"><i class="ph ph-power"></i> ${statusText}</div>
            </div>
            <div class="hardware-grid">
                <!-- CPU -->
                <div class="hardware-item">
                    <div class="chart-container">
                        <canvas id="chart-cpu-${server.id}"></canvas>
                        <div class="chart-center-val">${server.cpuUsage}%</div>
                    </div>
                    <div class="hardware-details">
                        <h4><i class="ph ph-cpu"></i> Processador</h4>
                        <p>${cpuText}</p>
                        <small>Uso Dinâmico: ${server.cpuUsage}%</small>
                    </div>
                </div>
                <!-- RAM -->
                <div class="hardware-item">
                    <div class="chart-container">
                        <canvas id="chart-ram-${server.id}"></canvas>
                        <div class="chart-center-val">${server.ramUsage}%</div>
                    </div>
                    <div class="hardware-details">
                        <h4><i class="ph ph-memory"></i> Memória RAM</h4>
                        <p>${ramUsedTrueGB} GB / ${ramTotalTrue} GB</p>
                        <small>${ramDetailsText}</small>
                    </div>
                </div>
                <!-- GPU -->
                <div class="hardware-item">
                    <div class="icon-box"><i class="ph ph-graphics-card"></i></div>
                    <div class="hardware-details">
                        <h4>Placa de Vídeo (GPU)</h4>
                        <p style="color: var(--accent-primary); font-weight:600;">${gpuText}</p>
                        <small>VRAM: ${vramText}</small>
                    </div>
                </div>
                <!-- Placa Mãe e Fonte -->
                <div class="hardware-item">
                    <div class="icon-box"><i class="ph ph-plugs"></i></div>
                    <div class="hardware-details">
                        <h4>Setup Base</h4>
                        <p>${moboText}</p>
                        <small>Fonte: ${psuText}</small>
                    </div>
                </div>
            </div>
            <div class="disks-grid">${disksHtml || '<p style="color: var(--text-muted); font-size: 0.9rem;">Nenhum disco encontrado.</p>'}</div>
        `;
        initOrUpdateChart(server.id, 'cpu', server.cpuUsage, '#3B82F6');
        initOrUpdateChart(server.id, 'ram', server.ramUsage, '#10B981');
    });
}

// ==========================================
// EXPLORADOR DE ARQUIVOS
// ==========================================
async function openExplorer(pathStr) {
    currentExplorerPath = pathStr;
    document.getElementById('current-path').value = pathStr;
    document.getElementById('explorer-modal').classList.add('show');
    await loadDirectory(pathStr);
}

function closeExplorer() { document.getElementById('explorer-modal').classList.remove('show'); }

async function loadDirectory(pathStr) {
    const list = document.getElementById('files-list');
    const loader = document.getElementById('explorer-loader');
    list.innerHTML = ''; loader.style.display = 'block';
    try {
        const response = await fetch(`${API_BASE}/api/explore?path=${encodeURIComponent(pathStr)}`, { headers: getAuthHeaders() });
        const data = await response.json();
        loader.style.display = 'none';
        if (data.error) { list.innerHTML = `<p style="color: var(--accent-danger); padding: 1rem;">${data.error}</p>`; return; }
        data.items.forEach(item => {
            const isDir = item.isDirectory;
            const icon = isDir ? 'ph-folder-fill' : 'ph-file-text';
            const size = isDir ? '' : `<span>${(item.size / 1024 / 1024).toFixed(2)} MB</span>`;
            const actionBtn = isDir 
                ? `<button class="btn-icon" onclick="openExplorer('${item.path.replace(/\\/g, '\\\\')}')"><i class="ph ph-caret-right"></i></button>`
                : `<button class="btn-icon" onclick="downloadFile('${item.path.replace(/\\/g, '\\\\')}')" title="Baixar"><i class="ph ph-download-simple"></i></button>`;
            list.innerHTML += `
                <div class="file-item" ${isDir ? `onclick="openExplorer('${item.path.replace(/\\/g, '\\\\')}')"` : ''}>
                    <div class="file-info"><i class="ph ${icon}"></i><span style="font-weight: 500;">${item.name}</span>${size}</div>
                    <div class="file-actions" onclick="event.stopPropagation()">${actionBtn}</div>
                </div>`;
        });
    } catch (error) { loader.style.display = 'none'; list.innerHTML = `<p style="color: var(--accent-danger); padding: 1rem;">Erro de conexão.</p>`; }
}

function navigateUp() {
    if (!currentExplorerPath) return;
    const parts = currentExplorerPath.split('\\');
    if (parts.length > 4) { parts.pop(); openExplorer(parts.join('\\')); }
}

function downloadFile(filePath) { 
    const token = localStorage.getItem('vigi_token');
    const url = `${API_BASE}/api/download?path=${encodeURIComponent(filePath)}&token=${token}`;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filePath.split('\\').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function uploadFile(event) {
    const file = event.target.files[0]; if (!file || !currentExplorerPath) return;
    const formData = new FormData(); formData.append('file', file);
    try {
        const response = await fetch(`${API_BASE}/api/upload?path=${encodeURIComponent(currentExplorerPath)}`, { method: 'POST', headers: getAuthHeaders(), body: formData });
        const result = await response.json();
        if (result.success) { alert('Enviado com sucesso!'); loadDirectory(currentExplorerPath); } else { alert('Erro: ' + result.error); }
    } catch (e) { alert('Falha no upload'); }
}

// ==========================================
// AUTO-START
// ==========================================
window.onload = () => {
    // Se o token existe, tenta pular o login
    if (localStorage.getItem('vigi_token')) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'block';
        fetchData();
    }
};
