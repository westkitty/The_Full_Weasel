import { useEffect, useMemo, useRef, useState } from "react";

const PHASE_LAUNCH = "Phase0_Launch";
const PHASE_RHYTHM = "Phase1_Rhythm";
const PHASE_POPOFF = "Phase2_PopOff";
const PHASE_VICTORY = "Phase3_Victory";

const LANE_X = {
  left: 22,
  center: 50,
  right: 78,
};
const PLAYER_X = {
  left: 28,
  center: 50,
  right: 72,
};

const SUCCESS_LINES = ["Birthday legend!", "Party animal!", "Hot stuff!"];
const HAZARD_LINES = [
  "We're gonna need a bigger cake.",
  "Wrong party, buddy.",
  "Shark dodged. Cake saved!",
];

const BEAT_MS = 650;
const FALL_MS = 2500;
const HIT_WINDOW_MS = 430;
const PERFECT_WINDOW_MS = 140;
const HIT_REACTION_MS = 260;
const POPOFF_TARGET_TAPS = 16;

const FALLBACK_MANIFEST = {
  sprites: [
    { role: "dance_clean_01", url: "/assets/sprites/dance/dexter_dance_01.png" },
    { role: "dance_clean_02", url: "/assets/sprites/dance/dexter_dance_02.png" },
    { role: "dance_clean_03", url: "/assets/sprites/dance/dexter_dance_03.png" },
    { role: "title_screen", url: "/assets/sprites/ui/Title_Screen.png" },
    { role: "pwa_guide", url: "/assets/sprites/ui/PWA_guide.png" },
  ],
  backgrounds: {
    mp4: [],
    pngFallback: [],
  },
  music: [],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const choice = (items) => items[Math.floor(Math.random() * items.length)];

function makeIdFactory() {
  let nextId = 1;
  return () => {
    nextId += 1;
    return nextId;
  };
}

function pickRandomIndex(length, exclude = -1) {
  if (length <= 1) {
    return 0;
  }
  let index = Math.floor(Math.random() * length);
  while (index === exclude) {
    index = Math.floor(Math.random() * length);
  }
  return index;
}

function App() {
  const idRef = useRef(makeIdFactory());
  const touchStartYRef = useRef(null);
  const nextBeatRef = useRef(0);
  const beatCountRef = useRef(0);
  const deferredPromptRef = useRef(null);
  const manifestRef = useRef(FALLBACK_MANIFEST);
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

  const [manifest, setManifest] = useState(FALLBACK_MANIFEST);
  const [phase, setPhase] = useState(PHASE_LAUNCH);
  const [clockMs, setClockMs] = useState(0);
  const [partyMeter, setPartyMeter] = useState(0);
  const [feedback, setFeedback] = useState("Welcome to The Full Weasel");
  const [items, setItems] = useState([]);
  const [perfectPops, setPerfectPops] = useState([]);
  const [sparkles, setSparkles] = useState([]);
  const [hitReactionAt, setHitReactionAt] = useState(null);
  const [shakeUntil, setShakeUntil] = useState(0);
  const [popoffTaps, setPopoffTaps] = useState(0);
  const [confetti, setConfetti] = useState([]);
  const [showSlam, setShowSlam] = useState(false);
  const [showOfflineMediaHint, setShowOfflineMediaHint] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState("loading");
  const [activeVideo, setActiveVideo] = useState("");
  const [pngIndex, setPngIndex] = useState(0);
  const [pngPrevIndex, setPngPrevIndex] = useState(0);
  const [playerLane, setPlayerLane] = useState("center");
  const [playerX, setPlayerX] = useState(PLAYER_X.center);
  const [laneFlashUntil, setLaneFlashUntil] = useState({
    left: 0,
    center: 0,
    right: 0,
  });
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  const isShaking = clockMs < shakeUntil;

  const roleMap = useMemo(() => {
    const map = new Map();
    for (const entry of manifest.sprites || []) {
      map.set(entry.role, entry.url);
    }
    return map;
  }, [manifest]);

  const sprite = useMemo(() => {
    const getRole = (role, fallback = "") => roleMap.get(role) || fallback;
    return {
      danceCleanFrames: [
        getRole("dance_clean_01", getRole("dexter_dance_01", getRole("dexter_joyful"))),
        getRole("dance_clean_02", getRole("dexter_dance_02", getRole("dexter_proud"))),
        getRole("dance_clean_03", getRole("dexter_dance_03", getRole("dexter_joyful"))),
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
      victorySubtext: getRole("victory_subtext", "/assets/sprites/ui/victory_subtext.png"),
      sharkFin: getRole("hazard_shark_fin", "/assets/sprites/items/hazard_shark_fin.png"),
      nanaCheese: getRole("item_nana_cheese", "/assets/sprites/items/item_nana_cheese.png"),
      icedTea: getRole(
        "item_unsweetened_iced_tea",
        "/assets/sprites/items/item_unsweetened_iced_tea.png"
      ),
      titleScreen: getRole("title_screen", ""),
      pwaGuide: getRole("pwa_guide", ""),
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

  useEffect(() => {
    manifestRef.current = manifest;
  }, [manifest]);

  useEffect(() => {
    const preventGesture = (event) => event.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("dblclick", preventGesture, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("dblclick", preventGesture);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setInstallAvailable(true);
      setInstallMessage("Install is ready. Tap the guide button.");
    };

    const onInstalled = () => {
      deferredPromptRef.current = null;
      setInstallAvailable(false);
      setInstallMessage("Installed. You can launch from home screen.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetch("/assets/manifest.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("manifest fetch failed");
        }
        const data = await response.json();
        setManifest(data);
      } catch {
        // Fallback manifest keeps app functional.
      }
    };
    loadManifest();
  }, []);

  useEffect(() => {
    window.advanceTime = (ms) => {
      const stepMs = Number(ms);
      if (!Number.isFinite(stepMs) || stepMs <= 0) {
        return;
      }
      setClockMs((current) => current + stepMs);
    };
    return () => {
      delete window.advanceTime;
    };
  }, []);

  useEffect(() => {
    window.render_game_to_text = () => {
      const payload = {
        phase,
        clockMs,
        controls: ["tap-left", "tap-right", "tap-center", "swipe-up"],
        coordinateSystem:
          "x/y are percentages in screen space, origin top-left, +x right, +y down",
        player: {
          lane: playerLane,
          x: playerX,
        },
        partyMeter,
        popoff: {
          taps: popoffTaps,
          target: POPOFF_TARGET_TAPS,
        },
        activeItems: items.map((item) => {
          const progress = (clockMs - item.spawnMs) / FALL_MS;
          return {
            id: item.id,
            kind: item.kind,
            lane: item.lane,
            x: LANE_X[item.lane],
            y: Math.round((-15 + progress * 102) * 100) / 100,
          };
        }),
        feedback,
      };
      return JSON.stringify(payload);
    };
    return () => {
      delete window.render_game_to_text;
    };
  }, [phase, clockMs, partyMeter, popoffTaps, items, feedback, playerLane, playerX]);

  useEffect(() => {
    setPlayerX(PLAYER_X[playerLane] ?? PLAYER_X.center);
  }, [playerLane]);

  useEffect(() => {
    if (phase === PHASE_LAUNCH) {
      return;
    }
    const timer = window.setInterval(() => {
      setClockMs((current) => current + 33);
    }, 33);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== PHASE_RHYTHM) {
      return;
    }

    while (clockMs >= nextBeatRef.current) {
      const beat = beatCountRef.current;
      const spawnMs = nextBeatRef.current;
      const goodLane = beat % 2 === 0 ? "left" : "right";
      const goodSubtype = goodLane === "left" ? "cheese" : "tea";
      const spawned = [
        {
          id: idRef.current(),
          kind: "good",
          subtype: goodSubtype,
          lane: goodLane,
          spawnMs,
          resolved: false,
        },
      ];

      if (beat % 3 === 2) {
        spawned.push({
          id: idRef.current(),
          kind: "hazard",
          lane: ["left", "center", "right"][Math.floor(Math.random() * 3)],
          spawnMs,
          resolved: false,
        });
      }

      setItems((current) => [...current, ...spawned]);
      beatCountRef.current += 1;
      nextBeatRef.current += BEAT_MS;
    }
  }, [clockMs, phase]);

  useEffect(() => {
    if (phase !== PHASE_RHYTHM) {
      return;
    }

    let missedGood = false;
    let hazardHit = false;

    setItems((current) => {
      const kept = [];
      for (const item of current) {
        const progress = (clockMs - item.spawnMs) / FALL_MS;
        if (item.resolved) {
          if (progress < 1.28) {
            kept.push(item);
          }
          continue;
        }
        if (progress > 1.08) {
          if (item.kind === "good") {
            missedGood = true;
          } else {
            hazardHit = true;
          }
          continue;
        }
        kept.push(item);
      }
      return kept;
    });

    if (missedGood) {
      setFeedback("Keep the groove going!");
    }
    if (hazardHit) {
      setFeedback(choice(HAZARD_LINES));
      setPartyMeter((value) => clamp(value - 7, 0, 100));
      setHitReactionAt(clockMs);
      setShakeUntil(clockMs + HIT_REACTION_MS);
    }
  }, [clockMs, phase]);

  useEffect(() => {
    if (hitReactionAt === null) {
      return;
    }
    if (clockMs - hitReactionAt > HIT_REACTION_MS) {
      setHitReactionAt(null);
    }
  }, [clockMs, hitReactionAt]);

  useEffect(() => {
    setPerfectPops((current) => current.filter((entry) => clockMs - entry.spawnedAt < 360));
    setSparkles((current) => current.filter((entry) => clockMs - entry.spawnedAt < 900));
  }, [clockMs]);

  useEffect(() => {
    if (phase === PHASE_RHYTHM && partyMeter >= 100) {
      setPhase(PHASE_POPOFF);
      setItems([]);
      setFeedback("THIS IS THE BEST BIRTHDAY EVER!");
    }
  }, [partyMeter, phase]);

  useEffect(() => {
    if (phase !== PHASE_VICTORY) {
      return;
    }
    const generated = Array.from({ length: 72 }).map((_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 6 + Math.random() * 12,
      delay: Math.random() * 1200,
      duration: 2200 + Math.random() * 2600,
      hue: Math.round(Math.random() * 360),
    }));
    setConfetti(generated);
    setShowSlam(true);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;

    const probeVideo = (url) =>
      new Promise((resolve) => {
        const video = document.createElement("video");
        let done = false;
        const finish = (ok) => {
          if (done) {
            return;
          }
          done = true;
          resolve(ok);
        };
        const timeout = window.setTimeout(() => finish(false), 2600);
        const cleanup = () => {
          window.clearTimeout(timeout);
          video.removeAttribute("src");
          video.load();
        };

        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.preload = "metadata";
        video.addEventListener("canplaythrough", () => {
          cleanup();
          finish(true);
        });
        video.addEventListener("loadeddata", () => {
          cleanup();
          finish(true);
        });
        video.addEventListener("error", () => {
          cleanup();
          finish(false);
        });
        video.src = url;
        video.load();
      });

    const chooseBackground = async () => {
      if (backgroundVideos.length === 0) {
        setBackgroundMode("png");
        return;
      }
      const order = [...backgroundVideos];
      while (order.length > 0) {
        const index = Math.floor(Math.random() * order.length);
        const url = order.splice(index, 1)[0];
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeVideo(url);
        if (cancelled) {
          return;
        }
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

    return () => {
      cancelled = true;
    };
  }, [backgroundVideos]);

  useEffect(() => {
    if (backgroundMode !== "png" || fallbackPngs.length === 0) {
      return;
    }
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

  const initializeAudioPlayers = () => {
    if (musicRef.current.players) {
      return musicRef.current.players;
    }
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

  const queueNextTrack = () => {
    const state = musicRef.current;
    const tracks = (manifestRef.current.music || []).map((track) => track.url);
    if (!state.players || tracks.length === 0) {
      return;
    }
    const nextIndex = pickRandomIndex(tracks.length, state.currentIndex);
    state.nextIndex = nextIndex;
    const inactive = state.activePlayer === "a" ? state.players.b : state.players.a;
    inactive.src = tracks[nextIndex];
    inactive.preload = "auto";
    inactive.load();
  };

  const attachMusicEvents = () => {
    const state = musicRef.current;
    if (!state.players) {
      return;
    }
    for (const [key, player] of Object.entries(state.players)) {
      player.onended = () => {
        if (musicRef.current.activePlayer === key) {
          startTransitionToNextTrack();
        }
      };
      player.ontimeupdate = () => {
        const live = musicRef.current;
        if (!live.crossfadeEnabled || live.transitioning || live.activePlayer !== key) {
          return;
        }
        if (!Number.isFinite(player.duration)) {
          return;
        }
        const remaining = player.duration - player.currentTime;
        if (remaining < 1.1) {
          startTransitionToNextTrack();
        }
      };
    }
    queueNextTrack();
  };

  const startTransitionToNextTrack = () => {
    const state = musicRef.current;
    const tracks = (manifestRef.current.music || []).map((track) => track.url);
    if (!state.players || state.transitioning || tracks.length === 0) {
      return;
    }
    state.transitioning = true;

    const active = state.activePlayer === "a" ? state.players.a : state.players.b;
    const inactive = state.activePlayer === "a" ? state.players.b : state.players.a;
    const nextIndex =
      state.nextIndex >= 0
        ? state.nextIndex
        : pickRandomIndex(tracks.length, state.currentIndex);

    inactive.src = tracks[nextIndex];
    inactive.currentTime = 0;
    inactive.preload = "auto";

    const finalize = () => {
      active.pause();
      active.currentTime = 0;
      active.volume = 1;
      state.activePlayer = state.activePlayer === "a" ? "b" : "a";
      state.currentIndex = nextIndex;
      state.transitioning = false;
      attachMusicEvents();
    };

    const cleanSwitch = async () => {
      try {
        await inactive.play();
      } catch {
        setShowOfflineMediaHint(!navigator.onLine);
      }
      finalize();
    };

    const crossfade = async () => {
      inactive.volume = 0;
      try {
        await inactive.play();
      } catch {
        state.transitioning = false;
        return;
      }
      const start = performance.now();
      const duration = 850;
      const tick = () => {
        const t = clamp((performance.now() - start) / duration, 0, 1);
        active.volume = 1 - t;
        inactive.volume = t;
        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }
        finalize();
      };
      requestAnimationFrame(tick);
    };

    if (state.crossfadeEnabled) {
      void crossfade();
    } else {
      void cleanSwitch();
    }
  };

  const startMusicIfNeeded = async () => {
    const state = musicRef.current;
    if (state.started) {
      return;
    }
    const tracks = (manifestRef.current.music || []).map((track) => track.url);
    if (tracks.length === 0) {
      return;
    }

    const players = initializeAudioPlayers();
    state.started = true;
    state.activePlayer = "a";
    state.currentIndex = pickRandomIndex(tracks.length);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        state.context = new AudioCtx();
        await state.context.resume();
        state.crossfadeEnabled = state.context.state === "running";
      }
    } catch {
      state.crossfadeEnabled = false;
    }

    const active = players.a;
    active.src = tracks[state.currentIndex];
    active.preload = "auto";
    active.currentTime = 0;
    try {
      await active.play();
      attachMusicEvents();
    } catch {
      state.started = false;
      setShowOfflineMediaHint(!navigator.onLine);
    }
  };

  const flashLane = (lane) => {
    setLaneFlashUntil((current) => ({ ...current, [lane]: clockMs + 180 }));
  };

  const spawnPerfect = () => {
    setPerfectPops((current) => [...current, { id: idRef.current(), spawnedAt: clockMs }]);
  };

  const spawnSparkle = () => {
    setSparkles((current) => [
      ...current,
      {
        id: idRef.current(),
        spawnedAt: clockMs,
        left: 32 + Math.random() * 36,
        top: 35 + Math.random() * 25,
      },
    ]);
  };

  const startGame = () => {
    setClockMs(0);
    setPartyMeter(0);
    setItems([]);
    setPopoffTaps(0);
    setConfetti([]);
    setShowSlam(false);
    setPlayerLane("center");
    setPlayerX(PLAYER_X.center);
    beatCountRef.current = 0;
    nextBeatRef.current = 0;
    setFeedback("Tap left and right on beat!");
    setPhase(PHASE_RHYTHM);
    void startMusicIfNeeded();
  };

  const runPopoffTap = () => {
    spawnSparkle();
    setPopoffTaps((count) => {
      const next = count + 1;
      if (next >= POPOFF_TARGET_TAPS) {
        setFeedback("HAPPY BIRTHDAY NANA CHEESE");
        setPhase(PHASE_VICTORY);
        return POPOFF_TARGET_TAPS;
      }
      return next;
    });
  };

  const performRhythmAction = (lane, source = "tap") => {
    let selected = null;

    setItems((current) => {
      const next = [...current];
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < next.length; i += 1) {
        const item = next[i];
        if (item.resolved) {
          continue;
        }
        const hitTime = item.spawnMs + FALL_MS;
        const distance = Math.abs(hitTime - clockMs);
        if (distance > HIT_WINDOW_MS) {
          continue;
        }

        let matches = false;
        if (item.kind === "good") {
          matches = item.lane === lane;
        } else {
          matches = lane === "center" || source === "swipe";
        }

        if (!matches) {
          continue;
        }
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected = next[bestIndex];
        next[bestIndex] = {
          ...next[bestIndex],
          resolved: true,
          resolvedAt: clockMs,
        };
      }

      return next;
    });

    flashLane(lane);

    if (!selected) {
      setFeedback("Feel the groove!");
      return;
    }

    const hitDistance = Math.abs(selected.spawnMs + FALL_MS - clockMs);

    if (selected.kind === "hazard") {
      setFeedback(choice(HAZARD_LINES));
      setPartyMeter((value) => clamp(value + 5, 0, 100));
      return;
    }

    const isPerfect = hitDistance <= PERFECT_WINDOW_MS;
    setPartyMeter((value) => clamp(value + (isPerfect ? 12 : 9), 0, 100));
    setFeedback(choice(SUCCESS_LINES));
    if (isPerfect) {
      spawnPerfect();
    }
  };

  const performAction = (lane, source = "tap") => {
    if (phase === PHASE_LAUNCH) {
      return;
    }
    if (phase === PHASE_RHYTHM) {
      if (lane && PLAYER_X[lane] !== undefined) {
        setPlayerLane(lane);
      }
      performRhythmAction(lane, source);
      return;
    }
    if (phase === PHASE_POPOFF) {
      if (lane && PLAYER_X[lane] !== undefined) {
        setPlayerLane(lane);
      }
      runPopoffTap();
    }
  };

  const handleGlobalPointerDown = (event) => {
    if (phase === PHASE_LAUNCH || phase === PHASE_VICTORY) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const lane = x < 33 ? "left" : x > 66 ? "right" : "center";
    performAction(lane, "tap");
  };

  const handleTouchStart = (event) => {
    if (event.touches && event.touches[0]) {
      touchStartYRef.current = event.touches[0].clientY;
    }
  };

  const handleTouchEnd = (event) => {
    if (!event.changedTouches || !event.changedTouches[0]) {
      return;
    }
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0].clientY;
    if (startY !== null && startY - endY > 45) {
      performAction("center", "swipe");
    }
    touchStartYRef.current = null;
  };

  const handleInstallClick = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const result = await promptEvent.userChoice;
        if (result?.outcome === "accepted") {
          setInstallMessage("Installing... check your home screen in a moment.");
        } else {
          setInstallMessage("Install was cancelled. You can retry anytime.");
        }
      } catch {
        setInstallMessage("Install prompt failed. Use browser menu > Add to Home screen.");
      }
      return;
    }

    setInstallMessage(
      "Auto-install is only allowed when browser exposes install prompt. On Android Chrome use menu > Add to Home screen."
    );
  };

  const danceFrames = sprite.danceCleanFrames.length
    ? sprite.danceCleanFrames
    : [sprite.hitFrames[0]].filter(Boolean);
  const danceFps = phase === PHASE_VICTORY ? 8 : 11;
  const danceFrameIndex = Math.floor((clockMs / 1000) * danceFps) % Math.max(1, danceFrames.length);

  const showHit = hitReactionAt !== null;
  const hitIndex = clamp(
    Math.floor(((clockMs - (hitReactionAt || 0)) / 1000) * 15),
    0,
    sprite.hitFrames.length - 1
  );

  const spotlightOpacity = phase === PHASE_POPOFF || phase === PHASE_VICTORY ? 0.74 : 0;
  const meterPercent = clamp(partyMeter, 0, 100);
  const currentPng = fallbackPngs[pngIndex] || "";
  const previousPng = fallbackPngs[pngPrevIndex] || currentPng;

  return (
    <main
      className={`game-root ${isShaking ? "shake" : ""}`}
      onPointerDown={handleGlobalPointerDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
            <img
              key={`${currentPng}-${pngIndex}`}
              className="background-png current"
              src={currentPng}
              alt=""
            />
          </>
        ) : null}
      </section>

      <section className="stage-layer">
        <img className="shadow-blob" src={sprite.shadowBlob} alt="" style={{ left: `${playerX}%` }} />

        <div
          className={`dexter-wrapper ${phase === PHASE_POPOFF ? "dexter-popoff" : ""}`}
          style={{ left: `${playerX}%` }}
        >
          {showHit ? (
            <img className="dexter-frame" src={sprite.hitFrames[hitIndex]} alt="Dexter reacts" />
          ) : (
            <img className="dexter-frame" src={danceFrames[danceFrameIndex]} alt="Dexter dances" />
          )}

          {perfectPops.map((entry) => (
            <img key={entry.id} className="perfect-pop" src={sprite.perfectPop} alt="Perfect" />
          ))}

          {sparkles.map((entry) => (
            <span
              key={entry.id}
              className="sparkle"
              style={{ left: `${entry.left}%`, top: `${entry.top}%` }}
            />
          ))}
        </div>

        <div className="item-layer">
          {items.map((item) => {
            const progress = (clockMs - item.spawnMs) / FALL_MS;
            const y = -15 + progress * 102;
            if (y > 106 || item.resolved) {
              return null;
            }
            const image = item.kind === "hazard" ? sprite.sharkFin : item.subtype === "cheese" ? sprite.nanaCheese : sprite.icedTea;
            return (
              <img
                key={item.id}
                className={`falling-item ${item.kind}`}
                src={image}
                alt=""
                style={{ left: `${LANE_X[item.lane]}%`, top: `${y}%` }}
              />
            );
          })}
          <div className="hit-line" />
        </div>
      </section>

      <img
        className="spotlight-overlay"
        src={sprite.spotlight}
        alt=""
        style={{ opacity: spotlightOpacity }}
      />

      <section className="ui-layer">
        <div className="party-meter">
          <span>PARTY METER</span>
          <div className="party-meter-track">
            <div className="party-meter-fill" style={{ width: `${meterPercent}%` }} />
          </div>
          <strong>{Math.round(meterPercent)}%</strong>
        </div>

        <div className="feedback-box">{feedback}</div>

        {phase === PHASE_POPOFF ? (
          <div className="popoff-card">
            <h2>THIS IS THE BEST BIRTHDAY EVER!</h2>
            <p>
              Tap anywhere or swipe up: {popoffTaps}/{POPOFF_TARGET_TAPS}
            </p>
          </div>
        ) : null}

        {showOfflineMediaHint ? <p className="offline-hint">Offline media unavailable.</p> : null}
      </section>

      <section className="controls">
        <button
          type="button"
          className={clockMs < laneFlashUntil.left ? "flash" : ""}
          onPointerDown={(event) => {
            event.stopPropagation();
            performAction("left", "tap");
          }}
        >
          LEFT
        </button>
        <button
          type="button"
          className={clockMs < laneFlashUntil.center ? "flash" : ""}
          onPointerDown={(event) => {
            event.stopPropagation();
            performAction("center", "tap");
          }}
        >
          CENTER / SWIPE
        </button>
        <button
          type="button"
          className={clockMs < laneFlashUntil.right ? "flash" : ""}
          onPointerDown={(event) => {
            event.stopPropagation();
            performAction("right", "tap");
          }}
        >
          RIGHT
        </button>
      </section>

      {phase === PHASE_VICTORY ? (
        <section className="victory-layer">
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

          <img className={`censor-slam ${showSlam ? "show" : ""}`} src={sprite.censorSlam} alt="" />
          <h1>HAPPY BIRTHDAY NANA CHEESE</h1>
          <p>You can leave your hat on.</p>
          <img className="victory-subtext" src={sprite.victorySubtext} alt="You can leave your hat on." />
        </section>
      ) : null}

      {phase === PHASE_LAUNCH ? (
        <section className="launch-screen">
          {sprite.titleScreen ? <img className="title-screen-image" src={sprite.titleScreen} alt="The Full Weasel" /> : null}

          <div className="launch-panel">
            <h1>The Full Weasel</h1>
            <button type="button" className="install-button" onPointerDown={(event) => event.stopPropagation()} onClick={handleInstallClick}>
              {sprite.pwaGuide ? <img src={sprite.pwaGuide} alt="PWA install guide" /> : <span>Install Guide</span>}
            </button>
            <p className="install-note">
              {installAvailable
                ? "Install is ready on this device. Tap the guide button."
                : "Tap the guide button first. If install prompt is unavailable, use browser menu > Add to Home screen."}
            </p>
            {installMessage ? <p className="install-message">{installMessage}</p> : null}

            <button
              type="button"
              className="start-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={startGame}
            >
              TAP TO START
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default App;
