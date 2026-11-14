/**
 * ResQ Web Audio API Emergency Alarm Synthesizer
 * Generates local synthesized sirens directly on the operator's laptop.
 * Zero external audio file dependencies. Handles browser autoplay restrictions gracefully.
 */

class AudioAlarmService {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.currentLoopInterval = null;
    this.activePattern = null;
    this.isPlaying = false;
    this.isMuted = typeof window !== 'undefined' ? localStorage.getItem('resq_alarm_muted') === 'true' : false;
    this.isUnlocked = false;
  }

  /**
   * Initialize or resume the Web Audio context upon user gesture
   */
  init() {
    if (typeof window === 'undefined') return false;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isUnlocked = Boolean(this.audioCtx && this.audioCtx.state === 'running');
    return this.isUnlocked;
  }

  /**
   * Toggle mute state and persist preference in localStorage
   */
  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (typeof window !== 'undefined') {
      localStorage.setItem('resq_alarm_muted', String(this.isMuted));
    }
    if (this.masterGain && this.audioCtx) {
      const targetGain = this.isMuted ? 0 : 0.35;
      this.masterGain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    }
  }

  /**
   * Synthesize Fire Siren: Rapid alternating high-low dual-frequency siren (880Hz / 660Hz)
   */
  playFireTone(durationMs = 1200) {
    if (!this.init() || this.isMuted) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.2);
      osc.frequency.setValueAtTime(880, now + 0.4);
      osc.frequency.setValueAtTime(660, now + 0.6);
      osc.frequency.setValueAtTime(880, now + 0.8);
      osc.frequency.setValueAtTime(660, now + 1.0);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + (durationMs / 1000));
    } catch (e) {
      console.warn('Audio synthesis notice:', e.message);
    }
  }

  /**
   * Synthesize Hazardous Gas Alert: Double-beep warning chime (540Hz)
   */
  playGasTone(durationMs = 900) {
    if (!this.init() || this.isMuted) return;
    try {
      const now = this.audioCtx.currentTime;
      
      // Beep 1
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(540, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Beep 2
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(540, now + 0.22);
      gain2.gain.setValueAtTime(0.35, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0.01, now + 0.37);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.37);
    } catch (e) {
      console.warn('Audio synthesis notice:', e.message);
    }
  }

  /**
   * Synthesize Building Tilt Alert: Descending slide frequency alert (700Hz -> 380Hz)
   */
  playTiltTone(durationMs = 800) {
    if (!this.init() || this.isMuted) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.6);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio synthesis notice:', e.message);
    }
  }

  /**
   * Synthesize Earthquake Alert: Low-frequency seismic rumble & pulse (95Hz - 140Hz sawtooth)
   */
  playEarthquakeTone(durationMs = 1200) {
    if (!this.init() || this.isMuted) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.5);
      osc.frequency.linearRampToValueAtTime(85, now + 1.0);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 1.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.1);
    } catch (e) {
      console.warn('Audio synthesis notice:', e.message);
    }
  }

  /**
   * Start continuous alarm loop for a specific active hazard
   */
  startAlarm(hazardType = 'fire') {
    this.activePattern = hazardType;
    this.isPlaying = true;

    if (this.currentLoopInterval) {
      clearInterval(this.currentLoopInterval);
    }

    const playPattern = () => {
      switch (this.activePattern) {
        case 'fire':
          this.playFireTone();
          break;
        case 'gas':
          this.playGasTone();
          break;
        case 'tilt':
          this.playTiltTone();
          break;
        case 'earthquake':
          this.playEarthquakeTone();
          break;
        default:
          this.playFireTone();
      }
    };

    playPattern();
    this.currentLoopInterval = setInterval(playPattern, 1500);
  }

  /**
   * Stop active continuous alarm
   */
  stopAlarm() {
    this.isPlaying = false;
    this.activePattern = null;
    if (this.currentLoopInterval) {
      clearInterval(this.currentLoopInterval);
      this.currentLoopInterval = null;
    }
  }

  /**
   * Preview test alarm for 3.2 seconds
   */
  testAlarm(hazardType = 'fire') {
    this.init();
    if (this.isMuted) {
      this.setMuted(false);
    }
    this.startAlarm(hazardType);
    setTimeout(() => {
      this.stopAlarm();
    }, 3200);
  }
}

const audioAlarmService = new AudioAlarmService();
export default audioAlarmService;
