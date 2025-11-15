"use server";

import { getAllCategories, getSubcategoriesByCategory, createCategory, createSubcategory, getMacros } from "@/lib/api/categories";

export interface DebtCategoryMapping {
  categoryId: string;
  subcategoryId?: string;
}

/**
 * Get or create category/subcategory mapping for a debt loan type
 */
export async function getDebtCategoryMapping(loanType: string): Promise<DebtCategoryMapping | null> {
  const allCategories = await getAllCategories();
  const macros = await getMacros();

  // Find macro IDs
  const macroMap = macros.reduce((acc, macro) => {
    acc[macro.name] = macro.id;
    return acc;
  }, {} as Record<string, string>);

  // Helper function to find category by name
  const findCategory = (name: string) => {
    return allCategories.find((cat) => cat.name === name);
  };

  // Helper function to find subcategory by name and category
  const findSubcategory = async (name: string, categoryId: string) => {
    const category = allCategories.find((cat) => cat.id === categoryId);
    if (category && category.subcategories) {
      const found = category.subcategories.find((sub: { id: string; name: string }) => sub.name === name);
      if (found) return found;
    }
    // If not found in loaded categories, try fetching directly
    const subcategories = await getSubcategoriesByCategory(categoryId);
    return subcategories.find((sub) => sub.name === name) || null;
  };

  // Helper function to create category if it doesn't exist
  const getOrCreateCategory = async (name: string, macroName: string) => {
    let category = findCategory(name);
    if (!category) {
      const macroId = macroMap[macroName];
      if (!macroId) {
        console.error(`Macro ${macroName} not found`);
        return null;
      }
      category = await createCategory({ name, macroId });
    }
    return category;
  };

  // Helper function to create subcategory if it doesn't exist
  const getOrCreateSubcategory = async (name: string, categoryId: string) => {
    let subcategory = await findSubcategory(name, categoryId);
    if (!subcategory) {
      subcategory = await createSubcategory({ name, categoryId });
    }
    return subcategory;
  };

  switch (loanType) {
    case "car_loan": {
      // Use existing "Car Loan" subcategory under "Vehicle" category, or create it if it doesn't exist
      const vehicleCategory = findCategory("Vehicle");
      if (!vehicleCategory) {
        console.error("Vehicle category not found");
        return null;
      }
      const carLoanSub = await getOrCreateSubcategory("Car Loan", vehicleCategory.id);
      if (!carLoanSub) {
        console.error("Failed to get or create Car Loan subcategory");
        return null;
      }
      return {
        categoryId: vehicleCategory.id,
        subcategoryId: carLoanSub.id,
      };
    }

    case "mortgage": {
      // Use "Rent" category or create "Mortgage Payment" subcategory
      const rentCategory = findCategory("Rent");
      if (rentCategory) {
        return {
          categoryId: rentCategory.id,
        };
      }
      // If Rent doesn't exist, try to create Mortgage Payment subcategory under Housing
      const housingMacro = macroMap["Housing"];
      if (!housingMacro) {
        console.error("Housing macro not found");
        return null;
      }
      const housingCategory = findCategory("Utilities") || await getOrCreateCategory("Housing", "Housing");
      if (!housingCategory) {
        return null;
      }
      const mortgageSub = await getOrCreateSubcategory("Mortgage Payment", housingCategory.id);
      return {
        categoryId: housingCategory.id,
        subcategoryId: mortgageSub?.id,
      };
    }

    case "personal_loan": {
      // Create "Personal Loan" category in Misc
      const miscMacro = macroMap["Misc"];
      if (!miscMacro) {
        console.error("Misc macro not found");
        return null;
      }
      const personalLoanCategory = await getOrCreateCategory("Personal Loan", "Misc");
      if (!personalLoanCategory) {
        return null;
      }
      return {
        categoryId: personalLoanCategory.id,
      };
    }

    case "credit_card": {
      // Create "Credit Card Payment" category in Misc
      const miscMacro = macroMap["Misc"];
      if (!miscMacro) {
        console.error("Misc macro not found");
        return null;
      }
      const creditCardCategory = await getOrCreateCategory("Credit Card Payment", "Misc");
      if (!creditCardCategory) {
        return null;
      }
      return {
        categoryId: creditCardCategory.id,
      };
    }

    case "student_loan": {
      // Create "Student Loan" category in Education or Misc
      const educationMacro = macroMap["Family"]; // Education is typically under Family
      const miscMacro = macroMap["Misc"];
      if (educationMacro) {
        const educationCategory = findCategory("Education");
        if (educationCategory) {
          const studentLoanSub = await getOrCreateSubcategory("Student Loan", educationCategory.id);
          return {
            categoryId: educationCategory.id,
            subcategoryId: studentLoanSub?.id,
          };
        }
      }
      // Fallback to Misc
      if (!miscMacro) {
        console.error("Misc macro not found");
        return null;
      }
      const studentLoanCategory = await getOrCreateCategory("Student Loan", "Misc");
      if (!studentLoanCategory) {
        return null;
      }
      return {
        categoryId: studentLoanCategory.id,
      };
    }

    case "business_loan": {
      // Create "Business Loan" category in Business
      const businessMacro = macroMap["Business"];
      if (!businessMacro) {
        console.error("Business macro not found");
        return null;
      }
      const businessLoanCategory = await getOrCreateCategory("Business Loan", "Business");
      if (!businessLoanCategory) {
        return null;
      }
      return {
        categoryId: businessLoanCategory.id,
      };
    }

    case "other": {
      // Use "Misc" category without subcategory
      const miscCategory = findCategory("Misc") || findCategory("Bank Fees");
      if (miscCategory) {
        return {
          categoryId: miscCategory.id,
        };
      }
      // If Misc doesn't exist, create it
      const miscMacro = macroMap["Misc"];
      if (!miscMacro) {
        console.error("Misc macro not found");
        return null;
      }
      const miscCategoryCreated = await getOrCreateCategory("Misc", "Misc");
      if (!miscCategoryCreated) {
        return null;
      }
      return {
        categoryId: miscCategoryCreated.id,
      };
    }

    default:
      console.error(`Unknown loan type: ${loanType}`);
      return null;
  }
}

