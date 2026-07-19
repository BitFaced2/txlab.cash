import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Freshness state — required on every registry entry.
 * The whole registry is only as useful as its honesty about what's alive.
 */
const freshness = z.enum([
  "active",
  "maintained",
  "experimental",
  "seeking-maintainers",
  "archived",
  "unverified",
]);

const category = z.enum([
  "wallet",
  "explorer",
  "node",
  "library",
  "indexer",
  "defi",
  "nft",
  "infrastructure",
  "tool",
  "game",
  "social",
  "merchant-service",
  "other",
]);

const platform = z.enum([
  "ios",
  "android",
  "desktop-linux",
  "desktop-macos",
  "desktop-windows",
  "web",
  "browser-extension",
  "hardware",
  "cli",
  "server",
]);

const custody = z.enum(["custodial", "non-custodial", "hybrid", "n/a"]);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date format YYYY-MM-DD");

const capabilities = z
  .object({
    cashtokens: z.boolean().optional(),
    nfts: z.boolean().optional(),
    cashfusion: z.boolean().optional(),
    rpa: z.boolean().optional(),
    multisig: z.boolean().optional(),
    merchantMode: z.boolean().optional(),
    walletConnect: z.boolean().optional(),
    cashConnect: z.boolean().optional(),
    testnet: z.boolean().optional(),
    watchOnly: z.boolean().optional(),
    hardwareWalletSupport: z.boolean().optional(),
    fiatPurchase: z.boolean().optional(),
  })
  .default({});

const securityReview = z.object({
  reviewer: z.string(),
  url: z.string().url(),
  date: isoDate,
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{yaml,yml}", base: "./src/content/projects" }),
  schema: z.object({
    name: z.string(),
    tagline: z.string().max(140),
    description: z.string(),
    category,
    subcategory: z.string().optional(),

    website: z.string().url().optional(),
    repository: z.string().url().optional(),
    documentation: z.string().url().optional(),

    maintainers: z.array(z.string()).default([]),
    license: z.string().optional(),

    freshness,
    lastVerified: isoDate,

    platforms: z.array(platform).default([]),
    custody: custody.optional(),

    capabilities,

    bchDonationAddress: z.string().optional(),
    fundingLinks: z.array(z.string().url()).default([]),
    securityReviews: z.array(securityReview).default([]),

    bcmrVerified: z.boolean().default(false),
    bcmrIdentity: z.string().optional(),

    translations: z.array(z.string()).default([]),

    featured: z.boolean().default(false),
  }),
});

export const collections = { projects };
