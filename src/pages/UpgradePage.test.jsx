// src/pages/UpgradePage.test.jsx
//
// Confirms the Flutterwave Inline wiring: checkout opens as an in-page
// modal (never a redirect), and the wallet-credit round trip runs off
// the JS callback instead of a separate /payment-updating page. Also
// confirms the auth-resolution fallback: readAuthCookie() alone isn't
// trusted — /auth/me backs it up (see resolveAuthenticatedUser).
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpgradePage from "./UpgradePage";
import { encryptedFetch } from "../utils/encryption";
import { readAuthCookie } from "../hooks/useAuthCookie";

jest.mock("../utils/encryption", () => ({
  encryptedFetch: jest.fn(),
}));

jest.mock("../hooks/useAuthCookie", () => ({
  readAuthCookie: jest.fn(),
}));

function renderUpgradePage() {
  return render(
    <MemoryRouter>
      <UpgradePage />
    </MemoryRouter>
  );
}

function getStarterButton() {
  return screen.getByRole("button", { name: /get starter/i });
}

async function clickAndSettle(button) {
  await act(async () => {
    fireEvent.click(button);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  readAuthCookie.mockReturnValue({
    email: "test@example.com",
    firstname: "Ada",
    lastname: "Lovelace",
  });
  window.FlutterwaveCheckout = jest.fn();
  window.closePaymentModal = jest.fn();
  // Safety net — only hit if a test's cookie path returns nothing,
  // since resolveAuthenticatedUser() falls back to /auth/me then.
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  });
});

test("opens the Flutterwave modal in-page with the correct bundle config, instead of redirecting", async () => {
  renderUpgradePage();

  await clickAndSettle(getStarterButton());

  expect(window.FlutterwaveCheckout).toHaveBeenCalledTimes(1);
  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  expect(config.amount).toBe(1);
  expect(config.currency).toBe("USD");
  expect(config.meta).toEqual({ bundleId: "starter" });
  expect(config.customer.email).toBe("test@example.com");
  expect(typeof config.callback).toBe("function");
  expect(typeof config.onclose).toBe("function");
});

test("credits the wallet inline on a successful payment via the JS callback, no page navigation needed", async () => {
  encryptedFetch.mockResolvedValue({
    success: true,
    bundle: "Starter",
    tokens: 75,
    wallet: 275,
  });

  renderUpgradePage();
  await clickAndSettle(getStarterButton());

  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  await act(async () => {
    await config.callback({ status: "successful", transaction_id: "12345" });
  });

  expect(window.closePaymentModal).toHaveBeenCalled();
  expect(encryptedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/payments/verify"),
    expect.objectContaining({
      method: "POST",
      body: { transactionId: "12345", bundleId: "starter" },
    })
  );

  expect(
    screen.getByText(/Starter activated — \+75 tokens added \(new balance: 275\)/i)
  ).toBeInTheDocument();
});

test("shows an inline error and re-enables the button if backend verification fails", async () => {
  encryptedFetch.mockRejectedValue(new Error("Transaction already processed"));

  renderUpgradePage();
  const button = getStarterButton();
  await clickAndSettle(button);

  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  await act(async () => {
    await config.callback({ status: "successful", transaction_id: "12345" });
  });

  expect(screen.getByText("Transaction already processed")).toBeInTheDocument();
  expect(button).not.toBeDisabled();
});

test("does not call the backend if Flutterwave reports the payment was not completed", async () => {
  renderUpgradePage();
  await clickAndSettle(getStarterButton());

  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  await act(async () => {
    await config.callback({ status: "cancelled" });
  });

  expect(encryptedFetch).not.toHaveBeenCalled();
  expect(screen.getByText(/payment was not completed/i)).toBeInTheDocument();
});

test("re-enables the button if the user closes the modal without paying", async () => {
  renderUpgradePage();
  const button = getStarterButton();
  await clickAndSettle(button);
  expect(button).toBeDisabled();

  const config = window.FlutterwaveCheckout.mock.calls[0][0];
  act(() => {
    config.onclose();
  });

  expect(button).not.toBeDisabled();
});

test("falls back to /auth/me when the JS-readable cookie can't be read (e.g. inside a wrapped-app WebView), and still proceeds", async () => {
  readAuthCookie.mockReturnValue(null);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      isAuthenticated: true,
      userEmail: "webview-user@example.com",
      firstname: "Grace",
      lastname: "Hopper",
    }),
  });

  renderUpgradePage();
  await clickAndSettle(getStarterButton());

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/me"),
    expect.objectContaining({ credentials: "include" })
  );
  expect(window.FlutterwaveCheckout).toHaveBeenCalledTimes(1);
  const config = window.FlutterwaveCheckout.mock.calls[0][0];
  expect(config.customer.email).toBe("webview-user@example.com");
});

test("blocks checkout with an inline error if neither the cookie nor /auth/me report a logged-in user", async () => {
  readAuthCookie.mockReturnValue(null);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ isAuthenticated: false }),
  });

  renderUpgradePage();
  await clickAndSettle(getStarterButton());

  expect(window.FlutterwaveCheckout).not.toHaveBeenCalled();
  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
});
