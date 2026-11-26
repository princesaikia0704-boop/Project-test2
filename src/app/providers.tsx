"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/nextjs";

/**
 * Global application providers wrapper.
 * Mounts TanStack React Query Client Provider and conditional ClerkProvider when configured.
 */
export function Providers({
  children,
  clerkEnabled = false,
}: {
  children: React.ReactNode;
  clerkEnabled?: boolean;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const tree = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  if (!clerkEnabled) {
    return tree;
  }

  return <ClerkProvider>{tree}</ClerkProvider>;
}
