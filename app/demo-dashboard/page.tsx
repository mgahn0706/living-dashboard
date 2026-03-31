"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemMode } from "@/context/SystemModeContext";

export default function DemoDashboardPage() {
  const router = useRouter();
  const { setSystemMode } = useSystemMode();

  useEffect(() => {
    setSystemMode("A");
    router.replace("/dashboard?demo=1");
  }, [router, setSystemMode]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-slate-900">
      <p className="text-sm text-slate-500">Launching demo dashboard...</p>
    </main>
  );
}
