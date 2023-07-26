import BoringAvatar from 'boring-avatars';
import Image from 'next/legacy/image';
import { colors } from './theme/colors';

import { getImagePath } from '~/modules/utils';

interface Props {
  avatarUrl?: string | null;
  value?: string;
  alt?: string;
  size?: number;
}

export const Avatar = ({ value, avatarUrl, alt = '', size = 12 }: Props) => {
  return avatarUrl ? (
    <Image objectFit="cover" layout="fill" src={getImagePath(avatarUrl)} alt={alt} />
  ) : (
    <BoringAvatar
      size={size}
      variant="beam"
      name={value}
      colors={[
        colors.light.ctaPrimary,
        colors.light.purple,
        colors.light.pink,
        colors.light.orange,
        colors.light.green,
      ]}
    />
  );
};
