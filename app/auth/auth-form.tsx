"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/client"

interface AuthFormProps {
  mode: "login" | "sign-up"
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === "sign-up"

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(undefined)

    try {
      const supabase = createClient()
      const result = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          })
        : await supabase.auth.signInWithPassword({ email, password })

      if (result.error) {
        setMessage(result.error.message)
        return
      }

      if (isSignUp && !result.data.session) {
        setMessage("Check your email to confirm your account before signing in.")
        return
      }

      router.push("/campaigns/new")
      router.refresh()
    } catch {
      setMessage("Unable to reach the authentication service. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create an account to keep campaign work private."
              : "Sign in to create and view your campaigns."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {message ? <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Spinner /> Working…</> : isSignUp ? "Create account" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account? " : "Need an account? "}
              <Link className="font-medium text-foreground underline underline-offset-4" href={isSignUp ? "/auth/login" : "/auth/sign-up"}>
                {isSignUp ? "Sign in" : "Sign up"}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
