import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppToastHost } from "@/components/playlist/toast";
import { clearAppToast, showAppToast } from "./app-toast";

describe("showAppToast + AppToastHost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      clearAppToast();
    });
    vi.useRealTimers();
  });

  it("renders a fixed top-right toast via createPortal on document.body", () => {
    render(<AppToastHost />);

    act(() => {
      showAppToast("Hello toast");
    });

    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Hello toast");
    expect(el.className).toContain("app-corner-toast");
    expect(el.id).toBe("app-corner-toast-root");
    expect(el.parentElement).toBe(document.body);
  });

  it("replaces the message on subsequent calls and auto-dismisses", () => {
    render(<AppToastHost />);

    act(() => {
      showAppToast("First");
      showAppToast("Second");
    });

    expect(screen.getByRole("status")).toHaveTextContent("Second");

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
