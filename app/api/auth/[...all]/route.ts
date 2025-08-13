import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mount Better Auth at /api/auth/*
export const { GET, POST } = toNextJsHandler(auth.handler);