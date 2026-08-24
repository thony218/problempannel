INSERT INTO locations (code,label,sort_order) VALUES ('TEST','Succursale TEST',10);

INSERT INTO users (email,display_name,role,default_location_id,default_department_id,active)
SELECT 'employee@example.test','Employé Test','employee',l.id,d.id,1
FROM locations l, departments d WHERE l.code='TEST' AND d.code='sales';

INSERT INTO users (email,display_name,role,default_location_id,default_department_id,active)
SELECT 'manager@example.test','Gestionnaire Test','manager',l.id,d.id,1
FROM locations l, departments d WHERE l.code='TEST' AND d.code='management';

INSERT INTO users (email,display_name,role,default_location_id,default_department_id,active)
SELECT 'admin@example.test','Admin Test','admin',l.id,d.id,1
FROM locations l, departments d WHERE l.code='TEST' AND d.code='management';
