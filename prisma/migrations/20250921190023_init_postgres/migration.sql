-- CreateTable
CREATE TABLE "public"."Fight" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seed" TEXT,
    "ticks" INTEGER NOT NULL,
    "winner" TEXT,
    "count" INTEGER NOT NULL,
    "user" TEXT,
    "leaderboard" JSONB NOT NULL,

    CONSTRAINT "Fight_pkey" PRIMARY KEY ("id")
);
