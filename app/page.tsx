"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSystemMode } from "@/context/SystemModeContext";

const AUTO_SAVE_STORAGE_KEY = "ld_dashboard_autosave_session";

type UploadState = {
  filename: string;
  message: string;
  status: "idle" | "success" | "error";
};

export default function Page() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setSystemMode } = useSystemMode();
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"A" | "B" | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    filename: "",
    message: "Optional for returning participants.",
    status: "idle",
  });
  const canSelectSystem =
    (uploadState.status === "success" || isFirstUser) && selectedMode == null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid dashboard state payload");
      }

      localStorage.setItem(AUTO_SAVE_STORAGE_KEY, JSON.stringify(parsed));
      setUploadState({
        filename: file.name,
        message: "View state uploaded. You can now continue with either system.",
        status: "success",
      });
    } catch {
      setUploadState({
        filename: file.name,
        message: "Upload failed. Choose a valid dashboard state JSON file.",
        status: "error",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleModeSelect = (mode: "A" | "B") => {
    if (!canSelectSystem) return;
    setSelectedMode(mode);
    setSystemMode(mode);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <section className="w-full border border-slate-200 bg-white p-6 md:p-8">
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Select system mode
              </h1>
              <p className="text-sm text-slate-500">
                Upload a saved state or confirm first user access.
              </p>
            </div>

            <div className="space-y-3 border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    View State Upload
                  </p>
                  <p className="text-sm text-slate-500">Optional</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                className="w-full justify-center border-slate-300 bg-white"
                onClick={handleUploadClick}
              >
                Upload View State
              </Button>

              <p
                className={`text-sm ${
                  uploadState.status === "error"
                    ? "text-rose-600"
                    : uploadState.status === "success"
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
              >
                {uploadState.message}
              </p>
              {uploadState.filename && (
                <p className="truncate text-xs text-slate-400">
                  {uploadState.filename}
                </p>
              )}
            </div>

            <label className="flex items-center gap-3 border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isFirstUser}
                onChange={(event) => setIsFirstUser(event.target.checked)}
                className="size-4 rounded border-slate-300 text-sky-600"
              />
              <span>I am the first user</span>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleModeSelect("A")}
                disabled={!canSelectSystem}
                className="border border-slate-300 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <p className="text-sm font-medium text-slate-900">
                  {selectedMode === "A" ? "Loading..." : "System A"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("B")}
                disabled={!canSelectSystem}
                className="border border-slate-300 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <p className="text-sm font-medium text-slate-900">
                  {selectedMode === "B" ? "Loading..." : "System B"}
                </p>
              </button>
            </div>

            {!canSelectSystem && (
              <p className="text-sm text-slate-500">
                System selection is disabled until one setup option is completed.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
