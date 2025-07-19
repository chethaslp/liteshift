"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { getIcon } from "@/lib/icons";
import { useEffect, useState } from "react";
import { PM2Process } from "@/lib/pm2";
import { LuRefreshCcw } from "react-icons/lu";


export default function Apps() {

  const [apps, setApps] = useState<PM2Process[]>();

  const fetchApps = async () => {
      try {
        const response = await fetch('/api/pm2?action=list');
        if (!response.ok) {
          throw new Error('Failed to fetch apps');
        }
        const data = await response.json();
        setApps(data.data || []);
        console.log('Fetched apps:', data.data.processes);
      } catch (error) {
        console.error('Error fetching apps:', error);
      }
    };

  useEffect(() => {
    fetchApps();
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Apps
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchApps} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200">
            <LuRefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                App Name
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Uptime
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                CPU Usage
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Memory Usage
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {apps && apps.length === 0 && (
              <TableRow>
                <TableCell className="text-center py-6">
                  <p className="text-gray-500 dark:text-gray-400">
                    No applications found.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {apps && apps.map((app) => (
              <TableRow key={app.pm_id} className="">
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-[50px] w-[50px] overflow-hidden rounded-md flex items-center justify-center">
                      {getIcon(app.name.toLowerCase())}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {app.name}
                      </p>
                      <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                        {app.pid}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {app.uptime}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {app.cpu}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {app.memory}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  <Badge
                    size="sm"
                    color={
                      app.status === "Running"
                        ? "success"
                        : app.status === "Building"
                        ? "warning"
                        : app.status === "Stopped"
                        ? "info"
                        : "error"
                    }
                  >
                    {app.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
