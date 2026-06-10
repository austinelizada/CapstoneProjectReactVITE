import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProgressEditModal from "../ProgressEditModal";

describe("ProgressEditModal", () => {
  const project = {
    id: "order-123",
    client: "Acme Corp",
    progress: 40,
    status: "Fabrication",
    installation: "2025-01-20T00:00:00.000Z",
    stages: [
      { name: "Cutting", completed: false, date: "2025-01-01", images: [] },
    ],
  };

  it("calls onSave with updated progress and closes when saved", async () => {
    const onSave = vi.fn().mockResolvedValue();
    const onClose = vi.fn();

    render(<ProgressEditModal project={project} onSave={onSave} onClose={onClose} />);

    const progressInput = screen.getByLabelText(/Progress %/i);
    fireEvent.change(progressInput, { target: { value: "60" } });

    const statusSelect = screen.getByLabelText(/Status/i);
    fireEvent.change(statusSelect, { target: { value: "Completed" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 60,
          status: "Completed",
        }),
        [],
        expect.any(Function)
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
