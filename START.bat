@echo off
chcp 65001 > nul
title EduTest

echo.
echo  ==========================================
echo   EduTest — Система контроля знаний
echo  ==========================================
echo.

cd /d "%~dp0"

:: Проверяем node_modules
if not exist "node_modules\" (
    echo  [!] node_modules не найден. Устанавливаю зависимости...
    echo.
    npm install
    if errorlevel 1 (
        echo  [ОШИБКА] Не удалось установить зависимости.
        pause
        exit /b 1
    )
)

:: Проверяем .env
if not exist ".env" (
    echo  [!] Файл .env не найден. Создаю из шаблона...
    (
        echo SESSION_SECRET=edutest_secret_key_change_in_production_2024
        echo AI_API_KEY=
        echo AI_BASE_URL=https://api.groq.com/openai/v1
        echo AI_MODEL=llama-3.3-70b-versatile
        echo PORT=3333
    ) > .env
    echo  [!] Заполните AI_API_KEY в файле .env и запустите снова.
    pause
    exit /b 1
)

echo  Запускаю сервер...
echo  Откройте браузер: http://localhost:3333
echo.
echo  Для остановки нажмите Ctrl+C
echo  ==========================================
echo.

npm run dev
pause
