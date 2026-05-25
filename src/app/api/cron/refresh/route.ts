import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { performAutoRefresh } from "@/actions/import";

async function runRefresh() {
  try {
    await performAutoRefresh();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  console.log("[cron/refresh] POST received", {
    hasCurrentKey: !!currentKey,
    hasNextKey: !!nextKey,
    url: request.url,
  });

  if (!currentKey || !nextKey) {
    console.error("[cron/refresh] QStash keys missing");
    return NextResponse.json(
      { error: "QStash keys not configured" },
      { status: 500 },
    );
  }

  const receiver = new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: nextKey,
  });

  try {
    const signature = request.headers.get("upstash-signature") ?? "";
    const body = await request.text();
    await receiver.verify({ signature, body });
    console.log("[cron/refresh] QStash signature verified");
  } catch (err) {
    console.error("[cron/refresh] QStash signature failed", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runRefresh();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runRefresh();
}
