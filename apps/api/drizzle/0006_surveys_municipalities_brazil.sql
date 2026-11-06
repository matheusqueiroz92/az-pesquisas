-- Spec 013, change 1: surveys may go to municipalities of any state (e.g. the
-- north of Minas Gerais), not only Bahia. IBGE codes start with the state code
-- (11 to 53); the exact list is checked by the API.
ALTER TABLE "surveys" DROP CONSTRAINT "surveys_municipalities_check";
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_municipalities_check"
  CHECK (1100000 <= ALL ("municipality_codes") AND 5399999 >= ALL ("municipality_codes")
         AND cardinality("municipality_codes") <= 1000);
