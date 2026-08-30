import { dataSource, db } from "./index";

await db();
await dataSource.runMigrations();
await dataSource.destroy();
console.log("Database migrations applied");
