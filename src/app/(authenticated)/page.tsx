import type { Metadata } from "next";
import { Metrics } from "@/components/dashboard/Metrics";
import React from "react";
import Apps from "@/components/dashboard/Apps";

export const metadata: Metadata = {
  title: "LightShift - Dashboard",
  description: "Lite weight deployment platform for your projects.",
};

export default function Ecommerce() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      
        <Metrics />
        <Apps />

    </div>
  );
}
