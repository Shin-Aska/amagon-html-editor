import { afterEach, expect, it, vi } from "vitest";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { DeferredProjectAutosave } from "./deferredProjectAutosave";

const first = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const second = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
afterEach(() => vi.useRealTimers());

it("coalesces ticks and skips a queued tick if its project was replaced", async () => {
  vi.useFakeTimers();
  let session = first;
  const save = vi.fn(async () => ({ ok: true as const, value: undefined }));
  const queue = new DeferredProjectAutosave({
    getSessionId: () => session,
    blocked: () => false,
    save,
  });
  const result = queue.defer(first);
  expect(queue.defer(first)).toBe(result);
  queue.flush();
  queue.flush();
  expect(vi.getTimerCount()).toBe(1);
  session = second;
  await vi.runAllTimersAsync();
  expect((await result).ok).toBe(true);
  expect(save).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("waits for a busy operation to finish without polling", async () => {
  vi.useFakeTimers();
  let busy = true;
  const save = vi.fn(async () => ({ ok: true as const, value: undefined }));
  const queue = new DeferredProjectAutosave({
    getSessionId: () => first,
    blocked: () => busy,
    save,
  });
  const result = queue.defer(first);
  queue.flush();
  expect(vi.getTimerCount()).toBe(0);
  busy = false;
  queue.flush();
  await vi.runAllTimersAsync();
  expect((await result).ok).toBe(true);
  expect(save).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("disposes a pending tick and its one-shot timer", async () => {
  vi.useFakeTimers();
  const save = vi.fn(async () => ({ ok: true as const, value: undefined }));
  const queue = new DeferredProjectAutosave({
    getSessionId: () => first,
    blocked: () => false,
    save,
  });
  const result = queue.defer(first);
  queue.flush();
  queue.dispose();
  expect((await result).ok).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(save).not.toHaveBeenCalled();
});
