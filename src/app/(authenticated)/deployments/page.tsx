import type { Metadata } from "next";
import React from "react";
import DeploymentQueue from "@/components/dashboard/DeploymentQueue";

export const metadata: Metadata = {
  title: "LightShift - Dashboard",
  description: "Lite weight deployment platform for your projects.",
};

export default function Ecommerce() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <DeploymentQueue/>
    </div>
  );
}
