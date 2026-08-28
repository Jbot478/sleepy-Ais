const GAME_DURATION_MS = 5 * 60 * 1000;
const GRAVITY = 0.33;
const FLAP_FORCE = -6.2;
const OBSTACLE_SPEED = 2.45;
const SPAWN_INTERVAL_MS = 1650;
const OBSTACLE_GAP = 170;
const INTRO_LINES = [
  'John: "Movie night! Five whole minutes of cinematic art. Think Ais stays awake?"',
  'Saz: "Last time the opening credits won in round one."',
  'Katie: "I give them... two yawns and a dramatic flop."',
  'Ais: "Rude. I am absolutely awake. Start the movie!"',
];

const FALLBACK_COUCH_SCENE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520" role="img" aria-label="Four friends on a couch">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dce7ff"/>
      <stop offset="1" stop-color="#f3f7ff"/>
    </linearGradient>
  </defs>
  <rect width="900" height="520" fill="url(#bg)"/>
  <rect x="130" y="220" width="640" height="190" rx="36" fill="#6f59d9"/>
  <rect x="100" y="200" width="700" height="70" rx="35" fill="#7d68e8"/>
  <rect x="165" y="300" width="570" height="80" rx="30" fill="#5a47bf"/>

  <circle cx="230" cy="195" r="42" fill="#ffd5c2"/>
  <rect x="190" y="236" width="80" height="80" rx="30" fill="#ffd55a"/>
  <text x="230" y="352" text-anchor="middle" font-size="28" font-family="Arial">John</text>

  <circle cx="390" cy="190" r="42" fill="#ffd7ba"/>
  <rect x="350" y="232" width="80" height="84" rx="30" fill="#ff8eb1"/>
  <text x="390" y="352" text-anchor="middle" font-size="28" font-family="Arial">Saz</text>

  <circle cx="550" cy="195" r="42" fill="#ffd4bf"/>
  <rect x="510" y="236" width="80" height="80" rx="30" fill="#8ddf9b"/>
  <text x="550" y="352" text-anchor="middle" font-size="28" font-family="Arial">Ais</text>

  <circle cx="710" cy="195" r="42" fill="#ffd9c6"/>
  <rect x="670" y="236" width="80" height="80" rx="30" fill="#8dc5ff"/>
  <text x="710" y="352" text-anchor="middle" font-size="28" font-family="Arial">Katie</text>

  <text x="450" y="470" text-anchor="middle" font-size="30" font-family="Arial" fill="#293049">Movie night on the couch</text>
</svg>
`)}`;

let openingScene;
let gameScene;
let resultScene;
let startBtn;
let retryBtn;
let gameArea;
let player;
let timeLabel;
let statusLabel;
let resultTitle;
let resultText;
let dialogueLine;
let dialogueHint;
let couchSceneImage;

let introIndex = 0;
let gameState = null;
let startToken = 0;

function showScene(scene) {
  [openingScene, gameScene, resultScene].forEach((s) => s.classList.add("hidden"));
  scene.classList.remove("hidden");
}

