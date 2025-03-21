/// <reference types="@remix-run/node" />
/// <reference types="@remix-run/react" />

import type pkg from "@prisma/client";
type PrismaClient = pkg.PrismaClient;

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

export { }; 
