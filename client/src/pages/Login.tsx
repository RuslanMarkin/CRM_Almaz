import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useState, type FormEvent } from "react";

export default function Login() {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.auth.me.invalidate();
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ username, password });
    } catch (cause) {
      setPassword("");
      setError(
        cause instanceof TRPCClientError && cause.data?.code === "UNAUTHORIZED"
          ? "Неверный логин или пароль"
          : "Не удалось выполнить вход. Повторите попытку.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border bg-background p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Вход в CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Логистический документооборот</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Логин</Label>
          <Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Входим…" : "Войти"}
        </Button>
      </form>
    </main>
  );
}
