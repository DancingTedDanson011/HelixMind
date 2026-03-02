#!/usr/bin/env python3
"""
Desktop Virtual Camera
Streamt den Desktop als virtuelle Kamera.
Unterstützt Landscape/Portrait, schwarzen Hintergrund, Fensterauswahl.
"""

import argparse
import sys
import time
import numpy as np
import mss
import mss.tools
import pyvirtualcam

def parse_args():
    parser = argparse.ArgumentParser(description='Desktop Virtual Camera')
    parser.add_argument('--mode', choices=['landscape', 'portrait'], default='landscape',
                        help='Auflösungsmodus (Landscape = 1920x1080, Portrait = 1080x1920)')
    parser.add_argument('--window', type=str, help='Titel des Fensters, das aufgenommen werden soll (exakter Titel)')
    parser.add_argument('--monitor', type=int, default=1, help='Monitor-Nummer (1=primär, 2=sekundär, etc.)')
    parser.add_argument('--fps', type=int, default=30, help='Framerate der virtuellen Kamera')
    parser.add_argument('--background', action='store_true', help='Schwarzer Hintergrund (nicht implementiert)')
    return parser.parse_args()

def get_monitor_geometry(monitor_num):
    """Gibt das Rechteck des angegebenen Monitors zurück."""
    with mss.mss() as sct:
        monitors = sct.monitors
        if monitor_num < 1 or monitor_num >= len(monitors):
            print(f'Monitor {monitor_num} nicht gefunden. Verwende primären Monitor.')
            monitor_num = 1
        monitor = monitors[monitor_num]
        return monitor

def capture_screen(monitor):
    """Erfasst einen Screenshot des angegebenen Monitors."""
    with mss.mss() as sct:
        screenshot = sct.grab(monitor)
        # Konvertiere von BGRA zu RGB
        img = np.array(screenshot)[:, :, :3]  # Entferne Alpha-Kanal
        return img

def resize_for_mode(img, mode):
    """Skaliert das Bild auf die Zielauflösung je nach Modus."""
    h, w = img.shape[:2]
    if mode == 'landscape':
        target_w, target_h = 1920, 1080
    else:  # portrait
        target_w, target_h = 1080, 1920
    
    if w == target_w and h == target_h:
        return img
    
    # Skalierung mit OpenCV (schnell)
    try:
        import cv2
        return cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
    except ImportError:
        pass
    
    # Fallback: scikit-image
    try:
        from skimage.transform import resize
        return (resize(img, (target_h, target_w)) * 255).astype(np.uint8)
    except ImportError:
        pass
    
    # Einfachste Skalierung: auf Zielgröße strecken (sehr grob, nur für Notfall)
    from PIL import Image
    pil_img = Image.fromarray(img)
    pil_img = pil_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return np.array(pil_img)

def main():
    args = parse_args()
    
    print(f'Desktop Virtual Camera startet im {args.mode}-Modus...')
    print(f'FPS: {args.fps}')
    if args.window:
        print(f'Fensterauswahl: {args.window} (nicht implementiert, verwende gesamten Monitor)')
    print(f'Monitor: {args.monitor}')
    print('Drücke Strg+C zum Beenden.')
    
    # Monitor-Geometrie abrufen
    monitor = get_monitor_geometry(args.monitor)
    print(f'Monitor-Auflösung: {monitor["width"]}x{monitor["height"]}')
    
    # Virtuelle Kamera erstellen
    target_width = 1920 if args.mode == 'landscape' else 1080
    target_height = 1080 if args.mode == 'landscape' else 1920
    
    try:
        with pyvirtualcam.Camera(width=target_width, height=target_height, fps=args.fps, backend='obs') as cam:
            print(f'Virtuelle Kamera gestartet: {cam.device}')
            print(f'Kamera-Auflösung: {cam.width}x{cam.height}')
            
            frame_count = 0
            while True:
                # Screenshot aufnehmen
                img = capture_screen(monitor)
                
                # Auf Zielgröße skalieren
                img = resize_for_mode(img, args.mode)
                
                # Bild an virtuelle Kamera senden
                cam.send(img)
                
                # Auf nächsten Frame warten
                cam.sleep_until_next_frame()
                
                frame_count += 1
                if frame_count % 30 == 0:
                    print(f'Frames gesendet: {frame_count}', end='\r')
    
    except KeyboardInterrupt:
        print('\nBeende...')
    except Exception as e:
        print(f'Fehler: {e}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()