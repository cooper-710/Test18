// === GLOBALS ===
let scene, camera, renderer;
let ball, trailDots = [];
let pitchData = {};
let currentPitch = null;
let animationFrameId;
let isPaused = false;
let showTrail = true;
let pitchStartTime = 0;
let totalTime = 0.45;
let startTime = null;

const colorMap = {
  'FF': 0xff0000, 'SL': 0x0000ff, 'CH': 0x00ff00, 'CU': 0x800080,
  'SI': 0xffff00, 'FC': 0x00ffff, 'KC': 0x9932cc, 'FS': 0xffa500,
  'EP': 0xadd8e6, 'SV': 0xaaaaaa, 'FO': 0x228b22
};

// === INIT ===
init();

async function init() {
  await loadPitchData();
  setupScene();
  setupUI();
  animate();
}

async function loadPitchData() {
  const response = await fetch('pitch_data.json');
  pitchData = await response.json();
}

function setupUI() {
  const teamSelect = document.getElementById("teamSelect");
  const batterSelect = document.getElementById("batterSelect");
  const dateSelect = document.getElementById("dateSelect");
  const pitcherSelect = document.getElementById("pitcherSelect");
  const pitchSelect = document.getElementById("pitchSelect");
  const replayBtn = document.getElementById("replayBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const trailToggle = document.getElementById("trailToggle");

  trailToggle.addEventListener("change", () => {
    showTrail = trailToggle.checked;
  });

  replayBtn.addEventListener("click", () => {
    if (currentPitch) throwPitch(currentPitch);
  });

  pauseBtn.addEventListener("click", () => {
    isPaused = !isPaused;
  });

  teamSelect.addEventListener("change", () => {
    const team = teamSelect.value;
    batterSelect.innerHTML = "";
    Object.keys(pitchData[team]).forEach(batter => {
      batterSelect.innerHTML += `<option value="${batter}">${batter}</option>`;
    });
    batterSelect.dispatchEvent(new Event("change"));
  });

  batterSelect.addEventListener("change", () => {
    const team = teamSelect.value;
    const batter = batterSelect.value;
    dateSelect.innerHTML = "";
    Object.keys(pitchData[team][batter]).forEach(date => {
      dateSelect.innerHTML += `<option value="${date}">${date}</option>`;
    });
    dateSelect.dispatchEvent(new Event("change"));
  });

  dateSelect.addEventListener("change", () => {
    const team = teamSelect.value;
    const batter = batterSelect.value;
    const date = dateSelect.value;
    pitcherSelect.innerHTML = "";
    Object.keys(pitchData[team][batter][date]).forEach(pitcher => {
      pitcherSelect.innerHTML += `<option value="${pitcher}">${pitcher}</option>`;
    });
    pitcherSelect.dispatchEvent(new Event("change"));
  });

  pitcherSelect.addEventListener("change", () => {
    const team = teamSelect.value;
    const batter = batterSelect.value;
    const date = dateSelect.value;
    const pitcher = pitcherSelect.value;
    pitchSelect.innerHTML = "";
    const pitches = pitchData[team][batter][date][pitcher];
    pitches.forEach((p, idx) => {
      pitchSelect.innerHTML += `<option value="${idx}">${p.pitch_type} (${p.count})</option>`;
    });
    pitchSelect.dispatchEvent(new Event("change"));
  });

  pitchSelect.addEventListener("change", () => {
    const team = teamSelect.value;
    const batter = batterSelect.value;
    const date = dateSelect.value;
    const pitcher = pitcherSelect.value;
    const index = pitchSelect.value;
    currentPitch = pitchData[team][batter][date][pitcher][index];
    updateScorebug(team, batter, pitcher, currentPitch.count);
  });

  Object.keys(pitchData).forEach(team => {
    teamSelect.innerHTML += `<option value="${team}">${team}</option>`;
  });
  teamSelect.dispatchEvent(new Event("change"));
}

function updateScorebug(team, batter, pitcher, count) {
  document.getElementById("scorebugTeam").textContent = team;
  document.getElementById("scorebugOpponent").textContent = "OPP";
  document.getElementById("scorebugBatter").textContent = batter;
  document.getElementById("scorebugPitcher").textContent = pitcher;
  document.getElementById("scorebugTopBot").textContent = "Top";
  document.getElementById("scorebugInning").textContent = "1";
  document.getElementById("scorebugCount").textContent = count;
}

function setupScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.8, -65);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("three-canvas"), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(light);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 80),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  plate.position.set(0, 0.01, -60.5);
  scene.add(plate);

  const zone = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 2.0, 0.01)),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  zone.position.set(0, 2.5, -60.5);
  scene.add(zone);
}

function throwPitch(pitch) {
  if (ball) scene.remove(ball);
  trailDots.forEach(dot => scene.remove(dot));
  trailDots = [];

  const color = colorMap[pitch.pitch_type] || 0xffffff;
  const geometry = new THREE.SphereGeometry(0.15, 16, 16);
  const material = new THREE.MeshStandardMaterial({ color });
  ball = new THREE.Mesh(geometry, material);
  scene.add(ball);

  const { vx0, vy0, vz0, ax, ay, az, release_pos_x, release_pos_y, release_pos_z } = pitch;
  pitchStartTime = performance.now();
  startTime = performance.now();

  function updateBall() {
    if (!ball) return;

    const t = (performance.now() - startTime) / 1000;
    if (t > totalTime) return;

    const x = release_pos_x + vx0 * t + 0.5 * ax * t * t;
    const y = release_pos_z + vz0 * t + 0.5 * az * t * t;
    const z = release_pos_y + vy0 * t + 0.5 * ay * t * t;

    ball.position.set(x, y, -z);

    if (showTrail) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      dot.position.set(x, y, -z);
      scene.add(dot);
      trailDots.push(dot);
    }

    if (t < totalTime) requestAnimationFrame(updateBall);
  }

  updateBall();
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!isPaused) {
    renderer.render(scene, camera);
  }
}