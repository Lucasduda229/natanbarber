-- 1. Adiciona a coluna category na tabela store_products
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Vales';

-- 2. Atualiza produtos existentes para a categoria Vales caso já não tenham uma
UPDATE public.store_products
SET category = 'Vales'
WHERE category IS NULL;

-- 3. Insere os novos vales na loja com o custo padrão de 10 tickets
INSERT INTO public.store_products (name, image_url, cost_in_tickets, category, active)
VALUES 
  ('Cupom de Desconto 10%', '/vales/cupom%20de%20desconto%2010%25.png', 10, 'Vales', true),
  ('Cupom de Desconto 5%', '/vales/cupom%20de%20desconto%205%25.png', 10, 'Vales', true),
  ('Vale Barba', '/vales/vale%20barba.png', 10, 'Vales', true),
  ('Vale Corte', '/vales/vale%20corte.png', 10, 'Vales', true),
  ('Vale Pezinho', '/vales/vale%20pezinho.png', 10, 'Vales', true);
