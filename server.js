const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const http = require('http');

const app = express();
const port = 3000;
const AGENT_PORT = 4000;
const SECURE_TOKEN = "VIGI-SECURE-TOKEN-123";

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Servir o Frontend (index.html, styles.css, app.js)

function checkAuth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
    if (token === SECURE_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: "Acesso Negado. Não Autorizado." });
    }
}

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === "Erick Finger" && pass === "@324354Erk!") {
        res.json({ success: true, token: SECURE_TOKEN });
    } else {
        res.status(401).json({ success: false, error: "Credenciais inválidas!" });
    }
});

const SERVERS = [
    { 
        id: "server-1", ip: "100.79.145.95", name: "Servidor Principal", type: "server",
        expectedDisks: ["A", "B", "C", "D", "E", "F", "H", "I", "J"],
        username: "Erick Finger", password: "@324354Erk!"
    },
    { 
        id: "server-2", ip: "100.65.93.99", name: "Servidor Secundário", type: "server",
        expectedDisks: ["A", "B", "C", "D", "E"],
        username: "Erick", password: "324354"
    }
];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const targetPath = req.query.path;
        if (!targetPath) return cb(new Error("Caminho não fornecido"));
        cb(null, targetPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

function ensureNetworkAccess(ip) {
    return new Promise((resolve) => {
        const server = SERVERS.find(s => s.ip === ip);
        if (!server || !server.username) return resolve(true);

        const cmd = `net use \\\\${ip}\\IPC$ "${server.password}" /user:"${server.username}"`;
        exec(cmd, { timeout: 1500 }, () => resolve(true));
    });
}

function getDiskSpace(ip, letter) {
    return new Promise((resolve) => {
        const uncPath = `\\\\${ip}\\${letter}`;
        fs.statfs(uncPath)
            .then(stats => {
                const totalBytes = stats.blocks * stats.bsize;
                const freeBytes = stats.bfree * stats.bsize;
                resolve({
                    letter: letter,
                    totalGB: Math.round((totalBytes / (1024 ** 3)) * 10) / 10,
                    usedGB: Math.round(((totalBytes - freeBytes) / (1024 ** 3)) * 10) / 10
                });
            })
            .catch(() => resolve(null));
    });
}

function fetchAgentStatus(ip) {
    return new Promise((resolve) => {
        const options = {
            hostname: ip,
            port: AGENT_PORT,
            path: '/status',
            method: 'GET',
            timeout: 1500 // Reduzido para 1.5s
        };

        const req = http.request(options, res => {
            if (res.statusCode !== 200) return resolve(null);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
        req.end();
    });
}

function testPing(ip) {
    return new Promise(resolve => {
        const start = Date.now();
        exec(`ping -n 1 -w 1000 ${ip}`, (err, stdout) => {
            if (stdout.includes('TTL=')) {
                resolve(`${Date.now() - start}ms`);
            } else {
                resolve(null);
            }
        });
    });
}

app.get('/api/status', checkAuth, async (req, res) => {
    const results = [];
    
    try {
        const serverPromises = SERVERS.map(async (server) => {
            // Ping
            const pingTime = await testPing(server.ip);
            const isOnline = !!pingTime;

            // Tenta buscar no Agente
            let agentData = null;
            if (isOnline) {
                agentData = await fetchAgentStatus(server.ip);
            }

            // Busca HDs por SMB
            let disksArray = [];
            if (isOnline) {
                await ensureNetworkAccess(server.ip);
                const diskPromises = server.expectedDisks.map(letter => getDiskSpace(server.ip, letter));
                const diskResults = await Promise.all(diskPromises);
                disksArray = diskResults.filter(d => d !== null);
            }

            return {
                ...server,
                status: isOnline ? (agentData ? 'online' : 'erro_permissao') : 'offline',
                ping: pingTime || '?',
                cpuUsage: agentData ? agentData.cpuUsage : 0,
                ramUsage: agentData ? agentData.ramUsage : 0,
                gpuVramUsedGB: agentData ? agentData.gpuVramUsedGB : 0,
                cpuModel: agentData ? agentData.cpuModel : '',
                ramTotalGB: agentData ? agentData.ramTotalGB : '',
                gpuName: agentData ? agentData.gpuName : '',
                disks: disksArray
            };
        });

        const results = await Promise.all(serverPromises);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

app.get('/api/explore', checkAuth, async (req, res) => {
    try {
        const targetPath = req.query.path;
        if (!targetPath) return res.status(400).json({ error: "Parâmetro path ausente" });

        const match = targetPath.match(/\\\\([^\\]+)\\/);
        if (match) await ensureNetworkAccess(match[1]);

        const items = await fs.readdir(targetPath, { withFileTypes: true });
        
        const filesData = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(targetPath, item.name);
            let stats = null;
            try { stats = await fs.stat(itemPath); } catch (e) { }
            
            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                size: stats ? stats.size : 0,
                path: itemPath,
                ext: path.extname(item.name)
            };
        }));

        filesData.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });

        res.json({ currentPath: targetPath, items: filesData });
    } catch (error) {
        res.status(500).json({ error: "Acesso negado ou caminho não encontrado: " + error.message });
    }
});

app.get('/api/download', checkAuth, async (req, res) => {
    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).send("Path ausente");
    
    const match = targetPath.match(/\\\\([^\\]+)\\/);
    if (match) await ensureNetworkAccess(match[1]);
    
    res.download(targetPath, (err) => {
        if (err && !res.headersSent) res.status(500).send("Erro no download: " + err.message);
    });
});

app.post('/api/upload', checkAuth, upload.single('file'), async (req, res) => {
    try {
        res.json({ success: true, message: "Arquivo enviado com sucesso", file: req.file.originalname });
    } catch (error) {
        res.status(500).json({ error: "Erro no upload: " + error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend Central rodando em http://localhost:${port}`);
});

// Exportar para o Vercel Serverless
module.exports = app;
