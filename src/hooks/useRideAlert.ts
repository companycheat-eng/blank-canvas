import { useEffect, useRef, useCallback } from "react";

/**
 * Plays a repeating alert sound (like Uber/99) when there are available rides.
 * Stops when rides are empty or user interacts (accepts/refuses/selects).
 */
export function useRideAlert(hasRides: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);

  const playTone = useCallback(() => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      // Two-tone alert (like ride-hailing apps)
      const now = ctx.currentTime;
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Pattern: beep-beep, pause, beep-beep
      playBeep(880, now, 0.15);
      playBeep(1100, now + 0.2, 0.15);
      playBeep(880, now + 0.5, 0.15);
      playBeep(1100, now + 0.7, 0.15);
    } catch (e) {
      // AudioContext may not be available
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  useEffect(() => {
    if (hasRides && !isPlayingRef.current) {
      isPlayingRef.current = true;
      playTone(); // Immediate first play
      intervalRef.current = setInterval(playTone, 3000); // Repeat every 3s
    } else if (!hasRides) {
      stop();
    }

    return () => stop();
  }, [hasRides, playTone, stop]);

  return { stopAlert: stop };
}
