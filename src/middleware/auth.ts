import type { Context, Next } from "hono";
import type { Env } from "@/types/env";
import {
  parseCookies,
  validateFirebaseSessionCookie,
} from "@/auth/firebase-session";
import { getProjectVisibility, isProjectMember } from "@/services/visibility";

const SESSION_COOKIE_NAME = "__session";

export interface AuthContext {
  uid?: string;
  email?: string;
  isAuthenticated: boolean;
}

export async function privateProjectAuth(
  c: Context<{ Bindings: Env }>,
  next: Next,
) {
  const url = new URL(c.req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  const projectId = pathParts[0];

  if (!projectId) {
    return c.text("Invalid path", 400);
  }

  const project = await getProjectVisibility(projectId, c.env);

  if (!project) {
    return next();
  }

  if (project.visibility === "public") {
    return next();
  }

  const cookies = parseCookies(c.req.header("Cookie") ?? null);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];

  if (!sessionCookie) {
    console.info("[AUTH] No session cookie for private project:", projectId);
    return c.text("Unauthorized", 401);
  }

  const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;

  if (!firebaseProjectId) {
    console.error("[AUTH] FIREBASE_PROJECT_ID not configured");
    return c.text("Server configuration error", 500);
  }

  const validation = await validateFirebaseSessionCookie(
    sessionCookie,
    firebaseProjectId,
    c.env.CDN_CACHE,
  );

  if (!validation.valid || !validation.uid) {
    console.info("[AUTH] Invalid session cookie:", validation.error);
    return c.text("Unauthorized", 401);
  }

  if (!isProjectMember(project.memberIds, validation.uid)) {
    console.info("[AUTH] User not a member:", {
      uid: validation.uid,
      projectId,
    });
    return c.text("Forbidden", 403);
  }

  console.info("[AUTH] Access granted:", { uid: validation.uid, projectId });

  return next();
}
