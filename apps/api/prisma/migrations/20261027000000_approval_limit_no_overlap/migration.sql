-- Um limite não termina antes (nem junto) de começar.
ALTER TABLE "ApprovalLimit" ADD CONSTRAINT "ApprovalLimit_period_check"
  CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom");

-- Nunca dois limites vigentes ao mesmo tempo (intervalo [validFrom, validUntil), validUntil nulo = sem fim).
ALTER TABLE "ApprovalLimit" ADD CONSTRAINT "ApprovalLimit_no_overlap"
  EXCLUDE USING gist (tstzrange("validFrom", "validUntil") WITH &&);
