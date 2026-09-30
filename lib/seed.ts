// Seed data bawaan aplikasi Mandays Generator.
// Berisi 7 kategori dan 71 task hasil turunan dari referensi RACI Mandays Timeline DMS.
// Nilai baseline/level bersifat default yang wajar dan dapat diedit sepenuhnya oleh SA via UI (Req 9.1, 9.2, 9.3).

import type {
  AppConfig,
  Category,
  Question,
  StaffLevel,
  Task,
  TaskRole,
  TaskVariable,
} from "./types";

// ============================================================================
// Helper pembuat task
// ============================================================================

// Membuat task dengan SATU role (bentuk paling umum).
// Sejak versi 2, task terdiri dari daftar role; helper ini membungkus satu role
// agar ringkas untuk task-task single role.
function task(
  id: string,
  name: string,
  baselineMandays: number,
  level: StaffLevel,
  variable?: TaskVariable
): Task {
  return { id, name, roles: [{ level, baselineMandays, variable }] };
}

// Membuat task dengan BEBERAPA role sekaligus (fitur multi-role versi 2).
function multiRoleTask(id: string, name: string, roles: TaskRole[]): Task {
  return { id, name, roles };
}

// ============================================================================
// Pertanyaan kuisioner (Req 3, 4)
// ============================================================================

// Pertanyaan numeric untuk jumlah subnet -> memengaruhi mandays task "Configure VPC".
const qSubnetCount: Question = {
  id: "q-subnet-count",
  categoryId: "cat-infra-setup",
  text: "Berapa jumlah subnet?",
  type: "numeric",
  helpText: "Jumlah subnet yang perlu dikonfigurasi pada VPC.",
};

// Pertanyaan single_choice untuk kebutuhan sesi konsultasi desain -> memicu levelShift ke Sr. Engineer.
const qNeedConsult: Question = {
  id: "q-need-consult",
  categoryId: "cat-infra-setup",
  text: "Perlu sesi konsultasi desain?",
  type: "single_choice",
  options: [
    { value: "ya", label: "Ya" },
    { value: "tidak", label: "Tidak" },
  ],
  helpText: "Jika ya, task konsultasi ditangani oleh Sr. Engineer.",
};

// ============================================================================
// Variabel & tier contoh (demonstrasi mekanisme tiering + levelShift)
// ============================================================================

// Variabel untuk task "Configure VPC": mandays naik seiring jumlah subnet.
const vpcSubnetVariable: TaskVariable = {
  questionId: "q-subnet-count",
  defaultTierId: "vpc-subnet-1-2",
  tiers: [
    { id: "vpc-subnet-1-2", label: "1-2 subnet", min: 1, max: 2, mandays: 0.5 },
    { id: "vpc-subnet-3-5", label: "3-5 subnet", min: 3, max: 5, mandays: 0.8 },
    { id: "vpc-subnet-gt5", label: ">5 subnet", min: 6, max: null, mandays: 1.2 },
  ],
};

// Variabel untuk task "Design Consultation Session": opsi "Ya" menggeser level ke Sr. Engineer.
const consultVariable: TaskVariable = {
  questionId: "q-need-consult",
  defaultTierId: "consult-tidak",
  tiers: [
    {
      id: "consult-ya",
      label: "Ya",
      min: null,
      max: null,
      matchOptions: ["ya"],
      mandays: 1,
      levelShift: "SR_ENGINEER",
    },
    {
      id: "consult-tidak",
      label: "Tidak",
      min: null,
      max: null,
      matchOptions: ["tidak"],
      mandays: 0,
    },
  ],
};

// ============================================================================
// Kategori & task
// ============================================================================

// 1. Design and Requirement Assessment (6 task)
const catDesign: Category = {
  id: "cat-design",
  name: "Design and Requirement Assessment",
  tasks: [
    task("t-design-1", "Requirement Gathering Discussion", 1, "GENERAL_SA"),
    task("t-design-2", "Requirement Assessment", 1, "GENERAL_SA"),
    task("t-design-3", "Solution Design Proposal", 1.5, "GENERAL_SA"),
    task("t-design-4", "Architecture Design Review", 1, "SR_SA"),
    task("t-design-5", "Migration Strategy Design", 1, "GENERAL_SA"),
    task("t-design-6", "Design Sign-off Meeting", 0.5, "GENERAL_PMO"),
    // Contoh task MULTI-ROLE: satu diskusi melibatkan SA dan PMO sekaligus,
    // masing-masing dengan baseline mandays sendiri (demonstrasi fitur versi 2).
    multiRoleTask("t-design-7", "Project Kickoff Discussion", [
      { level: "GENERAL_SA", baselineMandays: 0.5 },
      { level: "GENERAL_PMO", baselineMandays: 0.5 },
    ]),
  ],
};

