import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    const lines = envFile.split("\n");
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }
      
      // Match KEY=VALUE or KEY="VALUE" or KEY='VALUE'
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only set if not already in process.env (system env takes precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error: any) {
    // .env.local might not exist, that's okay
    if (error.code !== "ENOENT") {
      console.warn("⚠️  Could not load .env.local file:", error.message);
    }
  }
}

// Load environment variables
loadEnvFile();

// Data structure from user
interface CategoryData {
  group: string;
  categories: Array<{
    category: string;
    subcategories: string[];
  }>;
}

interface ImportData {
  expense: CategoryData[];
  income: CategoryData[];
}

const categoriesData: ImportData = {
  expense: [
    {
      group: "Housing",
      categories: [
        {
          category: "Rent / Mortgage",
          subcategories: ["Rent", "Mortgage Payment", "Property Management Fees"],
        },
        {
          category: "Utilities",
          subcategories: ["Electricity", "Gas", "Water", "Internet", "Home Phone", "Garbage", "Recycling"],
        },
        {
          category: "Home Maintenance",
          subcategories: ["Repairs", "Cleaning Services", "Appliances", "Furniture"],
        },
        {
          category: "Home Insurance",
          subcategories: ["Home Insurance Premium", "Tenant Insurance"],
        },
      ],
    },
    {
      group: "Transportation",
      categories: [
        {
          category: "Vehicle",
          subcategories: [
            "Car Loan Payment",
            "Lease Payment",
            "Fuel",
            "Insurance",
            "Maintenance & Repairs",
            "Tires",
            "Registration",
            "Parking",
            "Car Wash",
            "EV Charging",
          ],
        },
        {
          category: "Public Transit",
          subcategories: ["Bus", "Train", "Subway", "Ride-Hailing", "Taxi"],
        },
      ],
    },
    {
      group: "Groceries & Food",
      categories: [
        {
          category: "Groceries",
          subcategories: ["Supermarket", "Produce Markets", "Bulk Stores"],
        },
        {
          category: "Restaurants",
          subcategories: ["Restaurants", "Cafes", "Fast Food", "Delivery Apps"],
        },
        {
          category: "Snacks & Drinks",
          subcategories: ["Coffee Shops", "Convenience Stores", "Alcohol"],
        },
      ],
    },
    {
      group: "Personal & Health",
      categories: [
        {
          category: "Healthcare",
          subcategories: [
            "Therapy",
            "Physiotherapy",
            "Dentist",
            "Prescription Medication",
            "OTC Medication",
            "Supplements",
            "Health Insurance",
          ],
        },
        {
          category: "Personal Care",
          subcategories: ["Haircut", "Barber", "Beauty", "Spa", "Skincare", "Cosmetics", "Hygiene Products"],
        },
        {
          category: "Fitness",
          subcategories: ["Gym", "Fitness Classes", "Sports Equipment"],
        },
      ],
    },
    {
      group: "Family & Kids",
      categories: [
        {
          category: "Baby Essentials",
          subcategories: ["Diapers", "Formula", "Baby Food", "Clothing", "Toys"],
        },
        {
          category: "Education",
          subcategories: ["School Supplies", "Courses", "Books", "Daycare"],
        },
        {
          category: "Activities",
          subcategories: ["Sports", "Music Classes", "Hobbies", "Extracurricular Activities"],
        },
      ],
    },
    {
      group: "Insurance",
      categories: [
        {
          category: "Insurance Payments",
          subcategories: ["Vehicle Insurance", "Life Insurance", "Health Insurance", "Travel Insurance"],
        },
      ],
    },
    {
      group: "Debts",
      categories: [
        {
          category: "Loans",
          subcategories: ["Personal Loan", "Student Loan", "Car Loan", "Business Loan"],
        },
        {
          category: "Credit Cards",
          subcategories: ["Credit Card Payment", "Interest Fees", "Annual Fees"],
        },
        {
          category: "Other Debts",
          subcategories: ["Line of Credit", "Overdraft Fees"],
        },
      ],
    },
    {
      group: "Shopping",
      categories: [
        {
          category: "Clothing",
          subcategories: ["Casual", "Work Apparel", "Shoes"],
        },
        {
          category: "Electronics",
          subcategories: ["Phones", "Laptops", "Tablets", "Accessories"],
        },
        {
          category: "Home & Lifestyle",
          subcategories: ["Decor", "Home Tools", "Kitchenware"],
        },
      ],
    },
    {
      group: "Entertainment & Leisure",
      categories: [
        {
          category: "Streaming",
          subcategories: ["Netflix", "Disney+", "Amazon Prime", "Other Streaming"],
        },
        {
          category: "Gaming",
          subcategories: ["Games", "Consoles", "Subscriptions"],
        },
        {
          category: "Events",
          subcategories: ["Movies", "Concerts", "Sports Events"],
        },
        {
          category: "Travel",
          subcategories: ["Flights", "Hotels", "Car Rentals", "Activities"],
        },
      ],
    },
    {
      group: "Education & Work",
      categories: [
        {
          category: "Courses & Certificates",
          subcategories: ["Online Courses", "University Programs", "Professional Certificates"],
        },
        {
          category: "Books",
          subcategories: ["eBooks", "Audiobooks", "Printed Books"],
        },
        {
          category: "Software & Tools",
          subcategories: ["Adobe", "SaaS Tools", "Professional Apps"],
        },
      ],
    },
    {
      group: "Pets",
      categories: [
        {
          category: "Pet Care",
          subcategories: ["Food", "Vet", "Medicines", "Grooming", "Toys"],
        },
      ],
    },
    {
      group: "Gifts & Donations",
      categories: [
        {
          category: "Gifts",
          subcategories: ["Family", "Friends", "Special Occasions"],
        },
        {
          category: "Donations",
          subcategories: ["Charity", "Religious Donations"],
        },
      ],
    },
    {
      group: "Business Expenses",
      categories: [
        {
          category: "Home Office",
          subcategories: ["Internet", "Electricity", "Office Supplies"],
        },
        {
          category: "Software",
          subcategories: ["Subscriptions", "Tools", "Licenses"],
        },
        {
          category: "Professional Services",
          subcategories: ["Accountant", "Lawyer", "Consulting"],
        },
        {
          category: "Marketing",
          subcategories: ["Ads", "Website Hosting", "Branding"],
        },
      ],
    },
  ],
  income: [
    {
      group: "Employment Income",
      categories: [
        {
          category: "Salary & Wages",
          subcategories: ["Full-Time Salary", "Part-Time Salary", "Hourly Wages"],
        },
        {
          category: "Extra Compensation",
          subcategories: ["Overtime", "Bonuses", "Commissions", "Tips"],
        },
      ],
    },
    {
      group: "Self-Employment Income",
      categories: [
        {
          category: "Business Income",
          subcategories: ["Freelance", "Consulting", "Service Income"],
        },
      ],
    },
    {
      group: "Investments",
      categories: [
        {
          category: "Investment Income",
          subcategories: ["Dividends", "Interest", "Capital Gains", "REIT Distributions"],
        },
        {
          category: "Rental Income",
          subcategories: ["Residential Rent", "Short-Term Rent", "Commercial Rent"],
        },
      ],
    },
    {
      group: "Government Benefits",
      categories: [
        {
          category: "Benefits",
          subcategories: ["Child Benefit", "Employment Insurance", "Disability Benefits", "GST/HST Credit", "Tax Refunds"],
        },
      ],
    },
    {
      group: "Side Income",
      categories: [
        {
          category: "Gig Work",
          subcategories: ["Uber", "DoorDash", "Task-based Jobs"],
        },
        {
          category: "Sales",
          subcategories: ["Marketplace", "Ecommerce", "Reselling"],
        },
        {
          category: "Content Creation",
          subcategories: ["YouTube", "Royalties", "Courses"],
        },
      ],
    },
    {
      group: "Family & Other",
      categories: [
        {
          category: "Family Support",
          subcategories: ["Gifts Received", "Allowance", "Child Support"],
        },
        {
          category: "Education",
          subcategories: ["Scholarships", "Grants"],
        },
        {
          category: "Reimbursements",
          subcategories: ["Work Reimbursements", "Other Refunds"],
        },
      ],
    },
  ],
};

