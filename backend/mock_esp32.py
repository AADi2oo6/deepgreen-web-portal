import requests
import random
import time
import sys

# Backend URL for Telemetry endpoint
URL = "http://localhost:8000/api/telemetry"

# Valid Node UUIDs from seeded public schema
NODE_IDS = [
    'bbcee330-220f-4668-8a96-ab3effa25fc3',  # Daintree Canopy Crane (Tower A)
    '5e528fb4-dff5-46c1-ab98-e866a17ec442',  # Daintree Discovery Centre (Tower B)
    '823d3432-67f5-4c8b-9be5-afc985fe947b'   # Thornton Peak North Ranger Post
]

# Threat types supported by ESP32 microcontrollers acoustic classification model
THREAT_TYPES = ['Chainsaw', 'Gunshot', 'Vehicle']

def main():
    print("==================================================")
    print("     DEEPGREEN IoT SYSTEM - MOCK ESP32 CLIENT     ")
    print("==================================================")
    print(f"Target Server: {URL}")
    print("Valid Nodes to simulate:")
    for idx, node in enumerate(NODE_IDS):
        print(f"  [{idx + 1}] {node}")
    print("Available acoustic threat types: 'Chainsaw', 'Gunshot', 'Vehicle'")
    print("--------------------------------------------------")
    print("Interactive control active.")
    print(" -> Press 'Enter' to fire a new telemetry alert event.")
    print(" -> Type 'q' or 'quit' followed by Enter to terminate.")
    print("==================================================\n")

    while True:
        try:
            user_input = input("Press [Enter] to send alert (or 'q' to exit): ").strip().lower()
            if user_input in ['q', 'quit', 'exit']:
                print("\nShutting down ESP32 simulator. Standby deactivated.")
                break
            
            # Select random threat parameters
            node_id = random.choice(NODE_IDS)
            threat = random.choice(THREAT_TYPES)
            # Generate random confidence score between 0.85 and 0.99
            confidence = round(random.uniform(0.85, 0.99), 4)

            payload = {
                "node_id": node_id,
                "threat_type": threat,
                "confidence_score": confidence
            }

            print(f"\n[ESP32 -> Server] Firing simulated acoustic threat event...")
            print(f"  - Node ID:      {node_id}")
            print(f"  - Sound Event:  {threat}")
            print(f"  - Confidence:   {confidence:.2%}")

            # Send telemetry JSON payload
            response = requests.post(URL, json=payload, timeout=5)
            
            # Print response
            print(f"[Server -> ESP32] HTTP Status Code: {response.status_code}")
            try:
                response_json = response.json()
                print(f"[Server -> ESP32] Response Data: {response_json}\n")
            except ValueError:
                print(f"[Server -> ESP32] Raw Response: {response.text}\n")

        except requests.exceptions.ConnectionError:
            print("[ESP32 Error] Connection refused! Is the FastAPI server running on localhost:8000?\n")
        except KeyboardInterrupt:
            print("\n\nKeyboardInterrupt detected. Shutting down mock ESP32 device.")
            break
        except Exception as e:
            print(f"[ESP32 Error] An unexpected error occurred: {e}\n")

if __name__ == "__main__":
    main()
