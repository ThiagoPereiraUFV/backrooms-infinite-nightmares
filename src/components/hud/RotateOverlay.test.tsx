import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RotateOverlay } from "./RotateOverlay";

describe("RotateOverlay", () => {
  it("renders a blocking advisory", () => {
    render(<RotateOverlay />);
    expect(screen.getByTestId("rotate-overlay")).toBeInTheDocument();
    expect(screen.getByText(/rotate your device to play/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
