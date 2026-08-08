// src/pages/UpgradePage.test.jsx
//
// Confirms the Flutterwave Inline wiring: checkout opens as an in-page
// modal (never a redirect), and the wallet-credit round trip runs off
// the JS callback instead of a separate /payment-updating page.
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

beforeEach(() => {
  jest.clearAllMocks();
  readAuthCookie.mockReturnValue({
    email: "test@example.com",
    firstname: "Ada",
    lastname: "Lovelace",
  });
  window.FlutterwaveCheckout = jest.fn();
  window.closePaymentModal = jest.fn();
});

test("opens the Flutterwave modal in-page with the correct bundle config, instead of redirecting", () => {
  renderUpgradePage();

  fireEvent.click(getStarterButton());

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
  fireEvent.click(getStarterButton());

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
  fireEvent.click(button);

  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  await act(async () => {
    await config.callback({ status: "successful", transaction_id: "12345" });
  });

  expect(screen.getByText("Transaction already processed")).toBeInTheDocument();
  expect(button).not.toBeDisabled();
});

test("does not call the backend if Flutterwave reports the payment was not completed", async () => {
  renderUpgradePage();
  fireEvent.click(getStarterButton());

  const config = window.FlutterwaveCheckout.mock.calls[0][0];

  await act(async () => {
    await config.callback({ status: "cancelled" });
  });

  expect(encryptedFetch).not.toHaveBeenCalled();
  expect(screen.getByText(/payment was not completed/i)).toBeInTheDocument();
});

test("re-enables the button if the user closes the modal without paying", () => {
  renderUpgradePage();
  const button = getStarterButton();
  fireEvent.click(button);
  expect(button).toBeDisabled();

  const config = window.FlutterwaveCheckout.mock.calls[0][0];
  act(() => {
    config.onclose();
  });

  expect(button).not.toBeDisabled();
});

test("blocks checkout with an inline error if the user isn't logged in", () => {
  readAuthCookie.mockReturnValue(null);
  renderUpgradePage();

  fireEvent.click(getStarterButton());

  expect(window.FlutterwaveCheckout).not.toHaveBeenCalled();
  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
});
