"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ThemeProvider } from "@/context/ThemeContext";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import GridShape from "../common/GridShape";
import ThemeTogglerTwo from "../common/ThemeTogglerTwo";
import { IoIosWarning, IoMdWarning } from "react-icons/io";
import { useSocketContext } from "@/context/SocketContext";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const { setCreds } = useSocketContext();

  useEffect(() => {
    if(localStorage.getItem("host") !== undefined && localStorage.getItem("host") !== "") {
      setHost(localStorage.getItem("host"));
    }
  }, []);

  // Placeholder for form submission logic
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Reset error state

    // get form values
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const host = formData.get("host") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if(!host || !username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    localStorage.setItem("host", host.trim());
    setCreds({
      host: host.trim(),
      username: username.trim(),
      password: password.trim(),
    });

  }


  return <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col  dark:bg-gray-900 sm:p-0">
          <div className="flex flex-col flex-1 lg:w-1/2 w-full justify-center px-4 py-8 mx-auto sm:px-6 lg:px-8">
    
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your credentials to access your server.
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Host <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input placeholder="183.165.215.2" type="text" name="host"  defaultValue={host || ""}/>
                </div>
                <div>
                  <Label>
                    Username <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input placeholder="Enter your Username" type="text" name="username" />
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      name="password"
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                  {error && (
                  <div className="py-2 px-3 flex items-center justify-center bg-error-50 dark:bg-error-500 border border-error-200 dark:border-error-500 rounded-md">
                    <IoIosWarning className="fill-error-500 dark:fill-white inline-block mr-2" />
                    <p className="text-sm text-error-500 dark:text-white">{error}</p>
                  </div>
                )}
                  
                </div>
                <div>
                  <Button className="w-full" size="sm">
                    Sign in
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
          <div className="lg:w-1/2 w-full h-full bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
            <div className="relative items-center justify-center  flex z-1">
              {/* <!-- ===== Common Grid Shape Start ===== --> */}
              <GridShape />
              <div className="flex flex-col items-center max-w-xs">
                <Link href="/" className="block mb-4">
                  <Image
                    width={120}
                    height={48}
                    src="/images/logo/logo-icon.png"
                    alt="Logo"
                  />
                  <span className="text-2xl text-white flex items-center justify-center mt-2">liteshift</span>
                </Link>
                <p className="text-center text-gray-400 dark:text-white/60">
                  Lite weight deployment platform for your projects.
                </p>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
}
