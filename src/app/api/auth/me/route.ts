import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, getRequestAuth } from "@/lib/http/api-handler";
import { isClerkConfigured, isDemoAuthEnabled } from "@/lib/mock/utils";

export const GET = withApiReliability(async (req: NextRequest) => {
  const user = await getRequestAuth(req);
  return NextResponse.json(
    {
      authenticated: Boolean(user),
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
            authProvider: user.authProvider,
          }
        : null,
      clerkEnabled: isClerkConfigured(),
      demoModeEnabled: isDemoAuthEnabled(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
      },
    }
  );
});
