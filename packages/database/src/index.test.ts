import { getMetadataArgsStorage } from "typeorm";
import { describe, expect, it } from "vitest";
import { dataSource, entities } from "./index";

describe("database date handling", () => {
  it("opens every PostgreSQL connection with a UTC session timezone", () => {
    expect(dataSource.options.extra).toMatchObject({
      options: "-c timezone=UTC",
    });
  });

  it("defines every date column as timestamp with time zone", () => {
    const entityTargets = new Set<unknown>(entities);
    const dateColumns = getMetadataArgsStorage().columns.filter(({ target, propertyName }) =>
      entityTargets.has(target) && (propertyName.endsWith("At") || propertyName === "timestamp"));

    expect(dateColumns.length).toBeGreaterThan(0);
    expect(dateColumns.map(({ propertyName, options }) => ({
      propertyName,
      type: options.type,
    }))).toEqual(expect.arrayContaining(dateColumns.map(({ propertyName }) => ({
      propertyName,
      type: "timestamptz",
    }))));
  });
});
