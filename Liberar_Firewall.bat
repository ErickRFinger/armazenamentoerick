@echo off
color 0B
echo ===================================================
echo     SYSTEM SECURITY - Liberacao de Firewall
echo ===================================================
echo.

:: Verifica se o script esta rodando como Administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Permissoes de Administrador confirmadas.
) else (
    echo [!] Solicitando privilegios de Administrador...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

echo.
echo [1/2] Liberando Porta 3000 (Painel Central)...
powershell -Command "New-NetFirewallRule -DisplayName 'System Security - Painel 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue"

echo [2/2] Liberando Porta 4000 (Agente Satelite V3)...
powershell -Command "New-NetFirewallRule -DisplayName 'System Security - Agente 4000' -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue"

echo.
echo ===================================================
echo   FIREWALL CONFIGURADO COM SUCESSO!
echo   Voce ja pode acessar o painel de outros PCs.
echo ===================================================
echo.
pause
