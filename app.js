import { ChessGameEngine } from './engine.js';

const THEMES = {
  classic: { name: 'Clássico', bg: 0x0f172a, lightSquare: 0xe2d5b5, darkSquare: 0x6e472b, frameColor: 0x3d2314, whitePiece: 0xf8fafc, blackPiece: 0x1e293b, whiteAccent: 0xd4af37, blackAccent: 0x94a3b8, roughness: 0.35, metalness: 0.15, emissive: 0x000000, ambientColor: 0xffffff, dirColor: 0xfff7ed },
  futuristic: { name: 'Futurista', bg: 0x050510, lightSquare: 0x112240, darkSquare: 0x0a1128, frameColor: 0x00f5d4, whitePiece: 0x00f5d4, blackPiece: 0xff007f, whiteAccent: 0xffffff, blackAccent: 0x7b2cbf, roughness: 0.15, metalness: 0.8, emissive: 0x061a2e, ambientColor: 0x3b82f6, dirColor: 0x00f5d4 },
  rural: { name: 'Rural', bg: 0x1a2e1a, lightSquare: 0xdccb9b, darkSquare: 0x5c7c3d, frameColor: 0x5c3a21, whitePiece: 0xfef3c7, blackPiece: 0x78350f, whiteAccent: 0xd97706, blackAccent: 0x65a30d, roughness: 0.75, metalness: 0.05, emissive: 0x000000, ambientColor: 0xfef08a, dirColor: 0xffedd5 },
  feminine: { name: 'Feminino', bg: 0x2a1225, lightSquare: 0xfce7f3, darkSquare: 0xd8b4fe, frameColor: 0xf472b6, whitePiece: 0xfff1f2, blackPiece: 0x9d174d, whiteAccent: 0xfbbf24, blackAccent: 0xf472b6, roughness: 0.2, metalness: 0.35, emissive: 0x1f0918, ambientColor: 0xfbcfe8, dirColor: 0xfff1f2 },
  masculine: { name: 'Masculino', bg: 0x090d16, lightSquare: 0x64748b, darkSquare: 0x1e293b, frameColor: 0x0f172a, whitePiece: 0xe2e8f0, blackPiece: 0x0f172a, whiteAccent: 0xb45309, blackAccent: 0x38bdf8, roughness: 0.25, metalness: 0.75, emissive: 0x000000, ambientColor: 0x94a3b8, dirColor: 0xe2e8f0 },
  cartoon: { name: 'Cartoon', bg: 0x1e3a8a, lightSquare: 0xfef08a, darkSquare: 0x38bdf8, frameColor: 0xef4444, whitePiece: 0xffffff, blackPiece: 0xf97316, whiteAccent: 0x22c55e, blackAccent: 0x6366f1, roughness: 0.1, metalness: 0.0, emissive: 0x000000, ambientColor: 0xffffff, dirColor: 0xffffff },
  bw: { name: 'Preto & Branco', bg: 0x000000, lightSquare: 0xffffff, darkSquare: 0x171717, frameColor: 0x404040, whitePiece: 0xffffff, blackPiece: 0x121212, whiteAccent: 0xa3a3a3, blackAccent: 0x525252, roughness: 0.4, metalness: 0.2, emissive: 0x000000, ambientColor: 0xffffff, dirColor: 0xffffff }
};

if (!window.THREE || !window.Chess) {
  document.body.innerHTML = '<div style="padding:24px;font-family:system-ui;color:white;background:#0b0f19;min-height:100vh">Não foi possível carregar as bibliotecas do jogo. Recarregue a página.</div>';
  throw new Error('Dependências Three.js/Chess.js indisponíveis.');
}

const THREE = window.THREE;
const engine = new ChessGameEngine(window.Chess);
let scene;
let camera;
let renderer;
let controls;
let ambientLight;
let dirLight;
let pointLight;
const boardGroup = new THREE.Group();
const piecesGroup = new THREE.Group();
const highlightsGroup = new THREE.Group();
const particlesGroup = new THREE.Group();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const activeAnimations = [];
const activeParticles = [];
let currentThemeKey = 'classic';
let currentPieceStyleKey = 'match';
let selectedSquare = null;
let legalMovesForSelected = [];
let isAiThinking = false;
let aiTimer = null;
let pointerDown = null;

function squareToWorld(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return new THREE.Vector3(file - 3.5, 0, (7 - rank) - 3.5);
}

