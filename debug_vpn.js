const fs = require('fs').promises;
const { exec } = require('child_process');

async function testSMB(ip, share) {
    console.log(`[Teste SMB] Tentando acessar \\\\${ip}\\${share}...`);
    try {
        const stats = await fs.statfs(`\\\\${ip}\\${share}`);
        console.log(`[SMB SUCESSO] ${ip}\\${share} acessível! Espaço Total: ${Math.round((stats.blocks * stats.bsize) / (1024**3))} GB`);
    } catch (e) {
        console.log(`[SMB FALHA] ${ip}\\${share} Erro: ${e.message}`);
    }
}

function testWMI(ip) {
    console.log(`[Teste WMI] Tentando consultar WMI em ${ip}...`);
    const cmd = `powershell -Command "Get-WmiObject Win32_OperatingSystem -ComputerName ${ip} -ErrorAction Stop | Select-Object TotalVisibleMemorySize | ConvertTo-Json"`;
    
    return new Promise((resolve) => {
        exec(cmd, (err, stdout) => {
            if (err) {
                console.log(`[WMI FALHA] ${ip} Erro: Access Denied / RPC Server Unavailable`);
                resolve(false);
            } else {
                console.log(`[WMI SUCESSO] ${ip} respondeu ao WMI!`);
                resolve(true);
            }
        });
    });
}

function testPing(ip) {
    console.log(`[Teste PING] Pingando ${ip}...`);
    return new Promise(resolve => {
        exec(`ping -n 1 ${ip}`, (err, stdout) => {
            if (stdout.includes('TTL=')) {
                console.log(`[PING SUCESSO] ${ip} está online.`);
                resolve(true);
            } else {
                console.log(`[PING FALHA] ${ip} inacessível.`);
                resolve(false);
            }
        });
    });
}

async function run() {
    const ip1 = '100.79.145.95';
    
    await testPing(ip1);
    await testWMI(ip1);
    await testSMB(ip1, 'A$');
    await testSMB(ip1, 'A');
    await testSMB(ip1, 'C$');
}

run();
