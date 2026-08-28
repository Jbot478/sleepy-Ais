const openingScene = document.getElementById("openingScene");
const gameScene = document.getElementById("gameScene");
const resultScene = document.getElementById("resultScene");
const introAdvanceBtn = document.getElementById("introAdvanceBtn");
const introDialogueLine = document.getElementById("introDialogueLine");
const introHint = document.getElementById("introHint");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
const gameArea = document.getElementById("gameArea");
const player = document.getElementById("player");
const timeLabel = document.getElementById("timeLabel");
const statusLabel = document.getElementById("statusLabel");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const GAME_DURATION_MS = 5 * 60 * 1000;
const GRAVITY = 0.33;
const FLAP_FORCE = -6.2;
const OBSTACLE_SPEED = 2.45;
const SPAWN_INTERVAL_MS = 1650;
const OBSTACLE_GAP = 170;

let gameState = null;
let introLineIndex = 0;
const introDialogue = [
  'John: "Movie night! Five whole minutes of cinematic art. Think Ais stays awake?"',
  'Saz: "Last time the opening credits won in round one."',
  'Katie: "I give them... two yawns and a dramatic flop."',
  'Ais: "Rude. I am absolutely awake. Start the movie!"',
];

function updateIntroDialogue() {
  introDialogueLine.textContent = introDialogue[introLineIndex];
}

function advanceIntroDialogue() {
  if (introLineIndex >= introDialogue.length - 1) {
    startBtn.classList.remove("hidden");
    introHint.textContent = "Ready! Tap Start Movie Challenge.";
    return;
  }

  introLineIndex += 1;
  updateIntroDialogue();
}

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
  const topHeight = 60 + Math.random() * (areaHeight - OBSTACLE_GAP - 150);
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
  bottom.style.height = `${areaHeight - topHeight - OBSTACLE_GAP}px`;
  bottom.style.left = `${x}px`;
  bottom.style.bottom = "0px";

  gameArea.append(top, bottom);

  return { x, topHeight, topEl: top, bottomEl: bottom };
}

function applyPlayerPosition() {
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
  const areaRect = gameArea.getBoundingClientRect();
  const playerX = 72;
  const playerRadius = playerSize.height * 0.35;
  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + 58;

  const inX = playerX + playerRadius > obstacleLeft && playerX - playerRadius < obstacleRight;
  if (!inX) {
    return false;
  }

  return (
    gameState.playerY - playerRadius < obstacle.topHeight ||
    gameState.playerY + playerRadius > areaRect.height - (areaRect.height - obstacle.topHeight - OBSTACLE_GAP)
  );
}

function endGame(didWin) {
  gameState.ended = true;
  cancelAnimationFrame(gameState.frameId);
  clearTimeout(gameState.spawnTimer);

  gameState.obstacles.forEach((obstacle) => {
    obstacle.topEl.remove();
    obstacle.bottomEl.remove();
  });

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

function scheduleObstacleSpawn() {
  if (!gameState || gameState.ended) {
    return;
  }

  const areaRect = gameArea.getBoundingClientRect();
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

  const areaRect = gameArea.getBoundingClientRect();

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
  gameArea.querySelectorAll(".obstacle").forEach((el) => el.remove());

  const areaRect = gameArea.getBoundingClientRect();
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

  showScene(gameScene);
  scheduleObstacleSpawn();
  gameState.frameId = requestAnimationFrame(updateFrame);
}

updateIntroDialogue();
introAdvanceBtn.addEventListener("click", advanceIntroDialogue);
startBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);
gameArea.addEventListener("pointerdown", flap);
gameArea.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    flap();
  }
});
