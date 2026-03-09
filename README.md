# DeepGreen Platform 🌲📡

> **Listen. Detect. Protect.**
> The real-time command center for the DeepGreen IoT ecosystem.

## Overview
This repository contains the full-stack web application for **DeepGreen**, an energy-efficient forest monitoring system. It visualizes real-time threats (illegal logging, poaching, human-wildlife conflict) detected by edge-AI sensor nodes.

The system uses a decoupled architecture: a highly responsive **React** frontend for geospatial visualization, and a lightning-fast asynchronous **FastAPI** backend that interfaces directly with our **GridDB** time-series database.

## Architecture & Tech Stack
### Frontend (`/client`)
* **Framework:** React.js
* **Mapping:** React-Leaflet (for rendering GPS nodes and alert layers)
* **Styling:** Tailwind CSS (or your preferred UI library)
* **State Management:** Context API / Redux (for managing live sensor streams)

### Backend (`/api`)
* **Framework:** FastAPI (Python)
* **Real-time Comm:** WebSockets (for pushing instant IoT alerts to the UI)
* **Database:** GridDB Python Client (High-speed time-series ingestion)
* **Server:** Uvicorn

## Key Features
* **Live Threat Map:** Real-time visualization of active alerts using WebSocket streams.
* **Historical Heatmaps:** Querying GridDB via REST API to show high-risk zones over time.
* **Active Defense UI:** A control panel for Rangers to remotely trigger sirens on specific IoT nodes via LoRa downlinks.
* **Data Obfuscation:** The backend automatically applies a 500m GPS randomization offset for public-tier access to protect wildlife.