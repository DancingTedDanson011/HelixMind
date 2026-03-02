@echo off
REM Desktop Virtual Camera Starter
REM Emuliert eine echte Kamera mit Desktop- oder Fensteraufnahme
REM Landscape/Portrait Modus, schwarzer Hintergrund, ausgewählte Fenster

echo ========================================
echo  Desktop Virtual Camera
echo ========================================
echo.

REM Prüfe Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Fehler: Python ist nicht installiert oder nicht im PATH.
    echo Bitte installiere Python von https://www.python.org/
    pause
    exit /b 1
)

REM Prüfe erforderliche Python-Module
echo Prüfe Python-Module...
python -c "import pyvirtualcam, mss, numpy, cv2, skimage" 2>nul
if errorlevel 1 (
    echo Installiere fehlende Module...
    pip install pyvirtualcam mss numpy opencv-python scikit-image --quiet
    if errorlevel 1 (
        echo Fehler bei der Installation der Module.
        echo Stelle sicher, dass pip verfügbar ist.
        pause
        exit /b 1
    )
)

REM Prüfe OBS VirtualCam Treiber
echo Prüfe OBS VirtualCam Treiber...
reg query "HKLM\SOFTWARE\OBS VirtualCam" >nul 2>&1
if errorlevel 1 (
    echo OBS VirtualCam ist nicht installiert.
    echo Bitte installiere OBS VirtualCam von:
    echo https://obsproject.com/forum/resources/obs-virtualcam.949/
    echo.
    echo Nach der Installation diese Batch-Datei erneut starten.
    pause
    exit /b 1
)

REM Starte das Python-Skript
echo Starte Desktop Virtual Camera...
python desktop_camera.py %*
if errorlevel 1 (
    echo Fehler beim Starten der Kamera.
    pause
    exit /b 1
)

pause