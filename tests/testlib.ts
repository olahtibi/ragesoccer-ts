import { test } from "vitest";

export { test };

export function assertTrue(
  value: unknown,
  message = "Expected value to be true",
): asserts value {
  if (!value) throw new Error(message);
}

export function assertEqual(
  actual: unknown,
  expected: unknown,
  message = "Values are not equal",
): void {
  if (actual !== expected)
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
}

export function assertNear(
  actual: number,
  expected: number,
  epsilon: number,
  message = "Values are not near",
): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
