"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";
import Image from "next/image";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setIsLoading(false);

    if (res?.ok) {
      router.push("/");
    } else {
      setError("Email atau password salah.");
    }
  };

  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white text-black dark:bg-black dark:text-white">
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 left-4 z-10">
        <ModeToggle />
      </div>

      {/* Left: Login Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Masuk ke Akun Anda</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Masukkan email Anda untuk masuk ke akun
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / NIM</Label>
              <Input
                id="email"
                type="text"
                placeholder="m@example.com atau SKA123214"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-black dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <a
                  href="#"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-black dark:text-white"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 -mt-2">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-900 dark:hover:bg-neutral-100"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Login"}
            </Button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Masuk menggunakan akun yang sudah dibuatkan oleh SuperAdmin
            </p>
          </form>
        </div>
      </div>

      {/* Right: Illustration */}
      <div className="hidden lg:block bg-neutral-100 dark:bg-neutral-900 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-12 rounded-lg">
            <Image
              src="/bg-login.png"
              alt="Ujian Online"
              width={400}
              height={400}
              className="object-contain rounded-4xl"
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
