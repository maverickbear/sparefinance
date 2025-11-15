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
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Alert {
  type: "success" | "warning" | "danger";
  badge: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      currentIncome,
      currentExpenses,
      emergencyFundMonths,
      selectedMonthTransactions = [],
      lastMonthTransactions = [],
    } = body;

    // Fetch financial data
    const currentDate = new Date();
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);
    const twelveMonthsAgo = subMonths(currentDate, 12);

    const [
      transactions,
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

    // Calculate key metrics
    const savingsRate =
      currentIncome > 0
        ? ((currentIncome - currentExpenses) / currentIncome) * 100
        : 0;
    const monthlySavings = currentIncome - currentExpenses;
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + (acc.balance || 0),
      0
    );

    // Build financial context for AI
    const financialContext = `
## Financial Situation Summary

**Income & Expenses:**
- Monthly Income: $${currentIncome.toFixed(2)}
- Monthly Expenses: $${currentExpenses.toFixed(2)}
- Monthly Savings: $${monthlySavings.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%

**Emergency Fund:**
- Current Coverage: ${emergencyFundMonths.toFixed(1)} months
- Total Balance: $${totalBalance.toFixed(2)}
- Recommended: 6 months

**Financial Health Score:** ${financialHealth.score}/100 (${financialHealth.classification})

**Accounts:** ${accounts.length} accounts with total balance of $${totalBalance.toFixed(2)}

**Budgets:** ${budgets.length} active budgets
${budgets
  .slice(0, 5)
  .map(
    (b: any) =>
      `- ${b.displayName || b.category?.name || "Unknown"}: $${(
        b.actualSpend || 0
      ).toFixed(2)} / $${(b.amount || 0).toFixed(2)} (${(
        b.percentage || 0
      ).toFixed(1)}%)`
  )
  .join("\n")}

**Goals:** ${goals.length} active goals
${goals
  .slice(0, 5)
  .map(
    (g: any) =>
      `- ${g.name}: $${(g.currentBalance || 0).toFixed(2)} / $${(
        g.targetAmount || 0
      ).toFixed(2)} (${(g.progressPct || 0).toFixed(1)}%)`
  )
  .join("\n")}

**Debts:** ${debts.filter((d: any) => !d.isPaidOff).length} active debts
${debts
  .filter((d: any) => !d.isPaidOff)
  .slice(0, 3)
  .map(
    (d: any) =>
      `- ${d.name}: $${(d.currentBalance || 0).toFixed(2)} remaining`
  )
  .join("\n")}

**Recent Spending Trends:**
- Current month expenses: $${selectedMonthTransactions
  .filter((t: any) => t.type === "expense")
  .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
  .toFixed(2)}
- Last month expenses: $${lastMonthTransactions
  .filter((t: any) => t.type === "expense")
  .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
  .toFixed(2)}
`;

    // Call OpenAI to generate personalized alerts
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a financial advisor AI assistant for Spare Finance. Your role is to analyze the user's financial data and generate personalized, actionable alerts and insights.

Generate 2-4 alerts that are:
- Specific and actionable (include numbers and concrete recommendations)
- Prioritized by importance (most critical first)
- Written in a friendly, encouraging tone
- Focused on what the user should do right now

For each alert, determine:
- type: "success" (positive achievement), "warning" (needs attention), or "danger" (urgent action needed)
- badge: A short category name (2-3 words max, e.g., "Emergency Fund", "Savings Rate", "Budget Alert")
- text: A clear, actionable message (max 150 characters) with specific numbers and recommendations

Return a JSON object with an "alerts" array in this exact format:
{
  "alerts": [
    {
      "type": "warning",
      "badge": "Emergency Fund",
      "text": "Your emergency fund covers 1.1 months. Setting an automatic transfer of $259/month would get you to 6 months in about 9 months"
    }
  ]
}

Current date: ${currentDate.toLocaleDateString("pt-BR")}`,
        },
        {
          role: "user",
          content: `Analyze this financial data and generate personalized alerts:\n\n${financialContext}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    // Parse the response
    const responseContent =
      completion.choices[0]?.message?.content || "{}";
    let parsedResponse: { alerts?: Alert[] } = {};

    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("Error parsing extracted JSON:", e);
        }
      } else {
        // Fallback: try to parse as direct object
        const objectMatch = responseContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try {
            parsedResponse = JSON.parse(objectMatch[0]);
          } catch (e) {
            console.error("Error parsing object match:", e);
          }
        }
      }
    }

    const alerts = parsedResponse.alerts || [];

    // Validate and ensure alerts have correct structure
    const validAlerts = alerts
      .filter(
        (alert: any) =>
          alert &&
          typeof alert === "object" &&
          ["success", "warning", "danger"].includes(alert.type) &&
          typeof alert.badge === "string" &&
          typeof alert.text === "string"
      )
      .slice(0, 4); // Limit to 4 alerts max

    return NextResponse.json({
      alerts: validAlerts,
    });
  } catch (error) {
    console.error("Error generating AI alerts:", error);

    // Return empty array on error (component will fallback to basic alerts)
    return NextResponse.json(
      { alerts: [] },
      { status: 200 } // Return 200 so component doesn't break
    );
  }
}

