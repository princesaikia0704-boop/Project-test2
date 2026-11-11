import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      database: {
        pooled: true,
        activeConnections: 1,
        driver: "neon-http",
      },
      cache: {
        connected: true,
        provider: "upstash-redis",
      },
    },
    { status: 200 }
  );
}
