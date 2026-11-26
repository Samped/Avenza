import Link from "next/link";

type Props = {
  /** light = white mark (dark backgrounds), dark = black mark (light backgrounds) */
  tone?: "light" | "dark";
  /** show AVENZA wordmark beside the mark */
  withWordmark?: boolean;
  size?: number;
  href?: string | null;
  className?: string;
  wordmarkClassName?: string;
};

export function AvenzaLogo({
  tone = "dark",
  withWordmark = true,
  size = 28,
  href = "/",
  className = "",
  wordmarkClassName = "",
}: Props) {
  const src =
    tone === "light" ? "/brand/avenza-md-light.png" : "/brand/avenza-md-dark.png";

  const mark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="avenza-mark"
      draggable={false}
      style={{ width: size, height: size }}
    />
  );

  const content = (
    <span className={`avenza-logo ${className}`}>
      {mark}
      {withWordmark ? (
        <span className={`avenza-wordmark ${wordmarkClassName}`}>AVENZA</span>
      ) : (
        <span className="sr-only">AVENZA</span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="avenza-logo-link" aria-label="AVENZA">
      {content}
    </Link>
  );
}

/** Mark-only for orbit core / favicon-like spots */
export function AvenzaMark({
  tone = "light",
  size = 40,
  className = "",
}: {
  tone?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  const src =
    tone === "light" ? "/brand/avenza-lg-light.png" : "/brand/avenza-lg-dark.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="AVENZA"
      width={size}
      height={size}
      className={`avenza-mark ${className}`}
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}
