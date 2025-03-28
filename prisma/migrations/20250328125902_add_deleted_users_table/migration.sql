-- CreateTable
CREATE TABLE "DeletedUsers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedReason" TEXT,

    CONSTRAINT "DeletedUsers_pkey" PRIMARY KEY ("id")
);
