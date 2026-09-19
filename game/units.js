// 유닛 정의 (스탯). 아트는 추후 스프라이트로 교체 예정 — 지금은 color/label만 사용.
const UNIT_TYPES = [
  {
    id: 'cat',
    name: '고양이',
    cost: 10,
    hp: 60,
    atk: 8,
    atkInterval: 1000, // ms
    speed: 8, // pos/sec (레인은 0~100)
    color: '#d9a066',
    label: '냥',
  },
  {
    id: 'shieldcat',
    name: '방패 고양이',
    cost: 20,
    hp: 140,
    atk: 4,
    atkInterval: 1200,
    speed: 5,
    color: '#5c8fd9',
    label: '방',
  },
];

function getUnitType(id) {
  return UNIT_TYPES.find((t) => t.id === id);
}

module.exports = { UNIT_TYPES, getUnitType };
