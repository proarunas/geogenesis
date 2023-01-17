import { useTheme } from '@emotion/react';
import { ColorName } from '~/modules/design-system/theme/colors';

interface Props {
  color?: ColorName;
}

export function Plus({ color }: Props) {
  const theme = useTheme();
  const themeColor = color ? theme.colors[color] : 'currentColor';

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M8.5 0.5V16.5" stroke={themeColor} />
      <path d="M0.5 8.5L16.5 8.5" stroke={themeColor} />
    </svg>
  );
}
