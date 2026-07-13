import type { ReactElement } from 'react';
import type { BotanicalLayout, LeafSprite } from '../../utils/buildBotanicalTreeLayout';

interface BotanicalTreeProps {
  layout: BotanicalLayout;
  onSelectMember?: (id: number) => void;
}

function renderLeafSprite(
  sprite: LeafSprite,
  key: string,
  offsetX = 0,
  offsetY = 0,
): ReactElement {
  const cx = sprite.x + offsetX;
  const cy = sprite.y + offsetY;
  const rotationDeg = (sprite.rotation * 180) / Math.PI;

  return (
    <ellipse
      key={key}
      className="botanical-cluster-sprite"
      cx={cx}
      cy={cy}
      rx={8 * sprite.scale}
      ry={5 * sprite.scale}
      fill="#4f7a3d"
      transform={`rotate(${rotationDeg} ${cx} ${cy})`}
      style={{ animationDelay: `${(sprite.variant % 5) * 0.04}s` }}
    />
  );
}

export function BotanicalTree({ layout, onSelectMember }: BotanicalTreeProps) {
  return (
    <div className="botanical-tree">
      <svg
        className="botanical-branches"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.branches.map((branch) => (
          <path
            key={branch.id}
            className="botanical-branch"
            d={branch.path}
            stroke="#5a4a38"
            strokeWidth={branch.thickness}
          />
        ))}
      </svg>

      <svg
        className="botanical-filler-leaves"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.fillerSprites.map((sprite, index) => renderLeafSprite(sprite, `f-${index}`))}
      </svg>

      {layout.nodes.map((node) => {
        if (node.isRoot) {
          return (
            <div
              key={node.id}
              className="botanical-founder"
              style={{ left: node.x, top: node.y }}
            >
              <div className="botanical-founder-name">{node.name}</div>
              <div className="botanical-founder-role">مؤسس العائلة</div>
            </div>
          );
        }

        if (!node.isLeaf && node.leafSprites.length === 0) return null;

        return (
          <button
            key={node.id}
            type="button"
            className={`botanical-leaf-cluster${node.isLeaf ? ' is-node' : ''}`}
            style={{ left: node.x, top: node.y }}
            onClick={() => onSelectMember?.(node.id)}
            aria-label={node.name}
          >
            <svg className="botanical-leaf-cluster-svg" viewBox="0 0 92 92">
              {node.leafSprites.map((sprite, index) => renderLeafSprite(
                sprite,
                `n-${node.id}-${index}`,
                46 - node.x,
                46 - node.y,
              ))}
            </svg>
            {node.isLeaf ? <span className="botanical-leaf-label">{node.name}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
