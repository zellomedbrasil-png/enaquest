import { describe, expect, it } from "vitest";
import { classifyAuthError } from "./auth-errors";

describe("erros de autenticação", () => {
  it.each([
    [{ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" }, "rate_limit"],
    [{ code: "unexpected_failure", status: 500, message: "Error sending confirmation email" }, "email_send"],
    [{ code: "email_address_invalid", status: 400, message: 'Email address "x" is invalid' }, "email_invalid"],
    [{ code: "weak_password", status: 422, message: "Password should be at least 8 characters." }, "weak_password"],
    [{ code: "signup_disabled", status: 422, message: "Signups not allowed for this instance" }, "signup_disabled"],
    [{ code: "email_not_confirmed", status: 400, message: "Email not confirmed" }, "not_confirmed"],
    [{ code: "invalid_credentials", status: 400, message: "Invalid login credentials" }, "invalid_credentials"],
    [{ code: "unexpected_failure", status: 500, message: "Database error saving new user" }, "unavailable"],
    [{ status: 0, message: "fetch failed" }, "unavailable"],
    [{ message: "algo novo" }, "unknown"],
  ] as const)("%o vira %s", (error, expected) => {
    expect(classifyAuthError(error)).toBe(expected);
  });
});
