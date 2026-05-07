import { describe, expect, it } from "vitest";
import { PRIORITY, STATUS } from "@/lib/db/schema";
import { validateTaskQuery } from "@/lib/validation/task-query-validation";

describe("validation/task-query-validation", () => {
  it("空のクエリはOK", () => {
    const result = validateTaskQuery({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it("name はトリムされる", () => {
    const result = validateTaskQuery({ name: "  React  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("React");
  });

  it("status/priority は null を許可する", () => {
    const result = validateTaskQuery({
      name: "x",
      status: null,
      priority: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: "x", status: null, priority: null });
    }
  });

  it("不正な status はエラー", () => {
    const result = validateTaskQuery({ status: "invalid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      if (result.error.type === "VALIDATION_ERROR") {
        expect(result.error.fields).toEqual(expect.arrayContaining(["status"]));
      }
    }
  });

  it("有効な status/priority を受け付ける", () => {
    const result = validateTaskQuery({
      status: STATUS.IN_PROGRESS,
      priority: PRIORITY.LOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(STATUS.IN_PROGRESS);
      expect(result.value.priority).toBe(PRIORITY.LOW);
    }
  });
});
