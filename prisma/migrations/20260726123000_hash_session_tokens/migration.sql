ALTER TABLE "Session" RENAME COLUMN "token" TO "tokenHash";
ALTER INDEX "Session_token_key" RENAME TO "Session_tokenHash_key";