async function main() {
  console.log("🚀 Starting category import...");

  // Verify required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Missing Supabase environment variables!");
    console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("   Please check your .env.local file");
    process.exit(1);
  }

  if (!supabaseServiceRoleKey) {
    console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Using anon key (may cause RLS issues).");
    console.warn("   For system categories, service role key is recommended.");
  }

  // Create Supabase client with service role key (or anon key as fallback)
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey || supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  const now = new Date().toISOString();

  // Track created groups to avoid duplicates
  const groupMap: Record<string, string> = {};

  // Process both expense and income
  const allData: Array<{ type: "expense" | "income"; data: CategoryData[] }> = [
    { type: "expense", data: categoriesData.expense },
    { type: "income", data: categoriesData.income },
  ];

  for (const { type, data } of allData) {
    console.log(`\n📦 Processing ${type} categories...`);

    for (const groupData of data) {
      const groupName = groupData.group;

      // Check if group already exists
      let groupId = groupMap[groupName];

      if (!groupId) {
        // Check if group exists in database
        const { data: existingGroup } = await supabase
          .from("Group")
          .select("id")
          .eq("name", groupName)
          .is("userId", null)
          .single();

        if (existingGroup) {
          groupId = existingGroup.id;
          console.log(`  ✓ Group "${groupName}" already exists`);
        } else {
          // Create new group
          const { data: newGroup, error: groupError } = await supabase
            .from("Group")
            .insert({
              name: groupName,
              userId: null, // System group
              createdAt: now,
              updatedAt: now,
            })
            .select()
            .single();

          if (groupError || !newGroup) {
            console.error(`  ✗ Failed to create group "${groupName}":`, groupError);
            continue;
          }

          groupId = newGroup.id;
          console.log(`  ✓ Created group "${groupName}"`);
        }

        groupMap[groupName] = groupId;
      }

      // Process categories for this group
      for (const categoryData of groupData.categories) {
        const categoryName = categoryData.category;

        // Check if category already exists
        const { data: existingCategory } = await supabase
          .from("Category")
          .select("id")
          .eq("name", categoryName)
          .eq("macroId", groupId)
          .is("userId", null)
          .single();

        let categoryId: string;

        if (existingCategory) {
          categoryId = existingCategory.id;
          console.log(`    ✓ Category "${categoryName}" already exists`);
        } else {
          // Create new category
          const { data: newCategory, error: categoryError } = await supabase
            .from("Category")
            .insert({
              name: categoryName,
              macroId: groupId,
              userId: null, // System category
              createdAt: now,
              updatedAt: now,
            })
            .select()
            .single();

          if (categoryError || !newCategory) {
            console.error(`    ✗ Failed to create category "${categoryName}":`, categoryError);
            continue;
          }

          categoryId = newCategory.id;
          console.log(`    ✓ Created category "${categoryName}"`);
        }

        // Process subcategories for this category
        for (const subcategoryName of categoryData.subcategories) {
          // Check if subcategory already exists
          const { data: existingSubcategory } = await supabase
            .from("Subcategory")
            .select("id")
            .eq("name", subcategoryName)
            .eq("categoryId", categoryId)
            .is("userId", null)
            .single();

          if (existingSubcategory) {
            console.log(`      ✓ Subcategory "${subcategoryName}" already exists`);
            continue;
          }

          // Create new subcategory
          const { error: subcategoryError } = await supabase
            .from("Subcategory")
            .insert({
              name: subcategoryName,
              categoryId: categoryId,
              userId: null, // System subcategory
              createdAt: now,
              updatedAt: now,
            });

          if (subcategoryError) {
            console.error(`      ✗ Failed to create subcategory "${subcategoryName}":`, subcategoryError);
            continue;
          }

          console.log(`      ✓ Created subcategory "${subcategoryName}"`);
        }
      }
    }
  }

  console.log("\n✅ Import completed!");
}

main()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  });

