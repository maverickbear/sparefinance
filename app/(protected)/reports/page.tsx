import { getBudgets } from "@/lib/api/budgets";
import { getTransactions } from "@/lib/api/transactions";
import { formatMoney } from "@/components/common/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { getCurrentUserLimits } from "@/lib/api/limits";
import { ReportsContent } from "./reports-content";

export default async function ReportsPage() {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const endDate = endOfMonth(now);

  const limits = await getCurrentUserLimits();
  const budgets = await getBudgets(now);
  const transactions = await getTransactions({
    startDate: currentMonth,
    endDate,
  });

  return <ReportsContent limits={limits} budgets={budgets} transactions={transactions} now={now} />;
}

