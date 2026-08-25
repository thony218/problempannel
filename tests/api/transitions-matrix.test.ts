import { describe, expect, it } from "vitest";
import { validateStatusTransition, type ApiIssueStatus, type Role } from "../../worker/domain/transitions";
import { AppError } from "../../worker/domain/errors";

describe("worker/domain/transitions (Matrice des 16 cellules)", () => {
  const statuses: ApiIssueStatus[] = ["new", "inProgress", "waiting", "resolved"];

  describe("Transitions réflexives (same -> same, 4 cellules N/A / no-op)", () => {
    it("allows no-op transition for any role", () => {
      const roles: Role[] = ["employee", "manager", "admin"];
      for (const status of statuses) {
        for (const role of roles) {
          expect(() =>
            validateStatusTransition({
              fromStatus: status,
              toStatus: status,
              actorRole: role,
              isOwner: false,
            })
          ).not.toThrow();
        }
      }
    });
  });

  describe("Transitions structurellement impossibles (422 INVALID_STATUS_TRANSITION)", () => {
    const invalidTransitions: [ApiIssueStatus, ApiIssueStatus][] = [
      ["inProgress", "new"],
      ["waiting", "new"],
      ["resolved", "new"],
      ["resolved", "waiting"],
    ];

    it("rejects invalid transitions with 422 for ALL roles (including manager/admin)", () => {
      const roles: Role[] = ["employee", "manager", "admin"];
      for (const [fromStatus, toStatus] of invalidTransitions) {
        for (const role of roles) {
          for (const isOwner of [true, false]) {
            try {
              validateStatusTransition({ fromStatus, toStatus, actorRole: role, isOwner });
              expect.fail(`Transition ${fromStatus} -> ${toStatus} should have thrown for role ${role}`);
            } catch (err: any) {
              expect(err).toBeInstanceOf(AppError);
              expect(err.code).toBe("INVALID_STATUS_TRANSITION");
              expect(err.status).toBe(422);
            }
          }
        }
      }
    });
  });

  describe("Transitions Manager/Admin seulement", () => {
    const managerOnlyTransitions: [ApiIssueStatus, ApiIssueStatus][] = [
      ["new", "inProgress"],
      ["new", "waiting"],
      ["new", "resolved"],
      ["inProgress", "resolved"],
      ["waiting", "resolved"],
      ["resolved", "inProgress"],
    ];

    it("allows manager and admin", () => {
      for (const [fromStatus, toStatus] of managerOnlyTransitions) {
        expect(() =>
          validateStatusTransition({ fromStatus, toStatus, actorRole: "manager", isOwner: false })
        ).not.toThrow();
        expect(() =>
          validateStatusTransition({ fromStatus, toStatus, actorRole: "admin", isOwner: false })
        ).not.toThrow();
      }
    });

    it("rejects employee (both owner and non-owner) with 403 FORBIDDEN", () => {
      for (const [fromStatus, toStatus] of managerOnlyTransitions) {
        for (const isOwner of [true, false]) {
          try {
            validateStatusTransition({ fromStatus, toStatus, actorRole: "employee", isOwner });
            expect.fail(`Transition ${fromStatus} -> ${toStatus} should have thrown FORBIDDEN for employee`);
          } catch (err: any) {
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("FORBIDDEN");
            expect(err.status).toBe(403);
          }
        }
      }
    });
  });

  describe("Transitions inProgress <-> waiting (S06, S07, S08)", () => {
    const waitingTransitions: [ApiIssueStatus, ApiIssueStatus][] = [
      ["inProgress", "waiting"],
      ["waiting", "inProgress"],
    ];

    it("allows manager and admin regardless of ownership", () => {
      for (const [fromStatus, toStatus] of waitingTransitions) {
        expect(() =>
          validateStatusTransition({ fromStatus, toStatus, actorRole: "manager", isOwner: false })
        ).not.toThrow();
        expect(() =>
          validateStatusTransition({ fromStatus, toStatus, actorRole: "admin", isOwner: false })
        ).not.toThrow();
      }
    });

    it("allows employee IF owner of the issue (S06, S07)", () => {
      for (const [fromStatus, toStatus] of waitingTransitions) {
        expect(() =>
          validateStatusTransition({ fromStatus, toStatus, actorRole: "employee", isOwner: true })
        ).not.toThrow();
      }
    });

    it("rejects employee with 403 FORBIDDEN if NOT owner of the issue (S08)", () => {
      for (const [fromStatus, toStatus] of waitingTransitions) {
        try {
          validateStatusTransition({ fromStatus, toStatus, actorRole: "employee", isOwner: false });
          expect.fail(`Transition ${fromStatus} -> ${toStatus} should have thrown FORBIDDEN for non-owner employee`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(AppError);
          expect(err.code).toBe("FORBIDDEN");
          expect(err.status).toBe(403);
        }
      }
    });
  });
});
