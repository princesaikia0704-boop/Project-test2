/**
 * Realistic seed data for the Corporate Office Store in-memory resilience store.
 */

export interface DepartmentSeed {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSeed {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  passwordHash?: string | null;
  sessionVersion?: number;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentBudgetSeed {
  id: string;
  departmentId: string;
  totalCents: number;
  remainingCents: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSeed {
  id: string;
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  stockQuantity: number;
  lowStockThreshold: number;
  categoryId: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreSettingsSeed {
  id: number;
  autoApproveLimitCents: number;
  companyName: string;
  primaryColor: string;
  logoUrl: string | null;
  currency: string;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// SEED INSTANCES
// -----------------------------------------------------------------------------

const NOW = new Date();
const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const SIXTY_DAYS_AHEAD = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

export const SEED_DEPARTMENTS: DepartmentSeed[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Engineering",
    code: "ENG",
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Sales",
    code: "SALES",
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Marketing",
    code: "MKT",
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    name: "Human Resources",
    code: "HR",
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
];

export const SEED_BUDGETS: DepartmentBudgetSeed[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
    totalCents: 1000000, // $10,000.00
    remainingCents: 745000, // $7,450.00
    periodStart: THIRTY_DAYS_AGO,
    periodEnd: SIXTY_DAYS_AHEAD,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    departmentId: "10000000-0000-0000-0000-000000000002", // Sales
    totalCents: 800000, // $8,000.00
    remainingCents: 420000, // $4,200.00
    periodStart: THIRTY_DAYS_AGO,
    periodEnd: SIXTY_DAYS_AHEAD,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    departmentId: "10000000-0000-0000-0000-000000000003", // Marketing
    totalCents: 600000, // $6,000.00
    remainingCents: 180000, // $1,800.00
    periodStart: THIRTY_DAYS_AGO,
    periodEnd: SIXTY_DAYS_AHEAD,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: NOW,
  },
  {
    id: "20000000-0000-0000-0000-000000000004",
    departmentId: "10000000-0000-0000-0000-000000000004", // HR
    totalCents: 400000, // $4,000.00
    remainingCents: 315000, // $3,150.00
    periodStart: THIRTY_DAYS_AGO,
    periodEnd: SIXTY_DAYS_AHEAD,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: NOW,
  },
];

export const SEED_USERS: UserSeed[] = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    clerkId: "user_mock_employee_001",
    email: "alex.chen@company.com",
    name: "Alex Chen",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    clerkId: "user_mock_manager_001",
    email: "sarah.jenkins@company.com",
    name: "Sarah Jenkins",
    role: "MANAGER",
    departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    clerkId: "user_mock_admin_001",
    email: "david.vance@company.com",
    name: "David Vance",
    role: "ADMIN",
    departmentId: "10000000-0000-0000-0000-000000000005", // Operations
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "30000000-0000-0000-0000-000000000004",
    clerkId: "user_mock_employee_002",
    email: "bob.engineer@company.com",
    name: "Bob Staff Engineer",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
];

export const SEED_CATEGORIES: CategorySeed[] = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    name: "Office Furniture",
    slug: "office-furniture",
    parentId: null,
    isActive: true,
    sortOrder: 1,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "40000000-0000-0000-0000-000000000002",
    name: "Ergonomic Seating",
    slug: "ergonomic-seating",
    parentId: "40000000-0000-0000-0000-000000000001", // Child of Office Furniture
    isActive: true,
    sortOrder: 2,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "40000000-0000-0000-0000-000000000003",
    name: "Desktop Peripherals",
    slug: "desktop-peripherals",
    parentId: null,
    isActive: true,
    sortOrder: 3,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "40000000-0000-0000-0000-000000000004",
    name: "Stationery & Notebooks",
    slug: "stationery-notebooks",
    parentId: null,
    isActive: true,
    sortOrder: 4,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "40000000-0000-0000-0000-000000000005",
    name: "Cables & Connectivity",
    slug: "cables-connectivity",
    parentId: null,
    isActive: true,
    sortOrder: 5,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "40000000-0000-0000-0000-000000000006",
    name: "Breakroom & Pantry",
    slug: "breakroom-pantry",
    parentId: null,
    isActive: true,
    sortOrder: 6,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
];

export const SEED_PRODUCTS: ProductSeed[] = [
  {
    id: "50000000-0000-0000-0000-000000000001",
    name: "Ergonomic Mesh Task Chair",
    description: "Breathable high-back mesh task chair with dynamic lumbar support and 3D adjustable armrests.",
    sku: "SEAT-CHAIR-001",
    priceCents: 34999, // $349.99
    stockQuantity: 15,
    lowStockThreshold: 5,
    categoryId: "40000000-0000-0000-0000-000000000002",
    imageUrl: "https://images.unsplash.com/photo-1580481077195-c3a8b273b5f9?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    name: "Lumbar Support Memory Foam Cushion",
    description: "High-density orthopedic memory foam cushion tailored for all-day office seating.",
    sku: "SEAT-CUSH-002",
    priceCents: 3999, // $39.99
    stockQuantity: 42,
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000002",
    imageUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000003",
    name: "Height-Adjustable Standing Desk Converter",
    description: "Gas spring dual-tier desktop riser holding two 24-inch monitors with keyboard tray.",
    sku: "SEAT-DESK-003",
    priceCents: 18950, // $189.50
    stockQuantity: 8,
    lowStockThreshold: 3,
    categoryId: "40000000-0000-0000-0000-000000000002",
    imageUrl: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000004",
    name: "Active Sitting Balance Stool",
    description: "Wobble balance stool that promotes active core posture for standing desks.",
    sku: "SEAT-STOOL-004",
    priceCents: 11900, // $119.00
    stockQuantity: 4, // LOW STOCK (Stock 4 < Threshold 5)
    lowStockThreshold: 5,
    categoryId: "40000000-0000-0000-0000-000000000002",
    imageUrl: "https://images.unsplash.com/photo-1503602642458-232111445657?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000005",
    name: "Wireless Ergonomic Split Keyboard",
    description: "Cushioned palm rest split keyframe keyboard with Bluetooth and 2.4GHz dongle.",
    sku: "PERIPH-KEY-001",
    priceCents: 12999, // $129.99
    stockQuantity: 25,
    lowStockThreshold: 8,
    categoryId: "40000000-0000-0000-0000-000000000003",
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000006",
    name: "Multi-Device Precision Wireless Mouse",
    description: "Ergonomic 4000 DPI sensor mouse with ultra-fast MagSpeed scrolling wheel.",
    sku: "PERIPH-MOU-002",
    priceCents: 6999, // $69.99
    stockQuantity: 30,
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000003",
    imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000007",
    name: "Dual Monitor Aluminum Arm Desk Mount",
    description: "Gas spring dual monitor arm supporting screens up to 32 inches and 19.8 lbs each.",
    sku: "PERIPH-ARM-003",
    priceCents: 8900, // $89.00
    stockQuantity: 18,
    lowStockThreshold: 5,
    categoryId: "40000000-0000-0000-0000-000000000003",
    imageUrl: "https://images.unsplash.com/photo-1547394765-185e13174149?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000008",
    name: "USB-C 4K Triple Display Docking Station",
    description: "100W Power Delivery pass-through dock with 2x HDMI, 1x DP, Gigabit Ethernet, and 4x USB 3.0.",
    sku: "PERIPH-DOCK-004",
    priceCents: 17999, // $179.99
    stockQuantity: 12,
    lowStockThreshold: 5,
    categoryId: "40000000-0000-0000-0000-000000000003",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000009",
    name: "Noise-Canceling USB-C Wired Headset",
    description: "Stereo on-ear headset with AI-enhanced microphone beamforming for video calls.",
    sku: "PERIPH-HEAD-005",
    priceCents: 5950, // $59.50
    stockQuantity: 35,
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000003",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000010",
    name: "Premium Hardcover Dot Grid Journal (A5)",
    description: "160gsm bleed-proof bamboo paper hardcover journal with ribbon bookmark and back pocket.",
    sku: "STAT-JOUR-001",
    priceCents: 1850, // $18.50
    stockQuantity: 65,
    lowStockThreshold: 15,
    categoryId: "40000000-0000-0000-0000-000000000004",
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000011",
    name: "Retractable Gel Ink Pens (Pack of 12)",
    description: "Smooth-flowing quick-dry 0.7mm black gel ink pens with rubberized non-slip grip.",
    sku: "STAT-PENS-002",
    priceCents: 1499, // $14.99
    stockQuantity: 80,
    lowStockThreshold: 20,
    categoryId: "40000000-0000-0000-0000-000000000004",
    imageUrl: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000012",
    name: "Sticky Notes Value Pack (12 Pads, Pastel)",
    description: "Self-adhesive 3x3-inch note pads in assorted calming pastel tones, 100 sheets per pad.",
    sku: "STAT-NOTE-003",
    priceCents: 1125, // $11.25
    stockQuantity: 120,
    lowStockThreshold: 25,
    categoryId: "40000000-0000-0000-0000-000000000004",
    imageUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000013",
    name: "Heavy-Duty Desktop Stapler + 5,000 Staples",
    description: "Solid metal mechanism desktop stapler with 30-sheet capacity and staple remover.",
    sku: "STAT-STAP-004",
    priceCents: 2200, // $22.00
    stockQuantity: 22,
    lowStockThreshold: 8,
    categoryId: "40000000-0000-0000-0000-000000000004",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000014",
    name: "Braided Thunderbolt 4 / USB4 Cable (2m)",
    description: "40Gbps certified cable supporting 240W Power Delivery and dual 4K display output.",
    sku: "CABL-TB4-001",
    priceCents: 2999, // $29.99
    stockQuantity: 40,
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000005",
    imageUrl: "https://images.unsplash.com/photo-1588508065123-287b28e013da?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000015",
    name: "Braided HDMI 2.1 Ultra High Speed Cable (3m)",
    description: "48Gbps nylon-braided cable supporting 8K@60Hz and 4K@120Hz eARC HDR audio/video.",
    sku: "CABL-HDMI-002",
    priceCents: 1999, // $19.99
    stockQuantity: 50,
    lowStockThreshold: 12,
    categoryId: "40000000-0000-0000-0000-000000000005",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000016",
    name: "100W GaN 4-Port Fast Desktop Charger",
    description: "Compact gallium nitride fast charger with 3x USB-C and 1x USB-A ports.",
    sku: "CABL-GAN-003",
    priceCents: 4999, // $49.99
    stockQuantity: 28,
    lowStockThreshold: 8,
    categoryId: "40000000-0000-0000-0000-000000000005",
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000017",
    name: "Heavy Duty Surge Protector (8 Outlets, 4 USB)",
    description: "4320-joule surge protection power strip with 6-foot heavy gauge extension cord.",
    sku: "CABL-SURG-004",
    priceCents: 3250, // $32.50
    stockQuantity: 2, // CRITICAL LOW STOCK (Stock 2 < Threshold 5)
    lowStockThreshold: 5,
    categoryId: "40000000-0000-0000-0000-000000000005",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000018",
    name: "Fair Trade Organic Whole Bean Coffee (2 lb)",
    description: "Medium roast 100% Arabica coffee beans roasted locally for rich notes of cocoa and toasted almond.",
    sku: "PANT-COFF-001",
    priceCents: 2499, // $24.99
    stockQuantity: 50,
    lowStockThreshold: 15,
    categoryId: "40000000-0000-0000-0000-000000000006",
    imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000019",
    name: "Herbal & Green Tea Assortment Box (100 Bags)",
    description: "Individually wrapped organic tea bags including Chamomile, Earl Grey, Peppermint, and Jasmine Green.",
    sku: "PANT-TEA-002",
    priceCents: 1875, // $18.75
    stockQuantity: 30,
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000006",
    imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
  {
    id: "50000000-0000-0000-0000-000000000020",
    name: "Eco-Friendly Compostable Hot Cups (Pack of 100)",
    description: "12oz plant-based PLA-lined insulated hot paper cups with biodegradable lids.",
    sku: "PANT-CUPS-003",
    priceCents: 1650, // $16.50
    stockQuantity: 0, // OUT OF STOCK (Boundary case)
    lowStockThreshold: 10,
    categoryId: "40000000-0000-0000-0000-000000000006",
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
    isActive: true,
    createdAt: THIRTY_DAYS_AGO,
    updatedAt: THIRTY_DAYS_AGO,
  },
];

export const SEED_STORE_SETTINGS: StoreSettingsSeed = {
  id: 1,
  autoApproveLimitCents: 10000, // ₹100.00
  companyName: "Office Store",
  primaryColor: "#0F172A",
  logoUrl: "/logo.svg",
  currency: "INR",
  updatedAt: NOW,
};

export interface AuditLogSeed {
  id: string;
  adminUserId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "STOCK_ADJUST" | "CONFIG_UPDATE";
  entityType: "PRODUCT" | "CATEGORY" | "ORDER" | "STORE_SETTINGS" | "DEPARTMENT_BUDGET" | "USER" | "DEPARTMENT";
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export const SEED_AUDIT_LOGS: AuditLogSeed[] = [
  {
    id: "60000000-0000-0000-0000-000000000001",
    adminUserId: "30000000-0000-0000-0000-000000000003", // David Vance (Admin)
    action: "CONFIG_UPDATE",
    entityType: "STORE_SETTINGS",
    entityId: "1",
    oldValue: JSON.stringify({ autoApproveLimitCents: 5000, companyName: "Office Depot" }),
    newValue: JSON.stringify({ autoApproveLimitCents: 10000, companyName: "Office Store" }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "60000000-0000-0000-0000-000000000002",
    adminUserId: "30000000-0000-0000-0000-000000000003", // David Vance (Admin)
    action: "CONFIG_UPDATE",
    entityType: "DEPARTMENT_BUDGET",
    entityId: "20000000-0000-0000-0000-000000000001", // Engineering Budget
    oldValue: JSON.stringify({ totalCents: 800000, remainingCents: 600000 }),
    newValue: JSON.stringify({ totalCents: 1000000, remainingCents: 745000 }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: "60000000-0000-0000-0000-000000000003",
    adminUserId: "30000000-0000-0000-0000-000000000003", // David Vance (Admin)
    action: "STOCK_ADJUST",
    entityType: "PRODUCT",
    entityId: "50000000-0000-0000-0000-000000000001", // Retractable Gel Ink Pens
    oldValue: JSON.stringify({ stockQuantity: 100 }),
    newValue: JSON.stringify({ stockQuantity: 250, note: "Restocked from Q4 vendor shipment" }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "60000000-0000-0000-0000-000000000004",
    adminUserId: "30000000-0000-0000-0000-000000000002", // Carol Manager
    action: "APPROVE",
    entityType: "ORDER",
    entityId: "ORD-202611-1001",
    oldValue: JSON.stringify({ status: "PENDING_APPROVAL" }),
    newValue: JSON.stringify({ status: "APPROVED", comment: "Approved for Engineering team sprints." }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "60000000-0000-0000-0000-000000000005",
    adminUserId: "30000000-0000-0000-0000-000000000003", // David Vance (Admin)
    action: "STOCK_ADJUST",
    entityType: "PRODUCT",
    entityId: "50000000-0000-0000-0000-000000000003", // Standing Desk Converter
    oldValue: JSON.stringify({ stockQuantity: 15 }),
    newValue: JSON.stringify({ stockQuantity: 30, note: "Warehouse replenishment" }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "60000000-0000-0000-0000-000000000006",
    adminUserId: "30000000-0000-0000-0000-000000000002", // Carol Manager
    action: "REJECT",
    entityType: "ORDER",
    entityId: "ORD-202611-1002",
    oldValue: JSON.stringify({ status: "PENDING_APPROVAL" }),
    newValue: JSON.stringify({ status: "REJECTED", reason: "Exceeds quarterly consumable budget allocation." }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
];
