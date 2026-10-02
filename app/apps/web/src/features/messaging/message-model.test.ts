import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { parseMessageInput } from "./message-model";
const valid = () => ({
  threadId: randomUUID(),
  requestId: randomUUID(),
  body: "Здравейте\nHello",
});
it("accepts bounded plain text without treating it as HTML or instructions", () => {
  expect(
    parseMessageInput({ ...valid(), body: "<script>plain text</script>" })
      ?.body,
  ).toBe("<script>plain text</script>");
  expect(
    parseMessageInput({ ...valid(), body: "", attachmentIds: [randomUUID()] }),
  ).not.toBeNull();
});
it("rejects empty, oversized, control character and client authority inputs", () => {
  for (const input of [
    { ...valid(), body: " " },
    { ...valid(), body: "x".repeat(4001) },
    { ...valid(), body: "x\u0000" },
    { ...valid(), sellerId: randomUUID() },
    { ...valid(), role: "owner" },
    { ...valid(), threadId: "foreign" },
  ])
    expect(parseMessageInput(input)).toBeNull();
});
it("requires a small unique explicit attachment list", () => {
  const id = randomUUID();
  for (const attachmentIds of [
    [id, id],
    Array.from({ length: 5 }, () => randomUUID()),
    ["https://example.com"],
    "file",
  ])
    expect(parseMessageInput({ ...valid(), attachmentIds })).toBeNull();
});