function disposeObject(object) {
  object.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
    else node.material?.dispose?.();
  });
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function buildBoard() {
  clearGroup(boardGroup);
  const theme = THEMES[currentThemeKey];
  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.FogExp2(theme.bg, 0.015);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.5, 9.2),
    new THREE.MeshStandardMaterial({ color: theme.frameColor, roughness: Math.min(theme.roughness + 0.1, 1), metalness: theme.metalness })
  );
  frame.position.y = -0.3;
  frame.receiveShadow = true;
  boardGroup.add(frame);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const isLight = (r + f) % 2 === 1;
      const material = new THREE.MeshStandardMaterial({
        color: isLight ? theme.lightSquare : theme.darkSquare,
        roughness: theme.roughness,
        metalness: theme.metalness,
        emissive: theme.emissive
      });
      const square = files[f] + (r + 1);
      const position = squareToWorld(square);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), material);
      mesh.position.set(position.x, -0.1, position.z);
      mesh.receiveShadow = true;
      mesh.userData = { square, isSquare: true };
      boardGroup.add(mesh);
    }
  }
}

function addEyes(group, y, z, material) {
  const geometry = new THREE.SphereGeometry(0.035, 8, 8);
  const left = new THREE.Mesh(geometry, material);
  const right = new THREE.Mesh(geometry.clone(), material);
  left.position.set(-0.06, y, z);
  right.position.set(0.06, y, z);
  group.add(left, right);
}

function createCharacterPiece(type, color) {
  const theme = THEMES[currentThemeKey];
  const styleKey = currentPieceStyleKey === 'match' ? currentThemeKey : currentPieceStyleKey;
  const mainColor = color === 'w' ? theme.whitePiece : theme.blackPiece;
  const accentColor = color === 'w' ? theme.whiteAccent : theme.blackAccent;
  const mainMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: styleKey === 'cartoon' ? 0.15 : theme.roughness, metalness: ['futuristic', 'masculine'].includes(styleKey) ? 0.75 : theme.metalness });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.2, metalness: 0.6, emissive: styleKey === 'futuristic' ? accentColor : 0x000000, emissiveIntensity: styleKey === 'futuristic' ? 0.45 : 0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: styleKey === 'futuristic' ? 0x00ffff : (color === 'w' ? 0x111111 : 0xffffff) });
  const group = new THREE.Group();
  const baseRadius = styleKey === 'cartoon' ? 0.38 : 0.35;
  const segs = ['futuristic', 'masculine'].includes(styleKey) ? 6 : 20;
  const base = new THREE.Mesh(
    ['futuristic', 'masculine'].includes(styleKey)
      ? new THREE.CylinderGeometry(baseRadius * 0.9, baseRadius, 0.14, 6)
      : new THREE.CylinderGeometry(baseRadius * 0.85, baseRadius, 0.14, 24),
    mainMat
  );
  base.position.y = 0.07;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(baseRadius * 0.88, 0.03, 12, 24), accentMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  group.add(ring);

  if (type === 'p') {
    const body = new THREE.Mesh(styleKey === 'feminine' ? new THREE.ConeGeometry(0.24, 0.45, 20) : new THREE.CylinderGeometry(0.14, 0.22, 0.4, segs), mainMat);
    body.position.y = 0.34;
    body.castShadow = true;
    group.add(body);
    const headSize = styleKey === 'cartoon' ? 0.22 : 0.16;
    const head = new THREE.Mesh(styleKey === 'futuristic' ? new THREE.OctahedronGeometry(headSize) : new THREE.SphereGeometry(headSize, segs, segs), mainMat);
    head.position.y = 0.64;
    head.castShadow = true;
    group.add(head);
    if (styleKey === 'rural') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), accentMat);
      brim.position.y = 0.76;
      group.add(brim);
    } else if (['futuristic', 'masculine'].includes(styleKey)) {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.14), accentMat);
      visor.position.set(0, 0.64, 0.08);
      group.add(visor);
    } else if (styleKey === 'cartoon') addEyes(group, 0.66, 0.18, eyeMat);
  } else if (type === 'r') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.65, segs), mainMat);
    tower.position.y = 0.46;
    tower.castShadow = true;
    group.add(tower);
    if (styleKey === 'rural') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 16), accentMat);
      roof.position.y = 0.92;
      group.add(roof);
    } else if (styleKey === 'feminine') {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), accentMat);
      crystal.position.y = 0.95;
      group.add(crystal);
    } else {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.16, segs), accentMat);
      crown.position.y = 0.84;
      group.add(crown);
    }
  } else if (type === 'n') {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.45, 0.32), mainMat);
    torso.position.y = 0.38;
    torso.castShadow = true;
    group.add(torso);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.36), mainMat);
    snout.position.set(0, 0.68, 0.1);
    snout.rotation.x = -0.25;
    snout.castShadow = true;
    group.add(snout);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.12), accentMat);
    mane.position.set(0, 0.58, -0.14);
    group.add(mane);
    if (['feminine', 'cartoon'].includes(styleKey)) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 12), accentMat);
      horn.position.set(0, 0.9, 0.2);
      horn.rotation.x = 0.4;
      group.add(horn);
    }
    addEyes(group, 0.72, 0.16, eyeMat);
  } else if (type === 'b') {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, segs), mainMat);
    robe.position.y = 0.5;
    robe.castShadow = true;
    group.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, segs, segs), mainMat);
    head.position.y = 0.92;
    group.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, segs), accentMat);
    hat.position.y = 1.15;
    group.add(hat);
    if (styleKey === 'cartoon') addEyes(group, 0.92, 0.14, eyeMat);
  } else if (type === 'q') {
    const body = new THREE.Mesh(styleKey === 'feminine' ? new THREE.ConeGeometry(0.34, 0.95, 24) : new THREE.CylinderGeometry(0.18, 0.32, 0.9, segs), mainMat);
    body.position.y = 0.58;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, segs, segs), mainMat);
    head.position.y = 1.12;
    group.add(head);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 12, 20), accentMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 1.28;
    group.add(crown);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), accentMat);
    gem.position.y = 1.38;
    group.add(gem);
    if (['cartoon', 'feminine'].includes(styleKey)) addEyes(group, 1.12, 0.16, eyeMat);
  } else if (type === 'k') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 1, segs), mainMat);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.28), accentMat);
    shoulders.position.y = 1.02;
    group.add(shoulders);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, segs, segs), mainMat);
    head.position.y = 1.22;
    group.add(head);
    if (styleKey === 'rural') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20), accentMat);
      brim.position.y = 1.38;
      group.add(brim);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 16), accentMat);
      hat.position.y = 1.48;
      group.add(hat);
    } else {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.16, 8), accentMat);
      crown.position.y = 1.42;
      group.add(crown);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), accentMat);
      v.position.y = 1.58;
      group.add(v);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), accentMat);
      h.position.y = 1.6;
      group.add(h);
    }
    if (styleKey === 'cartoon') addEyes(group, 1.22, 0.17, eyeMat);
  }

  if (color === 'b') group.rotation.y = Math.PI;
  return group;
}

