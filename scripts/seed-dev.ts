import "reflect-metadata";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { ulid } from "ulid";
import * as dotenv from "dotenv";

dotenv.config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "dealernode_helpdesk",
});

const ADMIN = {
  email: "admin@admin.com",
  password: "user1234",
  firstName: "System",
  lastName: "Admin",
  isSystemAdmin: true,
};

async function seed() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();

  try {
    console.log("Starting seed...\n");

    const adminId = await createUser(qr, ADMIN);
    console.log(`Admin user created: ${ADMIN.email} (${adminId})`);

    console.log("\nSeed completed!");
    console.log(`\nCredentials: ${ADMIN.email} / ${ADMIN.password}`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    qr.release();
    await AppDataSource.destroy();
  }
}

async function createUser(
  qr: ReturnType<typeof AppDataSource.createQueryRunner>,
  data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    isSystemAdmin?: boolean;
  },
): Promise<string> {
  const existing = await qr.query(`SELECT id FROM users WHERE email = $1`, [
    data.email,
  ]);
  if (existing.length > 0) return existing[0].id;

  const id = ulid();
  const hashedPassword = await bcrypt.hash(data.password, 10);
  await qr.query(
    `INSERT INTO users (id, email, password, "firstName", "lastName", "isActive", "isSystemAdmin", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())`,
    [
      id,
      data.email,
      hashedPassword,
      data.firstName,
      data.lastName,
      data.isSystemAdmin ?? false,
    ],
  );
  return id;
}

seed();
