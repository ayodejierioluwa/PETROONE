import os
import subprocess
import signal
import time
import json
import sys
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Configuration: Absolute paths to apps and their entry points
APPS = {
    "gaia": {
        "name": "GAIA AI",
        "dir": "/Users/macbook/.gemini/antigravity/scratch/petroleum-ai",
        "cmd": "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 run_gaia.py",
        "port": 5001
    },
    "petrosight": {
        "name": "PetroSight AI",
        "dir": "/Users/macbook/.gemini/antigravity/scratch/petrosight_ai",
        "cmd": "./start_servers.sh",
        "port": 3005
    },
    "omesham": {
        "name": "Omesham AI",
        "dir": "/Users/macbook/.gemini/antigravity/scratch/omesham_ai",
        "cmd": "./start_servers.sh",
        "port": 3006
    },
    "petweb": {
        "name": "PetWeb Finder",
        "dir": "/Users/macbook/.gemini/antigravity/scratch/PETWEB.FINDER",
        "cmd": "./start_servers.sh",
        "port": 3003
    }
}

class PetroHandler(SimpleHTTPRequestHandler):
    """
    Unified Handler for serving the Dashboard static files AND the Manager API.
    """
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # API Routes
        if self.path == "/status":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            
            status = {}
            for app_id, app_info in APPS.items():
                status[app_id] = {
                    "name": app_info["name"],
                    "running": self.check_port(app_info["port"]),
                    "port": app_info["port"]
                }
            self.wfile.write(json.dumps(status).encode())
            return

        elif self.path.startswith("/launch/"):
            app_id = self.path.split("/")[-1]
            if app_id in APPS:
                success = self.launch_app(app_id)
                self.send_response(200 if success else 500)
                self.end_headers()
                self.wfile.write(b"Success" if success else b"Failed")
            else:
                self.send_response(404)
                self.end_headers()
            return

        # Fallback to static file serving
        return super().do_GET()

    def check_port(self, port):
        """Check if a port is open on localhost (IPv4 and IPv6)."""
        for host in ('127.0.0.1', '::1'):
            try:
                with socket.create_connection((host, port), timeout=0.2):
                    return True
            except:
                continue
        return False

    def launch_app(self, app_id):
        app = APPS[app_id]
        
        # Force kill existing process on this port to avoid EADDRINUSE
        try:
            pid = subprocess.check_output(["lsof", "-t", "-i", f":{app['port']}"]).decode().strip()
            if pid:
                print(f"Manager: Port {app['port']} in use by PID(s) {pid}. Killing...")
                for p in pid.split('\n'):
                    os.kill(int(p), signal.SIGKILL)
                time.sleep(1) # Wait for port to release
        except:
            pass

        try:
            print(f"Manager: Launching {app['name']}...")
            # We use start_new_session=True to decouple the process from the manager
            # Redirect logs for debugging
            log_file = open(os.path.join(app["dir"], f"{app_id}_start.log"), "w")
            
            subprocess.Popen(
                app["cmd"], 
                cwd=app["dir"],
                shell=True,
                start_new_session=True,
                stdout=log_file,
                stderr=log_file
            )
            return True
        except Exception as e:
            print(f"Manager Error: Failed to launch {app_id}: {e}")
            return False

def run_manager():
    # Ensure we are in the correct directory to serve files
    os.chdir("/Users/macbook/.gemini/antigravity/scratch/petro_suite")
    
    port = 8888
    server = ThreadingHTTPServer(('0.0.0.0', port), PetroHandler)
    print(f"\n[ PetroOne Suite Orchestrator Online ]")
    print(f"URL: http://localhost:{port}\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Manager...")
        server.shutdown()

if __name__ == "__main__":
    run_manager()
