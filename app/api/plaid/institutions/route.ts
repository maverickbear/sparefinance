import { NextRequest, NextResponse } from 'next/server';
import { searchInstitutions } from '@/lib/api/plaid/connect';
import { CountryCode, Products } from 'plaid';

/**
 * GET /api/plaid/institutions
 * 
 * List Plaid institutions for a specific country
 * 
 * Query parameters:
 * - country: 'US' or 'CA' (default: 'US')
 * - query: Search query (optional, empty string returns all)
 * - product: Filter by product (optional: 'transactions', 'investments', 'liabilities')
 * - count: Number of results (default: 500, max: 500)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const countryParam = searchParams.get('country') || 'US';
    const query = searchParams.get('query') || '';
    const productParam = searchParams.get('product');
    const countParam = searchParams.get('count');
    const offsetParam = searchParams.get('offset');

    // Map country string to CountryCode
    const countryCode = countryParam.toUpperCase() === 'CA' ? CountryCode.Ca : CountryCode.Us;

    // Map product string to Products enum
    let products: Products[] | undefined;
    if (productParam) {
      const productLower = productParam.toLowerCase();
      if (productLower === 'transactions') {
        products = [Products.Transactions];
      } else if (productLower === 'investments') {
        products = [Products.Investments];
      } else if (productLower === 'liabilities') {
        products = [Products.Liabilities];
      }
    }

    const count = countParam ? Math.min(parseInt(countParam, 10), 500) : 500;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const result = await searchInstitutions(query, countryCode, products, count, offset);

    return NextResponse.json({
      success: true,
      country: countryParam.toUpperCase(),
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching institutions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch institutions',
      },
      { status: 500 }
    );
  }
}

