import {ImageResponse} from "next/og";
import {BRAND, EDITION} from "@/lib/brand";

export const size = {width: 1200, height: 630};
export const contentType = "image/png";
export const alt = `${BRAND.projectName} — ${BRAND.strapline}`;

/** Built from the mark and type at request time, so a rename needs no new asset. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080a0c",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: "20px"}}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <path d="M4 4h10v2H6v8H4V4Z" fill="#c8a24a" />
            <path d="M28 28H18v-2h8v-8h2v10Z" fill="#c8a24a" />
            <rect x="11" y="11" width="10" height="10" rx="1" fill="#c8a24a" opacity="0.55" />
          </svg>
          <div style={{display: "flex", flexDirection: "column"}}>
            <span style={{color: "#eef2f6", fontSize: 34, fontWeight: 600}}>
              {BRAND.projectName}
            </span>
            <span style={{color: "#5b6b7e", fontSize: 17, letterSpacing: 3}}>
              {BRAND.editionName.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{display: "flex", flexDirection: "column"}}>
          <span style={{color: "#dbb864", fontSize: 21, letterSpacing: 3}}>
            {BRAND.strapline.toUpperCase()}
          </span>
          <span style={{color: "#eef2f6", fontSize: 88, fontWeight: 600, marginTop: 14}}>
            Build the block.
          </span>
          <span style={{color: "#8496a9", fontSize: 27, marginTop: 20, maxWidth: 900}}>
            {EDITION.cardSupply} {BRAND.itemName.toLowerCase()}s, and never more.
          </span>
        </div>

        <div style={{display: "flex", gap: "44px"}}>
          {[
            [`${EDITION.cardSupply}`, "CARDS, EVER"],
            [`${EDITION.quarterCount}`, BRAND.groupTermPlural.toUpperCase()],
            ["5", "LEVELS"],
          ].map(([value, label]) => (
            <div key={label} style={{display: "flex", flexDirection: "column"}}>
              <span style={{color: "#eef2f6", fontSize: 40, fontWeight: 600}}>{value}</span>
              <span style={{color: "#5b6b7e", fontSize: 15, letterSpacing: 2}}>{label}</span>
            </div>
          ))}
          <div style={{display: "flex", alignItems: "flex-end", marginLeft: "auto"}}>
            <span style={{color: "#3a4859", fontSize: 16}}>
              No fixed rate. No guaranteed return.
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
