import { useTheme } from '@emotion/react';
import { ColorName } from '../theme/colors';

interface Props {
  color: ColorName;
}

export function Target({ color }: Props) {
  const theme = useTheme();
  const themeColor = theme.colors[color];

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7.5" stroke={themeColor} />
      <circle cx="8" cy="8" r="5.5" stroke={themeColor} />
      <circle cx="8" cy="8" r="3.5" stroke={themeColor} />
      <circle cx="8" cy="8" r="2" fill={themeColor} />
    </svg>
  );
}
