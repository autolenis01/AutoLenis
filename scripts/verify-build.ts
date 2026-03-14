#!/usr/bin/env node

/**
 * Build Verification - Ensures all TypeScript files compile without errors
 * This file verifies the fix for the Prisma transaction typing issue
 */

import { execSync } from "child_process";

console.log("🔍 Verifying build configuration...\n");

try {
  console.log("1. Checking TypeScript compilation...");
  execSync("pnpm tsc --noEmit", { stdio: "inherit" });
  console.log("✅ TypeScript compilation successful\n");

  console.log("2. Checking Next.js build...");
  execSync("pnpm build", { stdio: "inherit" });
  console.log("✅ Next.js build successful\n");

  console.log("3. Verifying Prisma client...");
  execSync("pnpm prisma generate", { stdio: "inherit" });
  console.log("✅ Prisma client generated successfully\n");

  console.log("✅ All build checks passed. Ready for deployment.");
  process.exit(0);
} catch (error) {
  console.error("❌ Build verification failed:", error);
  process.exit(1);
}
