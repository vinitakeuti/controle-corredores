import Link from "next/link";

type BrandProps = {
  href?: string;
  className?: string;
  label?: string;
  size?: number;
  tone?: "light" | "dark";
};

// Wordmark "PACE LAB." (public/assets/images/pace-lab.svg). Fonte única do logo no app:
// nunca redesenhar nem distorcer. Em superfícies escuras usa tone="light".
export function Brand({ href, className = "", label = "Pace Lab", size = 104, tone = "light" }: BrandProps) {
  const classes = `brand-wordmark ${className}`.trim();
  const image = <img className="brand-wordmark-image" data-tone={tone} src="/assets/images/pace-lab.svg" alt={href ? "" : label} width={size} height={size} style={{ width: size }} />;

  if (href) {
    return <Link href={href} className={classes} aria-label={label}>{image}</Link>;
  }

  return <div className={classes}>{image}</div>;
}
