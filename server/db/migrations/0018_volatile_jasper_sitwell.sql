CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"server_url" varchar(500),
	"encrypted_token" text,
	"default_household_id" integer,
	"default_shopping_list_id" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"enable_normalization" boolean DEFAULT true NOT NULL,
	"use_ai_normalization" boolean DEFAULT true NOT NULL,
	"normalization_model" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_integrations_user_type" UNIQUE("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "ingredient_name_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_name_mappings_raw_name_unique" UNIQUE("raw_name")
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_integrations_user_id" ON "integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ingredient_mappings_raw" ON "ingredient_name_mappings" USING btree ("raw_name");