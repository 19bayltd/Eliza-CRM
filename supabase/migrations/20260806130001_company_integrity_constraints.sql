-- Migration: company-integrity constraints (review finding, Phase 03)
-- Purpose: make cross-company reference corruption IMPOSSIBLE at the
--          database level. Review found that child rows carry their own
--          company_id while their FKs reference bare ids, so a server-side
--          bug mis-stamping company_id could re-scope confidential rows
--          (e.g. a quotation cost readable by the wrong tenant) with RLS
--          none the wiser. Composite FKs pin every child's company_id to
--          its parent's, and variants to their product.
-- Rollback: drop the composite FKs, then the unique (id, company_id) keys.
-- Notes: additive only; existing data verified consistent before apply.

-- Parent keys required for composite references.
alter table public.branches           add constraint branches_id_company_key           unique (id, company_id);
alter table public.units              add constraint units_id_company_key              unique (id, company_id);
alter table public.categories         add constraint categories_id_company_key         unique (id, company_id);
alter table public.attributes         add constraint attributes_id_company_key         unique (id, company_id);
alter table public.attribute_values   add constraint attribute_values_id_company_key   unique (id, company_id);
alter table public.products           add constraint products_id_company_key           unique (id, company_id);
alter table public.product_variants   add constraint product_variants_id_company_key   unique (id, company_id);
alter table public.product_variants   add constraint product_variants_id_product_key   unique (id, product_id);
alter table public.import_jobs        add constraint import_jobs_id_company_key        unique (id, company_id);
alter table public.file_metadata      add constraint file_metadata_id_company_key      unique (id, company_id);
alter table public.suppliers          add constraint suppliers_id_company_key          unique (id, company_id);
alter table public.supplier_quotations add constraint supplier_quotations_id_company_key unique (id, company_id);

-- Phase 01 organization: children pinned to their branch's company.
alter table public.warehouses
  add constraint warehouses_branch_company_fkey
  foreign key (branch_id, company_id) references public.branches (id, company_id);
alter table public.departments
  add constraint departments_branch_company_fkey
  foreign key (branch_id, company_id) references public.branches (id, company_id);

-- Phase 02 product domain.
alter table public.categories
  add constraint categories_parent_company_fkey
  foreign key (parent_id, company_id) references public.categories (id, company_id);
alter table public.attribute_values
  add constraint attribute_values_attribute_company_fkey
  foreign key (attribute_id, company_id) references public.attributes (id, company_id);
alter table public.products
  add constraint products_category_company_fkey
  foreign key (category_id, company_id) references public.categories (id, company_id);
alter table public.products
  add constraint products_unit_company_fkey
  foreign key (unit_id, company_id) references public.units (id, company_id);
alter table public.product_variants
  add constraint product_variants_product_company_fkey
  foreign key (product_id, company_id) references public.products (id, company_id);
alter table public.variant_attribute_values
  add constraint vav_variant_company_fkey
  foreign key (variant_id, company_id) references public.product_variants (id, company_id);
alter table public.variant_attribute_values
  add constraint vav_value_company_fkey
  foreign key (attribute_value_id, company_id) references public.attribute_values (id, company_id);
alter table public.product_intelligence
  add constraint product_intelligence_product_company_fkey
  foreign key (product_id, company_id) references public.products (id, company_id);
alter table public.product_images
  add constraint product_images_product_company_fkey
  foreign key (product_id, company_id) references public.products (id, company_id);
alter table public.product_images
  add constraint product_images_file_company_fkey
  foreign key (file_id, company_id) references public.file_metadata (id, company_id);
alter table public.import_job_rows
  add constraint import_job_rows_job_company_fkey
  foreign key (job_id, company_id) references public.import_jobs (id, company_id);

-- Phase 03 supplier domain.
alter table public.supplier_contacts
  add constraint supplier_contacts_supplier_company_fkey
  foreign key (supplier_id, company_id) references public.suppliers (id, company_id);
alter table public.supplier_quotations
  add constraint supplier_quotations_supplier_company_fkey
  foreign key (supplier_id, company_id) references public.suppliers (id, company_id);
alter table public.supplier_quotations
  add constraint supplier_quotations_product_company_fkey
  foreign key (product_id, company_id) references public.products (id, company_id);
-- Pin the quoted variant to the quoted product (NULL variant passes).
alter table public.supplier_quotations
  add constraint supplier_quotations_variant_product_fkey
  foreign key (variant_id, product_id) references public.product_variants (id, product_id);
alter table public.supplier_quotation_costs
  add constraint quotation_costs_quotation_company_fkey
  foreign key (quotation_id, company_id) references public.supplier_quotations (id, company_id);
alter table public.supplier_documents
  add constraint supplier_documents_supplier_company_fkey
  foreign key (supplier_id, company_id) references public.suppliers (id, company_id);
alter table public.supplier_documents
  add constraint supplier_documents_file_company_fkey
  foreign key (file_id, company_id) references public.file_metadata (id, company_id);
