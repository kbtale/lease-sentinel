import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

/**
 * Verification page shown after sending magic link email.
 */
export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 text-6xl">✉️</div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-base mt-2">
            A sign-in link has been sent to your email address.
            <br />
            Click the link to complete sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </p>
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            ← Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
