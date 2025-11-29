import { NextRequest, NextResponse } from "next/server";
import { 
  getPaymentMethods, 
  createSetupIntent, 
  deletePaymentMethod, 
  setDefaultPaymentMethod 
} from "@/lib/api/stripe";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { paymentMethods, error } = await getPaymentMethods(authUser.id);

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error("Error getting payment methods:", error);
    return NextResponse.json(
      { error: "Failed to get payment methods" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { clientSecret, error } = await createSetupIntent(authUser.id);

    if (error || !clientSecret) {
      return NextResponse.json(
        { error: error || "Failed to create setup intent" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret });
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    const { success, error } = await deletePaymentMethod(
      authUser.id,
      paymentMethodId
    );

    if (!success) {
      return NextResponse.json(
        { error: error || "Failed to delete payment method" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return NextResponse.json(
      { error: "Failed to delete payment method" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    const { success, error } = await setDefaultPaymentMethod(
      authUser.id,
      paymentMethodId
    );

    if (!success) {
      return NextResponse.json(
        { error: error || "Failed to set default payment method" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return NextResponse.json(
      { error: "Failed to set default payment method" },
      { status: 500 }
    );
  }
}

