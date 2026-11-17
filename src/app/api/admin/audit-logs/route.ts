import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { auditRepo } from "@/repositories/audit.repo";

const USERS_MAP: Record<string, string> = {
  "30000000-0000-0000-0000-000000000001": "Alex Chen (Employee)",
  "30000000-0000-0000-0000-000000000002": "Carol Manager",
  "30000000-0000-0000-0000-000000000003": "David Vance (Admin)",
  "30000000-0000-0000-0000-000000000004": "Bob Staff Engineer",
  "user-alice-emp": "Alex Chen (Employee)",
  "user-carol-mgr": "Carol Manager",
  "user-dave-adm": "David Vance (Admin)",
  "user-bob-emp": "Bob Staff Engineer",
};

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const offset = (page - 1) * limit;

    const { logs, total } = await auditRepo.listLogsWithCount({
      entityType: entityType !== "ALL" ? entityType : undefined,
      action: action !== "ALL" ? action : undefined,
      from,
      to,
      limit,
      offset,
    });

    const formattedLogs = logs.map((log: any) => {
      let parsedOld = log.oldValue;
      let parsedNew = log.newValue;

      if (typeof parsedOld === "string") {
        try {
          parsedOld = JSON.parse(parsedOld);
        } catch {}
      }
      if (typeof parsedNew === "string") {
        try {
          parsedNew = JSON.parse(parsedNew);
        } catch {}
      }

      return {
        ...log,
        adminUserName: log.adminUserId
          ? USERS_MAP[log.adminUserId] || log.adminUserId
          : "System Automated",
        oldValue: parsedOld,
        newValue: parsedNew,
      };
    });

    return NextResponse.json(
      {
        success: true,
        count: formattedLogs.length,
        total,
        page,
        limit,
        logs: formattedLogs,
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
