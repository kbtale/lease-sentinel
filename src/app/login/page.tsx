"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, signInWithEmail } from "@/actions/auth.actions";

/**
 * Login page with split-screen layout.
 * Left: Auth form (40%) | Right: Brand wall (60%, hidden on mobile)
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await signInWithEmail(email);
      setEmailSent(true);
    } catch {
      // Error handling
    } finally {
      setIsLoading(false);
    }
  };

  // Email sent confirmation view
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="text-6xl">📧</div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a magic link to <strong>{email}</strong>
            <br />
            Click the link to sign in.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
            }}
          >
            ← Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Auth Zone (40%) */}
      <div className="w-full lg:w-[40%] flex flex-col items-center justify-center px-8 lg:px-16 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Sign in to manage your lease deadlines and alerts.
            </p>
          </div>

          {/* Auth Forms */}
          <div className="space-y-6">
            {/* Google Sign-In */}
            <form action={loginAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full h-12 text-base"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Email Magic Link */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? "Sending link..." : "Sign in with Email"}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              We&apos;ll send you a magic link. No password needed.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Brand Wall (60%, hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[60%] bg-zinc-900 text-white flex-col items-center justify-center p-16">
        <div className="max-w-lg text-center space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/logo_white.svg"
              alt="LeaseSentinel"
              width={48}
              height={48}
            />
            <span className="text-3xl font-bold">LeaseSentinel</span>
          </div>

          <blockquote className="space-y-4">
            <p className="text-3xl font-light leading-relaxed">
              &ldquo;Never miss a lease renewal clause again.&rdquo;
            </p>
            <p className="text-xl text-zinc-400">
              The autopilot for your legal documents.
            </p>
          </blockquote>

          <div className="pt-8 border-t border-zinc-800">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-2xl font-bold">AI-Powered</div>
                <div className="text-sm text-zinc-400">Clause Extraction</div>
              </div>
              <div>
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm text-zinc-400">Monitoring</div>
              </div>
              <div>
                <div className="text-2xl font-bold">Instant</div>
                <div className="text-sm text-zinc-400">Webhook Alerts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
