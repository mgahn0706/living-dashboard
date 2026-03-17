"use client";

import React from "react";
import { SystemModeProvider } from "@/context/SystemModeContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SystemModeProvider>{children}</SystemModeProvider>;
}
