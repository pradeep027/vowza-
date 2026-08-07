// ─── VowzaIcon — Official Vowza logo rendered as a pure image ─────────────────
// Displays the provided logo exactly as-is. No wrapper, no border, no shadow,
// no background, no container, no SVG inline rendering.
// Just the image file at the specified size.
//
// Source: /vowza-logo.svg (public folder)
// To update globally: replace public/vowza-logo.svg

interface VowzaIconProps {
  className?: string;
}

const VowzaIcon = ({ className = "w-6 h-6" }: VowzaIconProps) => (
  <img
    src="/vowza-logo.svg"
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`${className} object-contain`}
  />
);

export default VowzaIcon;
