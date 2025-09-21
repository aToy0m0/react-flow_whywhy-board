DO $$
DECLARE
  user_table_exists BOOLEAN;
  userrole_labels TEXT[];
  has_legacy_roles BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'User'
  ) INTO user_table_exists;

  IF NOT user_table_exists THEN
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'UserRole_new'
    ) THEN
      EXECUTE 'DROP TYPE "public"."UserRole_new"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'UserRole'
    ) THEN
      EXECUTE 'DROP TYPE "public"."UserRole"';
    END IF;

    EXECUTE 'CREATE TYPE "public"."UserRole" AS ENUM (''SUPER_ADMIN'', ''TENANT_ADMIN'', ''MEMBER'')';

    EXECUTE 'CREATE TABLE "public"."User" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" "public"."UserRole" NOT NULL DEFAULT ''MEMBER'',
      "tenantId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "User_email_key" UNIQUE ("email")
    )';

    EXECUTE 'ALTER TABLE "public"."User"
      ADD CONSTRAINT "User_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  ELSE
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
      INTO userrole_labels
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE n.nspname = 'public'
      AND t.typname = 'UserRole';

    has_legacy_roles := userrole_labels IS NOT NULL AND (
      'ADMIN' = ANY(userrole_labels) OR
      'USER' = ANY(userrole_labels)
    );

    IF userrole_labels IS NULL THEN
      IF to_regclass('public."User"') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM pg_attribute
          WHERE attrelid = to_regclass('public."User"')
            AND attname = 'role'
        ) THEN
          EXECUTE 'ALTER TABLE "public"."User" DROP COLUMN "role"';
        END IF;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'UserRole_new'
      ) THEN
        EXECUTE 'DROP TYPE "public"."UserRole_new"';
      END IF;

      EXECUTE 'CREATE TYPE "public"."UserRole" AS ENUM (''SUPER_ADMIN'', ''TENANT_ADMIN'', ''MEMBER'')';

      EXECUTE 'ALTER TABLE "public"."User"
        ADD COLUMN "role" "public"."UserRole" NOT NULL DEFAULT ''MEMBER''';
    ELSIF has_legacy_roles THEN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'UserRole_new'
      ) THEN
        EXECUTE 'DROP TYPE "public"."UserRole_new"';
      END IF;

      EXECUTE 'ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT';

      EXECUTE 'CREATE TYPE "public"."UserRole_new" AS ENUM (''SUPER_ADMIN'', ''TENANT_ADMIN'', ''MEMBER'')';

      EXECUTE 'ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."UserRole_new" USING (
        CASE
          WHEN "role"::text = ''ADMIN'' THEN ''SUPER_ADMIN''::"public"."UserRole_new"
          WHEN "role"::text = ''USER'' THEN ''MEMBER''::"public"."UserRole_new"
          ELSE ''MEMBER''::"public"."UserRole_new"
        END
      )';

      EXECUTE 'ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT ''MEMBER''';

      EXECUTE 'DROP TYPE IF EXISTS "public"."UserRole"';

      EXECUTE 'ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole"';

      EXECUTE 'UPDATE "public"."User" SET "role" = ''SUPER_ADMIN'' WHERE email ILIKE ''sadmin%''';
    ELSE
      EXECUTE 'ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT ''MEMBER''';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'User_email_key'
        AND c.conrelid = to_regclass('public."User"')
    ) THEN
      EXECUTE 'ALTER TABLE "public"."User" ADD CONSTRAINT "User_email_key" UNIQUE ("email")';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'User_tenantId_fkey'
        AND c.conrelid = to_regclass('public."User"')
    ) THEN
      EXECUTE 'ALTER TABLE "public"."User"
        ADD CONSTRAINT "User_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Board_ownerId_idx'
      AND n.nspname = 'public'
      AND c.relkind = 'i'
  ) THEN
    EXECUTE 'CREATE INDEX "Board_ownerId_idx" ON "public"."Board"("ownerId")';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conname = 'Board_ownerId_fkey'
      AND con.conrelid = to_regclass('public."Board"')
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Board"
      ADD CONSTRAINT "Board_ownerId_fkey"
      FOREIGN KEY ("ownerId")
      REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
