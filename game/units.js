// 유닛 정의 (스탯). 아트는 추후 스프라이트로 교체 예정 — 지금은 color/label만 사용.
const UNIT_TYPES = [
  {
    id: 'basic',
    name: '기본병',
    cost: 10,
    hp: 50,
    atk: 5,
    atkInterval: 1000, // ms
    speed: 8, // pos/sec (레인은 0~100)
    color: '#9e9e9e',
    label: '기',
  },
  {
    id: 'tank',
    name: '방패병',
    cost: 40,
    hp: 220,
    atk: 6,
    atkInterval: 1200,
    speed: 4,
    color: '#4a7dd6',
    label: '방',
  },
  {
    id: 'attacker',
    name: '딜러',
    cost: 35,
    hp: 40,
    atk: 26,
    atkInterval: 1000,
    speed: 6,
    color: '#d6544a',
    label: '딜',
  },
  {
    id: 'rusher',
    name: '스피드병',
    cost: 20,
    hp: 25,
    atk: 8,
    atkInterval: 800,
    speed: 14,
    color: '#d6c04a',
    label: '스',
  },
];

function getUnitType(id) {
  return UNIT_TYPES.find((t) => t.id === id);
}

module.exports = { UNIT_TYPES, getUnitType };
