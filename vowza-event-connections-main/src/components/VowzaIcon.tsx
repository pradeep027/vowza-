// ─── VowzaIcon — Reusable Vowza "V" logo component ───────────────────────────
// Replaces all Sparkles/star icons across the app with the official Vowza logo.
// Single source of truth: update this file to change the icon everywhere.

interface VowzaIconProps {
  className?: string;
  size?: number;
}

const VowzaIcon = ({ className = "w-4 h-4", size }: VowzaIconProps) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <rect width="512" height="512" rx="96" fill="#1B4FE8" />
    <path d="M108 80L256 432L404 80H320L256 260L192 80H108Z" fill="#EFBF04" />
    <path d="M256 260L286 180L320 80H286L256 160L256 260Z" fill="#D4A800" opacity="0.55" />
  </svg>
);

export default VowzaIcon;
