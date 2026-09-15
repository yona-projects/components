import { test } from "node:test";
import assert from "node:assert/strict";
import { markersToFiles } from "../src/attachments/markers.js";

test("markersToFiles: 마커 데이터를 AttachedFile 배열로 변환(완료 상태, progress=100)", () => {
  const result = markersToFiles([
    { id: "1", name: "foo.png", href: "/files/1", mime: "image/png", size: "12345" },
  ]);
  assert.deepEqual(result, [
    { submitId: "1", id: "1", name: "foo.png", url: "/files/1", mimeType: "image/png", size: 12345, progress: 100 },
  ]);
});

test("markersToFiles: size가 숫자가 아니면 0으로 폴백", () => {
  const result = markersToFiles([{ id: "2", name: "bar.txt", href: "/files/2", mime: "text/plain", size: "" }]);
  assert.equal(result[0]?.size, 0);
});

test("markersToFiles: 빈 배열이면 빈 배열", () => {
  assert.deepEqual(markersToFiles([]), []);
});

test("markersToFiles: 여러 개를 원본 순서 그대로 변환", () => {
  const result = markersToFiles([
    { id: "1", name: "a", href: "/files/1", mime: "text/plain", size: "1" },
    { id: "2", name: "b", href: "/files/2", mime: "text/plain", size: "2" },
  ]);
  assert.deepEqual(result.map((f) => f.id), ["1", "2"]);
});
