"use client";
import React, { useEffect } from "react";
import Badge from "../ui/badge/Badge";
import { LuMemoryStick, LuCpu, LuLoaderCircle, LuClock } from "react-icons/lu";
import { IoIosWarning } from "react-icons/io";
import { FaRegFloppyDisk } from "react-icons/fa6";
import { formatTime } from "@/lib/utils";
import { useSocketContext } from "@/context/SocketContext";


export const Metrics = () => {
  const [data, setData] = React.useState<SystemAnalyticsResponse>();
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    socket.emitWithAck("system:stream-analytics", {interval: 1000}).then((response: {success : boolean, message: string}) => {
      if (response.success) {
        console.log("System analytics data fetched successfully");
      }else{  
        console.error("Failed to fetch system analytics data");
      }
    });

    socket.on("system:analytics-stream", (response: SystemAnalyticsResponse) => {
      setData(response);
    });
    
    return () => {
      socket.off("system:analytics-stream");
      
      socket.emitWithAck("system:stop-stream", {}).then((response: {success : boolean, message: string}) => {
        if (response.success) {
          console.log("Stopped system analytics stream successfully");
        } else {
          console.error("Failed to stop system analytics stream");
        }
      });
    }
  }, [socket]);

    return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <LuMemoryStick className="text-gray-800 dark:text-white/90" size={20}/>
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Memory Usage
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {data ? data.memory.usedPercentage + " %" : "Loading..."}
            </h4>
          </div>
          <Badge color="success">
            {data ? data.memory.formatted : <LuLoaderCircle className="animate-spin" size={16} />}
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <LuCpu className="text-gray-800 dark:text-white/90" size={20} />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              CPU Usage
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {data? data.cpu.usagePercentage + " %" : "Loading..."}
            </h4>
          </div>
          <Badge color="success">
              {data ? data.cpu.formatted : <LuLoaderCircle className="animate-spin" size={16} />}
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <FaRegFloppyDisk className="text-gray-800 dark:text-white/90" size={25} />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Disk Usage
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {data? data.disk.usedPercentage + " %" : "Loading..."}
            </h4>
          </div>
          <Badge color="success">
            {data ? data.disk.formatted : <LuLoaderCircle className="animate-spin" size={16} />}
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

       {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">

        <div className="flex items-end flex-col justify-between mt-5">
          <div className="w-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex gap-2">
              <LuClock className="text-gray-800 dark:text-white/90" size={20} />
              Uptime
            </div>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {data? formatTime(data.uptime) : "Loading..."}
            </h4>
          </div>

      <div className="flex w-full items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Caddy
          </p>
          <span className={`flex items-center justify-center gap-1 rounded-full px-3 py-1 text-xs capitalize font-medium ${data?.caddyStatus === 'active' ? 'dark:bg-success-500/15 dark:text-success-500 text-success-600 bg-success-50' : 'dark:bg-error-500/15 dark:text-error-500 text-error-600 bg-error-50'}`}>
            {data?.caddyStatus === 'active'? <div className="animate-pulse rounded-full size-2.5 mr-1  bg-success-600"></div>:<IoIosWarning className="text-error-600" size={16} />}
            {data ? data.caddyStatus : <LuLoaderCircle className="animate-spin" size={16} />}
          </span>
        </div>

        {/* <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div> */}

        {/* <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Today
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            $20K
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.60141 2.33683C7.73885 2.18084 7.9401 2.08243 8.16435 2.08243C8.16475 2.08243 8.16516 2.08243 8.16556 2.08243C8.35773 2.08219 8.54998 2.15535 8.69664 2.30191L12.6968 6.29924C12.9898 6.59203 12.9899 7.0669 12.6971 7.3599C12.4044 7.6529 11.9295 7.65306 11.6365 7.36027L8.91435 4.64004L8.91435 13.5C8.91435 13.9142 8.57856 14.25 8.16435 14.25C7.75013 14.25 7.41435 13.9142 7.41435 13.5L7.41435 4.64442L4.69679 7.36025C4.4038 7.65305 3.92893 7.6529 3.63613 7.35992C3.34333 7.06693 3.34348 6.59206 3.63646 6.29926L7.60141 2.33683Z"
                fill="#039855"
              />
            </svg>
          </p>
        </div> */}

      </div>

        </div>
      </div>
      {/* <!-- Metric Item End --> */}

    </div>
  );
};


type BytesFormat = {
  value: number;
  unit: string;
  raw: number;
};

type SystemAnalyticsResponse = {
  cpu: {
    loadAvg1min: number;
    loadAvg5min: number;
    formatted: string;
    loadAvg15min: number;
    cores: number;
    usagePercentage: number;
  },
  memory: {
    total: BytesFormat;
    formatted: string;
    free: BytesFormat;
    used: BytesFormat;
    usedPercentage: number;
  },
  disk: {
    total: BytesFormat;
    formatted: string;
    used: BytesFormat;
    usedPercentage: number;
  },
  caddyStatus: 'active' | 'inactive';
  uptime: number;
  timestamp: Date;
};