/**
 * ResQ IoT Emergency Platform — Telegram Notification Service
 * Official Telegram Bot API Integration
 * 
 * Features:
 * - Real-time emergency hazard notifications (Fire, Gas, Tilt, Earthquake)
 * - Automatic recovery notifications when hazards clear
 * - Anti-flood cooldown & hazard state transition tracking
 * - Safe error handling (never crashes sensor ingestion pipeline)
 * - Zero token exposure in logs or API responses
 */

// In-memory hazard state tracker to handle state transitions & cooldowns
// Key: `${deviceId}:${hazardType}` -> { isActive: boolean, lastNotifiedAt: number, lastValue: any }
const hazardStateMap = new Map();

// Cooldown between repeated notifications for an ongoing UNRESOLVED hazard (5 minutes)
const HAZARD_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Get configured Telegram Bot credentials from environment
 */
const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : '';
  const chatId = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.trim() : '';
  return {
    token,
    chatId,
    isConfigured: Boolean(token && chatId),
  };
};

/**
 * Send a raw Markdown message via Telegram Bot API
 * Safe: catches all errors and never leaks the bot token
 */
const sendTelegramMessage = async (text) => {
  const { token, chatId, isConfigured } = getTelegramConfig();

  if (!isConfigured) {
    console.warn('⚠️ Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in environment.');
    return { success: false, reason: 'TELEGRAM_NOT_CONFIGURED' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Telegram emergency notification delivered successfully to Chat ID:', chatId);
      return { success: true, messageId: data.result?.message_id };
    } else {
      console.error('❌ Telegram API error response:', data.description || 'Unknown error');
      return { success: false, reason: data.description };
    }
  } catch (error) {
    console.error('❌ Telegram delivery network error:', error.message);
    return { success: false, reason: error.message };
  }
};

/**
 * Evaluate active hazards for a device and dispatch Telegram emergency / recovery alerts
 * 
 * @param {string} deviceId - E.g. "RESQ-NODE-01"
 * @param {Object} hazards - { fire: boolean, gas: boolean, tilt: boolean, earthquake: boolean }
 * @param {Object} readings - { gasPpm, flame, tiltAngle, vibration, distance, temperature }
 */
const evaluateAndNotifyHazards = async (deviceId, hazards, readings = {}) => {
  if (!deviceId) return;

  const devId = String(deviceId).toUpperCase();
  const now = Date.now();
  const timeString = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const hazardDefinitions = [
    {
      type: 'FIRE',
      isActive: Boolean(hazards.fire),
      severity: 'CRITICAL',
      emoji: '🔥',
      title: 'FIRE / OPTICAL FLAME DETECTED',
      readingText: readings.flame ? 'Optical IR Flame Radiation: DETECTED' : `Ambient Temp: ${readings.temperature ?? 'N/A'} °C`,
      actionText: '⚡ Immediate evacuation and fire suppression dispatch recommended!',
    },
    {
      type: 'GAS',
      isActive: Boolean(hazards.gas),
      severity: 'CRITICAL',
      emoji: '💨',
      title: 'HAZARDOUS COMBUSTIBLE GAS LEAK',
      readingText: `MQ-2 Concentration: ${readings.gasPpm ?? 'N/A'} PPM (Threshold: > 200 PPM)`,
      actionText: '⚡ Activate ventilation exhaust and inspect chemical/gas valves immediately!',
    },
    {
      type: 'TILT',
      isActive: Boolean(hazards.tilt),
      severity: 'CRITICAL',
      emoji: '📐',
      title: 'STRUCTURAL BUILDING TILT DETECTED',
      readingText: `MPU6050 Relative Tilt Angle: ${readings.tiltAngle ?? 'N/A'}° (Threshold: > 15°)`,
      actionText: '⚡ Structural foundation compromise suspected. Building inspection required!',
    },
    {
      type: 'EARTHQUAKE',
      isActive: Boolean(hazards.earthquake),
      severity: 'CRITICAL',
      emoji: '⚠️',
      title: 'SEISMIC SHOCK / ABNORMAL VIBRATION',
      readingText: `Dynamic Vibration: ${readings.vibration ?? 'N/A'} g (Threshold: > 0.40g)`,
      actionText: '⚡ High seismic shock registered. Take cover under structural supports!',
    },
  ];

  for (const h of hazardDefinitions) {
    const stateKey = `${devId}:${h.type}`;
    const currentState = hazardStateMap.get(stateKey) || { isActive: false, lastNotifiedAt: 0 };

    if (h.isActive) {
      // Condition 1: Hazard just became active OR cooldown expired for ongoing hazard
      const isNewTrigger = !currentState.isActive;
      const cooldownExpired = (now - currentState.lastNotifiedAt) >= HAZARD_COOLDOWN_MS;

      if (isNewTrigger || cooldownExpired) {
        hazardStateMap.set(stateKey, {
          isActive: true,
          lastNotifiedAt: now,
          readingSummary: h.readingText,
        });

        const alertMessage = [
          `🚨 *RESQ EMERGENCY HAZARD ALERT* 🚨`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `*Hazard:* ${h.emoji} *${h.title}*`,
          `*Device ID:* \`${devId}\``,
          `*Severity:* ${h.severity}`,
          `*Sensor Reading:* ${h.readingText}`,
          `*Time:* \`${timeString}\``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          h.actionText,
          `🔗 [Open Live Emergency Dashboard](https://resq-8tbc.onrender.com)`,
        ].join('\n');

        // Deliver notification asynchronously without blocking ingestion
        sendTelegramMessage(alertMessage);
      }
    } else if (currentState.isActive) {
      // Condition 2: Hazard WAS active and is NOW cleared -> Send Recovery Notice!
      hazardStateMap.set(stateKey, {
        isActive: false,
        lastNotifiedAt: now,
        readingSummary: 'CLEARED',
      });

      const recoveryMessage = [
        `✅ *RESQ HAZARD RESOLVED* ✅`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `*Status:* 🟢 ALL CLEAR & SAFE`,
        `*Resolved Hazard:* ${h.emoji} ${h.type} on \`${devId}\``,
        `*Sensor Baseline:* Nominal Operating Limits Restored`,
        `*Time:* \`${timeString}\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Sensor readings have returned to normal safety levels.`,
      ].join('\n');

      sendTelegramMessage(recoveryMessage);
    }
  }
};

/**
 * Send a verification ping to confirm Telegram bot credentials
 */
const sendTestNotification = async (operator = 'Administrator') => {
  const { isConfigured, chatId } = getTelegramConfig();

  if (!isConfigured) {
    return {
      success: false,
      message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in environment variables.',
    };
  }

  const timeString = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const testMessage = [
    `🧪 *RESQ TELEGRAM BOT CONNECTIVITY TEST* 🧪`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*Status:* 🟢 Bot Connection Active & Verified`,
    `*Triggered By:* \`${operator}\``,
    `*Chat ID:* \`${chatId}\``,
    `*Timestamp:* \`${timeString}\``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Your ResQ emergency notification bot is operational and ready to transmit real-time alerts for Fire, Gas, Tilt, and Seismic hazards.`,
  ].join('\n');

  return await sendTelegramMessage(testMessage);
};

module.exports = {
  getTelegramConfig,
  sendTelegramMessage,
  evaluateAndNotifyHazards,
  sendTestNotification,
};
