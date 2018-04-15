# LoRa Data Server
Stores and visualizes data received from device in LoRaWAN network. Uses components of [LoRa Server project](https://www.loraserver.io/). Expands the LoRa App Server REST API and provides its own web interface.

## Requirements
 * Node.js (tested on version 6.13.1)
 * LoRa App Server and its dependencies (URL of REST API and connection to MQTT server is required)
 * Database system (currently only PostgreSQL is supported)

## Quick install (Debian)
 1. [Quick install of LoRa Server project](https://www.loraserver.io/install/quick-install/)
 2. [Installation of Node.js from repository](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)
 3. Download latest release.
 4. Create role and database in PostgreSQL:
    ```
    sudo -u postgres psql
    CREATE ROLE loradataserver WITH LOGIN CREATEROLE PASSWORD 'password';
    CREATE DATABASE loradataserver WITH OWNER loradataserver;
    ```

 5. Create MQTT account:
    ```
    sudo mosquitto_passwd /etc/mosquitto/pwd loradataserver
    ```

 6. Create configration file for your deployment (config/local.json):
    ```
    {
        "connections": {
    		"mqtt": {
    			"options": {
    				"username": "loradataserver",
    				"password": "password"
    			}
    		},
    		"database": "postgresql://loradataserver:password@localhost:5432/loradataserver"
    	}
    }
    ```

 7. Install dependencies.
    ```
    npm install
    ```

 8. Build project.
    ```
    npm run build
    ```

 9. Start the server. (root required for listening on ports below 1024)
    ```
    sudo node index.js
    ```
