// ─── VowzaIcon — Raw "V" mark only, no background/container ──────────────────
// Renders ONLY the gold V letterform on a transparent background.
// No rounded square, no blue background, no border, no wrapper.
// Used as a direct inline icon replacement throughout the app.

interface VowzaIconProps {
  className?: string;
}

const VowzaIcon = ({ className = "w-4 h-4" }: VowzaIconProps) => (
  <svg
    viewBox="0 0 400 360"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M20 10L200 350L380 10H296L200 220L104 10H20Z" fill="#EFBF04" />
    <path d="M200 220L240 130L296 10H256L200 130V220Z" fill="#D4A800" opacity="0.6" />
  </svg>
);

export default VowzaIcon;
