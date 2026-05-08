import { create } from "zustand";
import type { Overlay, Project } from "../types/overlay";

type Command =
  | { type: "addOverlay"; overlay: Overlay }
  | { type: "removeOverlay"; id: string }
  | { type: "updateOverlay"; id: string; patch: Partial<Overlay> }
  | { type: "reorderOverlay"; id: string; newIndex: number };

type ProjectState = {
  project: Project;
  selectedOverlayId: string | null;
  undoStack: Overlay[][];
  redoStack: Overlay[][];

  setBase: (base: Project["base"], canvas: Project["canvas"]) => void;
  selectOverlay: (id: string | null) => void;
  apply: (command: Command) => void;
  undo: () => void;
  redo: () => void;
};

function cloneOverlays(overlays: Overlay[]): Overlay[] {
  return overlays.map((o) => ({ ...o }));
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: {
    base: null,
    overlays: [],
    canvas: { width: 0, height: 0 },
  },
  selectedOverlayId: null,
  undoStack: [],
  redoStack: [],

  setBase: (base, canvas) =>
    set((s) => ({
      project: { ...s.project, base, canvas },
      selectedOverlayId: null,
      undoStack: [],
      redoStack: [],
    })),

  selectOverlay: (id) => set({ selectedOverlayId: id }),

  apply: (command) => {
    const state = get();
    const prev = cloneOverlays(state.project.overlays);
    let overlays = [...state.project.overlays];

    switch (command.type) {
      case "addOverlay":
        overlays.push(command.overlay);
        break;
      case "removeOverlay":
        overlays = overlays.filter((o) => o.id !== command.id);
        break;
      case "updateOverlay":
        overlays = overlays.map((o) =>
          o.id === command.id ? ({ ...o, ...command.patch } as Overlay) : o,
        );
        break;
      case "reorderOverlay": {
        const idx = overlays.findIndex((o) => o.id === command.id);
        if (idx >= 0) {
          const [item] = overlays.splice(idx, 1);
          overlays.splice(command.newIndex, 0, item);
        }
        break;
      }
    }

    set({
      project: { ...state.project, overlays },
      undoStack: [...state.undoStack, prev],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, project } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: { ...project, overlays: prev },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, cloneOverlays(project.overlays)],
    });
  },

  redo: () => {
    const { redoStack, project } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: { ...project, overlays: next },
      undoStack: [...get().undoStack, cloneOverlays(project.overlays)],
      redoStack: redoStack.slice(0, -1),
    });
  },
}));
