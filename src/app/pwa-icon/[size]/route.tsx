import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c8f542",
          color: "#12160a",
          fontSize: px * 0.52,
          fontWeight: 800,
        }}
      >
        EQ
      </div>
    ),
    { width: px, height: px },
  );
}
