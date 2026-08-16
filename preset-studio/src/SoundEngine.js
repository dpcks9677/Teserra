class SoundEngine {
  constructor() {
    this.bgmAudio = null;
    this.sfxAudios = {};
    this.isBgmPlaying = false;
    this.isDucked = false;
    this.fadeInterval = null;

    const getUrl = (filename) => {
      try {
        const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './';
        const cleanBase = base.endsWith('/') ? base : base + '/';
        return new URL(`${cleanBase}sounds/${filename}`, window.location.href).href;
      } catch (e) {
        return `./sounds/${filename}`;
      }
    };

    this.bgmUrl = getUrl('roll_45.mp3');
    this.sfxUrls = {
      dice_roll: getUrl('dice_roll.mp3'),
      scoreboard: getUrl('scoreboard.mp3'),
      turn_change: getUrl('turn_change.mp3')
    };

    this.initBGM();
    this.preloadSFX();
  }

  initBGM() {
    if (this.bgmAudio) return;
    this.bgmAudio = new Audio(this.bgmUrl);
    this.bgmAudio.loop = false;
    this.bgmAudio.preload = 'auto';
    this.bgmAudio.volume = 1.0;
  }

  preloadSFX() {
    Object.entries(this.sfxUrls).forEach(([name, url]) => {
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.sfxAudios[name] = audio;
      } catch (e) {}
    });
  }

  ensureContext() {
    if (!this.bgmAudio) {
      this.initBGM();
    }
  }

  init() {
    this.initBGM();
  }

  startBGM(elapsedTime = 0.0, forceRestart = false) {
    if (!this.bgmAudio) this.initBGM();

    let t = Math.max(0, Math.min(47.9, elapsedTime));

    if (!forceRestart && this.isBgmPlaying && this.bgmAudio) {
      const currentT = this.bgmAudio.currentTime;
      if (Math.abs(currentT - t) < 0.8 && !this.bgmAudio.paused) {
        return;
      }
    }

    this.clearIntervals();
    this.bgmAudio.volume = 1.0;
    this.isDucked = false;

    try {
      this.bgmAudio.currentTime = t;
    } catch (e) {}

    const playPromise = this.bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isBgmPlaying = true;
      }).catch(err => {
        // A pending play is expected to reject with AbortError when a turn ends
        // or the timer pauses immediately afterward.
        if (err?.name !== 'AbortError') {
          console.warn('[SoundEngine] BGM play failed or blocked by autoplay policy:', err);
        }
      });
    }
  }

  stopBGM() {
    this.clearIntervals();
    this.isBgmPlaying = false;
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch (e) {}
    }
  }

  pauseBGM() {
    this.clearIntervals();
    this.isBgmPlaying = false;
    this.isDucked = false;
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
      } catch (e) {}
    }
  }

  duckBGM() {
    if (!this.bgmAudio || !this.isBgmPlaying) return;
    this.clearIntervals();
    this.isDucked = true;

    // 0.3초 동안 0.0(무음)으로 볼륨 감쇄
    const startVol = this.bgmAudio.volume;
    const targetVol = 0.0;
    const steps = 10;
    const stepTime = 30; // 300ms total
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      if (this.bgmAudio) {
        this.bgmAudio.volume = Math.max(0, startVol + (targetVol - startVol) * progress);
      }
      if (currentStep >= steps) {
        if (this.bgmAudio) this.bgmAudio.volume = targetVol;
        this.clearIntervals();
      }
    }, stepTime);
  }

  restoreBGM(exactElapsedTime = null) {
    if (!this.bgmAudio) this.initBGM();
    this.clearIntervals();

    if (exactElapsedTime !== null && exactElapsedTime !== undefined) {
      try {
        const t = Math.max(0, Math.min(47.9, exactElapsedTime));
        if (Math.abs(this.bgmAudio.currentTime - t) > 0.8) {
          this.bgmAudio.currentTime = t;
        }
      } catch (e) {}
    }

    if (this.bgmAudio.paused) {
      this.bgmAudio.play().catch(e => console.warn(e));
    }

    // 0.0(무음)에서 시작하여 3.0초 동안 1.0(100%)까지 서서히 페이드인
    this.bgmAudio.volume = 0.0;
    this.isDucked = false;
    this.isBgmPlaying = true;

    const startVol = 0.0;
    const targetVol = 1.0;
    const steps = 30;
    const stepTime = 100; // 3000ms (3초) total
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      if (this.bgmAudio) {
        this.bgmAudio.volume = Math.min(1.0, startVol + (targetVol - startVol) * progress);
      }
      if (currentStep >= steps) {
        if (this.bgmAudio) this.bgmAudio.volume = targetVol;
        this.clearIntervals();
      }
    }, stepTime);
  }

  clearIntervals() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  playSFX(name, volume = 1.0) {
    const url = this.sfxUrls[name];
    if (!url) return;

    try {
      const sfx = new Audio(url);
      sfx.volume = volume;
      sfx.play().catch(err => console.warn('[SoundEngine] SFX play blocked:', err));
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
