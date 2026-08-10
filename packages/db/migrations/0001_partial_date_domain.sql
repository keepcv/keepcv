-- Career dates are civil dates at whatever precision the user actually knows:
-- "2019", "Mar 2019", occasionally a full date. They have no timezone and must
-- never become a timestamptz (data-model.md #3.4). No column uses the domain
-- yet; the record store is what will.
--
-- The pattern is PARTIAL_DATE_PATTERN in @keepcv/schema, copied rather than
-- interpolated because a migration is reviewed SQL, not generated SQL. A test
-- feeds both the same values and fails if they disagree.
CREATE DOMAIN partial_date AS text
  CHECK (VALUE ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$');
