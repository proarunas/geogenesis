import styled from '@emotion/styled';
import { Create } from './icons/create';
import { Spacer } from './spacer';
import { ColorValue } from './theme/colors';
import { Theme } from './theme';
import { useTheme } from '@emotion/react';

type ButtonVariant = 'primary' | 'secondary';

function getButtonColors(variant: ButtonVariant, disabled: boolean, theme: Theme) {
  if (disabled) {
    return {
      color: theme.colors['grey-03'],
      backgroundColor: theme.colors.divider,
      backgroundColorHover: theme.colors.divider,
      borderColor: 'transparent',
      borderColorHover: 'transparent',
      borderColorFocus: 'transparent',
    };
  }

  switch (variant) {
    case 'primary':
      return {
        color: theme.colors.white,
        backgroundColor: theme.colors.ctaPrimary,
        backgroundColorHover: theme.colors.ctaHover,
        borderColor: 'transparent',
        borderColorHover: 'transparent',
        borderColorFocus: theme.colors.ctaHover,
      };
    case 'secondary':
      return {
        color: theme.colors.text,
        backgroundColor: theme.colors.white,
        backgroundColorHover: theme.colors.white,
        borderColor: theme.colors['grey-02'],
        borderColorHover: theme.colors.text,
        borderColorFocus: theme.colors.text,
      };
  }
}

const StyledButton = styled.button<Required<Pick<Props, 'variant' | 'disabled'>>>(props => {
  const buttonColors = getButtonColors(props.variant, props.disabled, props.theme);

  return {
    ...props.theme.typography.button,
    boxSizing: 'border-box',
    backgroundColor: buttonColors.backgroundColor,
    color: buttonColors.color,
    padding: `${props.theme.space * 2}px ${props.theme.space * 2.5}px`,
    borderRadius: props.theme.radius,
    cursor: 'pointer',
    outline: 'none',

    display: 'flex',
    alignItems: 'center',

    // Using box-shadow instead of border to prevent layout shift going between 1px and 2px border sizes. There's
    // other things we can do like toggling padding but this seems simplest.
    boxShadow: `inset 0 0 0 1px ${buttonColors.borderColor}`,

    // TODO: Placeholder until we do motion design
    transition: '200ms all ease-in-out',

    ':hover': {
      boxShadow: `inset 0 0 0 1px ${buttonColors.borderColorHover}`,
      backgroundColor: buttonColors.backgroundColorHover,
    },

    ':focus': {
      boxShadow: `inset 0 0 0 2px ${buttonColors.borderColorFocus}`,
      outline: 'none',
    },

    ':disabled': {
      boxShadow: 'none',
      cursor: 'not-allowed',
    },
  };
});

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  icon?: 'create';
  variant?: ButtonVariant;
  disabled?: boolean;
}

function getIconColor(variant: ButtonVariant, disabled: boolean, theme: Theme): ColorValue {
  if (disabled) return theme.colors['grey-03'];
  return variant === 'primary' ? theme.colors.white : theme.colors.ctaPrimary;
}

export function Button({ children, onClick, icon, variant = 'primary', disabled = false }: Props) {
  const theme = useTheme();
  const iconColor = getIconColor(variant, disabled, theme);

  return (
    <StyledButton disabled={disabled} variant={variant} onClick={onClick}>
      {icon ? (
        <>
          <Create color={iconColor} />
          <Spacer width={8} />
        </>
      ) : null}
      {children}
    </StyledButton>
  );
}
