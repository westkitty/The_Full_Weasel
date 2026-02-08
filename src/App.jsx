import { useEffect, useMemo, useRef, useState, useCallback } from "react";

// ============================================
// PHASE CONSTANTS
// ============================================
const PHASE_TITLE = "Phase_Title";
const PHASE_HOWTO = "Phase_HowTo";
const PHASE_READY = "Phase_Ready";
const PHASE_RHYTHM = "Phase_Rhythm";
const PHASE_INTERSTITIAL = "Phase_Interstitial";
const PHASE_STRIP = "Phase_Strip";
const PHASE_VICTORY = "Phase_Victory";
const PHASE_END = "Phase_End";

// ============================================
// GAME CONSTANTS
// ============================================
const LANE_X = { left: 22, center: 50, right: 78 };
const PLAYER_X = { left: 28, center: 50, right: 72 };

// Timing constants
const BEAT_MS = 650;
const MAX_DELTA_MS = 100;
const HIT_REACTION_MS = 260;

// Round configuration - each round gets faster
const ROUND_CONFIG = [
  { round: 1, fallMs: 2800, spawnMultiplier: 1.0, sharkSpeed: 25, duration: 25000 },
  { round: 2, fallMs: 2400, spawnMultiplier: 1.15, sharkSpeed: 30, duration: 25000 },
  { round: 3, fallMs: 2100, spawnMultiplier: 1.25, sharkSpeed: 35, duration: 30000 },
];

// Jump mechanics
const JUMP_DURATION_MS = 500;
const JUMP_HEIGHT_VH = 18;

// Strip phase thresholds (tap counts to remove each item)
const STRIP_THRESHOLDS = [20, 45, 75];
const STRIP_STAGES = ["hat", "sweater", "bowtie"];

// Auto-collect zone (percentage from top where items are collected)
const COLLECT_ZONE_TOP = 68;
const COLLECT_ZONE_BOTTOM = 85;

// Horizontal shark settings
const SHARK_Y_POSITION = 75; // percentage from top where sharks swim

// ============================================
// RANDOM MOVIE QUOTES (Jaws + Full Monty parodies)
// ============================================
const INTERSTITIAL_QUOTES = [
  "We're gonna need a bigger dance floor.",
  "Just when you thought it was safe to eat cheese...",
  "You've got some Cheddar on you.",
  "This is a right good knees-up!",
  "Smile, you son of a birthday boy!",
  "The Full Weasel... it's all or nothing now.",
  "Farewell and adieu to my sensible sweater...",
  "Here's to swimmin' with bow-legged ferrets!",
];

// ============================================
// FEEDBACK LINES
// ============================================
const SUCCESS_LINES = ["Birthday legend!", "Party animal!", "Hot stuff!", "Cheesy goodness!", "Refreshing!"];
const DODGE_LINES = ["Nice jump!", "Shark dodged!", "Too slow, Jaws!", "Airborne!", "Smooth moves!"];
const SHARK_HIT_LINES = [
  "We're gonna need a bigger boat.",
  "That one got ya!",
  "Ouch! Shark attack!",
];

