import { computeDynamicTreeLayout } from '../src/utils/treeLayout/index.ts';
import { DEFAULT_STAGE } from '../src/utils/treeLayout/stageBounds.ts';

const members = [];
let id = 1;
members.push({ id: id++, fullName: 'Founder', fatherId: null, motherId: null, generation: 1, initial: 'F', isFamilyHead: true });
const g2: number[] = [];
for (let i = 0; i < 6; i++) {
  g2.push(id);
  members.push({ id: id++, fullName: `G2-${i}`, fatherId: 1, motherId: null, generation: 2, initial: '2' });
}
const g3: number[] = [];
g2.forEach((pid, bi) => {
  for (let i = 0; i < 4; i++) {
    g3.push(id);
    members.push({ id: id++, fullName: `G3-${bi}-${i}`, fatherId: pid, motherId: null, generation: 3, initial: '3' });
  }
});
const g4: number[] = [];
g3.forEach((pid) => {
  for (let i = 0; i < 2; i++) {
    g4.push(id);
    members.push({ id: id++, fullName: `G4-${id}`, fatherId: pid, motherId: null, generation: 4, initial: '4' });
  }
});
g4.slice(0, 21).forEach((pid) => {
  members.push({ id: id++, fullName: `G5-${id}`, fatherId: pid, motherId: null, generation: 5, initial: '5' });
});

const stage = { ...DEFAULT_STAGE, width: 1500, height: 820 };
const layout = computeDynamicTreeLayout(members, stage);
console.log('members', layout.members.length);
console.log('canvas', layout.canvasWidth, layout.canvasHeight);
console.log('card', layout.scale.cardWidth, layout.scale.cardHeight);
console.log('validation', layout.validation);
console.log('bounds', layout.contentBounds);
