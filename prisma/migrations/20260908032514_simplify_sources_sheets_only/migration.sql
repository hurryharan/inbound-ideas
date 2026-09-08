/*
  Warnings:

  - You are about to drop the column `type` on the `Source` table. All the data in the column will be lost.
  - You are about to drop the column `sourceType` on the `SourceItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Source" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "SourceItem" DROP COLUMN "sourceType";

-- DropEnum
DROP TYPE "SourceType";
