# Bluetooth-Based Smart Parking System

An IoT Web Application built for college engineering projects to monitor and control an ESP32-based Smart Parking System in real-time using the **Web Bluetooth API (BLE)**.

---

## 🛠️ Hardware Setup & Wiring

| Component | Hardware Pin | ESP32 GPIO Pin |
|---|---|---|
| **HC-SR04 Sensor #1 (Slot 1)** | TRIG | **GPIO 5** |
| **HC-SR04 Sensor #1 (Slot 1)** | ECHO | **GPIO 18** *(Via Voltage Divider)* |
| **HC-SR04 Sensor #2 (Slot 2)** | TRIG | **GPIO 19** |
| **HC-SR04 Sensor #2 (Slot 2)** | ECHO | **GPIO 21** *(Via Voltage Divider)* |
| **SG90 Servo Motor (Gate)** | Signal | **GPIO 27** |
| **Power Supply** | VCC / GND | **5V / GND** |

> ⚠️ **Note:** The ECHO pins of the HC-SR04 sensors output 5V logic. Always use a 2:3 voltage divider (e.g. 1kΩ + 2kΩ resistors) before connecting to ESP32 GPIOs (which accept 3.3V logic).

---

## 📡 Bluetooth Low Energy (BLE) Specifications

The website uses the native **Web Bluetooth API** to directly communicate with the ESP32.

- **ESP32 BLE Device Name:** `Smart_Parking_ESP32`
- **BLE Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Status Characteristic UUID (READ/NOTIFY):** `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **Command Characteristic UUID (WRITE):** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`

### Data Protocol (JSON via Status Characteristic Notifications)
```json
{
  "slot1": "AVAILABLE",
  "slot2": "OCCUPIED",
  "available": 1,
  "total": 2,
  "gate": "OPEN"
}
```

### Gate Commands (Sent via Command Characteristic)
- `"OPEN"` - Opens the entrance gate servo motor
- `"CLOSE"` - Closes the entrance gate servo motor
- `"STATUS"` - Requests immediate status refresh from ESP32

---

## 🚀 How to Run the Website

### Option 1: Via Node.js Development Server (Recommended)
Web Bluetooth requires a **Secure Context** (`http://localhost` or `https://`).

1. Open PowerShell / Command Prompt in this folder.
2. Run:
   ```bash
   npm start
   ```
3. Open your browser at: **`http://localhost:3000`**

### Option 2: Direct File / Static Server
You can also host the directory using any HTTP server like Python:
```bash
python -m http.server 3000
```
Then visit `http://localhost:3000`.

---

## 📱 Browser Compatibility Requirements

- **Supported Browsers:** Google Chrome, Microsoft Edge, Opera, Chrome for Android.
- **Bluetooth Required:** Ensure Bluetooth is turned **ON** on your computer/laptop or smartphone.
- **Operating Systems:** Windows 10/11, macOS, Android, Linux, ChromeOS.

---

## 🧪 Step-by-Step ESP32 Connection Procedure

1. Power on your **ESP32** board.
2. Open the website at `http://localhost:3000` in **Google Chrome** or **Microsoft Edge**.
3. Click the **`[ CONNECT ESP32 ]`** button at the top of the dashboard.
4. Select **`Smart_Parking_ESP32`** from the browser's Bluetooth pairing prompt.
5. Once connected:
   - The indicator will switch to **`Connected`** with a glowing **`● LIVE`** badge.
   - The dashboard updates in real-time as vehicles enter/leave parking slots.
   - Click **`[ OPEN GATE ]`** or **`[ CLOSE GATE ]`** to control the barrier arm.
