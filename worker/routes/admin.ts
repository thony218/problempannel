import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";
import {
  adminCreateReference,
  adminCreateSubcategory,
  adminCreateUser,
  adminListReferences,
  adminListUsers,
  adminRedactIssue,
  adminUpdateReference,
  adminUpdateSubcategory,
  adminUpdateUser,
} from "../services/admin";

const createUserSchema = z.object({
  email: z.string().email("Courriel invalide."),
  displayName: z.string().min(1, "Le nom d'affichage est requis."),
  role: z.enum(["employee", "manager", "admin"]),
  active: z.boolean().optional(),
  defaultLocationId: z.number().int().min(1).nullable().optional(),
  defaultDepartmentId: z.number().int().min(1).nullable().optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(["employee", "manager", "admin"]).optional(),
  active: z.boolean().optional(),
  defaultLocationId: z.number().int().min(1).nullable().optional(),
  defaultDepartmentId: z.number().int().min(1).nullable().optional(),
});

const createSimpleRefSchema = z.object({
  code: z.string().min(1, "Le code est requis."),
  label: z.string().min(1, "Le libellé est requis."),
  sortOrder: z.number().int().optional(),
});

const updateSimpleRefSchema = z.object({
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const createSubcategorySchema = z.object({
  categoryId: z.number().int().min(1, "La catégorie parente est requise."),
  code: z.string().min(1, "Le code est requis."),
  label: z.string().min(1, "Le libellé est requis."),
  sortOrder: z.number().int().optional(),
});

const updateSubcategorySchema = z.object({
  categoryId: z.number().int().min(1).optional(),
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const redactIssueSchema = z.object({
  issueTextFields: z.array(z.enum([
    "description",
    "causeSummary",
    "immediateSolution",
    "permanentCorrectionSummary",
    "finalResult",
    "preventionLearning"
  ])).optional(),
  commentIds: z.array(z.number().int().min(1)).optional(),
  attachmentIds: z.array(z.number().int().min(1)).optional(),
  reason: z.string().min(5, "Le motif de caviardage doit contenir au moins 5 caractères."),
});

export const adminRoutes = new Hono<AppEnv>();

// ----------------------------------------------------
// Utilisateurs
// ----------------------------------------------------

adminRoutes.get("/admin/users", requireUser, async (c) => {
  const user = c.get("user");
  const users = await adminListUsers(c.env.DB, user.role);
  return c.json(okBody(users));
});

adminRoutes.post("/admin/users", requireUser, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données utilisateur invalides.", fields);
  }

  const created = await adminCreateUser(c.env.DB, parsed.data, user.role);
  return c.json(okBody(created), 201);
});

adminRoutes.patch("/admin/users/:userId", requireUser, async (c) => {
  const user = c.get("user");
  const userId = Number(c.req.param("userId"));
  if (isNaN(userId) || userId < 1) {
    throw new AppError("NOT_FOUND", "Utilisateur introuvable.");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données utilisateur invalides.", fields);
  }

  const updated = await adminUpdateUser(c.env.DB, userId, parsed.data, user.role);
  if (!updated) {
    throw new AppError("NOT_FOUND", "Utilisateur introuvable.");
  }
  return c.json(okBody(updated));
});

// ----------------------------------------------------
// Caviardage
// ----------------------------------------------------

adminRoutes.post("/admin/issues/:publicId/redact", requireUser, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = redactIssueSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données de caviardage invalides.", fields);
  }

  const redacted = await adminRedactIssue(
    c.env.DB,
    c.env.ATTACHMENTS,
    c.req.param("publicId"),
    parsed.data,
    user.id,
    user.role
  );

  if (!redacted) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  return c.json(okBody(redacted));
});

// ----------------------------------------------------
// Référentiels
// ----------------------------------------------------

const setupSimpleRefRoutes = (path: "locations" | "departments" | "categories" | "impact-types", dbTable: "locations" | "departments" | "categories" | "impact_types") => {
  adminRoutes.get(`/admin/${path}`, requireUser, async (c) => {
    const user = c.get("user");
    const items = await adminListReferences(c.env.DB, dbTable, user.role);
    return c.json(okBody(items));
  });

  adminRoutes.post(`/admin/${path}`, requireUser, async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = createSimpleRefSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const pathField = issue.path.join(".");
        if (pathField) fields[pathField] = issue.message;
      }
      throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
    }

    const created = await adminCreateReference(c.env.DB, dbTable, parsed.data, user.role);
    return c.json(okBody(created), 201);
  });

  adminRoutes.patch(`/admin/${path}/:resourceId`, requireUser, async (c) => {
    const user = c.get("user");
    const id = Number(c.req.param("resourceId"));
    if (isNaN(id) || id < 1) throw new AppError("NOT_FOUND", "Élément introuvable.");

    const body = await c.req.json().catch(() => null);
    const parsed = updateSimpleRefSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const pathField = issue.path.join(".");
        if (pathField) fields[pathField] = issue.message;
      }
      throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
    }

    const updated = await adminUpdateReference(c.env.DB, dbTable, id, parsed.data, user.role);
    if (!updated) throw new AppError("NOT_FOUND", "Élément introuvable.");
    return c.json(okBody(updated));
  });
};

setupSimpleRefRoutes("locations", "locations");
setupSimpleRefRoutes("departments", "departments");
setupSimpleRefRoutes("categories", "categories");
setupSimpleRefRoutes("impact-types", "impact_types");

// Subcategories (avec categoryId)
adminRoutes.get("/admin/subcategories", requireUser, async (c) => {
  const user = c.get("user");
  const items = await adminListReferences(c.env.DB, "subcategories", user.role);
  return c.json(okBody(items));
});

adminRoutes.post("/admin/subcategories", requireUser, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createSubcategorySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const pathField = issue.path.join(".");
      if (pathField) fields[pathField] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const created = await adminCreateSubcategory(c.env.DB, parsed.data, user.role);
  return c.json(okBody(created), 201);
});

adminRoutes.patch("/admin/subcategories/:resourceId", requireUser, async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("resourceId"));
  if (isNaN(id) || id < 1) throw new AppError("NOT_FOUND", "Sous-catégorie introuvable.");

  const body = await c.req.json().catch(() => null);
  const parsed = updateSubcategorySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const pathField = issue.path.join(".");
      if (pathField) fields[pathField] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const updated = await adminUpdateSubcategory(c.env.DB, id, parsed.data, user.role);
  if (!updated) throw new AppError("NOT_FOUND", "Sous-catégorie introuvable.");
  return c.json(okBody(updated));
});
