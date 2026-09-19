const socket = io({ path: '/zzapko/socket.io/' });

const menuScreen = document.getElementById('menu-screen');
const battleScreen = document.getElementById('battle-screen');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverTitle = document.getElementById('gameover-title');
const queueStatus = document.getElementById('queue-status');

const singleBtn = document.getElementById('single-btn');
const pvpBtn = document.getElementById('pvp-btn');
const leaveBtn = document.getElementById('leave-btn');
const gameoverMenuBtn = document.getElementById('gameover-menu-btn');

const lane = document.getElementById('lane');
const leftHpBar = document.getElementById('left-hp-bar');
const rightHpBar = document.getElementById('right-hp-bar');
const moneyValue = document.getElementById('money-value');
const unitButtonsEl = document.getElementById('unit-buttons');

let mySide = null;
let unitTypes = [];
let lastMoney = 0;
const unitEls = new Map(); // unitId -> DOM element

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
    const type = unitTypes.find((t) => t.id === btn.dataset.unitId);
    btn.disabled = !type || lastMoney < type.cost;
  });
}

function typeById(id) {
  return unitTypes.find((t) => t.id === id);
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

singleBtn.addEventListener('click', () => {
  queueStatus.classList.add('hidden');
  socket.emit('single:start');
});

pvpBtn.addEventListener('click', () => {
  socket.emit('pvp:queue');
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

socket.on('queueWaiting', () => {
  queueStatus.classList.remove('hidden');
});

socket.on('matchStart', ({ side, units }) => {
  mySide = side;
  unitTypes = units;
  resetBattleUI();
  renderUnitButtons(units);
  queueStatus.classList.add('hidden');
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
