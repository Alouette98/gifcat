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
  applyTransient: (command: Command) => void;
  beginTransient: () => void;
  commitTransient: () => void;
  undo: () => void;
  redo: () => void;
};

function cloneOverlays(overlays: Overlay[]): Overlay[] {
  return overlays.map((o) => ({ ...o }));
}

export const useProjectStore = create<ProjectState>((set, get) => {
  let transientSnapshot: Overlay[] | null = null;

  function runCommand(overlays: Overlay[], command: Command): Overlay[] {
    let next = [...overlays];
    switch (command.type) {
      case "addOverlay":
        next.push(command.overlay);
        break;
      case "removeOverlay":
        next = next.filter((o) => o.id !== command.id);
        break;
      case "updateOverlay":
        next = next.map((o) =>
          o.id === command.id ? ({ ...o, ...command.patch } as Overlay) : o,
        );
        break;
      case "reorderOverlay": {
        const idx = next.findIndex((o) => o.id === command.id);
        if (idx >= 0) {
          const [item] = next.splice(idx, 1);
          next.splice(command.newIndex, 0, item);
        }
        break;
      }
    }
    return next;
  }

  return {
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
      const overlays = runCommand(state.project.overlays, command);
      set({
        project: { ...state.project, overlays },
        undoStack: [...state.undoStack, prev],
        redoStack: [],
      });
    },

    beginTransient: () => {
      const state = get();
      transientSnapshot = cloneOverlays(state.project.overlays);
    },

    applyTransient: (command) => {
      const state = get();
      if (transientSnapshot === null) {
        transientSnapshot = cloneOverlays(state.project.overlays);
      }
      const overlays = runCommand(state.project.overlays, command);
      set({ project: { ...state.project, overlays } });
    },

    commitTransient: () => {
      if (transientSnapshot === null) return;
      const state = get();
      set({
        undoStack: [...state.undoStack, transientSnapshot],
        redoStack: [],
      });
      transientSnapshot = null;
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
  };
});
