import {ImageResponse} from "next/og";

export const size = {width: 32, height: 32};
export const contentType = "image/png";

/** The mark, rendered as the favicon so there is one source for both. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080a0c",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <path d="M4 4h10v2H6v8H4V4Z" fill="#c8a24a" />
          <path d="M28 28H18v-2h8v-8h2v10Z" fill="#c8a24a" />
          <rect x="11" y="11" width="10" height="10" rx="1" fill="#c8a24a" opacity="0.55" />
        </svg>
      </div>
    ),
    size,
  );
}
