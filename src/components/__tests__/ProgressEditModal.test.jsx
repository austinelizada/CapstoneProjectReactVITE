import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProgressEditModal from "../ProgressEditModal";

describe("ProgressEditModal", () => {
  it("places the mobile dialog above navigation and keeps its actions available", () => {
    render(
      <ProgressEditModal
        project={{ id: "order-123", client: "Acme Corp", stages: [] }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: /Edit Progress/ });
    expect(dialog.parentElement.className).toContain("z-[70]");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();
  });

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

    const dialog = screen.getByRole("dialog", { name: /Edit Progress/ });
    expect(dialog.className).toContain("h-[100dvh]");
    expect(dialog.className).toContain("lg:max-w-[600px]");

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

  it("accepts a one-character delay reason", () => {
    render(
      <ProgressEditModal
        project={{ id: "order-123", client: "Acme Corp", stages: [] }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getAllByLabelText("Stage State")[0], { target: { value: "delayed" } });
    fireEvent.change(screen.getByLabelText("Delay Reason *"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Delay Reason" }));

    expect(screen.queryByRole("dialog", { name: "Project Delay Reason" })).toBeNull();
    expect(screen.getAllByLabelText("Stage State")[0].value).toBe("delayed");
  });

  it("saves Assembly after Cutting and before Fabrication", async () => {
    const onSave = vi.fn().mockResolvedValue();

    render(
      <ProgressEditModal
        project={{ id: "order-123", client: "Acme Corp", stages: [] }}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onSave.mock.calls[0][0].stages.map((stage) => stage.key)).toEqual([
        "cutting",
        "assembly",
        "fabrication",
        "installation",
      ]);
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
