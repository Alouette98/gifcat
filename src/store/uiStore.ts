import { create } from "zustand";

interface UIState {
  loading: boolean;
  loadingTitle: string;
  loadingDetail: string;
  loadingProgress: number | null;
  showLoading: (title: string, detail?: string) => void;
  updateLoading: (patch: { detail?: string; progress?: number | null }) => void;
  hideLoading: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  loading: false,
  loadingTitle: "",
  loadingDetail: "",
  loadingProgress: null,
  showLoading: (title, detail = "") =>
    set({ loading: true, loadingTitle: title, loadingDetail: detail, loadingProgress: null }),
  updateLoading: (patch) =>
    set((s) => ({
      loadingDetail: patch.detail ?? s.loadingDetail,
      loadingProgress:
        patch.progress === undefined ? s.loadingProgress : patch.progress,
    })),
  hideLoading: () =>
    set({ loading: false, loadingTitle: "", loadingDetail: "", loadingProgress: null }),
}));
