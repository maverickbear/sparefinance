import { z } from "zod";

export const debtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  loanType: z.enum(["mortgage", "car_loan", "personal_loan", "credit_card", "student_loan", "business_loan", "other"], {
    errorMap: () => ({ message: "Loan type is required" }),
  }),
  initialAmount: z.number().positive("Initial amount must be positive"),
  totalMonths: z.number().positive("Total months must be positive").nullable().optional(),
  paymentFrequency: z.enum(["monthly", "biweekly", "weekly", "semimonthly", "daily"], {
    errorMap: () => ({ message: "Payment frequency is required" }),
  }),
  downPayment: z.number().nonnegative("Down payment must be non-negative").optional().default(0),
  currentBalance: z.number().nonnegative("Current balance must be non-negative").optional(),
  interestRate: z.number().nonnegative("Interest rate must be non-negative").optional(),
  firstPaymentDate: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  paymentAmount: z.number().nonnegative("Payment amount must be non-negative").optional(),
  monthlyPayment: z.number().nonnegative("Monthly payment must be non-negative").optional(),
  principalPaid: z.number().nonnegative("Principal paid must be non-negative").optional().default(0),
  interestPaid: z.number().nonnegative("Interest paid must be non-negative").optional().default(0),
  additionalContributions: z.boolean().optional().default(false),
  additionalContributionAmount: z.number().nonnegative("Additional contribution amount must be non-negative").optional().default(0),
  priority: z.enum(["High", "Medium", "Low"], {
    errorMap: () => ({ message: "Priority must be High, Medium, or Low" }),
  }).optional().default("Medium"),
  description: z.string().optional(),
  accountId: z.string().min(1, "Account is required"),
  isPaused: z.boolean().optional().default(false),
}).refine((data) => {
  // Credit Card: totalMonths is not required (revolving credit)
  const loanTypeLower = (data.loanType || "").toLowerCase();
  const isCreditCard = loanTypeLower.includes("credit") || loanTypeLower.includes("card");
  if (isCreditCard) {
    return true;
  }
  return data.totalMonths !== null && data.totalMonths !== undefined && data.totalMonths > 0;
}, {
  message: "Total months is required for this loan type",
  path: ["totalMonths"],
}).refine((data) => {
  const loanTypeLower = (data.loanType || "").toLowerCase();
  const isCreditCard = loanTypeLower.includes("credit") || loanTypeLower.includes("card");
  if (isCreditCard) {
    return data.paymentFrequency === "monthly";
  }
  return true;
}, {
  message: "Credit cards must have monthly payment frequency",
  path: ["paymentFrequency"],
}).refine((data) => {
  const loanTypeLower = (data.loanType || "").toLowerCase();
  const isCreditCard = loanTypeLower.includes("credit") || loanTypeLower.includes("card");
  if (isCreditCard) {
    return data.firstPaymentDate !== null && data.firstPaymentDate !== undefined;
  }
  return data.firstPaymentDate !== null && data.firstPaymentDate !== undefined;
}, {
  message: "First Payment Date is required",
  path: ["firstPaymentDate"],
}).refine((data) => {
  const loanTypeLower = (data.loanType || "").toLowerCase();
  const isCreditCard = loanTypeLower.includes("credit") || loanTypeLower.includes("card");
  if (isCreditCard) {
    return true;
  }
  return data.startDate !== null && data.startDate !== undefined;
}, {
  message: "Start Date is required for this loan type",
  path: ["startDate"],
}).refine((data) => {
  const loanTypeLower = (data.loanType || "").toLowerCase();
  const isCreditCard = loanTypeLower.includes("credit") || loanTypeLower.includes("card");
  if (isCreditCard) {
    return true;
  }
  return (data.monthlyPayment ?? 0) > 0;
}, {
  message: "Monthly payment must be greater than 0 for this loan type",
  path: ["monthlyPayment"],
});

export type DebtFormData = z.infer<typeof debtSchema>;

