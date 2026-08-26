import Link from "next/link";

type BrandProps = {
  href?: string;
  className?: string;
};

function BrandContent() {
  return (
    <img className="brand-logo-image" src="/assets/images/pace-lab.svg" alt="Pace Lab" />
  );
}

export function Brand({ href, className = "" }: BrandProps) {
  const classes = `brand-mark ${className}`.trim();

  if (href) {
    return <Link href={href} className={classes} aria-label="Pace Lab"><BrandContent /></Link>;
  }

  return <div className={classes} aria-label="Pace Lab"><BrandContent /></div>;
}
