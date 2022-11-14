import { useTheme } from '@emotion/react';

export function OnboardingArrow() {
  const { colors } = useTheme();

  return (
    <svg width="15" height="10" viewBox="0 0 15 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 0L0 9.5H15L7.5 0Z" fill={colors.text} />
    </svg>
  );
}
