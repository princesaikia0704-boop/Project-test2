import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { auditRepo } from "@/repositories/audit.repo";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") || undefined;

    const logs = await auditRepo.listLogs({ entityType });

    return NextResponse.json(
      {
        success: true,
        count: logs.length,
        logs,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

function methodNotAllowedResponse(): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: "MethodNotAllowed",
      message: "Audit logs are strictly immutable and append-only",
      statusCode: 405,
    }),
    {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: "GET",
      },
    }
  );
}

export async function PUT(): Promise<NextResponse> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowedResponse();
}

export async function POST(): Promise<NextResponse> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<NextResponse> {
  return methodNotAllowedResponse();
}
