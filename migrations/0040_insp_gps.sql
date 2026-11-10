-- Where the inspection was actually made: the phone's GPS position (or the pin moved by the valuer on the map before signing),
-- with its accuracy and time. Separate from lat/lng (the address geocoded when the inspection was prepared).
ALTER TABLE inspections ADD COLUMN gps_lat REAL;
ALTER TABLE inspections ADD COLUMN gps_lng REAL;
ALTER TABLE inspections ADD COLUMN gps_acc REAL;
ALTER TABLE inspections ADD COLUMN gps_at TEXT;
ALTER TABLE inspections ADD COLUMN gps_src TEXT;   -- gps | manual