function syncPiecesWithBoard() {
  clearGroup(piecesGroup);
  const board = engine.board();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r][f];
      if (!piece) continue;
      const square = files[f] + (8 - r);
      const mesh = createCharacterPiece(piece.type, piece.color);
      const position = squareToWorld(square);
      mesh.position.set(position.x, 0, position.z);
      mesh.userData = { square, pieceType: piece.type, pieceColor: piece.color };
      piecesGroup.add(mesh);
    }
  }
  updateUIStatus();
}

function clearHighlights() {
  clearGroup(highlightsGroup);
}

function showLegalHighlights(square) {
  clearHighlights();
  legalMovesForSelected = engine.moves({ square, verbose: true });
  const selected = squareToWorld(square);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(selected.x, 0.02, selected.z);
  highlightsGroup.add(ring);

  for (const move of legalMovesForSelected) {
    const position = squareToWorld(move.to);
    const capture = move.flags.includes('c') || move.flags.includes('e');
    const geometry = capture ? new THREE.RingGeometry(0.34, 0.46, 24) : new THREE.CircleGeometry(0.18, 20);
    const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: capture ? 0xef4444 : 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    marker.rotation.x = Math.PI / 2;
    marker.position.set(position.x, 0.02, position.z);
    marker.userData = { square: move.to, isHighlight: true };
    highlightsGroup.add(marker);
  }
}

function spawnCaptureParticles(position, color) {
  for (let i = 0; i < 22; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color }));
    particle.position.set(position.x, 0.4, position.z);
    const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.16, Math.random() * 0.18 + 0.05, (Math.random() - 0.5) * 0.16);
    particlesGroup.add(particle);
    activeParticles.push({ mesh: particle, vel: velocity, life: 1 });
  }
}

