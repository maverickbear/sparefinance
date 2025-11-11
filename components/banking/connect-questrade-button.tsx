"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { Loader2, ExternalLink } from "lucide-react";
import { FeatureGuard } from "@/components/common/feature-guard";

interface ConnectQuestradeButtonProps {
  onSuccess?: () => void;
}

export function ConnectQuestradeButton({
  onSuccess,
}: ConnectQuestradeButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [manualAuthToken, setManualAuthToken] = useState("");

  const handleConnect = async () => {
    if (!manualAuthToken.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira seu token de autorização da Questrade",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/questrade/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualAuthToken: manualAuthToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect Questrade account");
      }

      toast({
        title: "Conta conectada",
        description:
          "Sua conta Questrade foi conectada com sucesso. Suas posições e transações estão sendo sincronizadas.",
        variant: "success",
      });

      setIsOpen(false);
      setManualAuthToken("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error connecting Questrade account:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar conta Questrade",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FeatureGuard feature="hasInvestments" featureName="Investments">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            Conectar Questrade
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Conta Questrade</DialogTitle>
            <DialogDescription>
              Para conectar sua conta Questrade, você precisa gerar um token de
              autorização no Questrade API Centre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token de Autorização</Label>
              <Input
                id="token"
                type="text"
                placeholder="Insira seu token de autorização da Questrade"
                value={manualAuthToken}
                onChange={(e) => setManualAuthToken(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Obtenha seu token no{" "}
                <a
                  href="https://www.questrade.com/api/documentation/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Questrade API Centre
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold mb-2">Como obter seu token:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Faça login na sua conta Questrade</li>
                <li>Vá para API Centre no menu superior direito</li>
                <li>Clique em "Ativar API" e aceite os termos</li>
                <li>Clique em "Registrar um app pessoal"</li>
                <li>Clique em "Nova autorização manual"</li>
                <li>Copie o token de autorização e cole aqui</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleConnect} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                "Conectar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeatureGuard>
  );
}

