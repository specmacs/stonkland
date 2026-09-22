import {ImageResponse} from "next/og";
import {BRAND, EDITION, LEVELS} from "@/lib/brand";

export const size = {width: 1200, height: 630};
export const contentType = "image/png";
export const alt = `${BRAND.projectName} — ${BRAND.strapline}`;

/**
 * Built from the mark and type at request time, so a rename needs no new asset.
 *
 * Every figure on it is a parameter -- the edition's caps and the length of the ladder --
 * and nothing here is read from chain. A share card cannot gate itself on an RPC, and a
 * number baked into an image is stale the moment it is cached, so it carries only the
 * figures that cannot change.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f6efdd",
          fontFamily: "sans-serif",
        }}
      >
        {/* The four quarter colours, the same edge the site header carries. */}
        <div style={{display: "flex", height: 14}}>
          <div style={{flex: 1, background: "#164a9e"}} />
          <div style={{flex: 1, background: "#b04a06"}} />
          <div style={{flex: 1, background: "#146138"}} />
          <div style={{flex: 1, background: "#63278c"}} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "56px 72px 64px",
          }}
        >
          <div style={{display: "flex", alignItems: "center", gap: 18}}>
            <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
              <path d="M4 4h10v2H6v8H4V4Z" fill="#bb2018" />
              <path d="M28 28H18v-2h8v-8h2v10Z" fill="#bb2018" />
              <rect x="11" y="11" width="10" height="10" rx="1" fill="#e2a615" />
            </svg>
            <div style={{display: "flex", flexDirection: "column"}}>
              <span style={{color: "#14110a", fontSize: 32, fontWeight: 700}}>
                {BRAND.projectName}
              </span>
              <span style={{color: "#5f574a", fontSize: 15, letterSpacing: 3}}>
                {BRAND.editionName.toUpperCase()}
              </span>
            </div>
          </div>

          <div style={{display: "flex", flexDirection: "column"}}>
            <span style={{color: "#bb2018", fontSize: 19, letterSpacing: 3}}>
              {BRAND.strapline.toUpperCase()}
            </span>
            <span
              style={{
                color: "#14110a",
                fontSize: 104,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 18,
                letterSpacing: -3,
              }}
            >
              Build the block.
            </span>
            <span style={{color: "#5f574a", fontSize: 26, marginTop: 22, maxWidth: 900}}>
              {EDITION.cardSupply} {BRAND.itemNamePlural.toLowerCase()} in the {BRAND.editionName}.
            </span>
          </div>

          <div style={{display: "flex", gap: 3, border: "3px solid #14110a", background: "#14110a"}}>
            {[
              [EDITION.cardSupply.toLocaleString("en-US"), "CARDS, EVER"],
              [String(EDITION.quarterCount), BRAND.groupTermPlural.toUpperCase()],
              [String(LEVELS.length), "LEVELS"],
              [EDITION.tokenMaxSupply.toLocaleString("en-US"), `${BRAND.tokenTicker}, FIXED`],
            ].map(([value, label], i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  background: ["#fdf0c4", "#fbdcc8", "#d8e4fb", "#cfeedd"][i],
                  padding: "18px 22px",
                }}
              >
                <span
                  style={{
                    color: "#14110a",
                    // The fixed supply is an order of magnitude longer than the others, so
                    // the type steps down rather than running past the tile it sits in.
                    fontSize: (value as string).length > 8 ? 30 : 38,
                    fontWeight: 700,
                  }}
                >
                  {value}
                </span>
                <span style={{color: "#5f574a", fontSize: 13, letterSpacing: 2, marginTop: 4}}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
