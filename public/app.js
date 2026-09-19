const socket = io({ path: '/zzapko/socket.io/' });

const menuScreen = document.getElementById('menu-screen');
const battleScreen = document.getElementById('battle-screen');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverTitle = document.getElementById('gameover-title');
const queueStatus = document.getElementById('queue-status');

const startBattleBtn = document.getElementById('start-battle-btn');
const battleSelectPanel = document.getElementById('battle-select-panel');
const battleSelectClose = document.getElementById('battle-select-close');
const singleBtn = document.getElementById('single-btn');
const pvpBtn = document.getElementById('pvp-btn');
const leaveBtn = document.getElementById('leave-btn');
const gameoverMenuBtn = document.getElementById('gameover-menu-btn');

const formationBtn = document.getElementById('formation-btn');
const formationPanel = document.getElementById('formation-panel');
const formationList = document.getElementById('formation-list');
const formationError = document.getElementById('formation-error');
const formationSaveBtn = document.getElementById('formation-save-btn');
const formationCloseBtn = document.getElementById('formation-close-btn');

const lane = document.getElementById('lane');
const leftHpBar = document.getElementById('left-hp-bar');
const rightHpBar = document.getElementById('right-hp-bar');
const moneyValue = document.getElementById('money-value');
const unitButtonsEl = document.getElementById('unit-buttons');

const LOADOUT_KEY = 'zzapko_loadout';

let mySide = null;
let catalogUnits = []; // 서버 전체 유닛 목록 (내 것/상대 것 렌더링용)
let myUnitTypes = []; // 이번 전투에 내가 들고 온 유닛 목록 (버튼용)
let loadout = []; // 편성에서 고른 유닛 id 목록
let lastMoney = 0;
const unitEls = new Map(); // unitId -> DOM element

