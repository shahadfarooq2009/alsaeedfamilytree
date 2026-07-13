import type { TreePersonNode } from '../types/tree';
import { computeTreeLayout, findOverlappingNodes } from './treeLayout';

function founder(id: number, name: string, children: TreePersonNode[] = []): TreePersonNode {
  return {
    id,
    full_name: name,
    generation_number: 0,
    gender: 'male',
    photo_url: null,
    father_id: null,
    mother_id: null,
    birth_date: '1940-01-01',
    death_date: null,
    is_family_head: true,
    children,
  };
}

function person(
  id: number,
  name: string,
  generation: number,
  fatherId: number,
  children: TreePersonNode[] = [],
): TreePersonNode {
  return {
    id,
    full_name: name,
    generation_number: generation,
    gender: 'male',
    photo_url: null,
    father_id: fatherId,
    mother_id: null,
    birth_date: '1970-01-01',
    death_date: null,
    children,
  };
}

export const layoutSamples = {
  onePerson: (): TreePersonNode[] => [founder(1, 'المؤسس')],

  founderPlusTwoChildren: (): TreePersonNode[] => [
    founder(1, 'المؤسس', [
      person(2, 'الابن الأول', 1, 1),
      person(3, 'الابن الثاني', 1, 1),
    ]),
  ],

  threeGenerations: (): TreePersonNode[] => [
    founder(1, 'المؤسس', [
      person(2, 'الابن', 1, 1, [
        person(4, 'الحفيد الأول', 2, 2),
        person(5, 'الحفيد الثاني', 2, 2),
      ]),
      person(3, 'البنت', 1, 1, [person(6, 'حفيد البنت', 2, 3)]),
    ]),
  ],

  twentyPeople: (): TreePersonNode[] => {
    let nextId = 1;
    const make = (
      name: string,
      generation: number,
      fatherId: number | null,
      isHead = false,
      childCount = 0,
    ): TreePersonNode => {
      const id = nextId++;
      const node: TreePersonNode = {
        id,
        full_name: name,
        generation_number: generation,
        gender: 'male',
        photo_url: null,
        father_id: fatherId,
        mother_id: null,
        birth_date: '1980-01-01',
        death_date: null,
        is_family_head: isHead,
        children: [],
      };

      for (let i = 0; i < childCount; i += 1) {
        node.children.push(
          make(`فرد ${id}-${i + 1}`, generation + 1, id, false, generation < 2 ? 2 : 0),
        );
      }

      return node;
    };

    return [make('المؤسس الكبير', 0, null, true, 3)];
  },
};

export function validateLayoutSamples(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let passed = true;

  Object.entries(layoutSamples).forEach(([name, factory]) => {
    const layout = computeTreeLayout(factory());
    const overlaps = findOverlappingNodes(layout.nodes);
    const xs = new Set(layout.nodes.map((node) => Math.round(node.worldX)));
    const ys = new Set(layout.nodes.map((node) => Math.round(node.worldY)));

    const ok = overlaps.length === 0;
    if (!ok) {
      passed = false;
    }

    results.push(
      `${name}: nodes=${layout.nodes.length}, uniqueX=${xs.size}, uniqueY=${ys.size}, overlaps=${overlaps.length}`,
    );
  });

  return { passed, results };
}
