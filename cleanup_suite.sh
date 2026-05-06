#!/bin/bash

echo "Stopping PetroOne Suite processes..."

# Kill processes by port
for port in 8888 5001 3005 3006 3003 8005 8006; do
    pid=$(lsof -t -i :$port)
    if [ -n "$pid" ]; then
        echo "Killing processes on port $port (PIDs: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

# Kill by name just in case
pkill -f "run_gaia.py"
pkill -f "start_servers.sh"
pkill -f "SuiteManager"
pkill -f "next-server"
pkill -f "uvicorn"

echo "Cleanup complete."
