@echo off
echo ========================================
echo   SISTEMA FINANCEIRO - MODO REDE
echo ========================================
echo.

echo [1/3] Descobrindo IP local...
ipconfig | findstr /i "IPv4"
echo.
echo Copie o IP acima (exemplo: 192.168.1.100)
echo.

set /p IP_SERVIDOR="Digite o IP do servidor: "

echo.
echo [2/3] Configurando frontend...
cd frontend
if not exist .env (
    echo VITE_API_URL=http://%IP_SERVIDOR%:4000 > .env
    echo Arquivo .env criado!
) else (
    echo VITE_API_URL=http://%IP_SERVIDOR%:4000 > .env
    echo Arquivo .env atualizado!
)
cd ..

echo.
echo [3/3] Iniciando servidores...
echo.
echo Backend rodando em: http://%IP_SERVIDOR%:4000
echo Frontend rodando em: http://%IP_SERVIDOR%:3000
echo.
echo Para acessar de outros computadores, use: http://%IP_SERVIDOR%:3000
echo.
echo Pressione qualquer tecla para iniciar os servidores...
pause >nul

start "Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Servidores iniciados! Feche esta janela quando terminar.
pause

