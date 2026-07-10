import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  
  const loginMutation = useAdminLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    loginMutation.mutate(
      { data: { password } },
      {
        onSuccess: (res) => {
          if (res.success) {
            login(password);
            setLocation("/analytics");
          } else {
            setError("Invalid password");
          }
        },
        onError: () => {
          setError("Failed to authenticate. Check server logs.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-lg shadow-xl overflow-hidden border border-border">
        <div className="p-6 sm:p-8">
          <div className="flex justify-center mb-6 text-primary">
            <ShieldAlert size={48} />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Qontri Operations</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Authorized personnel only.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Admin Passphrase</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="bg-background"
                placeholder="Enter passphrase"
              />
            </div>
            {error && <div className="text-destructive text-sm font-medium">{error}</div>}
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Authenticating..." : "Access Console"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
