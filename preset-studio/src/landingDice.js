import { DiceEngine } from './DiceEngine.js';

let engine = null;

export function silenceLandingDice() {
  engine?.setSoundEnabled(false);
}

export function resumeLandingDice() {
  if (!engine) return;
  engine.setSoundEnabled(true);
  setTimeout(() => engine?.roll(5), 100);
}

setTimeout(async () => {
  const wrapper = document.getElementById('landing-dice-wrapper');
  if (!wrapper) return;
  engine = new DiceEngine('#landing-dice-wrapper');
  engine.soundEnabled = false;
  await engine.ready;
  requestAnimationFrame(() => wrapper.classList.add('loaded'));
  setTimeout(() => {
    if (engine?.isReady && !engine.physicsActive) engine.roll(5);
  }, 800);
  wrapper.addEventListener('click', () => {
    if (engine?.isReady && !engine.physicsActive) engine.roll(5);
  });
}, 500);