// ============================================
// FALLBACK MANIFEST
// ============================================
const FALLBACK_MANIFEST = {
  sprites: [
    { role: "dance_clean_01", url: "/assets/sprites/dance/dexter_dance_01.png" },
    { role: "dance_clean_02", url: "/assets/sprites/dance/dexter_dance_02.png" },
    { role: "dance_clean_03", url: "/assets/sprites/dance/dexter_dance_03.png" },
    { role: "title_screen", url: "/assets/sprites/ui/Title_Screen.png" },
  ],
  backgrounds: { mp4: [], pngFallback: [] },
  music: [],
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const choice = (items) => items[Math.floor(Math.random() * items.length)];

function makeIdFactory() {
  let nextId = 1;
  return () => nextId++;
}

function pickRandomIndex(length, exclude = -1) {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  while (index === exclude) {
    index = Math.floor(Math.random() * length);
  }
  return index;
}

// ============================================
// MAIN APP COMPONENT
// ============================================
function App() {
  // ============================================
  // REFS (mutable state for performance-critical game loop)
  // ============================================
  const idRef = useRef(makeIdFactory());
  const nextBeatRef = useRef(0);
  const beatCountRef = useRef(0);
  const manifestRef = useRef(FALLBACK_MANIFEST);
  const itemsRef = useRef([]);
  const sharksRef = useRef([]);
  const clockRef = useRef(0);
  const lastTickRef = useRef(performance.now());
  const roundStartRef = useRef(0);
  const musicRef = useRef({
    players: null,
    activePlayer: "a",
    currentIndex: -1,
    nextIndex: -1,
    started: false,
    transitioning: false,
    crossfadeEnabled: false,
    context: null,
  });

  // ============================================
  // STATE
  // ============================================
  const [manifest, setManifest] = useState(FALLBACK_MANIFEST);
  const [phase, setPhase] = useState(PHASE_TITLE);
  const [clockMs, setClockMs] = useState(0);
  const [partyMeter, setPartyMeter] = useState(0);
  const [feedback, setFeedback] = useState("Welcome to The Full Weasel!");
  const [items, setItems] = useState([]);
  const [sharks, setSharks] = useState([]);
  const [hitReactionAt, setHitReactionAt] = useState(null);
  const [shakeUntil, setShakeUntil] = useState(0);
  const [playerLane, setPlayerLane] = useState("center");
  const [playerX, setPlayerX] = useState(PLAYER_X.center);
  const [perfectPops, setPerfectPops] = useState([]);
  const [sparkles, setSparkles] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const [showOfflineMediaHint, setShowOfflineMediaHint] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState("loading");
  const [activeVideo, setActiveVideo] = useState("");
  const [pngIndex, setPngIndex] = useState(0);
  const [pngPrevIndex, setPngPrevIndex] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hitParticles, setHitParticles] = useState([]);
  const [meterBump, setMeterBump] = useState(false);
  const [beatPulse, setBeatPulse] = useState(false);

  // Round system state
  const [currentRound, setCurrentRound] = useState(1);
  const [interstitialQuote, setInterstitialQuote] = useState("");

  // Jump state
  const [isJumping, setIsJumping] = useState(false);
  const [jumpStartTime, setJumpStartTime] = useState(0);

  // Strip phase state
  const [stripTapPower, setStripTapPower] = useState(0);
  const [stripStage, setStripStage] = useState(0); // 0=clothed, 1=no hat, 2=no sweater, 3=no bowtie
  const [stripZoom, setStripZoom] = useState(1.0);
  const [costumeVisible, setCostumeVisible] = useState({ hat: true, sweater: true, bowtie: true });
  const [flyingCostume, setFlyingCostume] = useState(null);

  // Victory/End state
  const [victoryZoom, setVictoryZoom] = useState(1.0);
  const [showSlam, setShowSlam] = useState(false);
  const [hatDropped, setHatDropped] = useState(false);
  const [hatDropY, setHatDropY] = useState(-50);

  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [lastAction, setLastAction] = useState({ lane: null, time: 0, result: "none" });

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const roundConfig = ROUND_CONFIG[currentRound - 1] || ROUND_CONFIG[0];
  const isShaking = clockMs < shakeUntil;

  // Build role map from manifest
  const roleMap = useMemo(() => {
    const map = new Map();
    for (const entry of manifest.sprites || []) {
      map.set(entry.role, entry.url);
    }
    return map;
  }, [manifest]);

  // Build sprite URLs object
  const sprite = useMemo(() => {
    const getRole = (role, fallback = "") => roleMap.get(role) || fallback;
    return {
      danceCleanFrames: [
        getRole("dance_clean_01", "/assets/sprites/dance/dexter_dance_01.png"),
        getRole("dance_clean_02", "/assets/sprites/dance/dexter_dance_02.png"),
        getRole("dance_clean_03", "/assets/sprites/dance/dexter_dance_03.png"),
      ].filter(Boolean),
      hitFrames: [
        getRole("hit_react_01", "/assets/sprites/hit/dex_hit_react_01.png"),
        getRole("hit_react_02", "/assets/sprites/hit/dex_hit_react_02.png"),
        getRole("hit_react_03", "/assets/sprites/hit/dex_hit_react_03.png"),
      ],
      perfectPop: getRole("perfect_pop", "/assets/sprites/ui/dex_perfect_pop.png"),
      shadowBlob: getRole("shadow_blob", "/assets/sprites/ui/shadow_blob.png"),
      spotlight: getRole("spotlight_vignette", "/assets/sprites/ui/spotlight_vignette.png"),
      censorSlam: getRole("censor_slam", "/assets/sprites/ui/censor_slam.png"),
      sharkFin: getRole("hazard_shark_fin", "/assets/sprites/items/hazard_shark_fin.png"),
      nanaCheese: getRole("item_nana_cheese", "/assets/sprites/items/item_nana_cheese.png"),
      icedTea: getRole("item_unsweetened_iced_tea", "/assets/sprites/items/item_unsweetened_iced_tea.png"),
      titleScreen: getRole("title_screen", ""),
    };
  }, [roleMap]);

  const backgroundVideos = useMemo(
    () => (manifest.backgrounds?.mp4 || []).map((video) => video.url),
    [manifest]
  );
  const fallbackPngs = useMemo(
    () => (manifest.backgrounds?.pngFallback || []).map((frame) => frame.url),
    [manifest]
  );

  // Calculate jump Y offset based on parabolic arc
  const jumpProgress = isJumping ? clamp((clockMs - jumpStartTime) / JUMP_DURATION_MS, 0, 1) : 0;
  const jumpY = isJumping ? Math.sin(jumpProgress * Math.PI) * JUMP_HEIGHT_VH : 0;

  // ============================================
  // SYNC REFS WITH STATE (for synchronous access in event handlers)
  // ============================================
  useEffect(() => { manifestRef.current = manifest; }, [manifest]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { sharksRef.current = sharks; }, [sharks]);
  useEffect(() => { clockRef.current = clockMs; }, [clockMs]);

  // ============================================
  // PREVENT MOBILE GESTURES (zoom, refresh)
  // ============================================
  useEffect(() => {
    const preventGesture = (event) => event.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("dblclick", preventGesture, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("dblclick", preventGesture);
    };
  }, []);

  // ============================================
  // LOAD MANIFEST AND PRELOAD ASSETS
  // ============================================
  useEffect(() => {
    const loadManifest = async () => {
      try {
        setLoadingProgress(10);
        const response = await fetch("/assets/manifest.json", { cache: "no-store" });
        if (!response.ok) throw new Error("manifest fetch failed");
        setLoadingProgress(30);
        const data = await response.json();
        setManifest(data);
        setLoadingProgress(50);

        // Preload critical sprites
        const criticalImages = (data.sprites || []).slice(0, 8).map((s) => s.url).filter(Boolean);
        let loaded = 0;
        await Promise.all(
          criticalImages.map(
            (url) =>
              new Promise((resolve) => {
                const img = new Image();
                img.onload = img.onerror = () => {
                  loaded++;
                  setLoadingProgress(50 + Math.round((loaded / criticalImages.length) * 40));
                  resolve();
                };
                img.src = url;
              })
          )
        );

        setLoadingProgress(100);
        setTimeout(() => setAssetsLoaded(true), 300);
      } catch {
        setAssetsLoaded(true); // Continue with fallback
      }
    };
    loadManifest();
  }, []);

  // ============================================
  // DEBUG WINDOW HOOKS
  // ============================================
  useEffect(() => {
    window.advanceTime = (ms) => {
      const stepMs = Number(ms);
      if (!Number.isFinite(stepMs) || stepMs <= 0) return;
      setClockMs((current) => current + stepMs);
    };
    window.render_game_to_text = () => JSON.stringify({
      phase, clockMs, currentRound, partyMeter,
      playerLane, isJumping, jumpY,
      items: items.length, sharks: sharks.length,
      stripTapPower, stripStage, stripZoom,
      victoryZoom, hatDropped, feedback,
    });
    return () => {
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, [phase, clockMs, currentRound, partyMeter, playerLane, isJumping, jumpY, items.length, sharks.length, stripTapPower, stripStage, stripZoom, victoryZoom, hatDropped, feedback]);

  // ============================================
  // PLAYER LANE → X POSITION
  // ============================================
  useEffect(() => {
    setPlayerX(PLAYER_X[playerLane] ?? PLAYER_X.center);
  }, [playerLane]);

  // ============================================
  // GAME LOOP (fixed timestep via setInterval)
  // ============================================
  useEffect(() => {
    // Only run game loop during active phases
    if (phase === PHASE_TITLE || phase === PHASE_HOWTO || phase === PHASE_READY || 
        phase === PHASE_INTERSTITIAL || phase === PHASE_END) {
      return;
    }
    const tick = () => {
      const now = performance.now();
      const delta = Math.min(now - lastTickRef.current, MAX_DELTA_MS);
      lastTickRef.current = now;
      setClockMs((current) => current + delta);
    };
    const timer = window.setInterval(tick, 16); // ~60fps
    return () => window.clearInterval(timer);
  }, [phase]);

  // ============================================
  // JUMP COMPLETION CHECK
  // ============================================
  useEffect(() => {
    if (isJumping && jumpProgress >= 1) {
      setIsJumping(false);
    }
  }, [isJumping, jumpProgress]);

  // ============================================
  // BEAT PULSE VISUAL EFFECT
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;
    const beatProgress = (clockMs % BEAT_MS) / BEAT_MS;
    if (beatProgress < 0.1) {
      setBeatPulse(true);
    } else if (beatProgress > 0.3) {
      setBeatPulse(false);
    }
  }, [clockMs, phase]);

  // ============================================
  // CLEANUP VISUAL EFFECTS
  // ============================================
  useEffect(() => {
    setPerfectPops((current) => current.filter((entry) => clockMs - entry.spawnedAt < 360));
    setSparkles((current) => current.filter((entry) => clockMs - entry.spawnedAt < 900));
    setHitParticles((current) => current.filter((p) => clockMs - p.spawnedAt < 500));
  }, [clockMs]);

  useEffect(() => {
    if (hitReactionAt !== null && clockMs - hitReactionAt > HIT_REACTION_MS) {
      setHitReactionAt(null);
    }
  }, [clockMs, hitReactionAt]);

  // ============================================
  // ITEM SPAWNING (RHYTHM PHASE)
  // Alternates between cheese (left) and tea (right)
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    while (clockMs >= nextBeatRef.current) {
      const beat = beatCountRef.current;
      const spawnMs = nextBeatRef.current;
      const goodLane = beat % 2 === 0 ? "left" : "right";
      const goodSubtype = goodLane === "left" ? "cheese" : "tea";

      const spawned = [{
        id: idRef.current(),
        kind: "good",
        subtype: goodSubtype,
        lane: goodLane,
        spawnMs,
        resolved: false,
      }];

      setItems((current) => [...current, ...spawned]);
      beatCountRef.current += 1;
      nextBeatRef.current += BEAT_MS / roundConfig.spawnMultiplier;
    }
  }, [clockMs, phase, roundConfig.spawnMultiplier]);

  // ============================================
  // SHARK SPAWNING (HORIZONTAL)
  // Sharks swim across at Dexter's height
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    // Spawn shark every ~8 seconds, adjusted by round (rare, one at a time)
    const sharkInterval = 8000 / roundConfig.spawnMultiplier;
    const currentInterval = Math.floor(clockMs / sharkInterval);
    const prevInterval = Math.floor((clockMs - 33) / sharkInterval);
    const shouldSpawn = currentInterval > prevInterval;

    if (shouldSpawn && sharks.length < 1) {
      const fromLeft = Math.random() > 0.5;
      setSharks((current) => [
        ...current,
        {
          id: idRef.current(),
          spawnMs: clockMs,
          fromLeft,
          y: SHARK_Y_POSITION,
          resolved: false,
        },
      ]);
    }
  }, [clockMs, phase, sharks.length, roundConfig.spawnMultiplier]);

  // ============================================
  // AUTO-COLLECT LOGIC
  // Items automatically collected when Dexter is in the same lane
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    setItems((current) => {
      let collected = false;
      let collectedItem = null;

      const updated = current.map((item) => {
        if (item.resolved || item.kind !== "good") return item;

        const progress = (clockMs - item.spawnMs) / roundConfig.fallMs;
        const y = -15 + progress * 102;

        // Check if item is in collection zone AND player is in same lane
        if (y >= COLLECT_ZONE_TOP && y <= COLLECT_ZONE_BOTTOM && item.lane === playerLane) {
          collected = true;
          collectedItem = { ...item };
          return { ...item, resolved: true, resolvedAt: clockMs };
        }
        return item;
      });

      // Trigger collection effects (use setTimeout to avoid setState during render)
      if (collected && collectedItem) {
        setTimeout(() => {
          setPartyMeter((v) => clamp(v + 8, 0, 100));
          setFeedback(choice(SUCCESS_LINES));
          setLastAction({ lane: collectedItem.lane, time: clockMs, result: "collect" });
          triggerMeterBump();
          spawnHitParticles(LANE_X[collectedItem.lane], true);
          vibrate(40);
        }, 0);
      }

      return updated;
    });
  }, [clockMs, phase, playerLane, roundConfig.fallMs]);

  // ============================================
  // SHARK COLLISION DETECTION
  // Hit detection for horizontal sharks vs jumping player
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    setSharks((current) => {
      let sharkHit = false;
      let sharkDodged = false;

      const updated = current.map((shark) => {
        if (shark.resolved) return shark;

        const elapsed = clockMs - shark.spawnMs;
        const travelTime = 2500 / (roundConfig.sharkSpeed / 45);
        const progress = elapsed / travelTime;

        // Shark X position: travels from -10 to 110 or vice versa
        const sharkX = shark.fromLeft ? progress * 120 - 10 : 110 - progress * 120;

        // Remove shark if off screen
        if (sharkX < -20 || sharkX > 120) {
          return { ...shark, resolved: true };
        }

        // Check collision with Dexter (center of screen ±18% range)
        const dexterCenterX = playerX;
        const hitRange = 18;
        const inHitZone = Math.abs(sharkX - dexterCenterX) < hitRange;

        if (inHitZone && !shark.resolved) {
          if (isJumping) {
            // Successful dodge!
            sharkDodged = true;
            return { ...shark, resolved: true };
          } else {
            // Hit by shark
            sharkHit = true;
            return { ...shark, resolved: true };
          }
        }

        return shark;
      });

      // Apply dodge effects
      if (sharkDodged) {
        setTimeout(() => {
          setPartyMeter((v) => clamp(v + 5, 0, 100));
          setFeedback(choice(DODGE_LINES));
          setLastAction({ lane: "jump", time: clockMs, result: "dodge" });
          triggerMeterBump();
          vibrate(30);
        }, 0);
      }

      // Apply hit effects
      if (sharkHit) {
        setTimeout(() => {
          setFeedback(choice(SHARK_HIT_LINES));
          setPartyMeter((v) => clamp(v - 5, 0, 100));
          setHitReactionAt(clockMs);
          setShakeUntil(clockMs + HIT_REACTION_MS);
          setLastAction({ lane: "hit", time: clockMs, result: "sharkHit" });
          vibrate([100, 50, 100]);
        }, 0);
      }

      // Keep resolved sharks briefly for visual fade
      return updated.filter((s) => !s.resolved || clockMs - s.spawnMs < 500);
    });
  }, [clockMs, phase, playerX, isJumping, roundConfig.sharkSpeed]);

  // ============================================
  // ITEM CLEANUP (remove missed items)
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    setItems((current) => {
      return current.filter((item) => {
        const progress = (clockMs - item.spawnMs) / roundConfig.fallMs;
        if (item.resolved) {
          return progress < 1.3; // Keep briefly for visual
        }
        if (progress > 1.1) {
          // Missed item
          if (item.kind === "good") {
            setFeedback("Missed! Stay in lane!");
          }
          return false;
        }
        return true;
      });
    });
  }, [clockMs, phase, roundConfig.fallMs]);

  // ============================================
  // ROUND PROGRESSION
  // Check for round completion or party meter full
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_RHYTHM) return;

    const elapsed = clockMs - roundStartRef.current;

    // Check if party meter is full -> go to strip phase
    if (partyMeter >= 100) {
      setPhase(PHASE_STRIP);
      setItems([]);
      setSharks([]);
      setFeedback("THIS IS THE BEST BIRTHDAY EVER!");
      return;
    }

    // Check if round time elapsed
    if (elapsed >= roundConfig.duration) {
      if (currentRound < 3) {
        // Show interstitial quote between rounds
        setInterstitialQuote(choice(INTERSTITIAL_QUOTES));
        setPhase(PHASE_INTERSTITIAL);
      } else {
        // After round 3, if meter is at least 80%, trigger strip phase
        if (partyMeter >= 80) {
          setPartyMeter(100);
          setPhase(PHASE_STRIP);
          setItems([]);
          setSharks([]);
          setFeedback("THIS IS THE BEST BIRTHDAY EVER!");
        }
        // Otherwise keep playing until 100%
      }
    }
  }, [clockMs, phase, partyMeter, currentRound, roundConfig.duration]);

  // ============================================
  // STRIP PHASE ZOOM PROGRESSION
  // Zoom increases with tap power and strip stage
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_STRIP) return;

    // Base zoom increases with tap power
    const baseZoom = 1.05 + (stripTapPower / 100) * 0.3;
    // Additional zoom per stage
    const stageZoom = stripStage * 0.12;
    
    setStripZoom(clamp(baseZoom + stageZoom, 1.0, 1.6));
  }, [phase, stripTapPower, stripStage]);

  // ============================================
  // STRIP PHASE THRESHOLD CHECK
  // Remove costume pieces at tap thresholds
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_STRIP) return;

    for (let i = 0; i < STRIP_THRESHOLDS.length; i++) {
      if (stripTapPower >= STRIP_THRESHOLDS[i] && stripStage === i) {
        const costume = STRIP_STAGES[i];
        setFlyingCostume(costume);
        setCostumeVisible((prev) => ({ ...prev, [costume]: false }));
        setStripStage(i + 1);
        vibrate([50, 30, 50]);

        // Clear flying costume after animation
        setTimeout(() => setFlyingCostume(null), 800);

        // After final stage (bowtie), go to victory
        if (i === STRIP_THRESHOLDS.length - 1) {
          setTimeout(() => {
            setPhase(PHASE_VICTORY);
            setFeedback("HAPPY BIRTHDAY!");
          }, 600);
        }
        break;
      }
    }
  }, [phase, stripTapPower, stripStage]);

  // ============================================
  // VICTORY PHASE SETUP
  // Confetti, zoom, censor slam, hat drop
  // ============================================
  useEffect(() => {
    if (phase !== PHASE_VICTORY) return;

    // Generate confetti particles
    const generated = Array.from({ length: 72 }).map((_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 6 + Math.random() * 12,
      delay: Math.random() * 1200,
      duration: 2200 + Math.random() * 2600,
      hue: Math.round(Math.random() * 360),
    }));
    setConfetti(generated);

    // Zoom in for dramatic effect
    setVictoryZoom(1.35);
    
    // Show censor slam after brief delay
    setTimeout(() => setShowSlam(true), 400);

    // After censor slam, drop the birthday hat and transition to end
    setTimeout(() => {
      setHatDropped(true);
      // Animate hat falling with bounce
      let hatY = -50;
      let velocity = 0;
      const gravity = 2;
      const hatInterval = setInterval(() => {
        velocity += gravity;
        hatY += velocity;
        
        // Bounce when hitting target position
        if (hatY >= 25) {
          hatY = 25;
          velocity = -velocity * 0.4; // Bounce with damping
          if (Math.abs(velocity) < 2) {
            clearInterval(hatInterval);
            setHatDropY(25);
            // Transition to end screen after hat settles
            setTimeout(() => setPhase(PHASE_END), 1500);
            return;
          }
        }
        setHatDropY(hatY);
      }, 30);
    }, 2000);
  }, [phase]);

  // ============================================
  // BACKGROUND VIDEO/PNG HANDLING
  // ============================================
  useEffect(() => {
    let cancelled = false;

    const probeVideo = (url) =>
      new Promise((resolve) => {
        const video = document.createElement("video");
        let done = false;
        const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
        const timeout = window.setTimeout(() => finish(false), 2600);
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.addEventListener("canplaythrough", () => { clearTimeout(timeout); finish(true); });
        video.addEventListener("error", () => { clearTimeout(timeout); finish(false); });
        video.src = url;
        video.load();
      });

    const chooseBackground = async () => {
      if (backgroundVideos.length === 0) {
        setBackgroundMode("png");
        return;
      }
      for (const url of backgroundVideos) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeVideo(url);
        if (cancelled) return;
        if (ok) {
          setActiveVideo(url);
          setBackgroundMode("video");
          return;
        }
      }
      setBackgroundMode("png");
    };

    setBackgroundMode("loading");
    chooseBackground();
    return () => { cancelled = true; };
  }, [backgroundVideos]);

  useEffect(() => {
    if (backgroundMode !== "png" || fallbackPngs.length === 0) return;
    const timer = window.setInterval(() => {
      setPngIndex((current) => {
        setPngPrevIndex(current);
        return (current + 1) % fallbackPngs.length;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [backgroundMode, fallbackPngs.length]);

  useEffect(() => {
    const handleOffline = () => setShowOfflineMediaHint(true);
    const handleOnline = () => setShowOfflineMediaHint(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // ============================================
  // MUSIC HANDLING
  // ============================================
  const initializeAudioPlayers = () => {
    if (musicRef.current.players) return musicRef.current.players;
    const a = new Audio();
    const b = new Audio();
    a.preload = "auto";
    b.preload = "auto";
    a.loop = false;
    b.loop = false;
    a.playsInline = true;
    b.playsInline = true;
    a.volume = 1;
    b.volume = 1;
    musicRef.current.players = { a, b };
    return musicRef.current.players;
  };

  const startMusicIfNeeded = useCallback(async () => {
    const state = musicRef.current;
    if (state.started) return;
    const tracks = (manifestRef.current.music || []).map((track) => track.url);
    if (tracks.length === 0) return;

    const players = initializeAudioPlayers();
    state.started = true;
    state.activePlayer = "a";
    state.currentIndex = pickRandomIndex(tracks.length);

    const active = players.a;
    active.src = tracks[state.currentIndex];
    active.currentTime = 0;
    try {
      await active.play();
    } catch {
      state.started = false;
      setShowOfflineMediaHint(!navigator.onLine);
    }
  }, []);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const vibrate = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  const triggerMeterBump = () => {
    setMeterBump(true);
    setTimeout(() => setMeterBump(false), 200);
  };

  const spawnHitParticles = (x, success) => {
    const particles = Array.from({ length: success ? 8 : 4 }).map(() => ({
      id: idRef.current(),
      spawnedAt: clockRef.current,
      x: x + (Math.random() - 0.5) * 20,
      y: 78 + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 60,
      vy: -Math.random() * 40 - 20,
      hue: success ? 45 + Math.random() * 30 : 0,
      success,
    }));
    setHitParticles((current) => [...current, ...particles]);
  };

  const spawnSparkle = useCallback(() => {
    setSparkles((current) => [
      ...current,
      {
        id: idRef.current(),
        spawnedAt: clockRef.current,
        left: 32 + Math.random() * 36,
        top: 35 + Math.random() * 25,
      },
    ]);
  }, []);

  // ============================================
  // GAME FLOW FUNCTIONS
  // ============================================
  const goToHowTo = useCallback(() => {
    setPhase(PHASE_HOWTO);
  }, []);

  const goToReady = useCallback(() => {
    setPhase(PHASE_READY);
  }, []);

  const startGame = useCallback(() => {
    setClockMs(0);
    setPartyMeter(0);
    setItems([]);
    setSharks([]);
    setConfetti([]);
    setShowSlam(false);
    setHatDropped(false);
    setHatDropY(-50);
    setPlayerLane("center");
    setPlayerX(PLAYER_X.center);
    setIsJumping(false);
    setJumpStartTime(0);
    setCurrentRound(1);
    setStripTapPower(0);
    setStripStage(0);
    setStripZoom(1.0);
    setVictoryZoom(1.0);
    setCostumeVisible({ hat: true, sweater: true, bowtie: true });
    setFlyingCostume(null);
    setHitParticles([]);
    setLastAction({ lane: null, time: 0, result: "none" });
    beatCountRef.current = 0;
    nextBeatRef.current = 0;
    roundStartRef.current = 0;
    lastTickRef.current = performance.now();
    setFeedback("Tap LEFT or RIGHT to move!");
    setPhase(PHASE_RHYTHM);
    void startMusicIfNeeded();
  }, [startMusicIfNeeded]);

  const startNextRound = useCallback(() => {
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    roundStartRef.current = clockRef.current;
    setItems([]);
    setSharks([]);
    beatCountRef.current = 0;
    nextBeatRef.current = clockRef.current;
    setFeedback(`Round ${nextRound} - Faster!`);
    setPhase(PHASE_RHYTHM);
  }, [currentRound]);

  const resetGame = useCallback(() => {
    // Full state reset
    setPhase(PHASE_TITLE);
    setClockMs(0);
    setPartyMeter(0);
    setItems([]);
    setSharks([]);
    setConfetti([]);
    setShowSlam(false);
    setHatDropped(false);
    setHatDropY(-50);
    setPlayerLane("center");
    setPlayerX(PLAYER_X.center);
    setIsJumping(false);
    setJumpStartTime(0);
    setCurrentRound(1);
    setStripTapPower(0);
    setStripStage(0);
    setStripZoom(1.0);
    setVictoryZoom(1.0);
    setCostumeVisible({ hat: true, sweater: true, bowtie: true });
    setFlyingCostume(null);
    setHitReactionAt(null);
    setShakeUntil(0);
    setPerfectPops([]);
    setSparkles([]);
    setHitParticles([]);
    setMeterBump(false);
    setInterstitialQuote("");
    setLastAction({ lane: null, time: 0, result: "none" });
    beatCountRef.current = 0;
    nextBeatRef.current = 0;
    roundStartRef.current = 0;
    setFeedback("Welcome to The Full Weasel!");
  }, []);

  // ============================================
  // INPUT HANDLING
  // ============================================
  const handleJump = useCallback(() => {
    if (!isJumping && phase === PHASE_RHYTHM) {
      setIsJumping(true);
      setJumpStartTime(clockRef.current);
      setLastAction({ lane: "center", time: clockRef.current, result: "jump" });
      vibrate(20);
    }
  }, [isJumping, phase]);

  const handleStripTap = useCallback(() => {
    if (phase !== PHASE_STRIP) return;
    setStripTapPower((p) => p + 1);
    spawnSparkle();
    vibrate(15);
  }, [phase, spawnSparkle]);

  const handlePointerDown = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const lane = x < 33 ? "left" : x > 66 ? "right" : "center";

    switch (phase) {
      case PHASE_TITLE:
        goToHowTo();
        break;
      case PHASE_HOWTO:
        goToReady();
        break;
      case PHASE_READY:
        startGame();
        break;
      case PHASE_RHYTHM:
        if (lane === "center") {
          handleJump();
        } else {
          setPlayerLane(lane);
          setLastAction({ lane, time: clockRef.current, result: "move" });
        }
        break;
      case PHASE_INTERSTITIAL:
        startNextRound();
        break;
      case PHASE_STRIP:
        handleStripTap();
        break;
      case PHASE_VICTORY:
        // No interaction during victory animation
        break;
      case PHASE_END:
        // Handled by button
        break;
      default:
        break;
    }
  }, [phase, goToHowTo, goToReady, startGame, handleJump, startNextRound, handleStripTap]);

  // ============================================
  // RENDER COMPUTATIONS
  // ============================================
  const danceFrames = sprite.danceCleanFrames.length ? sprite.danceCleanFrames : ["/assets/sprites/dance/dexter_dance_01.png"];
  const danceFps = phase === PHASE_VICTORY || phase === PHASE_END ? 8 : 11;
  const danceFrameIndex = Math.floor((clockMs / 1000) * danceFps) % Math.max(1, danceFrames.length);

  const showHit = hitReactionAt !== null;
  const hitIndex = clamp(Math.floor(((clockMs - (hitReactionAt || 0)) / 1000) * 15), 0, sprite.hitFrames.length - 1);

  const spotlightOpacity = phase === PHASE_STRIP || phase === PHASE_VICTORY || phase === PHASE_END ? 0.74 : 0;
  const meterPercent = clamp(partyMeter, 0, 100);
  const currentPng = fallbackPngs[pngIndex] || "";
  const previousPng = fallbackPngs[pngPrevIndex] || currentPng;

  // Zoom transform for strip/victory phases
  const getZoomTransform = () => {
    if (phase === PHASE_STRIP) {
      return `scale(${stripZoom}) translateY(${(stripZoom - 1) * -8}%)`;
    }
    if (phase === PHASE_VICTORY || phase === PHASE_END) {
      return `scale(${victoryZoom}) translateY(${(victoryZoom - 1) * -5}%)`;
    }
    return "scale(1)";
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <main
      className={`game-root ${isShaking ? "shake" : ""}`}
      onPointerDown={handlePointerDown}
    >
      {/* Permanent subtle vignette */}
      <div className="vignette-overlay" />

      {/* Background layer */}
      <section className="background-layer" aria-hidden="true">
        {backgroundMode === "video" && activeVideo ? (
          <video
            className="background-video"
            src={activeVideo}
            autoPlay
            muted
            loop
            playsInline
            onError={() => {
              setBackgroundMode("png");
              setShowOfflineMediaHint(!navigator.onLine);
            }}
          />
        ) : null}
        {(backgroundMode === "png" || backgroundMode === "loading") && fallbackPngs.length > 0 ? (
          <>
            <img className="background-png previous" src={previousPng} alt="" />
            <img key={`${currentPng}-${pngIndex}`} className="background-png current" src={currentPng} alt="" />
          </>
        ) : null}
      </section>

      {/* Stage layer (Dexter, items, sharks) - applies zoom transform */}
      <section className="stage-layer" style={{ transform: getZoomTransform(), transformOrigin: "center 60%" }}>
        {/* Lane indicators at top */}
        {phase === PHASE_RHYTHM && (
          <div className="lane-indicators">
            <div className={`lane-indicator left ${playerLane === "left" ? "active" : ""}`}>🧀</div>
            <div className={`lane-indicator center ${isJumping ? "active" : ""}`}>⬆️</div>
            <div className={`lane-indicator right ${playerLane === "right" ? "active" : ""}`}>🍵</div>
          </div>
        )}

        {/* Hit particles */}
        {hitParticles.map((p) => {
          const age = (clockMs - p.spawnedAt) / 500;
          const px = p.x + p.vx * age;
          const py = p.y + p.vy * age + 50 * age * age;
          return (
            <span
              key={p.id}
              className={`hit-particle ${p.success ? "success" : "fail"}`}
              style={{
                left: `${px}%`,
                top: `${py}%`,
                opacity: 1 - age,
                backgroundColor: `hsl(${p.hue}, 80%, 60%)`,
              }}
            />
          );
        })}

        {/* Shadow (shrinks when jumping) */}
        <img 
          className="shadow-blob" 
          src={sprite.shadowBlob} 
          alt="" 
          style={{ 
            left: `${playerX}%`,
            transform: `translateX(-50%) ${isJumping ? `scale(${1 - jumpY * 0.015})` : ""}`,
            opacity: isJumping ? 0.5 : 0.74,
          }} 
        />

        {/* Dexter character */}
        <div
          className={`dexter-wrapper ${phase === PHASE_STRIP ? "dexter-strip" : ""}`}
          style={{ 
            left: `${playerX}%`,
            bottom: `${12 + jumpY}vh`,
          }}
        >
          {showHit ? (
            <img className="dexter-frame" src={sprite.hitFrames[hitIndex]} alt="Dexter reacts" />
          ) : (
            <img className="dexter-frame" src={danceFrames[danceFrameIndex]} alt="Dexter dances" />
          )}

          {/* Flying costume pieces during strip phase */}
          {(phase === PHASE_STRIP || phase === PHASE_VICTORY || phase === PHASE_END) && (
            <>
              {flyingCostume === "hat" && (
                <div className="flying-costume hat">🎩</div>
              )}
              {flyingCostume === "sweater" && (
                <div className="flying-costume sweater">👔</div>
              )}
              {flyingCostume === "bowtie" && (
                <div className="flying-costume bowtie">🎀</div>
              )}
            </>
          )}

          {/* Birthday hat drop for ending */}
          {hatDropped && (
            <div 
              className="dropped-hat"
              style={{ top: `${hatDropY}%` }}
            >
              🎉
            </div>
          )}

          {/* Perfect pop effects */}
          {perfectPops.map((entry) => (
            <img key={entry.id} className="perfect-pop" src={sprite.perfectPop} alt="Perfect" />
          ))}

          {/* Sparkle effects */}
          {sparkles.map((entry) => (
            <span
              key={entry.id}
              className="sparkle"
              style={{ left: `${entry.left}%`, top: `${entry.top}%` }}
            />
          ))}
        </div>

        {/* Item layer (falling items + horizontal sharks) */}
        <div className="item-layer">
          {/* Falling good items */}
          {items.map((item) => {
            const progress = (clockMs - item.spawnMs) / roundConfig.fallMs;
            const y = -15 + progress * 102;
            if (y > 106 || item.resolved) return null;
            const image = item.subtype === "cheese" ? sprite.nanaCheese : sprite.icedTea;
            const subtypeClass = item.subtype === "cheese" ? "cheese" : "tea";
            return (
              <img
                key={item.id}
                className={`falling-item good ${subtypeClass}`}
                src={image}
                alt=""
                style={{ left: `${LANE_X[item.lane]}%`, top: `${y}%` }}
              />
            );
          })}

          {/* Horizontal sharks */}
          {sharks.map((shark) => {
            const elapsed = clockMs - shark.spawnMs;
            const travelTime = 2500 / (roundConfig.sharkSpeed / 45);
            const progress = elapsed / travelTime;
            const sharkX = shark.fromLeft ? progress * 120 - 10 : 110 - progress * 120;
            if (sharkX < -20 || sharkX > 120) return null;
            return (
              <img
                key={shark.id}
                className={`horizontal-shark ${shark.fromLeft ? "from-left" : "from-right"}`}
                src={sprite.sharkFin}
                alt=""
                style={{ 
                  left: `${sharkX}%`, 
                  top: `${shark.y}%`,
                  transform: `translate(-50%, -50%) ${shark.fromLeft ? "" : "scaleX(-1)"}`,
                }}
              />
            );
          })}

          {/* Collection zone indicator (debug) */}
          {phase === PHASE_RHYTHM && (
            <div className="collect-zone" style={{ top: `${COLLECT_ZONE_TOP}%`, height: `${COLLECT_ZONE_BOTTOM - COLLECT_ZONE_TOP}%` }} />
          )}
        </div>
      </section>

      {/* Spotlight vignette overlay */}
      <img
        className="spotlight-overlay"
        src={sprite.spotlight}
        alt=""
        style={{ opacity: spotlightOpacity }}
      />

      {/* UI Layer */}
      <section className="ui-layer">
        {/* Party meter - show during rhythm and strip phases */}
        {(phase === PHASE_RHYTHM || phase === PHASE_STRIP) && (
          <div className={`party-meter ${beatPulse ? "beat-pulse" : ""} ${meterBump ? "bump" : ""}`}>
            <span>PARTY</span>
            <div className="party-meter-track">
              <div className="party-meter-fill" style={{ width: `${meterPercent}%` }}>
                <div className="meter-shimmer" />
              </div>
            </div>
            <strong>{Math.round(meterPercent)}%</strong>
          </div>
        )}

        {/* Round indicator */}
        {phase === PHASE_RHYTHM && (
          <div className="round-indicator">Round {currentRound}/3</div>
        )}

        {/* Feedback text */}
        {(phase === PHASE_RHYTHM || phase === PHASE_STRIP) && (
          <div className="feedback-box">{feedback}</div>
        )}

        {/* Strip phase UI */}
        {phase === PHASE_STRIP && (
          <div className="strip-ui">
            <h2 className="strip-title flashing">I CAN'T TAKE IT ANYMORE!</h2>
            <p className="strip-instruction">TAP RAPIDLY!</p>
            <div className="strip-progress">
              <div className="strip-bar" style={{ width: `${(stripTapPower / STRIP_THRESHOLDS[STRIP_THRESHOLDS.length - 1]) * 100}%` }} />
            </div>
            <div className="strip-stages">
              {STRIP_STAGES.map((stage, i) => (
                <span key={stage} className={stripStage > i ? "removed" : ""}>
                  {stage === "hat" ? "🎩" : stage === "sweater" ? "👔" : "🎀"}
                </span>
              ))}
            </div>
          </div>
        )}

        {showOfflineMediaHint && <p className="offline-hint">Offline media unavailable.</p>}
      </section>

      {/* Control labels at bottom */}
      {phase === PHASE_RHYTHM && (
        <div className="button-labels">
          <div className={`button-label ${playerLane === "left" ? "active" : ""}`}>🧀 LEFT</div>
          <div className={`button-label ${isJumping ? "active" : ""}`}>⬆️ JUMP</div>
          <div className={`button-label ${playerLane === "right" ? "active" : ""}`}>🍵 RIGHT</div>
        </div>
      )}

      {/* Victory layer */}
      {(phase === PHASE_VICTORY || phase === PHASE_END) && (
        <section className="victory-layer">
          {/* Confetti particles */}
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti"
              style={{
                left: `${piece.left}%`,
                width: `${piece.size}px`,
                height: `${piece.size * 1.6}px`,
                backgroundColor: `hsl(${piece.hue}, 94%, 60%)`,
                animationDelay: `${piece.delay}ms`,
                animationDuration: `${piece.duration}ms`,
              }}
            />
          ))}

          {/* Censor bar - positioned LOWER for the joke */}
          <img 
            className={`censor-slam lower ${showSlam ? "show" : ""}`} 
            src={sprite.censorSlam} 
            alt="" 
          />
          
          <h1 className="victory-title">HAPPY BIRTHDAY!</h1>
          
          {/* The mandatory ending quote */}
          <p className="victory-quote">"You can leave your hat on."</p>
        </section>
      )}

      {/* End screen with Play Again button */}
      {phase === PHASE_END && (
        <section className="end-screen">
          <button className="play-again-btn" onClick={resetGame}>
            🎉 Play Again 🎉
          </button>
        </section>
      )}

      {/* Title Screen */}
      {phase === PHASE_TITLE && (
        <section className={`title-screen ${assetsLoaded ? "loaded" : ""}`}>
          {sprite.titleScreen && (
            <img className="title-screen-image" src={sprite.titleScreen} alt="The Full Weasel" />
          )}
          {!assetsLoaded ? (
            <div className="loading-overlay">
              <div className="loading-content">
                <h2>🦦 Loading...</h2>
                <div className="loading-bar">
                  <div className="loading-fill" style={{ width: `${loadingProgress}%` }} />
                </div>
                <p>{loadingProgress}%</p>
              </div>
            </div>
          ) : (
            <div className="title-panel">
              <h1>The Full Weasel</h1>
              <p className="tap-hint">Tap anywhere to continue</p>
            </div>
          )}
        </section>
      )}

      {/* How To Play Screen */}
      {phase === PHASE_HOWTO && (
        <section className="howto-screen">
          <div className="howto-panel">
            <h2>How To Play</h2>
            <ul className="instructions-list">
              <li><span className="lane-icon">🧀</span> <strong>LEFT tap</strong> = eat cheese</li>
              <li><span className="lane-icon">🍵</span> <strong>RIGHT tap</strong> = drink iced tea</li>
              <li><span className="lane-icon">⬆️</span> <strong>MIDDLE tap</strong> = jump (for sharks)</li>
            </ul>
            <p className="goal-text">Fill the PARTY METER to 100%!</p>
            <p className="tap-hint">Tap anywhere to continue</p>
          </div>
        </section>
      )}

      {/* Tap to Start Screen */}
      {phase === PHASE_READY && (
        <section className="ready-screen">
          <div className="ready-panel">
            <h1>🎂</h1>
            <h2>Ready?</h2>
            <p className="tap-hint pulse">TAP TO START</p>
          </div>
        </section>
      )}

      {/* Interstitial (between rounds) */}
      {phase === PHASE_INTERSTITIAL && (
        <section className="interstitial-screen">
          <div className="interstitial-panel">
            <p className="round-complete">Round {currentRound} Complete!</p>
            <p className="interstitial-quote">"{interstitialQuote}"</p>
            <p className="tap-hint">Tap to continue</p>
          </div>
        </section>
      )}

      {/* Debug overlay - comprehensive info */}
      {showDebug ? (
        <section className="debug-overlay">
          <div className="debug-content">
            <strong>DEBUG</strong>
            <p>Phase: {phase}</p>
            <p>Clock: {Math.round(clockMs)}ms</p>
            <p>Round: {currentRound}</p>
            <p>Speed: {roundConfig.fallMs}ms / shk:{roundConfig.sharkSpeed}</p>
            <p>Lane: {playerLane}</p>
            <p>Jump: {isJumping ? `Y=${jumpY.toFixed(1)}vh` : "no"}</p>
            <p>Items: {items.filter(i => !i.resolved).length}</p>
            <p>Sharks: {sharks.filter(s => !s.resolved).length}</p>
            <p>Party: {Math.round(partyMeter)}%</p>
            <p className="debug-section">--- Strip Phase ---</p>
            <p>TapPower: {stripTapPower}</p>
            <p>Stage: {stripStage}/3</p>
            <p>Zoom: {stripZoom.toFixed(2)}</p>
            <p className="debug-section">--- Victory ---</p>
            <p>VZoom: {victoryZoom.toFixed(2)}</p>
            <p>Censor: {showSlam ? "shown" : "hidden"}</p>
            <p>Hat: {hatDropped ? `Y=${hatDropY.toFixed(0)}` : "waiting"}</p>
            <p className="debug-section">--- Last Action ---</p>
            <p>{lastAction.lane || "-"} → {lastAction.result}</p>
          </div>
          <button onClick={() => setShowDebug(false)}>✕</button>
        </section>
      ) : (
        <button
          className="debug-toggle"
          onClick={() => setShowDebug(true)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          🐛
        </button>
      )}
    </main>
  );
}

export default App;
