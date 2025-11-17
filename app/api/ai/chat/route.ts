import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import { getTransactions } from "@/lib/api/transactions";
import { getAccounts } from "@/lib/api/accounts";
import { getBudgets } from "@/lib/api/budgets";
import { getGoals } from "@/lib/api/goals";
import { getDebts } from "@/lib/api/debts";
import { getTotalInvestmentsValue } from "@/lib/api/simple-investments";
import { calculateFinancialHealth } from "@/lib/api/financial-health";
import { getProfile } from "@/lib/api/profile";
import OpenAI from "openai";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Fetch all financial data in parallel
    const currentDate = new Date();
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);
    const twelveMonthsAgo = subMonths(currentDate, 12);

    const [
      transactionsResult,
      accounts,
      budgets,
      goals,
      debts,
      investmentsValue,
      financialHealth,
      profile,
    ] = await Promise.all([
      getTransactions({
        startDate: twelveMonthsAgo,
        endDate: currentDate,
      }),
      getAccounts(),
      getBudgets(currentDate),
      getGoals(),
      getDebts(),
      getTotalInvestmentsValue(),
      calculateFinancialHealth(currentDate),
      getProfile(),
    ]);

    // Extract transactions array from result
    const transactions = Array.isArray(transactionsResult)
      ? transactionsResult
      : (transactionsResult?.transactions || []);

    // Format financial context for AI
    const financialContext = formatFinancialContext({
      transactions: transactions.slice(0, 50), // Limit to last 50 transactions
      accounts,
      budgets,
      goals,
      debts,
      investmentsValue,
      financialHealth,
      profile,
      currentMonthStart,
      currentMonthEnd,
    });

    // Build conversation messages
    const messages: Message[] = [
      {
        role: "system",
        content: `You are a helpful financial assistant for Spare Finance. Your role is to help users understand their financial situation, answer questions about their transactions, accounts, budgets, goals, debts, and investments. 

You have access to the user's complete financial data. Always be:
- Accurate and specific when referencing numbers
- Helpful and encouraging
- Clear and concise
- Privacy-conscious (never share data outside the context)

When answering questions:
- Use specific numbers from the data when available
- Provide actionable insights and suggestions
- Reference specific transactions, accounts, or categories when relevant
- Be empathetic about financial challenges
- Celebrate financial wins

Current date: ${currentDate.toLocaleDateString("pt-BR")}`,
      },
      ...conversationHistory.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    // Add financial context as a system message before the user's question
    messages.splice(1, 0, {
      role: "system",
      content: `Here is the user's financial data:\n\n${financialContext}`,
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency, can be changed to gpt-4 or gpt-3.5-turbo
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error("Error in AI chat API:", error);
    
    if (error instanceof Error) {
      // Check if it's an OpenAI API error
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "AI service configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

function formatFinancialContext(data: {
  transactions: any[];
  accounts: any[];
  budgets: any[];
  goals: any[];
  debts: any[];
  investmentsValue: number;
  financialHealth: any;
  profile: any;
  currentMonthStart: Date;
  currentMonthEnd: Date;
}): string {
  const {
    transactions,
    accounts,
    budgets,
    goals,
    debts,
    investmentsValue,
    financialHealth,
    profile,
    currentMonthStart,
    currentMonthEnd,
  } = data;

  const lines: string[] = [];

  // User profile
  if (profile) {
    lines.push(`## User Profile`);
    lines.push(`Name: ${profile.name || "Not provided"}`);
    lines.push(`Email: ${profile.email || "Not provided"}`);
    lines.push("");
  }

  // Spare Score Summary
  if (financialHealth) {
    lines.push(`## Spare Score Summary`);
    lines.push(`Score: ${financialHealth.score}/100 (${financialHealth.classification})`);
    lines.push(`Monthly Income: $${financialHealth.monthlyIncome.toFixed(2)}`);
    lines.push(`Monthly Expenses: $${financialHealth.monthlyExpenses.toFixed(2)}`);
    lines.push(`Net Amount: $${financialHealth.netAmount.toFixed(2)}`);
    lines.push(`Savings Rate: ${financialHealth.savingsRate.toFixed(2)}%`);
    lines.push(`Message: ${financialHealth.message}`);
    
    if (financialHealth.alerts && financialHealth.alerts.length > 0) {
      lines.push(`\nAlerts:`);
      financialHealth.alerts.forEach((alert: any) => {
        lines.push(`- [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.description}`);
      });
    }
    
    if (financialHealth.suggestions && financialHealth.suggestions.length > 0) {
      lines.push(`\nSuggestions:`);
      financialHealth.suggestions.forEach((suggestion: any) => {
        lines.push(`- [${suggestion.impact.toUpperCase()} Impact] ${suggestion.title}: ${suggestion.description}`);
      });
    }
    lines.push("");
  }

  // Accounts Summary
  if (accounts && accounts.length > 0) {
    lines.push(`## Accounts (${accounts.length} total)`);
    const totalBalance = accounts.reduce((sum, acc) => sum + ((acc.balance || 0) as number), 0);
    lines.push(`Total Balance: $${totalBalance.toFixed(2)}`);
    lines.push(`\nAccounts:`);
    accounts.forEach((account) => {
      lines.push(`- ${account.name} (${account.type}): $${(account.balance || 0).toFixed(2)}`);
    });
    lines.push("");
  }

  // Current Month Transactions Summary
  const currentMonthTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= currentMonthStart && txDate <= currentMonthEnd;
  });

  if (currentMonthTransactions.length > 0) {
    const monthIncome = currentMonthTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const monthExpenses = currentMonthTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    lines.push(`## Current Month (${currentMonthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})`);
    lines.push(`Income: $${monthIncome.toFixed(2)}`);
    lines.push(`Expenses: $${monthExpenses.toFixed(2)}`);
    lines.push(`Net: $${(monthIncome - monthExpenses).toFixed(2)}`);
    lines.push(`Transactions: ${currentMonthTransactions.length}`);
    lines.push("");
  }

  // Recent Transactions
  if (transactions && transactions.length > 0) {
    lines.push(`## Recent Transactions (last ${Math.min(transactions.length, 20)} of ${transactions.length} total)`);
    transactions.slice(0, 20).forEach((tx) => {
      const date = new Date(tx.date).toLocaleDateString("pt-BR");
      const category = tx.category?.name || tx.subcategory?.name || "Uncategorized";
      const account = tx.account?.name || "Unknown Account";
      lines.push(`- ${date}: ${tx.type === "income" ? "+" : "-"}$${Number(tx.amount).toFixed(2)} - ${tx.description || "No description"} (${category}, ${account})`);
    });
    lines.push("");
  }

  // Budgets
  if (budgets && budgets.length > 0) {
    lines.push(`## Budgets (${budgets.length} total)`);
    budgets.forEach((budget) => {
      const actualSpend = budget.actualSpend || 0;
      const amount = budget.amount || 0;
      const percentage = budget.percentage || 0;
      const status = budget.status || "ok";
      const displayName = budget.displayName || budget.category?.name || budget.macro?.name || "Unknown";
      lines.push(`- ${displayName}: $${actualSpend.toFixed(2)} / $${amount.toFixed(2)} (${percentage.toFixed(1)}%) - ${status}`);
    });
    lines.push("");
  }

  // Goals
  if (goals && goals.length > 0) {
    lines.push(`## Financial Goals (${goals.length} total)`);
    goals.forEach((goal) => {
      const progress = goal.progressPct || 0;
      const monthlyContribution = goal.monthlyContribution || 0;
      const monthsToGoal = goal.monthsToGoal;
      lines.push(`- ${goal.name}: $${(goal.currentBalance || 0).toFixed(2)} / $${(goal.targetAmount || 0).toFixed(2)} (${progress.toFixed(1)}%)`);
      if (monthlyContribution > 0) {
        lines.push(`  Monthly contribution: $${monthlyContribution.toFixed(2)}`);
      }
      if (monthsToGoal !== null && monthsToGoal !== undefined) {
        lines.push(`  Estimated months to goal: ${monthsToGoal}`);
      }
      if (goal.isPaused) {
        lines.push(`  Status: PAUSED`);
      } else if (goal.isCompleted) {
        lines.push(`  Status: COMPLETED`);
      }
    });
    lines.push("");
  }

  // Debts
  if (debts && debts.length > 0) {
    const activeDebts = debts.filter((d) => !d.isPaidOff);
    if (activeDebts.length > 0) {
      lines.push(`## Active Debts (${activeDebts.length} of ${debts.length} total)`);
      activeDebts.forEach((debt) => {
        const progress = debt.progressPct || 0;
        const monthsRemaining = debt.monthsRemaining;
        lines.push(`- ${debt.name}: $${(debt.currentBalance || 0).toFixed(2)} remaining (${progress.toFixed(1)}% paid)`);
        lines.push(`  Monthly payment: $${(debt.monthlyPayment || 0).toFixed(2)}`);
        lines.push(`  Interest rate: ${(debt.interestRate || 0).toFixed(2)}%`);
        if (monthsRemaining !== null && monthsRemaining !== undefined) {
          lines.push(`  Estimated months remaining: ${monthsRemaining}`);
        }
        if (debt.isPaused) {
          lines.push(`  Status: PAUSED`);
        }
      });
      lines.push("");
    }
  }

  // Investments
  if (investmentsValue > 0) {
    lines.push(`## Investments`);
    lines.push(`Total Investment Value: $${investmentsValue.toFixed(2)}`);
    lines.push("");
  }

  return lines.join("\n");
}

