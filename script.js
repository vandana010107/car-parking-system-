/**
 * Bluetooth-Based Smart Parking System - Web Bluetooth Client
 * Designed for ESP32 hardware with ultrasonic sensors and SG90 servo motor.
 *
 * BLE Specifications:
 * - Device Name: Smart_Parking_ESP32
 * - Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 * - Status Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8 (READ/NOTIFY)
 * - Command Characteristic UUID: 6e400002-b5a3-f393-e0a9-e50e24dcca9e (WRITE)
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // CONSTANTS & CONFIGURATION
  // =========================================================================
  const BLE_CONFIG = {
    DEVICE_NAME: 'Smart_Parking_ESP32',
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    STATUS_CHAR_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    COMMAND_CHAR_UUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
  };

  // State Variables
  let bluetoothDevice = null;
  let gattServer = null;
  let statusCharacteristic = null;
  let commandCharacteristic = null;
  let isConnected = false;
  let activityLogs = [];
  const MAX_LOGS = 20;

  // Last known state to prevent duplicate log spam
  let lastKnownState = {
    slot1: null,
    slot2: null,
    gate: null
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const elements = {
    browserWarning: document.getElementById('browser-warning'),
    
    // Connection Controls & Indicators
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    connectionBadge: document.getElementById('connection-badge'),
    connectionText: document.getElementById('connection-text'),
    liveIndicator: document.getElementById('live-indicator'),
    liveText: document.getElementById('live-text'),
    systemNotice: document.getElementById('system-notice'),
    noticeMessage: document.getElementById('notice-message'),
    
    // Parking Status Banners & Summary Cards
    parkingBanner: document.getElementById('parking-banner'),
    bannerTitle: document.getElementById('banner-title'),
    bannerSubtitle: document.getElementById('banner-subtitle'),
    valTotalSlots: document.getElementById('val-total-slots'),
    valAvailableSlots: document.getElementById('val-available-slots'),
    valOccupiedSlots: document.getElementById('val-occupied-slots'),
    valGateStatus: document.getElementById('val-gate-status'),
    
    // Slot Cards
    slotCard1: document.getElementById('slot-card-1'),
    slot1Pill: document.getElementById('slot-1-pill'),
    slot1CarLabel: document.getElementById('slot-1-car-label'),
    
    slotCard2: document.getElementById('slot-card-2'),
    slot2Pill: document.getElementById('slot-2-pill'),
    slot2CarLabel: document.getElementById('slot-2-car-label'),
    
    // Gate Controls & Display
    gateBadgeDisplay: document.getElementById('gate-badge-display'),
    btnOpenGate: document.getElementById('btn-open-gate'),
    btnCloseGate: document.getElementById('btn-close-gate'),
    
    // Visual Diagram Elements
    vizSlot1: document.getElementById('viz-slot-1'),
    vizSlot1Text: document.getElementById('viz-slot-1-text'),
    vizSlot2: document.getElementById('viz-slot-2'),
    vizSlot2Text: document.getElementById('viz-slot-2-text'),
    vizGateArm: document.getElementById('viz-gate-arm'),
    
    // Activity Log
    activityLogBody: document.getElementById('activity-log-body'),
    btnClearLog: document.getElementById('btn-clear-log'),
    
    // Spec Accordion
    specHeaderToggle: document.getElementById('spec-header-toggle'),
    specCard: document.querySelector('.spec-card'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // =========================================================================
  // INITIALIZATION & COMPATIBILITY CHECK
  // =========================================================================
  function init() {
    checkBrowserCompatibility();
    setupEventListeners();
    updateUIState(false);
  }

  function checkBrowserCompatibility() {
    if (!navigator.bluetooth) {
      console.warn('Web Bluetooth API is not supported in this browser environment.');
      elements.browserWarning.classList.remove('hidden');
      elements.btnConnect.disabled = true;
      showToast('Web Bluetooth API is not supported by your browser. Please use Google Chrome or Microsoft Edge.', 'error');
    }
  }

  function setupEventListeners() {
    elements.btnConnect.addEventListener('click', connectESP32);
    elements.btnDisconnect.addEventListener('click', disconnectESP32);
    
    elements.btnOpenGate.addEventListener('click', () => sendGateCommand('OPEN'));
    elements.btnCloseGate.addEventListener('click', () => sendGateCommand('CLOSE'));
    
    elements.btnClearLog.addEventListener('click', clearActivityLog);

    // Accordion Toggle for Technical Specifications
    elements.specHeaderToggle.addEventListener('click', () => {
      elements.specCard.classList.toggle('collapsed');
    });
  }

  // =========================================================================
  // WEB BLUETOOTH API CONNECTION LOGIC
  // =========================================================================
  async function connectESP32() {
    if (!navigator.bluetooth) {
      showToast('Web Bluetooth is not supported in this browser.', 'error');
      return;
    }

    try {
      console.log('Requesting Bluetooth Device...');
      showToast('Scanning for Smart_Parking_ESP32...', 'info');

      // Request device with device name filter or service UUID filter
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { name: BLE_CONFIG.DEVICE_NAME },
          { services: [BLE_CONFIG.SERVICE_UUID] }
        ],
        optionalServices: [BLE_CONFIG.SERVICE_UUID]
      });

      console.log(`Device selected: ${bluetoothDevice.name}`);
      
      // Listen for unexpected disconnection event
      bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

      // Connect to GATT Server
      console.log('Connecting to GATT Server...');
      gattServer = await bluetoothDevice.gatt.connect();
      console.log('Connected to GATT Server');

      // Get Primary Service
      console.log(`Getting Service: ${BLE_CONFIG.SERVICE_UUID}...`);
      const service = await gattServer.getPrimaryService(BLE_CONFIG.SERVICE_UUID);

      // Get Status Characteristic (READ/NOTIFY)
      console.log(`Getting Status Characteristic: ${BLE_CONFIG.STATUS_CHAR_UUID}...`);
      statusCharacteristic = await service.getCharacteristic(BLE_CONFIG.STATUS_CHAR_UUID);

      // Get Command Characteristic (WRITE)
      console.log(`Getting Command Characteristic: ${BLE_CONFIG.COMMAND_CHAR_UUID}...`);
      commandCharacteristic = await service.getCharacteristic(BLE_CONFIG.COMMAND_CHAR_UUID);

      // Start Notifications on Status Characteristic
      console.log('Starting Notifications on Status Characteristic...');
      await statusCharacteristic.startNotifications();
      statusCharacteristic.addEventListener('characteristicvaluechanged', handleStatusNotification);

      console.log('BLE Connection fully established and listening for updates!');
      isConnected = true;
      updateUIState(true);
      showToast('Successfully connected to ESP32 Smart Parking System!', 'success');

      // Read initial status if supported
      try {
        const initialValue = await statusCharacteristic.readValue();
        parseAndApplyData(initialValue);
      } catch (readErr) {
        console.log('Initial read skipped or not implemented on read value:', readErr);
      }

      // Request current status from ESP32
      await sendGateCommand('STATUS');

    } catch (error) {
      console.error('BLE Connection error:', error);
      isConnected = false;
      updateUIState(false);

      if (error.name === 'NotFoundError') {
        showToast('Bluetooth pairing cancelled or device not found.', 'info');
      } else {
        showToast(`Connection failed: ${error.message || error}`, 'error');
        elements.systemNotice.classList.remove('hidden');
        elements.noticeMessage.textContent = `Connection error: ${error.message || 'ESP32 connection failed'}. Make sure your ESP32 is powered on and advertising.`;
      }
    }
  }

  function disconnectESP32() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      console.log('Disconnecting from ESP32...');
      bluetoothDevice.gatt.disconnect();
    } else {
      onDisconnected();
    }
  }

  function onDisconnected(event) {
    console.warn('ESP32 GATT Server disconnected!');
    isConnected = false;
    gattServer = null;
    statusCharacteristic = null;
    commandCharacteristic = null;
    
    updateUIState(false);
    showToast('ESP32 disconnected. Please reconnect.', 'error');
    
    elements.systemNotice.classList.remove('hidden');
    elements.noticeMessage.textContent = 'ESP32 disconnected. Please click "CONNECT ESP32" to reconnect.';
  }

  // =========================================================================
  // DATA PARSING & NOTIFICATION HANDLING
  // =========================================================================
  function handleStatusNotification(event) {
    const value = event.target.value;
    parseAndApplyData(value);
  }

  function parseAndApplyData(dataView) {
    try {
      const decoder = new TextDecoder('utf-8');
      const jsonString = decoder.decode(dataView);
      console.log('Raw BLE Payload Received:', jsonString);

      const payload = JSON.parse(jsonString);
      updateDashboardData(payload);
    } catch (err) {
      console.error('Failed to parse incoming ESP32 JSON payload:', err);
    }
  }

  function updateDashboardData(data) {
    /* Expected payload format:
       {
         "slot1": "AVAILABLE" | "OCCUPIED",
         "slot2": "AVAILABLE" | "OCCUPIED",
         "available": 1,
         "total": 2,
         "gate": "OPEN" | "CLOSED"
       }
    */
    const slot1 = (data.slot1 || 'AVAILABLE').toUpperCase();
    const slot2 = (data.slot2 || 'AVAILABLE').toUpperCase();
    const gate = (data.gate || 'CLOSED').toUpperCase();
    const total = data.total !== undefined ? data.total : 2;
    
    // Calculate available slots safely
    let available = data.available;
    if (available === undefined) {
      available = (slot1 === 'AVAILABLE' ? 1 : 0) + (slot2 === 'AVAILABLE' ? 1 : 0);
    }
    const occupied = total - available;

    // 1. Update Summary Cards
    elements.valTotalSlots.textContent = total;
    elements.valAvailableSlots.textContent = available;
    elements.valOccupiedSlots.textContent = occupied;
    
    elements.valGateStatus.textContent = gate;
    elements.valGateStatus.className = `card-value ${gate === 'OPEN' ? 'text-green' : 'text-red'}`;

    // 2. Update Slot 1 UI
    updateSlotUI(1, slot1);

    // 3. Update Slot 2 UI
    updateSlotUI(2, slot2);

    // 4. Update Gate UI
    updateGateUI(gate);

    // 5. Update Parking Banner Status
    if (available === 0) {
      elements.parkingBanner.className = 'parking-banner banner-full';
      elements.bannerTitle.textContent = 'PARKING FULL';
      elements.bannerSubtitle.textContent = 'Both parking slots are currently occupied. Gate is CLOSED.';
    } else {
      elements.parkingBanner.className = 'parking-banner banner-available';
      elements.bannerTitle.textContent = 'Parking Spaces Available';
      elements.bannerSubtitle.textContent = `${available} parking ${available === 1 ? 'slot' : 'slots'} available`;
    }

    // 6. Log Events if state changed
    detectAndLogChanges(slot1, slot2, gate);
  }

  function updateSlotUI(slotNumber, status) {
    const isAvailable = status === 'AVAILABLE';
    const cardEl = slotNumber === 1 ? elements.slotCard1 : elements.slotCard2;
    const pillEl = slotNumber === 1 ? elements.slot1Pill : elements.slot2Pill;
    const labelEl = slotNumber === 1 ? elements.slot1CarLabel : elements.slot2CarLabel;
    
    const vizBoxEl = slotNumber === 1 ? elements.vizSlot1 : elements.vizSlot2;
    const vizTextEl = slotNumber === 1 ? elements.vizSlot1Text : elements.vizSlot2Text;

    if (isAvailable) {
      cardEl.className = 'card slot-card available';
      pillEl.className = 'slot-status-pill available';
      pillEl.textContent = 'AVAILABLE';
      labelEl.textContent = 'No Vehicle';

      vizBoxEl.className = 'slot-box available';
      vizTextEl.textContent = 'FREE';
    } else {
      cardEl.className = 'card slot-card occupied';
      pillEl.className = 'slot-status-pill occupied';
      pillEl.textContent = 'OCCUPIED';
      labelEl.textContent = 'Vehicle Present';

      vizBoxEl.className = 'slot-box occupied';
      vizTextEl.textContent = 'OCCUPIED';
    }
  }

  function updateGateUI(gateStatus) {
    const isOpen = gateStatus === 'OPEN';
    
    elements.gateBadgeDisplay.textContent = isOpen ? 'OPEN' : 'CLOSED';
    elements.gateBadgeDisplay.className = `gate-status-badge ${isOpen ? 'open' : 'closed'}`;

    if (isOpen) {
      elements.vizGateArm.className = 'gate-arm open';
      elements.vizGateArm.querySelector('.gate-arm-label').textContent = 'GATE OPEN';
    } else {
      elements.vizGateArm.className = 'gate-arm closed';
      elements.vizGateArm.querySelector('.gate-arm-label').textContent = 'GATE CLOSED';
    }
  }

  // =========================================================================
  // SEND COMMANDS TO ESP32
  // =========================================================================
  async function sendGateCommand(command) {
    if (!isConnected || !commandCharacteristic) {
      showToast('ESP32 is not connected. Connect first to control gate.', 'error');
      return;
    }

    try {
      console.log(`Sending command to ESP32: "${command}"`);
      const encoder = new TextEncoder('utf-8');
      const data = encoder.encode(command);
      
      await commandCharacteristic.writeValue(data);
      showToast(`Command "${command}" sent to ESP32.`, 'info');
    } catch (err) {
      console.error(`Failed to send command "${command}":`, err);
      showToast(`Failed to send command "${command}".`, 'error');
    }
  }

  // =========================================================================
  // UI STATE MANAGEMENT
  // =========================================================================
  function updateUIState(connected) {
    if (connected) {
      // Buttons
      elements.btnConnect.classList.add('hidden');
      elements.btnDisconnect.classList.remove('hidden');
      elements.btnOpenGate.disabled = false;
      elements.btnCloseGate.disabled = false;

      // Status Badges
      elements.connectionBadge.className = 'connection-badge connected';
      elements.connectionText.textContent = 'Connected';

      elements.liveIndicator.className = 'live-indicator live';
      elements.liveText.textContent = '● LIVE';

      elements.systemNotice.classList.add('hidden');
    } else {
      // Buttons
      elements.btnConnect.classList.remove('hidden');
      elements.btnDisconnect.classList.add('hidden');
      elements.btnOpenGate.disabled = true;
      elements.btnCloseGate.disabled = true;

      // Status Badges
      elements.connectionBadge.className = 'connection-badge disconnected';
      elements.connectionText.textContent = 'Disconnected';

      elements.liveIndicator.className = 'live-indicator disconnected';
      elements.liveText.textContent = '● DISCONNECTED';

      // Reset dynamic numbers to default placeholders
      elements.valAvailableSlots.textContent = '--';
      elements.valOccupiedSlots.textContent = '--';
      elements.valGateStatus.textContent = '--';
      elements.valGateStatus.className = 'card-value';
    }
  }

  // =========================================================================
  // ACTIVITY LOG & SYSTEM EVENTS
  // =========================================================================
  function detectAndLogChanges(slot1, slot2, gate) {
    const timeStr = new Date().toLocaleTimeString();

    if (lastKnownState.slot1 !== null && lastKnownState.slot1 !== slot1) {
      addLogEntry(timeStr, 'Slot 1', slot1, slot1 === 'OCCUPIED' ? 'Vehicle Entered' : 'Vehicle Departed');
    }
    if (lastKnownState.slot2 !== null && lastKnownState.slot2 !== slot2) {
      addLogEntry(timeStr, 'Slot 2', slot2, slot2 === 'OCCUPIED' ? 'Vehicle Entered' : 'Vehicle Departed');
    }
    if (lastKnownState.gate !== null && lastKnownState.gate !== gate) {
      addLogEntry(timeStr, 'Gate', gate, gate === 'OPEN' ? 'Servo Gate Raised' : 'Servo Gate Lowered');
    }

    // Initial state logging
    if (lastKnownState.slot1 === null) {
      addLogEntry(timeStr, 'System Sync', 'CONNECTED', 'Initial ESP32 State Received');
    }

    // Store state
    lastKnownState.slot1 = slot1;
    lastKnownState.slot2 = slot2;
    lastKnownState.gate = gate;
  }

  function addLogEntry(time, source, payload, impact) {
    const entry = { time, source, payload, impact };
    activityLogs.unshift(entry);

    if (activityLogs.length > MAX_LOGS) {
      activityLogs.pop();
    }

    renderActivityTable();
  }

  function renderActivityTable() {
    if (activityLogs.length === 0) {
      elements.activityLogBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="4">No BLE events recorded yet. Connect ESP32 to receive real-time data logs.</td>
        </tr>
      `;
      return;
    }

    elements.activityLogBody.innerHTML = activityLogs.map(log => {
      let badgeClass = 'available';
      if (log.payload === 'OCCUPIED' || log.payload === 'CLOSED') {
        badgeClass = 'occupied';
      }
      
      return `
        <tr>
          <td><strong>${log.time}</strong></td>
          <td>${log.source}</td>
          <td><span class="slot-status-pill ${badgeClass}" style="padding: 2px 10px; font-size: 0.75rem;">${log.payload}</span></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${log.impact}</td>
        </tr>
      `;
    }).join('');
  }

  function clearActivityLog() {
    activityLogs = [];
    renderActivityTable();
    showToast('Activity log cleared.', 'info');
  }

  // =========================================================================
  // TOAST NOTIFICATIONS SYSTEM
  // =========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Start Application
  init();

});
