/** Coin marks — official brand artwork as circular tokens. */

type CoinProps = {
  className?: string;
  alt?: string;
};

function CoinImg({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} draggable={false} width={96} height={96} />
  );
}

export function UsdcLogo({ className = "", alt = "USDC" }: CoinProps) {
  return <CoinImg src="/logos/usdc.svg" alt={alt} className={className} />;
}

export function XLayerLogo({ className = "", alt = "X Layer" }: CoinProps) {
  return <CoinImg src="/logos/xlayer.svg" alt={alt} className={className} />;
}

export function TapeOutLogo({ className = "", alt = "TapeOut" }: CoinProps) {
  return <CoinImg src="/logos/tapeout.svg" alt={alt} className={className} />;
}
