let audioCtx: AudioContext | null = null;

async function ensureAudioContext(): Promise<AudioContext> {
  if (!audioCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
  return audioCtx;
}

async function playTone(frequency: number, durationMs: number, volume = 0.2, type: OscillatorType = "sine"): Promise<void> {
  const ctx = await ensureAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  // Quick fade-in to avoid click
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  // Fade-out at end
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export async function beepStart(): Promise<void> {
  // Two quick beeps: higher then higher-high to signal start
  await playTone(880, 120, 0.22, "sine");
  // small pause then second tone
  await new Promise((r) => setTimeout(r, 60));
  await playTone(1200, 120, 0.22, "sine");
}

export async function beepStop(): Promise<void> {
  // Single lower beep to signal stop
  await playTone(440, 200, 0.22, "sine");
}