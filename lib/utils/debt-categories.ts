"use server";

import { makeCategoriesService } from "@/src/application/categories/categories.factory";

export interface DebtCategoryMapping {
  categoryId: string;
  subcategoryId?: string;
}

/**
 * Get or create category/subcategory mapping for a debt loan type
 */
export async function getDebtCategoryMapping(loanType: string): Promise<DebtCategoryMapping | null> {
  const categoriesService = makeCategoriesService();
  const allCategories = await categoriesService.getAllCategories();

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
    const subcategories = await categoriesService.getSubcategoriesByCategory(categoryId);
    return subcategories.find((sub) => sub.name === name) || null;
  };

  // Helper function to create category if it doesn't exist
  const getOrCreateCategory = async (name: string) => {
    let category = findCategory(name);
    if (!category) {
      category = await categoriesService.createCategory({ name, type: "expense" });
    }
    return category;
  };

  // Helper function to create subcategory if it doesn't exist
  const getOrCreateSubcategory = async (name: string, categoryId: string) => {
    let subcategory = await findSubcategory(name, categoryId);
    if (!subcategory) {
      subcategory = await categoriesService.createSubcategory({ name, categoryId });
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
      const housingCategory = findCategory("Utilities") || findCategory("Housing") || await getOrCreateCategory("Housing");
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
      // Create "Personal Loan" category
      const personalLoanCategory = await getOrCreateCategory("Personal Loan");
      if (!personalLoanCategory) {
        return null;
      }
      return {
        categoryId: personalLoanCategory.id,
      };
    }

    case "credit_card": {
      // Create "Credit Card Payment" category
      const creditCardCategory = await getOrCreateCategory("Credit Card Payment");
      if (!creditCardCategory) {
        return null;
      }
      return {
        categoryId: creditCardCategory.id,
      };
    }

    case "student_loan": {
      // Create "Student Loan" category or subcategory under Education
      const educationCategory = findCategory("Education");
      if (educationCategory) {
        const studentLoanSub = await getOrCreateSubcategory("Student Loan", educationCategory.id);
        return {
          categoryId: educationCategory.id,
          subcategoryId: studentLoanSub?.id,
        };
      }
      // Fallback: create as category
      const studentLoanCategory = await getOrCreateCategory("Student Loan");
      if (!studentLoanCategory) {
        return null;
      }
      return {
        categoryId: studentLoanCategory.id,
      };
    }

    case "business_loan": {
      // Create "Business Loan" category
      const businessLoanCategory = await getOrCreateCategory("Business Loan");
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
      const miscCategoryCreated = await getOrCreateCategory("Misc");
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

