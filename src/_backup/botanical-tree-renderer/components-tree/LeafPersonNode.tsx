import { useState } from 'react';
import { motion } from 'framer-motion';
import { botanicalTheme, getGenerationPalette } from '../../theme/botanicalTree';
import {
  getLeafAssetUrl,
  getLeafTextLayout,
} from '../../features/family-tree/theme/treeAssets';
import { getPersonInitials } from '../../utils/personInitials';
import { formatLifeYears, isFounderNode } from '../../utils/organicBranchPath';
import { getNodeHeight, getNodeWidth } from '../../utils/nodeMetrics';
import type { PositionedPerson } from '../../types/tree';

interface LeafPersonNodeProps {
  node: PositionedPerson;
  worldX: number;
  worldY: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  tiltDeg?: number;
  isGrowing?: boolean;
  onSelect: (personId: number) => void;
}

function splitNameLines(name: string, maxLineLength = 16): [string, string?] {
  const trimmed = name.trim();
  if (trimmed.length <= maxLineLength) {
    return [trimmed];
  }

  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    const mid = Math.ceil(trimmed.length / 2);
    return [trimmed.slice(0, mid), trimmed.slice(mid)];
  }

  let first = '';
  let splitAt = 0;

  for (let i = 0; i < words.length; i += 1) {
    const candidate = first ? `${first} ${words[i]}` : words[i];
    if (candidate.length > maxLineLength && first) {
      break;
    }
    first = candidate;
    splitAt = i + 1;
  }

  const second = words.slice(splitAt).join(' ');
  return second ? [first, second] : [first];
}

export function LeafPersonNode({
  node,
  worldX,
  worldY,
  isSelected,
  isHighlighted,
  isDimmed,
  tiltDeg = 0,
  isGrowing = false,
  onSelect,
}: LeafPersonNodeProps) {
  const [hovered, setHovered] = useState(false);
  const palette = getGenerationPalette(node.data.generation_number);
  const founder = isFounderNode(node);
  const width = getNodeWidth(node.data);
  const height = getNodeHeight(node.data);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const lifeYears = formatLifeYears(node.data.birth_date, node.data.death_date);
  const active = isSelected || isHighlighted;
  const leafSrc = getLeafAssetUrl(node.data, active);
  const layout = getLeafTextLayout(node.data.generation_number, founder);
  const [nameLine1, nameLine2] = splitNameLines(
    node.data.full_name,
    layout.nameMaxChars,
  );

  const avatarY = height * layout.avatarY;
  const nameY = height * layout.nameY;
  const metaY = height * layout.metaY;
  const textPadX = width * 0.12;

  const leafDelay = isGrowing ? 0.72 : 0;
  const textDelay = isGrowing ? 1.05 : 0;

  return (
    <motion.g
      transform={`translate(${worldX}, ${worldY}) rotate(${tiltDeg})`}
      style={{
        cursor: 'pointer',
        opacity: isDimmed ? 0.34 : 1,
        filter: active
          ? botanicalTheme.shadows.leafSelected
          : hovered
            ? botanicalTheme.shadows.leafHover
            : botanicalTheme.shadows.leaf,
      }}
      initial={isGrowing ? { opacity: 0, scale: 0.7 } : false}
      animate={{ opacity: isDimmed ? 0.34 : 1, scale: 1 }}
      transition={{
        duration: isGrowing ? 0.5 : 0,
        delay: leafDelay,
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <g transform={`translate(${-halfWidth}, ${-halfHeight})`}>
        {active ? (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width * 0.52}
            ry={height * 0.56}
            fill="rgba(201, 162, 39, 0.14)"
            stroke="rgba(201, 162, 39, 0.45)"
            strokeWidth={2}
          />
        ) : null}
        <image
          href={leafSrc}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
        />

        <defs>
          <clipPath id={`leaf-text-clip-${node.id}`}>
            <rect
              x={textPadX}
              y={height * 0.14}
              width={width - textPadX * 2}
              height={height * 0.78}
              rx={8}
            />
          </clipPath>
        </defs>

        <motion.g
          clipPath={`url(#leaf-text-clip-${node.id})`}
          initial={isGrowing ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: textDelay }}
        >
          {layout.showFounderLabel && (
            <text
              x={width / 2}
              y={height * 0.13}
              textAnchor="middle"
              fill={botanicalTheme.colors.gold}
              fontSize={9}
              fontWeight={600}
            >
              مؤسس العائلة
            </text>
          )}

          <g transform={`translate(${width / 2 - 18}, ${avatarY - 18})`}>
            {node.data.photo_url ? (
              <>
                <defs>
                  <clipPath id={`leaf-avatar-${node.id}`}>
                    <circle cx={18} cy={18} r={16} />
                  </clipPath>
                </defs>
                <circle cx={18} cy={18} r={16} fill={palette.badge} opacity={0.85} />
                <image
                  href={node.data.photo_url}
                  x={2}
                  y={2}
                  width={32}
                  height={32}
                  clipPath={`url(#leaf-avatar-${node.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              </>
            ) : (
              <>
                <circle cx={18} cy={18} r={16} fill={palette.badge} opacity={0.85} />
                <text
                  x={18}
                  y={22}
                  textAnchor="middle"
                  fill={palette.text}
                  fontSize={10}
                  fontWeight={700}
                >
                  {getPersonInitials(node.data.full_name)}
                </text>
              </>
            )}
          </g>

          <text
            x={width / 2}
            y={nameY}
            textAnchor="middle"
            fill={palette.text}
            fontSize={layout.nameFontSize}
            fontWeight={700}
            direction="rtl"
          >
            <tspan x={width / 2} dy={0}>
              {nameLine1}
            </tspan>
            {nameLine2 ? (
              <tspan x={width / 2} dy="1.15em">
                {nameLine2}
              </tspan>
            ) : null}
          </text>

          <text
            x={width / 2}
            y={metaY}
            textAnchor="middle"
            fill={palette.text}
            fontSize={layout.metaFontSize}
            opacity={0.9}
          >
            {lifeYears ?? `الجيل ${node.data.generation_number}`}
          </text>
        </motion.g>
      </g>
    </motion.g>
  );
}
