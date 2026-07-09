import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

const PEOPLE = [
  { name: "Shubham Chakraborty", role: "Admin" },
  { name: "Shivangi Jain", role: "Member" },
  { name: "Yashika Chandna", role: "Member" },
  { name: "Harpreet Singh Jauhal", role: "Member" },
  { name: "Jairaj Bhattacharya", role: "Member" },
  { name: "Somesh Thakur", role: "Member" },
  { name: "Viprav Chaudhary", role: "Member" },
  { name: "Saurabh Dayal", role: "Member" },
  { name: "Ishita Narang", role: "Member" },
  { name: "Harshali Dalal", role: "Member" },
  { name: "Rutuja Kotamkar", role: "Member" },
  { name: "Vrinda Goel", role: "Member" },
  { name: "Rahul", role: "Member" },
  { name: "Shikhar Gupta", role: "Member" },
  { name: "Utsav Thapliyal", role: "Member" },
];

const WORKSTREAMS = [
  "Business Operations",
  "Curriculum and Content",
  "Product Development",
  "Business Development",
  "Tech",
  "Project Management",
  "Market Research",
  "User Research",
  "Group Orientation",
  "Designing",
  "Content",
];

function emailFor(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${slug}@convegenius.ai`;
}

async function main() {
  for (const person of PEOPLE) {
    await prisma.person.upsert({
      where: { email: emailFor(person.name) },
      update: {},
      create: { name: person.name, email: emailFor(person.name), role: person.role },
    });
  }

  for (const name of WORKSTREAMS) {
    await prisma.workstream.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`Seeded ${PEOPLE.length} people and ${WORKSTREAMS.length} workstreams.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
