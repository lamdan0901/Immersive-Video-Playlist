import { render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AutoRefreshTrigger } from "./auto-refresh-trigger";

const { refreshMock, triggerAutoRefreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  triggerAutoRefreshMock: vi.fn(),
}));

vi.mock("@/actions/import", () => ({
  triggerAutoRefresh: triggerAutoRefreshMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

beforeEach(() => {
  refreshMock.mockReset();
  triggerAutoRefreshMock.mockReset();
});

it("refreshes the current route after auto-refresh updates stale sources", async () => {
  triggerAutoRefreshMock.mockResolvedValue({
    ok: true,
    data: { refreshed: 1 },
  });

  render(<AutoRefreshTrigger playlistId="playlist-1" />);

  await waitFor(() => {
    expect(triggerAutoRefreshMock).toHaveBeenCalledWith({
      playlistId: "playlist-1",
    });
  });

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
