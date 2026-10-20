CREATE TYPE "Role" AS ENUM ('SHOPPER', 'VENDOR', 'ADMIN', 'SUPPORT');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'ARCHIVED');
CREATE TYPE "ReelStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');
CREATE TYPE "LiveStreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "LiveProvider" AS ENUM ('AGORA', 'LIVEKIT');
CREATE TYPE "OrderStatus" AS ENUM (
    'AWAITING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
);
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'HELD', 'DISPUTED', 'RELEASED', 'REFUNDED');
CREATE TYPE "EscrowAction" AS ENUM ('FUND', 'DISPUTE', 'RELEASE', 'REFUND');
CREATE TYPE "LedgerEntryType" AS ENUM ('ESCROW_FUND', 'ESCROW_RELEASE', 'ESCROW_REFUND');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(32),
    "displayName" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "role")
);

CREATE TABLE "VendorProfile" (
    "userId" UUID NOT NULL,
    "storeName" VARCHAR(80) NOT NULL,
    "bio" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "VendorProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ProductListing" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(4000),
    "priceCents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ZAR',
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "imageKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ProductListing_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductListing_priceCents_positive" CHECK ("priceCents" > 0)
);

CREATE TABLE "ProductReel" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "listingId" UUID,
    "caption" VARCHAR(500),
    "videoKey" VARCHAR(1024) NOT NULL,
    "thumbnailKey" VARCHAR(1024),
    "status" "ReelStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductReel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveStream" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "provider" "LiveProvider" NOT NULL,
    "providerRoomId" VARCHAR(255) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "LiveStreamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_amountCents_positive" CHECK ("amountCents" > 0),
    CONSTRAINT "Order_distinct_parties" CHECK ("buyerId" <> "sellerId")
);

CREATE TABLE "Wallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "availableCents" BIGINT NOT NULL DEFAULT 0,
    "heldCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Wallet_availableCents_nonnegative" CHECK ("availableCents" >= 0),
    CONSTRAINT "Wallet_heldCents_nonnegative" CHECK ("heldCents" >= 0)
);

CREATE TABLE "EscrowTransaction" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EscrowTransaction_amountCents_positive" CHECK ("amountCents" > 0),
    CONSTRAINT "EscrowTransaction_distinct_parties" CHECK ("buyerId" <> "sellerId")
);

CREATE TABLE "EscrowTransition" (
    "id" UUID NOT NULL,
    "escrowId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "EscrowAction" NOT NULL,
    "fromStatus" "EscrowStatus" NOT NULL,
    "toStatus" "EscrowStatus" NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscrowTransition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EscrowTransition_status_changed" CHECK ("fromStatus" <> "toStatus")
);

CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "escrowId" UUID NOT NULL,
    "transitionId" UUID NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "availableDeltaCents" BIGINT NOT NULL,
    "heldDeltaCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LedgerEntry_nonzero_delta" CHECK (
        "availableDeltaCents" <> 0 OR "heldDeltaCents" <> 0
    )
);

CREATE FUNCTION prevent_ledger_entry_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable';
END;
$$;

CREATE TRIGGER "LedgerEntry_immutable"
    BEFORE UPDATE OR DELETE ON "LedgerEntry"
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "UserRole_role_userId_idx" ON "UserRole"("role", "userId");
CREATE UNIQUE INDEX "VendorProfile_storeName_key" ON "VendorProfile"("storeName");
CREATE INDEX "ProductListing_vendorId_status_createdAt_idx"
    ON "ProductListing"("vendorId", "status", "createdAt");
CREATE INDEX "ProductListing_status_createdAt_idx"
    ON "ProductListing"("status", "createdAt");
CREATE INDEX "ProductReel_status_publishedAt_idx" ON "ProductReel"("status", "publishedAt");
CREATE INDEX "ProductReel_vendorId_createdAt_idx" ON "ProductReel"("vendorId", "createdAt");
CREATE UNIQUE INDEX "LiveStream_providerRoomId_key" ON "LiveStream"("providerRoomId");
CREATE INDEX "LiveStream_status_scheduledAt_idx" ON "LiveStream"("status", "scheduledAt");
CREATE INDEX "LiveStream_vendorId_createdAt_idx" ON "LiveStream"("vendorId", "createdAt");
CREATE INDEX "Order_buyerId_status_createdAt_idx" ON "Order"("buyerId", "status", "createdAt");
CREATE INDEX "Order_sellerId_status_createdAt_idx" ON "Order"("sellerId", "status", "createdAt");
CREATE INDEX "Order_listingId_status_idx" ON "Order"("listingId", "status");
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");
CREATE UNIQUE INDEX "EscrowTransaction_orderId_key" ON "EscrowTransaction"("orderId");
CREATE INDEX "EscrowTransaction_buyerId_status_createdAt_idx"
    ON "EscrowTransaction"("buyerId", "status", "createdAt");
CREATE INDEX "EscrowTransaction_sellerId_status_createdAt_idx"
    ON "EscrowTransaction"("sellerId", "status", "createdAt");
CREATE UNIQUE INDEX "EscrowTransition_idempotencyKey_key"
    ON "EscrowTransition"("idempotencyKey");
CREATE INDEX "EscrowTransition_escrowId_createdAt_idx"
    ON "EscrowTransition"("escrowId", "createdAt");
CREATE INDEX "EscrowTransition_actorUserId_createdAt_idx"
    ON "EscrowTransition"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "LedgerEntry_walletId_transitionId_key"
    ON "LedgerEntry"("walletId", "transitionId");
CREATE INDEX "LedgerEntry_escrowId_createdAt_idx" ON "LedgerEntry"("escrowId", "createdAt");
CREATE INDEX "LedgerEntry_walletId_createdAt_idx" ON "LedgerEntry"("walletId", "createdAt");

ALTER TABLE "UserRole"
    ADD CONSTRAINT "UserRole_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorProfile"
    ADD CONSTRAINT "VendorProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductListing"
    ADD CONSTRAINT "ProductListing_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductReel"
    ADD CONSTRAINT "ProductReel_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductReel"
    ADD CONSTRAINT "ProductReel_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "ProductListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveStream"
    ADD CONSTRAINT "LiveStream_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "ProductListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet"
    ADD CONSTRAINT "Wallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowTransaction"
    ADD CONSTRAINT "EscrowTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowTransaction"
    ADD CONSTRAINT "EscrowTransaction_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowTransaction"
    ADD CONSTRAINT "EscrowTransaction_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowTransition"
    ADD CONSTRAINT "EscrowTransition_escrowId_fkey"
    FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowTransition"
    ADD CONSTRAINT "EscrowTransition_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_escrowId_fkey"
    FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_transitionId_fkey"
    FOREIGN KEY ("transitionId") REFERENCES "EscrowTransition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
