/// <reference types="@remix-run/node" />
/// <reference types="@remix-run/react" />

import type { PrismaClient } from "@prisma/client";

declare global {
  var __db: PrismaClient;
  
  interface Window {
    ENV: {
      NODE_ENV: "development" | "production" | "test";
      SQUARE_ENVIRONMENT?: "sandbox" | "production";
      SQUARE_LOCATION_ID?: string;
    };
  }
}

export {}; 