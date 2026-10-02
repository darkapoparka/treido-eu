"use client";
import { Icon, type IconName } from "./icons";
import { NativeIcon } from "./native-icons";

export function IconButton({
  icon,
  label,
  onClick,
  pressed,
  filled,
  disabled,
  className = "",
  native = false,
  "data-ui-label": uiLabel,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  filled?: boolean;
  disabled?: boolean;
  className?: string;
  native?: boolean;
  "data-ui-label"?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      data-ui-label={uiLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {native ? (
        <NativeIcon name={icon} filled={filled ?? pressed} />
      ) : (
        <Icon name={icon} filled={filled ?? pressed} />
      )}
    </button>
  );
}
