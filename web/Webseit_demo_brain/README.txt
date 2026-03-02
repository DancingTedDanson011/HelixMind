Desktop Virtual Camera
=======================

Diese Tools emulieren eine echte Kamera, die den Desktop oder ausgewählte Fenster als Videoquelle ausgibt.

Funktionen:
- Landscape (1920x1080) oder Portrait (1080x1920) Modus
- Schwarzer Hintergrund (geplant)
- Auswahl bestimmter Fenster (geplant)
- Läuft wie eine echte Kamera, wird von Zoom, Teams, etc. erkannt

Voraussetzungen:
1. Python 3.7 oder höher (https://www.python.org/)
2. OBS VirtualCam Treiber (https://obsproject.com/forum/resources/obs-virtualcam.949/)

Installation:
1. OBS VirtualCam herunterladen und installieren (nur der Treiber, nicht OBS selbst)
2. Python installieren (bei Installation "Add Python to PATH" anhaken)
3. Diese Dateien in einen Ordner kopieren

Verwendung:
Doppelklick auf "start_camera.bat"
Oder Kommandozeile:
   start_camera.bat [--mode landscape|portrait] [--monitor 1] [--fps 30]

Beispiele:
   start_camera.bat --mode portrait
   start_camera.bat --mode landscape --monitor 2 --fps 60

Das Python-Skript kann auch direkt aufgerufen werden:
   python desktop_camera.py --mode portrait

Hinweise:
- Die Fensterauswahl (--window) ist noch nicht implementiert
- Der schwarze Hintergrund muss noch implementiert werden
- Bei Performance-Problemen Framerate reduzieren (--fps 15)

Bei Problemen:
- Stellen Sie sicher, dass OBS VirtualCam installiert ist
- Administrator-Rechte können erforderlich sein
- Prüfen Sie, ob Python-Module korrekt installiert wurden