// 2. AWS Account Creation (5 task)
const catAccount: Category = {
  id: "cat-account",
  name: "AWS Account Creation",
  tasks: [
    task("t-account-1", "Create AWS Account", 0.5, "GENERAL_ENGINEER"),
    task("t-account-2", "Setup Organization Structure", 0.5, "GENERAL_ENGINEER"),
    task("t-account-3", "Configure Billing and Budget", 0.25, "GENERAL_ENGINEER"),
    task("t-account-4", "Create IAM Roles and Policies", 1, "GENERAL_ENGINEER"),
    task("t-account-5", "Setup SSO Access", 0.5, "GENERAL_ENGINEER"),
  ],
};

// 3. Infrastructure Setup (26 task) — memuat contoh variabel & tier.
const catInfraSetup: Category = {
  id: "cat-infra-setup",
  name: "Infrastructure Setup",
  tasks: [
    // Task "Configure VPC" dengan variabel jumlah subnet.
    task("t-infra-1", "Configure VPC", 0.5, "GENERAL_ENGINEER", vpcSubnetVariable),
    // Task konsultasi desain dengan levelShift ke Sr. Engineer bila dibutuhkan.
    task("t-infra-2", "Design Consultation Session", 0, "GENERAL_ENGINEER", consultVariable),
    task("t-infra-3", "Setup Subnets", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-4", "Configure Route Tables", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-5", "Configure Internet Gateway", 0.25, "GENERAL_ENGINEER"),
    task("t-infra-6", "Configure NAT Gateway", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-7", "Configure Security Groups", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-8", "Configure Network ACLs", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-9", "Setup VPN Connection", 1, "GENERAL_ENGINEER"),
    task("t-infra-10", "Setup Direct Connect", 1, "GENERAL_ENGINEER"),
    task("t-infra-11", "Provision RDS Instance", 1, "GENERAL_ENGINEER"),
    task("t-infra-12", "Provision EC2 Instances", 1, "GENERAL_ENGINEER"),
    task("t-infra-13", "Setup DMS Replication Instance", 1, "GENERAL_ENGINEER"),
    task("t-infra-14", "Configure DMS Source Endpoint", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-15", "Configure DMS Target Endpoint", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-16", "Setup S3 Buckets", 0.25, "GENERAL_ENGINEER"),
    task("t-infra-17", "Configure S3 Bucket Policies", 0.25, "GENERAL_ENGINEER"),
    task("t-infra-18", "Setup CloudWatch Monitoring", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-19", "Configure CloudTrail Logging", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-20", "Setup Load Balancer", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-21", "Configure Auto Scaling Group", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-22", "Setup Route 53 DNS", 0.25, "GENERAL_ENGINEER"),
    task("t-infra-23", "Configure KMS Encryption Keys", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-24", "Setup Secrets Manager", 0.25, "GENERAL_ENGINEER"),
    task("t-infra-25", "Configure Backup and Snapshot", 0.5, "GENERAL_ENGINEER"),
    task("t-infra-26", "Setup Disaster Recovery Environment", 1, "GENERAL_ENGINEER"),
  ],
};

// 4. Infrastructure Validation (19 task)
const catInfraValidation: Category = {
  id: "cat-infra-validation",
  name: "Infrastructure Validation",
  tasks: [
    task("t-val-1", "Validate VPC Configuration", 0.5, "GENERAL_ENGINEER"),
    task("t-val-2", "Validate Subnet Connectivity", 0.5, "GENERAL_ENGINEER"),
    task("t-val-3", "Validate Security Group Rules", 0.5, "SR_ENGINEER"),
    task("t-val-4", "Validate Network ACL Rules", 0.5, "GENERAL_ENGINEER"),
    task("t-val-5", "Validate VPN Connectivity", 0.5, "GENERAL_ENGINEER"),
    task("t-val-6", "Validate Direct Connect", 0.5, "GENERAL_ENGINEER"),
    task("t-val-7", "Validate RDS Connectivity", 0.5, "GENERAL_ENGINEER"),
    task("t-val-8", "Validate EC2 Health", 0.25, "GENERAL_ENGINEER"),
    task("t-val-9", "Validate DMS Endpoint Connection", 0.5, "GENERAL_ENGINEER"),
    task("t-val-10", "Validate DMS Replication Task", 0.5, "SR_ENGINEER"),
    task("t-val-11", "Validate S3 Access", 0.25, "GENERAL_ENGINEER"),
    task("t-val-12", "Validate CloudWatch Alarms", 0.25, "GENERAL_ENGINEER"),
    task("t-val-13", "Validate CloudTrail Logs", 0.25, "GENERAL_ENGINEER"),
    task("t-val-14", "Validate Load Balancer Health", 0.25, "GENERAL_ENGINEER"),
    task("t-val-15", "Validate Auto Scaling Behavior", 0.5, "GENERAL_ENGINEER"),
    task("t-val-16", "Validate DNS Resolution", 0.25, "GENERAL_ENGINEER"),
    task("t-val-17", "Validate Encryption at Rest", 0.5, "SR_ENGINEER"),
    task("t-val-18", "Validate Backup Restore", 0.5, "GENERAL_ENGINEER"),
    task("t-val-19", "Security Configuration Review", 1, "SR_ENGINEER"),
  ],
};

// 5. Migration (8 task)
const catMigration: Category = {
  id: "cat-migration",
  name: "Migration",
  tasks: [
    task("t-mig-1", "Setup DMS Full Load Task", 1, "GENERAL_ENGINEER"),
    task("t-mig-2", "Run Initial Data Load", 1, "GENERAL_ENGINEER"),
    task("t-mig-3", "Setup CDC Replication", 1, "GENERAL_ENGINEER"),
    task("t-mig-4", "Validate Data Consistency", 1, "SR_ENGINEER"),
    task("t-mig-5", "Migrate Application Configuration", 0.5, "GENERAL_ENGINEER"),
    task("t-mig-6", "Perform Cutover Rehearsal", 1, "GENERAL_ENGINEER"),
    task("t-mig-7", "Execute Production Cutover", 1.5, "SR_ENGINEER"),
    task("t-mig-8", "Post-Migration Verification", 1, "GENERAL_ENGINEER"),
  ],
};

// 6. UAT (4 task)
const catUat: Category = {
  id: "cat-uat",
  name: "UAT",
  tasks: [
    task("t-uat-1", "Prepare UAT Test Cases", 1, "GENERAL_SA"),
    task("t-uat-2", "Run UAT Scenario", 1.5, "GENERAL_ENGINEER"),
    task("t-uat-3", "UAT Defect Fixing", 1, "GENERAL_ENGINEER"),
    task("t-uat-4", "UAT Sign-off Meeting", 0.5, "GENERAL_PMO"),
  ],
};

// 7. Documentation and Closing (3 task)
const catDocumentation: Category = {
  id: "cat-doc",
  name: "Documentation and Closing",
  tasks: [
    task("t-doc-1", "Prepare As-Built Documentation", 1, "GENERAL_PMO"),
    task("t-doc-2", "Knowledge Transfer Session", 1, "GENERAL_PMO"),
    task("t-doc-3", "Project Closing Report", 0.5, "GENERAL_PMO"),
  ],
};

// ============================================================================
// Konfigurasi seed lengkap
// ============================================================================

// Konfigurasi seed bawaan yang dipakai saat localStorage kosong (Req 9.3).
export const seedConfig: AppConfig = {
  version: 2,
  categories: [
    catDesign,
    catAccount,
    catInfraSetup,
    catInfraValidation,
    catMigration,
    catUat,
    catDocumentation,
  ],
  questions: [qSubnetCount, qNeedConsult],
  // Rate dibiarkan kosong sebagai default; SA dapat mengisi via UI (Req 6).
  rates: {},
};

// Mengembalikan salinan (deep copy) seed agar aman dimodifikasi tanpa mengubah konstanta asli.
export function createSeedConfig(): AppConfig {
  return JSON.parse(JSON.stringify(seedConfig)) as AppConfig;
}
