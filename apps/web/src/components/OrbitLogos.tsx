"use client";

import { AvenzaMark } from "@/components/AvenzaLogo";
import { TapeOutLogo, UsdcLogo, XLayerLogo } from "@/components/BrandLogos";

const nodes = [
  { key: "usdc", angle: -90, Logo: UsdcLogo, label: "USDC" },
  { key: "xlayer", angle: 30, Logo: XLayerLogo, label: "X Layer" },
  { key: "tapeout", angle: 150, Logo: TapeOutLogo, label: "TapeOut" },
] as const;

export function OrbitLogos({ className = "" }: { className?: string }) {
  return (
    <div className={`orbit-stage ${className}`} aria-hidden>
      <div className="orbit-ring orbit-ring-outer" />
      <div className="orbit-ring orbit-ring-mid" />
      <div className="orbit-ring orbit-ring-inner" />
      <div className="orbit-scan" />

      <div className="orbit-core">
        <AvenzaMark tone="light" size={48} className="orbit-core-logo" />
      </div>

      <div className="orbit-spin">
        {nodes.map(({ key, angle, Logo, label }) => (
          <div key={key} className="orbit-node" style={{ ["--a" as string]: `${angle}deg` }}>
            <div className="orbit-node-anchor">
              <div className="orbit-node-face">
                <div className="orbit-badge" title={label}>
                  <Logo className="orbit-logo" alt={label} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
