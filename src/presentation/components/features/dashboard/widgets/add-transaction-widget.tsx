"use client";

import { useState, useEffect } from "react";
import { WidgetCard } from "./widget-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRightLeft } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddTransactionWidgetProps {
  onTransactionAdded?: () => void;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

export function AddTransactionWidget({ onTransactionAdded }: AddTransactionWidgetProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetch("/api/v2/accounts"),
          fetch("/api/v2/categories?all=true")
        ]);

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData);
          if (accountsData && accountsData.length > 0) {
            setAccountId(accountsData[0].id);
            if (accountsData.length > 1) {
              setToAccountId(accountsData[1].id);
            }
          }
        }
        
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) {
      if (!accountId) {
        toast({
          variant: "destructive",
          title: "No account found",
          description: "Please create an account first."
        });
      }
      return;
    }

    if (type === "transfer" && !toAccountId) {
      toast({
        variant: "destructive",
        title: "Destination account required",
        description: "Please select a destination account for the transfer."
      });
      return;
    }

    if (type === "transfer" && accountId === toAccountId) {
       toast({
        variant: "destructive",
        title: "Invalid transfer",
        description: "Source and destination accounts cannot be the same."
      });
      return;
    }

    try {
      setLoading(true);
      
      const payload: any = {
        type,
        amount: parseFloat(amount),
        description,
        date: new Date().toISOString().split('T')[0],
        accountId,
        categoryId: type === "transfer" ? null : (categoryId || null)
      };

      if (type === "transfer") {
        payload.toAccountId = toAccountId;
      }

      const response = await fetch("/api/v2/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      toast({
        variant: "success",
        title: type === 'transfer' ? 'Transfer successful' : `${type === 'expense' ? 'Expense' : 'Income'} added`,
        description: "Transaction created successfully"
      });
      
      setAmount("");
      setDescription("");
      // Don't reset accounts as user might want to add another tx for same account
      router.refresh();
      onTransactionAdded?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add transaction"
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter categories based on selected type
  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <WidgetCard title="Add a transaction" className="h-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-full">
        <Tabs value={type} onValueChange={(v) => setType(v as "expense" | "income" | "transfer")} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3 flex-1 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
               <Label htmlFor="amount" className="text-xs text-muted-foreground">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account" className="text-xs text-muted-foreground">
                 {type === "transfer" ? "From Account" : "Account"}
              </Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={accounts.length === 0}>
                <SelectTrigger id="account" className="h-9">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "transfer" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
               <Label htmlFor="toAccount" className="text-xs text-muted-foreground">To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId} disabled={accounts.length < 2}>
                <SelectTrigger id="toAccount" className="h-9">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(acc => acc.id !== accountId)
                    .map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type !== "transfer" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
               <Label htmlFor="category" className="text-xs text-muted-foreground">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={filteredCategories.length === 0}>
                <SelectTrigger id="category" className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
             <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
            <Input
              id="description"
              placeholder="What was it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          size="small"
          className={cn(
            "w-full mt-2",
            type === "expense" && "bg-indigo-500 hover:bg-indigo-600",
            type === "income" && "bg-emerald-500 hover:bg-emerald-600",
            type === "transfer" && "bg-blue-500 hover:bg-blue-600"
          )}
          disabled={loading || !amount || accounts.length === 0}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${type}`}
        </Button>
      </form>
    </WidgetCard>
  );
}