function cancelAiTimer() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  isAiThinking = false;
}

function visualSquare(square) {
  return piecesGroup.children.find((child) => child.userData.square === square) || null;
}

function applyVisualMove(moveObj) {
  const target = squareToWorld(moveObj.to);
  const moving = visualSquare(moveObj.from);
  let capturedSquare = moveObj.to;
  if (moveObj.flags.includes('e')) capturedSquare = moveObj.to[0] + moveObj.from[1];
  const captured = visualSquare(capturedSquare);

  if (moveObj.captured) {
    spawnCaptureParticles(target, THEMES[currentThemeKey].whiteAccent);
    if (captured) {
      piecesGroup.remove(captured);
      disposeObject(captured);
    }
  }

  if (!moving || moveObj.flags.includes('k') || moveObj.flags.includes('q') || moveObj.flags.includes('p')) {
    syncPiecesWithBoard();
    return;
  }

  const start = moving.position.clone();
  moving.userData.square = moveObj.to;
  activeAnimations.push({ mesh: moving, start, end: target, progress: 0 });
}

function executeMove(from, to, { scheduleAi = true } = {}) {
  if (engine.gameOver()) return false;
  const moveObj = engine.move(from, to, 'q');
  if (!moveObj) return false;

  clearHighlights();
  selectedSquare = null;
  legalMovesForSelected = [];
  applyVisualMove(moveObj);
  rebuildMoveLog();
  updateUIStatus();

  if (scheduleAi && !engine.gameOver() && engine.mode === 'ai' && engine.turn() === 'b') {
    isAiThinking = true;
    updateUIStatus();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      triggerAiMove();
    }, 450);
  }
  return true;
}

function triggerAiMove() {
  if (engine.gameOver() || engine.turn() !== 'b') {
    isAiThinking = false;
    updateUIStatus();
    return false;
  }
  isAiThinking = true;
  updateUIStatus();
  const chosen = engine.chooseAiMove();
  isAiThinking = false;
  if (!chosen) {
    updateUIStatus();
    return false;
  }
  return executeMove(chosen.from, chosen.to, { scheduleAi: false });
}

function updateUIStatus() {
  const turnDot = document.querySelector('#turn-dot');
  const turnText = document.querySelector('#turn-text');
  const badge = document.querySelector('#game-status');
  const white = engine.turn() === 'w';
  turnDot.style.background = white ? '#ffffff' : '#1e293b';
  turnDot.style.boxShadow = white ? '0 0 10px #ffffff' : '0 0 10px #6366f1';
  turnText.textContent = isAiThinking ? '🤖 Máquina pensando...' : (white ? 'Vez das Brancas' : 'Vez das Pretas');

  if (engine.inCheckmate()) {
    badge.textContent = `🏆 Xeque-Mate! Vitória das ${white ? 'Pretas' : 'Brancas'}`;
    badge.style.background = 'rgba(239, 68, 68, 0.3)';
    badge.style.borderColor = '#ef4444';
  } else if (engine.inDraw()) {
    badge.textContent = '🤝 Empate!';
    badge.style.background = 'rgba(234, 179, 8, 0.3)';
    badge.style.borderColor = '#eab308';
  } else if (engine.inCheck()) {
    badge.textContent = '⚠️ XEQUE!';
    badge.style.background = 'rgba(249, 115, 22, 0.35)';
    badge.style.borderColor = '#f97316';
  } else {
    badge.textContent = `Tema: ${THEMES[currentThemeKey].name}`;
    badge.style.background = 'rgba(99, 102, 241, 0.2)';
    badge.style.borderColor = '#6366f1';
  }
}

