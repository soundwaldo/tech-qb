import { ImageResponse } from "next/og";

export const alt = "GGuard AI - Garage door service intake and diagnostics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "linear-gradient(135deg, #062c2a, #0f766e)", color: "white", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: 80, width: "100%" }}>
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 3 }}>GGUARD AI</div>
      <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, marginTop: 32, textAlign: "center" }}>Know what’s waiting before you dispatch.</div>
      <div style={{ fontSize: 32, marginTop: 32, opacity: 0.9 }}>Garage door service intake and diagnostics</div>
    </div>,
    size,
  );
}
