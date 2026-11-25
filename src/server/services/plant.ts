import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  PlantDetail,
  PlantListItem,
  PlantSummary,
  PlantUpdateInput,
} from "@/lib/schemas/plant";
import type { SessionUser } from "@/lib/schemas/session";
import type { Db } from "@/server/db";
import {
  diffFields,
  listChanges,
  recordChange,
} from "@/server/helpers/changeLog";
import { companyScope } from "@/server/helpers/scope";

const plantSummarySelect = {
  id: true,
  code: true,
  name: true,
  town: true,
  state: true,
  type: true,
  cementCapacityTpa: true,
} as const;

export type PlantFilters = {
  companyId?: string;
  search?: string;
  /** Only plants this user reports for. */
  userId?: string;
  /** Marks which plants this user reports for. */
  viewerId?: string;
};

export async function listPlants(
  db: Db,
  filters: PlantFilters,
): Promise<PlantListItem[]> {
  const search = filters.search?.trim();
  const filteredObj: Prisma.PlantWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { town: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  if (filters.companyId) filteredObj.companyId = filters.companyId;
  if (filters.userId) filteredObj.dataOwners = { some: { id: filters.userId } };

  const plants = await db.plant.findMany({
    where: filteredObj,
    orderBy: [{ code: "asc" }, { createdAt: "asc" }],
    select: {
      ...plantSummarySelect,
      dataOwners: { where: { id: filters.viewerId ?? "" }, select: { id: true } },
    },
  });
  return plants.map(({ dataOwners, ...plant }) => ({
    ...plant,
    ownedByMe: dataOwners.length > 0,
  }));
}

export async function getPlantDetail(
  db: Db,
  user: SessionUser,
  id: string,
): Promise<PlantDetail | null> {
  const plant = await db.plant.findFirst({
    where: companyScope(user, { id }),
    select: {
      ...plantSummarySelect,
      dataOwners: {
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!plant) {
    return null;
  }
  const recentChanges = await listChanges(db, user, {
    entityType: "plant",
    entityId: plant.id,
  });
  return { ...plant, recentChanges };
}

/** Updates a plant and records the change, in one transaction. Returns null when the plant is not found. */
export async function updatePlant(
  db: PrismaClient,
  user: SessionUser,
  input: PlantUpdateInput,
): Promise<PlantSummary | null> {
  const { id, ...fields } = input;
  return db.$transaction(async (tx) => {
    const plant = await tx.plant.findFirst({
      where: companyScope(user, { id }),
      select: plantSummarySelect,
    });
    if (!plant) {
      return null;
    }
    const changes = diffFields(plant, fields);
    if (Object.keys(changes).length === 0) {
      return plant;
    }
    const updated = await tx.plant.update({
      where: { id: plant.id },
      data: fields,
      select: plantSummarySelect,
    });
    await recordChange(tx, user, {
      entityType: "plant",
      entityId: plant.id,
      action: "update",
      changes,
    });
    return updated;
  });
}
