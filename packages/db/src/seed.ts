import { PrismaClient } from "@prisma/client";
import { hash } from "@neo-id/auth-core";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hash("admin123");
  const admin = await prisma.user.upsert({
    where: { email: "admin@neome.uk" },
    update: {},
    create: {
      email: "admin@neome.uk",
      username: "admin",
      passwordHash: adminPassword,
      displayName: "Admin",
      emailVerified: true,
      role: "admin",
    },
  });
  console.log("Admin user:", admin.email);

  // Create test developer user
  const devPassword = await hash("dev12345");
  const dev = await prisma.user.upsert({
    where: { email: "dev@neome.uk" },
    update: {},
    create: {
      email: "dev@neome.uk",
      username: "developer",
      passwordHash: devPassword,
      displayName: "Developer",
      emailVerified: true,
      role: "developer",
    },
  });
  console.log("Developer user:", dev.email);

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