function rebuildMoveLog() {
  const log = document.querySelector('#move-log');
  const history = engine.history({ verbose: true });
  log.innerHTML = '';
  if (!history.length) {
    log.innerHTML = '<div class="empty-log">Clique em uma peça branca para iniciar a partida.</div>';
    return;
  }
  for (let i = 0; i < history.length; i += 2) {
    const white = history[i];
    const black = history[i + 1];
    const row = document.createElement('div');
    row.className = 'move-entry';
    row.innerHTML = `<span>${Math.floor(i / 2) + 1}. ${white?.san || '...'}</span><span>${black?.san || '...'}</span>`;
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}

function resetGame() {
  cancelAiTimer();
  engine.reset();
  selectedSquare = null;
  clearHighlights();
  rebuildMoveLog();
  syncPiecesWithBoard();
}

function undoMove() {
  if (isAiThinking) cancelAiTimer();
  const undone = engine.undoForCurrentMode();
  if (!undone.length) return false;
  selectedSquare = null;
  clearHighlights();
  rebuildMoveLog();
  syncPiecesWithBoard();
  return true;
}

function setCameraView(view) {
  if (view === 'white') camera.position.set(0, 12, 13);
  if (view === 'black') camera.position.set(0, 12, -13);
  if (view === 'top') camera.position.set(0, 20, 0.01);
  if (view === 'iso') camera.position.set(13, 13, 13);
  controls.target.set(0, 0, 0);
  controls.update();
}

function updateSliders(dirValue, ambientValue, x, z) {
  const values = { 'light-dir-intensity': dirValue, 'light-amb-intensity': ambientValue, 'light-pos-x': x, 'light-pos-z': z };
  for (const [id, value] of Object.entries(values)) document.querySelector(`#${id}`).value = value;
  dirLight.intensity = dirValue;
  ambientLight.intensity = ambientValue;
  dirLight.position.x = x;
  dirLight.position.z = z;
  document.querySelector('#val-dir').textContent = dirValue;
  document.querySelector('#val-amb').textContent = ambientValue;
  document.querySelector('#val-pos-x').textContent = x;
  document.querySelector('#val-pos-z').textContent = z;
}

function applyLightPreset(preset) {
  if (preset === 'studio') {
    dirLight.color.setHex(0xffffff);
    ambientLight.color.setHex(0xffffff);
    updateSliders(1.5, 0.7, 12, 15);
  } else if (preset === 'sunset') {
    dirLight.color.setHex(0xff7b00);
    ambientLight.color.setHex(0xfde047);
    updateSliders(2, 0.4, 22, 8);
  } else if (preset === 'neon') {
    dirLight.color.setHex(0x00f5d4);
    ambientLight.color.setHex(0xff007f);
    updateSliders(1.8, 0.8, -15, 15);
  } else if (preset === 'dramatic') {
    dirLight.color.setHex(0xe2e8f0);
    ambientLight.color.setHex(0x1e293b);
    updateSliders(2.4, 0.2, 5, 20);
  }
}

function findSquareFromPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([...piecesGroup.children, ...boardGroup.children, ...highlightsGroup.children], true);
  if (!intersects.length) return null;
  let object = intersects[0].object;
  while (object && !object.userData?.square) object = object.parent;
  return object?.userData?.square || null;
}

function onPointerDown(event) {
  pointerDown = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (!pointerDown) return;
  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (distance > 7 || isAiThinking || engine.gameOver()) return;
  if (engine.mode === 'ai' && engine.turn() === 'b') return;

  const square = findSquareFromPointer(event);
  if (!square) return;
  if (selectedSquare && legalMovesForSelected.some((move) => move.to === square)) {
    executeMove(selectedSquare, square);
    return;
  }
  const piece = engine.get(square);
  if (piece && piece.color === engine.turn()) {
    selectedSquare = square;
    showLegalHighlights(square);
  } else {
    selectedSquare = null;
    clearHighlights();
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function initResponsivePanels() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.querySelector('#sidebar').classList.add('collapsed');
    document.querySelector('#right-panel').classList.add('collapsed');
  }
}

