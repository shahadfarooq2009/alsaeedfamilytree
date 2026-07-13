import type { Gender } from '../../types/person';

export interface PresetAvatar {
  id: string;
  src: string;
  gender: Gender;
}

const avatarModules = import.meta.glob<string>('./*.png', {
  eager: true,
  import: 'default',
});

/** Gender hints for optional filtering — all avatars remain selectable. */
const GENDER_BY_ID: Record<string, Gender> = {
  'avatar-01': 'male',
  'avatar-02': 'male',
  'avatar-03': 'female',
  'avatar-04': 'female',
  'avatar-05': 'male',
  'avatar-06': 'male',
  'avatar-07': 'male',
  'avatar-08': 'female',
  'avatar-09': 'female',
  'avatar-10': 'female',
  'avatar-11': 'female',
  'avatar-12': 'male',
  'avatar-13': 'male',
  'avatar-14': 'female',
  'avatar-15': 'female',
  'avatar-16': 'female',
  'avatar-17': 'female',
  'avatar-18': 'female',
  'avatar-19': 'male',
  'avatar-20': 'male',
};

export const PRESET_AVATAR_PREFIX = 'preset:';

export const PRESET_AVATARS: PresetAvatar[] = Object.entries(avatarModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => {
    const id = path.replace('./', '').replace('.png', '');
    return {
      id,
      src,
      gender: GENDER_BY_ID[id] ?? 'other',
    };
  });

const avatarById = new Map(PRESET_AVATARS.map((avatar) => [avatar.id, avatar]));

export function presetAvatarPhotoUrl(avatarId: string): string {
  return `${PRESET_AVATAR_PREFIX}${avatarId}`;
}

export function parsePresetAvatarId(photoUrl: string | null | undefined): string | null {
  if (!photoUrl?.startsWith(PRESET_AVATAR_PREFIX)) return null;
  return photoUrl.slice(PRESET_AVATAR_PREFIX.length) || null;
}

export function resolveMemberPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  const presetId = parsePresetAvatarId(photoUrl);
  if (presetId) {
    return avatarById.get(presetId)?.src ?? null;
  }
  return photoUrl;
}

export function findPresetAvatar(photoUrl: string | null | undefined): PresetAvatar | null {
  const presetId = parsePresetAvatarId(photoUrl);
  if (!presetId) return null;
  return avatarById.get(presetId) ?? null;
}
