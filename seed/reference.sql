INSERT INTO locations (code,label,sort_order) VALUES ('CORP','Organisation / corporatif',1);

INSERT INTO departments (code,label,sort_order) VALUES
('sales','Ventes',10),
('service_repairs','Service / Réparations',20),
('warehouse_inventory','Entrepôt / Stock',30),
('administration','Administration',40),
('management','Direction',50),
('route_installation','Route / Installation',60),
('other','Autre',999);

INSERT INTO categories (code,label,sort_order) VALUES
('sales','Ventes',10),
('employees','Employés — opération / formation',20),
('repairs','Réparations',30),
('servex','Servex',40),
('purchasing_inventory','Achats et stock',50),
('warranty_returns','Garanties et retours',60),
('administration','Administration',70),
('interbranch_communications','Communications entre succursales',80),
('customer_experience','Expérience client',90);

INSERT INTO impact_types (code,label,sort_order) VALUES
('none_external','Aucun impact externe',10),
('time_lost','Temps perdu',20),
('client_delay','Retard client',30),
('client_dissatisfaction','Insatisfaction client',40),
('financial_loss','Perte financière',50),
('wrong_order','Mauvaise commande',60),
('inventory_error','Mauvais inventaire',70),
('rework','Travail à refaire',80),
('product_returned','Produit retourné',90),
('other','Autre',999);

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'pricing_error','Erreur de prix',10 FROM categories WHERE code='sales';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'wrong_product','Mauvais produit',20 FROM categories WHERE code='sales';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'quote_error','Erreur de soumission',30 FROM categories WHERE code='sales';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'missing_followup','Suivi manquant',40 FROM categories WHERE code='sales';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'training_gap','Besoin de formation',10 FROM categories WHERE code='employees';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'procedure_not_followed','Procédure non suivie',20 FROM categories WHERE code='employees';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'unclear_procedure','Procédure imprécise',30 FROM categories WHERE code='employees';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'responsibility_unclear','Responsabilité imprécise',40 FROM categories WHERE code='employees';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'diagnosis','Diagnostic',10 FROM categories WHERE code='repairs';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'parts','Pièces',20 FROM categories WHERE code='repairs';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'delay','Délai',30 FROM categories WHERE code='repairs';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'quality_control','Contrôle qualité',40 FROM categories WHERE code='repairs';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'data_entry','Saisie de données',10 FROM categories WHERE code='servex';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'invoicing','Facturation',20 FROM categories WHERE code='servex';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'work_order_status','Statut dossier',30 FROM categories WHERE code='servex';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'configuration','Configuration',40 FROM categories WHERE code='servex';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'order_error','Erreur de commande',10 FROM categories WHERE code='purchasing_inventory';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'receiving_error','Erreur de réception',20 FROM categories WHERE code='purchasing_inventory';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'stock_discrepancy','Écart inventaire',30 FROM categories WHERE code='purchasing_inventory';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'supplier_delay','Délai fournisseur',40 FROM categories WHERE code='purchasing_inventory';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'missing_document','Document manquant',10 FROM categories WHERE code='warranty_returns';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'supplier_rejection','Refus fournisseur',20 FROM categories WHERE code='warranty_returns';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'return_process','Processus retour',30 FROM categories WHERE code='warranty_returns';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'warranty_delay','Délai garantie',40 FROM categories WHERE code='warranty_returns';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'billing','Facturation',10 FROM categories WHERE code='administration';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'accounting','Comptabilité',20 FROM categories WHERE code='administration';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'documentation','Documentation',30 FROM categories WHERE code='administration';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'process','Processus',40 FROM categories WHERE code='administration';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'missing_information','Information manquante',10 FROM categories WHERE code='interbranch_communications';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'transfer_error','Erreur de transfert',20 FROM categories WHERE code='interbranch_communications';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'unclear_responsibility','Responsabilité imprécise',30 FROM categories WHERE code='interbranch_communications';

INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'communication','Communication',10 FROM categories WHERE code='customer_experience';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'delay','Délai',20 FROM categories WHERE code='customer_experience';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'service','Service',30 FROM categories WHERE code='customer_experience';
INSERT INTO subcategories (category_id,code,label,sort_order)
SELECT id,'complaint','Plainte',40 FROM categories WHERE code='customer_experience';