function bindUI() {
  document.querySelector('#theme-select').addEventListener('change', (event) => {
    currentThemeKey = event.target.value;
    const theme = THEMES[currentThemeKey];
    ambientLight.color.setHex(theme.ambientColor);
    dirLight.color.setHex(theme.dirColor);
    buildBoard();
    syncPiecesWithBoard();
  });

  document.querySelector('#piece-style-select').addEventListener('change', (event) => {
    currentPieceStyleKey = event.target.value;
    syncPiecesWithBoard();
  });

  document.querySelector('#game-mode-select').addEventListener('change', (event) => {
    cancelAiTimer();
    engine.setMode(event.target.value);
    if (engine.mode === 'ai' && engine.turn() === 'b' && !engine.gameOver()) {
      isAiThinking = true;
      updateUIStatus();
      aiTimer = setTimeout(() => { aiTimer = null; triggerAiMove(); }, 350);
    }
  });

  document.querySelectorAll('#difficulty-btns button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#difficulty-btns button').forEach((item) => item.classList.remove('active-btn'));
      button.classList.add('active-btn');
      engine.setDifficulty(button.dataset.diff);
    });
  });

  document.querySelectorAll('[data-camera]').forEach((button) => button.addEventListener('click', () => setCameraView(button.dataset.camera)));
  document.querySelectorAll('[data-light]').forEach((button) => button.addEventListener('click', () => applyLightPreset(button.dataset.light)));
  document.querySelector('#reset-btn').addEventListener('click', resetGame);
  document.querySelector('#undo-btn').addEventListener('click', undoMove);

  document.querySelector('#toggle-btn').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('collapsed'));
  document.querySelector('#toggle-history-btn').addEventListener('click', () => document.querySelector('#right-panel').classList.toggle('collapsed'));

  ['light-dir-intensity', 'light-amb-intensity', 'light-pos-x', 'light-pos-z'].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener('input', () => updateSliders(
      Number(document.querySelector('#light-dir-intensity').value),
      Number(document.querySelector('#light-amb-intensity').value),
      Number(document.querySelector('#light-pos-x').value),
      Number(document.querySelector('#light-pos-z').value)
    ));
  });
}

function animate() {
  requestAnimationFrame(animate);
  for (let i = activeAnimations.length - 1; i >= 0; i -= 1) {
    const animation = activeAnimations[i];
    animation.progress += 0.08;
    if (animation.progress >= 1) {
      animation.mesh.position.copy(animation.end);
      animation.mesh.position.y = 0;
      activeAnimations.splice(i, 1);
    } else {
      animation.mesh.position.lerpVectors(animation.start, animation.end, animation.progress);
      animation.mesh.position.y = Math.sin(animation.progress * Math.PI) * 0.65;
    }
  }
  for (let i = activeParticles.length - 1; i >= 0; i -= 1) {
    const particle = activeParticles[i];
    particle.mesh.position.add(particle.vel);
    particle.vel.y -= 0.008;
    particle.life -= 0.03;
    particle.mesh.scale.setScalar(Math.max(particle.life, 0.01));
    if (particle.life <= 0) {
      particlesGroup.remove(particle.mesh);
      disposeObject(particle.mesh);
      activeParticles.splice(i, 1);
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

function initScene() {
  const container = document.querySelector('#canvas-container');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(THEMES[currentThemeKey].bg);
  scene.fog = new THREE.FogExp2(THEMES[currentThemeKey].bg, 0.015);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 14, 14);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 6;
  controls.maxDistance = 32;
  controls.target.set(0, 0, 0);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
  dirLight.position.set(12, 20, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 60;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  scene.add(dirLight);
  pointLight = new THREE.PointLight(0x6366f1, 0.5, 30);
  pointLight.position.set(-10, 8, -10);
  scene.add(pointLight);
  scene.add(boardGroup, piecesGroup, highlightsGroup, particlesGroup);

  buildBoard();
  syncPiecesWithBoard();
  rebuildMoveLog();
  bindUI();
  initResponsivePanels();
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  animate();
}

window.__chess2026 = {
  move: (from, to) => executeMove(from, to),
  reset: resetGame,
  undo: undoMove,
  setMode: (mode) => {
    cancelAiTimer();
    engine.setMode(mode);
    document.querySelector('#game-mode-select').value = mode;
  },
  setDifficulty: (difficulty) => {
    engine.setDifficulty(difficulty);
    document.querySelectorAll('#difficulty-btns button').forEach((button) => button.classList.toggle('active-btn', button.dataset.diff === difficulty));
  },
  triggerAi: triggerAiMove,
  loadFen: (fen) => {
    cancelAiTimer();
    const loaded = engine.load(fen);
    if (!loaded) return false;
    clearHighlights();
    selectedSquare = null;
    rebuildMoveLog();
    syncPiecesWithBoard();
    return true;
  },
  history: () => engine.history(),
  turn: () => engine.turn(),
  gameOver: () => engine.gameOver(),
  checkmate: () => engine.inCheckmate(),
  pieceAt: (square) => engine.get(square),
  pieceCount: () => piecesGroup.children.length,
  visualHasSquare: (square) => Boolean(visualSquare(square)),
  fen: () => engine.fen()
};

initScene();
window.__CHESS_2026_READY__ = true;
