import type { FamilyTreeMapPerson } from '../components/family-tree-map/FamilyTreeMap';
import {
  REFERENCE_81_BRANCH_NAMES,
  REFERENCE_81_COUNTS,
  REFERENCE_81_NAME_POOL,
  REFERENCE_81_TOTAL,
} from '../data/reference81TreeSpec';

/** Build the 81-member reference tree for map preview / demo mode. */
export function generateReference81People(): FamilyTreeMapPerson[] {
  const people: FamilyTreeMapPerson[] = [];
  let id = 1;
  let nameIndex = 0;

  const nextName = (): string => {
    const name = REFERENCE_81_NAME_POOL[nameIndex % REFERENCE_81_NAME_POOL.length];
    nameIndex += 1;
    return name;
  };

  people.push({
    id: id++,
    name: 'الفاروق',
    parentId: null,
    childrenCount: REFERENCE_81_BRANCH_NAMES.length,
  });
  const founderId = 1;

  const gen2Ids: number[] = [];
  REFERENCE_81_BRANCH_NAMES.forEach((branchName, branchIndex) => {
    gen2Ids.push(id);
    people.push({
      id: id++,
      name: branchName,
      parentId: founderId,
      childrenCount: REFERENCE_81_COUNTS.gen3PerGen2[branchIndex] ?? REFERENCE_81_COUNTS.gen3PerGen2[0],
    });
  });

  const gen3Ids: number[] = [];
  gen2Ids.forEach((parentId, branchIndex) => {
    const count = REFERENCE_81_COUNTS.gen3PerGen2[branchIndex] ?? REFERENCE_81_COUNTS.gen3PerGen2[0];
    for (let index = 0; index < count; index += 1) {
      gen3Ids.push(id);
      people.push({
        id: id++,
        name: nextName(),
        parentId,
        childrenCount: 0,
      });
    }
  });

  // Fix childrenCount for gen3 after we know gen4 distribution
  gen3Ids.forEach((personId, index) => {
    const person = people.find((item) => item.id === personId);
    if (person) {
      person.childrenCount = REFERENCE_81_COUNTS.gen4PerGen3[index] ?? 0;
    }
  });

  const gen4Ids: number[] = [];
  gen3Ids.forEach((parentId, parentIndex) => {
    const count = REFERENCE_81_COUNTS.gen4PerGen3[parentIndex] ?? 0;
    for (let index = 0; index < count; index += 1) {
      gen4Ids.push(id);
      people.push({
        id: id++,
        name: nextName(),
        parentId,
        childrenCount: 0,
      });
    }
  });

  gen4Ids.forEach((personId, index) => {
    const person = people.find((item) => item.id === personId);
    if (person) {
      person.childrenCount = REFERENCE_81_COUNTS.gen5PerGen4[index] ?? 0;
    }
  });

  const gen5Ids: number[] = [];
  gen4Ids.forEach((parentId, parentIndex) => {
    const count = REFERENCE_81_COUNTS.gen5PerGen4[parentIndex] ?? 0;
    for (let index = 0; index < count; index += 1) {
      gen5Ids.push(id);
      people.push({
        id: id++,
        name: nextName(),
        parentId,
        childrenCount: 0,
      });
    }
  });

  gen5Ids.forEach((personId, index) => {
    const person = people.find((item) => item.id === personId);
    if (person) {
      person.childrenCount = REFERENCE_81_COUNTS.gen6PerGen5[index] ?? 0;
    }
  });

  gen5Ids.forEach((parentId, parentIndex) => {
    const count = REFERENCE_81_COUNTS.gen6PerGen5[parentIndex] ?? 0;
    for (let index = 0; index < count; index += 1) {
      people.push({
        id: id++,
        name: nextName(),
        parentId,
        childrenCount: 0,
      });
    }
  });

  if (people.length !== REFERENCE_81_TOTAL) {
    throw new Error(`Expected ${REFERENCE_81_TOTAL} reference members, got ${people.length}`);
  }

  return people;
}
