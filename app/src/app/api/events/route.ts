import { auth } from "@/auth";
import { deviceEvents, DEVICE_UPDATE_EVENT } from "@/lib/events";
import type { Device } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let listener: (device: Device) => void;
  let keepAlive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      listener = (device: Device) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(device)}\n\n`));
      };
      deviceEvents.on(DEVICE_UPDATE_EVENT, listener);

      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      deviceEvents.off(DEVICE_UPDATE_EVENT, listener);
      clearInterval(keepAlive);
    },
  });

  request.signal.addEventListener("abort", () => {
    deviceEvents.off(DEVICE_UPDATE_EVENT, listener);
    clearInterval(keepAlive);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
