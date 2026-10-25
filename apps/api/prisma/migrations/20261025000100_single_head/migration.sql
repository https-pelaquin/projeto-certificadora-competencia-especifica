-- Nunca dois chefes com vigência sobreposta (intervalo [startsAt, endsAt), endsAt nulo = sem fim).
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_single_head"
  EXCLUDE USING gist (tstzrange("startsAt", "endsAt") WITH &&) WHERE ("role" = 'HEAD');
