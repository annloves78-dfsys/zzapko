const { UNIT_TYPES, getUnitType } = require('./units');

const TICK_MS = 100;
const START_MONEY = 100;
const MAX_MONEY = 999;
const MONEY_PER_SEC = 6;
const BASE_HP = 1000;
const ENGAGE_RANGE = 3;
const SPAWN_POS_LEFT = 3;
const SPAWN_POS_RIGHT = 97;
const BASE_ATTACK_POS_RIGHT = 95; // 왼쪽 유닛이 이 위치 이상이면 오른쪽 기지 공격
const BASE_ATTACK_POS_LEFT = 5; // 오른쪽 유닛이 이 위치 이하면 왼쪽 기지 공격

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function makeSide() {
  return { money: START_MONEY, baseHp: BASE_HP, maxBaseHp: BASE_HP, units: [] };
}

class Match {
  constructor(id, mode, io) {
    this.id = id;
    this.mode = mode; // 'single' | 'pvp'
    this.io = io;
    this.room = `match:${id}`;
    this.winner = null;
    this.nextUnitId = 1;
    this.interval = null;
    this.aiCooldown = 1000;
    this.sides = { left: makeSide(), right: makeSide() };
  }

  start() {
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  spawnUnit(sideKey, unitTypeId) {
    if (this.winner) return false;
    const type = getUnitType(unitTypeId);
    const side = this.sides[sideKey];
    if (!type || !side) return false;
    if (side.money < type.cost) return false;

    side.money -= type.cost;
    side.units.push({
      id: this.nextUnitId++,
      type: type.id,
      hp: type.hp,
      maxHp: type.hp,
      atk: type.atk,
      atkInterval: type.atkInterval,
      speed: type.speed,
      pos: sideKey === 'left' ? SPAWN_POS_LEFT : SPAWN_POS_RIGHT,
      cooldown: 0,
    });
    return true;
  }

  runAI(dt) {
    this.aiCooldown -= dt * 1000;
    if (this.aiCooldown > 0) return;
    const money = this.sides.right.money;
    const affordable = UNIT_TYPES.filter((t) => t.cost <= money);
    if (affordable.length > 0) {
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      this.spawnUnit('right', pick.id);
    }
    this.aiCooldown = 800 + Math.random() * 1200;
  }

  stepSide(mine, enemies, enemySide, dir, dt) {
    for (const u of mine) {
      if (u.cooldown > 0) u.cooldown = Math.max(0, u.cooldown - dt * 1000);

      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.abs(e.pos - u.pos);
        if (d <= ENGAGE_RANGE && d < nearestDist) {
          nearest = e;
          nearestDist = d;
        }
      }

      const atBase = dir > 0 ? u.pos >= BASE_ATTACK_POS_RIGHT : u.pos <= BASE_ATTACK_POS_LEFT;

      if (nearest) {
        if (u.cooldown <= 0) {
          nearest.hp -= u.atk;
          u.cooldown = u.atkInterval;
        }
      } else if (atBase) {
        if (u.cooldown <= 0) {
          enemySide.baseHp = Math.max(0, enemySide.baseHp - u.atk);
          u.cooldown = u.atkInterval;
        }
      } else {
        u.pos = clamp(u.pos + dir * u.speed * dt, 0, 100);
      }
    }
  }

  tick() {
    if (this.winner) return;
    const dt = TICK_MS / 1000;
    const { left, right } = this.sides;

    left.money = Math.min(MAX_MONEY, left.money + MONEY_PER_SEC * dt);
    right.money = Math.min(MAX_MONEY, right.money + MONEY_PER_SEC * dt);

    if (this.mode === 'single') this.runAI(dt);

    this.stepSide(left.units, right.units, right, 1, dt);
    this.stepSide(right.units, left.units, left, -1, dt);

    left.units = left.units.filter((u) => u.hp > 0);
    right.units = right.units.filter((u) => u.hp > 0);

    if (left.baseHp <= 0 || right.baseHp <= 0) {
      this.winner = left.baseHp <= 0 ? 'right' : 'left';
      this.broadcast();
      this.io.to(this.room).emit('gameOver', { winner: this.winner });
      this.stop();
      return;
    }

    this.broadcast();
  }

  serialize() {
    return {
      winner: this.winner,
      sides: {
        left: {
          money: Math.floor(this.sides.left.money),
          baseHp: Math.round(this.sides.left.baseHp),
          maxBaseHp: this.sides.left.maxBaseHp,
          units: this.sides.left.units,
        },
        right: {
          money: Math.floor(this.sides.right.money),
          baseHp: Math.round(this.sides.right.baseHp),
          maxBaseHp: this.sides.right.maxBaseHp,
          units: this.sides.right.units,
        },
      },
    };
  }

  broadcast() {
    this.io.to(this.room).emit('state', this.serialize());
  }
}

module.exports = { Match };