function formatTime(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createObstacle(areaWidth, areaHeight) {
  const playableRange = Math.max(40, areaHeight - OBSTACLE_GAP - 150);
  const topHeight = 60 + Math.random() * playableRange;
  const x = areaWidth;

  const top = document.createElement("div");
  top.className = "obstacle top";
  top.textContent = "🍿";
  top.style.height = `${topHeight}px`;
  top.style.left = `${x}px`;
  top.style.top = "0px";

  const bottom = document.createElement("div");
  bottom.className = "obstacle bottom";
  bottom.textContent = "🥱";
  bottom.style.height = `${Math.max(40, areaHeight - topHeight - OBSTACLE_GAP)}px`;
  bottom.style.left = `${x}px`;
  bottom.style.bottom = "0px";

  gameArea.append(top, bottom);

  return { x, topHeight, topEl: top, bottomEl: bottom };
}

function applyPlayerPosition() {
  if (!gameState) {
    return;
  }
  player.style.top = `${gameState.playerY}px`;
}

function flap() {
  if (!gameState || gameState.ended) {
    return;
  }
  gameState.playerVY = FLAP_FORCE;
}

function hitObstacle(obstacle) {
  const playerSize = player.getBoundingClientRect();
  const playerX = 72;
  const playerRadius = Math.max(10, playerSize.height * 0.35);
  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + 58;

  const inX = playerX + playerRadius > obstacleLeft && playerX - playerRadius < obstacleRight;
  if (!inX) {
    return false;
  }

  return gameState.playerY - playerRadius < obstacle.topHeight || gameState.playerY + playerRadius > obstacle.topHeight + OBSTACLE_GAP;
}

function clearObstacles() {
  gameArea.querySelectorAll(".obstacle").forEach((el) => el.remove());
}

function stopRunningGame() {
  if (!gameState) {
    return;
  }

  gameState.ended = true;
  cancelAnimationFrame(gameState.frameId);
  clearTimeout(gameState.spawnTimer);
}

function endGame(didWin) {
  if (!gameState || gameState.ended) {
    return;
  }

  gameState.ended = true;
  cancelAnimationFrame(gameState.frameId);
  clearTimeout(gameState.spawnTimer);
  clearObstacles();

  showScene(resultScene);

  if (didWin) {
    resultTitle.className = "result-win";
    resultTitle.textContent = "🎉 hurray you made it though the movie";
    resultText.textContent = "Ais stayed awake! John owes everyone snacks, Saz is stunned, and Katie is demanding a sequel.";
  } else {
    resultTitle.className = "result-lose";
    resultTitle.textContent = "😴 ooop you fell asleep";
    resultText.textContent = "The couch wins this round. Even the popcorn is disappointed. Try again!";
  }
}

function getAreaRect() {
  const rect = gameArea.getBoundingClientRect();
  const width = Math.max(300, rect.width || gameArea.clientWidth || 300);
  const height = Math.max(280, rect.height || gameArea.clientHeight || 380);
  return { width, height };
}

function scheduleObstacleSpawn() {
  if (!gameState || gameState.ended) {
    return;
  }

  const areaRect = getAreaRect();
  gameState.obstacles.push(createObstacle(areaRect.width, areaRect.height));
  gameState.spawnTimer = setTimeout(scheduleObstacleSpawn, SPAWN_INTERVAL_MS);
}

function updateFrame(now) {
  if (!gameState || gameState.ended) {
    return;
  }

  const elapsed = now - gameState.startTime;
  const remaining = GAME_DURATION_MS - elapsed;
  timeLabel.textContent = `Time Left: ${formatTime(remaining)}`;

  if (remaining <= 0) {
    endGame(true);
    return;
  }

  const areaRect = getAreaRect();

  gameState.playerVY += GRAVITY;
  gameState.playerY += gameState.playerVY;

  if (gameState.playerY < 10 || gameState.playerY > areaRect.height - 10) {
    endGame(false);
    return;
  }

  applyPlayerPosition();

  gameState.obstacles.forEach((obstacle) => {
    obstacle.x -= OBSTACLE_SPEED;
    obstacle.topEl.style.left = `${obstacle.x}px`;
    obstacle.bottomEl.style.left = `${obstacle.x}px`;
  });

  gameState.obstacles = gameState.obstacles.filter((obstacle) => {
    const stillVisible = obstacle.x + 58 > 0;
    if (!stillVisible) {
      obstacle.topEl.remove();
      obstacle.bottomEl.remove();
    }
    return stillVisible;
  });

  if (gameState.obstacles.some(hitObstacle)) {
    endGame(false);
    return;
  }

  statusLabel.textContent = gameState.playerVY < 2 ? "Status: Focused 👀" : "Status: Battling sleep 🥱";
  gameState.frameId = requestAnimationFrame(updateFrame);
}

function startGame() {
  startToken += 1;
  const currentToken = startToken;

  stopRunningGame();
  clearObstacles();

  showScene(gameScene);

  requestAnimationFrame(() => {
    if (currentToken !== startToken) {
      return;
    }

    const areaRect = getAreaRect();
    gameState = {
      startTime: performance.now(),
      playerY: areaRect.height / 2,
      playerVY: 0,
      obstacles: [],
      ended: false,
      frameId: 0,
      spawnTimer: 0,
    };

    timeLabel.textContent = "Time Left: 5:00";
    statusLabel.textContent = "Status: Wide awake 👀";
    applyPlayerPosition();

    scheduleObstacleSpawn();
    gameState.frameId = requestAnimationFrame(updateFrame);
  });
}

function updateDialogue() {
  dialogueLine.textContent = INTRO_LINES[introIndex];

  if (startBtn.classList.contains("hidden")) {
    dialogueHint.textContent = introIndex < INTRO_LINES.length - 1 ? "Tap to continue…" : "Tap once more to get ready.";
  }
}

function advanceDialogue() {
  if (!startBtn.classList.contains("hidden")) {
    return;
  }

  if (introIndex < INTRO_LINES.length - 1) {
    introIndex += 1;
    updateDialogue();
    return;
  }

  startBtn.classList.remove("hidden");
  dialogueHint.textContent = "Dialogue complete! Tap Start Movie Challenge.";
}

function installImageFallback() {
  couchSceneImage.addEventListener("error", () => {
    if (couchSceneImage.dataset.fallbackApplied === "true") {
      return;
    }
    couchSceneImage.dataset.fallbackApplied = "true";
    couchSceneImage.src = FALLBACK_COUCH_SCENE;
  });
}

function initGame() {
  openingScene = document.getElementById("openingScene");
  gameScene = document.getElementById("gameScene");
  resultScene = document.getElementById("resultScene");
  startBtn = document.getElementById("startBtn");
  retryBtn = document.getElementById("retryBtn");
  gameArea = document.getElementById("gameArea");
  player = document.getElementById("player");
  timeLabel = document.getElementById("timeLabel");
  statusLabel = document.getElementById("statusLabel");
  resultTitle = document.getElementById("resultTitle");
  resultText = document.getElementById("resultText");
  dialogueLine = document.getElementById("dialogueLine");
  dialogueHint = document.getElementById("dialogueHint");
  couchSceneImage = document.getElementById("couchSceneImage");

  const requiredElements = [
    openingScene,
    gameScene,
    resultScene,
    startBtn,
    retryBtn,
    gameArea,
    player,
    timeLabel,
    statusLabel,
    resultTitle,
    resultText,
    dialogueLine,
    dialogueHint,
    couchSceneImage,
  ];

  if (requiredElements.some((el) => !el)) {
    console.error("Sleepy Ais failed to initialize: required DOM element is missing.");
    return;
  }

  installImageFallback();
  updateDialogue();

  startBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);

  openingScene.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("#startBtn")) {
      return;
    }
    advanceDialogue();
  });

  openingScene.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      if (event.target instanceof Element && event.target.closest("#startBtn")) {
        return;
      }
      event.preventDefault();
      advanceDialogue();
    }
  });

  gameArea.addEventListener("pointerdown", flap);
  gameArea.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      flap();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame, { once: true });
} else {
  initGame();
}
