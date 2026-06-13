import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProgressEditModal from "../ProgressEditModal";

describe("ProgressEditModal", () => {
  it("shows add sub-stage only for the latest completed parent stage", () => {
    const project = {
      id: "order-123",
      client: "Acme Corp",
      stages: [
        { name: "Cutting", completed: true, status: "done", date: "2025-01-01", images: [] },
        { name: "Fabrication", completed: false, status: "pending", date: null, images: [] },
      ],
    };
    render(<ProgressEditModal project={project} onSave={vi.fn()} onClose={vi.fn()} />);

    const buttons = screen.getAllByRole("button", { name: /Add Sub-Stage/i });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("Add Sub-Stage");
  });

  it("hides add sub-stage when the next parent stage has started", () => {
    const project = {
      id: "order-123",
      client: "Acme Corp",
      stages: [
        { name: "Cutting", completed: true, status: "done", date: "2025-01-01", images: [] },
        { name: "Fabrication", completed: false, status: "in_progress", date: null, images: [] },
      ],
    };
    render(<ProgressEditModal project={project} onSave={vi.fn()} onClose={vi.fn()} />);

    const addButtons = screen.queryAllByRole("button", { name: /Add Sub-Stage/i });
    expect(addButtons).toHaveLength(0);
  });

  it("calls onSave and closes when save changes is clicked", async () => {
    const project = {
      id: "order-123",
      client: "Acme Corp",
      stages: [
        { name: "Cutting", completed: false, status: "pending", date: null, images: [] },
      ],
    };
    const onSave = vi.fn().mockResolvedValue();
    const onClose = vi.fn();

    render(<ProgressEditModal project={project} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("allows completed parent stage sub-stages to be marked done and undone before save", () => {
    const project = {
      id: "order-123",
      client: "Acme Corp",
      stages: [
        {
          name: "Cutting",
          completed: true,
          saved: true,
          status: "done",
          date: "2025-01-01",
          images: [],
          subStages: [
            { name: "Glass Preparation", description: "Prep glass.", status: "pending", completed: false, images: [] },
          ],
        },
      ],
    };
    render(<ProgressEditModal project={project} onSave={vi.fn()} onClose={vi.fn()} />);

    const markDoneButton = screen.getByRole("button", { name: /Mark as Done/i });
    expect(markDoneButton).toBeTruthy();

    fireEvent.click(markDoneButton);

    expect(screen.getByRole("button", { name: /Undo Completion/i })).toBeTruthy();
  });
});
