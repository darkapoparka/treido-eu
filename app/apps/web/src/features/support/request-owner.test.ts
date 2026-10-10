import { describe, expect, it } from "vitest";
import { createSupportRequestOwner } from "./request-owner";

describe("committed support request ownership", () => {
  it("does not act before commit and serializes double clicks", () => {
    const owner = createSupportRequestOwner();
    expect(owner.capture()).toBeNull();
    expect(owner.begin()).toBeNull();
    owner.activate();
    const first = owner.begin()!;
    expect(first.isCurrent()).toBe(true);
    expect(owner.begin()).toBeNull();
    first.finish();
    expect(owner.busy()).toBe(false);
    expect(owner.begin()).not.toBeNull();
  });

  it("retirement conceals late reads and acknowledgements before passive cleanup", () => {
    const owner = createSupportRequestOwner();
    owner.activate();
    const read = owner.capture()!;
    const request = owner.begin()!;
    owner.retire();
    expect(read()).toBe(false);
    expect(request.isCurrent()).toBe(false);
    expect(owner.begin()).toBeNull();
  });

  it("effect replay or a route round trip cannot revive an old lease", () => {
    const owner = createSupportRequestOwner();
    owner.activate();
    const oldRead = owner.capture()!;
    const oldRequest = owner.begin()!;
    owner.retire();
    owner.activate();
    const current = owner.begin()!;
    oldRequest.finish();
    expect(oldRead()).toBe(false);
    expect(oldRequest.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    expect(owner.busy()).toBe(true);
    expect(owner.begin()).toBeNull();
    current.finish();
    expect(owner.busy()).toBe(false);
  });

  it("a completed read does not release an in-flight mutation", () => {
    const owner = createSupportRequestOwner();
    owner.activate();
    const read = owner.capture()!;
    const mutation = owner.begin()!;
    expect(read()).toBe(true);
    expect(owner.busy()).toBe(true);
    mutation.finish();
    const next = owner.begin()!;
    mutation.finish();
    expect(owner.busy()).toBe(true);
    next.finish();
    expect(owner.busy()).toBe(false);
  });
});