function loadStoredLoadout() {
  try {
    const raw = localStorage.getItem(LOADOUT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredLoadout(ids) {
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(ids));
  } catch {
    // localStorage 사용 불가 시 무시 (이번 세션만 유지)
  }
}

function renderFormationList() {
  formationList.innerHTML = '';
  catalogUnits.forEach((type) => {
    const row = document.createElement('label');
    row.className = 'formation-row';
    row.innerHTML = `
      <input type="checkbox" data-unit-id="${type.id}" ${loadout.includes(type.id) ? 'checked' : ''} />
      <span class="formation-swatch" style="background:${type.color}">${type.label}</span>
      <span class="formation-name">${type.name}</span>
      <span class="formation-cost">${type.cost}원</span>
    `;
    formationList.appendChild(row);
  });
}

function showScreen(name) {
  menuScreen.classList.toggle('hidden', name !== 'menu');
  battleScreen.classList.toggle('hidden', name !== 'battle');
  if (name !== 'gameover') gameoverOverlay.classList.add('hidden');
}

function resetBattleUI() {
  unitEls.forEach((el) => el.remove());
  unitEls.clear();
  leftHpBar.style.width = '100%';
  rightHpBar.style.width = '100%';
  moneyValue.textContent = '0';
}

function renderUnitButtons(units) {
  unitButtonsEl.innerHTML = '';
  units.forEach((type) => {
    const btn = document.createElement('button');
    btn.className = 'unit-btn';
    btn.style.background = type.color;
    btn.dataset.unitId = type.id;
    btn.innerHTML = `<span class="unit-btn-name">${type.name}</span><span class="unit-btn-cost">${type.cost}원</span>`;
    btn.addEventListener('click', () => socket.emit('spawn', type.id));
    unitButtonsEl.appendChild(btn);
  });
}

function updateUnitButtonsState() {
  unitButtonsEl.querySelectorAll('.unit-btn').forEach((btn) => {
    const type = myUnitTypes.find((t) => t.id === btn.dataset.unitId);
    btn.disabled = !type || lastMoney < type.cost;
  });
}

function typeById(id) {
  return catalogUnits.find((t) => t.id === id);
}

function ensureUnitEl(unit) {
  let el = unitEls.get(unit.id);
  if (!el) {
    const type = typeById(unit.type);
    el = document.createElement('div');
    el.className = 'unit';
    el.style.background = type ? type.color : '#fff';
    el.innerHTML = `<div class="unit-hp-bg"><div class="unit-hp-fill"></div></div><span class="unit-label"></span>`;
    el.querySelector('.unit-label').textContent = type ? type.label : '?';
    lane.appendChild(el);
    unitEls.set(unit.id, el);
  }
  return el;
}

function renderState(state) {
  const mine = state.sides[mySide];
  const enemyKey = mySide === 'left' ? 'right' : 'left';
  const enemy = state.sides[enemyKey];

  lastMoney = mine.money;
  moneyValue.textContent = Math.floor(mine.money);
  updateUnitButtonsState();

  leftHpBar.style.width = `${(state.sides.left.baseHp / state.sides.left.maxBaseHp) * 100}%`;
  rightHpBar.style.width = `${(state.sides.right.baseHp / state.sides.right.maxBaseHp) * 100}%`;

  const seen = new Set();
  const allUnits = [...state.sides.left.units, ...state.sides.right.units];
  allUnits.forEach((unit) => {
    seen.add(unit.id);
    const el = ensureUnitEl(unit);
    el.style.left = `${unit.pos}%`;
    const hpFill = el.querySelector('.unit-hp-fill');
    hpFill.style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;
  });

  unitEls.forEach((el, id) => {
    if (!seen.has(id)) {
      el.remove();
      unitEls.delete(id);
    }
  });
}

startBattleBtn.addEventListener('click', () => {
  battleSelectPanel.classList.remove('hidden');
});

battleSelectClose.addEventListener('click', () => {
  battleSelectPanel.classList.add('hidden');
  queueStatus.classList.add('hidden');
});

singleBtn.addEventListener('click', () => {
  queueStatus.classList.add('hidden');
  socket.emit('single:start', { loadout });
});

pvpBtn.addEventListener('click', () => {
  socket.emit('pvp:queue', { loadout });
});

formationBtn.addEventListener('click', () => {
  renderFormationList();
  formationError.classList.add('hidden');
  formationPanel.classList.remove('hidden');
});

formationCloseBtn.addEventListener('click', () => {
  formationPanel.classList.add('hidden');
});

formationSaveBtn.addEventListener('click', () => {
  const checked = Array.from(formationList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.dataset.unitId
  );
  if (checked.length === 0) {
    formationError.classList.remove('hidden');
    return;
  }
  loadout = checked;
  saveStoredLoadout(loadout);
  formationPanel.classList.add('hidden');
});

leaveBtn.addEventListener('click', () => {
  socket.emit('leave');
  resetBattleUI();
  showScreen('menu');
});

gameoverMenuBtn.addEventListener('click', () => {
  resetBattleUI();
  showScreen('menu');
});

socket.on('unitCatalog', (units) => {
  catalogUnits = units;
  loadout = loadStoredLoadout().filter((id) => catalogUnits.some((t) => t.id === id));
  if (loadout.length === 0) loadout = catalogUnits.map((t) => t.id);
});

socket.on('queueWaiting', () => {
  queueStatus.classList.remove('hidden');
});

socket.on('matchStart', ({ side, allUnits, myUnits }) => {
  mySide = side;
  catalogUnits = allUnits;
  myUnitTypes = myUnits;
  resetBattleUI();
  renderUnitButtons(myUnits);
  queueStatus.classList.add('hidden');
  battleSelectPanel.classList.add('hidden');
  showScreen('battle');
});

socket.on('state', (state) => {
  if (!mySide) return;
  renderState(state);
});

socket.on('gameOver', ({ winner }) => {
  const won = winner === mySide;
  gameoverTitle.textContent = won ? '승리!' : '패배...';
  gameoverOverlay.classList.remove('hidden');
});
