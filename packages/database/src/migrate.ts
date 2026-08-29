import { dataSource, db } from "./index";

await db();
await dataSource.destroy();
console.log("Database migrations applied");
